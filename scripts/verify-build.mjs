import { readFile, access } from 'node:fs/promises';
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
const packageInfo = JSON.parse(await readFile('package.json', 'utf8'));
for (const file of [
  'content.js',
  manifest.background.service_worker,
  manifest.action.default_popup,
  manifest.options_ui.page,
  'popup.js',
  'options.js',
  'pages.css',
  'LICENSE',
  'PRIVACY.md',
  ...Object.values(manifest.icons),
])
  await access(`dist/${file}`);
if (
  manifest.manifest_version !== 3 ||
  manifest.version !== packageInfo.version ||
  manifest.permissions.join() !== 'storage'
)
  throw new Error('Unexpected manifest configuration.');
for (const file of ['content.js', 'background.js', 'popup.js', 'options.js'])
  if ((await readFile(`dist/${file}`, 'utf8')).includes('eval('))
    throw new Error(`Unsafe eval in ${file}`);
console.log('Verified complete Manifest V3 extension in dist/.');
