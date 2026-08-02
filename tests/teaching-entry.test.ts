import { describe, expect, it } from 'vitest';
import { buildTeachingEntryContext } from '../src/lib/teaching-entry.js';
import type { LearningUnit, StudySession } from '../src/types/index.js';

function createUnit(status: LearningUnit['status'] = 'not_started'): LearningUnit {
  return {
    id: 'foundation',
    title: 'Foundation',
    notePath: 'notes/foundation.md',
    prerequisites: [],
    status,
    evidence: [],
    createdAt: '2026-08-02T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
  };
}

function createSession(unitId: string): StudySession {
  return {
    id: `session-${unitId}`,
    projectName: 'alpha',
    unitId,
    startedAt: '2026-08-02T01:00:00.000Z',
    endedAt: '2026-08-02T01:15:00.000Z',
    duration: 15,
  };
}

describe('teaching entry context', () => {
  it('requires both overviews for the first unit of a new project', () => {
    const entry = buildTeachingEntryContext({
      unit: createUnit(),
      completedSessions: [],
    });

    expect(entry.mode).toBe('project_and_unit_overview');
    expect(entry.sequence).toEqual(['project_overview', 'unit_overview', 'diagnostic']);
    expect(entry.sources).toEqual({
      projectOverview: 'README.md',
      unitOverview: 'notes/foundation.md',
    });
  });

  it('requires only the unit overview when starting a later unit', () => {
    const entry = buildTeachingEntryContext({
      unit: createUnit(),
      completedSessions: [createSession('prerequisite')],
    });

    expect(entry.mode).toBe('unit_overview');
    expect(entry.sequence).toEqual(['unit_overview', 'diagnostic']);
  });

  it('uses a brief resume orientation after the unit has a completed session', () => {
    const entry = buildTeachingEntryContext({
      unit: createUnit('learning'),
      completedSessions: [createSession('foundation')],
    });

    expect(entry.mode).toBe('resume');
    expect(entry.sequence).toEqual(['resume_brief', 'diagnostic']);
  });

  it('preserves first-entry guidance for an active session with no completed history', () => {
    const entry = buildTeachingEntryContext({
      unit: createUnit('learning'),
      completedSessions: [],
      activeSession: createSession('foundation'),
    });

    expect(entry.mode).toBe('project_and_unit_overview');
    expect(entry.resumeBriefRequired).toBe(false);
  });
});
