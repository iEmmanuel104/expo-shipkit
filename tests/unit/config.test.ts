import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { isExpoProject, isInitialized, loadAppJson, getProjectName } from '../../src/core/config/loader.js';
import { generateConfigContent, defaultConfig } from '../../src/core/config/defaults.js';
import { ShipkitConfigSchema, defineConfig } from '../../src/types/config.js';

describe('Config Loader', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shipkit-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('isExpoProject', () => {
    it('should return false for non-expo project', () => {
      expect(isExpoProject(tempDir)).toBe(false);
    });

    it('should return true for expo project', () => {
      const appJsonPath = path.join(tempDir, 'app.json');
      fs.writeFileSync(appJsonPath, JSON.stringify({
        expo: { name: 'Test', slug: 'test', version: '1.0.0' }
      }));

      expect(isExpoProject(tempDir)).toBe(true);
    });

    it('should return false for non-expo app.json', () => {
      const appJsonPath = path.join(tempDir, 'app.json');
      fs.writeFileSync(appJsonPath, JSON.stringify({ name: 'Not Expo' }));

      expect(isExpoProject(tempDir)).toBe(false);
    });
  });

  describe('isInitialized', () => {
    it('should return false when no config exists', () => {
      expect(isInitialized(tempDir)).toBe(false);
    });

    it('should return true when shipkit.config.ts exists', () => {
      const configPath = path.join(tempDir, 'shipkit.config.ts');
      fs.writeFileSync(configPath, 'export default {}');

      expect(isInitialized(tempDir)).toBe(true);
    });

    it('should return true when .shipkitrc exists', () => {
      const configPath = path.join(tempDir, '.shipkitrc');
      fs.writeFileSync(configPath, '{}');

      expect(isInitialized(tempDir)).toBe(true);
    });
  });

  describe('loadAppJson', () => {
    it('should return null when app.json does not exist', () => {
      expect(loadAppJson(tempDir)).toBeNull();
    });

    it('should load app.json content', () => {
      const appJsonPath = path.join(tempDir, 'app.json');
      const appData = { expo: { name: 'Test', slug: 'test', version: '1.0.0' } };
      fs.writeFileSync(appJsonPath, JSON.stringify(appData));

      const result = loadAppJson(tempDir);
      expect(result?.expo.name).toBe('Test');
      expect(result?.expo.version).toBe('1.0.0');
    });
  });

  describe('getProjectName', () => {
    it('should return null when no app.json', () => {
      expect(getProjectName(tempDir)).toBeNull();
    });

    it('should return project name from app.json', () => {
      const appJsonPath = path.join(tempDir, 'app.json');
      fs.writeFileSync(appJsonPath, JSON.stringify({
        expo: { name: 'My App', slug: 'my-app', version: '1.0.0' }
      }));

      expect(getProjectName(tempDir)).toBe('My App');
    });
  });
});

describe('Config Schema', () => {
  it('should parse minimal config', () => {
    const config = ShipkitConfigSchema.parse({});
    expect(config.platforms.ios).toBe(true);
    expect(config.platforms.android).toBe(true);
  });

  it('should parse full config', () => {
    const config = ShipkitConfigSchema.parse({
      projectName: 'Test',
      platforms: { ios: true, android: false },
      profiles: ['preview'],
      build: {
        android: { nonInteractive: false },
        ios: { nonInteractive: true },
        autoClearCache: false,
      },
    });

    expect(config.projectName).toBe('Test');
    expect(config.platforms.android).toBe(false);
    expect(config.build.autoClearCache).toBe(false);
  });

  it('should use defineConfig helper', () => {
    const config = defineConfig({
      projectName: 'MyApp',
    });

    expect(config.projectName).toBe('MyApp');
    expect(config.platforms.ios).toBe(true);
  });
});

describe('Config Defaults', () => {
  it('should have correct default values', () => {
    expect(defaultConfig.platforms.ios).toBe(true);
    expect(defaultConfig.platforms.android).toBe(true);
    expect(defaultConfig.profiles).toContain('preview');
    expect(defaultConfig.profiles).toContain('production');
    expect(defaultConfig.build.autoClearCache).toBe(true);
  });

  it('should generate valid config content', () => {
    const content = generateConfigContent('TestApp');

    expect(content).toContain("projectName: 'TestApp'");
    expect(content).toContain('defineConfig');
    expect(content).toContain('expo-shipkit');
  });
});
