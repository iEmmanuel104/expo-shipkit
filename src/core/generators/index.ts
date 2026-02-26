export {
  generateEasJson,
  getDefaultEasJson,
  validateEasJson,
} from './eas-json.js';

export {
  detectAppJsonGaps,
  fixAppJsonGaps,
  suggestBundleIdentifier,
  suggestAndroidPackage,
} from './app-json.js';
export type { AppJsonGap, AppJsonFixes } from './app-json.js';

export {
  generateEnvTemplate,
  getEnvTemplateContent,
} from './env-template.js';

export {
  updateGitignore,
  getMissingGitignorePatterns,
  hasAllCredentialPatterns,
  CREDENTIAL_PATTERNS,
  SHIPKIT_PATTERNS,
} from './gitignore.js';

export {
  generateCiTemplate,
  getGithubActionsWorkflow,
} from './ci-templates.js';
