import { PlayerState } from "@/types/game";

// CONSTANTS
const XP_PER_MATCH = 10;
const XP_PER_SECOND_LEFT = 2;
const STREAK_MULTIPLIER = 1.5;

/**
 * Calculates XP gained from a completed level
 */
export const calculateLevelXp = (
    baseXp: number,
    timeLeft: number,
    streak: number,
    hintsUsed: number,
    isFireMode: boolean
): number => {
    let xp = baseXp;

    // Time Bonus
    xp += (timeLeft * XP_PER_SECOND_LEFT);

    // Steak Bonus (Simple multiplier for high streaks)
    if (streak > 5) {
        xp = Math.floor(xp * STREAK_MULTIPLIER);
    }

    // Fire Mode Bonus (Double!)
    if (isFireMode) {
        xp *= 2;
    }

    // Penalties
    if (hintsUsed > 0) {
        xp -= (hintsUsed * 10);
    }

    return Math.max(0, xp); // No negative XP
};

/**
 * Validates and processes a purchase
 * Returns new PlayerState or throws error
 */
export const processPurchase = (
    state: PlayerState,
    sku: string, // e.g. "hint_5pack" or "xp_boost_small"
    cost: number // if purchasing with coins, etc. (Not currently in design, mostly real money -> XP)
): PlayerState => {
    // Logic for internal currency spending would go here
    return state;
};

/**
 * Verify Paystack Transaction
 * (In a real app, this would verify with a server function)
 */
export const verifyPayment = async (reference: string): Promise<boolean> => {
    // Mock verification
    return true;
};
