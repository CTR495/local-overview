import { build, context } from 'esbuild';
import { mkdir, copyFile, rm } from 'node:fs/promises';
import { generateIcons } from './icons.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const projectRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
process.chdir(projectRoot);
const output = path.resolve(projectRoot, 'dist');
if (path.dirname(output) !== projectRoot) throw new Error('Build output must stay in the project.');
const watch = process.argv.includes('--watch');
await rm(output, { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const name of ['manifest.json', 'popup.html', 'options.html', 'LICENSE', 'PRIVACY.md'])
  await copyFile(name, `dist/${name}`);
await copyFile('src/pages/pages.css', 'dist/pages.css');
await generateIcons('dist/icons');
const common = {
  bundle: true,
  target: 'chrome120',
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
};
const configs = [
  {
    ...common,
    entryPoints: { content: 'src/content/index.ts' },
    outdir: 'dist',
    format: 'iife',
    loader: { '.css': 'text' },
  },
  {
    ...common,
    entryPoints: {
      background: 'src/background/index.ts',
      popup: 'src/pages/popup.ts',
      options: 'src/pages/options.ts',
    },
    outdir: 'dist',
    format: 'esm',
  },
];
if (watch) {
  for (const config of configs) await (await context(config)).watch();
  console.log(
    'Watching TypeScript. Rebuild after editing HTML, CSS, or manifest; reload the extension and Google tab.',
  );
} else await Promise.all(configs.map((config) => build(config)));
