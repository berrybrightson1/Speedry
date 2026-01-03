import { LevelDef, WorldDef, ThemeId } from "@/types/game";

// VISUAL THEMES
export const THEMES: Record<ThemeId, {
    name: string;
    icons: string[];
    colors: { bg: string; primary: string; accent: string }
}> = {
    nature: {
        name: "The Awakening",
        icons: ['fa-leaf', 'fa-tree', 'fa-paw', 'fa-dog', 'fa-cat', 'fa-dove', 'fa-frog', 'fa-carrot'],
        colors: { bg: "from-slate-900 to-emerald-950", primary: "bg-emerald-500", accent: "text-emerald-400" }
    },
    city: {
        name: "The City",
        icons: ['fa-city', 'fa-car', 'fa-bus', 'fa-building', 'fa-road', 'fa-traffic-light', 'fa-bicycle', 'fa-plane'],
        colors: { bg: "from-blue-950 to-slate-900", primary: "bg-blue-500", accent: "text-blue-400" }
    },
    inferno: {
        name: "The Inferno",
        icons: ['fa-dragon', 'fa-fire', 'fa-skull', 'fa-ghost', 'fa-hat-wizard', 'fa-scroll', 'fa-ring', 'fa-crown'],
        colors: { bg: "from-orange-950 to-red-950", primary: "bg-orange-500", accent: "text-orange-400" }
    },
    cyber: {
        name: "Cyber Core",
        icons: ['fa-robot', 'fa-microchip', 'fa-satellite', 'fa-rocket', 'fa-user-astronaut', 'fa-meteor', 'fa-dna', 'fa-atom'],
        colors: { bg: "from-indigo-950 to-purple-950", primary: "bg-purple-500", accent: "text-purple-400" }
    }
};

// WORLD DEFINITIONS
export const WORLDS: WorldDef[] = [
    {
        id: "world_nature",
        name: "The Awakening",
        description: "Begin your journey in the calm of nature.",
        themeId: "nature",
        levels: [], // Populated by generator
        unlockRequirement: { totalStars: 0 }
    },
    {
        id: "world_city",
        name: "Neon City",
        description: "The pace quickens in the urban sprawl.",
        themeId: "city",
        levels: [],
        unlockRequirement: { totalStars: 15 } // Need stars from World 1
    },
    {
        id: "world_inferno",
        name: "Inferno Peak",
        description: "Can you handle the heat? Fire Mode active.",
        themeId: "inferno",
        levels: [],
        unlockRequirement: { totalStars: 35 }
    }
];

// LEVEL GENERATOR
export const LEVELS: Record<number, LevelDef> = {};

// Generator Helper
const generateLevels = () => {
    const TOTAL_LEVELS = 100;

    for (let id = 1; id <= TOTAL_LEVELS; id++) {
        // 1. Determine World
        let worldIndex = 0;
        if (id > 10) worldIndex = 1;
        if (id > 20) worldIndex = 2;
        // ... extend for more worlds

        const world = WORLDS[worldIndex] || WORLDS[WORLDS.length - 1]; // Fallback to last world

        // 2. Determine Difficulty (Formulaic but overridable)
        let gridRows = 4;
        let gridCols = 3; // 12 cards
        let previewTime = 5;
        let timeLimit = 30 + (id * 2); // Getting longer? Or shorter? 
        // Actually, usually harder means SAME time for MORE cards, or LESS time.
        // Let's do:
        if (id > 5) { gridRows = 4; gridCols = 4; } // 16 cards
        if (id > 15) { gridRows = 5; gridCols = 4; } // 20 cards

        // 3. Modifiers (Boss Level every 10)
        const isBoss = id % 10 === 0;
        const isFireMode = world.themeId === 'inferno' || isBoss;

        if (isFireMode) {
            timeLimit = timeLimit * 0.6; // Harder time
        }

        const level: LevelDef = {
            id,
            worldId: world.id,
            sequenceIndex: (id - 1) % 10 + 1,
            name: isBoss ? `${world.name} Finale` : `Level ${id}`,
            config: {
                gridRows,
                gridCols,
                pairCount: (gridRows * gridCols) / 2,
                timeLimit: Math.floor(timeLimit),
                previewTime: isBoss ? 3 : 5, // Shorter preview on boss
                lives: isBoss ? 1 : 2
            },
            modifiers: {
                isBossLevel: isBoss,
                isFireMode: isFireMode
            },
            baseXp: 100 + (id * 10),
            thresholds: {
                oneStar: 100,
                twoStar: 500,
                threeStar: 1000 // Placeholder logic
            }
        };

        LEVELS[id] = level;
        // Add reference to world for easy UI grouping
        if (worldIndex < WORLDS.length) {
            WORLDS[worldIndex].levels.push(level);
        }
    }
};

// Run Generator
generateLevels();
