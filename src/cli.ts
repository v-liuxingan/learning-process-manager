import { Command } from 'commander';
import { registerNewCommand } from './commands/new.js';
import { registerListCommand } from './commands/list.js';
import { registerProgressCommand } from './commands/progress.js';
import { registerSessionCommand } from './commands/session.js';
import { registerReviewCommand } from './commands/review.js';
import { registerFlashcardCommand } from './commands/flashcard.js';
import { registerStatsCommand } from './commands/stats.js';
import { registerConfigCommand } from './commands/config.js';

const program = new Command();

program
  .name('learn')
  .description('学习进度管理 CLI 工具')
  .version('1.0.0')
  .option('--json', '输出 JSON 格式（供 Agent 使用）')
  .option('--porcelain', '机器可解析输出')
  .option('--quiet', '最小输出');

// 注册子命令
registerNewCommand(program);
registerListCommand(program);
registerProgressCommand(program);
registerSessionCommand(program);
registerReviewCommand(program);
registerFlashcardCommand(program);
registerStatsCommand(program);
registerConfigCommand(program);

export { program };
