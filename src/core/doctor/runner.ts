import {
  runEnvironmentChecks,
  runProjectChecks,
  runCredentialChecks,
  runSecurityChecks,
  type CheckCategory,
  type DoctorCheckResult,
} from './checks.js';

export interface DoctorSummary {
  results: DoctorCheckResult[];
  pass: number;
  warn: number;
  fail: number;
  total: number;
}

/**
 * Run all doctor checks or a specific category
 */
export async function runDoctorChecks(
  options: {
    category?: CheckCategory;
    projectRoot?: string;
  } = {},
): Promise<DoctorSummary> {
  const { category, projectRoot } = options;
  let results: DoctorCheckResult[] = [];

  if (!category || category === 'environment') {
    results.push(...(await runEnvironmentChecks()));
  }

  if (!category || category === 'project') {
    results.push(...(await runProjectChecks(projectRoot)));
  }

  if (!category || category === 'credentials') {
    results.push(...(await runCredentialChecks(projectRoot)));
  }

  if (!category || category === 'security') {
    results.push(...(await runSecurityChecks(projectRoot)));
  }

  return {
    results,
    pass: results.filter((r) => r.status === 'pass').length,
    warn: results.filter((r) => r.status === 'warn').length,
    fail: results.filter((r) => r.status === 'fail').length,
    total: results.length,
  };
}
