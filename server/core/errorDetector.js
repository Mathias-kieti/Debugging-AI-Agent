import path from 'path';
import fs from 'fs';
import { spawnSync } from 'child_process';
import { parse as parseBabel } from '@babel/parser';

export class ErrorDetector {
  constructor(projectRoot) {
    this.projectRoot = path.resolve(projectRoot);
  }

  /**
   * Parse runtime output (e.g. from tests or server logs) to extract errors and stack traces.
   */
  parseRuntimeErrors(stdout, stderr) {
    const combined = `${stdout || ''}\n${stderr || ''}`;
    const errors = [];

    // 1. Python Stack Trace Detection
    if (combined.includes('Traceback (most recent call last):') || combined.includes('AssertionError') || combined.includes('ZeroDivisionError') || combined.includes('TypeError')) {
      const pyError = this.parsePythonStackTrace(combined);
      if (pyError) errors.push(pyError);
    }

    // 2. JavaScript / Node.js Stack Trace Detection
    if (combined.includes('Error:') || combined.includes('TypeError:') || combined.includes('ReferenceError:') || combined.includes('SyntaxError:')) {
      const jsError = this.parseJavaScriptStackTrace(combined);
      if (jsError) errors.push(jsError);
    }

    // 3. Test Failure patterns (pytest / unittest / jest)
    if (combined.includes('FAILED') || combined.includes('FAIL ') || combined.includes('AssertionError:')) {
      const testErr = this.parseTestFailure(combined);
      if (testErr && !errors.some(e => e.message === testErr.message)) {
        errors.push(testErr);
      }
    }

    return errors;
  }

  parsePythonStackTrace(output) {
    const lines = output.split('\n');
    let inTraceback = false;
    let frames = [];
    let errorMessage = '';
    let errorType = 'RuntimeError';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes('Traceback (most recent call last):')) {
        inTraceback = true;
        frames = [];
        continue;
      }

      if (inTraceback) {
        // e.g.: File "/path/to/file.py", line 42, in my_func
        const fileMatch = line.match(/File "([^"]+)", line (\d+)(?:, in (.+))?/);
        if (fileMatch) {
          const filePath = fileMatch[1];
          const lineNum = parseInt(fileMatch[2], 10);
          const funcName = fileMatch[3] ? fileMatch[3].trim() : '<module>';
          const codeSnippet = lines[i + 1] ? lines[i + 1].trim() : '';

          frames.push({
            filePath: this.relativizePath(filePath),
            line: lineNum,
            functionName: funcName,
            snippet: codeSnippet
          });
        }

        // Error message line e.g. "ZeroDivisionError: division by zero" or "AssertionError: 5 != 10"
        const errTypeMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*Error|[A-Za-z_][A-Za-z0-9_]*Exception):\s*(.*)/);
        if (errTypeMatch) {
          errorType = errTypeMatch[1];
          errorMessage = `${errTypeMatch[1]}: ${errTypeMatch[2]}`;
          inTraceback = false;
        }
      }
    }

    if (!errorMessage && output.includes('AssertionError:')) {
      const match = output.match(/AssertionError:\s*(.*)/);
      if (match) {
        errorType = 'AssertionError';
        errorMessage = `AssertionError: ${match[1]}`;
      }
    }

    if (frames.length > 0 || errorMessage) {
      // Find the frame belonging to user project (not standard library)
      const projectFrame = [...frames].reverse().find(f => !f.filePath.includes('/usr/') && !f.filePath.includes('site-packages')) || frames[frames.length - 1];

      return {
        type: 'RUNTIME_ERROR',
        errorClass: errorType,
        message: errorMessage || 'Python Execution Error',
        file: projectFrame ? projectFrame.filePath : null,
        line: projectFrame ? projectFrame.line : null,
        function: projectFrame ? projectFrame.functionName : null,
        snippet: projectFrame ? projectFrame.snippet : null,
        stackFrames: frames,
        rawOutput: output.substring(0, 2000)
      };
    }

    return null;
  }

  parseJavaScriptStackTrace(output) {
    const lines = output.split('\n');
    let errorMessage = '';
    let errorClass = 'Error';
    const frames = [];

    for (const line of lines) {
      const errMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*Error):\s*(.*)/);
      if (errMatch && !errorMessage) {
        errorClass = errMatch[1];
        errorMessage = `${errMatch[1]}: ${errMatch[2]}`;
        continue;
      }

      // Matches both standard Node paths and ESM file:// URLs:
      // at formatUserProfile (file:///path/to/file.js:6:23) or at /path/to/file.js:6:23
      const frameMatch = line.match(/at\s+(?:(.+?)\s+\()?(?:file:\/\/)?(.+?):(\d+):(\d+)\)?/);
      if (frameMatch) {
        const funcName = frameMatch[1] || '<anonymous>';
        const rawPath = frameMatch[2];
        const lineNum = parseInt(frameMatch[3], 10);
        const colNum = parseInt(frameMatch[4], 10);

        frames.push({
          filePath: this.relativizePath(rawPath),
          line: lineNum,
          column: colNum,
          functionName: funcName
        });
      }
    }

    if (frames.length > 0 || errorMessage) {
      const projectFrame = frames.find(f => !f.filePath.includes('node_modules') && !f.filePath.startsWith('node:')) || frames[0];

      return {
        type: 'RUNTIME_ERROR',
        errorClass: errorClass,
        message: errorMessage || 'JavaScript Runtime Error',
        file: projectFrame ? projectFrame.filePath : null,
        line: projectFrame ? projectFrame.line : null,
        column: projectFrame ? projectFrame.column : null,
        function: projectFrame ? projectFrame.functionName : null,
        stackFrames: frames,
        rawOutput: output.substring(0, 2000)
      };
    }

    return null;
  }

  parseTestFailure(output) {
    // Detect general test assertion failure message
    const match = output.match(/(?:FAIL|FAILED|AssertionError)[^\n]*/i);
    return {
      type: 'TEST_FAILURE',
      errorClass: 'AssertionError',
      message: match ? match[0].trim() : 'Test suite assertion failure',
      rawOutput: output.substring(0, 2000)
    };
  }

  /**
   * Static analysis of codebase files to detect syntax errors, unresolved symbols, or suspicious patterns.
   */
  async scanForStaticBugs(files = []) {
    const detected = [];

    for (const f of files) {
      const fullPath = path.resolve(this.projectRoot, f.path);
      if (!fs.existsSync(fullPath)) continue;

      const content = fs.readFileSync(fullPath, 'utf8');

      if (['JavaScript', 'TypeScript', 'JavaScript (React JSX)'].includes(f.language)) {
        const jsBugs = this.checkJavaScriptStatic(content, f.path);
        detected.push(...jsBugs);
      } else if (f.language === 'Python') {
        const pyBugs = this.checkPythonStatic(content, f.path);
        detected.push(...pyBugs);
      }
    }

    return detected;
  }

  checkJavaScriptStatic(content, relPath) {
    const issues = [];

    try {
      parseBabel(content, {
        sourceType: 'unambiguous',
        plugins: ['jsx', 'typescript', 'classProperties']
      });
    } catch (err) {
      issues.push({
        type: 'SYNTAX_ERROR',
        severity: 'CRITICAL',
        file: relPath,
        line: err.loc?.line || 1,
        column: err.loc?.column || 0,
        message: `Syntax error: ${err.message.replace(/\s*\(\d+:\d+\)$/, '')}`,
        codeSnippet: content.split('\n')[err.loc?.line - 1] || ''
      });
    }

    // Check for obvious dangerous / buggy patterns
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      // e.g. undefined reference pattern or assignment in condition
      if (line.match(/if\s*\([^=]*=[^=][^=]*\)/)) {
        issues.push({
          type: 'LOGICAL_ERROR',
          severity: 'WARNING',
          file: relPath,
          line: idx + 1,
          message: 'Possible unintentional assignment in if-condition statement',
          codeSnippet: line.trim()
        });
      }
    });

    return issues;
  }

  checkPythonStatic(content, relPath) {
    const issues = [];
    const fullPath = path.resolve(this.projectRoot, relPath);

    const script = `
import ast, sys, json

try:
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        code = f.read()
    ast.parse(code)
    compile(code, sys.argv[1], 'exec')
    print(json.dumps([]))
except SyntaxError as e:
    print(json.dumps([{
        "type": "SYNTAX_ERROR",
        "severity": "CRITICAL",
        "file": sys.argv[2],
        "line": e.lineno or 1,
        "column": e.offset or 0,
        "message": f"Python SyntaxError: {e.msg}",
        "codeSnippet": (e.text or '').strip()
    }]))
except Exception as e:
    print(json.dumps([{
        "type": "STATIC_ANALYSIS_ERROR",
        "severity": "CRITICAL",
        "file": sys.argv[2],
        "line": getattr(e, 'lineno', 1),
        "column": 0,
        "message": str(e),
        "codeSnippet": ""
    }]))
`;

    try {
      const res = spawnSync('python3', ['-c', script, fullPath, relPath], { encoding: 'utf8', timeout: 5000 });
      if (res.stdout) {
        const parsed = JSON.parse(res.stdout);
        issues.push(...parsed);
      }
    } catch (e) {}

    return issues;
  }

  relativizePath(absoluteOrRel) {
    if (!absoluteOrRel) return '';

    // If already absolute and starts with projectRoot
    if (path.isAbsolute(absoluteOrRel) && absoluteOrRel.startsWith(this.projectRoot)) {
      return path.relative(this.projectRoot, absoluteOrRel);
    }

    // Check if relative to cwd and exists inside projectRoot
    const cwdPath = path.resolve(process.cwd(), absoluteOrRel);
    if (fs.existsSync(cwdPath) && cwdPath.startsWith(this.projectRoot)) {
      return path.relative(this.projectRoot, cwdPath);
    }

    // Check if directly relative to projectRoot
    const directPath = path.resolve(this.projectRoot, absoluteOrRel);
    if (fs.existsSync(directPath)) {
      return path.relative(this.projectRoot, directPath);
    }

    // Check by filename in projectRoot
    const baseName = path.basename(absoluteOrRel);
    if (fs.existsSync(path.join(this.projectRoot, baseName))) {
      return baseName;
    }

    return absoluteOrRel;
  }
}
