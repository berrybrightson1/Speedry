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
            resume: () => dispatch({ type: 'RESUME' })
        }
    };
};
