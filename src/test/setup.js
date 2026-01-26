// Global test setup
import { vi } from 'vitest';

// Suppress console logs in tests unless explicitly needed
const originalConsole = globalThis.console;
globalThis.console = {
  ...originalConsole,
  log: vi.fn(),
  warn: vi.fn(),
  error: originalConsole.error, // Keep errors visible
};
