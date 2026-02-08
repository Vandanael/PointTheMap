/// <reference types="vite/client" />
import { initApp } from './bootstrap.js';
import { errorHandler } from './core/ErrorHandler.js';

document.addEventListener('DOMContentLoaded', () => {
  initApp().catch((e) => {
    errorHandler.handle(e, 'dom-ready', { showToUser: true, fatal: true });
  });
});
