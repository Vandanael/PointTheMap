/**
 * Game Flow Controller
 *
 * Orchestrates game flow sequences: start, map click, round end, next round,
 * submit, and replay. Handles branching logic per game mode (capital, country,
 * stadium, civilization) and coordinates systems/UI/state updates.
 */

import { safeAsync, handleError, APIError, ValidationError } from '../core/ErrorHandler.js';
import { EVENTS } from '../core/eventTypes.js';
import { createMapQueryAdapter, createRoundRulesAdapter } from '../game/ports.js';
import { UI_TIMING } from '@lib/config/visual-constants.js';
import { getModeStrategy } from './modeStrategies.js';

/**
 * @typedef {Object} GameFlowDeps
 * @property {import('../core/StateManager.js').StateManager} stateManager
 * @property {typeof import('../core/EventBus.js').eventBus} eventBus
 * @property {typeof import('../systems/MapSystem.js').mapSystem} mapSystem
 * @property {typeof import('../systems/TimerSystem.js').timerSystem} timerSystem
 * @property {typeof import('../systems/InputSystem.js').inputSystem} inputSystem
 * @property {typeof import('../systems/ScoringSystem.js').scoringSystem} scoringSystem
 * @property {typeof import('../systems/ValidationSystem.js').validationSystem} validationSystem
 * @property {typeof import('../ui/UI.js').UI} ui
 * @property {{ startGame: any, playRound: any, handleTimeout: any, nextRound: any, getCurrentTarget: any, isLastRound: any, getProgress: any, checkIfNewSessionBest: any, updateSessionBestScore: any, resetGame: any, GameStatus: any }} game
 * @property {{ getRemainingTime: any }} round
 * @property {{ submitWithRetry: any }} api
 * @property {{ setLastPseudo: any }} storage
 * @property {{ updateStats: any, getStats: any }} stats
 * @property {{ checkAchievements: any }} achievements
 * @property {{ formatShareText: any, shareGameResults: any, getDailyNumber: any }} share
 * @property {{ track: any }} analytics
 * @property {typeof import('../utils/logger.js').logger} logger
 * @property {{ t: any, getLang: any, getCivilizationName: (id: string, fallback?: string) => string }} i18n
 * @property {{ TIMING: any, MAP: any, MODE_IDS: any, isDailyVariant: any, isCapitalCategory: any, isStadiumCategory: any, isCountryCategory: any, isCivilizationCategory: any }} config
 */

/**
 * Create a game flow controller
 * @param {GameFlowDeps} deps - Dependencies
 * @returns {{
 *   handleStart: (gameType?: string) => Promise<void>,
 *   handleMapClick: (coords: [number, number]) => void,
 *   onRoundEnd: () => Promise<void>,
 *   handleNext: () => void,
 *   handleSubmit: (pseudo: string) => Promise<void>,
 *   handleReplay: () => void,
 *   resumeFromState: (state: any) => Promise<boolean>,
 *   cleanup: () => void
 * }}
 */
export function createGameFlowController(deps) {
  /** @typedef {import('../game/Game.js').GameState} GameState */
  /** @typedef {import('../game/Game.js').Round} Round */
  const {
    stateManager,
    eventBus,
    mapSystem,
    timerSystem,
    inputSystem,
    scoringSystem,
    ui,
    game,
    api,
    storage,
    stats,
    achievements,
    share,
    analytics,
    logger,
    i18n,
    config,
  } = deps;

  const {
    TIMING,
    MAP,
    MODE_IDS,
    isDailyVariant,
    isStadiumCategory,
    isCountryCategory,
    isCivilizationCategory,
  } = config;
  const { GameStatus } = game;

  // Create port adapters for game core dependencies
  const mapQuery = createMapQueryAdapter(mapSystem);
  const roundRules = createRoundRulesAdapter(deps.validationSystem, scoringSystem);

  // Store share button handler for cleanup
  /** @type {(() => void) | null} */
  let shareButtonHandler = null;

  /**
   * Start timer for current round
   */
  const startTimer = () => {
    ui.resetTimer();
    /** @type {GameState} */
    const state = stateManager.getState();
    const roundId = state.currentRound?.roundId ?? null;
    timerSystem.start(state.runtimeConfig ?? undefined, { roundId });
  };

  /**
   * Stop timer
   */
  const stopTimer = () => {
    timerSystem.stop();
  };

  /**
   * Start round gameplay after tiles are ready (guards against blank maps/timeouts).
   * @param {number | null} roundId
   */
  const startRoundWhenReady = async (roundId) => {
    let started = false;
    const startRoundNow = () => {
      if (started) return;
      const currentState = stateManager.getState();
      if (
        currentState.status !== GameStatus.PLAYING ||
        currentState.currentRound?.roundId !== roundId
      ) {
        return;
      }
      started = true;
      stateManager.setState(
        {
          ...currentState,
          currentRound: { ...currentState.currentRound, startTime: Date.now() },
        },
        'round:timer-sync'
      );
      const latest = stateManager.getState();
      trackRoundStarted(latest);
      mapSystem.prefetchFullGeoJSONForMode(latest.gameType);
      startTimer();
      // Enable map input after timer starts (InputSystem guards early clicks).
      setTimeout(() => {
        mapSystem.enableClicks(() => {}); // InputSystem handles via EventBus
        inputSystem.enableMapInput(handleMapClick);
      }, 0);
    };

    const ready = await mapSystem.waitForTilesReady({
      timeoutMs: MAP.TILE_LOAD_TIMEOUT_MS ?? 8000,
    });

    if (!ready) {
      ui.showToast(i18n.t('error.mapLoadFailed'), 'error', 3500);
      const unsub = eventBus.subscribe(EVENTS.MAP_TILES_LOADED, () => {
        unsub();
        startRoundNow();
      });
      return;
    }

    startRoundNow();
  };

  /**
   * Show localized "target not found" error for the given game type.
   * @param {string} gameType
   */
  function showTargetNotFoundError(gameType) {
    const errorKey = isCountryCategory(gameType)
      ? 'error.targetNotFoundCountry'
      : isStadiumCategory(gameType)
        ? 'error.targetNotFoundStadium'
        : isCivilizationCategory(gameType)
          ? 'error.targetNotFoundCivilization'
          : 'error.targetNotFoundCapital';
    ui.showError(i18n.t(errorKey));
  }

  /**
   * Build analytics properties for a round.
   * @param {Round} round
   * @param {string} gameType
   */
  function buildRoundAnalyticsProps(round, gameType) {
    const isCountryMode = isCountryCategory(gameType);
    const isStadiumMode = isStadiumCategory(gameType);
    const isCivilizationMode = isCivilizationCategory(gameType);
    const targetType = isCountryMode
      ? 'country'
      : isStadiumMode
        ? 'stadium'
        : isCivilizationMode
          ? 'civilization'
          : 'capital';

    const target =
      targetType === 'country'
        ? round.country
        : targetType === 'stadium'
          ? round.stadium
          : targetType === 'civilization'
            ? round.civilization
            : round.capital;

    return {
      gameType,
      roundNumber: round.roundNumber,
      roundId: round.roundId,
      targetType,
      targetName: target?.name ?? null,
      targetId:
        targetType === 'civilization' && target && 'id' in target ? (target.id ?? null) : null,
      targetCountryId:
        targetType === 'country' && target && 'countryId' in target
          ? (target.countryId ?? null)
          : null,
      status: round.status,
      score: round.score ?? 0,
      baseScore: round.baseScore ?? 0,
      timeBonus: round.timeBonus ?? 0,
      distance: Number.isFinite(round.distance) ? round.distance : null,
      distanceToTargetKm: Number.isFinite(round.distanceToTargetKm)
        ? round.distanceToTargetKm
        : null,
      clickedCountryId: round.clickedCountryId ?? null,
      correctCountryId: round.correctCountryId ?? null,
      clickedCivilizationId: round.clickedCivilizationId ?? null,
      correctCivilizationId: round.correctCivilizationId ?? null,
    };
  }

  /**
   * Track round start for analytics.
   * @param {GameState} state
   */
  function trackRoundStarted(state) {
    if (!state.currentRound) return;
    analytics.track('round_started', buildRoundAnalyticsProps(state.currentRound, state.gameType));
  }

  /**
   * Render the current round UI for an existing state.
   * @param {GameState} state
   * @param {{ requireButton?: boolean }} [options]
   * @returns {boolean}
   */
  const renderRoundUI = (state, options = {}) => {
    const target = game.getCurrentTarget(state);
    const strategy = getModeStrategy(state.gameType);

    if (!target || !target.name) {
      showTargetNotFoundError(state.gameType);
      ui.hideQuestion();
      return false;
    }

    const progress = game.getProgress(state);
    ui.showGameUI(progress.current, progress.total, state.totalScore);

    const displayName = strategy.getDisplayName(target, i18n);
    const displaySubtitle = strategy.getDisplaySubtitle(target);

    const onReady = () => {
      const currentState = stateManager.getState();
      const roundId = currentState.currentRound?.roundId ?? null;
      void startRoundWhenReady(roundId);
    };

    ui.showQuestion(displayName, displaySubtitle, onReady, {
      requireButton: Boolean(options.requireButton),
    });
    return true;
  };

  /**
   * Handle game start
   * @param {string} [gameType="classic"]
   */
  const handleStart = async (gameType = MODE_IDS.CLASSIC) => {
    ui.hideStart();
    // Show loader while fetching game data
    ui.showLoader();

    mapSystem.clearMap();
    const { center: startCenter, zoom: startZoom } = getModeStrategy(gameType).getMapView(MAP);
    mapSystem.flyTo(startCenter, startZoom, { animate: false });

    const newState = await safeAsync(
      () => game.startGame(stateManager.getState(), gameType),
      'game:start',
      null
    );

    // Hide loader
    ui.hideLoader();

    if (!newState) {
      // Error already handled by errorHandler — recover by showing start screen
      ui.showStart();
      return;
    }
    stateManager.setState(newState, `game:start:${gameType}`);

    /** @type {GameState} */
    const state = stateManager.getState();
    if (state.status !== GameStatus.PLAYING) {
      if (state.error) ui.showToast(i18n.t(state.error), 'error', 4000);
      ui.showStart();
      return;
    }

    // Track game start
    analytics.track('game_started', {
      gameType,
      roundCount: state.runtimeConfig?.roundCount || 5,
    });

    logger.debug('[Game Start]', {
      gameType: state.gameType,
      roundCount: state.runtimeConfig?.roundCount,
    });

    // Emit game started event
    eventBus.emit(EVENTS.GAME_STARTED, {
      gameType,
      capitalCount: state.targets?.length || state.capitals.length || state.countries.length,
    });

    const target = game.getCurrentTarget(state);

    if (!target || !target.name) {
      showTargetNotFoundError(state.gameType);
      ui.hideQuestion();
      return;
    }

    if (state.currentRoundIndex === 0) {
      renderRoundUI(state, { requireButton: true });
    } else {
      renderRoundUI(state);
    }
  };

  /**
   * Handle map click
   * @param {[number, number]} coords - [lat, lng] coordinates
   */
  const handleMapClick = async (coords) => {
    /** @type {GameState} */
    const state = stateManager.getState();
    if (state.status !== GameStatus.PLAYING) return;
    // Stop timer to prevent timeout events from firing
    stopTimer();
    mapSystem.disableClicks();
    inputSystem.disableMapInput();
    const fullReady = await mapSystem.ensureFullGeoJSONForMode(state.gameType);
    if (!fullReady) {
      handleError(new Error('GeoJSON not ready for scoring'), 'map:geojson', {
        showToUser: true,
        fatal: false,
      });
      startTimer();
      mapSystem.enableClicks(() => {});
      inputSystem.enableMapInput(handleMapClick);
      return;
    }
    stateManager.setState(game.playRound(state, coords, mapQuery, roundRules), 'round:click');
    onRoundEnd();
  };

  /**
   * Handle round end - shows results and waits for user to continue
   */
  const onRoundEnd = async () => {
    const state = stateManager.getState();

    // Guard: Only process if we're in ROUND_RESULT status (prevents double execution)
    if (state.status !== GameStatus.ROUND_RESULT) {
      return;
    }

    mapSystem.disableClicks();
    inputSystem.disableMapInput();
    stopTimer();

    const currentRound = state.currentRound;
    const strategy = getModeStrategy(state.gameType);

    if (!currentRound) return;
    if (!strategy.hasRequiredData(currentRound)) return;

    // Emit round completed event
    eventBus.emit(EVENTS.GAME_ROUND_COMPLETED, { round: currentRound });

    analytics.track(
      currentRound.status === 'timeout' ? 'round_timeout' : 'round_completed',
      buildRoundAnalyticsProps(currentRound, state.gameType)
    );

    if (
      currentRound.click &&
      currentRound.click.lat !== null &&
      currentRound.click.lat !== undefined &&
      currentRound.click.lng !== null &&
      currentRound.click.lng !== undefined
    ) {
      const clickCoords = /** @type {[number, number]} */ ([
        currentRound.click.lat,
        currentRound.click.lng,
      ]);

      await strategy.showClickResult(mapSystem, currentRound, clickCoords);

      // Tap/click to continue to modal, or wait RESULT_READ_TIME_MS
      /** @type {Promise<void>} */
      const userContinued = new Promise((r) => mapSystem.setOnResultContinue(() => r()));
      /** @type {Promise<void>} */
      const timeoutPromise = new Promise((r) => setTimeout(r, TIMING.RESULT_READ_TIME_MS));
      await Promise.race([userContinued, timeoutPromise]);
      mapSystem.clearOnResultContinue();

      // Emit score updated event
      eventBus.emit(EVENTS.SCORE_UPDATED, {
        oldScore: state.totalScore - currentRound.score,
        newScore: state.totalScore,
        delta: currentRound.score,
      });

      const displayDistance = strategy.getDisplayDistance(currentRound);
      ui.showRoundResult(
        displayDistance,
        currentRound.score,
        currentRound.status === 'timeout',
        game.isLastRound(state),
        currentRound.baseScore,
        currentRound.timeBonus
      );
    } else if (currentRound.status === 'timeout') {
      // Timeout with no click: reveal correct target so the player learns where it was
      strategy.showTimeoutReveal(mapSystem, currentRound);

      /** @type {Promise<void>} */
      const userContinuedTimeout = new Promise((r) => mapSystem.setOnResultContinue(() => r()));
      /** @type {Promise<void>} */
      const timeoutPromiseResult = new Promise((r) => setTimeout(r, TIMING.RESULT_READ_TIME_MS));
      await Promise.race([userContinuedTimeout, timeoutPromiseResult]);
      mapSystem.clearOnResultContinue();

      ui.showRoundResult(
        null,
        currentRound.score,
        true,
        game.isLastRound(state),
        currentRound.baseScore,
        currentRound.timeBonus
      );
    }
  };

  /**
   * Handle next round
   */
  const handleNext = () => {
    let state = stateManager.getState();
    if (state.status !== GameStatus.ROUND_RESULT) {
      return;
    }
    ui.hideRoundResult();
    mapSystem.clearMap(); // Clears all markers (including capitals)

    if (game.isLastRound(state)) {
      ui.showGameOver(state.totalScore);
      return;
    }

    stateManager.setState(game.nextRound(state), 'round:next');
    state = stateManager.getState();

    const strategy = getModeStrategy(state.gameType);
    const { center: nextCenter, zoom: nextZoom } = strategy.getMapView(MAP);
    mapSystem.flyTo(nextCenter, nextZoom, { animate: false });

    const target = game.getCurrentTarget(state);

    if (!target || !target.name) {
      showTargetNotFoundError(state.gameType);
      return;
    }

    const progress = game.getProgress(state);
    ui.updateGameUI(progress.current, progress.total, state.totalScore);

    const displayName = strategy.getDisplayName(target, i18n);
    const displaySubtitle = strategy.getDisplaySubtitle(target);

    ui.showRoundTransition(progress.current, progress.total);

    setTimeout(() => {
      ui.hideRoundTransition();
      ui.resetTimer();
      ui.showQuestion(displayName, displaySubtitle, () => {
        const currentState = stateManager.getState();
        const roundId = currentState.currentRound?.roundId ?? null;
        void startRoundWhenReady(roundId);
      });
    }, UI_TIMING.ROUND_TRANSITION_MS);
  };

  const PSEUDO_LOCK_ERROR = 'pseudo_already_set_for_this_ip';
  const MAX_SUBMIT_ATTEMPTS = 2; // initial attempt + one retry on 409

  /**
   * Handle submit score
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

    const validationSystem = deps.validationSystem;
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
              round.endTime && round.startTime
                ? Math.floor(round.endTime - round.startTime)
                : undefined,
            correctCountryId: round.correctCountryId ?? undefined,
            clickedCountryId: round.clickedCountryId ?? undefined,
            distanceToTargetKm: round.distanceToTargetKm ?? undefined,
            correctCivilizationId: round.correctCivilizationId ?? undefined,
            clickedCivilizationId: round.clickedCivilizationId ?? undefined,
          };

          // Use original target names from session to ensure exact match with server expectations
          // Note: state.targets might not be available in test environments
          const target =
            state.targets && state.targets.length > index ? state.targets[index] : null;

          if (round.capital?.name) {
            sanitizedRound.capital = round.capital.name;
          }
          if (round.country?.name) {
            sanitizedRound.country = round.country.name;
          } else if (round.country?.countryId) {
            // Fallback: use countryId as name if name is missing (shouldn't happen in normal flow)
            sanitizedRound.country = round.country.countryId;
          }
          if (round.country?.countryId) {
            sanitizedRound.countryId = round.country.countryId;
          }
          if (round.stadium?.name) {
            sanitizedRound.stadium = round.stadium.name;
          }
          if (round.stadium?.city) {
            sanitizedRound.city = round.stadium.city;
          }

          // For civilization mode, use the exact target name from the session
          // Only override if we have valid target data (targets might not be available in test environments)
          if (target && typeof target === 'object' && 'name' in target && target.name) {
            // This ensures we send the exact same name that the server expects for validation
            const shouldOverrideTargetName =
              (deps.config.isCivilizationCategory(state.gameType) &&
                !sanitizedRound.civilization) ||
              (deps.config.isCountryCategory(state.gameType) && !sanitizedRound.country) ||
              (deps.config.isStadiumCategory(state.gameType) && !sanitizedRound.stadium) ||
              (deps.config.isCapitalCategory(state.gameType) && !sanitizedRound.capital);

            if (shouldOverrideTargetName) {
              if (deps.config.isCivilizationCategory(state.gameType)) {
                sanitizedRound.civilization = target.name;
              } else if (deps.config.isCountryCategory(state.gameType)) {
                sanitizedRound.country = target.name;
              } else if (deps.config.isStadiumCategory(state.gameType)) {
                sanitizedRound.stadium = target.name;
              } else {
                // Capital mode
                sanitizedRound.capital = target.name;
              }
            }
          }

          // Add IDs if available
          if (round.civilization?.id) {
            // Use 'id' for civilizationId as per schema
            sanitizedRound.civilizationId = round.civilization.id;
          }
          if (round.country?.countryId) {
            sanitizedRound.countryId = round.country.countryId;
          }
          return sanitizedRound;
        });

        // Debug logging for payload validation
        deps.logger.log('[submit] Prepared payload for submission:', {
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
          sanitizedRounds, // Use the transformed rounds
          currentPseudo,
          state.gameType
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

        // Bind share button (after UI.showFinalResults renders the button)
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
            const shareText = share.formatShareText(
              dailyNumber,
              avgDistance,
              state.rounds,
              i18n.getLang()
            );
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
          await new Promise((resolve) => {
            ui.showPseudoLockedDialog(err.data.pseudo, () => resolve(undefined));
          });
          currentPseudo = err.data.pseudo;
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
        ui.showPseudoLockedDialog(lastError.data.pseudo, () => {});
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
   * Handle replay
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
    ui.hideGameUI(); // Clear game header and timer from previous game
    ui.hideGameOver();
    // Clean up share button handler
    shareButtonHandler = null;
    ui.showStart();
  };

  /**
   * Resume an in-progress game state after reload.
   * @param {GameState} savedState
   * @returns {Promise<boolean>}
   */
  const resumeFromState = async (savedState) => {
    if (!savedState) return false;

    if (!mapSystem.isInitialized()) {
      await mapSystem.init('map');
    }
    const strategy = getModeStrategy(savedState.gameType);
    await strategy.loadGeoData(mapSystem);

    if (savedState.status === GameStatus.PLAYING) {
      // Reset round timing to avoid immediate timeout on resume
      const refreshedState = {
        ...savedState,
        currentRound: savedState.currentRound
          ? {
              ...savedState.currentRound,
              startTime: Date.now(),
              endTime: null,
              status: GameStatus.PLAYING,
            }
          : null,
      };

      ui.hideStart();
      mapSystem.clearMap();
      const { center: startCenter, zoom: startZoom } = strategy.getMapView(MAP);
      mapSystem.flyTo(startCenter, startZoom, { animate: false });

      stateManager.setState(/** @type {GameState} */ (refreshedState), 'game:resume');
      return renderRoundUI(/** @type {GameState} */ (refreshedState), { requireButton: true });
    }

    if (savedState.status === GameStatus.ROUND_RESULT) {
      if (!savedState.currentRound) return false;
      ui.hideStart();
      ui.hideQuestion();
      ui.hideRoundResult();
      mapSystem.clearMap();

      const { center: startCenter, zoom: startZoom } = strategy.getMapView(MAP);
      mapSystem.flyTo(startCenter, startZoom, { animate: false });

      stateManager.setState(/** @type {GameState} */ (savedState), 'game:resume');

      const progress = game.getProgress(savedState);
      ui.showGameUI(progress.current, progress.total, savedState.totalScore);

      const currentRound = savedState.currentRound;
      const displayDistance = strategy.getDisplayDistance(currentRound);

      ui.showRoundResult(
        currentRound.status === 'timeout' ? null : displayDistance,
        currentRound.score ?? 0,
        currentRound.status === 'timeout',
        game.isLastRound(savedState),
        currentRound.baseScore,
        currentRound.timeBonus
      );
      return true;
    }

    if (savedState.status === GameStatus.GAME_OVER) {
      ui.hideStart();
      ui.hideQuestion();
      ui.hideRoundResult();
      mapSystem.clearMap();
      stateManager.setState(/** @type {GameState} */ (savedState), 'game:resume');
      ui.showGameOver(savedState.totalScore);
      return true;
    }

    return false;
  };

  /**
   * Cleanup handlers
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

  return {
    handleStart,
    handleMapClick,
    onRoundEnd,
    handleNext,
    handleSubmit,
    handleReplay,
    resumeFromState,
    cleanup,
  };
}
