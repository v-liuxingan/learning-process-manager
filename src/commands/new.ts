import type { Command } from 'commander';
import path from 'path';
import { getProjectManager } from '../lib/project.js';
import { Formatter } from '../lib/formatter.js';

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
        const formatter = new Formatter({ json: useJson });

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
                '编辑 README.md 设置学习目标',
                `运行 "learn session start ${name}" 开始学习`,
              ],
            },
          }, null, 2));
        } else {
          console.log(`✅ 创建学习项目: ${name}`);
          console.log(`📁 路径: ${project.path}`);
          console.log(`🎯 主题: ${topic}`);
          console.log('\n下一步:');
          console.log(`  • 编辑 README.md 设置学习目标`);
          console.log(`  • 运行 "learn session start ${name}" 开始学习`);
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
