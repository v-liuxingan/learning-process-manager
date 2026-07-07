/**
 * 可复习内容类型
 */
export type ReviewableType = 'note' | 'knowledge-point' | 'project' | 'flashcard';

/**
 * 复习评分
 */
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

/**
 * FSRS 复习状态
 */
export interface FSRSReviewState {
  /** 难度 (0-10) */
  difficulty: number;
  /** 稳定性（天数） */
  stability: number;
  /** 下次复习日期 */
  due: string;
  /** 已过天数 */
  elapsedDays: number;
  /** 计划天数 */
  scheduledDays: number;
  /** 复习次数 */
  reps: number;
  /** 遗忘次数 */
  lapses: number;
  /** 学习状态 */
  state: 'new' | 'learning' | 'review' | 'relearning';
}

/**
 * 艾宾浩斯复习状态
 */
export interface EbbinghausReviewState {
  /** 当前轮次 (0-6) */
  reviewCount: number;
  /** 下次复习日期 */
  nextReviewDate: string;
  /** 最后复习日期 */
  lastReviewDate: string;
  /** 完成的完整周期数 */
  completedRounds: number;
}

/**
 * 复习状态
 */
export interface ReviewState {
  /** 算法类型 */
  algorithm: 'fsrs' | 'ebbinghaus';
  /** FSRS 状态 */
  fsrs?: FSRSReviewState;
  /** 艾宾浩斯状态 */
  ebbinghaus?: EbbinghausReviewState;
}

/**
 * 内容来源信息
 */
export interface ContentSource {
  /** 来源笔记 ID */
  noteId?: string;
  /** 创建时间 */
  createdAt: string;
  /** 生成来源（如果是闪卡） */
  generatedFrom?: string;
}

/**
 * 内容存储方式
 */
export type ContentStorageType = 'inline' | 'reference';

/**
 * 内联内容（传统方式：直接存储内容）
 */
export interface InlineContent {
  /** 存储方式：内联 */
  storageType: 'inline';
  /** 内容（如闪卡的正面/背面） */
  content: string;
  /** 附加内容（如闪卡的背面） */
  contentExtra?: string;
}

/**
 * 引用内容（引用式：指向文档路径）
 */
export interface ReferenceContent {
  /** 存储方式：引用 */
  storageType: 'reference';
  /** 文档路径 */
  documentPath: string;
  /** 章节锚点（可选） */
  sectionId?: string;
  /** 起始行（可选） */
  lineStart?: number;
  /** 结束行（可选） */
  lineEnd?: number;
}

/**
 * 可复习内容项（统一结构）
 */
export interface ReviewableItem {
  /** 项目 ID */
  id: string;
  /** 内容类型 */
  type: ReviewableType;
  /** 标题 */
  title: string;

  // ===== 存储内容（两种方式） =====
  /** 内容存储方式 */
  storageType: ContentStorageType;
  /** 内联内容（storageType === 'inline'） */
  content?: InlineContent;
  /** 引用内容（storageType === 'reference'） */
  reference?: ReferenceContent;

  // ===== 元信息 =====
  /** 内容摘要 */
  excerpt?: string;
  /** 标签 */
  tags: string[];
  /** 来源信息 */
  source: ContentSource;
  /** 复习状态 */
  review: ReviewState;
  /** 关联闪卡 ID（仅对 note/knowledge-point 类型） */
  flashcardIds?: string[];
}

/**
 * 复习索引文件结构
 */
export interface ReviewIndex {
  /** 项目 ID */
  projectId: string;
  /** 可复习内容列表 */
  items: ReviewableItem[];
}

/**
 * 过期优先级
 */
export type OverduePriority = 'high' | 'medium' | 'low';

/**
 * 过期内容项
 */
export interface OverdueItem {
  /** 项目 ID */
  itemId: string;
  /** 内容类型 */
  type: ReviewableType;
  /** 标题 */
  title: string;
  /** 到期日期 */
  dueDate: Date;
  /** 过期天数 */
  overdueDays: number;
  /** 优先级 */
  priority: OverduePriority;
  /** 内容摘要 */
  excerpt?: string;
}

/**
 * 复习历史记录
 */
export interface ReviewHistory {
  /** 内容 ID */
  itemId: string;
  /** 复习日期 */
  reviewedAt: string;
  /** 评分 */
  rating: ReviewRating;
  /** 复习前状态 */
  beforeState: ReviewState;
  /** 复习后状态 */
  afterState: ReviewState;
  /** 间隔天数 */
  intervalDays: number;
}

/**
 * 创建新的 FSRS 状态
 */
export function createNewFSRSState(): FSRSReviewState {
  return {
    difficulty: 0,
    stability: 0,
    due: new Date().toISOString(),
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: 'new',
  };
}

/**
 * 创建新的艾宾浩斯状态
 */
export function createNewEbbinghausState(): EbbinghausReviewState {
  return {
    reviewCount: 0,
    nextReviewDate: new Date().toISOString(),
    lastReviewDate: new Date().toISOString(),
    completedRounds: 0,
  };
}

/**
 * 创建新的复习状态
 */
export function createNewReviewState(algorithm: 'fsrs' | 'ebbinghaus' = 'fsrs'): ReviewState {
  return {
    algorithm,
    fsrs: algorithm === 'fsrs' ? createNewFSRSState() : undefined,
    ebbinghaus: algorithm === 'ebbinghaus' ? createNewEbbinghausState() : undefined,
  };
}

/**
 * 分类过期程度
 */
export function classifyOverdue(days: number): OverduePriority {
  if (days > 30) return 'high';
  if (days > 7) return 'medium';
  return 'low';
}

/**
 * 计算过期天数
 */
export function getOverdueDays(dueDate: string | Date): number {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const now = new Date();
  const diffMs = now.getTime() - due.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * 创建内联内容项
 */
export function createInlineItem(
  id: string,
  type: ReviewableType,
  title: string,
  content: string,
  contentExtra?: string,
  tags: string[] = [],
  algorithm: 'fsrs' | 'ebbinghaus' = 'fsrs'
): ReviewableItem {
  return {
    id,
    type,
    title,
    storageType: 'inline',
    content: {
      storageType: 'inline',
      content,
      contentExtra,
    },
    tags,
    source: { createdAt: new Date().toISOString() },
    review: createNewReviewState(algorithm),
  };
}

/**
 * 创建引用内容项
 */
export function createReferenceItem(
  id: string,
  type: ReviewableType,
  title: string,
  documentPath: string,
  options?: {
    sectionId?: string;
    lineStart?: number;
    lineEnd?: number;
    excerpt?: string;
  },
  tags: string[] = [],
  algorithm: 'fsrs' | 'ebbinghaus' = 'fsrs'
): ReviewableItem {
  return {
    id,
    type,
    title,
    storageType: 'reference',
    reference: {
      storageType: 'reference',
      documentPath,
      sectionId: options?.sectionId,
      lineStart: options?.lineStart,
      lineEnd: options?.lineEnd,
    },
    excerpt: options?.excerpt,
    tags,
    source: { createdAt: new Date().toISOString() },
    review: createNewReviewState(algorithm),
  };
}
