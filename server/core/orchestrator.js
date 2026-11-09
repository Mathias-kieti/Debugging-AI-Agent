import path from 'path';
import { CodebaseAnalyzer } from './codebaseAnalyzer.js';
import { ErrorDetector } from './errorDetector.js';
import { RootCauseAnalyzer } from './rootCauseAnalyzer.js';
import { FixGenerator } from './fixGenerator.js';
import { TestVerifier } from './testVerifier.js';
import { ExecutionEngine } from './executionEngine.js';
import { GitCheckpointManager } from './gitCheckpoint.js';
import { AuditLogger } from './auditLogger.js';
import { LLMProviderManager } from './providers/llmProvider.js';
import { CONFIG } from '../config.js';

export class AgentOrchestrator {
  constructor(projectRoot, options = {}) {
    this.projectRoot = path.resolve(projectRoot);
    this.mode = options.mode || 'assisted'; // 'assisted' | 'autonomous'
    this.auditLogger = new AuditLogger();
    this.executionEngine = new ExecutionEngine(this.projectRoot, this.auditLogger);
    this.gitCheckpointManager = new GitCheckpointManager(this.projectRoot);
    this.codebaseAnalyzer = new CodebaseAnalyzer(this.projectRoot);
    this.errorDetector = new ErrorDetector(this.projectRoot);
    this.rootCauseAnalyzer = new RootCauseAnalyzer(this.projectRoot);
    this.llmManager = new LLMProviderManager(options);
    this.fixGenerator = new FixGenerator(this.projectRoot, this.llmManager);
    this.testVerifier = new TestVerifier(this.projectRoot, this.executionEngine, this.gitCheckpointManager, this.auditLogger);

    this.state = 'IDLE'; // IDLE | SCANNING | DETECTING | ANALYZING | PROPOSING | WAITING_APPROVAL | APPLYING | VERIFYING | RESOLVED | FAILED
    this.subscribers = new Set();
    this.currentInvestigation = null;
    this.pendingFixProposal = null;
    this.history = [];
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  broadcast(event, payload = {}) {
    const message = {
      event,
      timestamp: new Date().toISOString(),
      state: this.state,
      mode: this.mode,
      payload
    };
    for (const sub of this.subscribers) {
      try {
        sub(message);
      } catch (e) {
        // subscriber error
      }
    }
  }

  setState(newState, payload = {}) {
    this.state = newState;
    this.broadcast('STATE_CHANGE', { state: newState, ...payload });
    this.auditLogger.log('STATE_CHANGE', { state: newState, ...payload });
  }

  setMode(newMode) {
    this.mode = newMode === 'autonomous' ? 'autonomous' : 'assisted';
    this.broadcast('MODE_CHANGED', { mode: this.mode });
  }

  /**
   * Run full debugging cycle on the connected project
   */
  async runDebuggingCycle(retryCount = 0) {
    try {
      // Step 1: Scan Codebase
      this.setState('SCANNING', { step: 'Scanning project files and architecture' });
      const codebaseMeta = await this.codebaseAnalyzer.scanProject();
      this.broadcast('CODEBASE_SCANNED', codebaseMeta);

      // Step 2: Detect Errors (Run Tests + Static Analysis)
      this.setState('DETECTING', { step: 'Running test suites and static analyzers to reproduce/detect errors' });
      const testResult = await this.testVerifier.runTests();
      let detectedErrors = [];

      if (!testResult.success) {
        detectedErrors = this.errorDetector.parseRuntimeErrors(testResult.stdout, testResult.stderr);
      }

      if (detectedErrors.length === 0) {
        // Run static analysis on source files
        const staticErrors = await this.errorDetector.scanForStaticBugs(codebaseMeta.files);
        detectedErrors.push(...staticErrors);
      }

      if (detectedErrors.length === 0) {
        this.setState('RESOLVED', { message: 'No bugs or test failures detected in project. Codebase is healthy!' });
        return { success: true, message: 'Codebase healthy. No errors found.' };
      }

      const primaryBug = detectedErrors[0];
      this.broadcast('ERROR_DETECTED', primaryBug);

      // Step 3: Root Cause Analysis
      this.setState('ANALYZING', { step: 'Investigating root cause and stack frames', error: primaryBug.message });
      const rca = await this.rootCauseAnalyzer.analyze(primaryBug, codebaseMeta);
      this.currentInvestigation = { error: primaryBug, rca };
      this.broadcast('RCA_COMPLETED', rca);

      // Step 4: Fix Proposal Generation
      this.setState('PROPOSING', { step: 'Synthesizing targeted fix and computing unified diff' });
      const fixProposal = await this.fixGenerator.generateFix(rca);

      if (!fixProposal || !fixProposal.success) {
        this.setState('FAILED', {
          reason: fixProposal?.message || 'Unable to synthesize a verified patch for this error.',
          rca
        });
        return { success: false, reason: fixProposal?.message };
      }

      this.pendingFixProposal = fixProposal;
      this.broadcast('FIX_PROPOSED', fixProposal);

      // Step 5: Mode decision (Assisted vs Autonomous)
      if (this.mode === 'assisted') {
        this.setState('WAITING_APPROVAL', {
          step: 'Awaiting user review and authorization to modify code',
          proposal: fixProposal
        });
        return {
          waitingApproval: true,
          proposal: fixProposal,
          rca
        };
      }

      // Step 6: Autonomous Mode - Apply Fix & Verify
      return await this.applyAndVerifyFix(fixProposal, retryCount);

    } catch (err) {
      this.setState('FAILED', { error: err.message });
      return { success: false, error: err.message };
    }
  }

  /**
   * Apply approved fix proposal and verify with test suite
   */
  async applyAndVerifyFix(proposal = null, retryCount = 0) {
    const targetProposal = proposal || this.pendingFixProposal;
    if (!targetProposal) {
      throw new Error('No pending fix proposal to apply.');
    }

    try {
      this.setState('APPLYING', { step: `Applying fix to ${targetProposal.file}` });
      const applyResult = await this.testVerifier.applyFix(targetProposal);

      this.setState('VERIFYING', { step: 'Executing automated test suite to verify resolution' });
      const verifyResult = await this.testVerifier.verifyFix(applyResult.checkpointId);

      const historyRecord = {
        id: `fix_${Date.now()}`,
        timestamp: new Date().toISOString(),
        file: targetProposal.file,
        diff: targetProposal.patch,
        description: targetProposal.description,
        appliedVia: targetProposal.appliedVia,
        checkpointId: applyResult.checkpointId,
        verified: verifyResult.verified,
        verificationDetails: verifyResult
      };

      this.history.unshift(historyRecord);
      this.pendingFixProposal = null;

      if (verifyResult.verified) {
        this.setState('RESOLVED', {
          message: 'Fix successfully applied and verified with passing tests!',
          record: historyRecord
        });
        return {
          success: true,
          record: historyRecord
        };
      } else {
        // Multi-turn recovery loop
        if (retryCount < CONFIG.MAX_FIX_RETRIES) {
          this.broadcast('RETRYING_FIX', {
            attempt: retryCount + 1,
            maxRetries: CONFIG.MAX_FIX_RETRIES,
            reason: 'Post-fix verification failed, initiating multi-turn re-analysis.'
          });
          return await this.runDebuggingCycle(retryCount + 1);
        } else {
          this.setState('FAILED', {
            reason: `Fix applied but verification tests failed after ${CONFIG.MAX_FIX_RETRIES} attempts.`,
            verification: verifyResult
          });
          return {
            success: false,
            reason: 'Verification failed after max retries.',
            verification: verifyResult
          };
        }
      }
    } catch (err) {
      this.setState('FAILED', { error: err.message });
      return { success: false, error: err.message };
    }
  }

  /**
   * Revert a previously applied fix
   */
  async revertFix(checkpointId) {
    const result = await this.gitCheckpointManager.restoreCheckpoint(checkpointId);
    this.broadcast('FIX_REVERTED', { checkpointId, result });
    this.auditLogger.log('FIX_REVERTED', { checkpointId, result });
    return result;
  }

  getStatus() {
    return {
      state: this.state,
      mode: this.mode,
      projectRoot: this.projectRoot,
      currentInvestigation: this.currentInvestigation,
      pendingFixProposal: this.pendingFixProposal,
      historyCount: this.history.length
    };
  }
}
