import fs from 'fs';
import path from 'path';
import { SecurityGuard } from './security.js';

export class AuditLogger {
  constructor(storageDir = path.resolve(process.cwd(), '.devdebugger_logs')) {
    this.storageDir = storageDir;
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
    this.currentSessionId = `session_${Date.now()}`;
    this.sessionLogFile = path.join(this.storageDir, `${this.currentSessionId}.jsonl`);
    this.events = [];
  }

  log(eventType, details = {}, level = 'INFO') {
    const entry = {
      sessionId: this.currentSessionId,
      timestamp: new Date().toISOString(),
      level,
      type: eventType,
      details: typeof details === 'string' ? SecurityGuard.sanitizeOutput(details) : JSON.parse(SecurityGuard.sanitizeOutput(JSON.stringify(details)))
    };

    this.events.push(entry);

    try {
      fs.appendFileSync(this.sessionLogFile, JSON.stringify(entry) + '\n', 'utf8');
    } catch (err) {
      console.error('Failed to write audit log:', err.message);
    }

    return entry;
  }

  getSessionEvents() {
    return [...this.events];
  }

  getRecentSessions(limit = 10) {
    try {
      const files = fs.readdirSync(this.storageDir)
        .filter(f => f.endsWith('.jsonl'))
        .sort()
        .reverse()
        .slice(0, limit);
      
      return files.map(filename => {
        const filePath = path.join(this.storageDir, filename);
        const stats = fs.statSync(filePath);
        return {
          sessionId: filename.replace('.jsonl', ''),
          createdAt: stats.birthtime,
          sizeBytes: stats.size
        };
      });
    } catch (err) {
      return [];
    }
  }
}
