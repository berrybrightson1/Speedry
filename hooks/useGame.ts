import { useReducer, useEffect, useCallback, useRef } from 'react';
import { GameSessionState } from '@/types/game';
import { gameReducer, createInitialState } from '@/lib/game/engine';
import { LEVELS } from '@/lib/game/data';
import { generateCards, GameCard } from '@/lib/game/utils';

export const useGameSession = (levelId: number, onComplete?: (stars: number) => void) => {
    const levelConfig = LEVELS[levelId] || LEVELS[1]; // Fallback

    // 1. Core State
    const [state, dispatch] = useReducer(gameReducer, levelConfig, createInitialState);

    // 2. Initialize Cards
    const hasInitialized = useRef(false);
    useEffect(() => {
        // Only init if we haven't, or if we are back in SETUP phase (e.g. retry)
        if (!hasInitialized.current || state.phase === 'SETUP') {
            // Check if cards are already empty to avoid double-gen on strict mode
            if (state.cards.length === 0) {
                const newCards = generateCards(levelConfig);
                dispatch({ type: 'INIT_SESSION', payload: { cards: newCards } } as any);

                hasInitialized.current = true;
                // Start Preview flow
                setTimeout(() => dispatch({ type: 'START_PREVIEW' }), 100);
            }
        }
    }, [levelId, state.phase]);

    // 3. Game Loop (The TICK)
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (state.phase === 'PREVIEW' || state.phase === 'PLAYING') {
            interval = setInterval(() => {
                dispatch({ type: 'TICK', dt: 1 });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [state.phase]);

    // 4. Interaction Handlers
    const handleCardClick = useCallback((index: number) => {
        dispatch({ type: 'CARD_CLICK', index });
    }, []);

    // 5. Match Logic
    useEffect(() => {
        if (state.flippedIndices.length === 2) {
            const [idxA, idxB] = state.flippedIndices;
            const cardA = state.cards[idxA];
            const cardB = state.cards[idxB];

            if (cardA && cardB) {
                if (cardA.value === cardB.value) {
                    // MATCH!
                    setTimeout(() => {
                        dispatch({ type: 'CARD_MATCH', indices: [idxA, idxB] });
                    }, 500);
                } else {
                    // MISMATCH
                    setTimeout(() => {
                        dispatch({ type: 'CARD_MISMATCH' });
                    }, 1000);
                }
            }
        }
    }, [state.flippedIndices, state.cards]);

    // 6. Completion Effect
    useEffect(() => {
        if (state.phase === 'VICTORY') {
            // Logic for score calculation could go here or in engine
            if (onComplete) onComplete(3);
        }
    }, [state.phase, onComplete]);

    return {
        state,
        handlers: {
            onCardClick: handleCardClick,
            pause: () => dispatch({ type: 'PAUSE' }),
            resume: () => dispatch({ type: 'RESUME' }),
            onRestart: () => window.location.reload(),
            onHint: (cost: number, type: 'standard' | 'super') => {
                // Hint Logic: Find 2 unmatched cards that form a pair or just random unmatched?
                // Standard: Reveal 2 matching cards for a short time
                // Super: Auto-match them?

                const unmatchedIndices = state.cards
                    .map((_, i) => i)
                    .filter(i => !state.matchedIds.includes(state.cards[i].id) && !state.flippedIndices.includes(i));

                if (unmatchedIndices.length < 2) return;

                // Simple strategy: Pick first 2 matching cards from unmatched
                // Group by value
                const byValue: Record<string, number[]> = {};
                for (const idx of unmatchedIndices) {
                    const val = state.cards[idx].value; // Assuming value exists
                    if (!byValue[val]) byValue[val] = [];
                    byValue[val].push(idx);
                }

                // Find a pair
                let pairIndices: number[] = [];
                for (const val in byValue) {
                    if (byValue[val].length >= 2) {
                        pairIndices = byValue[val].slice(0, 2);
                        break;
                    }
                }

                if (pairIndices.length === 2) {
                    if (type === 'super') {
                        // Auto match
                        dispatch({ type: 'CARD_MATCH', indices: pairIndices });
                    } else {
                        // Reveal
                        dispatch({ type: 'USE_HINT', cost, indices: pairIndices });
                        // Auto-hide after 2s? Engine doesn't have a timer for hints.
                        // We can use a timeout here to clear them.
                        setTimeout(() => {
                            dispatch({ type: 'CLEAR_HINT' });
                        }, 2000);
                    }
                }
            }
        }
    };
};
