import type { Command } from 'commander';
import { getProjectManager } from '../lib/project.js';

export function registerNewCommand(program: Command): void {
  program
    .command('new <topic>')
    .description('创建新学习项目')
    .option('-p, --path <path>', '项目路径')
    .option('-t, --topics <number>', '总主题数', parseInt)
    .option('--json', '输出 JSON 格式')
    .action(async (topic: string, options: { path?: string; topics?: number; json?: boolean }, cmd) => {
      // 获取全局选项
      const globalOptions = cmd.optsWithGlobals() as { json?: boolean };
      const useJson = globalOptions.json ?? options.json;

      try {
        const manager = getProjectManager();

        // 生成项目名称（从主题中提取）
        const name = topic.toLowerCase().replace(/\s+/g, '-');

        const project = manager.createProject({
          name,
          topic,
          path: options.path,
          topicsTotal: options.topics,
        });

        if (useJson) {
          console.log(JSON.stringify({
            version: '1.0',
            timestamp: new Date().toISOString(),
            command: 'new',
            status: 'success',
            data: {
              name: project.name,
              path: project.path,
              topic: project.topic,
              stage: project.stage,
              topicsTotal: project.topicsTotal,
            },
            context: {
              nextActions: [
                '完成 README.md 的课程总览、路线与最终验收',
                '为每个核心单元准备包含“单元导览”的 Note',
                `运行 "learn unit add --project ${name} --id <id> --title <title>" 注册学习单元`,
              ],
            },
          }, null, 2));
        } else {
          console.log(`✅ 创建学习项目: ${name}`);
          console.log(`📁 路径: ${project.path}`);
          console.log(`🎯 主题: ${topic}`);
          console.log('\n下一步:');
          console.log(`  • 完成 README.md 的课程总览、路线与最终验收`);
          console.log(`  • 为每个核心单元准备包含“单元导览”的 Note`);
          console.log(`  • 运行 "learn unit add --project ${name} --id <id> --title <title>" 注册学习单元`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '创建项目失败';
        if (useJson) {
          console.log(JSON.stringify({
            version: '1.0',
            timestamp: new Date().toISOString(),
            command: 'new',
            status: 'error',
            error: { code: 'NEW_PROJECT_ERROR', message },
          }, null, 2));
        } else {
          console.error(`❌ ${message}`);
        }
        process.exit(1);
      }
    });
}
