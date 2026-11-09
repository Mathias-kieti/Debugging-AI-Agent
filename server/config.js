import path from 'path';

export const CONFIG = {
  PORT: process.env.PORT || 4100,
  WS_PORT: process.env.WS_PORT || 4101,
  DEFAULT_TIMEOUT_MS: 30000,
  MAX_FIX_RETRIES: 2,
  ALLOWED_COMMANDS: [
    'npm',
    'npx',
    'node',
    'python3',
    'python',
    'pytest',
    'git'
  ],
  BLOCKED_ARGS: [
    ';',
    '&&',
    '||',
    '|',
    '>',
    '>>',
    '<',
    '`',
    '$(',
    'rm -rf /',
    'mkfs',
    'sudo',
    'chmod 777'
  ],
  IGNORED_DIRS: [
    'node_modules',
    '.git',
    '__pycache__',
    '.pytest_cache',
    '.venv',
    'venv',
    'dist',
    'build',
    '.next',
    '.cache'
  ],
  SECRET_PATTERNS: [
    /(?:api[_-]?key|secret|token|password|auth|bearer)[\s=:"]+([a-zA-Z0-9_\-\.]{8,})/gi,
    /AIza[0-9A-Za-z-_]{35}/g,
    /sk-[a-zA-Z0-9]{20,}/g
  ]
};
