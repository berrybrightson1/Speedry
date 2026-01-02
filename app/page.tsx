"use client"

import React, { useState, useEffect, useCallback } from "react"
import React, { useState, useEffect, useCallback } from "react"
import { Play, Plus, Trophy, Users, Target, Zap, XCircle, LogOut, Pause, Loader2, Check, Clock, ChevronRight, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import useEmblaCarousel from "embla-carousel-react"
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { database, ref, set, onValue, update, push, runTransaction, query, orderByChild, equalTo, get } from "@/lib/firebase"

type Screen =
  | "welcome"
  | "menu"
  | "levelSelect"
  | "game"
  | "gameOver"
  | "victory"
  | "multiplayer"
  | "lobby"
  | "multiplayerGame"
  | "createMatch"
  | "joinMatch"
type Card = { id: number; value: string; matched: boolean; flipped: boolean }
type PowerUp = "peek" | "autoMatch" | "streakShield"
type GameState = "lobby" | "playing" | "finished"
type PlayerData = {
  lives: number
  isReady: boolean
  currentLevel: number
  score: number
  name: string
}
type RoomData = {
  gameState: GameState
  currentTurn: string
  players: Record<string, PlayerData>
  matchCode?: string // 6-char code
  hostId?: string // ID of the creator
  tournament?: {
    round: number // 1..5
    scores: { [playerId: string]: number }
    activePlayerId: string
    winnerId?: string
    status: "waiting" | "playing" | "game_5_intro" | "finished"
    roundStartTime?: number
  }
  currentDeck?: string[] // Shared deck for fairness
}

// Helper to generate consistent decks
const generateDeck = (level: number) => {
  const pairsCount = level === 1 ? 2 : level === 2 ? 3 : 2 + level
  const icons = ['fa-dog', 'fa-cat', 'fa-crow', 'fa-car-side', 'fa-truck-pickup', 'fa-motorcycle', 'fa-cube', 'fa-gem', 'fa-anchor', 'fa-bolt', 'fa-bomb', 'fa-cloud']
  const selectedIcons = Array.from({ length: pairsCount }, (_, i) => icons[i % icons.length])
  return [...selectedIcons, ...selectedIcons].sort(() => Math.random() - 0.5)
}

export default function SpeedryConquest() {
  const [isLoading, setIsLoading] = useState(true)
  const [screen, setScreen] = useState<Screen>("menu")
  const [level, setLevel] = useState(1)
  const [xp, setXp] = useState(0)
  const [bestLevel, setBestLevel] = useState(1)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [playerId, setPlayerId] = useState<string>("")
  const [roomData, setRoomData] = useState<RoomData | null>(null)
  const [matchCode, setMatchCode] = useState<string>("")

  useEffect(() => {
    // Check local storage and initialize state
    const hasSeenWelcome = localStorage.getItem('speedry_welcomed')
    const savedBestLevel = localStorage.getItem("speedry_best_level")
    const storedPlayerId = localStorage.getItem("speedry_player_id")

    if (savedBestLevel) setBestLevel(Number.parseInt(savedBestLevel))

    if (storedPlayerId) {
      setPlayerId(storedPlayerId)
    } else {
      const newPlayerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      setPlayerId(newPlayerId)
      localStorage.setItem("speedry_player_id", newPlayerId)
    }

    const savedXp = localStorage.getItem("speedry_xp")
    if (savedXp) setXp(Number.parseInt(savedXp))

    if (!hasSeenWelcome) {
      setScreen('welcome')
    } else {
      setScreen('menu')
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    localStorage.setItem("speedry_xp", xp.toString())
  }, [xp])

  const handleStartGame = (startLevel: number) => {
    setLevel(startLevel)
    setScreen("game")
  }

  const handleMultiplayer = async () => {
    if (!playerId) return

    const roomRef = push(ref(database, "rooms"))
    const newRoomId = roomRef.key

    if (newRoomId) {
      await set(roomRef, {
        gameState: "lobby",
        currentTurn: playerId,
        players: {
          [playerId]: {
            lives: 2,
            isReady: false,
            currentLevel: 1,
            score: 0,
            name: "Player 1",
          },
        },
      })

      setRoomId(newRoomId)
      setScreen("lobby")
    }
  }

  const handleCreateMatch = async () => {
    if (!playerId) return
    setIsLoading(true)

    try {
      const roomRef = push(ref(database, "rooms"))
      const newRoomId = roomRef.key

      if (newRoomId) {
        // Generate a 6-character unique alphanumeric code
        const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        let code = ""
        for (let i = 0; i < 6; i++) {
          code += characters.charAt(Math.floor(Math.random() * characters.length))
        }

        await set(roomRef, {
          gameState: "lobby",
          currentTurn: playerId,
          matchCode: code,
          hostId: playerId,
          players: {
            [playerId]: {
              lives: 2,
              isReady: false,
              currentLevel: 1,
              score: 0,
              name: "Player 1",
            },
          },
        })

        setRoomId(newRoomId)
        setMatchCode(code)
        // Give explicit feedback or time for state to settle if needed, but usually instant
        setScreen("lobby")
      }
    } catch (error) {
      console.error("Error creating match:", error)
      alert("Failed to create match. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinMatch = async (code: string) => {
    if (!playerId || !code) return
    setIsLoading(true)

    try {
      // 1. Efficient Query: Only fetch rooms matching the code
      const roomsRef = ref(database, "rooms")
      const codeQuery = query(roomsRef, orderByChild("matchCode"), equalTo(code.toUpperCase()))
      const snapshot = await get(codeQuery)
      const rooms = snapshot.val()

      if (!rooms) {
        alert("Match not found! Check the code and try again.")
        setIsLoading(false)
        return
      }

      // Should only be one room with this code, but find first just in case
      const [foundRoomId, roomData]: any = Object.entries(rooms)[0]

      if (roomData.gameState !== "lobby") {
        alert("Match already started!")
        setIsLoading(false)
        return
      }

      // 2. Transaction for Safe Joining (Prevents Race Conditions)
      const roomPlayersRef = ref(database, `rooms/${foundRoomId}/players`)
      await runTransaction(roomPlayersRef, (currentPlayers) => {
        if (currentPlayers === null) return currentPlayers // Should exist

        if (currentPlayers[playerId]) {
          // Player already exists - allow rejoin
          return currentPlayers
        }

        if (Object.keys(currentPlayers).length < 2) {
          // Room has space - add player
          // IMPORTANT: Check if "Player 1" exists to name correctly, though logic dictates host is P1
          // We'll just force name to "Player 2" for the joiner
          currentPlayers[playerId] = {
            lives: 2,
            isReady: false,
            currentLevel: 1,
            score: 0,
            name: "Player 2",
          }
          return currentPlayers
        } else {
          // Room full - abort transaction
          return undefined // Abort
        }
      })
        .then((result) => {
          if (result.committed) {
            setRoomId(foundRoomId)
            setScreen("lobby")
          } else {
            alert("Match is full!")
          }
        })
        .catch((err) => {
          console.error("Transaction failed", err)
          alert("Failed to join match.")
        })

    } catch (error) {
      console.error("Error joining match:", error)
      alert("An error occurred while joining.")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#c8d5e8] to-[#e8eef5] flex items-center justify-center p-4">
        <Loader2 className="w-12 h-12 animate-spin text-[#8b5cf6]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#c8d5e8] to-[#e8eef5] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {screen === "welcome" && (
          <WelcomeScreen
            onGetStarted={() => {
              localStorage.setItem('speedry_welcomed', 'true')
              setScreen('menu')
            }}
          />
        )}
        {screen === "menu" && (
          <MenuScreen
            onQuickPlay={() => {
              // Quick Play: Random level 1-5
              const randomLevel = Math.floor(Math.random() * 5) + 1
              handleStartGame(randomLevel)
            }}
            onContinue={() => handleStartGame(bestLevel)}
            onLevelSelect={() => setScreen("levelSelect")}
            onMultiplayer={handleMultiplayer}
            onCreateMatch={handleCreateMatch}
            onJoinMatch={() => setScreen("joinMatch")}
            bestLevel={bestLevel}
            xp={xp}
          />
        )}

        {screen === "joinMatch" && <JoinMatchScreen onJoinMatch={handleJoinMatch} onBack={() => setScreen("menu")} />}
        {screen === "levelSelect" && (
          <LevelSelectScreen bestLevel={bestLevel} onSelectLevel={handleStartGame} onBack={() => setScreen("menu")} />
        )}
        {screen === "lobby" && roomId && (
          <LobbyScreen
            roomId={roomId}
            playerId={playerId}
            roomData={roomData}
            setRoomData={setRoomData}
            onStartGame={() => setScreen("multiplayerGame")}
            onBack={() => setScreen("menu")}
          />
        )}
        {screen === "multiplayerGame" && roomId && roomData && (
          <MultiplayerGameScreen
            roomId={roomId}
            playerId={playerId}
            roomData={roomData}
            setRoomData={setRoomData}
            onGameEnd={() => setScreen("menu")}
            xp={xp}
            onXpChange={setXp}
          />
        )}
        {screen === "game" && (
          <GameScreen
            onBack={() => setScreen("menu")}
            onLevelUp={(newLevel) => {
              const newBestLevel = Math.max(newLevel, bestLevel)
              setBestLevel(newBestLevel)
              localStorage.setItem("speedry_best_level", newBestLevel.toString())
              setLevel(newLevel)
              setScreen("game")
            }}
            xp={xp}
            onXpChange={setXp}
            level={level} // Pass level to GameScreen
            onGameOver={() => setScreen("gameOver")} // Added prop
          />
        )}
        {screen === "gameOver" && (
          <GameOverScreen level={level} onRetry={() => setScreen("game")} onMenu={() => setScreen("menu")} />
        )}
        {screen === "victory" && (
          <VictoryScreen
            level={level}
            onNextLevel={() => {
              setLevel(level + 1)
              setScreen("game")
            }}
            onMenu={() => setScreen("menu")}
          />
        )}
      </div>
      <InstallPrompt />
    </div>
  )
}

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallBtn, setShowInstallBtn] = useState(false)

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallBtn(true)
    }

    window.addEventListener("beforeinstallprompt", handler)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === "accepted") {
      setDeferredPrompt(null)
      setShowInstallBtn(false)
    }
  }

  if (!showInstallBtn) return null

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-sm px-4">
      <button
        onClick={handleInstallClick}
        className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black text-lg py-4 rounded-2xl shadow-2xl animate-[bounce_1s_ease-in-out_infinite] flex items-center justify-center gap-2 border-4 border-white/20"
      >
        <Zap className="w-6 h-6 fill-white" />
        MAGIC INSTALL
      </button>
    </div>
  )
}

function WelcomeScreen({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="bg-gradient-to-br from-[#e0e7ff] to-[#f0f4ff] rounded-3xl p-8 shadow-2xl relative overflow-hidden animate-in fade-in duration-500">
      {/* Close Button */}
      <button
        onClick={onGetStarted}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/50 transition-colors group"
        aria-label="Close welcome screen"
      >
        <XCircle className="w-6 h-6 text-[#64748b] group-hover:text-[#1e293b]" />
      </button>

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-5xl font-black leading-none tracking-tight mb-2">
          <span className="text-[#1e293b]">SPEE</span>
          <span className="text-[#8b5cf6]">DRY</span>
        </h1>
        <p className="text-lg text-[#64748b] font-semibold">Memory Match Challenge</p>
      </div>

      {/* How to Play Section */}
      <div className="bg-white rounded-2xl p-6 mb-6 shadow-lg space-y-6">
        <h2 className="text-2xl font-black text-[#1e293b] text-center mb-4">HOW TO PLAY</h2>

        {/* Objective */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-[#8b5cf6]" />
            <h3 className="text-lg font-bold text-[#1e293b]">Objective</h3>
          </div>
          <p className="text-sm text-[#64748b] leading-relaxed pl-7">
            Match all pairs of cards before time runs out to advance to the next level.
          </p>
        </div>

        {/* Game Flow */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#3b82f6]" />
            <h3 className="text-lg font-bold text-[#1e293b]">Game Flow</h3>
          </div>
          <ul className="text-sm text-[#64748b] leading-relaxed pl-7 space-y-1">
            <li><strong>Preview Phase:</strong> Cards shown for 5 seconds - memorize them!</li>
            <li><strong>Match Phase:</strong> Find matching pairs with limited time</li>
            <li><strong>Level Up:</strong> Complete levels to unlock harder challenges</li>
          </ul>
        </div>

        {/* Tips */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#f59e0b]" />
            <h3 className="text-lg font-bold text-[#1e293b]">Tips</h3>
          </div>
          <ul className="text-sm text-[#64748b] leading-relaxed pl-7 space-y-1">
            <li>Build streaks for bonus points</li>
            <li>Use hints wisely when stuck</li>
            <li>Manage your lives carefully</li>
          </ul>
        </div>
      </div>

      {/* Get Started Button */}
      <Button
        onClick={onGetStarted}
        className="w-full bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] hover:from-[#7c3aed] hover:to-[#6d28d9] text-white font-black text-xl py-7 rounded-2xl shadow-lg h-auto transition-all duration-300 hover:scale-[1.02]"
      >
        GET STARTED
      </Button>
    </div>
  )
}

function MenuScreen({
  onQuickPlay,
  onContinue,
  onLevelSelect,
  onMultiplayer,
  onCreateMatch,
  onJoinMatch,
  bestLevel,
  xp,
}: {
  onQuickPlay: () => void
  onContinue: () => void
  onLevelSelect: () => void
  onMultiplayer: () => void
  onCreateMatch: () => void
  onJoinMatch: () => void
  bestLevel: number
  xp: number
}) {
  return (
    <div className="flex flex-col items-center justify-center space-y-8 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-black leading-none tracking-tight">
          <span className="text-[#1e293b]">SPEE</span>
          <span className="text-[#8b5cf6]">DRY</span>
        </h1>
        <p className="text-[#1e293b] text-base font-black tracking-wide mt-1">CONQUEST</p>
      </div>

      <div className="w-full max-w-xs">
        <ModeCarousel
          onQuickPlay={onQuickPlay}
          onContinue={onContinue}
          bestLevel={bestLevel}
          xp={xp}
        />
      </div>

      <div className="flex gap-2 w-full max-w-xs">
        <button
          disabled
          className="flex-1 bg-slate-200 cursor-not-allowed rounded-xl p-3 flex flex-col items-center justify-center shadow-none opacity-70"
        >
          <div className="w-10 h-10 bg-slate-300 rounded-full flex items-center justify-center mb-1">
            <Users className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-slate-400 font-black text-base">1V1</p>
          <p className="text-slate-400 text-[10px] font-semibold text-center mt-0.5">SOON</p>
        </button>
        <button
          onClick={onLevelSelect}
          className="flex-1 bg-gradient-to-br from-[#10b981] to-[#059669] hover:from-[#059669] hover:to-[#047857] rounded-xl p-3 flex flex-col items-center justify-center shadow-xl transition-all hover:scale-105"
        >
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mb-1 shadow-md">
            <Target className="w-5 h-5 text-[#10b981]" />
          </div>
          <p className="text-white font-black text-base">SOLO</p>
          <p className="text-white/90 text-[10px] font-semibold text-center mt-0.5">PLAY SOLO</p>
        </button>
      </div>

      <div className="w-full max-w-xs space-y-2">
        <Button
          onClick={onCreateMatch}
          className="w-full bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] hover:from-[#7c3aed] hover:to-[#6d28d9] text-white font-black text-base py-4 rounded-xl shadow-xl h-auto hover:scale-105 transition-all"
        >
          CREATE MATCH
        </Button>

        <Button
          onClick={onJoinMatch}
          className="w-full bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#1d4ed8] text-white font-black text-base py-4 rounded-xl shadow-xl h-auto hover:scale-105 transition-all"
        >
          JOIN MATCH
        </Button>

        <Button
          onClick={onLevelSelect}
          className="w-full bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] hover:from-[#7c3aed] hover:to-[#6d28d9] text-white font-black text-base py-4 rounded-xl shadow-xl h-auto hover:scale-105 transition-all"
        >
          SELECT LEVEL
        </Button>
      </div>



      <div className="text-center text-[#64748b] text-sm font-semibold mt-4">Developer Rebry Creatives</div>
    </div>
  )

}

function LevelSelectScreen({
  bestLevel,
  onSelectLevel,
  onBack,
}: {
  bestLevel: number
  onSelectLevel: (level: number) => void
  onBack: () => void
}) {
  return (
    <div className="bg-gradient-to-b from-[#c8d5e8] to-[#e8eef5] rounded-3xl p-6 shadow-2xl">
      <h2 className="text-[#1e2b4d] text-3xl font-black text-center mb-6">SELECT LEVEL</h2>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[...Array(9)].map((_, i) => {
          const levelNum = i + 1
          const isUnlocked = levelNum <= bestLevel
          return (
            <button
              key={levelNum}
              onClick={() => isUnlocked && onSelectLevel(levelNum)}
              disabled={!isUnlocked}
              className={`aspect-square rounded-2xl font-black text-4xl shadow-md transition-all ${isUnlocked
                ? "bg-[#0066ff] hover:bg-[#0052cc] text-white scale-95 opacity-60"
                : "bg-[#cbd5e1] to-[#94a3b8] hover:from-[#94a3b8] hover:to-[#64748b] text-transparent hover:scale-105"
                }`}
            >
              {levelNum}
            </button>
          )
        })}
      </div>
      <Button
        onClick={onBack}
        className="w-full bg-[#a8c5e8] hover:bg-[#8faddb] text-white font-black text-xl py-7 rounded-3xl shadow-md h-auto"
      >
        BACK TO MENU
      </Button>
    </div >
  )
}

const CardGrid = React.memo(({ cards, onCardClick, isPaused, hintActive, gridSize = 4 }: {
  cards: Card[],
  onCardClick: (index: number) => void,
  isPaused: boolean,
  hintActive: boolean,
  gridSize?: number
}) => {
  const [parent] = useAutoAnimate()

  // Create a safe display list that maintains indexes but hides matched
  // Actually, for Masonry we want to REMOVE them from DOM. 
  // But we need to keep the original index for the click handler.
  // So we map the original cards, but return null for matched.

  return (
    <div
      ref={parent}
      className="grid gap-3 mb-6"
      style={{
        gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
      }}
    >
      {cards.map((card, i) => {
        if (card.matched) return null

        return (
          <button
            key={card.id}
            onClick={() => onCardClick(i)}
            disabled={card.flipped || isPaused || hintActive}
            className={`aspect-square rounded-xl shadow-md transition-all duration-75 text-[32px] flex items-center justify-center animate-in zoom-in ${card.flipped
              ? "bg-[#f5f5f5] text-[#333] scale-105"
              : "bg-[#9e9e9e] hover:bg-[#8e8e8e] hover:scale-105 text-transparent"
              }`}
          >
            {(card.flipped) && <i className={`fa-solid ${card.value}`}></i>}
          </button>
        )
      })}
    </div>
  )
})
CardGrid.displayName = "CardGrid"

function GameScreen({
  onBack,
  onLevelUp, // Added prop
  xp, // Added prop
  onXpChange, // Added prop
  level, // Added prop
  onGameOver, // Added prop
}: {
  onBack: () => void
  onLevelUp: (newLevel: number) => void // Added prop type
  xp: number // Added prop type
  onXpChange: (newXp: number) => void // Added prop type
  level: number // Added prop type
  onGameOver: () => void // Added prop type
}) {
  // Formula: Pairs = Level + 1. 
  // Refined Time Logic: 
  // Base: 6s.
  // Low Levels (1-10): +4s per level.
  // Mid Levels (11-19): +5s per level (Grids get bigger).
  // High Levels (20+): +6s per level (Fire Mode - Intense but Fair).
  const pairsCount = level + 1

  let initialTime = 0
  if (level <= 10) {
    initialTime = 6 + (level - 1) * 4
  } else if (level < 20) {
    initialTime = 42 + (level - 10) * 5   // Level 10 ends at 6+9*4=42. So start from 42.
  } else {
    initialTime = 87 + (level - 20) * 6   // Level 19 ends at 42+9*5=87. So start from 87.
  }

  const isFireMode = level >= 20

  // ... state ...




  const [cards, setCards] = useState<Card[]>([])
  const [flippedIndices, setFlippedIndices] = useState<number[]>([])
  const [timeLeft, setTimeLeft] = useState(initialTime)
  const [isPaused, setIsPaused] = useState(false)
  const [streak, setStreak] = useState(0)
  const [lives, setLives] = useState(3)
  const [hintTimeLeft, setHintTimeLeft] = useState<number | null>(null)
  const [showXpPopup, setShowXpPopup] = useState(false)
  const [xpPopupAmount, setXpPopupAmount] = useState(0)
  const [showEndGame, setShowEndGame] = useState(false)
  const [showTimedOut, setShowTimedOut] = useState(false)
  const [levelCompleted, setLevelCompleted] = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const [previewTimeLeft, setPreviewTimeLeft] = useState(5)

  const [showStore, setShowStore] = useState(false)
  const [targetTime, setTargetTime] = useState<number | null>(null)

  // Custom Modal States
  const [showCheatInput, setShowCheatInput] = useState(false)
  const [cheatInputValue, setCheatInputValue] = useState("")
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const activateCheat = useCallback((cheatCode: string = "FIREMODE") => {
    if (cheatCode === "FIREMODE") {
      // 1. Always give XP (Spammable)
      onXpChange(xp + 1000)
      setXpPopupAmount(1000)
      setShowXpPopup(true)
      setTimeout(() => setShowXpPopup(false), 1500)

      // 2. Level Warp (Once per 24h)
      const lastWarp = localStorage.getItem("speedry_last_warp")
      const attempts = Number(localStorage.getItem("speedry_warp_attempts") || 0)
      const now = Date.now()
      const COOLDOWN = 24 * 60 * 60 * 1000

      if (!lastWarp || now - Number(lastWarp) > COOLDOWN) {
        // SUCCESS: Warp to Level 20
        onLevelUp(20)
        localStorage.setItem("speedry_last_warp", now.toString())
        localStorage.setItem("speedry_warp_attempts", "0") // Reset attempts
        toast.success("🔥 FIRE MODE ACTIVATED: Level 20 & +1000 XP!", { duration: 3000 })
      } else {
        // COOLDOWN ACTIVE
        const newAttempts = attempts + 1
        localStorage.setItem("speedry_warp_attempts", newAttempts.toString())

        if (newAttempts === 3) {
          // PITY REWARD: +200 XP
          onXpChange(xp + 200)
          setXpPopupAmount(200)
          setShowXpPopup(true)
          setTimeout(() => setShowXpPopup(false), 1500)
          toast("🔥 Nice Try! Here's +200 XP for persistence. (Warp cooling down)", { icon: '🔥' })
        } else {
          toast.error(`Warp on cooldown. Attempt ${newAttempts}/3 for pity reward.`)
        }
      }
    }
    else if (cheatCode === "RESETGAME") {
      // RESET LOGIC handled by confirmation modal now
      toast.error("Please confirm reset in the dialog.")
    }
    else if (cheatCode === "MASTERRESET") {
      // MASTER RESET: WIPE EVERYTHING
      onLevelUp(1)
      onXpChange(0)
      setStreak(0)
      setLives(3)

      // Clear all cooldowns and tracking
      localStorage.removeItem("speedry_last_warp")
      localStorage.removeItem("speedry_warp_attempts")
      localStorage.removeItem("speedry_last_reset")
      localStorage.removeItem("speedry_xp_store_seen")

      toast.success("🛡️ MASTER RESET EXECUTED: SYSTEM WIPED", {
        style: { background: '#1e293b', color: '#10b981', fontWeight: 'bold' }
      })
    }
  }, [xp, onXpChange, onLevelUp])

  const handleResetConfirm = () => {
    const lastReset = localStorage.getItem("speedry_last_reset")
    const now = Date.now()
    const COOLDOWN = 24 * 60 * 60 * 1000

    if (!lastReset || now - Number(lastReset) > COOLDOWN) {
      onLevelUp(1)
      onXpChange(0)
      setStreak(0)

      // RESET FIREMODE COOLDOWN
      localStorage.removeItem("speedry_last_warp")
      localStorage.removeItem("speedry_warp_attempts")

      // Set Reset Cooldown
      localStorage.setItem("speedry_last_reset", now.toString())

      toast.success("♻️ GAME RESET SUCCESSFUL! Fire Mode Cooldown Cleared.")
    } else {
      toast.error("Reset on Cooldown! (Once per 24h)")
    }
    setShowResetConfirm(false)
  }
  localStorage.removeItem("speedry_warp_attempts")

  // SET RESET COOLDOWN
  localStorage.setItem("speedry_last_reset", now.toString())

  alert("🔄 GAME RESET! Fire Mode is available again. Good luck!")
  // Reload to refresh state cleanly? Or just let React handle it. React is fine.
  handleRetryLevel() // Reset board
}
      } else {
  alert("⏳ RESET ON COOLDOWN. You can only reset once every 24 hours.")
}
    }
  }, [xp, onXpChange, onLevelUp])

// CHEAT CODE LISTENER
useEffect(() => {
  const CHEAT_CODE = "FIREMODE"
  let keyBuffer = ""

  const handleKeyDown = (e: KeyboardEvent) => {
    // Allow cheat only when paused? Or always? User said "if a user pause the game".
    if (!isPaused) return

    // Append key to buffer
    if (e.key.length === 1) { // Only single characters
      keyBuffer += e.key.toUpperCase()
      if (keyBuffer.length > 20) keyBuffer = keyBuffer.slice(-20) // Keep buffer short

      if (keyBuffer.endsWith("FIREMODE")) {
        activateCheat("FIREMODE")
        keyBuffer = ""
      } else if (keyBuffer.endsWith("RESETGAME")) {
        activateCheat("RESETGAME")
        keyBuffer = ""
      }
    }
  }

  window.addEventListener("keydown", handleKeyDown)
  return () => window.removeEventListener("keydown", handleKeyDown)
}, [isPaused, activateCheat])

useEffect(() => {
  const icons = ['fa-dog', 'fa-cat', 'fa-crow', 'fa-car-side', 'fa-truck-pickup', 'fa-motorcycle', 'fa-cube', 'fa-gem']
  const selectedIcons = Array.from({ length: pairsCount }, (_, i) => icons[i % icons.length])
  const cardPairs = [...selectedIcons, ...selectedIcons]
    .sort(() => Math.random() - 0.5)
    .map((value, i) => ({
      id: i,
      value,
      matched: false,
      flipped: true, // Start with all cards flipped for preview
    }))
  setCards(cardPairs)
  setTimeLeft(initialTime)
  setLevelCompleted(false)
  setFlippedIndices([])
  setStreak(0)
  setShowPreview(true)
  // Scale preview time: Fixed 4s as requested
  setPreviewTimeLeft(4)
  setTargetTime(null) // Reset target time
}, [level, pairsCount, initialTime])

// Reset timer when level changes
useEffect(() => {
  setTimeLeft(initialTime)
  setLevelCompleted(false)
  setTargetTime(null)
}, [level, initialTime])

useEffect(() => {
  if (hintTimeLeft === null || hintTimeLeft <= 0 || isPaused) return
  const timer = setInterval(() => {
    setHintTimeLeft((t) => {
      if (t === null || t <= 1) return null
      return t - 1
    })
  }, 1000)
  return () => clearInterval(timer)
}, [hintTimeLeft, isPaused])

// Preview countdown timer - THE MEMORIZER
useEffect(() => {
  if (!showPreview) return

  if (previewTimeLeft <= 0) {
    // Flip all cards back down after preview
    setCards((prevCards) =>
      prevCards.map((card) => ({
        ...card,
        flipped: false, // Ensure they flip back down!
      }))
    )
    setShowPreview(false)
    // Set target time for main game timer
    setTargetTime(Date.now() + initialTime * 1000)
    return
  }

  const timer = setInterval(() => {
    setPreviewTimeLeft((t) => t - 1)
  }, 1000)

  return () => clearInterval(timer)
}, [showPreview, previewTimeLeft, initialTime])


// Main Game Timer - Respects Pause
useEffect(() => {
  if (isPaused || levelCompleted || showPreview) return

  const timer = setInterval(() => {
    setTimeLeft((prev) => {
      if (prev <= 1) {
        clearInterval(timer)
        return 0
      }
      return prev - 1
    })
  }, 1000)

  return () => clearInterval(timer)
}, [isPaused, levelCompleted, showPreview])



useEffect(() => {
  if (timeLeft === 0 && !levelCompleted) {
    setShowTimedOut(true)
    setIsPaused(true) // Pause the game
  }
}, [timeLeft, levelCompleted])

useEffect(() => {
  if (cards.length > 0 && cards.every((c) => c.matched) && !levelCompleted) {
    setLevelCompleted(true)

    // Calculate XP based on performance
    const baseXp = 10 // Base XP for completing level
    const streakBonus = streak >= 3 ? 5 : 0 // Bonus for high streak
    const speedBonus = timeLeft > initialTime / 2 ? 5 : 0 // Bonus for fast completion
    const levelBonus = level >= 4 ? Math.floor(level / 2) : 0 // XP boost at level 4+

    const totalXpEarned = baseXp + streakBonus + speedBonus + levelBonus



    onXpChange(xp + totalXpEarned)
    setXpPopupAmount(totalXpEarned)
    setShowXpPopup(true)

    setTimeout(() => {
      setShowXpPopup(false)
      onLevelUp(level + 1)
    }, 1500)
  }
}, [cards, levelCompleted])

const handleCardClick = useCallback(
  (index: number) => {
    if (
      isPaused ||
      cards[index].matched ||
      cards[index].flipped ||
      flippedIndices.length >= 2 ||
      hintTimeLeft !== null ||
      showTimedOut || // Prevent clicks when timed out modal is showing
      showPreview // Prevent clicks during preview
    )
      return

    const newCards = [...cards]
    newCards[index].flipped = true
    setCards(newCards)

    const newFlipped = [...flippedIndices, index]
    setFlippedIndices(newFlipped)

    if (newFlipped.length === 2) {
      const [first, second] = newFlipped
      const isMatch = cards[first].value === cards[second].value

      setTimeout(() => {
        const updatedCards = [...newCards]
        if (isMatch) {
          updatedCards[first].matched = true
          updatedCards[second].matched = true

          const newStreak = streak + 1
          setStreak(newStreak)

          if (newStreak >= 2) {
            const streakXp = 2 * newStreak

            onXpChange(xp + streakXp)
            setXpPopupAmount(streakXp)
            setShowXpPopup(true)
            setTimeout(() => setShowXpPopup(false), 1500)
          }
        } else {
          updatedCards[first].flipped = false
          updatedCards[second].flipped = false
          setStreak(0)

          setLives((l) => {
            const newLives = l - 1
            return newLives
          })
        }

        setCards(updatedCards)
        setFlippedIndices([])
        setCards(updatedCards)
        setFlippedIndices([])
      }, 500)
    }
  },
  [cards, flippedIndices, isPaused, streak, hintTimeLeft, xp, onXpChange, showTimedOut, showPreview],
)

const handleHint = (cost: number = 10, pairsToReveal: number = 1) => {
  if (xp < cost || hintTimeLeft !== null || isPaused || showTimedOut || showPreview) {
    if (xp < cost && !hintTimeLeft && !isPaused && !showTimedOut && !showPreview) {
      // Optional: visual feedback
    }
    return
  }

  onXpChange(xp - cost)

  let revealedCount = 0
  let currentCards = [...cards]

  // Attempt to reveal 'pairsToReveal' number of pairs
  for (let i = 0; i < pairsToReveal; i++) {
    const unmatched = currentCards.filter((c) => !c.matched && !c.flipped)
    if (unmatched.length < 2) break // No more pairs to reveal

    const firstCard = unmatched[0]
    const matchingCard = unmatched.find((c) => c.id !== firstCard.id && c.value === firstCard.value)

    if (matchingCard) {
      const indices = [
        currentCards.findIndex((c) => c.id === firstCard.id),
        currentCards.findIndex((c) => c.id === matchingCard.id),
      ]

      // SUPER HINT (Cost 50) = AUTO MATCH (Permanent)
      // NORMAL HINT (Cost 10) = PREVIEW (Temporary)
      const isSuperHint = cost >= 50

      indices.forEach((idx) => {
        currentCards[idx].flipped = true
        if (isSuperHint) {
          currentCards[idx].matched = true // PERMANENT MATCH
        }
      })
      revealedCount++
    }
  }

  if (revealedCount > 0) {
    setCards(currentCards)

    // Only set temporary timer if it's NOT a super hint
    if (cost < 50) {
      setHintTimeLeft(3)
      setTimeout(() => {
        setCards(prevCards => {
          const newCardsCopy = [...prevCards]
          return newCardsCopy.map(c => c.matched ? c : { ...c, flipped: false })
        })
        setHintTimeLeft(null)
      }, 3000)
    } else {
      // If super hint, check for level completion immediately?
      // The useEffect hook will handle level completion based on 'cards' state change.
    }
  }
}

const gridCols = Math.ceil(Math.sqrt(cards.length))

const handleRetryLevel = () => {
  setShowTimedOut(false)
  setIsPaused(false)
  setTimeLeft(initialTime)
  setFlippedIndices([])
  setStreak(0)
  setShowPreview(true)
  setShowPreview(true)
  setPreviewTimeLeft(4)

  // Regenerate cards and start with them flipped for preview
  const icons = ['fa-dog', 'fa-cat', 'fa-crow', 'fa-car-side', 'fa-truck-pickup', 'fa-motorcycle', 'fa-cube', 'fa-gem']
  const selectedIcons = Array.from({ length: pairsCount }, (_, i) => icons[i % icons.length])
  const cardPairs = [...selectedIcons, ...selectedIcons]
    .sort(() => Math.random() - 0.5)
    .map((value, i) => ({
      id: i,
      value,
      matched: false,
      flipped: true, // Start with cards flipped for preview
    }))
  setCards(cardPairs)
}

// Fire Animation Style (Injected)
const fireAnimation = isFireMode ? (
  <style jsx global>{`
      @keyframes fireMove {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .fire-bg {
        background: linear-gradient(-45deg, #ff3d00, #ff9100, #ffea00, #ff3d00);
        background-size: 400% 400%;
        animation: fireMove 15s ease infinite;
      }
    `}</style>
) : null

return (
  <div className={`min-h-screen flex flex-col items-center justify-center md:p-4 overflow-y-auto duration-1000 ${isFireMode ? "fire-bg" : "bg-gradient-to-b from-slate-200 to-slate-300"}`}>
    {fireAnimation}
    <div className={`w-full md:max-w-sm md:rounded-2xl p-4 md:shadow-xl transition-all duration-1000 ${isFireMode ? "bg-gradient-to-br from-orange-50 to-red-50 md:border-2 md:border-orange-500 md:shadow-[0_0_30px_rgba(234,88,12,0.4)]" : "bg-gradient-to-br from-blue-50 to-slate-100"}`}>
      {showXpPopup && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white font-black text-4xl px-8 py-4 rounded-3xl shadow-2xl animate-[bounce_1s_ease-in-out]">
          +{xpPopupAmount} XP!
        </div>
      )}

      {showPreview && (
        <div className="absolute inset-0 z-50 bg-black/[0.94] flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-300">
          <div className="text-center">
            <h2 className="text-5xl font-black text-white/50 mb-2 tracking-widest uppercase drop-shadow-lg opacity-80">MEMORIZE</h2>
            <div className="text-9xl font-black text-[#facc15] animate-pulse drop-shadow-2xl opacity-90">{previewTimeLeft}</div>
          </div>
          <div className="absolute bottom-12 text-white/90 font-bold text-sm uppercase tracking-widest animate-pulse">
            Cards will flip soon...
          </div>
        </div>
      )}


      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setShowEndGame(true)}
          className={`font-bold text-xs px-4 py-2 rounded-xl shadow-md transition-all hover:scale-105 flex items-center gap-1.5 ${isFireMode
            ? "bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white"
            : "bg-gradient-to-r from-[#64748b] to-[#475569] hover:from-[#475569] hover:to-[#334155] text-white"}`}
        >
          <LogOut className="h-3.5 w-3.5" />
          END GAME
        </button>

        {/* Mobile Cheat Trigger (Visible ONLY when paused) */}
        {/* Mobile Cheat Trigger (Visible ONLY when paused) */}
        {isPaused && (
          <button
            onClick={() => {
              setCheatInputValue("")
              setShowCheatInput(true)
            }}
            className="bg-white/20 hover:bg-white/30 text-white p-2.5 rounded-full backdrop-blur-sm transition-all animate-pulse"
          >
            <Target className="h-4 w-4" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <div className={`${isFireMode ? "bg-gradient-to-r from-red-500 to-yellow-500" : "bg-gradient-to-r from-[#3b82f6] to-[#2563eb]"} text-white font-black text-xs px-4 py-2 rounded-xl shadow-md whitespace-nowrap`}>
            {xp} XP
          </div>
          <button
            onClick={() => setShowStore(true)}
            className={`${isFireMode ? "bg-gradient-to-r from-orange-500 to-red-600" : "bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed]"} text-white rounded-xl p-2 shadow-md transition-all hover:scale-110`}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* XP STORE MODAL */}
      {showStore && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 rounded-2xl flex items-center justify-center p-4 animate-[fadeIn_0.3s_ease-out]">
          <div className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm animate-[scaleIn_0.3s_ease-out]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[#1e293b] text-xl font-black">GET MORE XP</h3>
              <button onClick={() => setShowStore(false)} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200">
                <LogOut className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-gradient-to-r from-yellow-100 to-orange-100 p-4 rounded-xl border border-orange-200 flex justify-between items-center">
                <div>
                  <div className="font-black text-orange-600 text-lg">500 XP</div>
                  <div className="text-xs text-orange-500 font-bold">Starter Pack</div>
                </div>
                <div className="bg-orange-500 text-white px-3 py-1.5 rounded-lg font-bold text-sm shadow-sm">10 GHS</div>
              </div>

              <div className="bg-gradient-to-r from-purple-100 to-indigo-100 p-4 rounded-xl border border-indigo-200 flex justify-between items-center">
                <div>
                  <div className="font-black text-indigo-600 text-lg">2500 XP</div>
                  <div className="text-xs text-indigo-500 font-bold">Best Value</div>
                </div>
                <div className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold text-sm shadow-sm">40 GHS</div>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-center text-xs text-slate-500 font-semibold mb-3">SECURE CHECKOUT WITH</p>
              <div className="grid grid-cols-2 gap-3">
                <button className="bg-[#ffcc00] hover:bg-[#ffdb4d] text-[#1e293b] font-black py-2.5 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2">
                  <span>MTN MoMo</span>
                </button>
                <button className="bg-[#00c3f5] hover:bg-[#33cff7] text-white font-black py-2.5 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2">
                  <span>Paystack</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEndGame && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 rounded-3xl flex items-center justify-center p-6 animate-[fadeIn_0.3s_ease-out]">
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full transform animate-[scaleIn_0.3s_ease-out]">
            <h3 className="text-[#1e293b] text-2xl font-black mb-4 text-center">End Current Game?</h3>
            <p className="text-[#64748b] text-sm font-semibold mb-6 text-center">Your progress will be lost</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndGame(false)}
                className="flex-1 bg-gradient-to-r from-[#cbd5e1] to-[#94a3b8] hover:from-[#94a3b8] hover:to-[#64748b] text-white font-black text-lg py-3 rounded-xl transition-all"
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  setShowEndGame(false)
                  // Instead of reloading, navigate to menu
                  onBack()
                  // If onGameOver is provided, call it as well
                  onGameOver && onGameOver()
                }}
                className="flex-1 bg-gradient-to-r from-[#ef4444] to-[#dc2626] hover:from-[#dc2626] hover:to-[#b91c1c] text-white font-black text-lg py-3 rounded-xl transition-all"
              >
                END GAME
              </button>
            </div>
          </div>
        </div>
      )}

      {showTimedOut && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-300">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <Clock className="w-20 h-20 text-orange-500 animate-pulse" />
              </div>
              <h2 className="text-3xl font-black text-slate-800 mb-2">TIME'S UP!</h2>
              <p className="text-slate-600 font-semibold mb-6">You ran out of time. Try again?</p>
              <div className="flex gap-3">
                <button
                  onClick={handleRetryLevel}
                  className="flex-1 bg-gradient-to-r from-[#0066ff] to-[#0052cc] hover:from-[#0052cc] hover:to-[#0041a3] text-white font-black text-lg py-3 rounded-xl transition-all"
                >
                  RETRY LEVEL
                </button>
                <button
                  onClick={() => {
                    setShowTimedOut(false)
                    onBack()
                  }}
                  className="flex-1 bg-gradient-to-r from-slate-400 to-slate-500 hover:from-slate-500 hover:to-slate-600 text-white font-black text-lg py-3 rounded-xl transition-all"
                >
                  QUIT
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl p-3 mb-4 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`${isFireMode ? "bg-gradient-to-br from-red-500 to-orange-600" : "bg-gradient-to-br from-[#3b82f6] to-[#2563eb]"} rounded-lg p-2 shadow-sm`}>
              <Zap className="h-5 w-5 text-white fill-white" />
            </div>
            <div className="flex flex-col">
              <div className="text-[#64748b] text-[10px] font-bold uppercase tracking-wider">STREAK</div>
              <div className="text-[#1e293b] text-2xl font-black leading-none">{streak}</div>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-200" />

          {/* TIMER MOVED HERE */}
          <div className="flex flex-col items-center min-w-[4rem]">
            <div className="text-[#64748b] text-[10px] font-bold uppercase tracking-wider mb-0.5">TIME</div>
            <div className={`text-xl font-black ${timeLeft < 10 ? "text-red-500 animate-pulse" : isFireMode ? "text-orange-600 drop-shadow-sm" : "text-[#1e293b]"}`}>
              {Math.floor(timeLeft / 60)}:{Math.floor(timeLeft % 60).toString().padStart(2, "0")}
            </div>
          </div>

          <div className="h-8 w-px bg-slate-200" />

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <div className="text-[#64748b] text-[10px] font-bold uppercase tracking-wider">LEVEL</div>
              <div className="text-[#64748b] text-[10px] font-semibold">XP Boost at {level + 1}</div>
            </div>
            <div className={`${isFireMode ? "bg-gradient-to-br from-red-600 to-orange-600 animate-pulse border border-yellow-400" : "bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed]"} rounded-lg p-2 shadow-sm min-w-[2.5rem] flex items-center justify-center`}>
              <div className="text-white text-2xl font-black">{level}</div>
            </div>
          </div>
        </div>
      </div>

      <CardGrid
        cards={cards}
        onCardClick={handleCardClick}
        isPaused={isPaused}
        hintActive={hintTimeLeft !== null}
        gridSize={gridCols}
      />

      <div className="flex gap-2 mb-4">
        {/* Normal Hint */}
        <button
          onClick={() => handleHint(10, 1)}
          disabled={xp < 10 || hintTimeLeft !== null || isPaused}
          className={`flex-1 rounded-xl shadow-md ${isFireMode ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600" : "bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] hover:from-[#7c3aed] hover:to-[#6d28d9]"} disabled:from-slate-300 disabled:to-slate-400 text-white font-black text-xs py-3 transition-all flex items-center justify-center gap-1.5 disabled:cursor-not-allowed`}
        >
          <Zap className="h-3.5 w-3.5" />
          {hintTimeLeft !== null ? `VISIBLE (${hintTimeLeft}s)` : "HINT (10 XP)"}
        </button>

        {/* Super Hint */}
        <button
          onClick={() => handleHint(50, 2)}
          disabled={xp < 50 || hintTimeLeft !== null || isPaused}
          className={`flex-1 rounded-xl shadow-md ${isFireMode ? "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 border border-yellow-400" : "bg-gradient-to-r from-[#ec4899] to-[#db2777] hover:from-[#db2777] hover:to-[#be185d] border border-pink-300"} disabled:border-none disabled:from-slate-300 disabled:to-slate-400 text-white font-black text-xs py-3 transition-all flex items-center justify-center gap-1.5 disabled:cursor-not-allowed`}
        >
          <Zap className="h-3.5 w-3.5 fill-white" />
          SUPER (50 XP)
        </button>
      </div>

      <div className="flex rounded-xl overflow-hidden shadow-md mb-2">
        <button
          onClick={() => setIsPaused(!isPaused)}
          className={`flex-1 font-black text-lg py-3 transition-all duration-300 flex items-center justify-center gap-2 ${!isPaused
            ? isFireMode
              ? "bg-gradient-to-r from-red-600 to-orange-600 text-white hover:from-red-700 hover:to-orange-700 shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse"
              : "bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] text-white hover:from-[#7c3aed] hover:to-[#6d28d9]"
            : isFireMode
              ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-600 hover:to-orange-600"
              : "bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white hover:from-[#2563eb] hover:to-[#1d4ed8]"
            }`}
        >
          {!isPaused ? (
            <>
              <Pause className="h-6 w-6 fill-white" />
              PAUSE
            </>
          ) : (
            <>
              <Play className="h-6 w-6 fill-white" />
              PLAY
            </>
          )}
        </button>
      </div>

      <div className="mt-12 pt-8">
        <p className="text-[#64748b] text-sm font-semibold text-center">Developer Rebry Creatives</p>
      </div>
    </div>
  </div>
)
}

function GameOverScreen({ level, onRetry, onMenu }: { level: number; onRetry: () => void; onMenu: () => void }) {
  return (
    <div className="bg-gradient-to-b from-[#c8d5e8] to-[#e8eef5] rounded-3xl p-8 shadow-2xl text-center">
      <div className="mb-6 animate-[bounce_1s_ease-in-out_3]">
        <XCircle className="w-32 h-32 mx-auto text-[#ef4444] stroke-[3]" />
      </div>
      <h2 className="text-[#1e2b4d] text-5xl font-black mb-4">GAME OVER</h2>
      <p className="text-[#6b7b99] text-xl font-bold mb-8">You reached Level {level}</p>
      <div className="space-y-4">
        <Button
          onClick={onRetry}
          className="w-full bg-[#0066ff] hover:bg-[#0052cc] text-white font-black text-2xl py-8 rounded-3xl shadow-lg h-auto"
        >
          RETRY
        </Button>
        <Button
          onClick={onMenu}
          className="w-full bg-[#64748b] hover:bg-[#475569] text-white font-black text-2xl py-7 rounded-3xl shadow-md h-auto transition-all hover:scale-[1.02]"
        >
          BACK TO MENU
        </Button>
      </div>
    </div>
  )
}

function VictoryScreen({ level, onNextLevel, onMenu }: { level: number; onNextLevel: () => void; onMenu: () => void }) {
  return (
    <div className="bg-gradient-to-b from-[#c8d5e8] to-[#e8eef5] rounded-3xl p-8 shadow-2xl text-center">
      <Trophy className="w-24 h-24 mx-auto mb-4 text-[#8b4dff]" />
      <h2 className="text-[#1e2b4d] text-5xl font-black mb-4">VICTORY!</h2>
      <p className="text-[#6b7b99] text-xl font-bold mb-8">Level {level} Complete!</p>
      <div className="flex gap-4">
        <Button
          onClick={onMenu}
          className="bg-[#64748b] hover:bg-[#475569] text-white font-black text-2xl py-6 rounded-3xl shadow-md h-auto px-8 transition-all hover:scale-[1.02]"
        >
          BACK TO MENU
        </Button>
        <Button
          onClick={onNextLevel}
          className="bg-[#0066ff] hover:bg-[#0052cc] text-white font-black text-2xl py-6 rounded-3xl shadow-lg h-auto px-12 animate-pulse"
        >
          NEXT LEVEL
        </Button>
      </div>
    </div>
  )
}

function ModeCarousel({
  onQuickPlay,
  onContinue,
  bestLevel,
  xp
}: {
  onQuickPlay: () => void,
  onContinue: () => void,
  bestLevel: number,
  xp: number
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true, // Enable infinite loop
    duration: 25, // Snappy transition
  })
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Auto-slide effect
  useEffect(() => {
    if (!emblaApi) return

    // Slide every 3 seconds
    const interval = setInterval(() => {
      if (emblaApi.canScrollNext()) {
        emblaApi.scrollNext()
      }
    }, 3000) // Fast auto-slide frequency

    return () => clearInterval(interval)
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return

    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap())
    }

    emblaApi.on('select', onSelect)

    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi])

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-3xl shadow-2xl" ref={emblaRef}>
        <div className="flex touch-pan-y">
          {/* SLIDE 1: QUICK PLAY */}
          <div className="flex-[0_0_100%] min-w-0 relative">
            <button
              onClick={onQuickPlay}
              className="w-full bg-gradient-to-br from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#1d4ed8] text-white p-8 h-48 flex flex-col items-center justify-center transition-all active:scale-95 group"
            >
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Zap className="w-8 h-8 text-white fill-white" />
              </div>
              <div className="text-center">
                <h3 className="text-3xl font-black italic tracking-tighter">QUICK PLAY</h3>
                <p className="text-blue-100 font-semibold text-sm mt-1">Random Levels 1-5</p>
              </div>
            </button>
            {/* Absolute Badge */}
            <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Fast Action</span>
            </div>
          </div>

          {/* SLIDE 2: JOURNEY */}
          <div className="flex-[0_0_100%] min-w-0 relative">
            <button
              onClick={onContinue}
              className="w-full bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] hover:from-[#7c3aed] hover:to-[#6d28d9] text-white p-8 h-48 flex flex-col items-center justify-center transition-all active:scale-95 group"
            >
              <div className="w-full flex items-center justify-between mb-2 px-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Trophy className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-purple-100 uppercase">Current Best</p>
                    <p className="text-2xl font-black leading-none">LEVEL {bestLevel}</p>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>

              {/* Progress Bar Visual (Fake XP Progress towards next rank?) */}
              <div className="w-full mt-4 bg-black/20 h-3 rounded-full overflow-hidden relative">
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                  style={{ width: `${Math.min(100, (xp % 100))}%` }}
                />
              </div>
              <div className="w-full flex justify-between mt-2 text-xs font-bold text-purple-100 px-1">
                <span>{xp} XP</span>
                <span>NEXT RANK</span>
              </div>
            </button>
            <div className="absolute top-4 right-4 bg-emerald-500/20 backdrop-blur-md px-3 py-1 rounded-full border border-emerald-400/30">
              <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Resume</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dots Indicator */}
      <div className="flex justify-center gap-2 mt-4">
        {[0, 1].map((index) => (
          <button
            key={index}
            onClick={() => emblaApi?.scrollTo(index)}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${selectedIndex === index
              ? "bg-slate-800 w-8"
              : "bg-slate-300 hover:bg-slate-400"
              }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

function LobbyScreen({
  roomId,
  playerId,
  roomData,
  setRoomData,
  onStartGame,
  onBack,
}: {
  roomId: string
  playerId: string
  roomData: RoomData | null
  setRoomData: (data: RoomData | null) => void
  onStartGame: () => void
  onBack: () => void
}) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const roomRef = ref(database, `rooms/${roomId}`)
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val() as RoomData
      setRoomData(data)

      if (data && data.gameState === "playing") {
        onStartGame()
      }
    })

    return () => unsubscribe()
  }, [roomId, setRoomData, onStartGame])

  const handleToggleReady = async () => {
    const newReadyState = !isReady
    setIsReady(newReadyState)
    await update(ref(database, `rooms/${roomId}/players/${playerId}`), {
      isReady: newReadyState,
    })
  }

  const handleStartMatch = async () => {
    // Reset Levels to 1 for Tournament
    const updates: any = {
      [`rooms/${roomId}/gameState`]: "playing",
      [`rooms/${roomId}/tournament`]: {
        round: 1,
        scores: { [playerId]: 0, [Object.keys(roomData?.players || {}).find(p => p !== playerId)!]: 0 },
        activePlayerId: playerId, // Host starts?
        status: "playing",
        roundStartTime: Date.now()
      }
    }
    // Also reset individual players to Level 1
    Object.keys(roomData?.players || {}).forEach(pid => {
      updates[`rooms/${roomId}/players/${pid}/currentLevel`] = 1
      updates[`rooms/${roomId}/players/${pid}/lives`] = 3 // Reset lives too?
    })

    await update(ref(database), updates)
  }

  const playersList = roomData ? Object.entries(roomData.players) : []
  // Robust host check: use hostId if available, fallback to first player
  const isHost = roomData?.hostId === playerId || (!roomData?.hostId && playersList[0]?.[0] === playerId)
  const canStart = playersList.length === 2 && playersList.every(([_, p]) => p.isReady)

  return (
    <div className="bg-gradient-to-br from-[#e0e7ff] to-[#f0f4ff] rounded-3xl p-8 shadow-2xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-black text-[#1e293b] mb-2">GAME LOBBY</h1>
        <p className="text-sm text-[#64748b] font-semibold">
          Room ID: <span className="font-mono text-[#3b82f6] text-lg bg-white px-2 py-1 rounded-md shadow-sm ml-1 select-all">{roomData?.matchCode || roomId}</span>
        </p>
      </div>

      <div className="space-y-4 mb-8">
        {playersList.map(([id, player], index) => (
          <div key={id} className="bg-white rounded-2xl p-6 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-[#3b82f6] to-[#2563eb] rounded-full flex items-center justify-center relative">
                <Users className="w-7 h-7 text-white" />
                {roomData?.hostId === id && (
                  <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-1 border-2 border-white" title="Host">
                    <Trophy className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <div>
                <p className="font-black text-lg text-[#1e293b]">
                  {id === playerId ? "You" : player.name || `Player ${index + 1}`}
                </p>
                <p className="text-sm text-[#64748b] font-semibold">
                  {player.lives} Lives • Level {player.currentLevel}
                </p>
              </div>
            </div>
            <div>
              {player.isReady ? (
                <div className="flex items-center gap-2 bg-[#10b981] text-white px-4 py-2 rounded-full font-bold shadow-sm animate-in zoom-in">
                  <Check className="w-5 h-5" />
                  READY
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-[#fbbf24] text-white px-4 py-2 rounded-full font-bold shadow-sm">
                  <Clock className="w-5 h-5" />
                  WAITING
                </div>
              )}
            </div>
          </div>
        ))}

        {playersList.length < 2 && (
          <div className="bg-white/50 rounded-2xl p-6 flex items-center justify-center border-2 border-dashed border-[#cbd5e1] animate-pulse">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-[#64748b] animate-spin mx-auto mb-2" />
              <p className="text-[#64748b] font-bold">Waiting for opponent to join...</p>
              <p className="text-xs text-[#94a3b8] mt-1">Share the Match Code above</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Button
          onClick={handleToggleReady}
          className={`w-full font-black text-xl py-7 rounded-2xl shadow-lg h-auto transition-all ${isReady
            ? "bg-[#64748b] hover:bg-[#475569] text-white"
            : "bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white"
            }`}
        >
          {isReady ? "NOT READY" : "I'M READY!"}
        </Button>

        {isHost && (
          <Button
            onClick={handleStartMatch}
            disabled={!canStart}
            className={`w-full font-black text-xl py-7 rounded-2xl shadow-lg h-auto transition-all ${canStart
              ? "bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:scale-[1.02] animate-pulse"
              : "bg-slate-300 text-slate-500 cursor-not-allowed"}`}
          >
            START MATCH
          </Button>
        )}

        {!isHost && isReady && canStart && (
          <div className="text-center text-[#64748b] font-bold animate-pulse">
            Waiting for Host to start...
          </div>
        )}

        <Button
          onClick={onBack}
          variant="outline"
          className="w-full font-bold text-lg py-6 rounded-2xl h-auto border-2 bg-transparent mt-2"
        >
          LEAVE LOBBY
        </Button>
      </div>
    </div>
  )
}

function MultiplayerGameScreen({
  roomId,
  playerId,
  roomData,
  setRoomData,
  onGameEnd,
  xp,
  onXpChange,
}: {
  roomId: string
  playerId: string
  roomData: RoomData
  setRoomData: (data: RoomData | null) => void
  onGameEnd: () => void
  xp: number
  onXpChange: (newXp: number) => void
}) {
  const [showTurnModal, setShowTurnModal] = useState(false)
  const isMyTurn = roomData?.currentTurn === playerId
  const opponentId = Object.keys(roomData?.players || {}).find((id) => id !== playerId)
  const opponentData = opponentId ? roomData?.players[opponentId] : null

  // Listen for room updates
  useEffect(() => {
    const roomRef = ref(database, `rooms/${roomId}`)
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val() as RoomData
      setRoomData(data)

      if (data) {
        // Check for Turn Change
        if (data.currentTurn === playerId && !isMyTurn) {
          setShowTurnModal(true)
        }

        const players = Object.entries(data.players)
        const loser = players.find(([_, p]) => p.lives === 0)
        if (loser && data.gameState === "playing") {
          update(ref(database, `rooms/${roomId}`), { gameState: "finished" })
          onGameEnd()
        }
      }
    })

    return () => unsubscribe()
  }, [roomId, playerId, setRoomData, isMyTurn, onGameEnd])

  if (!roomData) return null

  // Turn Modal Logic
  if (showTurnModal) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-in fade-in">
        <div className="bg-white rounded-3xl p-8 text-center max-w-sm mx-4 shadow-2xl animate-in zoom-in-50">
          <Zap className="w-16 h-16 text-[#eab308] mx-auto mb-4 animate-bounce" />
          <h2 className="text-4xl font-black text-[#1e293b] mb-2">YOUR TURN!</h2>
          <p className="text-[#64748b] font-bold mb-6">Opponent failed. It's up to you!</p>
          <Button
            onClick={() => setShowTurnModal(false)}
            className="w-full bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white font-black text-xl py-6 rounded-2xl"
          >
            LET'S GO
          </Button>
        </div>
      </div>
    )
  }

  // Tournament Turn Logic
  const isActivePlayer = roomData.tournament?.activePlayerId === playerId

  if (!isActivePlayer) {
    return <OpponentIsPlaying opponentData={opponentData} myData={roomData.players[playerId]} tournament={roomData.tournament} />
  }

  return (
    <MultiplayerGameplay
      level={roomData.players[playerId].currentLevel}
      tournament={roomData.tournament}
      lives={roomData.players[playerId].lives}
      onLevelComplete={async (newLevel) => {
        // Tournament: Win Round
        const nextRound = (roomData.tournament?.round || 0) + 1
        const updates: any = {
          [`rooms/${roomId}/players/${playerId}/currentLevel`]: newLevel,
          // Increment Score
          [`rooms/${roomId}/tournament/scores/${playerId}`]: (roomData.tournament?.scores?.[playerId] || 0) + 1,
          // Switch Turn
          [`rooms/${roomId}/tournament/activePlayerId`]: opponentId,
          [`rooms/${roomId}/tournament/round`]: nextRound,
          [`rooms/${roomId}/tournament/roundStartTime`]: Date.now(),
          [`rooms/${roomId}/currentDeck`]: generateDeck(newLevel),
          // Special: Check Game 5
          [`rooms/${roomId}/tournament/status`]: nextRound === 5 ? "game_5_intro" : "playing"
        }
        await update(ref(database), updates)
      }}
      onLevelFail={async () => {
        const newLives = roomData.players[playerId].lives - 1
        const updates: any = {
          [`rooms/${roomId}/players/${playerId}/lives`]: newLives
        }

        if (newLives <= 0) {
          // Tournament: Lost Round (Turn Over)
          const nextRound = (roomData.tournament?.round || 0) + 1
          updates[`rooms/${roomId}/tournament/activePlayerId`] = opponentId
          updates[`rooms/${roomId}/tournament/round`] = nextRound
          updates[`rooms/${roomId}/tournament/roundStartTime`] = Date.now()
          updates[`rooms/${roomId}/currentDeck`] = generateDeck(roomData.players[opponentId]?.currentLevel || 1) // Opponent plays their level
          updates[`rooms/${roomId}/tournament/status`] = nextRound === 5 ? "game_5_intro" : "playing"

          // Allow retry next time? Or reset lives?
          // For now, keep as is.
        } else {
          // Just lost a life, keep playing (Timer resets via key/effect in Gameplay)
        }
        await update(ref(database), updates)
      }}
      opponentData={opponentData}
      xp={xp}
      onXpChange={onXpChange}
      initialDeck={roomData.currentDeck}
    />
  )
}

function OpponentIsPlaying({ opponentData, myData, tournament }: { opponentData: PlayerData | null, myData: PlayerData, tournament?: any }) {
  return (
    <div className="bg-gradient-to-br from-[#e0e7ff] to-[#f0f4ff] rounded-3xl p-8 shadow-2xl">
      <div className="text-center space-y-6">
        <div className="w-24 h-24 bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] rounded-full flex items-center justify-center mx-auto animate-pulse">
          {tournament?.round && (
            <div className="absolute top-0 right-0 bg-yellow-400 text-white font-black px-2 rounded-full border-2 border-white shadow-sm">
              R{tournament.round}
            </div>
          )}
          <Users className="w-12 h-12 text-white" />
        </div>
        <h2 className="text-3xl font-black text-[#1e293b]">
          {tournament?.status === "game_5_intro" ? "GAME 5 DECIDER!" : "OPPONENT IS PLAYING..."}
        </h2>

        {opponentData && (
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <p className="text-[#64748b] font-bold mb-2">Opponent Status</p>
            <div className="flex justify-around text-center">
              <div>
                <p className="text-4xl font-black text-[#3b82f6]">{opponentData.lives}</p>
                <p className="text-sm font-semibold text-[#64748b]">Lives</p>
              </div>
              <div>
                <p className="text-4xl font-black text-[#8b5cf6]">{opponentData.currentLevel}</p>
                <p className="text-sm font-semibold text-[#64748b]">Level</p>
              </div>
              <div>
                <p className="text-4xl font-black text-[#10b981]">{opponentData.score}</p>
                <p className="text-sm font-semibold text-[#64748b]">Score</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <p className="text-[#64748b] font-bold mb-2">Your Status</p>
          <div className="flex justify-around text-center">
            <div>
              <p className="text-4xl font-black text-[#3b82f6]">{myData.lives}</p>
              <p className="text-sm font-semibold text-[#64748b]">Lives</p>
            </div>
            <div>
              <p className="text-4xl font-black text-[#8b5cf6]">{myData.currentLevel}</p>
              <p className="text-sm font-semibold text-[#64748b]">Level</p>
            </div>
            <div>
              <p className="text-4xl font-black text-[#10b981]">{myData.score}</p>
              <p className="text-sm font-semibold text-[#64748b]">Score</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MultiplayerGameplay({
  level,
  lives,
  opponentData,
  onLevelComplete,
  onLevelFail,
  xp,
  onXpChange,
  tournament,
  initialDeck,
}: {
  level: number
  lives: number
  opponentData: PlayerData | null | undefined
  onLevelComplete: (newLevel: number) => void
  onLevelFail: () => void
  xp: number
  onXpChange: (newXp: number) => void
  tournament?: any
  initialDeck?: string[]
}) {
  const pairsCount = level === 1 ? 2 : level === 2 ? 3 : 2 + level
  const gridSize = Math.min(6, 2 + Math.floor(level / 2)) * 2

  // Timer: Server Authoritative
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    if (tournament?.roundStartTime) {
      // Use logic: L1=6s, L2=10s, +4s
      const duration = level === 1 ? 6 : level === 2 ? 10 : 10 + (level - 2) * 4
      const endAt = tournament.roundStartTime + (duration * 1000)
      const remaining = Math.ceil((endAt - Date.now()) / 1000)
      setTimeLeft(Math.max(0, remaining))
    } else {
      // Fallback
      setTimeLeft(level === 1 ? 6 : level === 2 ? 10 : 10 + (level - 2) * 4)
    }
  }, [tournament, level])
  const [targetTime, setTargetTime] = useState<number | null>(null)

  const [cards, setCards] = useState<Card[]>([])
  const [flippedIndices, setFlippedIndices] = useState<number[]>([])
  const [streak, setStreak] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [hintTimer, setHintTimer] = useState<number | null>(null)

  useEffect(() => {
    initializeCards()
  }, [level])

  // Timer Effect
  useEffect(() => {
    if (isPaused || hintTimer !== null || !targetTime) return

    const interval = setInterval(() => {
      const remaining = Math.ceil((targetTime - Date.now()) / 1000)
      setTimeLeft(remaining)

      if (remaining <= 0) {
        clearInterval(interval)
        onLevelFail()
      }
    }, 100)

    return () => clearInterval(interval)
  }, [isPaused, hintTimer, targetTime, onLevelFail])

  // Resume timer when hint ends
  useEffect(() => {
    if (hintTimer === null && !isPaused && timeLeft > 0) {
      setTargetTime(Date.now() + timeLeft * 1000)
    } else if (hintTimer !== null) {
      setTargetTime(null)
    }
  }, [hintTimer, isPaused, timeLeft])

  useEffect(() => {
    if (hintTimer !== null && hintTimer > 0) {
      const timer = setTimeout(() => {
        setHintTimer((prev) => (prev !== null ? prev - 1 : null))
      }, 1000)
      return () => clearTimeout(timer)
    } else if (hintTimer === 0) {
      setCards(prev => prev.map(c => !c.matched ? { ...c, flipped: false } : c))
      setHintTimer(null)
    }
  }, [hintTimer])

  const initializeCards = () => {
    let deck: string[] = []

    if (initialDeck && initialDeck.length > 0) {
      deck = [...initialDeck]
    } else {
      const icons = ['fa-dog', 'fa-cat', 'fa-crow', 'fa-car-side', 'fa-truck-pickup', 'fa-motorcycle', 'fa-cube', 'fa-gem']
      const selectedIcons = Array.from({ length: pairsCount }, (_, i) => icons[i % icons.length])
      deck = [...selectedIcons, ...selectedIcons].sort(() => Math.random() - 0.5)
    }

    setCards(deck.map((value, id) => ({ id, value, matched: false, flipped: false })))
    setFlippedIndices([])
    setStreak(0)

    // Timer logic handled by effect
    setIsPaused(false)
  }

  const handleCardClick = useCallback((index: number) => {
    if (flippedIndices.length === 2 || cards[index].flipped || cards[index].matched || isPaused) return

    const newFlipped = [...flippedIndices, index]
    setFlippedIndices(newFlipped)

    const newCards = [...cards]
    newCards[index].flipped = true
    setCards(newCards)

    if (newFlipped.length === 2) {
      const [firstIndex, secondIndex] = newFlipped
      if (cards[firstIndex].value === cards[secondIndex].value) {
        setCards((prev) =>
          prev.map((c, i) => (i === firstIndex || i === secondIndex ? { ...c, matched: true } : c)),
        )
        setFlippedIndices([])
        setStreak((s) => s + 1)
        setTimeLeft((prev) => prev + 2) // Bonus time
        if (targetTime) setTargetTime(prev => (prev || Date.now()) + 2000) // Add to timestamps

        // XP Gain on Match?
        onXpChange(xp + 5) // Reward for match

        const allMatched = cards.every((c, i) =>
          (i === firstIndex || i === secondIndex) || c.matched
        )
        if (allMatched) {
          setTimeout(() => onLevelComplete(level + 1), 1000)
        }
      } else {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) => (i === firstIndex || i === secondIndex ? { ...c, flipped: false } : c)),
          )
          setFlippedIndices([])
        }, 250) // Fast mismatch flip
      }
    }
  }, [cards, flippedIndices, isPaused, targetTime, xp, onXpChange, onLevelComplete, level])

  const handleHint = () => {
    if (xp < 10) {
      toast.error("Not enough XP! Need 10 XP.")
      return
    }

    onXpChange(xp - 10)

    const unmatched = cards.filter((c) => !c.matched && !c.flipped)
    if (unmatched.length < 2) return

    // Find a pair
    const cardValues = unmatched.map(c => c.value)
    // Find duplicate value
    const pairValue = cardValues.find((item, index) => cardValues.indexOf(item) !== index)

    if (pairValue) {
      // Reveal them
      setCards(prev => prev.map(c => c.value === pairValue ? { ...c, flipped: true } : c))
      setHintTimer(3)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  } // End match check helper

  return (
    <div className="bg-gradient-to-br from-[#e0e7ff] to-[#f0f4ff] rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-md">
            <p className="text-[#1e293b] text-xs font-bold">LIVES</p>
            <p className="text-[#1e293b] text-2xl font-black">{lives}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-[#3b82f6] text-white font-black px-5 py-2 rounded-full text-lg shadow-lg">LV {level}</div>
        </div>
      </div>

      {opponentData && (
        <div className="bg-white/70 rounded-2xl p-3 mb-4 flex items-center justify-between">
          <p className="text-[#64748b] font-bold text-sm">Opponent</p>
          <div className="flex gap-4 text-sm">
            <span className="font-black text-[#3b82f6]">{opponentData.lives} Lives</span>
            <span className="font-black text-[#8b5cf6]">Lv {opponentData.currentLevel}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6 bg-white/60 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <p className="text-[#1e293b] text-sm font-bold">STREAK</p>
          <p className="text-[#3b82f6] text-4xl font-black">{streak}</p>
        </div>
        <div className="flex items-center gap-3 bg-yellow-100 px-3 py-1 rounded-full">
          <Zap className="w-5 h-5 text-yellow-600" />
          <p className="text-yellow-700 font-bold">{xp} XP</p>
        </div>
        <div className="text-right flex items-center gap-2">
          <div>
            <p className="text-[#1e293b] text-sm font-bold">LEVEL</p>
            <p className="text-[#64748b] text-xs font-semibold">XP Boost at 4</p>
          </div>
          <Target className="w-8 h-8 text-[#8b5cf6]" />
        </div>
      </div>

      <div className="bg-gradient-to-br from-[#dbeafe] to-[#bfdbfe] rounded-3xl p-6 mb-6 shadow-inner">
        <CardGrid
          cards={cards}
          onCardClick={handleCardClick}
          isPaused={isPaused}
          hintActive={hintTimer !== null}
          gridSize={gridSize}
        />

        <div className="flex rounded-2xl overflow-hidden shadow-lg">
          <button
            onClick={handleHint}
            disabled={hintTimer !== null || xp < 10}
            className="flex-1 bg-gradient-to-r from-[#f59e0b] to-[#d97706] hover:from-[#d97706] hover:to-[#b45309] text-white font-black text-xl py-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            HINT (10 XP)
          </button>
          <div className="flex-1 bg-gradient-to-l from-[#ef4444] to-[#dc2626] text-white font-black text-xl py-4 flex items-center justify-center">
            {hintTimer !== null ? `${hintTimer}s` : formatTime(timeLeft)}
          </div>
        </div>
      </div>

      <div className="flex rounded-2xl overflow-hidden shadow-lg mb-4">
        <button
          onClick={() => {
            setIsPaused(false)
            setTargetTime(Date.now() + timeLeft * 1000) // Resume logic
          }}
          className={`flex-1 font-black text-2xl py-4 transition-all ${!isPaused
            ? "bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white scale-105"
            : "bg-[#cbd5e1] text-[#64748b]"
            }`}
        >
          PLAY
        </button>
        <button
          onClick={() => {
            setIsPaused(true)
            setTargetTime(null) // Pause logic
          }}
          className={`flex-1 font-black text-2xl py-4 transition-all ${isPaused
            ? "bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] text-white scale-105"
            : "bg-[#cbd5e1] text-[#64748b]"
            }`}
        >
          PAUSE
        </button>
      </div>

      <div className="text-center text-[#64748b] text-sm font-semibold">Developer Rebry Creatives</div>
    </div>
  )
}



function JoinMatchScreen({
  onJoinMatch,
  onBack,
}: {
  onJoinMatch: (code: string) => void
  onBack: () => void
}) {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")

  const handleJoin = () => {
    if (code.length !== 6) {
      setError("Match code must be 6 characters")
      return
    }

    setError("")
    onJoinMatch(code)
  }

  return (
    <div className="bg-gradient-to-br from-[#e0e7ff] to-[#f0f4ff] rounded-3xl p-8 shadow-2xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-black text-[#1e293b] mb-2">JOIN MATCH</h1>
        <p className="text-sm text-[#64748b] font-semibold">Enter the match code from your opponent</p>
      </div>

      <div className="bg-white rounded-2xl p-8 mb-6 shadow-lg">
        <label className="text-center text-[#64748b] font-bold mb-3 block">MATCH CODE</label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="XXXXXX"
          className="w-full text-center text-4xl font-black text-[#3b82f6] tracking-wider border-2 border-[#cbd5e1] rounded-xl p-4 mb-4 focus:outline-none focus:border-[#3b82f6] uppercase"
        />
        {error && <p className="text-center text-[#ef4444] font-semibold text-sm">{error}</p>}
      </div>

      <div className="space-y-3">
        <Button
          onClick={handleJoin}
          disabled={code.length !== 6}
          className="w-full bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white font-black text-xl py-7 rounded-2xl shadow-lg h-auto disabled:opacity-50"
        >
          JOIN GAME
        </Button>

        <Button
          onClick={onBack}
          variant="outline"
          className="w-full font-bold text-lg py-6 rounded-2xl h-auto border-2 bg-transparent"
        >
          BACK
        </Button>
      </div>
    </div>
  )
}
