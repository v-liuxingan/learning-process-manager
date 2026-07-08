import type { Command } from 'commander';
import { getProjectManager } from '../lib/project.js';
import { loadStudySessions } from '../lib/session-history.js';
import { ReviewIndexManager, getSRManager } from '../lib/spaced-repetition.js';
import type { ProjectMeta, ReviewableItem, OverdueItem, StudySession } from '../types/index.js';

type StatusData = {
  project: ProjectMeta | null;
  reviews: {
    due: {
      total: number;
      items: ReviewableItem[];
    };
    overdue: {
      total: number;
      byPriority: Record<string, number>;
      items: OverdueItem[];
    };
  } | null;
  recentSession: StudySession | null;
  availableProjects?: ProjectMeta[];
};

type GlobalOptions = {
  json?: boolean;
};

function printJson(command: string, data: StatusData, nextActions: string[]): void {
  console.log(JSON.stringify({
    version: '1.0',
    timestamp: new Date().toISOString(),
    command,
    status: 'success',
    data,
    context: {
      project: data.project?.name,
      stage: data.project?.stage,
      nextActions,
    },
  }, null, 2));
}

function printJsonError(command: string, code: string, message: string): void {
  console.log(JSON.stringify({
    version: '1.0',
    timestamp: new Date().toISOString(),
    command,
    status: 'error',
    error: { code, message },
  }, null, 2));
}

function chooseProject(projects: ProjectMeta[]): ProjectMeta | null {
  if (projects.length === 0) {
    return null;
  }

  return [...projects].sort((a, b) => {
    const aTime = a.lastStudyDate ? new Date(a.lastStudyDate).getTime() : 0;
    const bTime = b.lastStudyDate ? new Date(b.lastStudyDate).getTime() : 0;
    return bTime - aTime;
  })[0];
}

function getRecentSession(project: ProjectMeta): StudySession | null {
  const sessions = loadStudySessions(project.path);
  if (sessions.length === 0) {
    return null;
  }

  return [...sessions].sort((a, b) => {
    const aTime = new Date(a.endedAt ?? a.startedAt).getTime();
    const bTime = new Date(b.endedAt ?? b.startedAt).getTime();
    return bTime - aTime;
  })[0];
}

function getNextActions(project: ProjectMeta | null, reviews: StatusData['reviews']): string[] {
  if (!project) {
    return [
      'learn project import --path <dir> --json',
      'learn new <topic> --json',
    ];
  }

  if (reviews && reviews.overdue.total > 0) {
    return [
      `learn review ${project.name} --overdue --json`,
      `learn review-submit <item-id> <again|hard|good|easy> --project ${project.name} --json`,
    ];
  }

  if (reviews && reviews.due.total > 0) {
    return [
      `learn review ${project.name} --due --json`,
      `learn review-submit <item-id> <again|hard|good|easy> --project ${project.name} --json`,
    ];
  }

  return [
    `learn session start --project ${project.name} --json`,
    `learn session end --project ${project.name} --duration <minutes> --summary "<summary>" --json`,
  ];
}

function buildStatus(projectName: string | undefined, limit: number): StatusData {
  const manager = getProjectManager();
  const projects = manager.getAllProjects();
  const project = projectName
    ? manager.getProject(projectName)
    : chooseProject(projects);

  if (projectName && !project) {
    throw new Error(`Project "${projectName}" does not exist`);
  }

  if (!project) {
    return {
      project: null,
      reviews: null,
      recentSession: null,
      availableProjects: projects,
    };
  }

  const reviewManager = new ReviewIndexManager(project.path);
  const index = reviewManager.loadIndex();
  const srManager = getSRManager();
  const dueItems = srManager.getDueItems(index);
  const overdueItems = srManager.getOverdueItems(index);
  return {
    project,
    reviews: {
      due: {
        total: dueItems.length,
        items: dueItems.slice(0, limit),
      },
      overdue: {
        total: overdueItems.length,
        byPriority: {
          high: overdueItems.filter((item) => item.priority === 'high').length,
          medium: overdueItems.filter((item) => item.priority === 'medium').length,
          low: overdueItems.filter((item) => item.priority === 'low').length,
        },
        items: overdueItems.slice(0, limit),
      },
    },
    recentSession: getRecentSession(project),
  };
}

function registerStatusLikeCommand(program: Command, name: string): void {
  program
    .command(`${name} [project]`)
    .description('Show the next useful learning action')
    .option('--limit <number>', 'Maximum review items to include', parseInt)
    .action((projectName: string | undefined, _args, cmd) => {
      const options = cmd.optsWithGlobals() as GlobalOptions & { limit?: number };
      const limit = options.limit ?? 5;

      try {
        const data = buildStatus(projectName, limit);
        const nextActions = getNextActions(data.project, data.reviews);

        if (options.json) {
          printJson(name, data, nextActions);
          return;
        }

        if (!data.project) {
          console.log('No learning projects are registered.');
          console.log(`Next: ${nextActions[0]}`);
          return;
        }

        console.log(`${data.project.name}: ${data.project.progress}% (${data.project.stage})`);
        if (data.reviews) {
          console.log(`Due reviews: ${data.reviews.due.total}`);
          console.log(`Overdue reviews: ${data.reviews.overdue.total}`);
        }
        console.log(`Next: ${nextActions[0]}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to read learning status';
        if (options.json) {
          printJsonError(name, 'STATUS_ERROR', message);
        } else {
          console.error(`Failed to read learning status: ${message}`);
        }
        process.exit(1);
      }
    });
}

export function registerStatusCommand(program: Command): void {
  registerStatusLikeCommand(program, 'status');
  registerStatusLikeCommand(program, 'next');
}
