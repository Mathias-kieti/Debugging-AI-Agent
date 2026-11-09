import express from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.js';
import { AgentOrchestrator } from './core/orchestrator.js';
import { SecurityGuard } from './core/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Active project state
let currentProjectRoot = path.resolve(process.cwd(), 'sample-projects/buggy-python');
let orchestrator = new AgentOrchestrator(currentProjectRoot, { mode: 'assisted' });

// Setup orchestrator broadcast to WebSockets
orchestrator.subscribe((eventData) => {
  const jsonStr = JSON.stringify(eventData);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonStr);
    }
  });
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    event: 'INIT_STATE',
    payload: orchestrator.getStatus()
  }));
});

// REST Endpoints
app.get('/api/status', (req, res) => {
  res.json(orchestrator.getStatus());
});

app.post('/api/project/connect', async (req, res) => {
  const { projectPath, mode } = req.body;
  if (!projectPath) {
    return res.status(400).json({ error: 'projectPath is required' });
  }

  const resolved = path.resolve(projectPath);
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: `Directory does not exist: ${resolved}` });
  }

  currentProjectRoot = resolved;
  orchestrator = new AgentOrchestrator(currentProjectRoot, { mode: mode || 'assisted' });

  // Re-subscribe WS
  orchestrator.subscribe((eventData) => {
    const jsonStr = JSON.stringify(eventData);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(jsonStr);
      }
    });
  });

  try {
    const scanResult = await orchestrator.codebaseAnalyzer.scanProject();
    res.json({
      success: true,
      connectedPath: currentProjectRoot,
      scan: scanResult
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/project/scan', async (req, res) => {
  try {
    const scan = await orchestrator.codebaseAnalyzer.scanProject();
    res.json(scan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/project/file', async (req, res) => {
  const relPath = req.query.path;
  if (!relPath) return res.status(400).json({ error: 'Path query param required' });

  try {
    const fileInfo = await orchestrator.codebaseAnalyzer.analyzeFile(relPath);
    res.json(fileInfo);
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/agent/run', async (req, res) => {
  const { mode } = req.body || {};
  if (mode) orchestrator.setMode(mode);

  // Run in background and return immediate status
  orchestrator.runDebuggingCycle()
    .then(result => {
      // Completed or waiting approval
    })
    .catch(err => {
      console.error('Agent run error:', err);
    });

  res.json({
    message: 'Debugging cycle initiated',
    status: orchestrator.getStatus()
  });
});

app.post('/api/agent/mode', (req, res) => {
  const { mode } = req.body;
  if (!['assisted', 'autonomous'].includes(mode)) {
    return res.status(400).json({ error: 'Mode must be assisted or autonomous' });
  }
  orchestrator.setMode(mode);
  res.json({ mode: orchestrator.mode });
});

app.post('/api/fix/approve', async (req, res) => {
  try {
    const result = await orchestrator.applyAndVerifyFix();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fix/reject', (req, res) => {
  orchestrator.pendingFixProposal = null;
  orchestrator.setState('IDLE', { message: 'Pending fix rejected by user.' });
  res.json({ success: true, message: 'Fix rejected' });
});

app.post('/api/fix/revert', async (req, res) => {
  const { checkpointId } = req.body;
  if (!checkpointId) return res.status(400).json({ error: 'checkpointId is required' });

  try {
    const result = await orchestrator.revertFix(checkpointId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/history', (req, res) => {
  res.json({
    history: orchestrator.history,
    checkpoints: orchestrator.gitCheckpointManager.listCheckpoints()
  });
});

app.get('/api/audit', (req, res) => {
  res.json({
    events: orchestrator.auditLogger.getSessionEvents(),
    sessions: orchestrator.auditLogger.getRecentSessions()
  });
});

app.post('/api/terminal/exec', async (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'command is required' });

  try {
    const result = await orchestrator.executionEngine.execute(command, {
      onStdout: (chunk) => {
        const msg = JSON.stringify({ event: 'TERMINAL_OUTPUT', payload: { type: 'stdout', text: chunk } });
        wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(msg));
      },
      onStderr: (chunk) => {
        const msg = JSON.stringify({ event: 'TERMINAL_OUTPUT', payload: { type: 'stderr', text: chunk } });
        wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(msg));
      }
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Serve static frontend assets if built
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(clientDist, 'index.html'));
    }
    next();
  });
}

server.listen(CONFIG.PORT, () => {
  console.log(`[DevDebugger AI] Backend server running on http://localhost:${CONFIG.PORT}`);
  console.log(`[DevDebugger AI] WebSocket server connected on ws://localhost:${CONFIG.PORT}`);
});

export { app, server, orchestrator };
