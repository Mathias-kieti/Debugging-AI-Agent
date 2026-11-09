import path from 'path';
import fs from 'fs';
import { SecurityGuard } from '../server/core/security.js';
import { CodebaseAnalyzer } from '../server/core/codebaseAnalyzer.js';
import { ErrorDetector } from '../server/core/errorDetector.js';
import { RootCauseAnalyzer } from '../server/core/rootCauseAnalyzer.js';
import { FixGenerator } from '../server/core/fixGenerator.js';
import { AgentOrchestrator } from '../server/core/orchestrator.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failed++;
    throw new Error(message);
  } else {
    console.log(`✔ PASS: ${message}`);
    passed++;
  }
}

const BUGGY_PY_CONTENT = `def calculate_average(numbers):
    """
    Calculate the arithmetic mean of a list of numbers.
    Bug: Does not handle empty list gracefully, causing ZeroDivisionError.
    """
    total = sum(numbers)
    count = len(numbers)
    return total / count

def find_max(numbers):
    if not numbers:
        return None
    current_max = numbers[0]
    for num in numbers:
        if num > current_max:
            current_max = num
    return current_max
`;

const BUGGY_JS_CONTENT = `/**
 * User profile utilities
 */
export function formatUserProfile(user) {
  // Bug: user or user.profile might be undefined, causing TypeError: Cannot read properties of undefined
  return user.profile.name.toUpperCase();
}

export function calculateDiscount(price, rate) {
  if (price < 0) return 0;
  return price - (price * rate);
}
`;

function resetFixtures() {
  fs.writeFileSync(path.resolve(process.cwd(), 'sample-projects/buggy-python/calculator.py'), BUGGY_PY_CONTENT, 'utf8');
  fs.writeFileSync(path.resolve(process.cwd(), 'sample-projects/buggy-javascript/userUtils.js'), BUGGY_JS_CONTENT, 'utf8');
}

async function runTests() {
  resetFixtures();
  console.log('\n========================================');
  console.log('DevDebugger AI — Module Verification Tests');
  console.log('========================================\n');

  // Test 1: Security Guard
  console.log('[Test Suite 1] Security Guard & Jail Enforcement');
  const projectRoot = path.resolve(process.cwd(), 'sample-projects/buggy-python');
  assert(SecurityGuard.isPathSafe(projectRoot, 'calculator.py'), 'Allows valid relative path inside project');
  assert(!SecurityGuard.isPathSafe(projectRoot, '../../../../etc/passwd'), 'Blocks directory traversal outside project');
  assert(SecurityGuard.validateCommand('python3', ['-m', 'unittest']).safe, 'Allows permitted binary');
  assert(!SecurityGuard.validateCommand('rm', ['-rf', '/']).safe, 'Blocks disallowed dangerous command');
  assert(!SecurityGuard.validateCommand('node', ['app.js', ';', 'cat', '/etc/passwd']).safe, 'Blocks shell injection metacharacters');
  
  const sanitized = SecurityGuard.sanitizeOutput('key sk-1234567890abcdef1234567890abcdef and password=secrettoken123');
  assert(sanitized.includes('***REDACTED_SECRET***'), 'Redacts API keys and secrets from output');

  // Test 2: Codebase Analyzer
  console.log('\n[Test Suite 2] Codebase Analyzer & Multi-Language AST');
  const analyzer = new CodebaseAnalyzer(projectRoot);
  const scan = await analyzer.scanProject();
  assert(scan.totalFiles >= 2, 'Scanned project files accurately');
  assert(scan.primaryLanguage === 'Python', 'Accurately detected Python as primary language');

  const fileAnalysis = await analyzer.analyzeFile('calculator.py');
  assert(fileAnalysis.functions.some(f => f.name === 'calculate_average'), 'Extracted functions from Python AST');

  // Test 3: Error Detection & Stack Trace Parsing
  console.log('\n[Test Suite 3] Error Detector & Stack Trace Parser');
  const detector = new ErrorDetector(projectRoot);
  const sampleTraceback = `
Traceback (most recent call last):
  File "sample-projects/buggy-python/test_calculator.py", line 13, in test_average_empty_list
    self.assertEqual(calculate_average([]), 0)
  File "sample-projects/buggy-python/calculator.py", line 8, in calculate_average
    return total / count
ZeroDivisionError: division by zero
`;
  const parsedErrors = detector.parseRuntimeErrors(sampleTraceback, '');
  assert(parsedErrors.length > 0, 'Parsed Python traceback');
  assert(parsedErrors[0].errorClass === 'ZeroDivisionError', 'Identified errorClass as ZeroDivisionError');
  assert(parsedErrors[0].file.endsWith('calculator.py'), 'Identified culprit file');
  assert(parsedErrors[0].line === 8, 'Identified culprit line number 8');

  // Test 4: Root Cause Analysis
  console.log('\n[Test Suite 4] Root Cause Analyzer');
  const rcaEngine = new RootCauseAnalyzer(projectRoot);
  const rca = await rcaEngine.analyze(parsedErrors[0]);
  assert(rca.category === 'ARITHMETIC_ERROR', 'Categorized as ARITHMETIC_ERROR');
  assert(rca.rootCause.includes('0'), 'Identified root cause as division by zero');
  assert(rca.culpritLine === 8, 'Retained culprit line in RCA');

  // Test 5: Fix Generator & Patching
  console.log('\n[Test Suite 5] Fix Generator & Unified Diff Engine');
  const fixGen = new FixGenerator(projectRoot);
  const fixProposal = await fixGen.generateFix(rca);
  assert(fixProposal.success, 'Successfully generated targeted fix');
  assert(fixProposal.patch.includes('@@'), 'Produced standard unified diff patch');
  assert(fixProposal.fixedContent.includes('!= 0'), 'Synthesized proper zero guard in fixed code');

  // Test 6: Full End-to-End Autonomous Debugging Cycle on Python Project
  console.log('\n[Test Suite 6] Autonomous End-to-End Debugging on Python Project');
  const pyOrchestrator = new AgentOrchestrator(projectRoot, { mode: 'autonomous' });
  const pyResult = await pyOrchestrator.runDebuggingCycle();
  assert(pyResult.success, 'End-to-end debugging cycle resolved the Python bug');
  assert(pyOrchestrator.state === 'RESOLVED', 'Agent reached RESOLVED state');
  assert(pyOrchestrator.history.length === 1, 'Recorded fix in history');

  // Verify that the python tests now pass!
  const verifyPython = await pyOrchestrator.testVerifier.runTests();
  assert(verifyPython.success, 'Python test suite now passes with 0 failures');

  // Test 7: Git Checkpoint Rollback
  console.log('\n[Test Suite 7] Git Checkpoint Manager & Instant Rollback');
  const checkpointId = pyOrchestrator.history[0].checkpointId;
  const revertResult = await pyOrchestrator.revertFix(checkpointId);
  assert(revertResult.success, 'Reverted fix using checkpoint snapshot');
  
  // Verify that after rollback, original bug is restored and test fails again
  const verifyReverted = await pyOrchestrator.testVerifier.runTests();
  assert(!verifyReverted.success, 'Tests fail after rollback as expected (clean restoration)');

  // Re-run autonomous fix so sample project stays fixed
  const reFix = await pyOrchestrator.runDebuggingCycle();
  assert(reFix.success, 'Re-applied fix autonomously');

  // Test 8: Assisted Mode Approval Gate
  console.log('\n[Test Suite 8] Assisted Mode & User Approval Gate');
  // Revert back so we can test assisted mode approval gate
  await pyOrchestrator.revertFix(pyOrchestrator.history[0].checkpointId);
  
  const assistedOrchestrator = new AgentOrchestrator(projectRoot, { mode: 'assisted' });
  const assistedResult = await assistedOrchestrator.runDebuggingCycle();
  assert(assistedResult.waitingApproval === true, 'Assisted mode halted at WAITING_APPROVAL');
  assert(assistedOrchestrator.state === 'WAITING_APPROVAL', 'State is WAITING_APPROVAL');
  assert(assistedOrchestrator.pendingFixProposal !== null, 'Pending fix proposal is stored for user review');

  // User authorizes the fix
  const userApprovalResult = await assistedOrchestrator.applyAndVerifyFix();
  assert(userApprovalResult.success === true, 'Fix successfully applied and verified upon user approval');
  assert(assistedOrchestrator.state === 'RESOLVED', 'Assisted state transitioned to RESOLVED');

  // Test 9: JavaScript Debugging Workflow
  console.log('\n[Test Suite 9] JavaScript / Node.js Autonomous Debugging Workflow');
  const jsProjectRoot = path.resolve(process.cwd(), 'sample-projects/buggy-javascript');
  const jsOrchestrator = new AgentOrchestrator(jsProjectRoot, { mode: 'autonomous' });
  const jsResult = await jsOrchestrator.runDebuggingCycle();
  assert(jsResult.success === true, 'JavaScript autonomous debugging resolved TypeError');
  assert(jsOrchestrator.state === 'RESOLVED', 'JavaScript agent reached RESOLVED state');
  
  const verifyJs = await jsOrchestrator.testVerifier.runTests();
  assert(verifyJs.success === true, 'JavaScript test suite now passes with 0 errors');

  console.log(`\n========================================`);
  console.log(`ALL TESTS PASSED! (${passed} checks passed, ${failed} failed)`);
  console.log(`========================================\n`);
}

runTests().catch(err => {
  console.error('\n❌ Uncaught test exception:', err);
  process.exit(1);
});
