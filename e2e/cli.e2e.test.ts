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
    ]);

    const before = runLearn(['status', projectName]) as {
      data: { learningUnits: { next: { id: string } } };
      context: { nextActions: string[] };
    };
    expect(before.data.learningUnits.next.id).toBe('foundation');
    expect(before.context.nextActions[0]).toContain('--unit foundation');

    runLearn(['session', 'start', '--project', projectName, '--unit', 'foundation']);
    const active = runLearn(['status', projectName]) as {
      data: { activeSession: { unitId: string } };
      context: { nextActions: string[] };
    };
    expect(active.data.activeSession.unitId).toBe('foundation');
    expect(active.context.nextActions[0]).toContain('session end');
    runLearn(['session', 'end', '--project', projectName, '--duration', '12', '--summary', 'Foundation session']);

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
  });
});
