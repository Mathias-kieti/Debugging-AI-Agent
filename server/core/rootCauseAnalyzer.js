import fs from 'fs';
import path from 'path';

export class RootCauseAnalyzer {
  constructor(projectRoot) {
    this.projectRoot = path.resolve(projectRoot);
  }

  /**
   * Conduct root cause analysis on a detected error.
   */
  async analyze(error, codebaseContext = {}) {
    const targetFile = error.file;
    const targetLine = error.line || 1;
    let fileContent = '';
    let surroundingCode = '';
    let culpritLineContent = '';

    if (targetFile) {
      const fullPath = path.resolve(this.projectRoot, targetFile);
      if (fs.existsSync(fullPath)) {
        try {
          fileContent = fs.readFileSync(fullPath, 'utf8');
          const lines = fileContent.split('\n');
          culpritLineContent = lines[targetLine - 1] || '';

          const start = Math.max(0, targetLine - 5);
          const end = Math.min(lines.length, targetLine + 5);
          surroundingCode = lines
            .slice(start, end)
            .map((l, idx) => `${start + idx + 1}: ${l}`)
            .join('\n');
        } catch (e) {
          // ignore read error
        }
      }
    }

    const diagnosis = this.deduceRootCause(error, culpritLineContent, fileContent);

    return {
      errorType: error.type || 'RUNTIME_ERROR',
      errorClass: error.errorClass || 'Error',
      rawMessage: error.message,
      culpritFile: targetFile,
      culpritLine: targetLine,
      culpritCode: culpritLineContent.trim(),
      surroundingContext: surroundingCode,
      symptom: diagnosis.symptom,
      rootCause: diagnosis.rootCause,
      category: diagnosis.category,
      explanation: diagnosis.explanation,
      fixStrategy: diagnosis.fixStrategy,
      confidence: diagnosis.confidence
    };
  }

  deduceRootCause(error, lineContent, fileContent) {
    const msg = (error.message || '').toLowerCase();
    const line = lineContent || '';

    // 1. ZeroDivisionError
    if (msg.includes('zerodivisionerror') || msg.includes('division by zero')) {
      return {
        category: 'ARITHMETIC_ERROR',
        symptom: 'Program crashed due to dividing by zero.',
        rootCause: 'A denominator variable or expression evaluates to 0 without a safety guard or contains an incorrect initial value/counter.',
        explanation: `At line containing "${line.trim()}", the divisor reached 0 during execution. The calculation lacked a conditional guard (e.g., checking if divisor == 0) or used a flawed count.`,
        fixStrategy: 'Add a check to prevent division by zero or handle empty collections gracefully before dividing.',
        confidence: 0.95
      };
    }

    // 2. Off-by-one / IndexError / Array bounds
    if (msg.includes('indexerror') || msg.includes('list index out of range') || msg.includes('out of bounds')) {
      return {
        category: 'BOUNDARY_ERROR',
        symptom: 'IndexError: Accessing index beyond collection boundaries.',
        rootCause: 'Loop iteration index exceeded the array length (classic off-by-one error, e.g. <= instead of <, or len(arr) instead of len(arr) - 1).',
        explanation: `The code attempted to read from an index that exceeds array length. Common in loops with <= array.length or 1-based indexing assumptions.`,
        fixStrategy: 'Correct the loop termination condition or bounds check before indexing.',
        confidence: 0.95
      };
    }

    // 3. TypeError / Cannot read properties of undefined or null
    if (msg.includes('cannot read property') || msg.includes('cannot read properties of undefined') || msg.includes('cannot read properties of null') || msg.includes("'nonetype' object has no attribute")) {
      return {
        category: 'NULL_POINTER_DEREFERENCE',
        symptom: 'Attempted to access a property or method on null/undefined/None.',
        rootCause: 'Upstream function returned null/None, or an object was accessed before initialization without optional chaining or null checking.',
        explanation: `The variable accessed at this line was null/undefined at runtime, indicating an unhandled missing value from an API, database, or parameter.`,
        fixStrategy: 'Implement optional chaining (?.), null-coalescing (?? / if var is not None), or validate input parameters before property access.',
        confidence: 0.92
      };
    }

    // 4. ReferenceError / NameError (Undefined Variable / Missing Import)
    if (msg.includes('referenceerror') || msg.includes('nameerror') || msg.includes('is not defined')) {
      const varMatch = error.message.match(/name '(\w+)' is not defined/) || error.message.match(/(\w+) is not defined/);
      const varName = varMatch ? varMatch[1] : 'identifier';

      return {
        category: 'UNDEFINED_REFERENCE',
        symptom: `Execution halted because '${varName}' is not defined.`,
        rootCause: `The variable or module '${varName}' was referenced without being imported, declared, or was misspelled.`,
        explanation: `The symbol '${varName}' does not exist in the current scope. It was either forgotten in import declarations or misspelled compared to its definition.`,
        fixStrategy: `Add missing import or declare and initialize '${varName}' prior to use.`,
        confidence: 0.98
      };
    }

    // 5. Test Assertion Failure (Logic / Formula bug)
    if (error.type === 'TEST_FAILURE' || msg.includes('assertionerror')) {
      return {
        category: 'LOGICAL_ERROR',
        symptom: `Unit test assertion failed: ${error.message}`,
        rootCause: 'The implementation output does not match expected test contract. Common causes include inverted operators (+ instead of -, * instead of /), incorrect edge condition handling, or incorrect return format.',
        explanation: `The function executed without crashing, but computed an incorrect value that violated test assertions. The logic in the calculation or condition diverges from business requirements.`,
        fixStrategy: 'Examine the expected value vs computed value in the assertion and adjust the mathematical operation or condition.',
        confidence: 0.90
      };
    }

    // 6. Syntax Error
    if (error.type === 'SYNTAX_ERROR' || msg.includes('syntaxerror')) {
      return {
        category: 'SYNTAX_ERROR',
        symptom: `Code failed to parse: ${error.message}`,
        rootCause: 'Mismatched brackets, missing colon, trailing invalid characters, or syntax disallowed by the language version.',
        explanation: `The parser could not construct an AST due to malformed syntax around line ${error.line}.`,
        fixStrategy: 'Correct punctuation, brackets, colons, or syntax structure.',
        confidence: 0.99
      };
    }

    // General fallback
    return {
      category: 'RUNTIME_EXCEPTION',
      symptom: error.message || 'Unhandled runtime exception occurred.',
      rootCause: 'Unexpected runtime state or unhandled exception during execution.',
      explanation: `Execution encountered an unhandled error: ${error.message}. Code surrounding line ${error.line || 1} should be inspected and fortified.`,
      fixStrategy: 'Inspect the call stack frames, validate inputs, and wrap risky operations in appropriate error handling.',
      confidence: 0.80
    };
  }
}
