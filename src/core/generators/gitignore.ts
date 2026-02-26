import * as path from 'path';
import { fileExists, readFile, writeFile } from '../../utils/fs.js';

/**
 * Credential patterns that should be in .gitignore
 */
export const CREDENTIAL_PATTERNS = [
  { pattern: '*.p8', comment: '# Apple API Key files' },
  { pattern: '*-key.json', comment: '# Google service account keys' },
  { pattern: 'keys/', comment: '# Credential keys folder' },
  { pattern: '.env', comment: '# Environment variables' },
  { pattern: '.env.local', comment: '# Local environment variables' },
  { pattern: '.env.*.local', comment: '# Local environment overrides' },
  { pattern: 'google-services.json', comment: '# Firebase config (Android)' },
  { pattern: 'GoogleService-Info.plist', comment: '# Firebase config (iOS)' },
];

/**
 * Additional shipkit patterns for .gitignore
 */
export const SHIPKIT_PATTERNS = [
  { pattern: '.deployments.json', comment: '# Shipkit deployment history' },
];

/**
 * Check which credential patterns are missing from .gitignore
 */
export function getMissingGitignorePatterns(projectRoot?: string): typeof CREDENTIAL_PATTERNS {
  const cwd = projectRoot ?? process.cwd();
  const gitignorePath = path.join(cwd, '.gitignore');

  if (!fileExists(gitignorePath)) {
    return [...CREDENTIAL_PATTERNS, ...SHIPKIT_PATTERNS];
  }

  const content = readFile(gitignorePath) ?? '';
  const lines = content.split('\n').map((l) => l.trim());
  const allPatterns = [...CREDENTIAL_PATTERNS, ...SHIPKIT_PATTERNS];

  return allPatterns.filter((entry) => !lines.includes(entry.pattern));
}

/**
 * Update .gitignore with missing credential patterns
 * Returns the number of patterns added
 */
export function updateGitignore(projectRoot?: string): number {
  const cwd = projectRoot ?? process.cwd();
  const gitignorePath = path.join(cwd, '.gitignore');

  const missing = getMissingGitignorePatterns(cwd);
  if (missing.length === 0) {
    return 0;
  }

  let content = '';
  if (fileExists(gitignorePath)) {
    content = readFile(gitignorePath) ?? '';
  }

  const additions: string[] = ['\n# expo-shipkit'];
  for (const entry of missing) {
    additions.push(entry.comment);
    additions.push(entry.pattern);
  }

  const newContent = content.trimEnd() + '\n' + additions.join('\n') + '\n';
  writeFile(gitignorePath, newContent);

  return missing.length;
}

/**
 * Check if .gitignore has all required credential patterns
 */
export function hasAllCredentialPatterns(projectRoot?: string): boolean {
  const cwd = projectRoot ?? process.cwd();
  const gitignorePath = path.join(cwd, '.gitignore');

  if (!fileExists(gitignorePath)) {
    return false;
  }

  const content = readFile(gitignorePath) ?? '';
  const lines = content.split('\n').map((l) => l.trim());
  return CREDENTIAL_PATTERNS.every((entry) => lines.includes(entry.pattern));
}
