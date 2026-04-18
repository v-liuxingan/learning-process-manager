import fs from 'fs';
import path from 'path';
import type {
  ReviewableItem,
  ReviewIndex,
  ReviewRating,
  OverdueItem,
  ReviewHistory,
  FSRSReviewState,
  EbbinghausReviewState,
} from '../types/index.js';
import {
  createNewReviewState,
  classifyOverdue,
  getOverdueDays,
  createInlineItem,
  createReferenceItem,
} from '../types/index.js';

/**
 * FSRS 算法封装
 */
import { fsrs, Rating, createEmptyCard, type Card } from 'ts-fsrs';

/**
 * 艾宾浩斯固定间隔（天）
 */
const EBBINGHAUS_INTERVALS = [0.5, 1, 3, 7, 14, 30, 90];

/**
 * 间隔重复管理器
 */
export class SpacedRepetitionManager {
  private fsrsInstance: ReturnType<typeof fsrs>;

  constructor() {
    this.fsrsInstance = fsrs();
  }

  /**
   * 计算下次复习日期（FSRS）
   */
  calculateNextReviewFSRS(state: FSRSReviewState, rating: ReviewRating): FSRSReviewState {
    const card: Card = {
      due: new Date(state.due),
      stability: state.stability,
      difficulty: state.difficulty,
      elapsed_days: state.elapsedDays,
      scheduled_days: state.scheduledDays,
      reps: state.reps,
      lapses: state.lapses,
      state: this.mapFSRSState(state.state),
      last_review: new Date(),
    };

    const ratingMap: Record<ReviewRating, Rating> = {
      again: Rating.Again,
      hard: Rating.Hard,
      good: Rating.Good,
      easy: Rating.Easy,
    };

    const ratingValue = ratingMap[rating];
    const schedulingCards = this.fsrsInstance.repeat(card, new Date());
    const result = (schedulingCards as unknown as Record<number, { card: Card }>)[ratingValue];

    return {
      difficulty: result.card.difficulty,
      stability: result.card.stability,
      due: result.card.due.toISOString(),
      elapsedDays: result.card.elapsed_days,
      scheduledDays: result.card.scheduled_days,
      reps: result.card.reps,
      lapses: result.card.lapses,
      state: this.mapFSRSStateReverse(result.card.state),
    };
  }

  /**
   * 计算下次复习日期（艾宾浩斯）
   */
  calculateNextReviewEbbinghaus(
    state: EbbinghausReviewState,
    rating: ReviewRating
  ): EbbinghausReviewState {
    const overdueDays = getOverdueDays(state.nextReviewDate);
    let newCount = state.reviewCount;

    if (rating === 'again') {
      if (overdueDays > 30) {
        newCount = 0;
      } else if (overdueDays > 14) {
        newCount = Math.max(0, state.reviewCount - 3);
      } else {
        newCount = Math.max(0, state.reviewCount - 1);
      }
    } else if (rating === 'good' || rating === 'easy') {
      newCount = Math.min(state.reviewCount + 1, EBBINGHAUS_INTERVALS.length - 1);
    }

    const nextDays = EBBINGHAUS_INTERVALS[newCount];
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + nextDays);

    const completedRounds = newCount >= EBBINGHAUS_INTERVALS.length - 1
      ? state.completedRounds + 1
      : state.completedRounds;

    return {
      reviewCount: newCount,
      nextReviewDate: nextDate.toISOString(),
      lastReviewDate: new Date().toISOString(),
      completedRounds,
    };
  }

  /**
   * 处理复习结果
   */
  processReview(item: ReviewableItem, rating: ReviewRating): ReviewableItem {
    const updatedItem = { ...item };

    if (item.review.algorithm === 'fsrs' && item.review.fsrs) {
      updatedItem.review = {
        algorithm: 'fsrs',
        fsrs: this.calculateNextReviewFSRS(item.review.fsrs, rating),
      };
    } else if (item.review.algorithm === 'ebbinghaus' && item.review.ebbinghaus) {
      updatedItem.review = {
        algorithm: 'ebbinghaus',
        ebbinghaus: this.calculateNextReviewEbbinghaus(item.review.ebbinghaus, rating),
      };
    }

    return updatedItem;
  }

  /**
   * 获取待复习内容
   */
  getDueItems(index: ReviewIndex): ReviewableItem[] {
    const now = new Date();
    return index.items.filter((item) => {
      const dueDate = this.getNextReviewDate(item);
      return dueDate <= now;
    });
  }

  /**
   * 获取过期内容
   */
  getOverdueItems(index: ReviewIndex): OverdueItem[] {
    const now = new Date();
    const overdue: OverdueItem[] = [];

    for (const item of index.items) {
      const dueDate = this.getNextReviewDate(item);
      if (dueDate < now) {
        const overdueDays = getOverdueDays(dueDate);
        overdue.push({
          itemId: item.id,
          type: item.type,
          title: item.title,
          dueDate,
          overdueDays,
          priority: classifyOverdue(overdueDays),
          excerpt: item.excerpt,
        });
      }
    }

    return overdue.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.overdueDays - a.overdueDays;
    });
  }

  /**
   * 获取下次复习日期
   */
  getNextReviewDate(item: ReviewableItem): Date {
    if (item.review.algorithm === 'fsrs' && item.review.fsrs) {
      return new Date(item.review.fsrs.due);
    } else if (item.review.algorithm === 'ebbinghaus' && item.review.ebbinghaus) {
      return new Date(item.review.ebbinghaus.nextReviewDate);
    }
    return new Date();
  }

  /**
   * 创建内联内容复习项（传统方式）
   */
  createInlineReviewItem(
    type: ReviewableItem['type'],
    title: string,
    content: string,
    contentExtra?: string,
    tags: string[] = []
  ): ReviewableItem {
    const id = `inline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    return createInlineItem(id, type, title, content, contentExtra, tags);
  }

  /**
   * 创建引用内容复习项
   */
  createReferenceReviewItem(
    type: ReviewableItem['type'],
    title: string,
    documentPath: string,
    options?: {
      sectionId?: string;
      lineStart?: number;
      lineEnd?: number;
      excerpt?: string;
    },
    tags: string[] = []
  ): ReviewableItem {
    const id = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    return createReferenceItem(id, type, title, documentPath, options, tags);
  }

  /**
   * 获取复习内容（用于 Agent）
   * 根据存储方式返回内容或路径
   */
  getReviewContent(item: ReviewableItem, projectPath: string): {
    storageType: 'inline' | 'reference';
    content?: string;           // 内联内容
    contentExtra?: string;      // 内联附加内容
    documentPath?: string;      // 引用路径
    fullPath?: string;          // 完整文件路径
    lines?: string[];           // 指定行范围的内容
  } {
    if (item.storageType === 'inline' && item.content) {
      return {
        storageType: 'inline',
        content: item.content.content,
        contentExtra: item.content.contentExtra,
      };
    }

    if (item.storageType === 'reference' && item.reference) {
      const ref = item.reference;
      const fullPath = path.join(projectPath, ref.documentPath);

      const result: ReturnType<typeof this.getReviewContent> = {
        storageType: 'reference',
        documentPath: ref.documentPath,
        fullPath,
      };

      // 如果指定了行范围，读取对应内容
      if (ref.lineStart !== undefined && fs.existsSync(fullPath)) {
        const lines = fs.readFileSync(fullPath, 'utf-8').split('\n');
        const end = ref.lineEnd || lines.length;
        result.lines = lines.slice(ref.lineStart - 1, end);
      }

      return result;
    }

    return { storageType: 'inline' };
  }

  /**
   * 映射 FSRS 状态
   */
  private mapFSRSState(state: string): number {
    const stateMap: Record<string, number> = {
      new: 0,
      learning: 1,
      review: 2,
      relearning: 3,
    };
    return stateMap[state] ?? 0;
  }

  /**
   * 反向映射 FSRS 状态
   */
  private mapFSRSStateReverse(state: number): 'new' | 'learning' | 'review' | 'relearning' {
    const stateMap: Record<number, 'new' | 'learning' | 'review' | 'relearning'> = {
      0: 'new',
      1: 'learning',
      2: 'review',
      3: 'relearning',
    };
    return stateMap[state] ?? 'new';
  }
}

/**
 * 复习索引管理器
 */
export class ReviewIndexManager {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  private getIndexPath(): string {
    return path.join(this.projectPath, 'reviews', 'review-index.json');
  }

  loadIndex(): ReviewIndex {
    const indexPath = this.getIndexPath();
    if (fs.existsSync(indexPath)) {
      try {
        const content = fs.readFileSync(indexPath, 'utf-8');
        return JSON.parse(content);
      } catch {
        return { projectId: path.basename(this.projectPath), items: [] };
      }
    }
    return { projectId: path.basename(this.projectPath), items: [] };
  }

  saveIndex(index: ReviewIndex): void {
    const indexPath = this.getIndexPath();
    const dir = path.dirname(indexPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }

  addItem(item: ReviewableItem): void {
    const index = this.loadIndex();
    const existingIndex = index.items.findIndex((i) => i.id === item.id);
    if (existingIndex >= 0) {
      index.items[existingIndex] = item;
    } else {
      index.items.push(item);
    }
    this.saveIndex(index);
  }

  updateItem(item: ReviewableItem): void {
    const index = this.loadIndex();
    const existingIndex = index.items.findIndex((i) => i.id === item.id);
    if (existingIndex >= 0) {
      index.items[existingIndex] = item;
      this.saveIndex(index);
    }
  }

  removeItem(itemId: string): boolean {
    const index = this.loadIndex();
    const existingIndex = index.items.findIndex((i) => i.id === itemId);
    if (existingIndex >= 0) {
      index.items.splice(existingIndex, 1);
      this.saveIndex(index);
      return true;
    }
    return false;
  }

  recordHistory(history: ReviewHistory): void {
    const historyPath = path.join(this.projectPath, 'reviews', 'review-history.json');
    let histories: ReviewHistory[] = [];

    if (fs.existsSync(historyPath)) {
      try {
        histories = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      } catch {
        histories = [];
      }
    }

    histories.push(history);
    fs.writeFileSync(historyPath, JSON.stringify(histories, null, 2), 'utf-8');
  }
}

/**
 * 全局间隔重复管理器实例
 */
let globalSRManager: SpacedRepetitionManager | null = null;

export function getSRManager(): SpacedRepetitionManager {
  if (!globalSRManager) {
    globalSRManager = new SpacedRepetitionManager();
  }
  return globalSRManager;
}

export function resetSRManager(): void {
  globalSRManager = null;
}
