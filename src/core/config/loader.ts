import * as path from 'path';
import { cosmiconfig } from 'cosmiconfig';
import { TypeScriptLoader } from 'cosmiconfig-typescript-loader';
import { ShipkitConfigSchema, type ShipkitConfig } from '../../types/config.js';
import { fileExists, readJsonFile } from '../../utils/fs.js';
import type { ExpoAppJson } from '../../types/eas.js';

const CONFIG_NAME = 'shipkit';

/**
 * Load ShipKit configuration from project
 */
export async function loadConfig(projectRoot?: string): Promise<ShipkitConfig | null> {
  const cwd = projectRoot ?? process.cwd();

  const explorer = cosmiconfig(CONFIG_NAME, {
    searchPlaces: [
      'shipkit.config.ts',
      'shipkit.config.js',
      'shipkit.config.mjs',
      'shipkit.config.cjs',
      '.shipkitrc',
      '.shipkitrc.json',
      '.shipkitrc.js',
      '.shipkitrc.ts',
    ],
    loaders: {
      '.ts': TypeScriptLoader(),
    },
  });

  try {
    const result = await explorer.search(cwd);

    if (!result || result.isEmpty) {
      return null;
    }

    // Validate and parse configuration
    const config = ShipkitConfigSchema.parse(result.config);
    return config;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Check if ShipKit is initialized in the project
 */
export function isInitialized(projectRoot?: string): boolean {
  const cwd = projectRoot ?? process.cwd();
  const configPaths = [
    'shipkit.config.ts',
    'shipkit.config.js',
    'shipkit.config.mjs',
    '.shipkitrc',
    '.shipkitrc.json',
  ];

  return configPaths.some((configPath) => fileExists(path.join(cwd, configPath)));
}

/**
 * Check if the project is an Expo project
 */
export function isExpoProject(projectRoot?: string): boolean {
  const cwd = projectRoot ?? process.cwd();
  const appJsonPath = path.join(cwd, 'app.json');

  if (!fileExists(appJsonPath)) {
    return false;
  }

  const appJson = readJsonFile<ExpoAppJson>(appJsonPath);
  return appJson !== null && 'expo' in appJson;
}

/**
 * Load app.json from project
 */
export function loadAppJson(projectRoot?: string): ExpoAppJson | null {
  const cwd = projectRoot ?? process.cwd();
  const appJsonPath = path.join(cwd, 'app.json');
  return readJsonFile<ExpoAppJson>(appJsonPath);
}

/**
 * Load eas.json from project
 */
export function loadEasJson(projectRoot?: string): Record<string, unknown> | null {
  const cwd = projectRoot ?? process.cwd();
  const easJsonPath = path.join(cwd, 'eas.json');
  return readJsonFile<Record<string, unknown>>(easJsonPath);
}

/**
 * Check if eas.json exists
 */
export function hasEasJson(projectRoot?: string): boolean {
  const cwd = projectRoot ?? process.cwd();
  return fileExists(path.join(cwd, 'eas.json'));
}

/**
 * Get project name from app.json
 */
export function getProjectName(projectRoot?: string): string | null {
  const appJson = loadAppJson(projectRoot);
  return appJson?.expo?.name ?? null;
}

/**
 * Get available profiles from eas.json
 */
export function getAvailableProfiles(projectRoot?: string): string[] {
  const easJson = loadEasJson(projectRoot);
  if (!easJson || !easJson.build || typeof easJson.build !== 'object') {
    return [];
  }
  return Object.keys(easJson.build as Record<string, unknown>);
}
