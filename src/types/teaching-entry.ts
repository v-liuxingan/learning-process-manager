export type TeachingEntryMode =
  | 'project_and_unit_overview'
  | 'project_overview'
  | 'unit_overview'
  | 'resume'
  | 'none';

export type TeachingEntryStep =
  | 'project_overview'
  | 'unit_overview'
  | 'resume_brief'
  | 'diagnostic';

export interface TeachingEntryContext {
  mode: TeachingEntryMode;
  projectOverviewRequired: boolean;
  unitOverviewRequired: boolean;
  resumeBriefRequired: boolean;
  sources: {
    projectOverview: 'README.md';
    unitOverview?: string;
  };
  sequence: TeachingEntryStep[];
}
