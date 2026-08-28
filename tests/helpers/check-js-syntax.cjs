const { readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const directory = resolve('src/js');
for (const filename of readdirSync(directory).filter(name => name.endsWith('.js')).sort()) {
  const result = spawnSync(process.execPath, ['--check', resolve(directory, filename)], { encoding: 'utf8' });
  if (result.status !== 0) { process.stderr.write(result.stderr || result.stdout); process.exit(result.status || 1); }
  process.stdout.write(`syntax ok: ${filename}\n`);
}
