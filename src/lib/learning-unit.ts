import fs from 'fs';
import path from 'path';
import type {
  LearningEvidence,
  LearningEvidenceRole,
  LearningEvidenceType,
  LearningUnit,
  LearningUnitIndex,
  LearningUnitStats,
  LearningUnitStatus,
} from '../types/index.js';
import { withFileLock, writeJsonAtomic, writeTextAtomic } from './file-utils.js';

const UNIT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

const ALLOWED_TRANSITIONS: Record<LearningUnitStatus, LearningUnitStatus[]> = {
  not_started: ['learning'],
  learning: ['assessment_pending', 'remediation'],
  assessment_pending: ['consolidating', 'remediation', 'learning'],
  consolidating: ['mastered', 'remediation'],
  mastered: ['remediation'],
  remediation: ['learning', 'assessment_pending'],
};

export class LearningUnitManager {
  private readonly indexPath: string;

  constructor(
    private readonly projectPath: string,
    private readonly projectId: string
  ) {
    this.indexPath = path.join(projectPath, 'learning-units.json');
  }

  ensureIndex(): LearningUnitIndex {
    if (!fs.existsSync(this.indexPath)) {
      const index = this.emptyIndex();
      writeJsonAtomic(this.indexPath, index);
      return index;
    }
    return this.loadIndex();
  }

  loadIndex(): LearningUnitIndex {
    if (!fs.existsSync(this.indexPath)) {
      return this.emptyIndex();
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.indexPath, 'utf-8')) as Partial<LearningUnitIndex>;
      return {
        version: '1.0',
        projectId: parsed.projectId ?? this.projectId,
        units: Array.isArray(parsed.units)
          ? parsed.units.map((unit) => ({
              ...unit,
              prerequisites: Array.isArray(unit.prerequisites) ? unit.prerequisites : [],
              evidence: Array.isArray(unit.evidence)
                ? unit.evidence.map((item) => ({ ...item, role: item.role ?? 'verification' }))
                : [],
            }))
          : [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown parse error';
      throw new Error(`Failed to load learning units at "${this.indexPath}": ${message}`, {
        cause: error,
      });
    }
  }

  addUnit(options: {
    id: string;
    title: string;
    notePath?: string;
    prerequisites?: string[];
    nextAction?: string;
  }): LearningUnit {
    this.validateUnitId(options.id);
    const prerequisites = [...new Set(options.prerequisites ?? [])];
    if (prerequisites.includes(options.id)) {
      throw new Error('A learning unit cannot depend on itself');
    }
    if (!options.title.trim()) {
      throw new Error('Learning unit title cannot be empty');
    }
    if (options.notePath) {
      this.resolveProjectFile(options.notePath);
    }

    return withFileLock(this.indexPath, () => {
      const index = this.loadIndex();
      if (index.units.some((unit) => unit.id === options.id)) {
        throw new Error(`Learning unit "${options.id}" already exists`);
      }
      const missingPrerequisites = prerequisites.filter(
        (id) => !index.units.some((unit) => unit.id === id)
      );
      if (missingPrerequisites.length > 0) {
        throw new Error(`Prerequisite units do not exist: ${missingPrerequisites.join(', ')}`);
      }

      const now = new Date().toISOString();
      const unit: LearningUnit = {
        id: options.id,
        title: options.title.trim(),
        notePath: options.notePath,
        prerequisites,
        status: 'not_started',
        evidence: [],
        nextAction: options.nextAction,
        createdAt: now,
        updatedAt: now,
      };
      index.units.push(unit);
      writeJsonAtomic(this.indexPath, index);
      return unit;
    });
  }

  getUnit(id: string): LearningUnit | undefined {
    return this.loadIndex().units.find((unit) => unit.id === id);
  }

  transition(id: string, target: LearningUnitStatus): LearningUnit {
    return withFileLock(this.indexPath, () => {
      const index = this.loadIndex();
      const unit = index.units.find((item) => item.id === id);
      if (!unit) {
        throw new Error(`Learning unit "${id}" does not exist`);
      }
      if (unit.status === target) {
        return unit;
      }
      if (!ALLOWED_TRANSITIONS[unit.status].includes(target)) {
        throw new Error(`Invalid learning unit transition: ${unit.status} -> ${target}`);
      }

      this.validateTransition(index, unit, target);
      unit.status = target;
      unit.updatedAt = new Date().toISOString();
      writeJsonAtomic(this.indexPath, index);
      return unit;
    });
  }

  addEvidence(id: string, options: {
    type: LearningEvidenceType;
    role?: LearningEvidenceRole;
    summary: string;
    reference?: string;
    independent?: boolean;
    delayed?: boolean;
    sessionId?: string;
  }): { unit: LearningUnit; evidence: LearningEvidence } {
    if (!options.summary.trim()) {
      throw new Error('Evidence summary cannot be empty');
    }

    const existingUnit = this.getUnit(id);
    if (!existingUnit) {
      throw new Error(`Learning unit "${id}" does not exist`);
    }
    if (existingUnit.notePath) {
      const notePath = this.resolveProjectFile(existingUnit.notePath);
      if (!fs.existsSync(notePath)) {
        throw new Error(`Learning unit note does not exist: ${existingUnit.notePath}`);
      }
    }

    const result = withFileLock(this.indexPath, () => {
      const index = this.loadIndex();
      const unit = index.units.find((item) => item.id === id);
      if (!unit) {
        throw new Error(`Learning unit "${id}" does not exist`);
      }

      const observedAt = new Date().toISOString();
      const evidence: LearningEvidence = {
        id: `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: options.type,
        role: options.role ?? 'verification',
        summary: options.summary.trim(),
        reference: options.reference,
        observedAt,
        independent: options.independent ?? true,
        delayed: options.delayed ?? false,
        sessionId: options.sessionId,
      };
      unit.evidence.push(evidence);
      unit.updatedAt = observedAt;
      writeJsonAtomic(this.indexPath, index);
      return { unit, evidence };
    });

    if (result.unit.notePath) {
      try {
        this.appendEvidenceToNote(result.unit, result.evidence);
      } catch (error) {
        withFileLock(this.indexPath, () => {
          const index = this.loadIndex();
          const unit = index.units.find((item) => item.id === id);
          if (unit) {
            unit.evidence = unit.evidence.filter((item) => item.id !== result.evidence.id);
            unit.updatedAt = new Date().toISOString();
            writeJsonAtomic(this.indexPath, index);
          }
        });
        throw error;
      }
    }
    return result;
  }

  getNextUnit(): LearningUnit | null {
    const index = this.loadIndex();
    const priority: LearningUnitStatus[] = [
      'remediation',
      'learning',
      'assessment_pending',
      'consolidating',
    ];
    for (const status of priority) {
      const unit = index.units.find((item) => item.status === status);
      if (unit) return unit;
    }

    return index.units.find((unit) =>
      unit.status === 'not_started'
      && unit.prerequisites.every((id) => index.units.some(
        (candidate) => candidate.id === id && candidate.status === 'mastered'
      ))
    ) ?? null;
  }

  getStats(): LearningUnitStats {
    const units = this.loadIndex().units;
    const mastered = units.filter((unit) => unit.status === 'mastered').length;
    const inProgress = units.filter((unit) => [
      'learning',
      'assessment_pending',
      'consolidating',
    ].includes(unit.status)).length;
    const blocked = units.filter((unit) => unit.status === 'remediation').length;
    return {
      total: units.length,
      mastered,
      inProgress,
      blocked,
      progress: units.length === 0 ? 0 : Math.round((mastered / units.length) * 100),
    };
  }

  private emptyIndex(): LearningUnitIndex {
    return { version: '1.0', projectId: this.projectId, units: [] };
  }

  private validateUnitId(id: string): void {
    if (!UNIT_ID_PATTERN.test(id)) {
      throw new Error('Learning unit id must contain only lowercase letters, numbers, hyphens, or underscores');
    }
  }

  private validateTransition(
    index: LearningUnitIndex,
    unit: LearningUnit,
    target: LearningUnitStatus
  ): void {
    if (target === 'learning') {
      const incomplete = unit.prerequisites.filter((id) => !index.units.some(
        (candidate) => candidate.id === id && candidate.status === 'mastered'
      ));
      if (incomplete.length > 0) {
        throw new Error(`Prerequisites are not mastered: ${incomplete.join(', ')}`);
      }
    }

    if (target === 'consolidating') {
      const countsForMastery = (item: LearningEvidence): boolean =>
        item.independent && ['correction', 'verification'].includes(item.role);
      const hasExplain = unit.evidence.some((item) => item.type === 'explain' && countsForMastery(item));
      const hasApply = unit.evidence.some((item) => item.type === 'apply' && countsForMastery(item));
      if (!hasExplain || !hasApply) {
        throw new Error('Consolidating requires independent explain and apply evidence');
      }
    }

    if (target === 'mastered') {
      const hasDelayedEvidence = unit.evidence.some((item) =>
        item.delayed
        && item.independent
        && ['correction', 'verification'].includes(item.role)
        && ['explain', 'apply', 'transfer', 'artifact'].includes(item.type)
      );
      if (!hasDelayedEvidence) {
        throw new Error('Mastered requires delayed independent evidence');
      }
    }
  }

  private resolveProjectFile(relativePath: string): string {
    if (path.isAbsolute(relativePath)) {
      throw new Error('Learning unit note path must be relative to the project');
    }
    const root = path.resolve(this.projectPath);
    const resolved = path.resolve(root, relativePath);
    const relative = path.relative(root, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Learning unit note path must stay inside the project');
    }
    return resolved;
  }

  private appendEvidenceToNote(unit: LearningUnit, evidence: LearningEvidence): void {
    const notePath = this.resolveProjectFile(unit.notePath!);
    if (!fs.existsSync(notePath)) {
      throw new Error(`Learning unit note does not exist: ${unit.notePath}`);
    }

    withFileLock(notePath, () => {
      const current = fs.readFileSync(notePath, 'utf-8').trimEnd();
      const heading = current.includes('## 学习证据') ? '' : '\n\n## 学习证据';
      const entry = [
        `### ${evidence.observedAt} · ${evidence.type}`,
        '',
        `- 证据：${evidence.summary}`,
        `- 角色：${evidence.role}`,
        `- 独立完成：${evidence.independent ? '是' : '否'}`,
        `- 延迟验证：${evidence.delayed ? '是' : '否'}`,
        evidence.reference ? `- 引用：${evidence.reference}` : '',
        evidence.sessionId ? `- 会话：${evidence.sessionId}` : '',
      ].filter(Boolean).join('\n');
      writeTextAtomic(notePath, `${current}${heading}\n\n${entry}\n`);
    });
  }
}
