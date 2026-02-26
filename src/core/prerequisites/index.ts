export {
  checkAllPrerequisites,
  checkNodeVersion,
  checkEasCli,
  checkExpoCli,
  checkEasLogin,
  hasFailures,
  getAutoFixable,
} from './checker.js';
export type { PrerequisiteResult } from './checker.js';
export { autoFix, autoFixAll } from './installer.js';
