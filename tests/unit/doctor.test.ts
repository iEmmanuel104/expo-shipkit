import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runCredentialChecks } from '../../src/core/doctor/checks.js';

describe('doctor credential checks', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shipkit-doctor-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('warns when ASC config is placed under build config instead of submit ios config', async () => {
    fs.writeFileSync(
      path.join(tempDir, 'eas.json'),
      JSON.stringify({
        build: {
          production: {
            ios: {
              ascAppId: '1234567890',
            },
          },
        },
        submit: {
          production: {
            ios: {},
          },
        },
      }, null, 2),
    );

    const results = await runCredentialChecks(tempDir);
    expect(results.some((result) =>
      result.name === 'ASC Config Placement'
      && result.status === 'warn'
      && result.message.includes('eas.build.production.ios.ascAppId'),
    )).toBe(true);
  });
});
