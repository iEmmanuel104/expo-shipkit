export interface ErrorSuggestion {
  title: string;
  steps: string[];
}

interface ErrorPattern {
  pattern: RegExp;
  suggestion: ErrorSuggestion;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /credentials?\s*(not\s+found|missing|invalid)/i,
    suggestion: {
      title: 'Credentials Not Found',
      steps: [
        'Run "shipkit credentials check" to verify your credential setup',
        'For iOS: Ensure your .p8 key file exists in the keys/ directory',
        'For Android: Ensure your service account JSON key exists',
        'Run "shipkit credentials setup" to reconfigure',
      ],
    },
  },
  {
    pattern: /sdk\s*version\s*(mismatch|incompatible|not\s+supported)/i,
    suggestion: {
      title: 'SDK Version Mismatch',
      steps: [
        'Check expo-build-properties in app.json for SDK version settings',
        'Run "npx expo install --fix" to fix version mismatches',
        'Consider clearing the build cache: eas build --clear-cache',
        'Run "shipkit doctor" to check your project configuration',
      ],
    },
  },
  {
    pattern: /(network|connection|timeout|ETIMEDOUT|ECONNREFUSED)/i,
    suggestion: {
      title: 'Network Error',
      steps: [
        'Check your internet connection',
        'If behind a proxy, configure npm proxy settings',
        'Try again in a few minutes — EAS servers may be temporarily unavailable',
        'Check https://status.expo.dev for service status',
      ],
    },
  },
  {
    pattern: /build\s*(failed|error)/i,
    suggestion: {
      title: 'Build Failed',
      steps: [
        'Check the build logs on expo.dev for detailed error messages',
        'Run "eas build:list" to see recent build statuses',
        'Try clearing the build cache with --clear-cache',
        'Run "shipkit doctor" to check for common configuration issues',
        'Ensure all native dependencies are compatible with your SDK version',
      ],
    },
  },
  {
    pattern: /submit\s*(failed|error|rejected)/i,
    suggestion: {
      title: 'Submission Failed',
      steps: [
        'Check your store credentials are properly configured',
        'For iOS: Verify your App Store Connect API key is still valid',
        'For Android: Verify your Google Play service account has permissions',
        'Run "shipkit credentials check" to validate credentials',
        'Check the app store console for any compliance issues',
      ],
    },
  },
  {
    pattern: /(not\s+logged\s+in|authentication|unauthorized|401)/i,
    suggestion: {
      title: 'Authentication Error',
      steps: [
        'Run "eas login" to log in to your Expo account',
        'If using CI/CD, ensure EXPO_TOKEN is set',
        'Check that your account has access to this project',
      ],
    },
  },
  {
    pattern: /(bundle\s*identifier|package\s*name).*?(missing|not\s+set|required)/i,
    suggestion: {
      title: 'Missing App Identifier',
      steps: [
        'Set ios.bundleIdentifier in app.json (e.g., "com.yourcompany.appname")',
        'Set android.package in app.json (e.g., "com.yourcompany.appname")',
        'Run "shipkit init" to configure these interactively',
      ],
    },
  },
  {
    pattern: /(eas\.json|config).*?(not\s+found|missing|invalid)/i,
    suggestion: {
      title: 'Configuration Not Found',
      steps: [
        'Run "eas build:configure" to create eas.json',
        'Or run "shipkit init" which will generate eas.json for you',
        'Make sure you are in the project root directory',
      ],
    },
  },
  {
    pattern: /pre-?build\s+hook\s+failed/i,
    suggestion: {
      title: 'Pre-build Hook Failed',
      steps: [
        'Check the preBuild hook command in shipkit.config.ts',
        'Run the hook command manually to debug',
        'Remove or fix the hook if it is no longer needed',
      ],
    },
  },
  {
    pattern: /(code\s*signing|provisioning\s*profile|certificate)/i,
    suggestion: {
      title: 'Code Signing Issue',
      steps: [
        'For managed workflow: EAS handles code signing — run "eas credentials"',
        'Ensure your Apple Developer account is active',
        'Try "eas credentials --platform ios" to reconfigure',
        'Check that your provisioning profiles are not expired',
      ],
    },
  },
  {
    pattern: /(ENOENT|no\s+such\s+file|file\s+not\s+found)/i,
    suggestion: {
      title: 'File Not Found',
      steps: [
        'Verify the file path exists and is accessible',
        'Check that credential files are in the correct location (usually keys/)',
        'Ensure relative paths are relative to the project root',
        'Run "shipkit doctor" to check your project structure',
      ],
    },
  },
  {
    pattern: /(native\s*module|cannot\s+find\s+module|module\s+not\s+found)/i,
    suggestion: {
      title: 'Module Resolution Error',
      steps: [
        'Run "npx expo install --fix" to resolve version mismatches',
        'Delete node_modules and run "npm install" again',
        'Check that native modules are compatible with your Expo SDK version',
        'For bare workflow, run "npx pod-install" for iOS',
      ],
    },
  },
  {
    pattern: /(provisioning.*?expired|certificate.*?expired|expired.*?certificate)/i,
    suggestion: {
      title: 'Expired Certificate/Profile',
      steps: [
        'Run "eas credentials --platform ios" to regenerate credentials',
        'Check Apple Developer Portal for expired certificates',
        'Revoke and recreate provisioning profiles if needed',
      ],
    },
  },
];

/**
 * Find error suggestions that match the given error message
 */
export function findSuggestions(errorMessage: string): ErrorSuggestion[] {
  return ERROR_PATTERNS
    .filter((entry) => entry.pattern.test(errorMessage))
    .map((entry) => entry.suggestion);
}

/**
 * Get the best (first matching) suggestion for an error
 */
export function getBestSuggestion(errorMessage: string): ErrorSuggestion | null {
  const suggestions = findSuggestions(errorMessage);
  return suggestions.length > 0 ? suggestions[0] : null;
}
