import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DeploymentTracker, formatDate } from '../../src/core/deployment/tracker.js';

describe('DeploymentTracker', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shipkit-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should initialize empty tracker', () => {
    const tracker = new DeploymentTracker(tempDir);
    expect(tracker.exists()).toBe(false);

    tracker.initialize();
    expect(tracker.exists()).toBe(true);
  });

  it('should get empty status for unknown version', () => {
    const tracker = new DeploymentTracker(tempDir);
    const status = tracker.getVersionStatus('1.0.0');

    expect(status.ios.preview).toBeNull();
    expect(status.ios.production).toBeNull();
    expect(status.android.preview).toBeNull();
    expect(status.android.production).toBeNull();
  });

  it('should update deployment status', () => {
    const tracker = new DeploymentTracker(tempDir);
    tracker.initialize();

    tracker.updateStatus('1.0.0', 'ios', 'preview');

    const status = tracker.getVersionStatus('1.0.0');
    expect(status.ios.preview).not.toBeNull();
    expect(status.ios.production).toBeNull();
    expect(status.android.preview).toBeNull();
  });

  it('should track multiple versions', () => {
    const tracker = new DeploymentTracker(tempDir);
    tracker.initialize();

    tracker.updateStatus('1.0.0', 'ios', 'preview');
    tracker.updateStatus('1.0.0', 'android', 'preview');
    tracker.updateStatus('1.1.0', 'ios', 'production');

    expect(tracker.getAllVersions()).toContain('1.0.0');
    expect(tracker.getAllVersions()).toContain('1.1.0');
  });

  it('should detect missing platforms', () => {
    const tracker = new DeploymentTracker(tempDir);
    tracker.initialize();

    tracker.updateStatus('1.0.0', 'ios', 'preview');

    const missing = tracker.getMissingPlatforms('1.0.0', 'preview');
    expect(missing).toContain('android');
    expect(missing).not.toContain('ios');
  });

  it('should return empty missing platforms when both deployed', () => {
    const tracker = new DeploymentTracker(tempDir);
    tracker.initialize();

    tracker.updateStatus('1.0.0', 'ios', 'preview');
    tracker.updateStatus('1.0.0', 'android', 'preview');

    const missing = tracker.getMissingPlatforms('1.0.0', 'preview');
    expect(missing).toHaveLength(0);
  });

  it('should update and get last config', () => {
    const tracker = new DeploymentTracker(tempDir);
    tracker.initialize();

    const config = { minSdkVersion: 24, targetSdkVersion: 35 };
    tracker.updateLastConfig('android', config);

    const lastConfig = tracker.getLastConfig('android');
    expect(lastConfig.minSdkVersion).toBe(24);
    expect(lastConfig.targetSdkVersion).toBe(35);
  });

  it('should sort versions in descending order', () => {
    const tracker = new DeploymentTracker(tempDir);
    tracker.initialize();

    tracker.updateStatus('1.0.0', 'ios', 'preview');
    tracker.updateStatus('2.0.0', 'ios', 'preview');
    tracker.updateStatus('1.5.0', 'ios', 'preview');

    const versions = tracker.getAllVersions();
    expect(versions[0]).toBe('2.0.0');
    expect(versions[1]).toBe('1.5.0');
    expect(versions[2]).toBe('1.0.0');
  });
});

describe('formatDate', () => {
  it('should format null as Not deployed', () => {
    expect(formatDate(null)).toBe('Not deployed');
  });

  it('should format ISO date string', () => {
    const date = '2024-01-15T10:30:00.000Z';
    const formatted = formatDate(date);
    expect(formatted).not.toBe('Not deployed');
    expect(formatted.length).toBeGreaterThan(0);
  });
});
