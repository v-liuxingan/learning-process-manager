import fs from 'fs';
import type { Command } from 'commander';
import { getConfigLoader } from '../config/index.js';
import { getProjectManager } from '../lib/project.js';

type GlobalOptions = {
  json?: boolean;
};

function printJson(command: string, data: unknown): void {
  console.log(JSON.stringify({
    version: '1.0',
    timestamp: new Date().toISOString(),
    command,
    status: 'success',
    data,
  }, null, 2));
}

export function registerConfigCommand(program: Command): void {
  program
    .command('init')
    .description('初始化学习数据目录和项目索引')
    .action((_args, cmd) => {
      const options = cmd.optsWithGlobals() as GlobalOptions;

      try {
        const manager = getProjectManager();
        const index = manager.initialize();
        const data = {
          indexPath: manager.getIndexPath(),
          defaultProjectsDir: index.settings.defaultProjectsDir,
          projectCount: index.projects.length,
        };

        if (options.json) {
          printJson('init', data);
          return;
        }

        console.log('已初始化学习数据');
        console.log(`索引文件: ${data.indexPath}`);
        console.log(`默认项目目录: ${data.defaultProjectsDir}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : '初始化失败';
        if (options.json) {
          console.log(JSON.stringify({
            version: '1.0',
            timestamp: new Date().toISOString(),
            command: 'init',
            status: 'error',
            error: { code: 'INIT_ERROR', message },
          }, null, 2));
        } else {
          console.error(`初始化失败: ${message}`);
        }
        process.exit(1);
      }
    });

  const config = program
    .command('config')
    .description('查看当前有效配置');

  config
    .command('get [key]')
    .description('输出当前有效配置')
    .action((key: string | undefined, _args, cmd) => {
      const options = cmd.optsWithGlobals() as GlobalOptions;
      const loader = getConfigLoader();
      const current = loader.getConfig();
      const data = key ? current[key as keyof typeof current] : current;

      if (options.json) {
        printJson('config get', { key: key ?? null, value: data });
        return;
      }

      if (key) {
        console.log(String(data ?? ''));
      } else {
        console.log(JSON.stringify(current, null, 2));
      }
    });

  program
    .command('doctor')
    .description('检查学习数据路径和配置状态')
    .action((_args, cmd) => {
      const options = cmd.optsWithGlobals() as GlobalOptions;
      try {
        const loader = getConfigLoader();
        const manager = getProjectManager();
        const config = loader.getConfig();
        const data = {
          configFile: loader.getConfigFilePath() ?? null,
          hasExplicitConfig: loader.hasExplicitConfig(),
          indexPath: manager.getIndexPath(),
          indexExists: fs.existsSync(manager.getIndexPath()),
          defaultProjectsDir: config.defaultProjectsDir,
          projectsDirExists: fs.existsSync(config.defaultProjectsDir),
          reviewAlgorithm: config.reviewAlgorithm,
          timezone: config.timezone,
        };

        if (options.json) {
          printJson('doctor', data);
          return;
        }

        console.log('学习 CLI 诊断');
        console.log(`配置文件: ${data.configFile ?? '未找到'}`);
        console.log(`索引文件: ${data.indexPath} (${data.indexExists ? '存在' : '未创建'})`);
        console.log(`默认项目目录: ${data.defaultProjectsDir} (${data.projectsDirExists ? '存在' : '未创建'})`);
        console.log(`复习算法: ${data.reviewAlgorithm}`);
        console.log(`时区: ${data.timezone}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : '诊断失败';
        if (options.json) {
          console.log(JSON.stringify({
            version: '1.0',
            timestamp: new Date().toISOString(),
            command: 'doctor',
            status: 'error',
            error: { code: 'DOCTOR_ERROR', message },
          }, null, 2));
        } else {
          console.error(`诊断失败: ${message}`);
        }
        process.exit(1);
      }
    });
}
