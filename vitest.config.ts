import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/fixtures/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/guards/**',      // Re-export shims
        'src/validators/**',  // Re-export shims
        'src/handlers/**',    // Re-export shims
      ],
    },
  },
});
