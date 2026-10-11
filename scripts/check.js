import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

async function checkDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = join(directory, entry.name);
    if (entry.isDirectory()) await checkDirectory(filename);
    else if (entry.name.endsWith('.js')) checkFile(filename);
  }
}

function checkFile(filename) {
  const result = spawnSync(process.execPath, ['--check', filename], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = 1;
}

for (const directory of ['api', 'checks', 'server', 'scripts', 'shared', 'src', 'tests']) {
  await checkDirectory(directory);
}
checkFile('vite.config.js');
checkFile('playwright.config.js');
if (!process.exitCode)
  console.log('All JavaScript syntax checks passed. Run npm run build to check JSX.');
