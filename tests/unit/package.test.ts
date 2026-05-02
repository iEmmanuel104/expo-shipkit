import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe('package publish surface', () => {
  it('ships dist and templates without reusable deployment history state', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(dirname, '../../package.json'), 'utf8'),
    ) as { files?: string[] };

    expect(packageJson.files).toContain('dist');
    expect(packageJson.files).toContain('templates');
    expect(packageJson.files).toContain('!templates/.deployments.json');
  });
});
