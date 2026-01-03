import { motion } from 'framer-motion';
import { X, ShoppingBag, Zap, CreditCard } from 'lucide-react';
import { PlayerState } from '@/types/game';

interface StoreScreenProps {
    playerState: PlayerState;
    onClose: () => void;
    onPurchase: (sku: string, cost: number) => void;
}

export default function StoreScreen({ playerState, onClose, onPurchase }: StoreScreenProps) {
    // Placeholder store items based on original code concepts
    // In real implementation, these would come from economy.ts constants

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-md flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* HEADER */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-xl font-black text-white">STORE</h2>
                </div>
                <button onClick={onClose} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* BALANCE */}
            <div className="p-6 bg-gradient-to-r from-indigo-900 to-purple-900">
                <span className="text-indigo-200 text-xs font-bold uppercase tracking-widest">CURRENT BALANCE</span>
                <div className="flex items-end gap-1 mt-1">
                    <span className="text-4xl font-black text-white">{playerState.totalXp.toLocaleString()}</span>
                    <span className="text-lg font-bold text-indigo-300 mb-1">XP</span>
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* POWERUPS */}
                <section>
                    <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest mb-3">POWER-UPS</h3>
                    <div className="grid gap-3">
                        <button
                            onClick={() => onPurchase('time_freeze', 500)}
                            className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-500"><Zap className="w-5 h-5" /></div>
                                <div className="text-left">
                                    <div className="text-white font-bold">Time Freeze</div>
                                    <div className="text-white/40 text-xs">Pause timer for 10s</div>
                                </div>
                            </div>
                            <div className="px-3 py-1 bg-white/10 rounded-lg text-white font-bold text-sm">500 XP</div>
                        </button>
                    </div>
                </section>

                {/* IAP (Mock) */}
                <section>
                    <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest mb-3">BUY CREDITS</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => onPurchase('xp_10k', 0.99)}
                            className="p-4 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl shadow-lg hover:scale-105 transition-transform text-left"
                        >
                            <CreditCard className="w-6 h-6 text-white mb-2" />
                            <div className="text-white font-black text-lg">10,000 XP</div>
                            <div className="text-white/80 text-sm">$0.99</div>
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}
