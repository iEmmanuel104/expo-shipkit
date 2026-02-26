export {
  runEnvironmentChecks,
  runProjectChecks,
  runCredentialChecks,
  runSecurityChecks,
} from './checks.js';
export type { CheckCategory, DoctorCheckResult } from './checks.js';

export { runDoctorChecks } from './runner.js';
export type { DoctorSummary } from './runner.js';
