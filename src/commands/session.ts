import type { Command } from 'commander';
import { getProjectManager } from '../lib/project.js';
import { recordStudySession } from '../lib/session-history.js';
import type { LearningStage } from '../types/index.js';

export function registerSessionCommand(program: Command): void {
  program
    .command('session <action>')
    .description('学习会话管理')
    .option('-p, --project <name>', '项目名称')
    .option('-d, --duration <minutes>', '学习时长（分钟）', parseInt)
    .option('-s, --summary <text>', '学习摘要')
    .option('-n, --note <text>', '学习笔记')
    .option('--stage <stage>', '更新学习阶段')
    .action((action: string, _args, cmd) => {
      const options = cmd.optsWithGlobals() as {
        project?: string;
        duration?: number;
        summary?: string;
        note?: string;
        stage?: string;
        json?: boolean;
      };

      try {
        const manager = getProjectManager();

        switch (action) {
          case 'start': {
            if (!options.project) {
              throw new Error('请指定项目名称: --project <name>');
            }
            const projectStart = manager.getProject(options.project);
            if (!projectStart) {
              throw new Error(`项目 "${options.project}" 不存在`);
            }
            if (options.json) {
              console.log(JSON.stringify({
                version: '1.0',
                timestamp: new Date().toISOString(),
                command: 'session',
                status: 'success',
                data: {
                  action: 'start',
                  project: projectStart,
                },
                context: {
                  project: projectStart.name,
                  stage: projectStart.stage,
                  nextActions: [
                    '学习完成后运行 "learn session end" 记录结果',
                  ],
                },
              }, null, 2));
            } else {
              console.log(`📚 开始学习: ${projectStart.name}`);
              console.log(`🎯 主题: ${projectStart.topic}`);
              console.log(`📊 当前进度: ${projectStart.progress}%`);
              console.log('\n完成后运行 "learn session end" 记录学习结果');
            }
            break;
          }

          case 'end': {
            if (!options.project) {
              throw new Error('请指定项目名称: --project <name>');
            }
            const projectEnd = manager.getProject(options.project);
            if (!projectEnd) {
              throw new Error(`项目 "${options.project}" 不存在`);
            }

            const updates: {
              duration?: number;
              stage?: LearningStage;
            } = {};

            if (options.duration) {
              updates.duration = options.duration;
            }

            if (options.stage) {
              updates.stage = options.stage as LearningStage;
            }

            const updated = manager.updateProgress(options.project, updates);
            const endedAt = new Date();
            const startedAt = new Date(endedAt);
            if (options.duration) {
              startedAt.setMinutes(startedAt.getMinutes() - options.duration);
            }

            recordStudySession(projectEnd.path, {
              id: `session-${endedAt.getTime()}`,
              projectName: projectEnd.name,
              startedAt: startedAt.toISOString(),
              endedAt: endedAt.toISOString(),
              duration: options.duration,
              note: options.note,
              summary: options.summary,
            });

            if (options.json) {
              console.log(JSON.stringify({
                version: '1.0',
                timestamp: new Date().toISOString(),
                command: 'session',
                status: 'success',
                data: {
                  action: 'end',
                  project: updated,
                  session: {
                    duration: options.duration,
                    summary: options.summary,
                  },
                },
                context: {
                  project: updated.name,
                  stage: updated.stage,
                  nextActions: [
                    '运行 "learn review" 查看待复习内容',
                    '运行 "learn flashcard create" 创建关键问答闪卡',
                    '运行 "learn flashcard add-note" 将笔记加入复习计划',
                  ],
                },
              }, null, 2));
            } else {
              console.log(`✅ 学习会话结束`);
              if (options.duration) {
                console.log(`⏱️ 学习时长: ${options.duration} 分钟`);
              }
              console.log(`📊 更新后进度: ${updated.progress}%`);
              console.log(`📚 总学习时长: ${updated.totalHours.toFixed(1)} 小时`);
            }
            break;
          }

          default:
            throw new Error(`未知操作: ${action}。可用: start, end`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '会话操作失败';
        if (options.json) {
          console.log(JSON.stringify({
            version: '1.0',
            timestamp: new Date().toISOString(),
            command: 'session',
            status: 'error',
            error: { code: 'SESSION_ERROR', message },
          }, null, 2));
        } else {
          console.error(`❌ ${message}`);
        }
        process.exit(1);
      }
    });
}
