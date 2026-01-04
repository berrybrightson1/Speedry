import React from 'react'
import { Trophy, ChevronRight, Sparkles, Star, X } from 'lucide-react'

interface SeasonCompleteModalProps {
    currentSeasonNumber: number
    currentSeasonName: string
    nextSeasonNumber: number
    nextSeasonName: string
    nextSeasonDescription: string
    nextSeasonColor: string
    xpEarned: number
    streak: number
    onContinue: () => void
    onClose: () => void
}

export function SeasonCompleteModal({
    currentSeasonNumber,
    currentSeasonName,
    nextSeasonNumber,
    nextSeasonName,
    nextSeasonDescription,
    nextSeasonColor,
    xpEarned,
    streak,
    onContinue,
    onClose
}: SeasonCompleteModalProps) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-500">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

            {/* Confetti Layer */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(50)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-3 h-3 animate-[confetti_3s_ease-out_infinite]"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `-${Math.random() * 20}%`,
                            animationDelay: `${Math.random() * 3}s`,
                            background: ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'][i % 5],
                            transform: `rotate(${Math.random() * 360}deg)`,
                            animationDuration: `${3 + Math.random() * 2}s`
                        }}
                    />
                ))}
            </div>

            {/* Modal Content */}
            <div className="relative w-full max-w-2xl bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 delay-150">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 z-10 bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all backdrop-blur-sm"
                >
                    <X className="w-6 h-6 text-white" />
                </button>

                {/* Header Section */}
                <div className="relative pt-16 pb-8 px-8 text-center">
                    {/* Glow effect */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-purple-500/30 rounded-full blur-3xl" />

                    {/* Trophy Icon */}
                    <div className="relative mb-6 animate-[bounce_2s_ease-in-out_infinite]">
                        <div className="inline-block p-6 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full shadow-2xl">
                            <Trophy className="w-20 h-20 text-white fill-white" />
                        </div>
                        <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-300 animate-pulse" />
                        <Sparkles className="absolute -bottom-2 -left-2 w-6 h-6 text-yellow-300 animate-pulse delay-150" />
                    </div>

                    {/* Title */}
                    <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 mb-4 animate-in slide-in-from-bottom-3 duration-700 delay-300">
                        SEASON {currentSeasonNumber}
                        <br />
                        COMPLETE!
                    </h1>

                    <p className="text-xl text-purple-200 font-bold animate-in slide-in-from-bottom-3 duration-700 delay-500">
                        Congratulations on conquering <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-300">{currentSeasonName}</span>!
                    </p>
                </div>

                {/* Stats Section */}
                <div className="px-8 pb-8">
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        {/* XP Earned */}
                        <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 backdrop-blur-sm border border-purple-500/30 rounded-2xl p-6 text-center transform hover:scale-105 transition-transform">
                            <Star className="w-8 h-8 mx-auto mb-2 text-yellow-400 fill-yellow-400" />
                            <p className="text-3xl font-black text-white mb-1">{xpEarned}</p>
                            <p className="text-sm text-purple-300 font-semibold">Total XP Earned</p>
                        </div>

                        {/* Streak */}
                        <div className="bg-gradient-to-br from-pink-900/50 to-pink-800/30 backdrop-blur-sm border border-pink-500/30 rounded-2xl p-6 text-center transform hover:scale-105 transition-transform">
                            <div className="text-4xl mb-2">🔥</div>
                            <p className="text-3xl font-black text-white mb-1">{streak}</p>
                            <p className="text-sm text-pink-300 font-semibold">Day Streak</p>
                        </div>
                    </div>

                    {/* Next Season Preview */}
                    <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/50 backdrop-blur-sm border-2 border-purple-400/50 rounded-2xl p-6 space-y-4 shadow-xl">
                        <div className="flex items-center gap-2 text-purple-300 font-bold">
                            <ChevronRight className="w-5 h-5" />
                            <span className="text-sm">UP NEXT</span>
                        </div>

                        <div>
                            <p className="text-sm text-purple-400 font-semibold mb-1">Season {nextSeasonNumber}</p>
                            <h3 className="text-3xl font-black mb-3" style={{ color: nextSeasonColor }}>
                                {nextSeasonName}
                            </h3>
                            <p className="text-slate-300 leading-relaxed">
                                {nextSeasonDescription}
                            </p>
                        </div>

                        {/* Continue Button */}
                        <button
                            onClick={onContinue}
                            className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 hover:from-purple-500 hover:via-pink-500 hover:to-purple-500 text-white font-black text-xl py-5 rounded-xl shadow-lg transition-all hover:scale-[1.02] hover:shadow-2xl flex items-center justify-center gap-2 animate-pulse"
                        >
                            <Trophy className="w-6 h-6" />
                            CONTINUE TO {nextSeasonName.toUpperCase()}
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
        </div>
    )
}
