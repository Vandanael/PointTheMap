// @ts-check

/**
 * Create a minimal API client with auth, CSRF, timeout and error normalization.
 * @param {{
 *   apiBase: string,
 *   getAuthHeader: () => Promise<string>,
 *   getCsrfToken: () => string | null,
 *   logger: { error: (...args: any[]) => void },
 *   APIError: typeof import('../core/ErrorHandler.js').APIError,
 * }} deps
 * @returns {(endpoint: string, options?: RequestInit & { timeoutMs?: number }) => Promise<any>}
 */
export const createApiClient = (deps) => {
  const { apiBase, getAuthHeader, getCsrfToken, logger, APIError } = deps;
  const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

  return async (endpoint, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    // Add player token to all requests
    try {
      const authHeader = await getAuthHeader();
      headers['Authorization'] = authHeader;
    } catch (error) {
      logger.error('[API] Failed to get player token:', error);
      // Continue without token - server will handle missing token
    }

    // Add CSRF token to protected endpoints
    const csrfToken = getCsrfToken();
    if (csrfToken && endpoint === 'submit') {
      headers['X-CSRF-Token'] = csrfToken;
    }

    let res;
    try {
      const AbortControllerCtor =
        typeof window !== 'undefined' ? window.AbortController : undefined;
      const controller = options.signal || !AbortControllerCtor ? null : new AbortControllerCtor();
      const timeoutMs =
        typeof options.timeoutMs === 'number' && Number.isFinite(options.timeoutMs)
          ? options.timeoutMs
          : DEFAULT_REQUEST_TIMEOUT_MS;
      const timeoutId =
        controller && timeoutMs > 0
          ? setTimeout(() => {
              controller.abort();
            }, timeoutMs)
          : null;

      try {
        res = await fetch(`${apiBase}/${endpoint}`, {
          ...options,
          headers,
          signal: options.signal ?? controller?.signal,
        });
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    } catch (networkError) {
      if (networkError && networkError.name === 'AbortError') {
        throw new APIError('TIMEOUT', 0, { timeout: true });
      }
      const error = /** @type {Error} */ (networkError);
      throw new APIError(`Network error: ${error.message}`, 0, {
        error: error.message,
        networkError: true,
      });
    }

    if (res.status === 502 || res.status === 503) {
      const data = await res.json().catch(() => ({
        error: res.status === 502 ? 'Bad Gateway - Server error' : 'Service Unavailable',
      }));
      throw new APIError(data.error || `HTTP ${res.status}`, res.status, data);
    }

    const data = await res.json().catch(() => ({ error: 'Invalid response' }));

    if (!res.ok) {
      const errorMessage =
        typeof data?.error === 'string'
          ? data.error
          : typeof data?.error?.message === 'string'
            ? data.error.message
            : `HTTP ${res.status}`;
      throw new APIError(errorMessage, res.status, data);
    }

    return data;
  };
};
