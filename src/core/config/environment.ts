import * as path from 'path';
import { fileExists, readFile } from '../../utils/fs.js';

/**
 * Load environment variables from .env files
 * Priority (highest to lowest):
 *   .env.{profile}.local
 *   .env.local
 *   .env.{profile}
 *   .env
 */
export function loadEnvFiles(
  profile?: string,
  projectRoot?: string,
): Record<string, string> {
  const cwd = projectRoot ?? process.cwd();
  const env: Record<string, string> = {};

  const filesToLoad = [
    '.env',
    profile ? `.env.${profile}` : null,
    '.env.local',
    profile ? `.env.${profile}.local` : null,
  ].filter(Boolean) as string[];

  for (const fileName of filesToLoad) {
    const filePath = path.join(cwd, fileName);
    if (fileExists(filePath)) {
      const content = readFile(filePath);
      if (content) {
        const parsed = parseEnvFile(content);
        Object.assign(env, parsed);
      }
    }
  }

  return env;
}

/**
 * Parse a .env file content into key-value pairs
 */
export function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Remove surrounding quotes
    let wasQuoted = false;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
      wasQuoted = true;
    }

    // Strip inline comments from unquoted values
    if (!wasQuoted) {
      const commentIndex = value.indexOf(' #');
      if (commentIndex !== -1) {
        value = value.slice(0, commentIndex).trimEnd();
      }
    }

    if (key) {
      env[key] = value;
    }
  }

  return env;
}
