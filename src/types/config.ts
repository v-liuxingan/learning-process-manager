import { z } from 'zod';

/**
 * 学习阶段 Schema
 */
export const LearningStageSchema = z.enum(['novice', 'beginner', 'intermediate', 'advanced', 'master']);

/**
 * 复习算法 Schema
 */
export const ReviewAlgorithmSchema = z.enum(['fsrs', 'ebbinghaus']);

/**
 * 用户设置 Schema
 */
export const UserSettingsSchema = z.object({
  defaultProjectsDir: z.string().default('./learning-projects'),
  reviewAlgorithm: ReviewAlgorithmSchema.default('fsrs'),
  ebbinghausIntervals: z.array(z.number()).default([0.5, 1, 3, 7, 14, 30, 90]),
  timezone: z.string().default(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
});

/**
 * 项目元数据 Schema
 */
export const ProjectMetaSchema = z.object({
  name: z.string(),
  path: z.string(),
  topic: z.string(),
  stage: LearningStageSchema.default('novice'),
  progress: z.number().min(0).max(100).default(0),
  totalHours: z.number().default(0),
  lastStudyDate: z.string().optional(),
  nextReviewDate: z.string().optional(),
  topicsCompleted: z.number().default(0),
  topicsTotal: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * 项目索引 Schema
 */
export const ProjectIndexSchema = z.object({
  version: z.string().default('1.0'),
  projects: z.array(ProjectMetaSchema).default([]),
  settings: UserSettingsSchema.default({}),
});

/**
 * 可复习内容类型 Schema
 */
export const ReviewableTypeSchema = z.enum(['note', 'knowledge-point', 'project', 'flashcard']);

/**
 * 复习评分 Schema
 */
export const ReviewRatingSchema = z.enum(['again', 'hard', 'good', 'easy']);

/**
 * FSRS 状态 Schema
 */
export const FSRSReviewStateSchema = z.object({
  difficulty: z.number(),
  stability: z.number(),
  due: z.string(),
  elapsedDays: z.number(),
  scheduledDays: z.number(),
  reps: z.number(),
  lapses: z.number(),
  state: z.enum(['new', 'learning', 'review', 'relearning']),
});

/**
 * 艾宾浩斯状态 Schema
 */
export const EbbinghausReviewStateSchema = z.object({
  reviewCount: z.number(),
  nextReviewDate: z.string(),
  lastReviewDate: z.string(),
  completedRounds: z.number(),
});

/**
 * 复习状态 Schema
 */
export const ReviewStateSchema = z.object({
  algorithm: ReviewAlgorithmSchema,
  fsrs: FSRSReviewStateSchema.optional(),
  ebbinghaus: EbbinghausReviewStateSchema.optional(),
});

/**
 * 可复习内容项 Schema
 */
export const ReviewableItemSchema = z.object({
  id: z.string(),
  type: ReviewableTypeSchema,
  title: z.string(),
  contentPath: z.string(),
  excerpt: z.string().optional(),
  tags: z.array(z.string()).default([]),
  source: z.object({
    noteId: z.string().optional(),
    createdAt: z.string(),
    generatedFrom: z.string().optional(),
  }),
  review: ReviewStateSchema,
  flashcardIds: z.array(z.string()).optional(),
});

/**
 * 复习索引 Schema
 */
export const ReviewIndexSchema = z.object({
  projectId: z.string(),
  items: z.array(ReviewableItemSchema).default([]),
});

/**
 * CLI 输出选项 Schema
 */
export const OutputOptionsSchema = z.object({
  json: z.boolean().default(false),
  porcelain: z.boolean().default(false),
  quiet: z.boolean().default(false),
});

/**
 * 类型导出
 */
export type UserSettingsInput = z.infer<typeof UserSettingsSchema>;
export type ProjectMetaInput = z.infer<typeof ProjectMetaSchema>;
export type ProjectIndexInput = z.infer<typeof ProjectIndexSchema>;
export type OutputOptions = z.infer<typeof OutputOptionsSchema>;
