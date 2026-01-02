import { GameSessionState, LevelDef, GamePhase } from "@/types/game";

// INITIAL STATE FACTORY
export const createInitialState = (level: LevelDef): GameSessionState => {
    // Generate Deck
    const { pairCount } = level.config;
    const icons = level.modifier?.iconSet || []; // Assuming passed manually or we fetch from Theme
    // For now generic deck logic (moved from data.ts or similar)
    // ... (Deck generation handled in Hook for now to keep Engine pure data)

    return {
        levelId: level.id,
        phase: 'SETUP',
        timeLeft: level.config.timeLimit,
        livesLeft: level.config.lives,
        score: 0,
        streak: 0,
        cards: [], // Populated by Hook
        flippedIndices: [],
        matchedIds: [],
        config: level.config // Store config in state
    };
};

/* 
 * FINITE STATE MACHINE (FSM) REDUCER 
 * This ensures we can NEVER trigger "Level Complete" while in "Playing" state erroneously.
 */

type Action =
    | { type: 'START_PREVIEW' }
    | { type: 'START_PLAYING' }
    | { type: 'INIT_SESSION'; payload: { cards: any[] } }
    | { type: 'TICK'; dt: number } // Time delta
    | { type: 'CARD_CLICK'; index: number }
    | { type: 'CARD_MATCH'; indices: number[] }
    | { type: 'CARD_MISMATCH' }
    | { type: 'USE_HINT'; cost: number }
    | { type: 'PAUSE' }
    | { type: 'RESUME' }
    | { type: 'LEVEL_COMPLETE' }
    | { type: 'GAME_OVER' };

export const gameReducer = (state: GameSessionState, action: Action): GameSessionState => {
    switch (action.type) {
        case 'INIT_SESSION':
            return { ...state, cards: action.payload.cards };

        case 'START_PREVIEW':
            return { ...state, phase: 'PREVIEW' };

        case 'START_PLAYING':
            return { ...state, phase: 'PLAYING' };

        case 'TICK':
            if (state.phase !== 'PLAYING' && state.phase !== 'PREVIEW') return state;

            const newTime = state.timeLeft - action.dt;

            // TIMEOUT CHECK
            if (newTime <= 0) {
                if (state.phase === 'PREVIEW') {
                    // Auto-switch to playing if preview runs out (handled by effect usually, but strict logic here)
                    return { ...state, phase: 'PLAYING', timeLeft: state.config.timeLimit };
                } else {
                    return { ...state, phase: 'DEFEAT', timeLeft: 0 };
                }
            }
            return { ...state, timeLeft: newTime };

        case 'CARD_CLICK':
            if (state.phase !== 'PLAYING') return state;
            if (state.flippedIndices.length >= 2) return state; // Block extra clicks
            if (state.flippedIndices.includes(action.index)) return state; // Already flipped

            return {
                ...state,
                flippedIndices: [...state.flippedIndices, action.index]
            };

        case 'CARD_MATCH':
            // Ensure we are in a valid state to match
            if (state.phase !== 'PLAYING' && state.phase !== 'RESOLVING') return state;

            const newMatched = [...state.matchedIds, ...action.indices];
            const newStreak = state.streak + 1;

            // CHECK WIN CONDITION
            // Note: We check if ALL cards are matched.
            // We rely on the hook to pass correct indices, or we calculate based on config.
            const totalCards = state.config.pairCount * 2;
            const isWin = newMatched.length >= totalCards;

            if (isWin) {
                return {
                    ...state,
                    matchedIds: newMatched,
                    flippedIndices: [],
                    phase: 'VICTORY', // IMMEDIATE TRANSITION - No midgame prompts possible!
                    streak: newStreak
                };
            }

            return {
                ...state,
                matchedIds: newMatched,
                flippedIndices: [],
                streak: newStreak,
                phase: 'PLAYING' // Continue playing
            };

        case 'CARD_MISMATCH':
            const newLives = state.livesLeft - 1;
            if (newLives <= 0) {
                return { ...state, livesLeft: 0, phase: 'DEFEAT', flippedIndices: [], streak: 0 };
            }
            return {
                ...state,
                livesLeft: newLives,
                flippedIndices: [],
                streak: 0
            };

        case 'PAUSE':
            if (state.phase === 'PLAYING') return { ...state, phase: 'PAUSED' };
            return state;

        case 'RESUME':
            if (state.phase === 'PAUSED') return { ...state, phase: 'PLAYING' };
            return state;

        default:
            return state;
    }
};
