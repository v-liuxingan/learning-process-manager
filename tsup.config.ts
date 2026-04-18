import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
    'bin/learn': 'src/bin/learn.ts',
  },
  format: ['esm'],
  dts: {
    entry: 'src/index.ts',
  },
  sourcemap: true,
  clean: true,
  shims: true,
  external: ['@inquirer/prompts'],
});
