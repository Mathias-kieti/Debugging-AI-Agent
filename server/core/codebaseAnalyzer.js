import fs from 'fs';
import path from 'path';
import { parse as parseBabel } from '@babel/parser';
import { spawnSync } from 'child_process';
import { CONFIG } from '../config.js';
import { SecurityGuard } from './security.js';

export class CodebaseAnalyzer {
  constructor(projectRoot) {
    this.projectRoot = path.resolve(projectRoot);
  }

  /**
   * Scan project directory recursively, skipping ignored folders.
   */
  async scanProject() {
    const fileList = [];
    const languageCounts = {};
    const frameworkSignatures = new Set();

    const walk = (currentDir, relativeDir = '') => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (CONFIG.IGNORED_DIRS.includes(entry.name) || entry.name.startsWith('.')) {
          continue;
        }

        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.join(relativeDir, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath, relPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          const lang = this.detectLanguage(ext, entry.name);
          const stats = fs.statSync(fullPath);

          languageCounts[lang] = (languageCounts[lang] || 0) + 1;

          fileList.push({
            name: entry.name,
            path: relPath,
            sizeBytes: stats.size,
            language: lang,
            extension: ext
          });
        }
      }
    };

    walk(this.projectRoot);

    // Framework and dependency detection
    const dependencies = this.detectDependencies();
    if (dependencies.react) frameworkSignatures.add('React');
    if (dependencies.express) frameworkSignatures.add('Express / Node.js');
    if (dependencies.next) frameworkSignatures.add('Next.js');
    if (dependencies.django) frameworkSignatures.add('Django');
    if (dependencies.flask) frameworkSignatures.add('Flask');
    if (dependencies.fastapi) frameworkSignatures.add('FastAPI');
    if (dependencies.spring) frameworkSignatures.add('Spring Boot');

    // Build project tree
    const tree = this.buildTree(fileList);

    return {
      projectRoot: this.projectRoot,
      totalFiles: fileList.length,
      languages: languageCounts,
      primaryLanguage: this.determinePrimaryLanguage(languageCounts),
      frameworks: Array.from(frameworkSignatures),
      dependencies,
      files: fileList,
      tree
    };
  }

  detectLanguage(ext, filename) {
    switch (ext) {
      case '.js':
      case '.mjs':
      case '.cjs':
        return 'JavaScript';
      case '.ts':
      case '.tsx':
        return 'TypeScript';
      case '.jsx':
        return 'JavaScript (React JSX)';
      case '.py':
        return 'Python';
      case '.sql':
        return 'SQL';
      case '.json':
        return 'JSON';
      case '.html':
        return 'HTML';
      case '.css':
        return 'CSS';
      case '.java':
        return 'Java';
      case '.md':
        return 'Markdown';
      default:
        return 'Other';
    }
  }

  determinePrimaryLanguage(languageCounts) {
    let max = 0;
    let primary = 'Unknown';
    for (const [lang, count] of Object.entries(languageCounts)) {
      if (['JSON', 'Markdown', 'Other'].includes(lang)) continue;
      if (count > max) {
        max = count;
        primary = lang;
      }
    }
    return primary;
  }

  detectDependencies() {
    const deps = {};

    // Check package.json
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const allDeps = {
          ...(pkg.dependencies || {}),
          ...(pkg.devDependencies || {})
        };
        for (const [name, ver] of Object.entries(allDeps)) {
          deps[name] = ver;
        }
      } catch (e) {
        // invalid json
      }
    }

    // Check requirements.txt or pyproject.toml
    const reqPath = path.join(this.projectRoot, 'requirements.txt');
    if (fs.existsSync(reqPath)) {
      try {
        const lines = fs.readFileSync(reqPath, 'utf8').split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [name, ver] = trimmed.split(/==|>=|<=|~=/);
            deps[name.trim()] = ver ? ver.trim() : '*';
          }
        }
      } catch (e) {}
    }

    return deps;
  }

  buildTree(files) {
    const root = { name: path.basename(this.projectRoot), type: 'directory', children: {} };

    for (const f of files) {
      const parts = f.path.split(path.sep);
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;

        if (isFile) {
          current.children[part] = {
            name: part,
            type: 'file',
            path: f.path,
            language: f.language,
            sizeBytes: f.sizeBytes
          };
        } else {
          if (!current.children[part]) {
            current.children[part] = {
              name: part,
              type: 'directory',
              children: {}
            };
          }
          current = current.children[part];
        }
      }
    }

    const formatNode = (node) => {
      if (node.type === 'file') return node;
      return {
        name: node.name,
        type: 'directory',
        children: Object.values(node.children).map(formatNode)
      };
    };

    return formatNode(root);
  }

  /**
   * Deep AST Analysis of a file to extract classes, functions, imports, exports
   */
  async analyzeFile(relativePath) {
    if (!SecurityGuard.isPathSafe(this.projectRoot, relativePath)) {
      throw new Error(`Access denied: path ${relativePath} is outside project root`);
    }

    const fullPath = path.resolve(this.projectRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${relativePath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const ext = path.extname(relativePath).toLowerCase();

    if (['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'].includes(ext)) {
      return this.analyzeJavaScript(content, relativePath);
    } else if (ext === '.py') {
      return this.analyzePython(content, relativePath);
    }

    return {
      filePath: relativePath,
      language: this.detectLanguage(ext, path.basename(relativePath)),
      content,
      functions: [],
      classes: [],
      imports: [],
      lineCount: content.split('\n').length
    };
  }

  analyzeJavaScript(content, relativePath) {
    const functions = [];
    const classes = [];
    const imports = [];
    const parseErrors = [];

    try {
      const ast = parseBabel(content, {
        sourceType: 'unambiguous',
        plugins: ['jsx', 'typescript', 'classProperties', 'dynamicImport', 'asyncGenerators']
      });

      const traverseNodes = (node) => {
        if (!node || typeof node !== 'object') return;

        if (node.type === 'FunctionDeclaration' && node.id) {
          functions.push({
            name: node.id.name,
            line: node.loc?.start?.line,
            params: node.params?.map(p => p.name || 'param') || []
          });
        } else if (node.type === 'ClassDeclaration' && node.id) {
          classes.push({
            name: node.id.name,
            line: node.loc?.start?.line
          });
        } else if (node.type === 'ImportDeclaration') {
          imports.push({
            source: node.source?.value,
            specifiers: node.specifiers?.map(s => s.local?.name) || []
          });
        }

        for (const key of Object.keys(node)) {
          if (Array.isArray(node[key])) {
            node[key].forEach(traverseNodes);
          } else if (node[key] && typeof node[key] === 'object' && key !== 'loc') {
            traverseNodes(node[key]);
          }
        }
      };

      traverseNodes(ast);
    } catch (err) {
      parseErrors.push({
        message: err.message,
        line: err.loc?.line || 1,
        column: err.loc?.column || 0
      });
    }

    return {
      filePath: relativePath,
      language: 'JavaScript',
      content,
      functions,
      classes,
      imports,
      parseErrors,
      lineCount: content.split('\n').length
    };
  }

  analyzePython(content, relativePath) {
    const fullPath = path.resolve(this.projectRoot, relativePath);
    const script = `
import ast, json, sys

try:
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        source = f.read()
    tree = ast.parse(source)
    functions = []
    classes = []
    imports = []

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            functions.append({
                "name": node.name,
                "line": node.lineno,
                "params": [a.arg for a in node.args.args]
            })
        elif isinstance(node, ast.ClassDef):
            classes.append({
                "name": node.name,
                "line": node.lineno
            })
        elif isinstance(node, ast.Import):
            for n in node.names:
                imports.append({"source": n.name})
        elif isinstance(node, ast.ImportFrom):
            imports.append({"source": node.module or ""})

    print(json.dumps({
        "functions": functions,
        "classes": classes,
        "imports": imports,
        "parseErrors": []
    }))
except Exception as e:
    lineno = getattr(e, 'lineno', 1)
    print(json.dumps({
        "functions": [],
        "classes": [],
        "imports": [],
        "parseErrors": [{"message": str(e), "line": lineno, "column": getattr(e, 'offset', 0)}]
    }))
`;

    try {
      const res = spawnSync('python3', ['-c', script, fullPath], { encoding: 'utf8', timeout: 5000 });
      if (res.stdout) {
        const parsed = JSON.parse(res.stdout);
        return {
          filePath: relativePath,
          language: 'Python',
          content,
          ...parsed,
          lineCount: content.split('\n').length
        };
      }
    } catch (err) {
      // fallback
    }

    return {
      filePath: relativePath,
      language: 'Python',
      content,
      functions: [],
      classes: [],
      imports: [],
      parseErrors: [],
      lineCount: content.split('\n').length
    };
  }
}
