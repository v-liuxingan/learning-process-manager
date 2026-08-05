import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LearningUnitManager } from '../src/lib/learning-unit.js';
import {
  clearActiveSession,
  loadActiveSession,
  startStudySession,
} from '../src/lib/session-history.js';

const testRoot = path.join(process.cwd(), '.tmp-unit-tests');
let projectPath = '';

beforeEach(() => {
  projectPath = path.join(testRoot, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(path.join(projectPath, 'notes'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(projectPath, { recursive: true, force: true });
  try {
    fs.rmdirSync(testRoot);
  } catch {
    // Parallel tests may still use the root.
  }
});

describe('learning unit state and evidence', () => {
  it('requires immediate evidence before consolidation and delayed evidence before mastery', () => {
    const notePath = path.join(projectPath, 'notes', 'unit-one.md');
    fs.writeFileSync(notePath, '# Unit one\n\n## 快速回顾\n', 'utf-8');
    const manager = new LearningUnitManager(projectPath, 'alpha');
    manager.ensureIndex();
    manager.addUnit({ id: 'unit-one', title: 'Unit one', notePath: 'notes/unit-one.md' });

    manager.transition('unit-one', 'learning');
    manager.addEvidence('unit-one', {
      type: 'explain',
      role: 'misconception',
      summary: 'Confident but incorrect explanation',
    });
    manager.addEvidence('unit-one', {
      type: 'apply',
      role: 'attempt',
      summary: 'Attempted the task but used the wrong rule',
    });
    expect(() => manager.transition('unit-one', 'assessment_pending')).not.toThrow();
    expect(() => manager.transition('unit-one', 'consolidating')).toThrow(/explain and apply/);

    manager.transition('unit-one', 'learning');
    manager.addEvidence('unit-one', { type: 'explain', summary: 'Explained the mechanism' });
    manager.addEvidence('unit-one', { type: 'apply', summary: 'Applied it to a new input' });
    manager.transition('unit-one', 'assessment_pending');
    manager.transition('unit-one', 'consolidating');
    expect(() => manager.transition('unit-one', 'mastered')).toThrow(/delayed independent/);

    manager.addEvidence('unit-one', {
      type: 'apply',
      summary: 'Applied it again after a delay',
      delayed: true,
    });
    expect(manager.transition('unit-one', 'mastered').status).toBe('mastered');

    const note = fs.readFileSync(notePath, 'utf-8');
    expect(note).toContain('## 学习证据');
    expect(note).toContain('Explained the mechanism');
    expect(note).toContain('角色：misconception');
    expect(note).toContain('延迟验证：是');
  });

  it('selects actionable units by remediation and prerequisite order', () => {
    const manager = new LearningUnitManager(projectPath, 'alpha');
    manager.ensureIndex();
    manager.addUnit({ id: 'foundation', title: 'Foundation' });
    manager.addUnit({ id: 'application', title: 'Application', prerequisites: ['foundation'] });

    expect(manager.getNextUnit()?.id).toBe('foundation');
    expect(() => manager.transition('application', 'learning')).toThrow(/Prerequisites/);

    manager.transition('foundation', 'learning');
    manager.transition('foundation', 'remediation');
    expect(manager.getNextUnit()?.id).toBe('foundation');
  });

  it('rejects note paths outside the project', () => {
    const manager = new LearningUnitManager(projectPath, 'alpha');
    expect(() => manager.addUnit({
      id: 'unsafe',
      title: 'Unsafe',
      notePath: '../outside.md',
    })).toThrow(/inside the project/);
  });
});

describe('active learning sessions', () => {
  it('persists one active session and clears it explicitly', () => {
    const session = startStudySession(projectPath, {
      id: 'session-1',
      projectName: 'alpha',
      unitId: 'unit-one',
      startedAt: '2026-08-02T10:00:00.000Z',
    });

    expect(session.unitId).toBe('unit-one');
    expect(loadActiveSession(projectPath)?.id).toBe('session-1');
    expect(() => startStudySession(projectPath, {
      id: 'session-2',
      projectName: 'alpha',
      startedAt: '2026-08-02T10:01:00.000Z',
    })).toThrow(/already active/);

    clearActiveSession(projectPath);
    expect(loadActiveSession(projectPath)).toBeNull();
  });
});
