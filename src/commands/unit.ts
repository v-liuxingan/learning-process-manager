import type { Command } from 'commander';
import { LearningUnitManager } from '../lib/learning-unit.js';
import { getProjectManager } from '../lib/project.js';
import type {
  LearningEvidenceRole,
  LearningEvidenceType,
  LearningInteractionType,
  MermaidDiagramType,
  LearningUnitStatus,
} from '../types/index.js';

type GlobalOptions = { json?: boolean };

const UNIT_STATUSES: LearningUnitStatus[] = [
  'not_started',
  'learning',
  'assessment_pending',
  'consolidating',
  'mastered',
  'remediation',
];

const EVIDENCE_TYPES: LearningEvidenceType[] = [
  'recall',
  'explain',
  'apply',
  'transfer',
  'artifact',
];

const EVIDENCE_ROLES: LearningEvidenceRole[] = [
  'attempt',
  'misconception',
  'correction',
  'verification',
  'observation',
];

const INTERACTION_TYPES: LearningInteractionType[] = [
  'explain',
  'scenario',
  'predict',
  'compare',
  'diagnose',
  'diagram',
  'design',
  'confidence',
  'delayed_recall',
];

const MERMAID_TYPES: MermaidDiagramType[] = [
  'flowchart',
  'sequence',
  'state',
  'class',
  'er',
  'mindmap',
];

function outputJson(command: string, status: 'success' | 'error', data?: unknown, error?: string): void {
  console.log(JSON.stringify({
    version: '1.0',
    timestamp: new Date().toISOString(),
    command,
    status,
    data,
    error: error ? { code: 'UNIT_ERROR', message: error } : undefined,
  }, null, 2));
}

function getContext(projectName: string): {
  project: ReturnType<ReturnType<typeof getProjectManager>['getProject']>;
  units: LearningUnitManager;
} {
  const manager = getProjectManager();
  const project = manager.getProject(projectName);
  if (!project) {
    throw new Error(`Project "${projectName}" does not exist`);
  }
  return { project, units: new LearningUnitManager(project.path, project.name) };
}

function syncProjectProgress(projectName: string, units: LearningUnitManager): void {
  const stats = units.getStats();
  getProjectManager().updateProgress(projectName, {
    topicsCompleted: stats.mastered,
    topicsTotal: stats.total,
    touchLastStudyDate: false,
  });
}

function parseList(value?: string): string[] {
  return value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
}

export function registerUnitCommand(program: Command): void {
  const unit = program.command('unit').description('Manage learning units and mastery evidence');

  unit
    .command('add')
    .requiredOption('-p, --project <name>', 'Project name')
    .requiredOption('--id <id>', 'Stable unit id')
    .requiredOption('--title <title>', 'Unit title')
    .option('--note <path>', 'Project-relative note path')
    .option('--prerequisites <ids>', 'Comma-separated prerequisite unit ids')
    .option('--next-action <text>', 'Next concrete learning action')
    .option('--current-objective <text>', 'Current learning objective')
    .option('--pending-objective <text>', 'Pending learning objective')
    .option('--allowed-scope <text>', 'Allowed scope for continue/resume behavior')
    .option('--interaction <type>', `Recommended interaction type (${INTERACTION_TYPES.join('|')})`)
    .action((options: {
      project: string;
      id: string;
      title: string;
      note?: string;
      prerequisites?: string;
      nextAction?: string;
      currentObjective?: string;
      pendingObjective?: string;
      allowedScope?: string;
      interaction?: string;
    }, cmd) => {
      const global = cmd.optsWithGlobals() as GlobalOptions;
      try {
        const { units } = getContext(options.project);
        if (options.interaction && !INTERACTION_TYPES.includes(options.interaction as LearningInteractionType)) {
          throw new Error(`Unknown interaction type: ${options.interaction}`);
        }
        const created = units.addUnit({
          id: options.id,
          title: options.title,
          notePath: options.note,
          prerequisites: options.prerequisites
            ?.split(',')
            .map((value) => value.trim())
            .filter(Boolean),
          nextAction: options.nextAction,
          currentObjective: options.currentObjective,
          pendingObjective: options.pendingObjective,
          allowedScope: options.allowedScope,
          recommendedInteractionType: options.interaction as LearningInteractionType | undefined,
        });
        syncProjectProgress(options.project, units);
        if (global.json) outputJson('unit add', 'success', { unit: created, stats: units.getStats() });
        else console.log(`Added learning unit: ${created.id} (${created.title})`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add learning unit';
        if (global.json) outputJson('unit add', 'error', undefined, message);
        else console.error(`Failed to add learning unit: ${message}`);
        process.exit(1);
      }
    });

  unit
    .command('plan')
    .requiredOption('-p, --project <name>', 'Project name')
    .requiredOption('--unit <id>', 'Learning unit id')
    .option('--current-objective <text>', 'Current learning objective')
    .option('--completed-objective <text>', 'Completed objective to append')
    .option('--pending-objective <text>', 'Pending learning objective')
    .option('--allowed-scope <text>', 'Allowed scope for continue/resume behavior')
    .option('--interaction <type>', `Recommended interaction type (${INTERACTION_TYPES.join('|')})`)
    .option('--next-action <text>', 'Next concrete learning action')
    .action((options: {
      project: string;
      unit: string;
      currentObjective?: string;
      completedObjective?: string;
      pendingObjective?: string;
      allowedScope?: string;
      interaction?: string;
      nextAction?: string;
    }, cmd) => {
      const global = cmd.optsWithGlobals() as GlobalOptions;
      try {
        if (options.interaction && !INTERACTION_TYPES.includes(options.interaction as LearningInteractionType)) {
          throw new Error(`Unknown interaction type: ${options.interaction}`);
        }
        const { units } = getContext(options.project);
        const updated = units.updatePlan(options.unit, {
          currentObjective: options.currentObjective,
          completedObjective: options.completedObjective,
          pendingObjective: options.pendingObjective,
          allowedScope: options.allowedScope,
          recommendedInteractionType: options.interaction as LearningInteractionType | undefined,
          nextAction: options.nextAction,
        });
        if (global.json) outputJson('unit plan', 'success', { unit: updated });
        else console.log(`Updated learning unit plan: ${updated.id}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update learning unit plan';
        if (global.json) outputJson('unit plan', 'error', undefined, message);
        else console.error(`Failed to update learning unit plan: ${message}`);
        process.exit(1);
      }
    });

  const diagram = unit.command('diagram').description('Manage teaching diagrams for a learning unit');

  diagram
    .command('add')
    .requiredOption('-p, --project <name>', 'Project name')
    .requiredOption('--unit <id>', 'Learning unit id')
    .requiredOption('--id <id>', 'Stable diagram id')
    .requiredOption('--title <title>', 'Diagram title')
    .requiredOption('--purpose <text>', 'Teaching purpose')
    .requiredOption('--mermaid <type>', `Mermaid type (${MERMAID_TYPES.join('|')})`)
    .requiredOption('--prompt <text>', 'Learner-facing reading prompt')
    .requiredOption('--fallback <text>', 'Text fallback when diagrams cannot render')
    .option('--nodes <items>', 'Comma-separated key nodes')
    .option('--relations <items>', 'Comma-separated relationships')
    .option('--teaching-nodes <items>', 'Comma-separated teaching nodes where the diagram applies')
    .action((options: {
      project: string;
      unit: string;
      id: string;
      title: string;
      purpose: string;
      mermaid: string;
      prompt: string;
      fallback: string;
      nodes?: string;
      relations?: string;
      teachingNodes?: string;
    }, cmd) => {
      const global = cmd.optsWithGlobals() as GlobalOptions;
      try {
        if (!MERMAID_TYPES.includes(options.mermaid as MermaidDiagramType)) {
          throw new Error(`Unknown Mermaid diagram type: ${options.mermaid}`);
        }
        const { units } = getContext(options.project);
        const created = units.addDiagram(options.unit, {
          diagramId: options.id,
          title: options.title,
          purpose: options.purpose,
          mermaidType: options.mermaid as MermaidDiagramType,
          keyNodes: parseList(options.nodes),
          relationships: parseList(options.relations),
          teachingNodes: parseList(options.teachingNodes),
          learnerPrompt: options.prompt,
          fallback: options.fallback,
        });
        if (global.json) outputJson('unit diagram add', 'success', { diagram: created });
        else console.log(`Added learning unit diagram: ${created.id}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add learning unit diagram';
        if (global.json) outputJson('unit diagram add', 'error', undefined, message);
        else console.error(`Failed to add learning unit diagram: ${message}`);
        process.exit(1);
      }
    });

  unit
    .command('list')
    .requiredOption('-p, --project <name>', 'Project name')
    .action((options: { project: string }, cmd) => {
      const global = cmd.optsWithGlobals() as GlobalOptions;
      try {
        const { units } = getContext(options.project);
        const index = units.loadIndex();
        const data = { units: index.units, stats: units.getStats(), nextUnit: units.getNextUnit() };
        if (global.json) outputJson('unit list', 'success', data);
        else {
          if (index.units.length === 0) console.log('No learning units are registered.');
          else index.units.forEach((item) => console.log(`${item.id}\t${item.status}\t${item.title}`));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to list learning units';
        if (global.json) outputJson('unit list', 'error', undefined, message);
        else console.error(`Failed to list learning units: ${message}`);
        process.exit(1);
      }
    });

  unit
    .command('next')
    .requiredOption('-p, --project <name>', 'Project name')
    .action((options: { project: string }, cmd) => {
      const global = cmd.optsWithGlobals() as GlobalOptions;
      try {
        const { units } = getContext(options.project);
        const nextUnit = units.getNextUnit();
        if (global.json) outputJson('unit next', 'success', { unit: nextUnit, stats: units.getStats() });
        else console.log(nextUnit ? `${nextUnit.id}\t${nextUnit.status}\t${nextUnit.title}` : 'No actionable learning unit.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to select next learning unit';
        if (global.json) outputJson('unit next', 'error', undefined, message);
        else console.error(`Failed to select next learning unit: ${message}`);
        process.exit(1);
      }
    });

  unit
    .command('transition')
    .requiredOption('-p, --project <name>', 'Project name')
    .requiredOption('--unit <id>', 'Learning unit id')
    .requiredOption('--to <status>', `Target status (${UNIT_STATUSES.join('|')})`)
    .action((options: { project: string; unit: string; to: string }, cmd) => {
      const global = cmd.optsWithGlobals() as GlobalOptions;
      try {
        if (!UNIT_STATUSES.includes(options.to as LearningUnitStatus)) {
          throw new Error(`Unknown learning unit status: ${options.to}`);
        }
        const { units } = getContext(options.project);
        const updated = units.transition(options.unit, options.to as LearningUnitStatus);
        syncProjectProgress(options.project, units);
        if (global.json) outputJson('unit transition', 'success', { unit: updated, stats: units.getStats() });
        else console.log(`Learning unit ${updated.id}: ${updated.status}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to transition learning unit';
        if (global.json) outputJson('unit transition', 'error', undefined, message);
        else console.error(`Failed to transition learning unit: ${message}`);
        process.exit(1);
      }
    });

  unit
    .command('evidence')
    .requiredOption('-p, --project <name>', 'Project name')
    .requiredOption('--unit <id>', 'Learning unit id')
    .requiredOption('--type <type>', `Evidence type (${EVIDENCE_TYPES.join('|')})`)
    .requiredOption('--summary <text>', 'Short evidence summary')
    .option('--role <role>', `Evidence role (${EVIDENCE_ROLES.join('|')})`, 'verification')
    .option('--reference <ref>', 'Artifact, note anchor, or command output reference')
    .option('--assisted', 'Evidence required prompting or assistance')
    .option('--delayed', 'Evidence was collected after a time interval')
    .option('--session <id>', 'Related session id')
    .action((options: {
      project: string;
      unit: string;
      type: string;
      summary: string;
      role: string;
      reference?: string;
      assisted?: boolean;
      delayed?: boolean;
      session?: string;
    }, cmd) => {
      const global = cmd.optsWithGlobals() as GlobalOptions;
      try {
        if (!EVIDENCE_TYPES.includes(options.type as LearningEvidenceType)) {
          throw new Error(`Unknown evidence type: ${options.type}`);
        }
        if (!EVIDENCE_ROLES.includes(options.role as LearningEvidenceRole)) {
          throw new Error(`Unknown evidence role: ${options.role}`);
        }
        const { units } = getContext(options.project);
        const result = units.addEvidence(options.unit, {
          type: options.type as LearningEvidenceType,
          role: options.role as LearningEvidenceRole,
          summary: options.summary,
          reference: options.reference,
          independent: !options.assisted,
          delayed: options.delayed,
          sessionId: options.session,
        });
        if (global.json) outputJson('unit evidence', 'success', result);
        else console.log(`Added ${result.evidence.type} evidence to ${result.unit.id}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add learning evidence';
        if (global.json) outputJson('unit evidence', 'error', undefined, message);
        else console.error(`Failed to add learning evidence: ${message}`);
        process.exit(1);
      }
    });
}
