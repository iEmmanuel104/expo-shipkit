import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  readRuntimeVersion,
  resolveRuntimeVersion,
  writeRuntimeVersionPolicy,
  hasUpdatesUrl,
} from '../../src/core/updates/runtime-version.js';

describe('runtime-version helpers', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shipkit-rv-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function writeAppJson(data: unknown) {
    fs.writeFileSync(path.join(tempDir, 'app.json'), JSON.stringify(data, null, 2));
  }
  function readAppJson(): { expo?: Record<string, unknown> } {
    return JSON.parse(fs.readFileSync(path.join(tempDir, 'app.json'), 'utf8'));
  }

  describe('readRuntimeVersion', () => {
    it('returns null when no app.json', () => {
      expect(readRuntimeVersion(tempDir)).toBeNull();
    });

    it('returns null when runtimeVersion not set', () => {
      writeAppJson({ expo: { name: 'x' } });
      expect(readRuntimeVersion(tempDir)).toBeNull();
    });

    it('returns string runtimeVersion', () => {
      writeAppJson({ expo: { name: 'x', runtimeVersion: '1.2.3' } });
      expect(readRuntimeVersion(tempDir)).toBe('1.2.3');
    });

    it('returns policy object', () => {
      writeAppJson({ expo: { name: 'x', runtimeVersion: { policy: 'appVersion' } } });
      expect(readRuntimeVersion(tempDir)).toEqual({ policy: 'appVersion' });
    });
  });

  describe('resolveRuntimeVersion', () => {
    it('returns the literal string', () => {
      writeAppJson({ expo: { name: 'x', runtimeVersion: '2.0.0' } });
      expect(resolveRuntimeVersion(tempDir)).toBe('2.0.0');
    });

    it('renders policy form as bracketed marker', () => {
      writeAppJson({ expo: { name: 'x', runtimeVersion: { policy: 'fingerprint' } } });
      expect(resolveRuntimeVersion(tempDir)).toBe('[policy:fingerprint]');
    });

    it('returns null when not set', () => {
      writeAppJson({ expo: { name: 'x' } });
      expect(resolveRuntimeVersion(tempDir)).toBeNull();
    });
  });

  describe('writeRuntimeVersionPolicy', () => {
    it('returns false when app.json missing', () => {
      expect(writeRuntimeVersionPolicy('appVersion', tempDir)).toBe(false);
    });

    it('writes policy and returns true', () => {
      writeAppJson({ expo: { name: 'x' } });
      expect(writeRuntimeVersionPolicy('appVersion', tempDir)).toBe(true);
      const after = readAppJson();
      expect((after.expo as { runtimeVersion?: unknown }).runtimeVersion).toEqual({ policy: 'appVersion' });
    });

    it('is idempotent — returns false when policy already matches', () => {
      writeAppJson({ expo: { name: 'x', runtimeVersion: { policy: 'sdkVersion' } } });
      expect(writeRuntimeVersionPolicy('sdkVersion', tempDir)).toBe(false);
    });

    it('overwrites a different policy', () => {
      writeAppJson({ expo: { name: 'x', runtimeVersion: { policy: 'appVersion' } } });
      expect(writeRuntimeVersionPolicy('fingerprint', tempDir)).toBe(true);
      const after = readAppJson();
      expect((after.expo as { runtimeVersion?: unknown }).runtimeVersion).toEqual({ policy: 'fingerprint' });
    });
  });

  describe('hasUpdatesUrl', () => {
    it('returns false when no app.json', () => {
      expect(hasUpdatesUrl(tempDir)).toBe(false);
    });

    it('returns false when updates.url missing', () => {
      writeAppJson({ expo: { name: 'x' } });
      expect(hasUpdatesUrl(tempDir)).toBe(false);
    });

    it('returns true when updates.url present', () => {
      writeAppJson({ expo: { name: 'x', updates: { url: 'https://u.expo.dev/abc' } } });
      expect(hasUpdatesUrl(tempDir)).toBe(true);
    });
  });
});
