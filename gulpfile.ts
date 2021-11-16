import path from 'path';
import rmrf from 'rmrf';
import { ChildProcess, execSync, spawn, SpawnOptions } from 'child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync, Dirent } from 'fs';

import gulp from 'gulp';
import gulpSm from 'gulp-sourcemaps';
import gulpTs from 'gulp-typescript';
import { EventEmitter } from 'events';

const PathTo = {
  Source: __dirname,
  Built: path.resolve('.', '.built'),
  Bundled: path.resolve('.', '.bundled'),
  Jest: path.resolve('.', '.jest'),
};
const KeyTo = {
  BuiltRoots: 'builtRoots',
  SourceRoots: 'sourceRoots',
  Bundles: 'bundles',
};
const spawnOpts: SpawnOptions = {
  shell: true,
  cwd: __dirname,
  stdio: ['ignore', 'pipe', 'pipe'],
};
const Tools = {
  Tfx: which('tfx'),
  Yarn: which('yarn'),
  Jest: which('jest'),
};

// These control that arch and platform of the target system for yarn dependency installation
const yarnArgs = ['--ignore-optional'];

const memCache: { [key: string]: any } = {};
async function withCache<T = any>(key: string, factory: () => Promise<T>): Promise<T> {
  memCache[key] = memCache[key] || (await factory());
  return memCache[key];
}

async function withMany<TIn = any, TOut = any>(sources: TIn[], handler: (source: TIn) => Promise<TOut> | EventEmitter) {
  const results = await Promise.all(
    sources.map((source) => {
      const result = handler(source);
      if (result instanceof EventEmitter) {
        return new Promise((resolve, reject) => {
          result
            .on('error', (...args: any[]) => {
              reject(...args);
            })
            .on('end', (...args: any[]) => {
              resolve(args);
            });
        });
      }
      return result;
    })
  );
  return results;
}

function which(tool: string) {
  const toolPath = execSync(`which ${tool}`).toString().trim();
  return toolPath;
}

function waitForProcess(childProcess: ChildProcess) {
  return new Promise<ChildProcessResult>((resolve, reject) => {
    const stdoutChunks: any[] = [];
    const stderrChunks: any[] = [];
    if (childProcess.stdout) childProcess.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
    if (childProcess.stderr) childProcess.stderr.on('data', (chunk) => stderrChunks.push(chunk));
    childProcess.once('exit', (code: number) => {
      if (code === 0) {
        resolve({
          code,
          stdout: stdoutChunks.join('\n').trim(),
          stderr: stderrChunks.join('\n').trim(),
        });
      } else {
        reject({
          code,
          stdout: stdoutChunks.join('\n').trim(),
          stderr: stderrChunks.join('\n').trim(),
        });
      }
    });
    childProcess.once('error', (err: any) => {
      reject(err);
    });
  });
}

function printOutput(tag: string, output: string) {
  console.log(
    `${tag}:\n${output
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l) => `\t${l}`)
      .join('\n')}\n`
  );
}

function createPathTos() {
  // Pre-make the paths
  Object.values(PathTo)
    .filter((p) => !existsSync(p))
    .forEach((p) => mkdirSync(p, { recursive: true }));
}

async function getAllRootsFrom(base: string, filter?: (value: Dirent, index: number, array: Dirent[]) => boolean) {
  const entries = readdirSync(base, { withFileTypes: true });
  return Promise.resolve(
    entries.filter((v, i, a) => (!!filter ? filter(v, i, a) : true)).map((ent) => path.resolve(base, ent.name))
  );
}

async function getAllSourceRoots() {
  return withCache(KeyTo.SourceRoots, async () =>
    Promise.resolve(
      getAllRootsFrom(
        PathTo.Source,
        (ent) => ent.isDirectory() && existsSync(path.join(ent.name, 'vss-extension.json'))
      )
    )
  );
}

async function getAllBuiltRoots() {
  return withCache(KeyTo.BuiltRoots, async () =>
    Promise.resolve(
      getAllRootsFrom(PathTo.Built, (ent) => ent.isDirectory() && existsSync(path.join(ent.name, 'vss-extension.json')))
    )
  );
}

async function getAllBundles() {
  return withCache(KeyTo.Bundles, async () => {
    const files = readdirSync(PathTo.Bundled);
    return Promise.resolve(files.filter((f) => f.endsWith('vsix')).map((f) => path.join(PathTo.Bundled, f)));
  });
}

async function readJson<T = any>(fromFile: string) {
  return Promise.resolve(JSON.parse(readFileSync(fromFile).toString()) as T);
}

async function writeJson<T = any>(data: T, toFile: string) {
  writeFileSync(toFile, JSON.stringify(data, undefined, 2));
  return Promise.resolve();
}

async function updateExtensions(...folders: string[]) {
  await withMany(folders, async (folder) => {
    const taskFilePath = path.join(folder, 'task.json');
    const packageFilePath = path.join(folder, 'package.json');
    const manifestFilePath = path.join(folder, 'vss-extension.json');
    const isTask = existsSync(taskFilePath);

    const [_task, _package, _manifest] = await Promise.all([
      isTask ? readJson<VssTask>(taskFilePath) : Promise.resolve(undefined),
      readJson<NpmPackage>(packageFilePath),
      readJson<VssManifest>(manifestFilePath),
    ]);

    const userArgs = process.argv.slice(3).map((a) => (a.includes(' ') ? `"${a}"` : a));
    const cliVersion =
      userArgs.indexOf('--cli-version') >= 0 ? userArgs[userArgs.indexOf('--cli-version') + 1] : undefined;
    const finalVersion =
      cliVersion ||
      _manifest.version
        .split('.')
        .map((v, i) => (i === 2 ? parseInt(v) + 1 : v)) // Only increment the patch segment
        .join('.');
    const finalVersionParts = finalVersion.split('.').map((s) => parseInt(s));

    if (_task) {
      _task.version.Major = finalVersionParts[0];
      _task.version.Minor = finalVersionParts[1];
      _task.version.Patch = finalVersionParts[2];
      _task.execution = {
        Node10: {
          target: _package.main,
        },
      };
      _task.helpMarkDown = _task.description = _package.description;
    }

    _manifest.id = _package.name;
    _manifest.name = _package.name
      .split('-')
      .map((s) => `${s[0].toUpperCase()}${s.slice(1)}`)
      .join(' ');
    _manifest.description = _package.description;
    _manifest.version = finalVersion;
    if (isTask) {
      _manifest.files = [{ path: 'task' }];
      _manifest.contributions = [
        {
          id: _manifest.id,
          type: 'ms.vss-distributed-task.task',
          targets: ['ms.vss-distributed-task.tasks'],
          properties: { name: 'task' },
        },
      ];
    }

    await Promise.all([
      isTask ? writeJson(_task, taskFilePath) : Promise.resolve(),
      writeJson(_manifest, manifestFilePath),
    ]);
  });
}

async function compileExtensions(...folders: string[]): Promise<void> {
  await withMany(
    folders.filter((f) => existsSync(path.join(f, 'tsconfig.json'))),
    (folder) => {
      const tsProj = gulpTs.createProject(path.join(folder, 'tsconfig.json'));
      const includes = [`${folder}/**/*.ts`, `${folder}/**/*.d.ts`, `./*.d.ts`];
      const excludes = [`!${folder}/tests/**/*`];
      const reporter = gulpTs.reporter.fullReporter();
      return gulp
        .src([...includes, ...excludes])
        .pipe(gulpSm.init())
        .pipe(tsProj(reporter))
        .pipe(gulpSm.write())
        .pipe(gulp.dest(path.join(PathTo.Built, path.basename(folder), 'task')));
    }
  );
}

async function copyExtensionAssets(...folders: string[]) {
  await withMany(folders, async (folder) => {
    const stageFolder = path.join(PathTo.Built, path.basename(folder));
    const includes = ['json', 'png', 'html', 'js', 'md'].map((ext) => `${folder}/**/*.${ext}`);
    const excludes = [
      `!${folder}/node_modules/**/*`,
      `!${folder}/(tsconfig|vss-extension).json`,
      `!${folder}/tests/**/*`,
    ];
    const isTask = existsSync(path.join(folder, 'task.json'));
    const _manifest = await readJson<VssManifest>(path.join(folder, 'vss-extension.json'));
    const iconPath = path.basename(_manifest.icons.default);
    copyFileSync(path.join(folder, 'vss-extension.json'), path.join(stageFolder, 'vss-extension.json'));
    copyFileSync(path.join(folder, iconPath), path.join(stageFolder, iconPath));
    return gulp.src([...includes, ...excludes]).pipe(gulp.dest(path.join(stageFolder, isTask ? 'task' : '')));
  });
}

async function installExtensionDeps(...folders: string[]) {
  await withMany(folders, async (folder) => {
    const args = [
      '--cwd',
      `${folder}/task`,
      'install',
      '--production',
      '--no-lockfile',
      '--silent',
      '--non-interactive',
      ...yarnArgs,
    ];
    return await waitForProcess(spawn(Tools.Yarn, args, { ...spawnOpts }));
  });
}

async function installExtensionDepsDev(...folders: string[]) {
  await withMany(folders, async (folder) => {
    const args = ['--cwd', `${folder}`, 'install', '--silent', ...yarnArgs];
    return await waitForProcess(spawn(Tools.Yarn, args, { ...spawnOpts }));
  });
}

async function testExtensions() {
  const args: string[] = ['--runInBand'];
  const userArgs = getUserArgs().map((a) => (a.includes(' ') ? `"${a}"` : a));
  await waitForProcess(
    spawn(Tools.Jest, [...args, ...userArgs], { ...spawnOpts, stdio: ['ignore', 'inherit', 'inherit'] })
  );
}

async function makeExtensionBuildFolders(...folders: string[]) {
  await withMany(folders, async (folder) => {
    mkdirSync(path.join(PathTo.Built, path.basename(folder)), { recursive: true });
  });
}

async function bundleExtensions(...folders: string[]) {
  await withMany(folders, async (folder) => {
    const args = [
      'extension',
      'create',
      '--no-color',
      '--no-prompt',
      '--manifest-globs',
      'vss-extension.json',
      '--root',
      folder,
      '--output-path',
      PathTo.Bundled,
    ];
    const result = await waitForProcess(spawn(Tools.Tfx, args, { ...spawnOpts, cwd: folder }));
    printOutput(path.basename(folder), result.stdout);
  });
}

async function publishExtensions(...files: string[]) {
  const token = process.env.TFX_PUBLISH_TOKEN;
  if (!token || token.length < 52) {
    throw new Error(`Cannot publish without a token in TFX_PUBLISH_TOKEN!`);
  }
  await withMany(files, async (file) => {
    const args = [
      'extension',
      'publish',
      '--no-color',
      '--no-prompt',
      '--auth-type',
      'pat',
      '--token',
      token,
      '--vsix',
      file,
    ];
    try {
      const result = await waitForProcess(spawn(Tools.Tfx, args, { ...spawnOpts }));
      printOutput(path.basename(file), result.stdout);
    } catch (error) {
      printOutput(path.basename(file), (error as any).stdout);
    }
  });
}

export async function install() {
  try {
    const taskFolders = await getAllSourceRoots();
    await installExtensionDepsDev(...taskFolders);
  } catch (error: any) {
    handleError(error);
  }
}

export async function clean() {
  try {
    rmrf(PathTo.Built);
    rmrf(PathTo.Bundled);
    rmrf(PathTo.Jest);
    createPathTos();
  } catch (error: any) {
    handleError(error);
  }
}

export async function manifest() {
  try {
    const taskFolders = await getAllSourceRoots();
    await updateExtensions(...taskFolders);
  } catch (error: any) {
    handleError(error);
  }
}

export async function build() {
  try {
    rmrf(PathTo.Built);
    createPathTos();

    const taskFolders = await getAllSourceRoots();

    await Promise.all([updateExtensions(...taskFolders), makeExtensionBuildFolders(...taskFolders)]);
    await Promise.all([compileExtensions(...taskFolders), copyExtensionAssets(...taskFolders)]);

    const builtFolders = await getAllBuiltRoots();
    await installExtensionDeps(...builtFolders);
  } catch (error: any) {
    handleError(error);
  }
}

function getUserArgs() {
  const argsIndex = process.argv.indexOf('--args');
  const hasArgs = argsIndex >= 2;
  return hasArgs ? process.argv.slice(argsIndex + 1) : [];
}

export async function test() {
  try {
    await testExtensions();
  } catch (error: any) {
    handleError(error);
  }
}

export async function bundle() {
  try {
    rmrf(PathTo.Bundled);
    createPathTos();

    const builtFolders = await getAllBuiltRoots();
    await bundleExtensions(...builtFolders);
  } catch (error: any) {
    handleError(error);
  }
}

export async function publish() {
  try {
    const vsixFiles = await getAllBundles();
    await publishExtensions(...vsixFiles);
  } catch (error: any) {
    handleError(error);
  }
}

function handleError(error: any) {
  if (!error) return;
  const isError = error instanceof Error;
  const finalError = isError ? `${error.name} Error: ${error.message} ${error.stack}` : (error as string);
  console.error(finalError);
}

type ChildProcessResult = { code: number; stdout: string; stderr: string };

type VssTask = {
  description: string;
  helpMarkDown: string;
  version: { Major: number; Minor: number; Patch: number };
  execution: { [key: string]: { [key: string]: string } };
};

type VssManifest = {
  id: string;
  name: string;
  description: string;
  version: string;
  icons: { [key: string]: string };
  files: { path: string }[];
  contributions: {
    id: string;
    type: string;
    targets: string[];
    properties: {
      name: string;
    };
  }[];
};

type NpmPackage = {
  name: string;
  main: string;
  version: string;
  author: string;
  license: string;
  description: string;
};
