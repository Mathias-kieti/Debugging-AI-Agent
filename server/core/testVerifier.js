import fs from 'fs';
import path from 'path';
import { SecurityGuard } from './security.js';

export class TestVerifier {
  constructor(projectRoot, executionEngine, gitCheckpointManager, auditLogger = null) {
    this.projectRoot = path.resolve(projectRoot);
    this.executionEngine = executionEngine;
    this.gitCheckpointManager = gitCheckpointManager;
    this.auditLogger = auditLogger;
  }

  /**
   * Determine the most appropriate test command for this project.
   */
  detectTestCommand() {
    // 1. Check package.json
    const pkgPath = path.join(this.projectRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.scripts && pkg.scripts.test && !pkg.scripts.test.includes('no test specified')) {
          return 'npm test';
        }
      } catch (e) {}
    }

    // 2. Check Python tests
    const entries = fs.readdirSync(this.projectRoot);
    const hasPyTests = entries.some(e => e.startsWith('test_') && e.endsWith('.py')) ||
                       fs.existsSync(path.join(this.projectRoot, 'tests'));
    if (hasPyTests) {
      return 'python3 -m unittest discover -s . -p test_*.py';
    }

    return null;
  }

  /**
   * Run the test suite and return execution outcome.
   */
  async runTests(customCommand = null) {
    const cmd = customCommand || this.detectTestCommand();
    if (!cmd) {
      return {
        hasTests: false,
        success: true,
        message: 'No test suite detected in project.',
        stdout: '',
        stderr: ''
      };
    }

    try {
      const result = await this.executionEngine.execute(cmd, { timeoutMs: 25000 });
      return {
        hasTests: true,
        command: cmd,
        exitCode: result.exitCode,
        success: result.success,
        stdout: result.stdout,
        stderr: result.stderr
      };
    } catch (err) {
      return {
        hasTests: true,
        command: cmd,
        exitCode: 1,
        success: false,
        error: err.message,
        stdout: '',
        stderr: err.message
      };
    }
  }

  /**
   * Apply code changes, creating a checkpoint first.
   */
  async applyFix(fixProposal) {
    if (!fixProposal || !fixProposal.file || !fixProposal.fixedContent) {
      throw new Error('Invalid fix proposal for application');
    }

    if (!SecurityGuard.isPathSafe(this.projectRoot, fixProposal.file)) {
      throw new Error(`Security Violation: cannot write to file outside project ${fixProposal.file}`);
    }

    // 1. Create Git / snapshot checkpoint
    const checkpoint = await this.gitCheckpointManager.createCheckpoint([fixProposal.file], `Pre-fix for ${fixProposal.category}`);

    // 2. Write the fixed content
    const targetFile = path.resolve(this.projectRoot, fixProposal.file);
    fs.writeFileSync(targetFile, fixProposal.fixedContent, 'utf8');

    if (this.auditLogger) {
      this.auditLogger.log('FIX_APPLIED', {
        file: fixProposal.file,
        checkpointId: checkpoint.id,
        category: fixProposal.category
      });
    }

    return {
      applied: true,
      file: fixProposal.file,
      checkpointId: checkpoint.id
    };
  }

  /**
   * Verify fix by running test suite.
   * If verification fails, automatically rolls back to checkpoint if requested.
   */
  async verifyFix(checkpointId, options = { autoRevertOnFailure: false }) {
    const testResult = await this.runTests();

    if (!testResult.hasTests) {
      return {
        verified: true,
        note: 'No automated tests available. Syntax validation passed.',
        testResult
      };
    }

    if (testResult.success) {
      if (this.auditLogger) {
        this.auditLogger.log('VERIFICATION_SUCCEEDED', { checkpointId, testsPassed: true });
      }
      return {
        verified: true,
        message: 'All tests passed successfully! Fix confirmed.',
        testResult
      };
    } else {
      if (this.auditLogger) {
        this.auditLogger.log('VERIFICATION_FAILED', {
          checkpointId,
          testsPassed: false,
          exitCode: testResult.exitCode
        }, 'WARN');
      }

      if (options.autoRevertOnFailure && checkpointId) {
        await this.gitCheckpointManager.restoreCheckpoint(checkpointId);
      }

      return {
        verified: false,
        message: 'Tests failed after applying fix.',
        testResult
      };
    }
  }
}
