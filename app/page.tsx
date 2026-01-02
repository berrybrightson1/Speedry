/* ----------------------------------------------------------------------------------
   SPEEDRY CONQUEST - MAIN APP CONTROLLER
   Refactored to use Game Engine Architecture (Jan 2026)
---------------------------------------------------------------------------------- */
"use client"

import { useState, useEffect } from "react"
import { Toaster, toast } from 'sonner'
import { ref, update, onValue, get } from "firebase/database"
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth"
import { auth, database, googleProvider, FirebaseUser } from "@/lib/firebase"

// TYPES & DATA
import { PlayerState, LevelResult } from "@/types/game"
import { LEVELS } from "@/lib/game/data"

// COMPONENTS
import MenuScreen from "@/components/menu/MenuScreen"
import GameScreen from "@/components/game/GameScreen"
import StoreScreen from "@/components/menu/StoreScreen"
import InstallPrompt from "@/components/InstallPrompt"

export default function SpeedryConquest() {
  const [isLoading, setIsLoading] = useState(true)

  // NAVIGATION STATE
  const [activeScreen, setActiveScreen] = useState<'MENU' | 'GAME' | 'STORE'>('MENU')
  const [activeLevelId, setActiveLevelId] = useState<number | null>(null)

  // DATA STATE
  const [user, setUser] = useState<FirebaseUser | null>(null)

  // NEW PLAYER STATE STRUCTURE
  const [playerState, setPlayerState] = useState<PlayerState>({
    totalXp: 0,
    currentLevel: 1,
    levelResults: {},
    inventory: []
  })

  // AUTH & SYNC INIT
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        syncCloudData(currentUser)
      } else {
        // Load Local
        loadLocalData()
      }
      setIsLoading(false)
    })
    return () => unsubscribe()
  }, [])

  // --------------------------------------------------------------------------------
  // DATA MANAGEMENT (Migration & Sync)
  // --------------------------------------------------------------------------------

  const loadLocalData = () => {
    const localData = localStorage.getItem("speedry_player_state")
    if (localData) {
      setPlayerState(JSON.parse(localData))
    } else {
      // MIGRATE OLD LEGACY DATA?
      const legacyLevel = localStorage.getItem("speedry_best_level")
      const legacyXp = localStorage.getItem("speedry_xp")

      if (legacyLevel || legacyXp) {
        console.log("Migrating legacy data...")
        const newResults: Record<number, LevelResult> = {}
        const bestLvl = Number(legacyLevel) || 1

        // Mark all previous levels as complete (mock data)
        for (let i = 1; i < bestLvl; i++) {
          newResults[i] = { completed: true, stars: 3, highScore: 1000, attempts: 1, bestTime: 30000 }
        }

        const migratedState: PlayerState = {
          totalXp: Number(legacyXp) || 0,
          currentLevel: bestLvl,
          levelResults: newResults,
          inventory: []
        }

        setPlayerState(migratedState)
        saveState(migratedState, null) // Persist new format
      }
    }
  }

  const syncCloudData = async (currentUser: FirebaseUser) => {
    const userRef = ref(database, `users/${currentUser.uid}/progress`) // New Path for cleaner data
    const snapshot = await get(userRef)

    if (snapshot.exists()) {
      const cloudState = snapshot.val() as PlayerState
      // Merge or overwrite? For now, Cloud wins if it exists.
      setPlayerState(cloudState)
      localStorage.setItem("speedry_player_state", JSON.stringify(cloudState))
    } else {
      // Push local to cloud
      saveState(playerState, currentUser)
    }
  }

  const saveState = (newState: PlayerState, currentUser: FirebaseUser | null) => {
    // 1. Local
    localStorage.setItem("speedry_player_state", JSON.stringify(newState))
    setPlayerState(newState)

    // 2. Cloud
    if (currentUser) {
      update(ref(database, `users/${currentUser.uid}/progress`), newState)
    } else if (user) {
      update(ref(database, `users/${user.uid}/progress`), newState)
    }
  }

  // --------------------------------------------------------------------------------
  // ACTION HANDLERS
  // --------------------------------------------------------------------------------

  const handleLevelComplete = (baseXp: number, stars: number) => {
    if (!activeLevelId) return;

    const currentResult = playerState.levelResults[activeLevelId];

    // Update Score Logic (Simplified)
    const newResult: LevelResult = {
      completed: true,
      stars: Math.max(stars, currentResult?.stars || 0),
      highScore: (currentResult?.highScore || 0) + baseXp, // Mock logic
      attempts: (currentResult?.attempts || 0) + 1,
      bestTime: 0 // Track real time if passed
    };

    const newState = {
      ...playerState,
      totalXp: playerState.totalXp + baseXp,
      levelResults: {
        ...playerState.levelResults,
        [activeLevelId]: newResult
      }
    };

    saveState(newState, user);

    toast.success(`Level Complete! +${baseXp} XP`, {
      description: `${stars} Stars Earned`
    });

    setActiveScreen('MENU');
    setActiveLevelId(null);
  };

  const handleGameOver = () => {
    toast.error("Level Failed!")
    setActiveScreen('MENU')
    setActiveLevelId(null)
  }

  // --------------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------------

  return (
    <main className="fixed inset-0 min-h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50 -z-10" />

      <Toaster position="top-center" richColors />
      <InstallPrompt />

      {activeScreen === 'GAME' && activeLevelId ? (
        <GameScreen
          levelId={activeLevelId}
          onExit={() => { setActiveScreen('MENU'); setActiveLevelId(null); }}
          onComplete={handleLevelComplete}
          onGameOver={handleGameOver}
        />
      ) : (
        <MenuScreen
          user={user}
          playerState={playerState}
          onLogin={() => signInWithPopup(auth, googleProvider)}
          onLogout={() => signOut(auth)}
          onPlayLevel={(id) => {
            setActiveLevelId(id);
            setActiveScreen('GAME');
          }}
        />
      )}

      {/* STORE OVERLAY */}
      {activeScreen === 'STORE' && (
        <StoreScreen
          playerState={playerState}
          onClose={() => setActiveScreen('MENU')}
          onPurchase={() => { }}
        />
      )}

    </main>
  )
}
