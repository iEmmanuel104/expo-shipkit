import { z } from 'zod';

/**
 * Platform-specific build configuration
 */
export const PlatformBuildConfigSchema = z.object({
  nonInteractive: z.boolean().default(false),
});

/**
 * Android submit configuration
 */
export const AndroidSubmitConfigSchema = z.object({
  track: z.enum(['internal', 'alpha', 'beta', 'production']).default('internal'),
  releaseStatus: z.enum(['draft', 'completed']).default('draft'),
  serviceAccountKeyPath: z.string().optional(),
});

/**
 * iOS submit configuration
 */
export const IosSubmitConfigSchema = z.object({
  ascAppId: z.string().optional(),
  ascApiKeyPath: z.string().optional(),
  ascApiIssuerId: z.string().optional(),
  ascApiKeyId: z.string().optional(),
});

/**
 * Hooks configuration
 */
export const HooksConfigSchema = z.object({
  preBuild: z.string().optional(),
  postBuild: z.string().optional(),
  preSubmit: z.string().optional(),
  postSubmit: z.string().optional(),
});

/**
 * Display configuration
 */
export const DisplayConfigSchema = z.object({
  banner: z.string().optional(),
  colors: z.boolean().default(true),
});

/**
 * Critical config keys to track for cache invalidation
 */
export const CriticalConfigSchema = z.object({
  android: z.array(z.string()).default(['minSdkVersion', 'targetSdkVersion', 'compileSdkVersion']),
  ios: z.array(z.string()).default(['deploymentTarget']),
});

/**
 * Main ShipKit configuration schema
 */
export const ShipkitConfigSchema = z.object({
  // Project identification
  projectName: z.string().optional(),

  // Platforms to support
  platforms: z.object({
    ios: z.boolean().default(true),
    android: z.boolean().default(true),
  }).default({ ios: true, android: true }),

  // Build profiles
  profiles: z.array(z.enum(['development', 'preview', 'staging', 'production'])).default(['preview', 'production']),

  // Critical config tracking
  criticalConfig: CriticalConfigSchema.default({
    android: ['minSdkVersion', 'targetSdkVersion', 'compileSdkVersion'],
    ios: ['deploymentTarget'],
  }),

  // Build behavior
  build: z.object({
    android: PlatformBuildConfigSchema.default({ nonInteractive: true }),
    ios: PlatformBuildConfigSchema.default({ nonInteractive: false }),
    autoClearCache: z.boolean().default(true),
  }).default({
    android: { nonInteractive: true },
    ios: { nonInteractive: false },
    autoClearCache: true,
  }),

  // Submit configuration
  submit: z.object({
    android: AndroidSubmitConfigSchema.default({ track: 'internal', releaseStatus: 'draft' }),
    ios: IosSubmitConfigSchema.default({}),
  }).optional(),

  // Hooks
  hooks: HooksConfigSchema.optional(),

  // Display customization
  display: DisplayConfigSchema.default({ colors: true }),

  // Monorepo support (optional)
  monorepo: z.object({
    root: z.string().optional(),
    appDir: z.string().optional(),
  }).optional(),

  // Environment configuration (optional)
  environments: z.record(z.string(), z.object({
    env: z.record(z.string(), z.string()).optional(),
    profile: z.enum(['development', 'preview', 'staging', 'production']).optional(),
  })).optional(),
});

export type ShipkitConfig = z.infer<typeof ShipkitConfigSchema>;
export type PlatformBuildConfig = z.infer<typeof PlatformBuildConfigSchema>;
export type AndroidSubmitConfig = z.infer<typeof AndroidSubmitConfigSchema>;
export type IosSubmitConfig = z.infer<typeof IosSubmitConfigSchema>;
export type HooksConfig = z.infer<typeof HooksConfigSchema>;
export type DisplayConfig = z.infer<typeof DisplayConfigSchema>;
export type CriticalConfig = z.infer<typeof CriticalConfigSchema>;

/**
 * Helper function to define configuration with type safety
 */
export function defineConfig(config: Partial<ShipkitConfig>): ShipkitConfig {
  return ShipkitConfigSchema.parse(config);
}
