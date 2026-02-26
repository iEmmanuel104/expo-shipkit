import * as path from 'path';
import * as fs from 'fs';
import { exec } from '../../utils/exec.js';
import { fileExists, readFile } from '../../utils/fs.js';
import { hasAllCredentialPatterns, CREDENTIAL_PATTERNS } from '../generators/gitignore.js';
import { isWindows } from '../../utils/platform.js';

export interface AuditResult {
  name: string;
  status: 'pass' | 'warn' | 'critical';
  message: string;
}

/**
 * Validate .p8 file has proper PEM structure
 */
export function validateP8Structure(filePath: string, projectRoot?: string): boolean {
  const cwd = projectRoot ?? process.cwd();
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);

  if (!fileExists(fullPath)) {
    return false;
  }

  const content = readFile(fullPath);
  if (!content) return false;

  const trimmed = content.trim();
  return (
    trimmed.startsWith('-----BEGIN PRIVATE KEY-----') &&
    trimmed.endsWith('-----END PRIVATE KEY-----')
  );
}

/**
 * Run pre-deployment security audit.
 * All exec() calls below use hardcoded git commands with no user input.
 */
export async function runSecurityAudit(projectRoot?: string): Promise<AuditResult[]> {
  const cwd = projectRoot ?? process.cwd();
  const results: AuditResult[] = [];

  // Check .gitignore has credential patterns
  if (hasAllCredentialPatterns(cwd)) {
    results.push({
      name: 'Gitignore',
      status: 'pass',
      message: 'All credential patterns in .gitignore',
    });
  } else {
    const gitignorePath = path.join(cwd, '.gitignore');
    const content = fileExists(gitignorePath) ? (readFile(gitignorePath) ?? '') : '';
    const missing = CREDENTIAL_PATTERNS.filter((p) => !content.includes(p.pattern));

    results.push({
      name: 'Gitignore',
      status: 'warn',
      message: `Missing patterns: ${missing.map((p) => p.pattern).join(', ')}`,
    });
  }

  // Check keys/ directory permissions (Unix only)
  if (!isWindows()) {
    const keysDir = path.join(cwd, 'keys');
    if (fileExists(keysDir)) {
      try {
        const stats = fs.statSync(keysDir);
        const mode = stats.mode & 0o777;
        if (mode & 0o004) {
          results.push({
            name: 'Keys Permissions',
            status: 'warn',
            message: `keys/ directory is world-readable (mode: ${mode.toString(8)})`,
          });
        } else {
          results.push({
            name: 'Keys Permissions',
            status: 'pass',
            message: 'keys/ directory has restricted permissions',
          });
        }
      } catch {
        // Skip if cannot check
      }
    }
  }

  // Check for tracked credential files (hardcoded command, safe)
  try {
    const result = await exec(
      'git ls-files -- "*.p8" "*-key.json" ".env" ".env.*"',
      { cwd, silent: true, timeout: 5000 },
    );

    if (result.code === 0 && result.stdout.trim()) {
      const files = result.stdout.trim().split('\n').filter(Boolean);
      results.push({
        name: 'Tracked Files',
        status: 'critical',
        message: `Credential files in git: ${files.join(', ')}`,
      });
    } else {
      results.push({
        name: 'Tracked Files',
        status: 'pass',
        message: 'No credential files tracked by git',
      });
    }
  } catch {
    // Not a git repo or git unavailable — skip
  }

  return results;
}

/**
 * Check if security audit has critical issues
 */
export function hasCriticalIssues(results: AuditResult[]): boolean {
  return results.some((r) => r.status === 'critical');
}
