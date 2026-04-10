import type { ChatEmbedConfig } from './types';

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target } as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    const srcVal = (source as Record<string, unknown>)[key];
    const tgtVal = result[key];
    if (isPlainObject(tgtVal) && isPlainObject(srcVal)) {
      result[key] = deepMerge(tgtVal as Record<string, unknown>, srcVal as Record<string, unknown>);
    } else if (srcVal !== undefined) {
      result[key] = srcVal;
    }
  }
  return result as T;
}

export function mergeConfig(defaults: ChatEmbedConfig, user: Partial<ChatEmbedConfig>): ChatEmbedConfig {
  return deepMerge(defaults as Record<string, unknown>, user as Record<string, unknown>) as ChatEmbedConfig;
}
