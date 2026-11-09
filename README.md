# DevDebugger AI — Autonomous Code Debugging Agent

DevDebugger AI is a production-grade autonomous and assisted software debugging agent. It scans multi-language codebases, detects runtime and static bugs, performs intelligent Root Cause Analysis (RCA), generates verified surgical patches, and confirms resolutions using automated test execution and regression checks.

---

## Key Capabilities

1. **Codebase Understanding**:
   - Multi-language AST analysis (JavaScript, TypeScript, Python, SQL).
   - Extracts architecture, modules, classes, functions, and imports.
   - Detects frameworks (React, Express, Next.js, Django, FastAPI).

2. **Error & Bug Detection**:
   - Real-time stack trace parsing (Node.js ESM URLs, Python Tracebacks, Jest, Unittest, Pytest).
   - AST-based static bug detection (syntax errors, unresolved variables, bad conditional assignments).

3. **Intelligent Root Cause Analysis (RCA)**:
   - Differentiates symptom from actual root cause.
   - Traces call stack frames to exact source file and line.
   - Computes confidence score and detailed architectural explanation.

4. **Autonomous & Assisted Operation**:
   - **Assisted Mode**: Investigates root cause, produces a unified diff, and halts at an authorization gate awaiting user approval before applying changes.
   - **Autonomous Mode**: Investigates, applies the fix, executes test suites, and verifies resolution automatically.

5. **Security & Guardrails**:
   - **Directory Boundary Jail**: All modifications strictly constrained to the project root.
   - **Command Allowlist**: Permitted execution of safe binaries (`npm`, `node`, `python3`, `pytest`, `git`) with forbidden shell metacharacter blocking.
   - **Zero Data Loss Checkpoints**: Creates automatic snapshots prior to any code modification, enabling one-click rollback.
   - **Secret Masking**: Automatically redacts API keys, bearer tokens, and secrets from all logs.

6. **Modern Developer Dashboard**:
   - Project Explorer with syntax viewer and culprit line highlighting.
   - Interactive Debugging Console with live unified diffs and approval controls.
   - Fix History with verification status and instant rollback.
   - Real-time streaming Agent Activity Feed & integrated sandbox terminal.

---

## Directory Structure

```
devdebugger-ai/
├── client/                     # Modern React + Vite Dashboard
│   ├── src/
│   │   ├── components/         # Dashboard, Explorer, Console, History, Activity
│   │   ├── App.jsx             # Top bar, WebSocket sync, tab manager
│   │   └── main.jsx
│   ├── index.html
│   └── vite.config.js
├── server/                     # Node.js ESM Backend Engine
│   ├── index.js                # Express REST API + WebSocket Server
│   ├── config.js               # Policies, timeouts, allowed commands
│   └── core/
│       ├── orchestrator.js      # Finite State Agent Workflow
│       ├── codebaseAnalyzer.js  # AST & Language Scanner
│       ├── errorDetector.js     # Stack Trace & Static Bug Detector
│       ├── rootCauseAnalyzer.js # Root Cause Analysis (RCA) Engine
│       ├── fixGenerator.js      # Unified Diff & Patch Synthesizer
│       ├── executionEngine.js   # Controlled Sandbox Runner
│       ├── testVerifier.js      # Pre/Post-fix Test Suite Verifier
│       ├── gitCheckpoint.js     # Checkpoint Snapshot & Revert Manager
│       ├── auditLogger.js       # Structured Session Audit Logs
│       └── providers/
│           ├── llmProvider.js   # Multi-Provider Adapter (Gemini, OpenAI, Heuristic)
│           └── heuristicFixer.js# Offline Deterministic AST Fixer
├── sample-projects/
│   ├── buggy-python/           # Test fixture with ZeroDivisionError & unittests
│   └── buggy-javascript/       # Test fixture with TypeError & assertions
└── tests/
    └── runner.js               # 34-point Automated Verification Suite
```

---

## Running the Application

### 1. Run Automated Test Suite
To execute the comprehensive 34-point verification suite:
```bash
npm test
```

### 2. Start DevDebugger Server & Dashboard
```bash
npm start
```
The server will start at:
- Web Dashboard: `http://localhost:4100`
- WebSocket Server: `ws://localhost:4100`

### 3. API Endpoints
- `GET /api/status`: Current agent state and active investigation.
- `GET /api/project/scan`: Scans files, AST symbols, and languages.
- `POST /api/project/connect`: Connects a target project directory.
- `POST /api/agent/run`: Triggers the debugging workflow.
- `POST /api/agent/mode`: Switches between `assisted` and `autonomous` mode.
- `POST /api/fix/approve`: Approves and applies the pending patch.
- `POST /api/fix/reject`: Rejects the pending patch.
- `POST /api/fix/revert`: Rolls back to a checkpoint snapshot.
- `GET /api/history`: Lists previous fixes and verification results.
- `POST /api/terminal/exec`: Controlled terminal command runner.
