import fs from 'fs';
import path from 'path';
import type { StudySession } from '../types/index.js';
import { withFileLock, writeJsonAtomic } from './file-utils.js';

function getHistoryPath(projectPath: string): string {
  return path.join(projectPath, 'reviews', 'session-history.json');
}

function getActiveSessionPath(projectPath: string): string {
  return path.join(projectPath, 'reviews', 'active-session.json');
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

export function loadActiveSession(projectPath: string): StudySession | null {
  const activePath = getActiveSessionPath(projectPath);
  if (!fs.existsSync(activePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(activePath, 'utf-8')) as StudySession;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown parse error';
    throw new Error(`Failed to load active session: ${message}`, { cause: error });
  }
}

export function startStudySession(projectPath: string, session: StudySession): StudySession {
  const activePath = getActiveSessionPath(projectPath);
  return withFileLock(activePath, () => {
    if (fs.existsSync(activePath)) {
      const active = loadActiveSession(projectPath);
      throw new Error(`A learning session is already active${active?.unitId ? ` for unit "${active.unitId}"` : ''}`);
    }
    writeJsonAtomic(activePath, session);
    return session;
  });
}

export function clearActiveSession(projectPath: string): void {
  const activePath = getActiveSessionPath(projectPath);
  withFileLock(activePath, () => {
    if (fs.existsSync(activePath)) fs.unlinkSync(activePath);
  });
}
