import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.js', 'lib/**/*.js'],
      exclude: [
        'src/main.js',
        'src/**/*.test.js',
        'src/**/*.spec.js',
      ],
    },
    setupFiles: ['./src/test/setup.js'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@lib': resolve(__dirname, './lib'),
    },
  },
});
