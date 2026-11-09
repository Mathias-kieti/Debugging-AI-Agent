import * as diff from 'diff';
import fs from 'fs';
import path from 'path';
import { parse as parseBabel } from '@babel/parser';
import { spawnSync } from 'child_process';
import { LLMProviderManager } from './providers/llmProvider.js';
import { SecurityGuard } from './security.js';

export class FixGenerator {
  constructor(projectRoot, llmManager = new LLMProviderManager()) {
    this.projectRoot = path.resolve(projectRoot);
    this.llmManager = llmManager;
  }

  /**
   * Generates a verified, targeted fix with a unified diff and side-by-side preview.
   */
  async generateFix(rca) {
    if (!rca || !rca.culpritFile) {
      throw new Error('Cannot generate fix without a culprit file identified in Root Cause Analysis.');
    }

    if (!SecurityGuard.isPathSafe(this.projectRoot, rca.culpritFile)) {
      throw new Error(`Security Violation: File ${rca.culpritFile} is outside project root.`);
    }

    const fullPath = path.resolve(this.projectRoot, rca.culpritFile);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Culprit file not found on disk: ${rca.culpritFile}`);
    }

    const originalContent = fs.readFileSync(fullPath, 'utf8');

    // Generate fix via provider manager
    const fixResult = await this.llmManager.generateFix(rca, this.projectRoot);
    if (!fixResult || !fixResult.fixedContent) {
      return {
        success: false,
        message: 'No suitable fix could be synthesized for this error.',
        rca
      };
    }

    const fixedContent = fixResult.fixedContent;

    // Validate syntax of fixed content before proposing
    const syntaxValid = this.validateSyntax(fixedContent, rca.culpritFile);
    if (!syntaxValid.valid) {
      return {
        success: false,
        message: `Generated fix failed syntax validation: ${syntaxValid.error}`,
        rca
      };
    }

    // Generate unified diff
    const patch = diff.createTwoFilesPatch(
      `a/${rca.culpritFile}`,
      `b/${rca.culpritFile}`,
      originalContent,
      fixedContent,
      'original',
      'fixed'
    );

    // Generate line-by-line diff chunks for UI
    const structuredDiff = diff.structuredPatch(
      `a/${rca.culpritFile}`,
      `b/${rca.culpritFile}`,
      originalContent,
      fixedContent
    );

    return {
      success: true,
      file: rca.culpritFile,
      patch,
      structuredDiff,
      originalContent,
      fixedContent,
      description: fixResult.description,
      appliedVia: fixResult.appliedVia,
      explanation: rca.explanation,
      rootCause: rca.rootCause,
      category: rca.category,
      culpritLine: rca.culpritLine
    };
  }

  validateSyntax(content, relativePath) {
    const ext = path.extname(relativePath).toLowerCase();

    if (['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'].includes(ext)) {
      try {
        parseBabel(content, {
          sourceType: 'unambiguous',
          plugins: ['jsx', 'typescript', 'classProperties']
        });
        return { valid: true };
      } catch (err) {
        return { valid: false, error: err.message };
      }
    } else if (ext === '.py') {
      const script = `
import ast, sys
try:
    ast.parse(sys.stdin.read())
    print("OK")
except SyntaxError as e:
    print(f"SyntaxError: {e.msg} at line {e.lineno}")
    sys.exit(1)
`;
      const res = spawnSync('python3', ['-c', script], { input: content, encoding: 'utf8', timeout: 5000 });
      if (res.status === 0 && res.stdout.includes('OK')) {
        return { valid: true };
      }
      return { valid: false, error: res.stdout || res.stderr || 'Python syntax error' };
    }

    return { valid: true };
  }
}
