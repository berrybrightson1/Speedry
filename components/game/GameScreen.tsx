import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameSession } from '@/hooks/useGame';
import { LEVELS } from '@/lib/game/data';
import { Clock, Heart, Pause, Play, RefreshCw, X } from 'lucide-react';

interface GameScreenProps {
    levelId: number;
    onExit: () => void;
    onComplete: (xp: number, stars: number) => void;
    onGameOver: () => void;
}

export default function GameScreen({ levelId, onExit, onComplete, onGameOver }: GameScreenProps) {
    const { state, handlers } = useGameSession(levelId, (stars) => {
        // Auto-complete handler from Hook (VICTORY state)
        // Calculate XP here or trust hook passed data
        // For now, hardcode base XP from level def
        const level = LEVELS[levelId];
        onComplete(level.baseXp, stars);
    });

    const { cards, flippedIndices, matchedIds, timeLeft, livesLeft, phase } = state;
    const levelConfig = LEVELS[levelId];

    // Handling DEFEAT state manually for now via effect
    useEffect(() => {
        if (phase === 'DEFEAT') {
            setTimeout(onGameOver, 1000);
        }
    }, [phase, onGameOver]);

    const gridCols = levelConfig.config.gridCols;

    return (
        <div className="flex flex-col h-full w-full max-w-md mx-auto relative">
            {/* HEADER HUD */}
            <div className="flex items-center justify-between px-6 py-4 bg-white/10 backdrop-blur-md rounded-b-3xl shadow-lg border-b border-white/20 z-20">
                <div className="flex items-center gap-3">
                    <button onClick={handlers.pause} className="p-2 bg-white/20 rounded-full hover:bg-white/30 text-white">
                        {phase === 'PAUSED' ? <Play className="w-5 h-5 fill-white" /> : <Pause className="w-5 h-5 fill-white" />}
                    </button>
                    <div className="flex flex-col">
                        <span className="text-white/60 text-[10px] font-bold tracking-widest uppercase">LEVEL {levelId}</span>
                        <span className="text-white font-black text-sm leading-none drop-shadow-md">{levelConfig.name}</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${livesLeft < 2 ? 'bg-red-500/20 text-red-100 animate-pulse' : 'bg-rose-500/20 text-rose-100'}`}>
                        <Heart className={`w-4 h-4 ${livesLeft < 2 ? 'fill-red-400' : 'fill-rose-400'}`} />
                        <span className="font-black text-sm">{livesLeft}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${timeLeft <= 10 ? 'bg-orange-500/20 text-orange-100 animate-pulse' : 'bg-indigo-500/20 text-indigo-100'}`}>
                        <Clock className="w-4 h-4" />
                        <span className="font-mono font-bold text-sm w-8 text-center">{timeLeft}s</span>
                    </div>
                </div>
            </div>

            {/* GAME GRID */}
            <div className="flex-1 flex items-center justify-center p-4">
                <div
                    className="grid gap-3 w-full"
                    style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
                >
                    {cards.map((card, index) => {
                        const isFlipped = flippedIndices.includes(index) || matchedIds.includes(index) || phase === 'PREVIEW' || phase === 'VICTORY';
                        const isMatched = matchedIds.includes(index);

                        return (
                            <motion.div
                                key={card.id}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: index * 0.05 }}
                                className="aspect-square relative perspective-1000 cursor-pointer"
                                onClick={() => {
                                    if (phase === 'PLAYING' && !isFlipped && !isMatched) {
                                        handlers.onCardClick(index);
                                    }
                                }}
                            >
                                <div className={`w-full h-full transition-all duration-300 transform-style-3d grid place-items-center rounded-xl shadow-xl border-b-4 ${isFlipped ? 'rotate-y-180 bg-white border-slate-200' : 'bg-gradient-to-br from-indigo-500 to-purple-600 border-indigo-700'}`}>

                                    {/* CARD BACK */}
                                    <div className="absolute inset-0 backface-hidden grid place-items-center">
                                        <span className="text-white/20 text-2xl font-black">?</span>
                                    </div>

                                    {/* CARD FRONT */}
                                    <div className="absolute inset-0 backface-hidden rotate-y-180 grid place-items-center text-4xl text-indigo-600">
                                        {/* Assuming FontAwesome logic or just simple text for now from utils */}
                                        <i className={`fa-sharp fa-solid ${card.value}`}></i>
                                    </div>

                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* PAUSE OVERLAY */}
            {phase === 'PAUSED' && (
                <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-white rounded-3xl p-8 text-center max-w-xs shadow-2xl">
                        <h2 className="text-2xl font-black text-slate-800 mb-2">PAUSED</h2>
                        <div className="flex flex-col gap-3">
                            <button onClick={handlers.resume} className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:scale-105 transition-transform">RESUME</button>
                            <button onClick={onExit} className="text-slate-500 font-bold py-2 hover:text-slate-800">EXIT LEVEL</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
