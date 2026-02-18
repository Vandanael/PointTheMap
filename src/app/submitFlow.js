/**
 * Submit Flow
 *
 * Handles everything after the last round ends: score submission,
 * error recovery, pseudo lock retry, share functionality, and replay.
 * Receives all dependencies via a context object — does not import UI modules directly.
 */

import { handleError, APIError, ValidationError } from '../core/ErrorHandler.js';

/**
 * @typedef {import('../game/Game.js').GameState} GameState
 */

const PSEUDO_LOCK_ERROR = 'pseudo_already_set_for_this_ip';
const MAX_SUBMIT_ATTEMPTS = 2; // initial attempt + one retry on 409
const UNKNOWN_LOCKED_PSEUDO = 'LOCKED';

/**
 * Extract locked pseudo from API error payloads.
 * Supports both legacy `data.pseudo` and canonical `data.error.details.pseudo`.
 * @param {any} err
 * @returns {string}
 */
const getLockedPseudo = (err) =>
  err?.data?.error?.details?.pseudo || err?.data?.pseudo || UNKNOWN_LOCKED_PSEUDO;

/**
 * Create submit flow handlers.
 * @param {{
 *   stateManager: import('../core/StateManager.js').StateManager,
 *   api: { submitWithRetry: any },
 *   storage: { setLastPseudo: any },
 *   game: { checkIfNewSessionBest: any, updateSessionBestScore: any, resetGame: any },
 *   stats: { updateStats: any, getStats: any },
 *   achievements: { checkAchievements: any },
 *   share: { getDailyNumber: any, formatShareText: any, shareGameResults: any },
 *   analytics: { track: any },
 *   ui: any,
 *   logger: typeof import('../utils/logger.js').logger,
 *   i18n: { t: any },
 *   config: { isCapitalCategory: any, isCountryCategory: any, isStadiumCategory: any, isCivilizationCategory: any, isDailyVariant: any, MODE_IDS: any },
 *   validationSystem: any,
 *   timerSystem: { stop: any },
 *   inputSystem: { disableMapInput: any },
 *   mapSystem: { disableClicks: any, clearMap: any, flyTo: any },
 *   MAP: any,
 * }} context
 */
export function createSubmitFlow(context) {
  const {
    stateManager,
    api,
    storage,
    game,
    stats,
    achievements,
    share,
    analytics,
    ui,
    logger,
    i18n,
    config,
    validationSystem,
    timerSystem,
    inputSystem,
    mapSystem,
    MAP,
  } = context;

  const {
    isCapitalCategory,
    isCountryCategory,
    isStadiumCategory,
    isCivilizationCategory,
    isDailyVariant,
    MODE_IDS,
  } = config;

  // Store share button handler for cleanup
  /** @type {(() => void) | null} */
  let shareButtonHandler = null;

  /**
   * Handle submit score.
   * @param {string} pseudo
   */
  const handleSubmit = async (pseudo) => {
    const submitBtn = /** @type {HTMLButtonElement | null} */ (
      document.getElementById('btn-submit')
    );
    const setButtonSaving = () => {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = i18n.t('saving');
      }
    };
    const restoreSubmitButton = () => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = i18n.t('save');
      }
    };

    /** @type {any} */
    let lastError = null;
    let currentPseudo = pseudo;

    if (validationSystem) {
      /** @type {GameState} */
      const state = stateManager.getState();
      const validationRounds = state.rounds.map((round) => ({
        capital:
          round.capital?.name ||
          round.country?.name ||
          round.stadium?.name ||
          round.civilization?.name ||
          '',
        status: round.status,
        click: round.click ?? null,
      }));
      const validation = validationSystem.validateSession(
        {
          token: state.token,
          rounds: validationRounds,
          pseudo: currentPseudo,
        },
        state.runtimeConfig?.roundCount
      );

      if (!validation.valid) {
        restoreSubmitButton();
        handleError(
          new ValidationError(validation.error || i18n.t('error.submitError'), 'submit'),
          'score:submit',
          {
            showToUser: true,
            fatal: false,
          }
        );
        return;
      }
    } else {
      logger.warn('[submit] validationSystem not configured; skipping client-side validation');
    }

    for (let attempt = 0; attempt < MAX_SUBMIT_ATTEMPTS; attempt++) {
      setButtonSaving();
      try {
        /** @type {GameState} */
        const state = stateManager.getState();
        const sanitizedRounds = state.rounds.map((round, index) => {
          const sanitizedRound = {
            click: round.click,
            status: round.status,
            score:
              round.score !== null && typeof round.score === 'number'
                ? Math.max(0, Math.floor(round.score))
                : 0,
            timeElapsed:
              round.endTime && round.startTime ? Math.floor(round.endTime - round.startTime) : 0,
            correctCountryId: round.correctCountryId ?? undefined,
            clickedCountryId: round.clickedCountryId ?? undefined,
            distanceToTargetKm: round.distanceToTargetKm ?? undefined,
            correctCivilizationId: round.correctCivilizationId ?? undefined,
            clickedCivilizationId: round.clickedCivilizationId ?? undefined,
          };

          // Use original target names from session to ensure exact match with server expectations
          const target =
            state.targets && state.targets.length > index ? state.targets[index] : null;

          // Extract target name — prefer explicit target from session for validation accuracy
          const targetName =
            target && typeof target === 'object' && 'name' in target ? target.name : null;

          // Debug logging for round sanitization
          if (index === 0) {
            logger.log('[submit] Round 0 sanitization debug:', {
              gameType: state.gameType,
              'round.capital': round.capital,
              'round.country': round.country,
              'round.stadium': round.stadium,
              'round.civilization': round.civilization,
              target,
              targetName,
              isCivMode: isCivilizationCategory(state.gameType),
            });
          }

          // Set mode-specific fields from round data, with fallback to session target
          if (isCapitalCategory(state.gameType)) {
            const capitalName = round.capital?.name || targetName;
            if (!capitalName) {
              logger.error('[submit] Missing capital name for round', index, {
                round,
                target,
                gameType: state.gameType,
              });
            }
            sanitizedRound.capital = capitalName || 'Unknown';
          } else if (isCountryCategory(state.gameType)) {
            const countryName = round.country?.name || round.country?.countryId || targetName;
            if (!countryName) {
              logger.error('[submit] Missing country name for round', index, {
                round,
                target,
                gameType: state.gameType,
              });
            }
            sanitizedRound.country = countryName || 'Unknown';
            if (round.country?.countryId) {
              sanitizedRound.countryId = round.country.countryId;
            }
          } else if (isStadiumCategory(state.gameType)) {
            const stadiumName = round.stadium?.name || targetName;
            if (!stadiumName) {
              logger.error('[submit] Missing stadium name for round', index, {
                round,
                target,
                gameType: state.gameType,
              });
            }
            sanitizedRound.stadium = stadiumName || 'Unknown';
            if (round.stadium?.city) {
              sanitizedRound.city = round.stadium.city;
            }
          } else if (isCivilizationCategory(state.gameType)) {
            const civilizationName = round.civilization?.name || targetName;
            if (!civilizationName) {
              logger.error('[submit] Missing civilization name for round', index, {
                round,
                target,
                gameType: state.gameType,
              });
            }
            sanitizedRound.civilization = civilizationName || 'Unknown';
            if (round.civilization?.id) {
              sanitizedRound.civilizationId = round.civilization.id;
            }
          } else {
            // Unknown game type — this should never happen but log it if it does
            logger.error('[submit] Unknown game type, defaulting to capital', {
              gameType: state.gameType,
              round,
              target,
            });
            sanitizedRound.capital = targetName || 'Unknown';
          }

          // Final safety check: convert any null string/number fields to undefined for Zod validation
          // Zod .optional() accepts undefined but NOT null (except 'click' which is explicitly nullable)
          Object.keys(sanitizedRound).forEach((key) => {
            if (key !== 'click' && sanitizedRound[key] === null) {
              sanitizedRound[key] = undefined;
            }
          });

          // Debug: Log final sanitized round for first round
          if (index === 0) {
            logger.log('[submit] Round 0 after sanitization:', {
              capital: sanitizedRound.capital,
              country: sanitizedRound.country,
              stadium: sanitizedRound.stadium,
              civilization: sanitizedRound.civilization,
              hasClick: !!sanitizedRound.click,
              status: sanitizedRound.status,
            });
          }

          return sanitizedRound;
        });

        // Debug logging for payload validation
        logger.log('[submit] Prepared payload for submission:', {
          token: state.token?.substring(0, 8) + '...',
          pseudo: currentPseudo,
          gameType: state.gameType,
          roundsCount: sanitizedRounds.length,
          firstRoundSample: sanitizedRounds[0] && {
            score: sanitizedRounds[0].score,
            timeElapsed: sanitizedRounds[0].timeElapsed,
            country: sanitizedRounds[0].country,
            civilization: sanitizedRounds[0].civilization,
            click: sanitizedRounds[0].click,
            status: sanitizedRounds[0].status,
          },
        });

        /** @type {import('../game/Game.js').SubmitResult} */
        const result = await api.submitWithRetry(
          state.token,
          sanitizedRounds,
          currentPseudo,
          state.gameType,
          state.csrfToken || null
        );
        storage.setLastPseudo(currentPseudo);

        const isNewBest = game.checkIfNewSessionBest(state, result.score);
        stateManager.setState(game.updateSessionBestScore(state, result.score), 'score:submit');

        // Update stats and check achievements
        const updatedStats = stats.updateStats(state.rounds, state.gameType);
        achievements.checkAchievements(state.rounds, updatedStats, result.rank);

        ui.showFinalResults(result.score, currentPseudo, result, isNewBest);

        // Track game completion
        analytics.track('game_completed', {
          totalScore: result.score,
          gameType: state.gameType,
          rounds: state.rounds.length,
          rank: result.rank,
          isTopFifty: result.isTopFifty,
          isNewSessionBest: isNewBest,
        });

        analytics.track('score_submitted', {
          totalScore: result.score,
          gameType: state.gameType,
          rank: result.rank,
          isTopFifty: result.isTopFifty,
        });

        // Bind share button (after ui.showFinalResults renders the button)
        const shareBtn = document.getElementById('btn-share');
        if (shareBtn) {
          if (shareButtonHandler) {
            shareBtn.removeEventListener('click', shareButtonHandler);
          }
          shareButtonHandler = async () => {
            const avgDistance =
              state.rounds.reduce(
                (/** @type {number} */ sum, /** @type {any} */ r) => sum + (r.distance || 0),
                0
              ) / state.rounds.length;
            const currentStats = stats.getStats();
            const dailyDateKey =
              state.gameType === MODE_IDS.COUNTRY_DAILY
                ? 'lastCountryDailyDate'
                : state.gameType === MODE_IDS.STADIUM_DAILY
                  ? 'lastStadiumDailyDate'
                  : state.gameType === MODE_IDS.CIVILIZATION_DAILY
                    ? 'lastCivilizationDailyDate'
                    : 'lastDailyDate';
            const dailyNumber = isDailyVariant(state.gameType)
              ? share.getDailyNumber(currentStats[dailyDateKey])
              : null;
            const shareText = share.formatShareText(dailyNumber, avgDistance, state.rounds);
            const success = await share.shareGameResults(shareText);
            analytics.track('share_clicked', { source: 'result', success });
            ui.showToast(
              success ? i18n.t('shareCopied') : i18n.t('shareFailed'),
              success ? 'success' : 'error',
              3000,
              { compact: true }
            );
          };
          shareBtn.addEventListener('click', shareButtonHandler);
        }
        return;
      } catch (error) {
        const err = /** @type {any} */ (error);
        const errorCode =
          err?.data?.error?.code ||
          (typeof err?.data?.error === 'string' ? err.data.error : err?.data?.error);
        const is409Lock = err.status === 409 && errorCode === PSEUDO_LOCK_ERROR;
        const canRetry409 = attempt < MAX_SUBMIT_ATTEMPTS - 1;

        if (is409Lock && canRetry409) {
          restoreSubmitButton();
          const lockedPseudo = getLockedPseudo(err);
          await new Promise((resolve) => {
            ui.showPseudoLockedDialog(lockedPseudo, () => resolve(undefined));
          });
          currentPseudo = lockedPseudo;
          continue;
        }
        lastError = err;
        break;
      }
    }

    restoreSubmitButton();
    if (lastError) {
      const errorCode =
        lastError?.data?.error?.code ||
        (typeof lastError?.data?.error === 'string'
          ? lastError.data.error
          : lastError?.data?.error);
      if (lastError.status === 409 && errorCode === PSEUDO_LOCK_ERROR) {
        ui.showPseudoLockedDialog(getLockedPseudo(lastError), () => {});
      } else {
        const apiError = new APIError(
          lastError.message || i18n.t('error.submitError'),
          lastError.status || 500,
          lastError.data
        );
        handleError(apiError, 'score:submit', { showToUser: true, fatal: false });
      }
    }
  };

  /**
   * Handle replay — reset game and return to start screen.
   */
  const handleReplay = () => {
    const state = stateManager.getState();
    analytics.track('replay_clicked', { gameType: state.gameType });
    document.body.classList.add('app-resetting');
    setTimeout(() => {
      document.body.classList.remove('app-resetting');
    }, 250);
    timerSystem.stop();
    inputSystem.disableMapInput();
    mapSystem.disableClicks();
    stateManager.setState(game.resetGame(), 'game:reset');
    mapSystem.clearMap();
    mapSystem.flyTo(/** @type {[number, number]} */ (MAP.CENTER), MAP.ZOOM, { animate: false });
    ui.hideRoundResult();
    ui.hideQuestion();
    ui.hideGameUI();
    ui.hideGameOver();
    shareButtonHandler = null;
    ui.showStart();
  };

  /**
   * Clean up share button handler.
   */
  const cleanup = () => {
    if (shareButtonHandler) {
      const shareBtn = document.getElementById('btn-share');
      if (shareBtn) {
        shareBtn.removeEventListener('click', shareButtonHandler);
      }
      shareButtonHandler = null;
    }
  };

  return { handleSubmit, handleReplay, cleanup };
}
