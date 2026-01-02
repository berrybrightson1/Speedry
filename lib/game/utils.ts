import { LevelDef } from "@/types/game";
import { THEMES, WORLDS, LEVELS } from "./data";

export interface GameCard {
    id: number;
    value: string;
    matched: boolean;
    flipped: boolean;
}

export const generateGameInfo = (levelId: number) => {
    const level = LEVELS[levelId] || LEVELS[1];
    const world = WORLDS.find(w => w.id === level.worldId) || WORLDS[0];
    const theme = THEMES[world.themeId] || THEMES['nature'];

    return { level, world, theme };
};

export const generateCards = (level: LevelDef): GameCard[] => {
    // 1. Resolve Theme
    const world = WORLDS.find(w => w.id === level.worldId);
    const theme = THEMES[world?.themeId || 'nature'];

    const { pairCount } = level.config;
    console.log("[generateCards] Generating for Level:", level.id, "Pairs:", pairCount);
    const icons = theme.icons;

    // 2. Select Icons (Loop if we need more pairs than icons)
    const selectedIcons = Array.from({ length: pairCount }, (_, i) => icons[i % icons.length]);

    // 3. Create Pairs & Shuffle
    const deck = [...selectedIcons, ...selectedIcons]
        .sort(() => Math.random() - 0.5)
        .map((value, i) => ({
            id: i,
            value,
            matched: false,
            flipped: false // Logic handles visibility based on phase
        }));

    return deck;
};
