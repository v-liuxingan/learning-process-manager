import type { Command } from 'commander';
import { getProjectManager } from '../lib/project.js';

type GlobalOptions = {
  json?: boolean;
};

function printJson(command: string, status: 'success' | 'error', data: unknown, error?: {
  code: string;
  message: string;
}): void {
  console.log(JSON.stringify({
    version: '1.0',
    timestamp: new Date().toISOString(),
    command,
    status,
    data,
    error,
  }, null, 2));
}

export function registerProjectCommand(program: Command): void {
  const project = program
    .command('project')
    .description('Manage learning projects');

  project
    .command('import')
    .description('Register an existing learning project directory')
    .requiredOption('--path <dir>', 'Existing project directory')
    .option('-n, --name <name>', 'Project name')
    .option('-t, --topic <topic>', 'Learning topic')
    .option('--topics <number>', 'Total topic count', parseInt)
    .action((options: {
      path: string;
      name?: string;
      topic?: string;
      topics?: number;
    }, cmd) => {
      const globalOptions = cmd.optsWithGlobals() as GlobalOptions;

      try {
        const manager = getProjectManager();
        const imported = manager.importProject({
          path: options.path,
          name: options.name,
          topic: options.topic,
          topicsTotal: options.topics,
        });

        if (globalOptions.json) {
          printJson('project import', 'success', {
            project: imported,
            createdStructure: {
              preservesExistingFiles: true,
              ensured: [
                'README.md',
                'progress.md',
                'notes/',
                'knowledge/',
                'flashcards/',
                'projects/',
                'resources/',
                'learning-units.json',
                'reviews/review-index.json',
              ],
            },
          });
          return;
        }

        console.log(`Imported project: ${imported.name}`);
        console.log(`Path: ${imported.path}`);
        console.log(`Next: learn status ${imported.name} --json`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to import project';
        if (globalOptions.json) {
          printJson('project import', 'error', null, {
            code: 'PROJECT_IMPORT_ERROR',
            message,
          });
        } else {
          console.error(`Failed to import project: ${message}`);
        }
        process.exit(1);
      }
    });
}
