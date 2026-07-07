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
});
