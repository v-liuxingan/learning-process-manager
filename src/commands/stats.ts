import type { Command } from 'commander';
import { getProjectManager } from '../lib/project.js';
import { Formatter } from '../lib/formatter.js';
import { loadStudySessions } from '../lib/session-history.js';
import { ReviewIndexManager } from '../lib/spaced-repetition.js';
import type { ReviewableItem } from '../types/index.js';
import type { LearningStats } from '../types/index.js';

function isMasteredFlashcard(item: ReviewableItem): boolean {
  if (item.type !== 'flashcard') {
    return false;
  }

  if (item.review.algorithm === 'fsrs') {
    return item.review.fsrs?.state === 'review';
  }

  return (item.review.ebbinghaus?.completedRounds ?? 0) > 0;
}

export function registerStatsCommand(program: Command): void {
  program
    .command('stats')
    .description('学习统计')
    .option('--week', '本周统计')
    .option('--month', '本月统计')
    .action((_args, cmd) => {
      const options = cmd.optsWithGlobals() as { week?: boolean; month?: boolean; json?: boolean };

      try {
        const manager = getProjectManager();
        const projects = manager.getAllProjects();
        const formatter = new Formatter({ json: false });

        // 计算统计数据
        const stats: LearningStats = {
          totalHours: 0,
          totalSessions: 0,
          totalNotes: 0,
          totalFlashcards: 0,
          masteredFlashcards: 0,
          streakDays: 0,
          projectCount: projects.length,
          weeklyHours: 0,
          monthlyHours: 0,
        };

        // 汇总数据
        for (const project of projects) {
          stats.totalHours += project.totalHours;
        }

        // 计算连续学习天数
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let streak = 0;
        for (let i = 0; i < 365; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(checkDate.getDate() - i);
          const dateStr = checkDate.toISOString().split('T')[0];

          const hasActivity = projects.some((p) => {
            if (!p.lastStudyDate) return false;
            return p.lastStudyDate.startsWith(dateStr);
          });

          if (hasActivity) {
            streak++;
          } else if (i > 0) {
            break;
          }
        }
        stats.streakDays = streak;

        // 本周/本月统计
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);

        for (const project of projects) {
          const sessions = loadStudySessions(project.path);
          stats.totalSessions += sessions.length;

          const reviewIndex = new ReviewIndexManager(project.path).loadIndex();
          for (const item of reviewIndex.items) {
            if (item.type === 'note') {
              stats.totalNotes += 1;
            } else if (item.type === 'flashcard') {
              stats.totalFlashcards += 1;
              if (isMasteredFlashcard(item)) {
                stats.masteredFlashcards += 1;
              }
            }
          }

          for (const session of sessions) {
            if (!session.endedAt || !session.duration) {
              continue;
            }

            const endedAt = new Date(session.endedAt);
            const hours = session.duration / 60;
            if (endedAt >= weekAgo) {
              stats.weeklyHours += hours;
            }
            if (endedAt >= monthAgo) {
              stats.monthlyHours += hours;
            }
          }
        }

        // JSON 输出
        if (options.json) {
          console.log(JSON.stringify({
            version: '1.0',
            timestamp: new Date().toISOString(),
            command: 'stats',
            status: 'success',
            data: stats,
          }, null, 2));
          return;
        }

        const output = formatter.formatStats(stats);
        console.log(output);
      } catch (error) {
        const message = error instanceof Error ? error.message : '获取统计失败';
        console.error(`❌ ${message}`);
        process.exit(1);
      }
    });
}
