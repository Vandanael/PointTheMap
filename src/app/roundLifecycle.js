/**
 * Round Lifecycle
 *
 * Handles within-round management: map click scoring, round end result display,
 * next round progression, and the tile-ready timer start flow.
 * Receives all dependencies via a context object — does not import UI modules directly.
 */

import { handleError } from '../core/ErrorHandler.js';
import { EVENTS } from '../core/eventTypes.js';
import { createMapQueryAdapter, createRoundRulesAdapter } from '../game/ports.js';
import { UI_TIMING } from '@lib/config/visual-constants.js';
import { getModeStrategy } from './modeStrategies.js';
import { getTargetNameEn } from '../i18n.js';

/**
 * @typedef {import('../game/Game.js').GameState} GameState
 * @typedef {import('../game/Game.js').Round} Round
 */

/**
 * Create round lifecycle handlers.
 * @param {{
 *   stateManager: import('../core/StateManager.js').StateManager,
 *   eventBus: typeof import('../core/EventBus.js').eventBus,
 *   mapSystem: typeof import('../systems/MapSystem.js').mapSystem,
 *   timerSystem: typeof import('../systems/TimerSystem.js').timerSystem,
 *   inputSystem: typeof import('../systems/InputSystem.js').inputSystem,
 *   scoringSystem: typeof import('../systems/ScoringSystem.js').scoringSystem,
 *   validationSystem: typeof import('../systems/ValidationSystem.js').validationSystem,
 *   ui: any,
 *   game: { playRound: any, nextRound: any, getCurrentTarget: any, isLastRound: any, getProgress: any, GameStatus: any },
 *   analytics: { track: any },
 *   logger: typeof import('../utils/logger.js').logger,
 *   i18n: { t: any },
 *   config: { TIMING: any, MAP: any, isStadiumCategory: any, isCountryCategory: any, isCivilizationCategory: any },
 * }} context
 */
export function createRoundLifecycle(context) {
  const {
    stateManager,
    eventBus,
    mapSystem,
    timerSystem,
    inputSystem,
    scoringSystem,
    validationSystem,
    ui,
    game,
    analytics,
    i18n,
    config,
  } = context;

  const { TIMING, MAP, isStadiumCategory, isCountryCategory, isCivilizationCategory } = config;
  const { GameStatus } = game;

  const mapQuery = createMapQueryAdapter(mapSystem);
  const roundRules = createRoundRulesAdapter(validationSystem, scoringSystem);

  // --- Timer helpers ---

  const startTimer = () => {
    ui.resetTimer();
    /** @type {GameState} */
    const state = stateManager.getState();
    const roundId = state.currentRound?.roundId ?? null;
    timerSystem.start(state.runtimeConfig ?? undefined, { roundId });
  };

  const stopTimer = () => {
    timerSystem.stop();
  };

  // --- Utilities ---

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
      targetName: getTargetNameEn(target, targetType),
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

  // --- Round start flow ---

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
   * Render the current round UI for an existing state.
   * Called by handleStart and resumeFromState in the coordinator.
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
    const displaySubtitle = strategy.getDisplaySubtitle(target, i18n);

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

  // --- Main lifecycle handlers ---

  /**
   * Handle map click.
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
   * Handle round end — shows results and waits for user to continue.
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
   * Handle next round.
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
    const displaySubtitle = strategy.getDisplaySubtitle(target, i18n);

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

  return {
    handleMapClick,
    onRoundEnd,
    handleNext,
    renderRoundUI,
    showTargetNotFoundError,
    startRoundWhenReady,
  };
}
