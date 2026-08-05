import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const binPath = path.join(process.cwd(), 'dist', 'bin', 'learn.js');
let learnHome = '';

function runLearn(args: string[]): unknown {
  const output = execFileSync(process.execPath, [binPath, ...args, '--json'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      LEARN_HOME: learnHome,
    },
    encoding: 'utf-8',
  });

  return JSON.parse(output);
}

beforeEach(() => {
  learnHome = fs.mkdtempSync(path.join(os.tmpdir(), 'learn-cli-e2e-'));
});

afterEach(() => {
  fs.rmSync(learnHome, { recursive: true, force: true });
});

describe('packaged CLI', () => {
  it('reports the package version', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')) as {
      version: string;
    };
    const output = execFileSync(process.execPath, [binPath, '--version'], {
      cwd: process.cwd(),
      encoding: 'utf-8',
    }).trim();

    expect(output).toBe(packageJson.version);
  });

  it('initializes and diagnoses an isolated user data directory', () => {
    const init = runLearn(['init']) as {
      status: string;
      data: { indexPath: string; defaultProjectsDir: string; projectCount: number };
    };

    expect(init.status).toBe('success');
    expect(init.data.indexPath).toBe(path.join(learnHome, 'learning-projects.json'));
    expect(init.data.defaultProjectsDir).toBe(path.join(learnHome, 'projects'));
    expect(init.data.projectCount).toBe(0);

    const doctor = runLearn(['doctor']) as {
      status: string;
      data: { indexExists: boolean; projectsDirExists: boolean };
    };

    expect(doctor.status).toBe('success');
    expect(doctor.data.indexExists).toBe(true);
    expect(doctor.data.projectsDirExists).toBe(true);
  });

  it('includes review notes and flashcards in stats', () => {
    runLearn(['new', 'Stats Repro', '--topics', '1']);

    const projectPath = path.join(learnHome, 'projects', 'stats-repro');
    const notesPath = path.join(projectPath, 'notes');
    fs.mkdirSync(notesPath, { recursive: true });
    fs.writeFileSync(path.join(notesPath, 'one.md'), '# One note\n\nReview this.', 'utf-8');

    runLearn(['flashcard', 'create', '--project', 'stats-repro', '--front', 'Q', '--back', 'A']);
    runLearn([
      'flashcard',
      'add-note',
      '--project',
      'stats-repro',
      '--file',
      'notes/one.md',
      '--title',
      'One note',
    ]);

    const stats = runLearn(['stats']) as {
      status: string;
      data: { totalNotes: number; totalFlashcards: number; masteredFlashcards: number };
    };

    expect(stats.status).toBe('success');
    expect(stats.data.totalNotes).toBe(1);
    expect(stats.data.totalFlashcards).toBe(1);
    expect(stats.data.masteredFlashcards).toBe(0);
  });

  it('imports an existing project and reports the next learning status', () => {
    const projectPath = path.join(learnHome, 'external-project');
    fs.mkdirSync(projectPath, { recursive: true });
    fs.writeFileSync(path.join(projectPath, 'README.md'), '# External Project\n', 'utf-8');

    const imported = runLearn([
      'project',
      'import',
      '--path',
      projectPath,
      '--name',
      'external-project',
      '--topic',
      'External Project',
    ]) as {
      status: string;
      data: { project: { name: string; path: string } };
    };

    expect(imported.status).toBe('success');
    expect(imported.data.project.name).toBe('external-project');
    expect(imported.data.project.path).toBe(path.resolve(projectPath));

    runLearn([
      'flashcard',
      'create',
      '--project',
      'external-project',
      '--front',
      'What is imported?',
      '--back',
      'An existing learning directory.',
    ]);

    const status = runLearn(['status', 'external-project']) as {
      status: string;
      data: {
        project: { name: string };
        reviews: { due: { total: number; items: unknown[] } };
      };
      context: { nextActions: string[] };
    };

    expect(status.status).toBe('success');
    expect(status.data.project.name).toBe('external-project');
    expect(status.data.reviews.due.total).toBe(1);
    expect(status.data.reviews.due.items).toHaveLength(1);
    expect(status.context.nextActions[0]).toMatch(
      /learn review external-project --(due|overdue) --json/
    );
  });

  it('tracks a learning unit from session start to delayed mastery evidence', () => {
    runLearn(['new', 'Unit Flow']);
    const projectName = 'unit-flow';
    const projectPath = path.join(learnHome, 'projects', projectName);
    fs.writeFileSync(
      path.join(projectPath, 'notes', 'foundation.md'),
      '# Foundation\n\n## 快速回顾\n',
      'utf-8'
    );

    runLearn([
      'unit', 'add',
      '--project', projectName,
      '--id', 'foundation',
      '--title', 'Foundation',
      '--note', 'notes/foundation.md',
      '--current-objective', 'Build the first mental model',
      '--pending-objective', 'Explain the foundation in your own words',
      '--allowed-scope', 'stay on the foundation unit',
      '--interaction', 'diagram',
      '--next-action', 'read the foundation diagram',
    ]);
    runLearn([
      'unit', 'diagram', 'add',
      '--project', projectName,
      '--unit', 'foundation',
      '--id', 'foundation-flow',
      '--title', 'Foundation flow',
      '--purpose', 'Show the first causal chain',
      '--mermaid', 'flowchart',
      '--prompt', 'Read the diagram from input to outcome.',
      '--fallback', 'Input flows through the foundation concept to the outcome.',
      '--nodes', 'Input,Foundation,Outcome',
      '--relations', 'Input -> Foundation,Foundation -> Outcome',
    ]);

    const before = runLearn(['status', projectName]) as {
      data: {
        learningUnits: { next: { id: string } };
        learningPlan: {
          currentObjective: string;
          pendingObjective: string;
          recommendedInteractionType: string;
          diagrams: { id: string; fallback: string }[];
          evidenceGaps: string[];
        };
        teachingEntry: { mode: string; sequence: string[]; sources: { unitOverview?: string } };
      };
      context: { nextActions: string[] };
    };
    expect(before.data.learningUnits.next.id).toBe('foundation');
    expect(before.data.learningPlan.currentObjective).toBe('Build the first mental model');
    expect(before.data.learningPlan.pendingObjective).toBe('Explain the foundation in your own words');
    expect(before.data.learningPlan.recommendedInteractionType).toBe('diagram');
    expect(before.data.learningPlan.diagrams[0].id).toBe('foundation-flow');
    expect(before.data.learningPlan.evidenceGaps).toContain('independent explain evidence');
    expect(before.data.teachingEntry.mode).toBe('project_and_unit_overview');
    expect(before.data.teachingEntry.sequence).toEqual([
      'project_overview',
      'unit_overview',
      'diagnostic',
    ]);
    expect(before.data.teachingEntry.sources.unitOverview).toBe('notes/foundation.md');
    expect(before.context.nextActions[0]).toContain('--unit foundation');

    const started = runLearn([
      'session', 'start', '--project', projectName, '--unit', 'foundation',
    ]) as {
      data: { teachingEntry: { mode: string; sequence: string[] } };
    };
    expect(started.data.teachingEntry.mode).toBe('project_and_unit_overview');
    expect(started.data.teachingEntry.sequence[0]).toBe('project_overview');
    const active = runLearn(['status', projectName]) as {
      data: {
        activeSession: { unitId: string };
        teachingEntry: { mode: string };
      };
      context: { nextActions: string[] };
    };
    expect(active.data.activeSession.unitId).toBe('foundation');
    expect(active.data.teachingEntry.mode).toBe('project_and_unit_overview');
    expect(active.context.nextActions[0]).toContain('checkpoint add');
    const checkpoint = runLearn([
      'checkpoint', 'add',
      '--project', projectName,
      '--event', 'objective_completed',
      '--unit', 'foundation',
      '--summary', 'Completed the first mental model',
      '--objective', 'Build the first mental model',
      '--completed', 'Build the first mental model',
      '--pending', 'Explain the foundation in your own words',
      '--next-action', 'Ask for an own-words explanation',
    ]) as {
      status: string;
      data: { checkpoint: { eventType: string; pendingObjective: string } };
    };
    expect(checkpoint.status).toBe('success');
    expect(checkpoint.data.checkpoint.eventType).toBe('objective_completed');
    const checkpointStatus = runLearn(['status', projectName]) as {
      data: {
        learningPlan: {
          completedObjectives: string[];
          pendingObjective: string;
          recentCheckpoint: { summary: string };
        };
      };
    };
    expect(checkpointStatus.data.learningPlan.completedObjectives).toContain('Build the first mental model');
    expect(checkpointStatus.data.learningPlan.pendingObjective).toBe('Explain the foundation in your own words');
    expect(checkpointStatus.data.learningPlan.recentCheckpoint.summary).toBe('Completed the first mental model');
    runLearn(['session', 'end', '--project', projectName, '--duration', '12', '--summary', 'Foundation session']);

    const resumed = runLearn(['status', projectName]) as {
      data: { teachingEntry: { mode: string; sequence: string[] } };
    };
    expect(resumed.data.teachingEntry.mode).toBe('resume');
    expect(resumed.data.teachingEntry.sequence).toEqual(['resume_brief', 'diagnostic']);

    runLearn(['unit', 'evidence', '--project', projectName, '--unit', 'foundation', '--type', 'explain', '--summary', 'Explained independently']);
    runLearn(['unit', 'evidence', '--project', projectName, '--unit', 'foundation', '--type', 'apply', '--summary', 'Applied independently']);
    runLearn(['unit', 'transition', '--project', projectName, '--unit', 'foundation', '--to', 'assessment_pending']);
    runLearn(['unit', 'transition', '--project', projectName, '--unit', 'foundation', '--to', 'consolidating']);
    runLearn(['unit', 'evidence', '--project', projectName, '--unit', 'foundation', '--type', 'apply', '--summary', 'Applied after delay', '--delayed']);
    runLearn(['unit', 'transition', '--project', projectName, '--unit', 'foundation', '--to', 'mastered']);

    const completed = runLearn(['status', projectName]) as {
      data: {
        project: { progress: number; topicsCompleted: number; topicsTotal: number };
        activeSession: null;
        learningUnits: { stats: { mastered: number } };
      };
    };
    expect(completed.data.project.progress).toBe(100);
    expect(completed.data.project.topicsCompleted).toBe(1);
    expect(completed.data.project.topicsTotal).toBe(1);
    expect(completed.data.learningUnits.stats.mastered).toBe(1);
    expect(completed.data.activeSession).toBeNull();
    expect(fs.readFileSync(path.join(projectPath, 'notes', 'foundation.md'), 'utf-8')).toContain('Applied after delay');

    runLearn([
      'unit', 'add',
      '--project', projectName,
      '--id', 'application',
      '--title', 'Application',
      '--prerequisites', 'foundation',
    ]);
    const nextUnit = runLearn(['status', projectName]) as {
      data: {
        learningUnits: { next: { id: string } };
        teachingEntry: { mode: string; sequence: string[] };
      };
    };
    expect(nextUnit.data.learningUnits.next.id).toBe('application');
    expect(nextUnit.data.teachingEntry.mode).toBe('unit_overview');
    expect(nextUnit.data.teachingEntry.sequence).toEqual(['unit_overview', 'diagnostic']);
  });
});
