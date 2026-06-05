import fs from 'fs';
import path from 'path';
import type { StudySession } from '../types/index.js';
import { withFileLock, writeJsonAtomic } from './file-utils.js';

function getHistoryPath(projectPath: string): string {
  return path.join(projectPath, 'reviews', 'session-history.json');
}

export function loadStudySessions(projectPath: string): StudySession[] {
  const historyPath = getHistoryPath(projectPath);
  if (!fs.existsSync(historyPath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordStudySession(projectPath: string, session: StudySession): void {
  const historyPath = getHistoryPath(projectPath);
  withFileLock(historyPath, () => {
    const sessions = loadStudySessions(projectPath);
    sessions.push(session);
    writeJsonAtomic(historyPath, sessions);
  });
}
