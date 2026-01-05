import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { VersionManager, compareVersions, isNewerVersion } from '../../src/core/version/manager.js';

describe('VersionManager', () => {
  let tempDir: string;
  let appJsonPath: string;
  let packageJsonPath: string;

  beforeEach(() => {
    // Create temp directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shipkit-test-'));
    appJsonPath = path.join(tempDir, 'app.json');
    packageJsonPath = path.join(tempDir, 'package.json');

    // Create mock files
    fs.writeFileSync(appJsonPath, JSON.stringify({
      expo: { version: '1.0.0', name: 'Test' }
    }, null, 2));
    fs.writeFileSync(packageJsonPath, JSON.stringify({
      version: '1.0.0', name: 'test'
    }, null, 2));
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should get current version', () => {
    const manager = new VersionManager(tempDir);
    expect(manager.getCurrentVersion()).toBe('1.0.0');
  });

  it('should calculate patch version correctly', () => {
    const manager = new VersionManager(tempDir);
    expect(manager.calculateNewVersion('1.0.0', 'patch')).toBe('1.0.1');
    expect(manager.calculateNewVersion('1.2.3', 'patch')).toBe('1.2.4');
  });

  it('should calculate minor version correctly', () => {
    const manager = new VersionManager(tempDir);
    expect(manager.calculateNewVersion('1.0.0', 'minor')).toBe('1.1.0');
    expect(manager.calculateNewVersion('1.2.3', 'minor')).toBe('1.3.0');
  });

  it('should calculate major version correctly', () => {
    const manager = new VersionManager(tempDir);
    expect(manager.calculateNewVersion('1.0.0', 'major')).toBe('2.0.0');
    expect(manager.calculateNewVersion('1.2.3', 'major')).toBe('2.0.0');
  });

  it('should return same version for none', () => {
    const manager = new VersionManager(tempDir);
    expect(manager.calculateNewVersion('1.2.3', 'none')).toBe('1.2.3');
  });

  it('should bump version in both files', () => {
    const manager = new VersionManager(tempDir);
    const result = manager.bump('patch');

    expect(result.oldVersion).toBe('1.0.0');
    expect(result.newVersion).toBe('1.0.1');

    // Check files were updated
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    expect(appJson.expo.version).toBe('1.0.1');
    expect(packageJson.version).toBe('1.0.1');
  });

  it('should set specific version', () => {
    const manager = new VersionManager(tempDir);
    const result = manager.setVersion('2.5.0');

    expect(result).toBe('2.5.0');

    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    expect(appJson.expo.version).toBe('2.5.0');
  });

  it('should throw on invalid version format', () => {
    const manager = new VersionManager(tempDir);
    expect(() => manager.setVersion('invalid')).toThrow();
    expect(() => manager.setVersion('1.0')).toThrow();
    expect(() => manager.setVersion('1.0.0.0')).toThrow();
  });
});

describe('compareVersions', () => {
  it('should compare equal versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('2.5.3', '2.5.3')).toBe(0);
  });

  it('should compare different major versions', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
  });

  it('should compare different minor versions', () => {
    expect(compareVersions('1.1.0', '1.2.0')).toBe(-1);
    expect(compareVersions('1.2.0', '1.1.0')).toBe(1);
  });

  it('should compare different patch versions', () => {
    expect(compareVersions('1.0.1', '1.0.2')).toBe(-1);
    expect(compareVersions('1.0.2', '1.0.1')).toBe(1);
  });
});

describe('isNewerVersion', () => {
  it('should detect newer versions', () => {
    expect(isNewerVersion('2.0.0', '1.0.0')).toBe(true);
    expect(isNewerVersion('1.1.0', '1.0.0')).toBe(true);
    expect(isNewerVersion('1.0.1', '1.0.0')).toBe(true);
  });

  it('should detect older or equal versions', () => {
    expect(isNewerVersion('1.0.0', '2.0.0')).toBe(false);
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
  });
});
