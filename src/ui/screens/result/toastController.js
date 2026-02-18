import { UI_TIMING } from '@lib/config/visual-constants.js';
import { Toast } from '../../components.js';
import { render, remove, bindClick } from '../../dom.js';

/**
 * @typedef {'info' | 'error' | 'success' | 'warning'} ToastType
 * @typedef {{ compact?: boolean, center?: boolean }} ToastOptions
 */

/**
 * @returns {{ showToast: (message: string, type?: ToastType, duration?: number, options?: ToastOptions) => string, closeToast: (toastId: string) => void, destroy: () => void }}
 */
export const createToastController = () => {
  /** @type {Map<string, ReturnType<typeof setTimeout>>} */
  const toastTimers = new Map();

  /**
   * @param {string} toastId
   */
  const closeToast = (toastId) => {
    const timerId = toastTimers.get(toastId);
    if (timerId) {
      clearTimeout(timerId);
      toastTimers.delete(toastId);
    }

    const toast = document.getElementById(toastId);
    if (!toast) return;

    toast.classList.remove('toast-slide-up');
    toast.classList.add('toast-slide-down');

    setTimeout(() => {
      remove(toastId);
    }, UI_TIMING.TOAST_SLIDE_OUT);
  };

  /**
   * @param {string} message
   * @param {ToastType} [type='info']
   * @param {number} [duration=5000]
   * @param {ToastOptions} [options]
   * @returns {string}
   */
  const showToast = (message, type = 'info', duration = 5000, options = {}) => {
    const toastId = `toast-${Date.now()}`;
    render(Toast(toastId, message, type, options));

    const closeBtn = document.getElementById(`${toastId}-close`);
    if (closeBtn) {
      bindClick(`${toastId}-close`, () => {
        closeToast(toastId);
      });
    }

    if (duration > 0) {
      const timerId = setTimeout(() => {
        closeToast(toastId);
      }, duration);
      toastTimers.set(toastId, timerId);
    }

    return toastId;
  };

  const destroy = () => {
    toastTimers.forEach((timerId) => clearTimeout(timerId));
    toastTimers.clear();
  };

  return { showToast, closeToast, destroy };
};
