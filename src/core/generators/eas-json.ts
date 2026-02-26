import * as path from 'path';
import { fileExists, readJsonFile, writeJsonFile } from '../../utils/fs.js';
import type { EasConfig } from '../../types/eas.js';

/**
 * Default eas.json configuration
 */
export function getDefaultEasJson(): EasConfig {
  return {
    cli: {
      version: '>= 10.0.0',
      appVersionSource: 'remote',
    },
    build: {
      development: {
        developmentClient: true,
        distribution: 'internal',
        channel: 'development',
      },
      preview: {
        distribution: 'internal',
        channel: 'preview',
        autoIncrement: true,
      },
      production: {
        channel: 'production',
        autoIncrement: true,
      },
    },
    submit: {
      production: {},
    },
  };
}

/**
 * Generate eas.json file if it doesn't exist
 */
export function generateEasJson(projectRoot?: string): boolean {
  const cwd = projectRoot ?? process.cwd();
  const easJsonPath = path.join(cwd, 'eas.json');

  if (fileExists(easJsonPath)) {
    return false;
  }

  writeJsonFile(easJsonPath, getDefaultEasJson());
  return true;
}

/**
 * Validate existing eas.json has expected profiles
 */
export function validateEasJson(projectRoot?: string): string[] {
  const cwd = projectRoot ?? process.cwd();
  const easJsonPath = path.join(cwd, 'eas.json');
  const warnings: string[] = [];

  if (!fileExists(easJsonPath)) {
    warnings.push('eas.json not found');
    return warnings;
  }

  const easJson = readJsonFile<EasConfig>(easJsonPath);
  if (!easJson) {
    warnings.push('eas.json is not valid JSON');
    return warnings;
  }

  if (!easJson.build) {
    warnings.push('No build profiles defined in eas.json');
  } else {
    if (!easJson.build.preview && !easJson.build.production) {
      warnings.push('No preview or production build profiles defined');
    }
  }

  if (!easJson.cli?.appVersionSource) {
    warnings.push('appVersionSource not set in cli config (recommended: "remote")');
  }

  return warnings;
}
