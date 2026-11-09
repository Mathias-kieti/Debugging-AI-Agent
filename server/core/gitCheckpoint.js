import fs from 'fs';
import path from 'path';
import { SecurityGuard } from './security.js';

export class GitCheckpointManager {
  constructor(projectRoot) {
    this.projectRoot = path.resolve(projectRoot);
    this.checkpointDir = path.join(this.projectRoot, '.devdebugger_checkpoints');
    this.checkpoints = [];
  }

  init() {
    if (!fs.existsSync(this.checkpointDir)) {
      try {
        fs.mkdirSync(this.checkpointDir, { recursive: true });
      } catch (err) {
        console.warn('Could not create checkpoint dir:', err.message);
      }
    }
  }

  /**
   * Create a checkpoint snapshot for specific files or entire modified set
   */
  async createCheckpoint(files = [], label = 'pre-fix-snapshot') {
    this.init();
    const id = `cp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const snapshotDir = path.join(this.checkpointDir, id);
    fs.mkdirSync(snapshotDir, { recursive: true });

    const fileBackups = [];

    for (const relativePath of files) {
      if (!SecurityGuard.isPathSafe(this.projectRoot, relativePath)) {
        throw new Error(`Security violation: checkpoint path ${relativePath} escapes project root`);
      }

      const fullSourcePath = path.resolve(this.projectRoot, relativePath);
      if (fs.existsSync(fullSourcePath)) {
        const destRel = relativePath.replace(/[\/\\]/g, '__');
        const destBackupPath = path.join(snapshotDir, destRel);
        fs.copyFileSync(fullSourcePath, destBackupPath);
        fileBackups.push({
          originalRelative: relativePath,
          backupFileName: destRel
        });
      }
    }

    const checkpointMeta = {
      id,
      label,
      timestamp: new Date().toISOString(),
      files: fileBackups
    };

    fs.writeFileSync(
      path.join(snapshotDir, 'meta.json'),
      JSON.stringify(checkpointMeta, null, 2),
      'utf8'
    );

    this.checkpoints.push(checkpointMeta);
    return checkpointMeta;
  }

  /**
   * Revert project files back to a previous checkpoint state
   */
  async restoreCheckpoint(checkpointId) {
    const snapshotDir = path.join(this.checkpointDir, checkpointId);
    const metaFile = path.join(snapshotDir, 'meta.json');

    if (!fs.existsSync(metaFile)) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    const restoredFiles = [];

    for (const item of meta.files) {
      const backupPath = path.join(snapshotDir, item.backupFileName);
      const targetPath = path.resolve(this.projectRoot, item.originalRelative);

      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, targetPath);
        restoredFiles.push(item.originalRelative);
      }
    }

    return {
      success: true,
      restoredFiles,
      checkpointId
    };
  }

  listCheckpoints() {
    if (!fs.existsSync(this.checkpointDir)) return [];
    try {
      const entries = fs.readdirSync(this.checkpointDir);
      const results = [];
      for (const entry of entries) {
        const metaFile = path.join(this.checkpointDir, entry, 'meta.json');
        if (fs.existsSync(metaFile)) {
          results.push(JSON.parse(fs.readFileSync(metaFile, 'utf8')));
        }
      }
      return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch {
      return [];
    }
  }
}
