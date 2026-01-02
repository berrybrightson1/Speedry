import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, LogOut, Lock, Play, Star } from 'lucide-react';
import { FirebaseUser } from '@/lib/firebase';
import { PlayerState, WorldDef } from '@/types/game';
import { WORLDS, LEVELS } from '@/lib/game/data';

/* ----------------------------------------------------------------------------------
   AUTH PILL COMPONENT (Preserved from original page.tsx)
---------------------------------------------------------------------------------- */
function AuthPill({ user, onLogin, onLogout }: { user: FirebaseUser | null, onLogin: () => void, onLogout: () => void }) {
    return (
        <div className="relative group cursor-pointer transition-transform hover:scale-105 active:scale-95 duration-200">
            <div className="bg-white/80 backdrop-blur-sm shadow-md border border-white/40 rounded-full flex items-center py-1.5 pl-1.5 pr-4 gap-2.5">
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center shadow-sm ${user ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white" : "bg-indigo-50 text-indigo-600"
                    }`}>
                    {user?.photoURL ? (
                        <img src={user.photoURL} alt="User" className="w-full h-full rounded-full" />
                    ) : (
                        <User className="w-4 h-4" />
                    )}
                </div>
                <div className="flex flex-col justify-center items-start whitespace-nowrap">
                    {user ? (
                        <>
                            <span className="text-[8px] font-bold text-slate-400 leading-tight mb-px uppercase tracking-wide">Sync Active</span>
                            <span className="text-xs font-black text-slate-700 leading-none">{user.displayName?.split(' ')[0]}</span>
                        </>
                    ) : (
                        <button onClick={onLogin} className="text-left">
                            <span className="text-[8px] font-bold text-indigo-500 leading-tight mb-px uppercase tracking-wide">Cloud Save</span>
                            <span className="text-xs font-black text-slate-800 leading-none block">Tap to Sign In</span>
                        </button>
                    )}
                </div>
                {user && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onLogout() }}
                        className="ml-1 p-1 hover:bg-red-100 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                        title="Logout"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    )
}

/* ----------------------------------------------------------------------------------
   MENU SCREEN COMPONENT
---------------------------------------------------------------------------------- */
interface MenuScreenProps {
    user: FirebaseUser | null;
    playerState: PlayerState;
    onLogin: () => void;
    onLogout: () => void;
    onPlayLevel: (levelId: number) => void;
}

export default function MenuScreen({ user, playerState, onLogin, onLogout, onPlayLevel }: MenuScreenProps) {
    // We show Worlds, and maybe expand them to show levels.
    // For simplicity MVP: List Levels grouped by World vertically.

    return (
        <div className="flex flex-col h-full w-full max-w-md mx-auto relative overflow-y-auto pb-20">

            {/* HEADER SECTION (Preserved Redesign) */}
            <div className="relative w-full flex flex-col items-center justify-center space-y-6 py-10">
                <div className="flex flex-col items-center z-20 w-full relative">

                    {/* AUTH PILL */}
                    <div className="mb-3 transform hover:scale-105 transition-transform duration-300">
                        <AuthPill user={user} onLogin={onLogin} onLogout={onLogout} />
                    </div>

                    {/* BRANDING */}
                    <div className="text-center">
                        <h1 className="text-6xl font-black leading-none tracking-tight drop-shadow-sm scale-y-110">
                            <span className="text-[#1e293b]">SPEE</span>
                            <span className="text-[#8b5cf6]">DRY</span>
                        </h1>
                        <p className="text-[#1e293b]/80 text-base font-black tracking-[0.3em] mt-2 ml-1">CONQUEST</p>
                    </div>
                </div>
            </div>

            {/* WORLD / LEVEL SELECTOR */}
            <div className="px-6 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                {WORLDS.map((world, wIdx) => {
                    const isUnlocked = true; // Logic: Needs stars check
                    // const unlocked = (playerState.totalStars >= (world.unlockRequirement?.totalStars || 0));

                    return (
                        <div key={world.id} className="space-y-4">
                            {/* WORLD HEADER */}
                            <div className="flex items-end justify-between border-b-2 border-slate-100 pb-2">
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">WORLD {wIdx + 1}</span>
                                    <h2 className={`text-2xl font-black ${isUnlocked ? 'text-slate-800' : 'text-slate-300'}`}>{world.name}</h2>
                                </div>
                                {!isUnlocked && <Lock className="w-5 h-5 text-slate-300 mb-1" />}
                            </div>

                            {/* LEVEL GRID */}
                            <div className="grid grid-cols-4 gap-3">
                                {world.levels.map((level) => {
                                    const result = playerState.levelResults[level.id];
                                    const isCompleted = result?.completed;
                                    const stars = result?.stars || 0;
                                    const isLocked = level.id > 1 && !playerState.levelResults[level.id - 1]?.completed; // Simple sequential lock

                                    return (
                                        <button
                                            key={level.id}
                                            disabled={isLocked}
                                            onClick={() => onPlayLevel(level.id)}
                                            className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all active:scale-95
                          ${isLocked
                                                    ? 'bg-slate-100 text-slate-300 border-2 border-transparent'
                                                    : isCompleted
                                                        ? 'bg-emerald-100 text-emerald-600 border-2 border-emerald-200 shadow-sm'
                                                        : 'bg-white text-slate-700 border-2 border-slate-200 shadow-md hover:border-indigo-400 hover:text-indigo-600'
                                                }
                        `}
                                        >
                                            <span className="text-lg font-black">{level.sequenceIndex}</span>

                                            {/* STAR RATING MINI */}
                                            <div className="flex gap-0.5 mt-0.5 h-2">
                                                {[1, 2, 3].map(s => (
                                                    <Star key={s} className={`w-2 h-2 ${s <= stars ? 'fill-orange-400 text-orange-400' : 'text-slate-300/50'}`} />
                                                ))}
                                            </div>

                                            {isLocked && <div className="absolute inset-0 grid place-items-center bg-slate-50/50 rounded-2xl"><Lock className="w-4 h-4 opacity-50" /></div>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
