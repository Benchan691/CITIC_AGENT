import { defineConfig, type UserConfig } from 'tsdown'
import { standardDecoratorPlugin } from '../standard-decorators.ts'

/** SOC-owned Node bundle preset; no Harness build file is imported at runtime. */
export function hostBundle(entry: readonly string[] = ['src/index.ts']): UserConfig {
  return defineConfig({
    entry: [...entry],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    plugins: [standardDecoratorPlugin()],
  }) as UserConfig
}
