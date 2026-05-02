import * as fs from 'fs';
import * as path from 'path';
import { execFile } from '../../utils/exec.js';

export interface JsOnlyChangeResult {
  jsOnly: boolean;
  changedFiles: string[];
  nativeReasons: string[];
  // Set when detection couldn't run (no git, no fromCommit, etc.) — caller should treat as "unknown".
  indeterminate?: boolean;
}

/**
 * Files / directories that always indicate a native rebuild is required.
 */
const NATIVE_PATH_PREFIXES = ['ios/', 'android/'];

/**
 * Refs are validated before being passed to git. Paths come from git output,
 * but still reject NUL bytes before constructing git object specifiers.
 */
const REF_PATTERN = /^[a-zA-Z0-9_./-]{1,200}$/;
const LOCKFILE_NAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lock',
  'bun.lockb',
]);

function isSafeRef(ref: string): boolean {
  return REF_PATTERN.test(ref);
}
function isSafePath(p: string): boolean {
  return p.length > 0 && !p.includes('\0');
}

/**
 * Detect whether the diff between two refs is JS-only (safe to ship as OTA).
 *
 * Returns `jsOnly: false` whenever native code, config plugins, native deps, or
 * runtime/version-bound config keys change. Returns `indeterminate: true` when
 * git is unavailable or `fromRef` is missing — caller should treat that as
 * "fall through to a real build" rather than risking a bad OTA.
 */
export async function detectJsOnlyChanges(
  fromRef: string | undefined,
  toRef: string = 'HEAD',
  projectRoot?: string,
): Promise<JsOnlyChangeResult> {
  const cwd = projectRoot ?? process.cwd();

  if (!fromRef || !isSafeRef(fromRef) || !isSafeRef(toRef)) {
    return { jsOnly: false, changedFiles: [], nativeReasons: [], indeterminate: true };
  }

  // Verify the from-ref exists.
  const fromExists = await execFile('git', ['rev-parse', '--verify', fromRef], { cwd, silent: true, timeout: 3000 });
  if (fromExists.code !== 0) {
    return { jsOnly: false, changedFiles: [], nativeReasons: [], indeterminate: true };
  }

  const diff = await execFile('git', ['diff', '--name-only', fromRef, toRef], { cwd, silent: true, timeout: 5000 });

  if (diff.code !== 0) {
    return { jsOnly: false, changedFiles: [], nativeReasons: [], indeterminate: true };
  }

  const changedFiles = new Set(diff.stdout.split('\n').map((s) => s.trim()).filter(Boolean));
  if (toRef === 'HEAD') {
    const worktreeFiles = await getWorktreeChangedFiles(cwd);
    if (worktreeFiles === null) {
      return { jsOnly: false, changedFiles: [...changedFiles], nativeReasons: [], indeterminate: true };
    }
    for (const file of worktreeFiles) {
      changedFiles.add(file);
    }
  }

  const nativeReasons: string[] = [];

  for (const file of changedFiles) {
    if (NATIVE_PATH_PREFIXES.some((prefix) => file.startsWith(prefix))) {
      nativeReasons.push(file + ' touches native code (' + file.split('/')[0] + '/)');
      continue;
    }

    if (LOCKFILE_NAMES.has(file)) {
      nativeReasons.push(file + ' changed — dependency graph may affect native runtime');
      continue;
    }

    if (file === 'app.json' || file.startsWith('app.config.')) {
      const reason = await diffAppConfig(file, fromRef, toRef, cwd);
      if (reason) nativeReasons.push(reason);
      continue;
    }

    if (file === 'package.json') {
      const reason = await diffPackageJson(fromRef, toRef, cwd);
      if (reason) nativeReasons.push(reason);
      continue;
    }
  }

  return {
    jsOnly: nativeReasons.length === 0,
    changedFiles: [...changedFiles],
    nativeReasons,
  };
}

async function getWorktreeChangedFiles(cwd: string): Promise<string[] | null> {
  const diff = await execFile('git', ['diff', '--name-only', 'HEAD'], { cwd, silent: true, timeout: 5000 });
  if (diff.code !== 0) return null;

  const untracked = await execFile('git', ['ls-files', '--others', '--exclude-standard'], { cwd, silent: true, timeout: 5000 });
  if (untracked.code !== 0) return null;

  return [...diff.stdout.split('\n'), ...untracked.stdout.split('\n')]
    .map((s) => s.trim())
    .filter(Boolean);
}

async function showFile(ref: string, filePath: string, cwd: string): Promise<string | null> {
  if (!isSafeRef(ref) || !isSafePath(filePath)) return null;
  const result = await execFile('git', ['show', ref + ':' + filePath], { cwd, silent: true, timeout: 3000 });
  return result.code === 0 ? result.stdout : null;
}

function readWorktreeFile(absPath: string): string {
  try {
    return fs.readFileSync(absPath, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Inspect app.json/app.config.* changes for keys that bind to native build inputs.
 * For app.config.{js,ts,cjs,mjs} we cannot evaluate the file safely — any change
 * is treated as potentially native.
 */
async function diffAppConfig(
  file: string,
  fromRef: string,
  toRef: string,
  cwd: string,
): Promise<string | null> {
  if (file !== 'app.json') {
    return file + ' changed — config plugins / native settings may be affected';
  }

  const oldRaw = await showFile(fromRef, file, cwd);
  if (oldRaw === null) {
    return file + ' changed (could not read previous version)';
  }

  const newRaw = toRef === 'HEAD'
    ? readWorktreeFile(path.join(cwd, file))
    : (await showFile(toRef, file, cwd)) ?? readWorktreeFile(path.join(cwd, file));

  let oldJson: Record<string, unknown> | null = null;
  let newJson: Record<string, unknown> | null = null;
  try { oldJson = JSON.parse(oldRaw); } catch { /* empty */ }
  try { newJson = JSON.parse(newRaw); } catch { /* empty */ }

  if (!oldJson || !newJson) {
    return file + ' changed (could not parse one revision)';
  }

  const oldExpo = (oldJson as { expo?: Record<string, unknown> }).expo ?? {};
  const newExpo = (newJson as { expo?: Record<string, unknown> }).expo ?? {};

  const NATIVE_KEYS = [
    'plugins',
    'sdkVersion',
    'runtimeVersion',
    'version',
    'ios',
    'android',
    'updates',
    'scheme',
    'orientation',
    'icon',
    'splash',
    'notification',
    'assetBundlePatterns',
    'locales',
    'userInterfaceStyle',
    'experiments',
    'newArchEnabled',
  ];
  for (const key of NATIVE_KEYS) {
    if (JSON.stringify(oldExpo[key]) !== JSON.stringify(newExpo[key])) {
      return 'app.json/expo.' + key + ' changed';
    }
  }
  return null;
}

/**
 * Native-binding package patterns. Anything matching forces a native rebuild.
 */
const NATIVE_PACKAGE_PATTERNS = [
  /^react-native(-|$)/,
  /^@react-native(\/|$)/,
  /^expo(-|$)/,
  /^@expo\//,
  /^expo-modules-core$/,
  /^expo-updates$/,
  /^expo-camera$/,
  /^expo-notifications$/,
  /^expo-location$/,
  /^expo-image-picker$/,
  /^expo-av$/,
  /^expo-file-system$/,
  /^expo-secure-store$/,
  /^expo-sensors$/,
  /^expo-haptics$/,
  /^expo-task-manager$/,
  /^expo-background-fetch$/,
  /^expo-keep-awake$/,
  /^expo-local-authentication$/,
  /^expo-tracking-transparency$/,
  /^expo-build-properties$/,
  /^@stripe\/stripe-react-native$/,
];

function isNativePackageName(name: string): boolean {
  return NATIVE_PACKAGE_PATTERNS.some((re) => re.test(name));
}

async function diffPackageJson(
  fromRef: string,
  toRef: string,
  cwd: string,
): Promise<string | null> {
  const oldRaw = await showFile(fromRef, 'package.json', cwd);
  if (oldRaw === null) {
    return 'package.json changed (could not read previous version)';
  }
  const newRaw = toRef === 'HEAD'
    ? readWorktreeFile(path.join(cwd, 'package.json'))
    : (await showFile(toRef, 'package.json', cwd)) ?? readWorktreeFile(path.join(cwd, 'package.json'));

  let oldDeps: Record<string, string> = {};
  let newDeps: Record<string, string> = {};
  try {
    oldDeps = readNativeDependencyFields(JSON.parse(oldRaw) as PackageJsonLike);
  } catch {
    return 'package.json changed (could not parse previous version)';
  }
  try {
    newDeps = readNativeDependencyFields(JSON.parse(newRaw) as PackageJsonLike);
  } catch {
    return 'package.json changed (could not parse new version)';
  }

  const allNames = new Set([...Object.keys(oldDeps), ...Object.keys(newDeps)]);
  for (const name of allNames) {
    if (oldDeps[name] === newDeps[name]) continue;
    if (isNativePackageName(name)) {
      const change = !oldDeps[name]
        ? 'added ' + name
        : !newDeps[name]
          ? 'removed ' + name
          : name + ' ' + oldDeps[name] + ' → ' + newDeps[name];
      return 'package.json native dependency changed (' + change + ')';
    }
  }
  return null;
}

interface PackageJsonLike {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

function readNativeDependencyFields(pkgJson: PackageJsonLike): Record<string, string> {
  return {
    ...(pkgJson.dependencies ?? {}),
    ...(pkgJson.peerDependencies ?? {}),
    ...(pkgJson.optionalDependencies ?? {}),
  };
}

/**
 * Get the current git HEAD short hash (or null if not a git repo).
 */
export async function getCurrentCommit(projectRoot?: string): Promise<string | null> {
  const cwd = projectRoot ?? process.cwd();
  const result = await execFile('git', ['rev-parse', 'HEAD'], { cwd, silent: true, timeout: 3000 });
  if (result.code !== 0) return null;
  return result.stdout.trim() || null;
}

/**
 * Get the latest commit subject (used as default OTA message when set to 'auto').
 */
export async function getLatestCommitSubject(projectRoot?: string): Promise<string | null> {
  const cwd = projectRoot ?? process.cwd();
  const result = await execFile('git', ['log', '-1', '--pretty=%s'], { cwd, silent: true, timeout: 3000 });
  if (result.code !== 0) return null;
  return result.stdout.trim() || null;
}
