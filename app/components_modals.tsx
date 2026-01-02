
function CheatInputModal({ onClose, onActivate }: { onClose: () => void; onActivate: (code: string) => void }) {
    const [input, setInput] = useState("")
    const inputRef = React.useRef<HTMLInputElement>(null)

    useEffect(() => {
        // Focus input on mount
        if (inputRef.current) inputRef.current.focus()
    }, [])

    return (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-xs shadow-2xl">
                <h3 className="text-emerald-400 font-mono font-bold text-center mb-4 tracking-widest text-sm">
          // TERMINAL ACCESS
                </h3>

                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value.toUpperCase())}
                    placeholder="ENTER CODE..."
                    className="w-full bg-slate-800 text-white font-mono text-center p-3 rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none mb-4 uppercase tracking-widest"
                    autoFocus
                />

                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={onClose}
                        className="bg-slate-700 hover:bg-slate-600 text-white font-mono font-bold py-2 rounded-lg text-xs"
                    >
                        CANCEL
                    </button>
                    <button
                        onClick={() => {
                            if (!input.trim()) return
                            onActivate(input.trim())
                            onClose()
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold py-2 rounded-lg text-xs shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                    >
                        EXECUTE
                    </button>
                </div>
            </div>
        </div>
    )
}

function ResetConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
    return (
        <div className="absolute inset-0 bg-red-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl border-4 border-red-500">
                <div className="flex justify-center mb-4">
                    <div className="bg-red-100 p-3 rounded-full animate-bounce">
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                    </div>
                </div>

                <h3 className="text-red-600 font-black text-2xl text-center mb-2">WARNING!</h3>
                <p className="text-slate-600 text-center font-bold text-sm mb-6 leading-relaxed">
                    This will reset your Level, XP, and Streak to zero. <br />
                    <span className="text-red-500 text-xs">(But it clears Fire Mode cooldown!)</span>
                </p>

                <div className="space-y-3">
                    <button
                        onClick={onConfirm}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-xl shadow-lg border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all"
                    >
                        YES, RESET EVERYTHING
                    </button>
                    <button
                        onClick={onCancel}
                        className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-xl"
                    >
                        CANCEL
                    </button>
                </div>
            </div>
        </div>
    )
}
