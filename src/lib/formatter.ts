import chalk from 'chalk';
import type {
  ProjectMeta,
  ProjectIndex,
  ReviewableItem,
  OverdueItem,
  LearningStats,
  AgentOutput,
} from '../types/index.js';
import { STAGE_INFO } from '../types/index.js';
import { createAgentOutput } from '../types/common.js';

/**
 * 输出格式化器
 */
export class Formatter {
  private json: boolean;

  constructor(options?: { json?: boolean }) {
    this.json = options?.json ?? false;
  }

  /**
   * 格式化项目列表
   */
  formatProjectList(projects: ProjectMeta[]): string | AgentOutput<ProjectMeta[]> {
    if (this.json) {
      return createAgentOutput('list', projects, {
        context: {
          nextActions: projects.length === 0
            ? ['运行 "learn new <主题>" 创建第一个学习项目']
            : [`运行 "learn progress ${projects[0].name}" 查看项目详情`],
        },
      });
    }

    if (projects.length === 0) {
      return '暂无学习项目。运行 "learn new <主题>" 创建第一个学习项目。';
    }

    const lines: string[] = [
      chalk.bold('📚 学习项目列表\n'),
    ];

    for (const project of projects) {
      const stage = STAGE_INFO[project.stage];
      const progress = this.formatProgressBar(project.progress);
      const lastStudy = project.lastStudyDate
        ? `最后学习: ${this.formatDate(project.lastStudyDate)}`
        : '未开始';

      lines.push(
        `${stage.emoji} ${chalk.bold(project.name)} ${chalk.gray(`(${project.topic})`)}`,
        `   ${progress} ${stage.name}`,
        `   ${chalk.gray(lastStudy)} | ${chalk.gray(`${project.totalHours.toFixed(1)} 小时`)}`,
        ''
      );
    }

    return lines.join('\n');
  }

  /**
   * 格式化项目进度
   */
  formatProjectProgress(project: ProjectMeta, reviewStats?: {
    due: number;
    overdue: number;
  }): string | AgentOutput<ProjectMeta & { reviews?: typeof reviewStats }> {
    if (this.json) {
      const data = {
        ...project,
        reviews: reviewStats,
      };
      return createAgentOutput('progress', data, {
        context: {
          project: project.name,
          stage: project.stage,
          nextActions: this.getNextActions(project, reviewStats),
        },
      });
    }

    const stage = STAGE_INFO[project.stage];
    const progress = this.formatProgressBar(project.progress);

    const lines: string[] = [
      chalk.bold(`${stage.emoji} ${project.name}`),
      chalk.gray(`主题: ${project.topic}`),
      '',
      chalk.bold('📊 学习进度'),
      `${progress} ${project.progress}%`,
      `阶段: ${stage.emoji} ${stage.name} - ${stage.description}`,
      '',
      chalk.bold('📈 学习统计'),
      `总时长: ${project.totalHours.toFixed(1)} 小时`,
      `完成主题: ${project.topicsCompleted}/${project.topicsTotal}`,
    ];

    if (project.lastStudyDate) {
      lines.push(`最后学习: ${this.formatDate(project.lastStudyDate)}`);
    }

    if (reviewStats) {
      lines.push('');
      lines.push(chalk.bold('🔄 复习状态'));
      lines.push(`待复习: ${reviewStats.due} 项`);
      if (reviewStats.overdue > 0) {
        lines.push(`过期: ${chalk.red(reviewStats.overdue + ' 项')}`);
      }
    }

    lines.push('');
    lines.push(chalk.bold('💡 建议操作'));
    lines.push(...this.getNextActions(project, reviewStats).map((a) => `  • ${a}`));

    return lines.join('\n');
  }

  /**
   * 格式化待复习内容
   */
  formatDueReviews(items: ReviewableItem[]): string | AgentOutput<{ total: number; items: ReviewableItem[] }> {
    if (this.json) {
      return createAgentOutput('review', { total: items.length, items }, {
        context: {
          nextActions: items.length > 0
            ? ['运行 "learn review" 开始复习']
            : ['暂无待复习内容，继续学习吧！'],
        },
      });
    }

    if (items.length === 0) {
      return '🎉 暂无待复习内容，继续学习吧！';
    }

    const typeEmoji: Record<string, string> = {
      note: '📝',
      'knowledge-point': '💡',
      project: '🎯',
      flashcard: '🃏',
    };

    const lines: string[] = [
      chalk.bold(`📚 待复习内容 (${items.length} 项)\n`),
    ];

    for (const item of items) {
      const emoji = typeEmoji[item.type] ?? '📄';
      lines.push(`${emoji} ${item.title}`);
      if (item.excerpt) {
        lines.push(chalk.gray(`   ${item.excerpt.slice(0, 50)}...`));
      }
    }

    lines.push('');
    lines.push(chalk.gray('运行 "learn review" 开始复习'));

    return lines.join('\n');
  }

  /**
   * 格式化过期内容
   */
  formatOverdueReviews(items: OverdueItem[]): string | AgentOutput<{ total: number; byPriority: Record<string, number>; items: OverdueItem[] }> {
    const byPriority = {
      high: items.filter((i) => i.priority === 'high').length,
      medium: items.filter((i) => i.priority === 'medium').length,
      low: items.filter((i) => i.priority === 'low').length,
    };

    if (this.json) {
      return createAgentOutput('review', { total: items.length, byPriority, items }, {
        context: {
          nextActions: items.length > 0
            ? ['运行 "learn review --overdue --strategy auto" 处理过期内容']
            : [],
        },
      });
    }

    if (items.length === 0) {
      return '🎉 没有过期的复习内容！';
    }

    const typeEmoji: Record<string, string> = {
      note: '📝',
      'knowledge-point': '💡',
      project: '🎯',
      flashcard: '🃏',
    };

    const lines: string[] = [
      chalk.bold(`⚠️ 你有 ${items.length} 项过期内容需要复习\n`),
    ];

    // 按优先级分组
    if (byPriority.high > 0) {
      lines.push(chalk.red(`🔴 严重过期 (>30天): ${byPriority.high} 项 - 建议重新学习`));
      items.filter((i) => i.priority === 'high').forEach((item) => {
        lines.push(`   ${typeEmoji[item.type]} ${item.title} (过期 ${item.overdueDays} 天)`);
      });
      lines.push('');
    }

    if (byPriority.medium > 0) {
      lines.push(chalk.yellow(`🟡 中度过期 (7-30天): ${byPriority.medium} 项 - 需要优先复习`));
      items.filter((i) => i.priority === 'medium').forEach((item) => {
        lines.push(`   ${typeEmoji[item.type]} ${item.title} (过期 ${item.overdueDays} 天)`);
      });
      lines.push('');
    }

    if (byPriority.low > 0) {
      lines.push(chalk.green(`🟢 轻度过期 (1-7天): ${byPriority.low} 项 - 正常复习即可`));
      items.filter((i) => i.priority === 'low').forEach((item) => {
        lines.push(`   ${typeEmoji[item.type]} ${item.title} (过期 ${item.overdueDays} 天)`);
      });
    }

    lines.push('');
    lines.push(chalk.gray('运行 "learn review --overdue --strategy auto" 自动处理'));

    return lines.join('\n');
  }

  /**
   * 格式化统计信息
   */
  formatStats(stats: LearningStats): string | AgentOutput<LearningStats> {
    if (this.json) {
      return createAgentOutput('stats', stats);
    }

    const lines: string[] = [
      chalk.bold('📊 学习统计\n'),
      `📚 项目数: ${stats.projectCount}`,
      `⏱️ 总时长: ${stats.totalHours.toFixed(1)} 小时`,
      `📝 笔记数: ${stats.totalNotes}`,
      `🃏 闪卡数: ${stats.totalFlashcards} (已掌握: ${stats.masteredFlashcards})`,
      `🔥 连续学习: ${stats.streakDays} 天`,
      '',
      `📅 本周: ${stats.weeklyHours.toFixed(1)} 小时`,
      `📅 本月: ${stats.monthlyHours.toFixed(1)} 小时`,
    ];

    return lines.join('\n');
  }

  /**
   * 格式化进度条
   */
  private formatProgressBar(progress: number, width: number = 20): string {
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return chalk.cyan(bar);
  }

  /**
   * 格式化日期
   */
  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays} 天前`;

    return date.toLocaleDateString('zh-CN');
  }

  /**
   * 获取建议的下一步操作
   */
  private getNextActions(
    project: ProjectMeta,
    reviewStats?: { due: number; overdue: number }
  ): string[] {
    const actions: string[] = [];

    if (reviewStats && reviewStats.overdue > 0) {
      actions.push(`复习 ${reviewStats.overdue} 项过期内容`);
    } else if (reviewStats && reviewStats.due > 0) {
      actions.push(`复习 ${reviewStats.due} 项待复习内容`);
    }

    if (project.progress < 100) {
      actions.push('继续学习下一主题');
    }

    if (project.stage === 'novice' && project.progress >= 30) {
      actions.push('考虑升级到 Beginner 阶段');
    }

    if (actions.length === 0) {
      actions.push('继续学习！保持节奏 🎯');
    }

    return actions;
  }
}

/**
 * JSON 格式化器（用于 --json 选项）
 */
export function formatJSON<T>(command: string, data: T, context?: AgentOutput<T>['context']): string {
  return JSON.stringify(createAgentOutput(command, data, { context }), null, 2);
}
