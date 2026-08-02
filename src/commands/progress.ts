import type { Command } from 'commander';
import { getProjectManager } from '../lib/project.js';
import { ReviewIndexManager, getSRManager } from '../lib/spaced-repetition.js';
import { Formatter } from '../lib/formatter.js';
import { LearningUnitManager } from '../lib/learning-unit.js';

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
          const unitManager = new LearningUnitManager(project.path, project.name);
          const unitStats = unitManager.getStats();
          const nextUnit = unitManager.getNextUnit();

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
                learningUnits: {
                  stats: unitStats,
                  next: nextUnit,
                },
              },
              context: {
                project: project.name,
                stage: project.stage,
                nextActions: getNextActions(project.name, reviewStats, nextUnit, unitStats.total),
              },
            };
            console.log(JSON.stringify(output, null, 2));
            return;
          }

          const output = formatter.formatProjectProgress(project, reviewStats);
          console.log(output);
          console.log(`\n学习单元: ${unitStats.mastered}/${unitStats.total} mastered`);
          if (nextUnit) console.log(`下一单元: ${nextUnit.id} (${nextUnit.status})`);
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
  projectName: string,
  reviewStats: { due: number; overdue: number },
  nextUnit: { id: string } | null,
  unitTotal: number
): string[] {
  const actions: string[] = [];

  if (reviewStats && reviewStats.overdue > 0) {
    actions.push(`复习 ${reviewStats.overdue} 项过期内容`);
  } else if (reviewStats && reviewStats.due > 0) {
    actions.push(`复习 ${reviewStats.due} 项待复习内容`);
  }

  if (nextUnit) actions.push(`learn session start --project ${projectName} --unit ${nextUnit.id}`);
  else if (unitTotal === 0) actions.push(`learn unit add --project ${projectName} --id <id> --title "<title>"`);

  if (actions.length === 0) {
    actions.push(`learn unit list --project ${projectName}`);
  }

  return actions;
}
