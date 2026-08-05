export type LearningUnitStatus =
  | 'not_started'
  | 'learning'
  | 'assessment_pending'
  | 'consolidating'
  | 'mastered'
  | 'remediation';

export type LearningEvidenceType =
  | 'recall'
  | 'explain'
  | 'apply'
  | 'transfer'
  | 'artifact';

export type LearningEvidenceRole =
  | 'attempt'
  | 'misconception'
  | 'correction'
  | 'verification'
  | 'observation';

export interface LearningEvidence {
  id: string;
  type: LearningEvidenceType;
  role: LearningEvidenceRole;
  summary: string;
  reference?: string;
  observedAt: string;
  independent: boolean;
  delayed: boolean;
  sessionId?: string;
}

export type LearningInteractionType =
  | 'explain'
  | 'scenario'
  | 'predict'
  | 'compare'
  | 'diagnose'
  | 'diagram'
  | 'design'
  | 'confidence'
  | 'delayed_recall';

export type MermaidDiagramType =
  | 'flowchart'
  | 'sequence'
  | 'state'
  | 'class'
  | 'er'
  | 'mindmap';

export interface LearningUnitDiagram {
  id: string;
  title: string;
  purpose: string;
  teachingNodes: string[];
  mermaidType: MermaidDiagramType;
  keyNodes: string[];
  relationships: string[];
  learnerPrompt: string;
  fallback: string;
}

export interface LearningUnitPlan {
  currentObjective?: string;
  completedObjectives: string[];
  pendingObjective?: string;
  allowedScope?: string;
  recommendedInteractionType?: LearningInteractionType;
}

export interface LearningUnit {
  id: string;
  title: string;
  notePath?: string;
  prerequisites: string[];
  status: LearningUnitStatus;
  evidence: LearningEvidence[];
  plan: LearningUnitPlan;
  diagrams: LearningUnitDiagram[];
  nextAction?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LearningUnitIndex {
  version: '1.0';
  projectId: string;
  units: LearningUnit[];
}

export interface LearningUnitStats {
  total: number;
  mastered: number;
  inProgress: number;
  blocked: number;
  progress: number;
}
