import type { Command } from 'commander';
import { getProjectManager } from '../lib/project.js';
import { ReviewIndexManager, getSRManager } from '../lib/spaced-repetition.js';
import { Formatter } from '../lib/formatter.js';
import type { ReviewRating } from '../types/index.js';

export function registerReviewCommand(program: Command): void {
  program
    .command('review [project]')
    .description('间隔重复复习')
    .option('--due', '仅显示待复习内容')
    .option('--overdue', '仅显示过期内容')
    .option('--type <type>', '按类型筛选 (note/knowledge-point/project/flashcard)')
    .option('--limit <number>', '限制数量', parseInt)
    .option('--strategy <strategy>', '过期处理策略 (reset/reschedule/continue/auto)')
    .action((projectName: string | undefined, _args, cmd) => {
      const options = cmd.optsWithGlobals() as {
        due?: boolean;
        overdue?: boolean;
        type?: string;
        limit?: number;
        strategy?: string;
        json?: boolean;
      };

      try {
        const manager = getProjectManager();
        const formatter = new Formatter({ json: false });

        // 获取要复习的项目
        const projects = projectName
          ? [manager.getProject(projectName)].filter(Boolean)
          : manager.getAllProjects();

        if (projects.length === 0) {
          if (projectName) {
            throw new Error(`项目 "${projectName}" 不存在`);
          }
          console.log('暂无学习项目');
          return;
        }

        // 收集所有待复习/过期内容
        const allDueItems: any[] = [];
        const allOverdueItems: any[] = [];

        for (const project of projects) {
          if (!project) continue;

          const reviewManager = new ReviewIndexManager(project.path);
          const index = reviewManager.loadIndex();
          const srManager = getSRManager();

          // 筛选类型
          let items = index.items;
          if (options.type) {
            items = items.filter((i) => i.type === options.type);
          }

          // 获取待复习内容
          const dueItems = srManager.getDueItems({ ...index, items });
          allDueItems.push(...dueItems);

          // 获取过期内容
          const overdueItems = srManager.getOverdueItems({ ...index, items });
          allOverdueItems.push(...overdueItems);
        }

        // 应用限制
        const limit = options.limit ?? 20;
        const limitedDueItems = allDueItems.slice(0, limit);
        const limitedOverdueItems = allOverdueItems.slice(0, limit);

        // 根据选项输出
        if (options.overdue) {
          if (options.json) {
            const byPriority = {
              high: limitedOverdueItems.filter((i) => i.priority === 'high').length,
              medium: limitedOverdueItems.filter((i) => i.priority === 'medium').length,
              low: limitedOverdueItems.filter((i) => i.priority === 'low').length,
            };
            console.log(JSON.stringify({
              version: '1.0',
              timestamp: new Date().toISOString(),
              command: 'review',
              status: 'success',
              data: { total: limitedOverdueItems.length, byPriority, items: limitedOverdueItems },
              context: {
                nextActions: limitedOverdueItems.length > 0
                  ? ['运行 "learn review --overdue --strategy auto" 处理过期内容']
                  : [],
              },
            }, null, 2));
          } else {
            const output = formatter.formatOverdueReviews(limitedOverdueItems);
            console.log(output);
          }
        } else if (options.due) {
          if (options.json) {
            console.log(JSON.stringify({
              version: '1.0',
              timestamp: new Date().toISOString(),
              command: 'review',
              status: 'success',
              data: { total: limitedDueItems.length, items: limitedDueItems },
              context: {
                nextActions: limitedDueItems.length > 0
                  ? ['运行 "learn review" 开始复习']
                  : ['暂无待复习内容，继续学习吧！'],
              },
            }, null, 2));
          } else {
            const output = formatter.formatDueReviews(limitedDueItems);
            console.log(output);
          }
        } else {
          // 默认显示待复习内容
          if (allOverdueItems.length > 0) {
            if (!options.json) {
              console.log(`⚠️ 你有 ${allOverdueItems.length} 项过期内容\n`);
            }
            if (options.json) {
              const byPriority = {
                high: limitedOverdueItems.filter((i) => i.priority === 'high').length,
                medium: limitedOverdueItems.filter((i) => i.priority === 'medium').length,
                low: limitedOverdueItems.filter((i) => i.priority === 'low').length,
              };
              console.log(JSON.stringify({
                version: '1.0',
                timestamp: new Date().toISOString(),
                command: 'review',
                status: 'success',
                data: { total: limitedOverdueItems.length, byPriority, items: limitedOverdueItems },
              }, null, 2));
            } else {
              const output = formatter.formatOverdueReviews(limitedOverdueItems);
              console.log(output);
            }
          } else {
            if (options.json) {
              console.log(JSON.stringify({
                version: '1.0',
                timestamp: new Date().toISOString(),
                command: 'review',
                status: 'success',
                data: { total: limitedDueItems.length, items: limitedDueItems },
              }, null, 2));
            } else {
              const output = formatter.formatDueReviews(limitedDueItems);
              console.log(output);
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '复习操作失败';
        if (options.json) {
          console.log(JSON.stringify({
            version: '1.0',
            timestamp: new Date().toISOString(),
            command: 'review',
            status: 'error',
            error: { code: 'REVIEW_ERROR', message },
          }, null, 2));
        } else {
          console.error(`❌ ${message}`);
        }
        process.exit(1);
      }
    });

  // 添加 submit 子命令
  program
    .command('review-submit <content-id> <rating>')
    .description('提交复习结果')
    .requiredOption('-p, --project <name>', '项目名称')
    .action((contentId: string, rating: string, _args, cmd) => {
      const options = cmd.optsWithGlobals() as { project: string; json?: boolean };

      try {
        const manager = getProjectManager();
        const project = manager.getProject(options.project);
        if (!project) {
          throw new Error(`项目 "${options.project}" 不存在`);
        }

        // 验证评分
        const validRatings: ReviewRating[] = ['again', 'hard', 'good', 'easy'];
        if (!validRatings.includes(rating as ReviewRating)) {
          throw new Error(`无效评分: ${rating}。可用: ${validRatings.join(', ')}`);
        }

        const reviewManager = new ReviewIndexManager(project.path);
        const index = reviewManager.loadIndex();

        // 查找内容项
        const item = index.items.find((i) => i.id === contentId);
        if (!item) {
          throw new Error(`内容项 "${contentId}" 不存在`);
        }

        // 处理复习结果
        const srManager = getSRManager();
        const updatedItem = srManager.processReview(item, rating as ReviewRating);

        // 更新索引
        reviewManager.updateItem(updatedItem);

        // 记录历史
        reviewManager.recordHistory({
          itemId: contentId,
          reviewedAt: new Date().toISOString(),
          rating: rating as ReviewRating,
          beforeState: item.review,
          afterState: updatedItem.review,
          intervalDays: Math.ceil(
            (srManager.getNextReviewDate(updatedItem).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          ),
        });

        if (options.json) {
          console.log(JSON.stringify({
            version: '1.0',
            timestamp: new Date().toISOString(),
            command: 'review-submit',
            status: 'success',
            data: {
              itemId: contentId,
              rating,
              nextReview: srManager.getNextReviewDate(updatedItem).toISOString(),
            },
          }, null, 2));
        } else {
          const nextDate = srManager.getNextReviewDate(updatedItem);
          console.log(`✅ 复习结果已记录`);
          console.log(`📅 下次复习: ${nextDate.toLocaleDateString('zh-CN')}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '提交失败';
        if (options.json) {
          console.log(JSON.stringify({
            version: '1.0',
            timestamp: new Date().toISOString(),
            command: 'review-submit',
            status: 'error',
            error: { code: 'REVIEW_ERROR', message },
          }, null, 2));
        } else {
          console.error(`❌ ${message}`);
        }
        process.exit(1);
      }
    });
}
