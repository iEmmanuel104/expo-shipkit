import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  buildUpdateArgs,
  buildUpdateCommand,
  resolveBranch,
} from '../../src/core/updates/publisher.js';
import {
  validateUpdatesSetup,
  partitionIssues,
} from '../../src/core/updates/validator.js';
import { setupUpdates } from '../../src/core/updates/setup.js';

describe('resolveBranch', () => {
  it('falls back to profile name when no override', () => {
    expect(resolveBranch('production')).toBe('production');
    expect(resolveBranch('preview')).toBe('preview');
  });

  it('uses channels override when present', () => {
    const updates = {
      enabled: true,
      smartDeploy: true,
      runtimeVersionPolicy: 'appVersion' as const,
      channels: { production: 'main-prod', preview: 'staging' },
    };
    expect(resolveBranch('production', updates)).toBe('main-prod');
    expect(resolveBranch('preview', updates)).toBe('staging');
  });

  it('falls back to profile when channels object lacks the profile key', () => {
    const updates = {
      enabled: true,
      smartDeploy: true,
      runtimeVersionPolicy: 'appVersion' as const,
      channels: { production: 'main-prod' },
    };
    expect(resolveBranch('preview', updates)).toBe('preview');
  });
});

describe('buildUpdateCommand', () => {
  it('builds standard command for a profile', () => {
    const cmd = buildUpdateCommand({
      profile: 'production',
      message: 'hotfix login',
    });
    expect(cmd).toBe("eas update --branch production --message 'hotfix login' --platform all");
  });

  it('honors explicit platform', () => {
    const cmd = buildUpdateCommand({
      profile: 'preview',
      message: 'iOS only patch',
      platform: 'ios',
    });
    expect(cmd).toContain('--platform ios');
    expect(cmd).toContain('--branch preview');
  });

  it('honors explicit branch override', () => {
    const cmd = buildUpdateCommand({
      profile: 'production',
      branch: 'custom-branch',
      message: 'msg',
    });
    expect(cmd).toContain('--branch custom-branch');
  });

  it('appends --non-interactive when requested', () => {
    const cmd = buildUpdateCommand({
      profile: 'preview',
      message: 'ci publish',
      nonInteractive: true,
    });
    expect(cmd.endsWith('--non-interactive')).toBe(true);
  });

  it('escapes single quotes in the message', () => {
    const cmd = buildUpdateCommand({
      profile: 'preview',
      message: "don't break the shell",
    });
    expect(cmd).toContain("'don'\\''t break the shell'");
  });

  it('builds argv without shell quoting for execution', () => {
    const args = buildUpdateArgs({
      profile: 'preview',
      branch: 'preview',
      message: "don't quote argv",
    });
    expect(args).toEqual([
      'update',
      '--branch',
      'preview',
      '--message',
      "don't quote argv",
      '--platform',
      'all',
    ]);
  });

  it('uses channels override from updates config', () => {
    const cmd = buildUpdateCommand({
      profile: 'production',
      message: 'msg',
      updates: {
        enabled: true,
        smartDeploy: true,
        runtimeVersionPolicy: 'appVersion',
        channels: { production: 'main-prod' },
      },
    });
    expect(cmd).toContain('--branch main-prod');
  });

  it('rejects shell-injection attempts in branch', () => {
    expect(() =>
      buildUpdateCommand({
        profile: 'preview',
        message: 'm',
        branch: 'evil; rm -rf /tmp/x',
      }),
    ).toThrow(/Invalid EAS Update branch/);
  });

  it('rejects shell-injection attempts via platform', () => {
    expect(() =>
      buildUpdateCommand({
        profile: 'preview',
        message: 'm',
        // cast through any to simulate a runtime value bypassing TS
        platform: 'all; echo hi' as never,
      }),
    ).toThrow(/Invalid platform/);
  });

  it('rejects empty update messages', () => {
    expect(() =>
      buildUpdateCommand({
        profile: 'preview',
        message: '   ',
      }),
    ).toThrow(/Update message cannot be empty/);
  });
});

describe('validateUpdatesSetup', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shipkit-updates-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function writeAppJson(data: unknown) {
    fs.writeFileSync(path.join(tempDir, 'app.json'), JSON.stringify(data, null, 2));
  }
  function writePkg(deps: Record<string, string>) {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'test', version: '1.0.0', dependencies: deps }, null, 2),
    );
  }
  function writeEasJson(data: unknown) {
    fs.writeFileSync(path.join(tempDir, 'eas.json'), JSON.stringify(data, null, 2));
  }

  it('flags missing expo-updates dependency', () => {
    writePkg({});
    writeAppJson({ expo: { name: 'test' } });
    const issues = validateUpdatesSetup({ projectRoot: tempDir });
    expect(issues.some((i) => i.field === 'expo-updates' && i.severity === 'error')).toBe(true);
  });

  it('flags missing runtimeVersion', () => {
    writePkg({ 'expo-updates': '~0.24.0' });
    writeAppJson({ expo: { name: 'test', updates: { url: 'https://u.expo.dev/abc' } } });
    const issues = validateUpdatesSetup({ projectRoot: tempDir });
    expect(issues.some((i) => i.field === 'app.json/expo.runtimeVersion')).toBe(true);
  });

  it('flags missing updates.url', () => {
    writePkg({ 'expo-updates': '~0.24.0' });
    writeAppJson({ expo: { name: 'test', runtimeVersion: { policy: 'appVersion' } } });
    const issues = validateUpdatesSetup({ projectRoot: tempDir });
    expect(issues.some((i) => i.field === 'app.json/expo.updates.url')).toBe(true);
  });

  it('flags missing eas.json', () => {
    writePkg({ 'expo-updates': '~0.24.0' });
    writeAppJson({
      expo: { name: 'test', runtimeVersion: { policy: 'appVersion' }, updates: { url: 'https://u.expo.dev/abc' } },
    });
    const issues = validateUpdatesSetup({ projectRoot: tempDir });
    expect(issues.some((i) => i.field === 'eas.json' && i.severity === 'error')).toBe(true);
  });

  it('errors when build profile has no channel', () => {
    writePkg({ 'expo-updates': '~0.24.0' });
    writeAppJson({
      expo: { name: 'test', runtimeVersion: { policy: 'appVersion' }, updates: { url: 'https://u.expo.dev/abc' } },
    });
    writeEasJson({
      cli: { version: '>= 0.0.0' },
      build: { preview: { distribution: 'internal' }, production: {} },
      submit: {},
    });
    const issues = validateUpdatesSetup({
      projectRoot: tempDir,
      profiles: ['preview', 'production'],
    });
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors.some((e) => e.field === 'eas.json/build.preview.channel')).toBe(true);
    expect(errors.some((e) => e.field === 'eas.json/build.production.channel')).toBe(true);
  });

  it('errors when configured channel does not match eas.json channel', () => {
    writePkg({ 'expo-updates': '~0.24.0' });
    writeAppJson({
      expo: { name: 'test', runtimeVersion: { policy: 'appVersion' }, updates: { url: 'https://u.expo.dev/abc' } },
    });
    writeEasJson({
      build: {
        production: { channel: 'production' },
      },
      submit: {},
    });
    const issues = validateUpdatesSetup({
      projectRoot: tempDir,
      profiles: ['production'],
      updates: {
        enabled: true,
        channels: { production: 'main-prod' },
        smartDeploy: true,
        runtimeVersionPolicy: 'appVersion',
      },
    });
    expect(issues.some((i) => i.field === 'eas.json/build.production.channel' && i.severity === 'error')).toBe(true);
  });

  it('errors for malformed runtimeVersion and non-HTTPS update URL', () => {
    writePkg({ 'expo-updates': '~0.24.0' });
    writeAppJson({
      expo: { name: 'test', runtimeVersion: { policy: 'bad' }, updates: { url: 'http://u.expo.dev/abc' } },
    });
    writeEasJson({
      build: {
        production: { channel: 'production' },
      },
      submit: {},
    });
    const issues = validateUpdatesSetup({
      projectRoot: tempDir,
      profiles: ['production'],
    });
    expect(issues.some((i) => i.field === 'app.json/expo.runtimeVersion' && i.severity === 'error')).toBe(true);
    expect(issues.some((i) => i.field === 'app.json/expo.updates.url' && i.severity === 'error')).toBe(true);
  });

  it('returns no issues when fully configured', () => {
    writePkg({ 'expo-updates': '~0.24.0' });
    writeAppJson({
      expo: { name: 'test', runtimeVersion: { policy: 'appVersion' }, updates: { url: 'https://u.expo.dev/abc' } },
    });
    writeEasJson({
      cli: { version: '>= 0.0.0' },
      build: {
        preview: { distribution: 'internal', channel: 'preview' },
        production: { channel: 'production' },
      },
      submit: {},
    });
    const issues = validateUpdatesSetup({
      projectRoot: tempDir,
      profiles: ['preview', 'production'],
    });
    expect(issues).toHaveLength(0);
  });
});

describe('setupUpdates', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shipkit-setup-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function readJson<T>(rel: string): T {
    return JSON.parse(fs.readFileSync(path.join(tempDir, rel), 'utf8')) as T;
  }

  it('writes build channels while preserving ASC submit config', async () => {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'test', dependencies: { 'expo-updates': '~0.24.0' } }, null, 2),
    );
    fs.writeFileSync(
      path.join(tempDir, 'app.json'),
      JSON.stringify({
        expo: {
          name: 'test',
          slug: 'test',
          version: '1.0.0',
          runtimeVersion: { policy: 'appVersion' },
          updates: { url: 'https://u.expo.dev/abc' },
        },
      }, null, 2),
    );
    fs.writeFileSync(
      path.join(tempDir, 'eas.json'),
      JSON.stringify({
        build: {
          production: {},
        },
        submit: {
          production: {
            ios: {
              ascAppId: '1234567890',
              ascApiKeyPath: './keys/AuthKey_ABC123.p8',
              ascApiIssuerId: 'issuer-id',
              ascApiKeyId: 'ABC123DEFG',
            },
          },
        },
      }, null, 2),
    );

    const result = await setupUpdates({
      profiles: ['production'],
      installExpoUpdates: false,
      runEasUpdateConfigure: false,
      projectRoot: tempDir,
    });

    const easJson = readJson<{
      build: { production: { channel?: string } };
      submit: { production: { ios: Record<string, string> } };
    }>('eas.json');
    expect(result.easJsonChanged).toBe(true);
    expect(easJson.build.production.channel).toBe('production');
    expect(easJson.submit.production.ios).toEqual({
      ascAppId: '1234567890',
      ascApiKeyPath: './keys/AuthKey_ABC123.p8',
      ascApiIssuerId: 'issuer-id',
      ascApiKeyId: 'ABC123DEFG',
    });
  });

  it('preserves an existing literal runtimeVersion when no policy override is requested', async () => {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'test', dependencies: { 'expo-updates': '~0.24.0' } }, null, 2),
    );
    fs.writeFileSync(
      path.join(tempDir, 'app.json'),
      JSON.stringify({
        expo: {
          name: 'test',
          slug: 'test',
          version: '1.0.0',
          runtimeVersion: '1.0.0-native',
          updates: { url: 'https://u.expo.dev/abc' },
        },
      }, null, 2),
    );
    fs.writeFileSync(path.join(tempDir, 'eas.json'), JSON.stringify({ build: { production: {} } }, null, 2));

    await setupUpdates({
      profiles: ['production'],
      installExpoUpdates: false,
      runEasUpdateConfigure: false,
      projectRoot: tempDir,
    });

    const appJson = readJson<{ expo: { runtimeVersion: string } }>('app.json');
    expect(appJson.expo.runtimeVersion).toBe('1.0.0-native');
  });
});

describe('partitionIssues', () => {
  it('splits errors and warnings', () => {
    const { errors, warnings } = partitionIssues([
      { severity: 'error', field: 'a', message: 'm1' },
      { severity: 'warn', field: 'b', message: 'm2' },
      { severity: 'error', field: 'c', message: 'm3' },
    ]);
    expect(errors).toHaveLength(2);
    expect(warnings).toHaveLength(1);
  });
});
