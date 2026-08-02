import type {
  LearningUnit,
  StudySession,
  TeachingEntryContext,
  TeachingEntryMode,
  TeachingEntryStep,
} from '../types/index.js';

export function buildTeachingEntryContext(options: {
  unit: LearningUnit | null;
  completedSessions: StudySession[];
  activeSession?: StudySession | null;
}): TeachingEntryContext {
  const { unit, completedSessions, activeSession = null } = options;
  const projectOverviewRequired = completedSessions.length === 0;
  const completedUnitSessions = unit
    ? completedSessions.filter((session) => session.unitId === unit.id)
    : [];
  const unitOverviewRequired = Boolean(
    unit
    && completedUnitSessions.length === 0
    && ['not_started', 'learning'].includes(unit.status)
  );
  const resumeBriefRequired = Boolean(
    unit
    && !unitOverviewRequired
    && (
      completedUnitSessions.length > 0
      || activeSession?.unitId === unit.id
      || unit.status !== 'not_started'
    )
  );

  let mode: TeachingEntryMode = 'none';
  if (projectOverviewRequired && unitOverviewRequired) mode = 'project_and_unit_overview';
  else if (projectOverviewRequired) mode = 'project_overview';
  else if (unitOverviewRequired) mode = 'unit_overview';
  else if (resumeBriefRequired) mode = 'resume';

  const sequence: TeachingEntryStep[] = [];
  if (projectOverviewRequired) sequence.push('project_overview');
  if (unitOverviewRequired) sequence.push('unit_overview');
  if (resumeBriefRequired) sequence.push('resume_brief');
  if (unit) sequence.push('diagnostic');

  return {
    mode,
    projectOverviewRequired,
    unitOverviewRequired,
    resumeBriefRequired,
    sources: {
      projectOverview: 'README.md',
      unitOverview: unit?.notePath,
    },
    sequence,
  };
}
