import type { Command } from 'commander';
import { recordCheckpoint, loadCheckpoints } from '../lib/checkpoint.js';
import { getProjectManager } from '../lib/project.js';
import type { LearningCheckpointEventType } from '../types/index.js';

type GlobalOptions = { json?: boolean };

const CHECKPOINT_EVENT_TYPES: LearningCheckpointEventType[] = [
  'session_start',
  'objective_completed',
  'evidence_recorded',
  'misconception',
  'correction',
  'transition',
  'next_action',
];

function outputJson(command: string, status: 'success' | 'error', data?: unknown, error?: string): void {
  console.log(JSON.stringify({
    version: '1.0',
    timestamp: new Date().toISOString(),
    command,
    status,
    data,
    error: error ? { code: 'CHECKPOINT_ERROR', message: error } : undefined,
  }, null, 2));
}

function parseList(value?: string): string[] {
  return value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
}

function getProject(projectName: string) {
  const manager = getProjectManager();
  const project = manager.getProject(projectName);
  if (!project) throw new Error(`Project "${projectName}" does not exist`);
  return project;
}

export function registerCheckpointCommand(program: Command): void {
  const checkpoint = program.command('checkpoint').description('Record and inspect structured learning checkpoints');

  checkpoint
    .command('add')
    .requiredOption('-p, --project <name>', 'Project name')
    .requiredOption('--event <type>', `Checkpoint event (${CHECKPOINT_EVENT_TYPES.join('|')})`)
    .requiredOption('--summary <text>', 'Short structured checkpoint summary')
    .option('--unit <id>', 'Learning unit id')
    .option('--session <id>', 'Related session id')
    .option('--objective <text>', 'Current objective')
    .option('--completed <items>', 'Comma-separated completed objectives')
    .option('--pending <text>', 'Pending objective')
    .option('--next-action <text>', 'Next concrete learning action')
    .option('--evidence <ids>', 'Comma-separated evidence ids')
    .action((options: {
      project: string;
      event: string;
      summary: string;
      unit?: string;
      session?: string;
      objective?: string;
      completed?: string;
      pending?: string;
      nextAction?: string;
      evidence?: string;
    }, cmd) => {
      const global = cmd.optsWithGlobals() as GlobalOptions;
      try {
        if (!CHECKPOINT_EVENT_TYPES.includes(options.event as LearningCheckpointEventType)) {
          throw new Error(`Unknown checkpoint event: ${options.event}`);
        }
        const project = getProject(options.project);
        const saved = recordCheckpoint(project.path, project.name, {
          projectName: project.name,
          unitId: options.unit,
          sessionId: options.session,
          eventType: options.event as LearningCheckpointEventType,
          objective: options.objective,
          summary: options.summary,
          completedObjectives: parseList(options.completed),
          pendingObjective: options.pending,
          nextAction: options.nextAction,
          evidenceIds: parseList(options.evidence),
        });
        if (global.json) outputJson('checkpoint add', 'success', { checkpoint: saved });
        else console.log(`Recorded checkpoint: ${saved.id}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to record checkpoint';
        if (global.json) outputJson('checkpoint add', 'error', undefined, message);
        else console.error(`Failed to record checkpoint: ${message}`);
        process.exit(1);
      }
    });

  checkpoint
    .command('list')
    .requiredOption('-p, --project <name>', 'Project name')
    .option('--limit <number>', 'Maximum checkpoints to include', parseInt)
    .option('--unit <id>', 'Filter by learning unit id')
    .action((options: { project: string; limit?: number; unit?: string }, cmd) => {
      const global = cmd.optsWithGlobals() as GlobalOptions;
      try {
        const project = getProject(options.project);
        const checkpoints = loadCheckpoints(project.path, project.name).checkpoints
          .filter((item) => !options.unit || item.unitId === options.unit)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, options.limit ?? 10);
        if (global.json) outputJson('checkpoint list', 'success', { checkpoints });
        else checkpoints.forEach((item) => console.log(`${item.createdAt}\t${item.eventType}\t${item.summary}`));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to list checkpoints';
        if (global.json) outputJson('checkpoint list', 'error', undefined, message);
        else console.error(`Failed to list checkpoints: ${message}`);
        process.exit(1);
      }
    });
}
