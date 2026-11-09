import path from 'path';
import { CONFIG } from '../config.js';

export class SecurityGuard {
  /**
   * Ensure a target path is strictly within the project directory.
   */
  static isPathSafe(projectRoot, targetPath) {
    if (!projectRoot || !targetPath) return false;
    const resolvedRoot = path.resolve(projectRoot);
    const resolvedTarget = path.resolve(projectRoot, targetPath);
    return resolvedTarget.startsWith(resolvedRoot);
  }

  /**
   * Validate command and arguments against allowlist.
   */
  static validateCommand(command, args = []) {
    const baseCommand = path.basename(command).toLowerCase();
    const isAllowed = CONFIG.ALLOWED_COMMANDS.some(cmd => baseCommand === cmd || baseCommand.startsWith(cmd));
    
    if (!isAllowed) {
      return {
        safe: false,
        reason: `Command '${command}' is not in the execution allowlist: [${CONFIG.ALLOWED_COMMANDS.join(', ')}]`
      };
    }

    const fullCmdStr = `${command} ${args.join(' ')}`;
    for (const blocked of CONFIG.BLOCKED_ARGS) {
      if (fullCmdStr.includes(blocked)) {
        return {
          safe: false,
          reason: `Command contains forbidden shell metacharacter or sequence: '${blocked}'`
        };
      }
    }

    return { safe: true };
  }

  /**
   * Sanitize text to remove sensitive secrets / keys.
   */
  static sanitizeOutput(text) {
    if (typeof text !== 'string') return text;
    let sanitized = text;
    for (const pattern of CONFIG.SECRET_PATTERNS) {
      sanitized = sanitized.replace(pattern, (match, p1) => {
        if (p1) {
          return match.replace(p1, '***REDACTED_SECRET***');
        }
        return '***REDACTED_SECRET***';
      });
    }
    return sanitized;
  }
}
