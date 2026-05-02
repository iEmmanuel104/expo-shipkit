import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawnSync } from 'child_process';
import { detectJsOnlyChanges } from '../../src/core/updates/change-detector.js';

function runGit(args: string[], cwd: string): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return (r.stdout ?? '').trim();
}

function initRepo(cwd: string) {
  spawnSync('git', ['init', '-q'], { cwd });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd });
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd });
}

function commitAll(cwd: string, message: string) {
  spawnSync('git', ['add', '-A'], { cwd });
  spawnSync('git', ['commit', '-q', '-m', message], { cwd });
}

function writeFileFn(cwd: string, rel: string, content: string) {
  const full = path.join(cwd, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

describe('detectJsOnlyChanges', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shipkit-cd-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns indeterminate when no fromRef given', async () => {
    const result = await detectJsOnlyChanges(undefined, 'HEAD', tempDir);
    expect(result.indeterminate).toBe(true);
    expect(result.jsOnly).toBe(false);
  });

  it('returns indeterminate when fromRef does not exist', async () => {
    initRepo(tempDir);
    writeFileFn(tempDir, 'README.md', 'x');
    commitAll(tempDir, 'init');
    const result = await detectJsOnlyChanges('does-not-exist', 'HEAD', tempDir);
    expect(result.indeterminate).toBe(true);
  });

  it('flags JS-only when only .ts/.tsx files changed', async () => {
    initRepo(tempDir);
    writeFileFn(tempDir, 'app.json', JSON.stringify({ expo: { name: 'x', version: '1.0.0' } }));
    writeFileFn(tempDir, 'package.json', JSON.stringify({ name: 'x', dependencies: {} }));
    writeFileFn(tempDir, 'App.tsx', 'export default function A(){return null}');
    commitAll(tempDir, 'init');
    const base = runGit(['rev-parse', 'HEAD'], tempDir);

    writeFileFn(tempDir, 'App.tsx', 'export default function A(){return 1 as any}');
    writeFileFn(tempDir, 'src/feature.ts', 'export const x = 1;');
    commitAll(tempDir, 'js change');

    const result = await detectJsOnlyChanges(base, 'HEAD', tempDir);
    expect(result.jsOnly).toBe(true);
    expect(result.changedFiles).toContain('App.tsx');
    expect(result.changedFiles).toContain('src/feature.ts');
    expect(result.nativeReasons).toHaveLength(0);
  });

  it('flags as native when ios/ changes', async () => {
    initRepo(tempDir);
    writeFileFn(tempDir, 'app.json', JSON.stringify({ expo: { name: 'x' } }));
    writeFileFn(tempDir, 'package.json', JSON.stringify({ name: 'x' }));
    commitAll(tempDir, 'init');
    const base = runGit(['rev-parse', 'HEAD'], tempDir);

    writeFileFn(tempDir, 'ios/MyApp/AppDelegate.mm', '// native');
    commitAll(tempDir, 'native ios');

    const result = await detectJsOnlyChanges(base, 'HEAD', tempDir);
    expect(result.jsOnly).toBe(false);
    expect(result.nativeReasons.some((r) => r.includes('ios/'))).toBe(true);
  });

  it('flags as native when android/ changes', async () => {
    initRepo(tempDir);
    writeFileFn(tempDir, 'app.json', JSON.stringify({ expo: { name: 'x' } }));
    writeFileFn(tempDir, 'package.json', JSON.stringify({ name: 'x' }));
    commitAll(tempDir, 'init');
    const base = runGit(['rev-parse', 'HEAD'], tempDir);

    writeFileFn(tempDir, 'android/app/build.gradle', '// gradle');
    commitAll(tempDir, 'native android');

    const result = await detectJsOnlyChanges(base, 'HEAD', tempDir);
    expect(result.jsOnly).toBe(false);
    expect(result.nativeReasons.some((r) => r.includes('android/'))).toBe(true);
  });

  it('flags as native when app.json plugins change', async () => {
    initRepo(tempDir);
    writeFileFn(tempDir, 'app.json', JSON.stringify({ expo: { name: 'x', plugins: ['expo-camera'] } }));
    writeFileFn(tempDir, 'package.json', JSON.stringify({ name: 'x' }));
    commitAll(tempDir, 'init');
    const base = runGit(['rev-parse', 'HEAD'], tempDir);

    writeFileFn(tempDir, 'app.json', JSON.stringify({ expo: { name: 'x', plugins: ['expo-camera', 'expo-notifications'] } }));
    commitAll(tempDir, 'add plugin');

    const result = await detectJsOnlyChanges(base, 'HEAD', tempDir);
    expect(result.jsOnly).toBe(false);
    expect(result.nativeReasons.some((r) => r.includes('plugins'))).toBe(true);
  });

  it('does NOT flag as native when only non-native app.json keys change', async () => {
    initRepo(tempDir);
    writeFileFn(tempDir, 'app.json', JSON.stringify({ expo: { name: 'x', slug: 'old', plugins: [] } }));
    writeFileFn(tempDir, 'package.json', JSON.stringify({ name: 'x' }));
    commitAll(tempDir, 'init');
    const base = runGit(['rev-parse', 'HEAD'], tempDir);

    writeFileFn(tempDir, 'app.json', JSON.stringify({ expo: { name: 'x', slug: 'new', plugins: [] } }));
    commitAll(tempDir, 'rename slug');

    const result = await detectJsOnlyChanges(base, 'HEAD', tempDir);
    expect(result.jsOnly).toBe(true);
  });

  it('flags as native when version changes', async () => {
    initRepo(tempDir);
    writeFileFn(tempDir, 'app.json', JSON.stringify({ expo: { name: 'x', version: '1.0.0' } }));
    writeFileFn(tempDir, 'package.json', JSON.stringify({ name: 'x' }));
    commitAll(tempDir, 'init');
    const base = runGit(['rev-parse', 'HEAD'], tempDir);

    writeFileFn(tempDir, 'app.json', JSON.stringify({ expo: { name: 'x', version: '1.1.0' } }));
    commitAll(tempDir, 'bump version');

    const result = await detectJsOnlyChanges(base, 'HEAD', tempDir);
    expect(result.jsOnly).toBe(false);
    expect(result.nativeReasons.some((r) => r.includes('version'))).toBe(true);
  });

  it('flags as native when a native package is added', async () => {
    initRepo(tempDir);
    writeFileFn(tempDir, 'app.json', JSON.stringify({ expo: { name: 'x' } }));
    writeFileFn(tempDir, 'package.json', JSON.stringify({ name: 'x', dependencies: {} }));
    commitAll(tempDir, 'init');
    const base = runGit(['rev-parse', 'HEAD'], tempDir);

    writeFileFn(tempDir, 'package.json', JSON.stringify({
      name: 'x',
      dependencies: { 'expo-camera': '^14.0.0' },
    }));
    commitAll(tempDir, 'add native dep');

    const result = await detectJsOnlyChanges(base, 'HEAD', tempDir);
    expect(result.jsOnly).toBe(false);
    expect(result.nativeReasons.some((r) => r.includes('expo-camera'))).toBe(true);
  });

  it('flags as native when a native peer dependency is added', async () => {
    initRepo(tempDir);
    writeFileFn(tempDir, 'app.json', JSON.stringify({ expo: { name: 'x' } }));
    writeFileFn(tempDir, 'package.json', JSON.stringify({ name: 'x', peerDependencies: {} }));
    commitAll(tempDir, 'init');
    const base = runGit(['rev-parse', 'HEAD'], tempDir);

    writeFileFn(tempDir, 'package.json', JSON.stringify({
      name: 'x',
      peerDependencies: { '@stripe/stripe-react-native': '^0.38.0' },
    }));
    commitAll(tempDir, 'add native peer dep');

    const result = await detectJsOnlyChanges(base, 'HEAD', tempDir);
    expect(result.jsOnly).toBe(false);
    expect(result.nativeReasons.some((r) => r.includes('@stripe/stripe-react-native'))).toBe(true);
  });

  it('flags lockfile changes as native-risk changes', async () => {
    initRepo(tempDir);
    writeFileFn(tempDir, 'app.json', JSON.stringify({ expo: { name: 'x' } }));
    writeFileFn(tempDir, 'package.json', JSON.stringify({ name: 'x', dependencies: {} }));
    writeFileFn(tempDir, 'package-lock.json', JSON.stringify({ lockfileVersion: 3 }));
    commitAll(tempDir, 'init');
    const base = runGit(['rev-parse', 'HEAD'], tempDir);

    writeFileFn(tempDir, 'package-lock.json', JSON.stringify({ lockfileVersion: 3, packages: { '': {} } }));
    commitAll(tempDir, 'lockfile change');

    const result = await detectJsOnlyChanges(base, 'HEAD', tempDir);
    expect(result.jsOnly).toBe(false);
    expect(result.nativeReasons.some((r) => r.includes('package-lock.json'))).toBe(true);
  });

  it('does NOT flag as native when a JS-only package is added', async () => {
    initRepo(tempDir);
    writeFileFn(tempDir, 'app.json', JSON.stringify({ expo: { name: 'x' } }));
    writeFileFn(tempDir, 'package.json', JSON.stringify({ name: 'x', dependencies: {} }));
    commitAll(tempDir, 'init');
    const base = runGit(['rev-parse', 'HEAD'], tempDir);

    writeFileFn(tempDir, 'package.json', JSON.stringify({
      name: 'x',
      dependencies: { lodash: '^4.0.0' },
    }));
    commitAll(tempDir, 'add lodash');

    const result = await detectJsOnlyChanges(base, 'HEAD', tempDir);
    expect(result.jsOnly).toBe(true);
  });

  it('flags app.config.js change as potentially native', async () => {
    initRepo(tempDir);
    writeFileFn(tempDir, 'app.config.js', 'module.exports = { name: "x" };');
    writeFileFn(tempDir, 'package.json', JSON.stringify({ name: 'x' }));
    commitAll(tempDir, 'init');
    const base = runGit(['rev-parse', 'HEAD'], tempDir);

    writeFileFn(tempDir, 'app.config.js', 'module.exports = { name: "y" };');
    commitAll(tempDir, 'change config');

    const result = await detectJsOnlyChanges(base, 'HEAD', tempDir);
    expect(result.jsOnly).toBe(false);
    expect(result.nativeReasons.some((r) => r.includes('app.config'))).toBe(true);
  });

  it('includes uncommitted native-risk worktree changes', async () => {
    initRepo(tempDir);
    writeFileFn(tempDir, 'app.json', JSON.stringify({ expo: { name: 'x', version: '1.0.0' } }));
    writeFileFn(tempDir, 'package.json', JSON.stringify({ name: 'x', dependencies: {} }));
    writeFileFn(tempDir, 'App.tsx', 'export default null;');
    commitAll(tempDir, 'init');
    const base = runGit(['rev-parse', 'HEAD'], tempDir);

    writeFileFn(tempDir, 'App.tsx', 'export default 1;');
    writeFileFn(tempDir, 'package.json', JSON.stringify({
      name: 'x',
      dependencies: { 'expo-notifications': '^0.28.0' },
    }));

    const result = await detectJsOnlyChanges(base, 'HEAD', tempDir);
    expect(result.changedFiles).toContain('package.json');
    expect(result.jsOnly).toBe(false);
    expect(result.nativeReasons.some((r) => r.includes('expo-notifications'))).toBe(true);
  });
});
