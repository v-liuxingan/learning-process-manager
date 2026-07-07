import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigLoader, getConfigLoader, resetConfigLoader } from '../src/config/index.js';
import { ProjectManager, resetProjectManager } from '../src/lib/project.js';

const testRoot = path.join(process.cwd(), '.tmp-public-user-tests');
let caseDir = '';
let originalLearnHome: string | undefined;
let originalLearnIndexPath: string | undefined;
let originalLearnProjectsDir: string | undefined;

beforeEach(() => {
  caseDir = path.join(testRoot, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(caseDir, { recursive: true });

  originalLearnHome = process.env.LEARN_HOME;
  originalLearnIndexPath = process.env.LEARN_INDEX_PATH;
  originalLearnProjectsDir = process.env.LEARN_PROJECTS_DIR;
  delete process.env.LEARN_HOME;
  delete process.env.LEARN_INDEX_PATH;
  delete process.env.LEARN_PROJECTS_DIR;

  resetConfigLoader();
  resetProjectManager();
});

afterEach(() => {
  if (originalLearnHome === undefined) delete process.env.LEARN_HOME;
  else process.env.LEARN_HOME = originalLearnHome;

  if (originalLearnIndexPath === undefined) delete process.env.LEARN_INDEX_PATH;
  else process.env.LEARN_INDEX_PATH = originalLearnIndexPath;

  if (originalLearnProjectsDir === undefined) delete process.env.LEARN_PROJECTS_DIR;
  else process.env.LEARN_PROJECTS_DIR = originalLearnProjectsDir;

  resetConfigLoader();
  resetProjectManager();
  fs.rmSync(caseDir, { recursive: true, force: true });
  try {
    fs.rmdirSync(testRoot);
  } catch {
    // Other parallel test cases may still be using the shared temp root.
  }
});

describe('public user data paths', () => {
  it('derives index and project directories from LEARN_HOME', () => {
    process.env.LEARN_HOME = caseDir;

    const loader = new ConfigLoader();

    expect(loader.getIndexPath()).toBe(path.join(caseDir, 'learning-projects.json'));
    expect(loader.getDefaultProjectsDir()).toBe(path.join(caseDir, 'projects'));
  });

  it('allows explicit environment overrides for index and project directories', () => {
    process.env.LEARN_INDEX_PATH = path.join(caseDir, 'custom', 'index.json');
    process.env.LEARN_PROJECTS_DIR = path.join(caseDir, 'custom-projects');

    const loader = new ConfigLoader();

    expect(loader.getIndexPath()).toBe(path.join(caseDir, 'custom', 'index.json'));
    expect(loader.getDefaultProjectsDir()).toBe(path.join(caseDir, 'custom-projects'));
  });

  it('initializes the configured index without creating projects', () => {
    const indexPath = path.join(caseDir, 'state', 'learning-projects.json');
    const projectsDir = path.join(caseDir, 'projects');
    getConfigLoader({ indexPath, defaultProjectsDir: projectsDir });
    const manager = new ProjectManager();
    const index = manager.initialize();

    expect(fs.existsSync(indexPath)).toBe(true);
    expect(fs.existsSync(projectsDir)).toBe(true);
    expect(index.projects).toEqual([]);
  });

  it('throws a clear error when the project index is invalid JSON', () => {
    const indexPath = path.join(caseDir, 'bad-index.json');
    fs.writeFileSync(indexPath, '{bad json', 'utf-8');

    expect(() => new ProjectManager(indexPath)).toThrow(`Failed to load project index at "${indexPath}"`);
  });
});
