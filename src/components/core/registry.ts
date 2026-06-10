import type { ComponentModule } from './types';

export interface ComponentRegistry {
  register(type: string, module: ComponentModule): void;
  lookup(type: string, wireVersion?: number): ComponentModule | undefined;
  list(): ReadonlyMap<string, ComponentModule>;
}

export function createRegistry(): ComponentRegistry {
  const _map = new Map<string, ComponentModule>();
  return {
    register(type, module) { _map.set(type, module); },
    lookup(type, wireVersion) {
      const mod = _map.get(type);
      if (!mod) return undefined;
      if (wireVersion !== undefined && wireVersion > mod.version) return undefined;
      return mod;
    },
    list() { return _map; },
  };
}

/** Singleton registry, imported by message-bubble.ts and registration site. */
export const componentRegistry = createRegistry();
