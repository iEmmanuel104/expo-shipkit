import type { ShipkitConfig } from '../../types/config.js';

/**
 * Default ShipKit configuration
 */
export const defaultConfig: ShipkitConfig = {
  platforms: {
    ios: true,
    android: true,
  },
  profiles: ['preview', 'production'],
  criticalConfig: {
    android: ['minSdkVersion', 'targetSdkVersion', 'compileSdkVersion'],
    ios: ['deploymentTarget'],
  },
  build: {
    android: { nonInteractive: true },
    ios: { nonInteractive: false },
    autoClearCache: true,
  },
  display: {
    colors: true,
  },
};

/**
 * Generate config file content
 */
export function generateConfigContent(projectName: string, config: Partial<ShipkitConfig> = {}): string {
  const mergedConfig = { ...defaultConfig, ...config, projectName };

  return `import { defineConfig } from 'expo-shipkit';

export default defineConfig({
  projectName: '${projectName}',

  platforms: {
    ios: ${mergedConfig.platforms.ios},
    android: ${mergedConfig.platforms.android},
  },

  profiles: ${JSON.stringify(mergedConfig.profiles)},

  criticalConfig: {
    android: ${JSON.stringify(mergedConfig.criticalConfig.android)},
    ios: ${JSON.stringify(mergedConfig.criticalConfig.ios)},
  },

  build: {
    android: { nonInteractive: ${mergedConfig.build.android.nonInteractive} },
    ios: { nonInteractive: ${mergedConfig.build.ios.nonInteractive} },
    autoClearCache: ${mergedConfig.build.autoClearCache},
  },

  // Uncomment and configure for automated submissions
  // submit: {
  //   android: {
  //     track: 'internal',
  //     releaseStatus: 'draft',
  //     // serviceAccountKeyPath: './keys/google-play-key.json',
  //   },
  //   ios: {
  //     // ascAppId: 'YOUR_APP_ID',
  //     // ascApiKeyPath: './keys/AuthKey_XXXXX.p8',
  //     // ascApiIssuerId: 'YOUR_ISSUER_ID',
  //     // ascApiKeyId: 'YOUR_KEY_ID',
  //   },
  // },

  // Uncomment to add hooks
  // hooks: {
  //   preBuild: 'npm run type-check',
  //   postBuild: undefined,
  //   preSubmit: undefined,
  //   postSubmit: undefined,
  // },

  display: {
    banner: '${projectName.toUpperCase()} DEPLOYMENT',
    colors: true,
  },
});
`;
}
