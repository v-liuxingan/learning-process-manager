import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectManager, resetProjectManager } from '../src/lib/project.js';
import { ReviewIndexManager } from '../src/lib/spaced-repetition.js';
import { loadStudySessions, recordStudySession } from '../src/lib/session-history.js';
import { getConfigLoader, resetConfigLoader } from '../src/config/index.js';
import { createInlineItem } from '../src/types/index.js';

const testRoot = path.join(process.cwd(), '.tmp-tests');
let caseDir = '';

beforeEach(() => {
  caseDir = path.join(testRoot, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(caseDir, { recursive: true });
  resetConfigLoader();
  resetProjectManager();
});

afterEach(() => {
  resetConfigLoader();
  resetProjectManager();
  fs.rmSync(caseDir, { recursive: true, force: true });
  try {
    fs.rmdirSync(testRoot);
  } catch {
    // Other parallel test cases may still be using the shared temp root.
  }
});

describe('project configuration and persistence', () => {
  it('uses configured defaultProjectsDir when creating a project', () => {
    const configuredDir = path.join(caseDir, 'configured-projects');
    getConfigLoader({ defaultProjectsDir: configuredDir });

    const manager = new ProjectManager(path.join(caseDir, 'index.json'));
    const project = manager.createProject({ name: 'alpha', topic: 'Alpha' });

    expect(project.path).toBe(path.join(configuredDir, 'alpha'));
    expect(fs.existsSync(path.join(configuredDir, 'alpha'))).toBe(true);
    expect(fs.existsSync(path.join(project.path, 'learning-units.json'))).toBe(true);
    expect(fs.readFileSync(path.join(project.path, 'README.md'), 'utf-8')).toContain('consolidating');
    expect(fs.readFileSync(path.join(project.path, 'README.md'), 'utf-8')).toContain('课程总览');
    expect(fs.readFileSync(path.join(project.path, 'README.md'), 'utf-8')).toContain('学习对象定向');
    expect(fs.readFileSync(path.join(project.path, 'README.md'), 'utf-8')).toContain('一句话定义');
    expect(fs.readFileSync(path.join(project.path, 'README.md'), 'utf-8')).toContain('它不是什么');
    expect(fs.readFileSync(path.join(project.path, 'README.md'), 'utf-8')).toContain('第一单元');
    expect(fs.readFileSync(path.join(project.path, 'README.md'), 'utf-8')).toContain('起点与假设');
    expect(fs.readFileSync(path.join(project.path, 'README.md'), 'utf-8')).toContain('诊断任务');
    expect(fs.readFileSync(path.join(project.path, 'README.md'), 'utf-8')).not.toContain('目标 1');
    expect(fs.readFileSync(path.join(project.path, 'README.md'), 'utf-8')).not.toContain('{{');
    expect(fs.readFileSync(path.join(project.path, 'progress.md'), 'utf-8')).toContain('延迟验证');
  });

  it('imports an existing project directory without replacing files', () => {
    const existingDir = path.join(caseDir, 'existing');
    fs.mkdirSync(existingDir, { recursive: true });
    fs.writeFileSync(path.join(existingDir, 'README.md'), '# Existing Plan\n', 'utf-8');

    const manager = new ProjectManager(path.join(caseDir, 'index.json'));
    const project = manager.importProject({
      path: existingDir,
      name: 'existing-project',
      topic: 'Existing Topic',
      topicsTotal: 3,
    });

    expect(project.name).toBe('existing-project');
    expect(project.path).toBe(path.resolve(existingDir));
    expect(fs.readFileSync(path.join(existingDir, 'README.md'), 'utf-8')).toBe('# Existing Plan\n');
    expect(fs.existsSync(path.join(existingDir, 'progress.md'))).toBe(true);
    expect(fs.readFileSync(path.join(existingDir, 'progress.md'), 'utf-8')).toContain('延迟验证');
    expect(fs.existsSync(path.join(existingDir, 'reviews', 'review-index.json'))).toBe(true);
    expect(fs.existsSync(path.join(existingDir, 'learning-units.json'))).toBe(true);
    expect(manager.getProject('existing-project')?.path).toBe(path.resolve(existingDir));
  });
});

describe('review and session history persistence', () => {
  it('appends review items and study sessions without replacing existing entries', () => {
    const projectPath = path.join(caseDir, 'project');
    const reviews = new ReviewIndexManager(projectPath);

    reviews.addItem(createInlineItem('card-1', 'flashcard', 'Front 1', 'Front 1', 'Back 1'));
    reviews.addItem(createInlineItem('card-2', 'flashcard', 'Front 2', 'Front 2', 'Back 2'));

    expect(reviews.loadIndex().items.map((item) => item.id)).toEqual(['card-1', 'card-2']);

    recordStudySession(projectPath, {
      id: 'session-1',
      projectName: 'alpha',
      startedAt: '2026-06-02T09:00:00.000Z',
      endedAt: '2026-06-02T09:30:00.000Z',
      duration: 30,
    });
    recordStudySession(projectPath, {
      id: 'session-2',
      projectName: 'alpha',
      startedAt: '2026-06-02T10:00:00.000Z',
      endedAt: '2026-06-02T10:45:00.000Z',
      duration: 45,
    });

    expect(loadStudySessions(projectPath).map((session) => session.id)).toEqual([
      'session-1',
      'session-2',
    ]);
  });
});
