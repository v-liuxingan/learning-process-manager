import fs from 'fs';
import path from 'path';
import type {
  LearningCheckpoint,
  LearningCheckpointEventType,
  LearningCheckpointIndex,
} from '../types/index.js';
import { withFileLock, writeJsonAtomic } from './file-utils.js';

function getCheckpointPath(projectPath: string): string {
  return path.join(projectPath, 'reviews', 'checkpoints.json');
}

function emptyIndex(projectId: string): LearningCheckpointIndex {
  return { version: '1.0', projectId, checkpoints: [] };
}

export function loadCheckpoints(projectPath: string, projectId: string): LearningCheckpointIndex {
  const checkpointPath = getCheckpointPath(projectPath);
  if (!fs.existsSync(checkpointPath)) {
    return emptyIndex(projectId);
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8')) as Partial<LearningCheckpointIndex>;
    return {
      version: '1.0',
      projectId: parsed.projectId ?? projectId,
      checkpoints: Array.isArray(parsed.checkpoints)
        ? parsed.checkpoints.map((checkpoint) => ({
            ...checkpoint,
            completedObjectives: Array.isArray(checkpoint.completedObjectives)
              ? checkpoint.completedObjectives
              : [],
            evidenceIds: Array.isArray(checkpoint.evidenceIds) ? checkpoint.evidenceIds : [],
          }))
        : [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown parse error';
    throw new Error(`Failed to load learning checkpoints at "${checkpointPath}": ${message}`, {
      cause: error,
    });
  }
}

export function recordCheckpoint(projectPath: string, projectId: string, options: {
  projectName: string;
  unitId?: string;
  sessionId?: string;
  eventType: LearningCheckpointEventType;
  objective?: string;
  summary: string;
  completedObjectives?: string[];
  pendingObjective?: string;
  nextAction?: string;
  evidenceIds?: string[];
}): LearningCheckpoint {
  if (!options.summary.trim()) {
    throw new Error('Checkpoint summary cannot be empty');
  }

  const checkpointPath = getCheckpointPath(projectPath);
  return withFileLock(checkpointPath, () => {
    const index = loadCheckpoints(projectPath, projectId);
    const createdAt = new Date().toISOString();
    const checkpoint: LearningCheckpoint = {
      id: `checkpoint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectName: options.projectName,
      unitId: options.unitId,
      sessionId: options.sessionId,
      eventType: options.eventType,
      objective: options.objective?.trim(),
      summary: options.summary.trim(),
      completedObjectives: options.completedObjectives ?? [],
      pendingObjective: options.pendingObjective?.trim(),
      nextAction: options.nextAction?.trim(),
      evidenceIds: options.evidenceIds ?? [],
      createdAt,
    };
    index.checkpoints.push(checkpoint);
    writeJsonAtomic(checkpointPath, index);
    return checkpoint;
  });
}

export function getRecentCheckpoint(
  projectPath: string,
  projectId: string,
  unitId?: string
): LearningCheckpoint | null {
  const checkpoints = loadCheckpoints(projectPath, projectId).checkpoints;
  const matching = unitId
    ? checkpoints.filter((checkpoint) => checkpoint.unitId === unitId)
    : checkpoints;
  if (matching.length === 0) return null;

  return [...matching].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
}
