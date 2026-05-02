export {
  buildUpdateCommand,
  buildUpdateArgs,
  runUpdate,
  resolveBranch,
  type UpdateOptions,
} from './publisher.js';

export {
  validateUpdatesSetup,
  partitionIssues,
  type UpdatesValidationIssue,
} from './validator.js';

export {
  detectJsOnlyChanges,
  getCurrentCommit,
  getLatestCommitSubject,
  type JsOnlyChangeResult,
} from './change-detector.js';

export {
  readRuntimeVersion,
  resolveRuntimeVersion,
  writeRuntimeVersionPolicy,
  hasUpdatesUrl,
  type RuntimeVersionPolicy,
  type RuntimeVersionValue,
} from './runtime-version.js';

export {
  setupUpdates,
  buildUpdatesConfigSnippet,
  type SetupUpdatesOptions,
  type SetupUpdatesResult,
} from './setup.js';

export {
  assertUpdateBranchName,
  getUpdateBranchValidationError,
  getUpdateMessageValidationError,
  isDeploymentProfile,
  isRuntimeVersionPolicy,
  isUpdatePlatform,
  parseDeploymentProfile,
  parseRuntimeVersionPolicy,
  parseUpdatePlatform,
  type UpdatePlatform,
} from './guards.js';
