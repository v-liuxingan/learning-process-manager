import fs from 'fs';
import path from 'path';

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function withFileLock<T>(targetPath: string, fn: () => T): T {
  ensureDir(path.dirname(targetPath));

  const lockPath = `${targetPath}.lock`;
  const startedAt = Date.now();
  let fd: number | undefined;

  while (fd === undefined) {
    try {
      fd = fs.openSync(lockPath, 'wx');
    } catch (error) {
      const code = error instanceof Error && 'code' in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;

      if (code !== 'EEXIST' || Date.now() - startedAt > 5000) {
        throw error;
      }

      sleepSync(50);
    }
  }

  try {
    return fn();
  } finally {
    fs.closeSync(fd);
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // The lock file may already be gone on cleanup; the protected operation is complete.
    }
  }
}

export function writeJsonAtomic(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));

  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);
}
