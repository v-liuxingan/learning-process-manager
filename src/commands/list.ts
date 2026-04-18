import type { Command } from 'commander';
import { getProjectManager } from '../lib/project.js';
import { Formatter } from '../lib/formatter.js';

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('列出所有学习项目')
    .option('--porcelain', '机器可解析输出')
    .action((_args, cmd) => {
      // 使用 optsWithGlobals() 获取包含全局选项的所有选项
      const options = cmd.optsWithGlobals() as { json?: boolean; porcelain?: boolean };

      try {
        const manager = getProjectManager();
        const projects = manager.getAllProjects();

        if (options.porcelain) {
          // 机器可解析格式：每行一个项目，制表符分隔
          projects.forEach((p) => {
            console.log(`${p.name}\t${p.stage}\t${p.progress}\t${p.totalHours.toFixed(1)}\t${p.lastStudyDate || '-'}`);
          });
          return;
        }

        // JSON 输出模式
        if (options.json) {
          const output = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            command: 'list',
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

        // 人类可读输出
        const formatter = new Formatter({ json: false });
        const output = formatter.formatProjectList(projects);
        console.log(output);
      } catch (error) {
        const message = error instanceof Error ? error.message : '获取项目列表失败';
        console.error(`❌ ${message}`);
        process.exit(1);
      }
    });
}
