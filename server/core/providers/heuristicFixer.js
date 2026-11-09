import fs from 'fs';
import path from 'path';

export class HeuristicFixer {
  /**
   * Generates targeted fix based on root cause analysis and AST inspection.
   */
  static generateFix(rca, projectRoot) {
    if (!rca.culpritFile) {
      return null;
    }

    const fullPath = path.resolve(projectRoot, rca.culpritFile);
    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const originalContent = fs.readFileSync(fullPath, 'utf8');
    const lines = originalContent.split('\n');
    const lineIndex = Math.max(0, (rca.culpritLine || 1) - 1);
    const targetLine = lines[lineIndex] || '';

    let fixedContent = null;
    let description = '';

    // Case 1: Division by zero / ZeroDivisionError
    if (rca.category === 'ARITHMETIC_ERROR' || rca.rawMessage.toLowerCase().includes('zerodivision')) {
      if (rca.culpritFile.endsWith('.py')) {
        // e.g., return total / count -> return total / count if count != 0 else 0
        const divMatch = targetLine.match(/([a-zA-Z0-9_\(\)]+)\s*\/\s*([a-zA-Z0-9_]+)/);
        if (divMatch) {
          const [matchStr, num, denom] = divMatch;
          const indentation = targetLine.match(/^\s*/)[0];
          
          if (targetLine.trim().startsWith('return ')) {
            const fixedLine = `${indentation}return ${num} / ${denom} if ${denom} != 0 else 0`;
            lines[lineIndex] = fixedLine;
            fixedContent = lines.join('\n');
            description = `Added guard 'if ${denom} != 0 else 0' to prevent ZeroDivisionError.`;
          } else {
            const fixedLine = targetLine.replace(matchStr, `(${num} / ${denom} if ${denom} != 0 else 0)`);
            lines[lineIndex] = fixedLine;
            fixedContent = lines.join('\n');
            description = `Guarded division against zero denominator '${denom}'.`;
          }
        }
      } else if (rca.culpritFile.endsWith('.js') || rca.culpritFile.endsWith('.ts')) {
        const divMatch = targetLine.match(/([a-zA-Z0-9_\(\)]+)\s*\/\s*([a-zA-Z0-9_]+)/);
        if (divMatch) {
          const [matchStr, num, denom] = divMatch;
          const fixedLine = targetLine.replace(matchStr, `(${denom} !== 0 ? ${num} / ${denom} : 0)`);
          lines[lineIndex] = fixedLine;
          fixedContent = lines.join('\n');
          description = `Guarded division '${denom} !== 0 ? ${num} / ${denom} : 0' to prevent invalid division.`;
        }
      }
    }

    // Case 2: Undefined variable / missing import (NameError / ReferenceError)
    if (!fixedContent && (rca.category === 'UNDEFINED_REFERENCE' || rca.rawMessage.toLowerCase().includes('not defined'))) {
      const match = rca.rawMessage.match(/name '(\w+)' is not defined/) || rca.rawMessage.match(/(\w+) is not defined/);
      const varName = match ? match[1] : null;

      if (varName) {
        if (rca.culpritFile.endsWith('.py')) {
          // Check if varName is a common python module (e.g. math, os, sys, json, re, time)
          const stdModules = ['math', 'os', 'sys', 'json', 're', 'time', 'random', 'datetime'];
          if (stdModules.includes(varName)) {
            fixedContent = `import ${varName}\n` + originalContent;
            description = `Added missing standard library import 'import ${varName}' at top of file.`;
          } else {
            // Check if typo in target line
            // or initialize default variable
            const indentation = targetLine.match(/^\s*/)[0];
            lines.splice(lineIndex, 0, `${indentation}${varName} = 0`);
            fixedContent = lines.join('\n');
            description = `Declared and initialized variable '${varName}'.`;
          }
        } else if (rca.culpritFile.endsWith('.js') || rca.culpritFile.endsWith('.ts')) {
          const indentation = targetLine.match(/^\s*/)[0];
          lines.splice(lineIndex, 0, `${indentation}let ${varName} = null;`);
          fixedContent = lines.join('\n');
          description = `Declared and initialized variable 'let ${varName} = null;'.`;
        }
      }
    }

    // Case 3: Off-by-one / IndexError / Boundary
    if (!fixedContent && (rca.category === 'BOUNDARY_ERROR' || rca.rawMessage.toLowerCase().includes('indexerror'))) {
      if (targetLine.includes('<= len(')) {
        lines[lineIndex] = targetLine.replace('<= len(', '< len(');
        fixedContent = lines.join('\n');
        description = 'Corrected off-by-one boundary check from "<= len(...)" to "< len(...)".';
      } else if (targetLine.includes('range(len(') && targetLine.includes(' + 1')) {
        lines[lineIndex] = targetLine.replace(/\+ 1\)/, ')');
        fixedContent = lines.join('\n');
        description = 'Removed out-of-bounds +1 offset from range iteration.';
      } else if (targetLine.includes('<=') && (rca.culpritFile.endsWith('.js') || rca.culpritFile.endsWith('.ts'))) {
        lines[lineIndex] = targetLine.replace('<=', '<');
        fixedContent = lines.join('\n');
        description = 'Corrected loop index boundary from "<=" to "<".';
      }
    }

    // Case 4: Null / undefined dereference (Cannot read property / NoneType)
    if (!fixedContent && (rca.category === 'NULL_POINTER_DEREFERENCE' || rca.rawMessage.toLowerCase().includes('cannot read property') || rca.rawMessage.toLowerCase().includes('cannot read properties') || rca.rawMessage.toLowerCase().includes('nonetype'))) {
      if (rca.culpritFile.endsWith('.js') || rca.culpritFile.endsWith('.ts')) {
        // Convert unsafe property chain to optional chaining and safe fallback
        const fixedLine = targetLine.replace(/([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/g, '$1?.$2');
        if (fixedLine !== targetLine) {
          lines[lineIndex] = fixedLine;
          fixedContent = lines.join('\n');
          description = `Added optional chaining (?.) across property accesses to safely handle null/undefined objects.`;
        }
      } else if (rca.culpritFile.endsWith('.py')) {
        const indentation = targetLine.match(/^\s*/)[0];
        const objMatch = targetLine.match(/([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/);
        if (objMatch) {
          const [fullMatch, obj, prop] = objMatch;
          const fixedLine = `${indentation}if ${obj} is not None:\n    ${targetLine.trim()}\n${indentation}else:\n    return None`;
          lines[lineIndex] = fixedLine;
          fixedContent = lines.join('\n');
          description = `Added None check 'if ${obj} is not None' to protect attribute access.`;
        }
      }
    }

    // Case 5: Formula / Arithmetic logic bug in test failure (e.g. inverted operator or off calculation)
    if (!fixedContent && rca.category === 'LOGICAL_ERROR') {
      // Check if target line has inverted operators like - instead of + or * instead of /
      if (targetLine.includes(' - ') && rca.rawMessage.toLowerCase().includes('assert')) {
        lines[lineIndex] = targetLine.replace(' - ', ' + ');
        fixedContent = lines.join('\n');
        description = 'Corrected arithmetic operator from subtraction (-) to addition (+).';
      } else if (targetLine.includes(' + ') && rca.rawMessage.toLowerCase().includes('assert')) {
        lines[lineIndex] = targetLine.replace(' + ', ' - ');
        fixedContent = lines.join('\n');
        description = 'Corrected arithmetic operator from addition (+) to subtraction (-).';
      } else if (targetLine.includes(' * ') && rca.rawMessage.toLowerCase().includes('assert')) {
        lines[lineIndex] = targetLine.replace(' * ', ' / ');
        fixedContent = lines.join('\n');
        description = 'Corrected calculation operator from multiplication (*) to division (/).';
      }
    }

    // Case 6: Python SyntaxError (missing colon or mismatched parenthesis)
    if (!fixedContent && (rca.category === 'SYNTAX_ERROR' || rca.rawMessage.toLowerCase().includes('syntaxerror'))) {
      if (targetLine.match(/(?:def |class |if |elif |else|for |while |try|except|finally)[^:]+$/)) {
        lines[lineIndex] = `${targetLine.trimEnd()}:`;
        fixedContent = lines.join('\n');
        description = 'Appended missing trailing colon (:) required by Python syntax.';
      }
    }

    if (fixedContent && fixedContent !== originalContent) {
      return {
        file: rca.culpritFile,
        originalContent,
        fixedContent,
        description,
        appliedVia: 'Heuristic AST Fixer',
        line: rca.culpritLine
      };
    }

    return null;
  }
}
