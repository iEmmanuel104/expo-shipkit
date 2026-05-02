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
  const safeName = projectName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  const updates = config.updates;
  const updatesBlock = updates?.enabled
    ? `
  updates: {
    enabled: true,
    smartDeploy: ${updates.smartDeploy !== false},
    runtimeVersionPolicy: '${updates.runtimeVersionPolicy ?? 'appVersion'}',${updates.channels ? `
    channels: ${JSON.stringify(updates.channels)},` : ''}
  },
`
    : `
  // Uncomment to enable OTA updates (run "shipkit update setup" first)
  // updates: {
  //   enabled: true,
  //   smartDeploy: true,
  //   runtimeVersionPolicy: 'appVersion',
  // },
`;

  return `import { defineConfig } from 'expo-shipkit';

export default defineConfig({
  projectName: '${safeName}',

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
${updatesBlock}
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
    banner: '${safeName.toUpperCase()} DEPLOYMENT',
    colors: true,
  },
});
`;
}
