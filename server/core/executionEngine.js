import { spawn } from 'child_process';
import path from 'path';
import { SecurityGuard } from './security.js';
import { CONFIG } from '../config.js';

export class ExecutionEngine {
  constructor(projectRoot, auditLogger = null) {
    this.projectRoot = path.resolve(projectRoot);
    this.auditLogger = auditLogger;
    this.activeProcesses = new Map();
  }

  /**
   * Run a command inside projectRoot with strict safety checks, timeouts, and streaming output.
   */
  async execute(commandStr, options = {}) {
    const timeoutMs = options.timeoutMs || CONFIG.DEFAULT_TIMEOUT_MS;
    const onStdout = options.onStdout || (() => {});
    const onStderr = options.onStderr || (() => {});

    // Parse command string into binary and args
    const parts = commandStr.trim().split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    // Validate security
    const validation = SecurityGuard.validateCommand(command, args);
    if (!validation.safe) {
      const err = new Error(`Execution Blocked: ${validation.reason}`);
      if (this.auditLogger) {
        this.auditLogger.log('COMMAND_BLOCKED', { command: commandStr, reason: validation.reason }, 'WARN');
      }
      throw err;
    }

    if (this.auditLogger) {
      this.auditLogger.log('COMMAND_STARTED', { command: commandStr, cwd: this.projectRoot });
    }

    return new Promise((resolve, reject) => {
      let stdoutBuffer = '';
      let stderrBuffer = '';
      let isTimedOut = false;

      const proc = spawn(command, args, {
        cwd: this.projectRoot,
        env: {
          ...process.env,
          CI: 'true',
          NODE_ENV: 'test',
          PYTHONUNBUFFERED: '1'
        },
        shell: false
      });

      const procId = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      this.activeProcesses.set(procId, proc);

      const timer = setTimeout(() => {
        isTimedOut = true;
        try {
          proc.kill('SIGTERM');
          setTimeout(() => {
            if (!proc.killed) proc.kill('SIGKILL');
          }, 2000);
        } catch (e) {
          // ignore kill error
        }
      }, timeoutMs);

      proc.stdout.on('data', (data) => {
        const text = data.toString();
        const sanitized = SecurityGuard.sanitizeOutput(text);
        stdoutBuffer += sanitized;
        onStdout(sanitized);
      });

      proc.stderr.on('data', (data) => {
        const text = data.toString();
        const sanitized = SecurityGuard.sanitizeOutput(text);
        stderrBuffer += sanitized;
        onStderr(sanitized);
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        this.activeProcesses.delete(procId);
        if (this.auditLogger) {
          this.auditLogger.log('COMMAND_ERROR', { command: commandStr, error: err.message }, 'ERROR');
        }
        reject(new Error(`Failed to execute "${commandStr}": ${err.message}`));
      });

      proc.on('close', (code, signal) => {
        clearTimeout(timer);
        this.activeProcesses.delete(procId);

        const result = {
          command: commandStr,
          exitCode: code,
          signal,
          timedOut: isTimedOut,
          stdout: stdoutBuffer,
          stderr: stderrBuffer,
          success: code === 0 && !isTimedOut
        };

        if (this.auditLogger) {
          this.auditLogger.log('COMMAND_FINISHED', {
            command: commandStr,
            exitCode: code,
            timedOut: isTimedOut,
            success: result.success
          });
        }

        resolve(result);
      });
    });
  }

  killAll() {
    for (const [id, proc] of this.activeProcesses.entries()) {
      try {
        proc.kill('SIGKILL');
      } catch (e) {
        // ignore
      }
    }
    this.activeProcesses.clear();
  }
}
