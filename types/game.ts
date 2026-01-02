export type ThemeId = 'nature' | 'city' | 'inferno' | 'cyber';

// 1. THE WORLD (The "Family")
export interface WorldDef {
    id: string;
    name: string;          // "The Awakening"
    description: string;
    themeId: ThemeId;      // Link to visual assets
    unlockRequirement?: {
        totalStars: number;
    };
    levels: LevelDef[];    // The levels in this family
}

// 2. THE LEVEL (The "Object Class")
export interface LevelConfig {
    gridRows: number;      // e.g. 4
    gridCols: number;      // e.g. 3
    pairCount: number;     // e.g. 6 (Total cards = 12)
    timeLimit: number;     // Seconds
    previewTime: number;   // Seconds
    lives: number;
}

export interface LevelModifiers {
    isFireMode?: boolean;    // Double XP, Faster Timer
    isBossLevel?: boolean;   // Special UI?
    noPreview?: boolean;
}

export interface LevelDef {
    id: number;            // Global ID (1, 2, 3...)
    worldId: string;       // "nature_world"
    sequenceIndex: number; // 1 (First level of this world)

    name: string;          // "First Steps"
    config: LevelConfig;
    modifiers: LevelModifiers;

    // SCORING
    thresholds: {
        oneStar: number;
        twoStar: number;
        threeStar: number;
    };
    baseXp: number;
}

// 3. THE PLAYER (Persistence)
export interface LevelResult {
    completed: boolean;
    highScore: number;
    stars: number;         // 0-3
    attempts: number;
    bestTime: number;      // ms
}

export interface PlayerState {
    // META
    totalXp: number;
    currentLevel: number;  // The furthest unlocked level

    // DATA
    levelResults: Record<number, LevelResult>;
    inventory: string[];   // "hint", "freeze"
}

// 4. THE GAMEPLAY SESSION (FSM State)
export type GamePhase =
    | 'IDLE'            // Menu
    | 'SETUP'           // Shuffling
    | 'PREVIEW'         // Memorize
    | 'PLAYING'         // Interactive
    | 'PAUSED'          // Menu Open
    | 'RESOLVING'       // Match Animation
    | 'VICTORY'         // Level Complete
    | 'DEFEAT';         // Game Over

export interface GameSessionState {
    levelId: number;
    phase: GamePhase;

    // Session Vars
    timeLeft: number;
    livesLeft: number;
    score: number;
    streak: number;

    // Board State
    cards: any[];       // Definition depends on Card component
    flippedIndices: number[];
    matchedIds: number[];

    // Config Snapshot (For Reducer access)
    config: LevelConfig;
}
