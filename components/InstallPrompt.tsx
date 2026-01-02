"use client"

import { useState, useEffect } from "react"
import { Share, PlusSquare, X, Download } from "lucide-react"

export function InstallPrompt() {
    const [isIOS, setIsIOS] = useState(false)
    const [isStandalone, setIsStandalone] = useState(false)
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        // Check if running in standalone mode (already installed)
        const isStandaloneMode = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone
        setIsStandalone(isStandaloneMode)
        if (isStandaloneMode) return

        // Detect iOS
        const userAgent = window.navigator.userAgent.toLowerCase()
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent)
        setIsIOS(isIosDevice)

        // Delay visibility slightly
        const timer = setTimeout(() => {
            // Show if iOS or if we have a deferred prompt (handled by event listener below)
            if (isIosDevice) {
                setIsVisible(true)
            }
        }, 3000)

        // Capture install prompt for Android/Chrome
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault()
            setDeferredPrompt(e)
            setIsVisible(true)
        }

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)

        return () => {
            clearTimeout(timer)
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
        }
    }, [])

    const handleInstallClick = async () => {
        if (!deferredPrompt) return

        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === "accepted") {
            setDeferredPrompt(null)
            setIsVisible(false)
        }
    }

    if (isStandalone || !isVisible) return null

    return (
        <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-10 fade-in duration-700">
            <div className="bg-white/90 backdrop-blur-md border border-slate-200 p-4 rounded-2xl shadow-2xl flex flex-col gap-3 relative max-w-sm mx-auto">
                <button
                    onClick={() => setIsVisible(false)}
                    title="Close Install Prompt"
                    className="absolute -top-2 -right-2 bg-slate-100 rounded-full p-1 border shadow-sm hover:bg-slate-200"
                >
                    <X className="w-4 h-4 text-slate-500" />
                </button>

                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 w-12 h-12 rounded-xl flex items-center justify-center shadow-lg">
                        <Download className="text-white w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 text-sm">Install Speedry</h3>
                        <p className="text-xs text-slate-500 font-semibold">Get the best full-screen experience!</p>
                    </div>
                </div>

                {isIOS ? (
                    <div className="bg-slate-100 rounded-xl p-3 text-xs font-bold text-slate-600 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <span>1. Tap Share</span>
                            <Share className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span>2. Select "Add to Home Screen"</span>
                            <PlusSquare className="w-4 h-4 text-slate-800" />
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={handleInstallClick}
                        title="Install Speedry App"
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black py-3 rounded-xl shadow-lg hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                    >
                        INSTALL APP
                    </button>
                )}
            </div>
        </div>
    )
}
