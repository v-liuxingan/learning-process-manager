/**
 * 学习阶段定义
 */
export type LearningStage = 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'master';

/**
 * 阶段信息
 */
export const STAGE_INFO: Record<LearningStage, { name: string; emoji: string; description: string }> = {
  novice: { name: '新手', emoji: '🌱', description: '了解基础概念' },
  beginner: { name: '初学者', emoji: '🌿', description: '掌握核心原理' },
  intermediate: { name: '中级', emoji: '🌳', description: '能独立实践' },
  advanced: { name: '高级', emoji: '🏆', description: '深入理解原理' },
  master: { name: '大师', emoji: '👑', description: '创新与教授他人' },
};

/**
 * 项目元数据
 */
export interface ProjectMeta {
  /** 项目名称 */
  name: string;
  /** 项目路径 */
  path: string;
  /** 学习主题 */
  topic: string;
  /** 当前学习阶段 */
  stage: LearningStage;
  /** 进度百分比 (0-100) */
  progress: number;
  /** 总学习时长（小时） */
  totalHours: number;
  /** 最后学习日期 */
  lastStudyDate: string;
  /** 下次复习日期 */
  nextReviewDate: string;
  /** 已完成主题数 */
  topicsCompleted: number;
  /** 总主题数 */
  topicsTotal: number;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 用户设置
 */
export interface UserSettings {
  /** 默认项目目录 */
  defaultProjectsDir: string;
  /** 复习算法 */
  reviewAlgorithm: 'fsrs' | 'ebbinghaus';
  /** 艾宾浩斯间隔天数 */
  ebbinghausIntervals: number[];
  /** 时区 */
  timezone: string;
}

/**
 * 项目索引文件结构
 */
export interface ProjectIndex {
  /** 版本号 */
  version: string;
  /** 项目列表 */
  projects: ProjectMeta[];
  /** 用户设置 */
  settings: UserSettings;
}

/**
 * 默认用户设置
 */
export const DEFAULT_SETTINGS: UserSettings = {
  defaultProjectsDir: './learning-projects',
  reviewAlgorithm: 'fsrs',
  ebbinghausIntervals: [0.5, 1, 3, 7, 14, 30, 90],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

/**
 * 默认项目索引
 */
export const DEFAULT_PROJECT_INDEX: ProjectIndex = {
  version: '1.0',
  projects: [],
  settings: DEFAULT_SETTINGS,
};
