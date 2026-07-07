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
});
