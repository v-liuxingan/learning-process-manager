import type { Command } from 'commander';
import { getProjectManager } from '../lib/project.js';
import { loadActiveSession, loadStudySessions } from '../lib/session-history.js';
import { ReviewIndexManager, getSRManager } from '../lib/spaced-repetition.js';
import { LearningUnitManager } from '../lib/learning-unit.js';
import { buildTeachingEntryContext } from '../lib/teaching-entry.js';
import { getRecentCheckpoint } from '../lib/checkpoint.js';
import type {
  LearningCheckpoint,
  LearningUnit,
  LearningUnitStats,
  ProjectMeta,
  ReviewableItem,
  OverdueItem,
  StudySession,
  TeachingEntryContext,
} from '../types/index.js';

type LearningPlanStatus = {
  currentUnit: Pick<LearningUnit, 'id' | 'title' | 'status'> | null;
  currentObjective?: string;
  completedObjectives: string[];
  pendingObjective?: string;
  nextAction?: string;
  allowedScope?: string;
  recommendedInteractionType?: string;
  recentCheckpoint: LearningCheckpoint | null;
  recentEvidence: LearningUnit['evidence'];
  evidenceGaps: string[];
  diagrams: LearningUnit['diagrams'];
};

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
  activeSession: StudySession | null;
  learningUnits: {
    stats: LearningUnitStats;
    next: LearningUnit | null;
  } | null;
  learningPlan: LearningPlanStatus | null;
  teachingEntry: TeachingEntryContext | null;
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

function getRecentSession(sessions: StudySession[]): StudySession | null {
  if (sessions.length === 0) {
    return null;
  }

  return [...sessions].sort((a, b) => {
    const aTime = new Date(a.endedAt ?? a.startedAt).getTime();
    const bTime = new Date(b.endedAt ?? b.startedAt).getTime();
    return bTime - aTime;
  })[0];
}

function getNextActions(
  project: ProjectMeta | null,
  reviews: StatusData['reviews'],
  activeSession: StudySession | null,
  nextUnit: LearningUnit | null,
  unitTotal: number
): string[] {
  if (!project) {
    return [
      'learn project import --path <dir> --json',
      'learn new <topic> --json',
    ];
  }

  if (activeSession) {
    return [
      `learn checkpoint add --project ${project.name} --event objective_completed --unit ${activeSession.unitId ?? '<unit-id>'} --summary "<checkpoint>" --json`,
      `learn session end --project ${project.name} --summary "<summary>" --json`,
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


  if (nextUnit) {
    return [
      `learn session start --project ${project.name} --unit ${nextUnit.id} --json`,
      `learn unit next --project ${project.name} --json`,
    ];
  }

  if (unitTotal === 0) {
    return [
      `learn unit add --project ${project.name} --id <id> --title "<title>" --json`,
    ];
  }

  return [
    `learn unit list --project ${project.name} --json`,
  ];
}

function buildEvidenceGaps(unit: LearningUnit | null): string[] {
  if (!unit) return [];
  const countsForMastery = (item: LearningUnit['evidence'][number]): boolean =>
    item.independent && ['correction', 'verification'].includes(item.role);
  const gaps: string[] = [];

  if (!unit.evidence.some((item) => item.type === 'explain' && countsForMastery(item))) {
    gaps.push('independent explain evidence');
  }
  if (!unit.evidence.some((item) => item.type === 'apply' && countsForMastery(item))) {
    gaps.push('independent apply evidence');
  }
  if (!unit.evidence.some((item) =>
    item.delayed
    && item.independent
    && ['correction', 'verification'].includes(item.role)
    && ['explain', 'apply', 'transfer', 'artifact'].includes(item.type)
  )) {
    gaps.push('delayed independent evidence');
  }
  return gaps;
}

function buildLearningPlan(
  project: ProjectMeta,
  unit: LearningUnit | null,
  activeSession: StudySession | null
): LearningPlanStatus {
  const recentCheckpoint = getRecentCheckpoint(project.path, project.name, unit?.id);
  const completedObjectives = [
    ...new Set([
      ...(unit?.plan.completedObjectives ?? []),
      ...(recentCheckpoint?.completedObjectives ?? []),
    ]),
  ];
  const recentEvidence = unit
    ? [...unit.evidence]
        .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())
        .slice(0, 5)
    : [];

  return {
    currentUnit: unit ? { id: unit.id, title: unit.title, status: unit.status } : null,
    currentObjective: recentCheckpoint?.objective ?? unit?.plan.currentObjective,
    completedObjectives,
    pendingObjective: recentCheckpoint?.pendingObjective ?? unit?.plan.pendingObjective,
    nextAction: recentCheckpoint?.nextAction ?? unit?.nextAction,
    allowedScope: unit?.plan.allowedScope ?? (activeSession ? 'continue the active unit unless the user explicitly changes topic' : undefined),
    recommendedInteractionType: unit?.plan.recommendedInteractionType ?? (unit?.diagrams.length ? 'diagram' : 'scenario'),
    recentCheckpoint,
    recentEvidence,
    evidenceGaps: buildEvidenceGaps(unit),
    diagrams: unit?.diagrams ?? [],
  };
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
      activeSession: null,
      learningUnits: null,
      learningPlan: null,
      teachingEntry: null,
      availableProjects: projects,
    };
  }

  const reviewManager = new ReviewIndexManager(project.path);
  const index = reviewManager.loadIndex();
  const srManager = getSRManager();
  const dueItems = srManager.getDueItems(index);
  const overdueItems = srManager.getOverdueItems(index);
  const unitManager = new LearningUnitManager(project.path, project.name);
  const unitStats = unitManager.getStats();
  const activeSession = loadActiveSession(project.path);
  const sessions = loadStudySessions(project.path);
  const nextUnit = activeSession?.unitId
    ? unitManager.getUnit(activeSession.unitId) ?? unitManager.getNextUnit()
    : unitManager.getNextUnit();
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
    recentSession: getRecentSession(sessions),
    activeSession,
    learningUnits: {
      stats: unitStats,
      next: nextUnit,
    },
    learningPlan: buildLearningPlan(project, nextUnit, activeSession),
    teachingEntry: buildTeachingEntryContext({
      unit: nextUnit,
      completedSessions: sessions,
      activeSession,
    }),
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
        const nextActions = getNextActions(
          data.project,
          data.reviews,
          data.activeSession,
          data.learningUnits?.next ?? null,
          data.learningUnits?.stats.total ?? 0
        );

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
        if (data.learningUnits) {
          console.log(`Learning units: ${data.learningUnits.stats.mastered}/${data.learningUnits.stats.total} mastered`);
          if (data.learningUnits.next) {
            console.log(`Current unit: ${data.learningUnits.next.id} (${data.learningUnits.next.status})`);
          }
        }
        if (data.teachingEntry && data.teachingEntry.mode !== 'none') {
          console.log(`Teaching entry: ${data.teachingEntry.mode}`);
          console.log(`Teaching sequence: ${data.teachingEntry.sequence.join(' -> ')}`);
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
