/**
 * Application Lifecycle Management
 *
 * Handles app initialization, iOS viewport fixes, retry queue processing,
 * and cleanup on unload.
 */

import { isIOS } from '../utils/device.js';
import { debounce } from '../utils/performance.js';
import { safeAsync } from '../core/ErrorHandler.js';

/**
 * @typedef {Object} LifecycleDeps
 * @property {typeof import('../ui/UI.js').UI} ui
 * @property {typeof import('../systems/MapSystem.js').mapSystem} mapSystem
 * @property {import('../systems/UISystem.js').UISystem} uiSystem
 * @property {typeof import('../systems/InputSystem.js').inputSystem} inputSystem
 * @property {typeof import('../systems/ScoringSystem.js').scoringSystem} scoringSystem
 * @property {{ processRetryQueue: () => Promise<{successful: number, failed: number}> }} api
 * @property {{ init: () => void }} errorMonitoring
 * @property {{ init: () => void }} analytics
 * @property {typeof import('../utils/logger.js').logger} logger
 * @property {{ t: (key: string) => string }} i18n
 * @property {typeof import('../core/ErrorHandler.js').errorHandler} errorHandler
 */

/**
 * Initialize application lifecycle management
 * @param {LifecycleDeps} deps - Dependencies
 * @returns {{ cleanup: () => void, initializeApp: () => Promise<void> }}
 */
export function initLifecycle(deps) {
  const {
    ui,
    mapSystem,
    uiSystem,
    inputSystem,
    scoringSystem,
    api,
    errorMonitoring,
    analytics,
    logger,
    i18n,
  } = deps;

  // Store iOS viewport listeners for cleanup
  /** @type {(() => void) | null} */
  let iosResizeHandler = null;
  /** @type {(() => void) | null} */
  let iosOrientationHandler = null;
  /** @type {(() => void) | null} */
  let iosScrollHandler = null;
  /** @type {(() => void) | null} */
  let offlineHandler = null;
  /** @type {(() => void) | null} */
  let onlineHandler = null;

  /**
   * iOS: Fix dynamic viewport height to account for Safari's address bar.
   */
  const setupIOSViewport = () => {
    if (!isIOS()) return;

    const setHeight = () => {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    };

    // Set initial height
    setHeight();

    // Update on resize (debounced to avoid excessive calls)
    const debouncedSetHeight = debounce(setHeight, 150);
    // Type assertion: debounce returns Function, but we know it's compatible with EventListener
    iosResizeHandler = /** @type {() => void} */ (debouncedSetHeight);
    window.addEventListener('resize', debouncedSetHeight);

    iosOrientationHandler = setHeight;
    window.addEventListener('orientationchange', iosOrientationHandler);

    // iOS: Also update on scroll (Safari address bar).
    // Uses RAF throttling, which is already optimal.
    let ticking = false;
    iosScrollHandler = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setHeight();
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', iosScrollHandler, { passive: true });
  };

  /**
   * Process retry queue and show loader progress
   */
  const initializeApp = async () => {
    // iOS: Configurer le viewport height dynamique en premier
    setupIOSViewport();

    // Initialize monitoring services (production only)
    errorMonitoring.init();
    analytics.init();

    const retryResult = (await safeAsync(() => api.processRetryQueue(), 'retry-queue', {
      successful: 0,
      failed: 0,
    })) ?? { successful: 0, failed: 0 };

    if (retryResult.successful > 0) {
      logger.log(`✅ ${retryResult.successful} score(s) synchronisé(s)`);
    }
    if (retryResult.failed > 0) {
      logger.warn(`⚠️ ${retryResult.failed} score(s) en attente`);
    }

    ui.showStart();
  };

  /**
   * Setup offline/online status indicators
   */
  const setupNetworkStatusIndicators = () => {
    offlineHandler = () => {
      ui.showToast(
        i18n.t('offline.message') || 'You are offline. Some features may not work.',
        'warning',
        5000
      );
    };

    onlineHandler = () => {
      ui.showToast(i18n.t('online.message') || 'You are back online!', 'success', 2000);
    };

    window.addEventListener('offline', offlineHandler);
    window.addEventListener('online', onlineHandler);
  };

  /**
   * Cleanup all event subscriptions and systems
   */
  const cleanup = () => {
    // Clean up iOS viewport listeners
    if (iosResizeHandler) {
      window.removeEventListener('resize', iosResizeHandler);
    }
    if (iosOrientationHandler) {
      window.removeEventListener('orientationchange', iosOrientationHandler);
    }
    if (iosScrollHandler) {
      window.removeEventListener('scroll', iosScrollHandler);
    }
    if (offlineHandler) {
      window.removeEventListener('offline', offlineHandler);
    }
    if (onlineHandler) {
      window.removeEventListener('online', onlineHandler);
    }

    // Cleanup systems
    ui.destroy();
    uiSystem.destroy();
    mapSystem.destroy();
    inputSystem.destroy();
    scoringSystem.destroy();
  };

  /**
   * Setup beforeunload cleanup
   */
  const setupBeforeUnloadCleanup = () => {
    window.addEventListener('beforeunload', cleanup);
  };

  // Initialize
  setupNetworkStatusIndicators();
  setupBeforeUnloadCleanup();

  return {
    cleanup,
    initializeApp,
  };
}
