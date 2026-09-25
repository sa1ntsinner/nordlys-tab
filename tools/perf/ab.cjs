/* Same-browser A/B of the new tab: a clean export of a git ref (default origin/main)
   against a working tree (default: this checkout, uncommitted changes included).
   Runs are interleaved ABBA… so slow drift (thermal, background load) hits both builds.
     node tools/perf/ab.cjs --runs 3 --seconds 8 --out tools/perf/evidence/ab.json
   Anything after `--` is passed to newtab.cjs unchanged, e.g. `--only aurora -- --idle`, `-- --one-page-fit on`, or
   `-- --cadence render --seed 7 --quiet-alpha 0.45` (see README: render cadence is not comparable with raf). Options set
   here (--only, --seconds, …) win over repeats after `--`, because the probe reads the first occurrence. */
const { execFileSync, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createHash } = require('node:crypto');
const { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync } = require('node:fs');
const { writeFile, mkdir } = require('node:fs/promises');
const { join, resolve, relative } = require('node:path');
const { tmpdir } = require('node:os');

const execFileAsync = promisify(execFile);
const split = process.argv.indexOf('--');
const args = process.argv.slice(2, split < 0 ? undefined : split);
const passThrough = split < 0 ? [] : process.argv.slice(split + 1);
const option = (key, fallback) => { const i = args.indexOf(`--${key}`); return i < 0 ? fallback : args[i + 1]; };
const runs = Number(option('runs', '3'));
const baseRef = option('base', 'origin/main');
const current = resolve(option('current', resolve(__dirname, '../..')));
const output = option('out', '');
const probe = ['--channel', option('channel', 'chrome'), '--board', option('board', 'dense'),
  '--width', option('width', '2048'), '--height', option('height', '1152'), '--dpr', option('dpr', '1.25'),
  '--seconds', option('seconds', '8'), '--warmup', option('warmup', '2'), '--only', option('only', 'all'), ...passThrough];
if (!Number.isInteger(runs) || runs < 1) throw Error('--runs must be a positive integer');

const git = (...command) => execFileSync('git', command, { cwd: current, encoding: 'utf8' }).trim();
const round = (value, digits = 2) => value == null ? null : Number(value.toFixed(digits));
const median = values => { const s = values.filter(v => v != null).sort((a, b) => a - b); const m = s.length >> 1;
  return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
const sum = (processes, type, key) => processes.filter(p => p.type === type).reduce((total, p) => total + (p[key] || 0), 0);

/* Everything the page loads. A fingerprint before and after the runs proves the tree did not change underneath. */
function fingerprint(root) {
  const hash = createHash('sha256');
  const walk = dir => readdirSync(join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    // Line endings differ between a git export and a Windows checkout; they do not change what runs.
    else hash.update(`${path.replaceAll('\\', '/')}\0`).update(readFileSync(join(root, path), 'utf8').replaceAll('\r\n', '\n'));
  });
  ['newtab.html', 'manifest.json'].filter(file => existsSync(join(root, file))).forEach(file =>
    hash.update(`${file}\0`).update(readFileSync(join(root, file), 'utf8').replaceAll('\r\n', '\n')));
  walk('src');
  return hash.digest('hex').slice(0, 16);
}

/* The figures a before/after decision rests on, from one newtab.cjs sample. */
function summarize(sample) {
  const renderers = sample.processes.filter(p => p.type === 'renderer');
  return {
    gpuCpuMsPerSec: round(sum(sample.processes, 'GPU', 'cpuMsPerSec')),
    rendererCpuMsPerSec: round(sum(sample.processes, 'renderer', 'cpuMsPerSec')),
    browserCpuMsPerSec: round(sum(sample.processes, 'browser', 'cpuMsPerSec')),
    gpuPrivateMiB: round(sum(sample.processes, 'GPU', 'privateMiB')),
    // The page's renderer is the busiest one; spare renderers sit idle at a few MiB.
    pageRendererPrivateMiB: round(renderers.sort((a, b) => b.cpuMsPerSec - a.cpuMsPerSec)[0]?.privateMiB),
    totalPrivateMiB: round(sample.processes.reduce((total, p) => total + (p.privateMiB || 0), 0)),
    jsHeapMiB: sample.jsHeapMiB,
    canvasFps: sample.canvasFps, rafFps: sample.rafFps, rafP95Ms: sample.rafP95Ms, rafOver25MsPct: sample.rafOver25MsPct,
    canvasRenderMsPerFrame: sample.canvasRenderMsPerFrame, rendererTaskMsPerSec: sample.rendererTaskMsPerSec,
    // Both builds solve quiet zones inside render(), so canvasRenderMsPerFrame carries that cost on each.
    // Only a build that repaints a small sample (not the live canvas) reports it separately here.
    scratchRenderMsPerFrame: sample.scratchRenderMsPerFrame,
    // The engine's own loop frames (reportVersion 2); null in a scene without them, so no median is invented.
    renderFps: sample.renderCadence?.absent === false ? sample.renderCadence.fps : null,
    renderP50Ms: sample.renderCadence?.p50Ms ?? null, renderP95Ms: sample.renderCadence?.p95Ms ?? null,
    renderOver50MsPct: sample.renderCadence?.over50MsPct ?? null,
    quietAlphaMax: sample.quiet?.alphaMax.length ? Math.max(...sample.quiet.alphaMax) : null,
    quietNonzeroSolves: sample.quiet ? sample.quiet.nonzeroSolves : null,
    meteorsSpawned: sample.meteorsSpawned ?? null,
  };
}

async function probeOnce(root) {
  const { stdout } = await execFileAsync(process.execPath, [join(__dirname, 'newtab.cjs'), '--root', root, ...probe],
    { maxBuffer: 64 << 20, windowsHide: true });
  const report = JSON.parse(stdout);
  if (report.errors.length) throw Error(`Page errors in ${root}: ${report.errors.join('; ')}`);
  return report;
}

/* Whole-machine CPU load just before a run (Windows only). Other browsers, builds or test runs on the
   machine move the GPU and renderer figures by tens of percent; a busy run is visible here, not hidden. */
function machineLoadPct() {
  if (process.platform !== 'win32') return null;
  const command = '$s = 1..4 | % { (Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average).Average; Start-Sleep -Milliseconds 400 }; ($s | Measure-Object -Average).Average';
  try { return round(Number(execFileSync('powershell', ['-NoProfile', '-Command', command], { encoding: 'utf8', windowsHide: true }))); }
  catch { return null; }
}

(async () => {
  const baseSha = git('rev-parse', '--verify', `${baseRef}^{commit}`);
  const head = git('rev-parse', 'HEAD');
  const dirty = git('status', '--porcelain', '--', 'src', 'newtab.html', 'manifest.json').split('\n').filter(Boolean);
  const scratch = mkdtempSync(join(tmpdir(), 'nordlys-ab-'));
  const base = join(scratch, 'base');
  try {
    // A clean export, not a worktree: nothing is registered in .git and nothing untracked leaks in.
    execFileSync('git', ['archive', '--format=tar', '-o', join(scratch, 'base.tar'), baseSha], { cwd: current });
    await mkdir(base);
    execFileSync('tar', ['-xf', '../base.tar'], { cwd: base }); // relative: GNU tar reads "C:" as a remote host
    const trees = { base: { root: base, ref: baseRef, sha: baseSha, fingerprint: fingerprint(base) },
      current: { root: current, head, uncommitted: dirty, fingerprint: fingerprint(current) } };
    if (trees.base.fingerprint === trees.current.fingerprint) process.stderr.write('warning: both builds load identical files\n');

    const reports = { base: [], current: [] };
    for (let i = 0; i < runs; i++) {
      for (const build of i % 2 ? ['current', 'base'] : ['base', 'current']) {
        const loadPct = machineLoadPct();
        process.stderr.write(`run ${i + 1}/${runs} ${build} (machine load ${loadPct ?? '?'}%)\n`);
        reports[build].push({ ...await probeOnce(trees[build].root), machineLoadPct: loadPct });
      }
    }
    const currentAfter = fingerprint(current);
    const versions = new Set([...reports.base, ...reports.current].map(r => r.browser));
    if (versions.size !== 1) throw Error(`Browser version changed between runs: ${[...versions].join(', ')}`);

    const labels = reports.base[0].samples.map(s => s.label);
    const scenes = Object.fromEntries(labels.map(label => {
      const per = build => reports[build].map(r => summarize(r.samples.find(s => s.label === label)));
      const [a, b] = [per('base'), per('current')];
      const metrics = Object.fromEntries(Object.keys(a[0]).map(key => {
        const [ma, mb] = [median(a.map(x => x[key])), median(b.map(x => x[key]))];
        return [key, { base: round(ma), current: round(mb), deltaPct: ma ? round(100 * (mb - ma) / ma, 1) : null,
          baseRuns: a.map(x => x[key]), currentRuns: b.map(x => x[key]) }];
      }));
      return [label, metrics];
    }));
    const first = reports.base[0];
    const summary = {
      // Version 2 adds the render*/quiet*/meteors metrics and `probe`; a raf-cadence run keeps every version-1 figure.
      reportVersion: 2, probe: { cadence: first.probe.cadence, quietAlpha: first.probe.quietAlpha, seed: first.probe.seed },
      timestamp: new Date().toISOString(), browser: [...versions][0], channel: first.channel, platform: first.platform,
      gpuDevices: first.gpu?.devices?.map(d => d.deviceString), gpuFeatureStatus: first.gpu?.featureStatus,
      viewport: first.viewport, board: first.board, secondsPerSample: first.secondsPerSample, warmupSec: first.warmupSec,
      runsPerBuild: runs, order: 'ABBA interleaved', probeArgs: probe,
      base: { ref: baseRef, sha: baseSha, fingerprint: trees.base.fingerprint },
      current: { path: relative(process.cwd(), current) || '.', head, uncommitted: dirty,
        fingerprint: trees.current.fingerprint, unchangedDuringRuns: currentAfter === trees.current.fingerprint },
      runs: Object.fromEntries(['base', 'current'].map(build => [build, reports[build].map(r =>
        ({ machineLoadPct: r.machineLoadPct, startupWallMs: r.wallStartupMs, domContentLoadedMs: round(r.startup.domContentLoadedMs), canvasPixels: r.startup.canvasPixels,
          // Only with `-- --one-page-fit on|off`; a build without page-fit.js reports supported: false.
          ...(r.pageFit ? { pageFit: { supported: r.pageFit.supported, stage: r.pageFit.stage, zoom: r.pageFit.zoom,
            fitsVertically: r.pageFit.fitsVertically, coldFitMs: r.pageFit.coldFit?.durationMs ?? null } } : {}) }))])),
      scenes,
    };
    if (output) { await mkdir(resolve(output, '..'), { recursive: true }); await writeFile(resolve(output), `${JSON.stringify(summary, null, 2)}\n`); }

    const keys = ['gpuCpuMsPerSec', 'rendererCpuMsPerSec', 'browserCpuMsPerSec', 'gpuPrivateMiB', 'pageRendererPrivateMiB',
      'jsHeapMiB', 'canvasFps', ...(summary.probe.cadence === 'render' ? [] : ['rafFps', 'rafP95Ms']), 'renderFps', 'renderP95Ms',
      'canvasRenderMsPerFrame', 'rendererTaskMsPerSec', 'quietAlphaMax'];
    const cell = value => value ?? '-';
    const lines = [`${summary.browser} ${summary.channel}, ${first.viewport.width}x${first.viewport.height} DPR ${first.viewport.dpr}, ` +
      `${runs} runs/build x ${summary.secondsPerSample}s, cadence ${summary.probe.cadence}` +
      `${summary.probe.quietAlpha === null ? '' : `, quiet alpha forced to ${summary.probe.quietAlpha}`}${summary.probe.seed === null ? '' : `, seed ${summary.probe.seed}`}, machine load ${[...summary.runs.base, ...summary.runs.current].map(r => r.machineLoadPct).join('/')}%, base ${baseSha.slice(0, 7)} vs ${summary.current.path}` +
      `${summary.current.unchangedDuringRuns ? '' : ' (CHANGED DURING RUNS: discard)'}`];
    for (const [label, metrics] of Object.entries(scenes)) {
      lines.push(`\n${label}`, '| metric | base | current | delta |', '|---|---:|---:|---:|');
      for (const key of keys) lines.push(`| ${key} | ${cell(metrics[key].base)} | ${cell(metrics[key].current)} | ${metrics[key].deltaPct == null ? '-' : `${metrics[key].deltaPct}%`} |`);
    }
    process.stdout.write(`${lines.join('\n')}\n`);
    if (!summary.current.unchangedDuringRuns) process.exitCode = 2;
  } finally { rmSync(scratch, { recursive: true, force: true }); }
})().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
