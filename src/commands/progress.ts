import type { Command } from 'commander';
import { getProjectManager } from '../lib/project.js';
import { ReviewIndexManager, getSRManager } from '../lib/spaced-repetition.js';
import { Formatter } from '../lib/formatter.js';

export function registerProgressCommand(program: Command): void {
  program
    .command('progress [project]')
    .description('查看学习进度')
    .option('--stage <stage>', '按阶段筛选')
    .action((projectName: string | undefined, _args, cmd) => {
      const options = cmd.optsWithGlobals() as { stage?: string; json?: boolean };

      try {
        const manager = getProjectManager();
        const formatter = new Formatter({ json: false });

        if (projectName) {
          // 显示单个项目进度
          const project = manager.getProject(projectName);
          if (!project) {
            throw new Error(`项目 "${projectName}" 不存在`);
          }

          // 获取复习统计
          const reviewManager = new ReviewIndexManager(project.path);
          const index = reviewManager.loadIndex();
          const srManager = getSRManager();
          const dueItems = srManager.getDueItems(index);
          const overdueItems = srManager.getOverdueItems(index);

          const reviewStats = {
            due: dueItems.length,
            overdue: overdueItems.length,
          };

          // JSON 输出
          if (options.json) {
            const output = {
              version: '1.0',
              timestamp: new Date().toISOString(),
              command: 'progress',
              status: 'success',
              data: {
                ...project,
                reviews: reviewStats,
              },
              context: {
                project: project.name,
                stage: project.stage,
                nextActions: getNextActions(project, reviewStats),
              },
            };
            console.log(JSON.stringify(output, null, 2));
            return;
          }

          const output = formatter.formatProjectProgress(project, reviewStats);
          console.log(output);
        } else {
          // 显示所有项目概览
          let projects = manager.getAllProjects();

          // 按阶段筛选
          if (options.stage) {
            projects = projects.filter((p) => p.stage === options.stage);
          }

          // JSON 输出
          if (options.json) {
            const output = {
              version: '1.0',
              timestamp: new Date().toISOString(),
              command: 'progress',
              status: 'success',
              data: projects,
              context: {
                nextActions: projects.length === 0
                  ? ['运行 "learn new <主题>" 创建第一个学习项目']
                  : [`运行 "learn progress ${projects[0].name}" 查看项目详情`],
              },
            };
            console.log(JSON.stringify(output, null, 2));
            return;
          }

          const output = formatter.formatProjectList(projects);
          console.log(output);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '获取进度失败';
        console.error(`❌ ${message}`);
        process.exit(1);
      }
    });
}

function getNextActions(
  project: { progress: number; stage: string },
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
