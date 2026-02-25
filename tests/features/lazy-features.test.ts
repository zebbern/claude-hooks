import { describe, it, expect } from 'vitest';
import { lazyBuiltInFeatures } from '../../src/features/lazy-features.js';

describe('lazyBuiltInFeatures', () => {
  it('contains exactly 26 descriptors', () => {
    expect(lazyBuiltInFeatures).toHaveLength(26);
  });

  it('every descriptor has valid meta with required fields', () => {
    for (const descriptor of lazyBuiltInFeatures) {
      expect(descriptor.meta).toBeDefined();
      expect(typeof descriptor.meta.name).toBe('string');
      expect(descriptor.meta.name.length).toBeGreaterThan(0);
      expect(Array.isArray(descriptor.meta.hookTypes)).toBe(true);
      expect(descriptor.meta.hookTypes.length).toBeGreaterThan(0);
      expect(typeof descriptor.meta.priority).toBe('number');
      expect(typeof descriptor.meta.description).toBe('string');
      expect(descriptor.meta.description.length).toBeGreaterThan(0);
      expect(['security', 'quality', 'tracking', 'integration']).toContain(descriptor.meta.category);
    }
  });

  it('all feature names are unique', () => {
    const names = lazyBuiltInFeatures.map((d) => d.meta.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('security features have priority < 100', () => {
    const securityFeatures = lazyBuiltInFeatures.filter((d) => d.meta.category === 'security');
    expect(securityFeatures.length).toBeGreaterThan(0);
    for (const feature of securityFeatures) {
      expect(feature.meta.priority).toBeLessThan(100);
    }
  });

  it('every descriptor has a load() function', () => {
    for (const descriptor of lazyBuiltInFeatures) {
      expect(typeof descriptor.load).toBe('function');
    }
  });

  it('load() resolves to a module with createHandler', async () => {
    // Test with the first descriptor to verify the load mechanism works
    const descriptor = lazyBuiltInFeatures[0]!;
    const featureModule = await descriptor.load();
    expect(featureModule).toBeDefined();
    expect(typeof featureModule.createHandler).toBe('function');
    expect(featureModule.meta).toBeDefined();
    expect(featureModule.meta.name).toBe(descriptor.meta.name);
  });

  it('includes known feature names', () => {
    const names = lazyBuiltInFeatures.map((d) => d.meta.name);
    const expectedNames = [
      'command-guard',
      'file-guard',
      'path-guard',
      'secret-leak-guard',
      'logger',
      'session-tracker',
      'permission-handler',
      'cost-tracker',
    ];
    for (const name of expectedNames) {
      expect(names).toContain(name);
    }
  });
});
