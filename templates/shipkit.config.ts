import { defineConfig } from 'expo-shipkit';

export default defineConfig({
  projectName: 'MyApp',

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
    banner: 'MYAPP DEPLOYMENT',
    colors: true,
  },
});
