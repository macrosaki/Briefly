"use client";

import { useMemo, useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useGlobalClock } from "./useGlobalClock"

const giftsBoughtToday = [
  { name: "Solar Bloom", cost: 320, timestamp: "09:03" },
  { name: "Aurora Pulse", cost: 410, timestamp: "09:11" },
  { name: "Neon Bloom", cost: 280, timestamp: "09:29" },
] as const

const profileSnapshot = {
  username: "orbit-waltz",
  points: 6280,
  glimmer: 18,
  wonGifts: 5,
}

const formatCountdown = (ms: number) => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1_000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

const triviaOptions = ["Orbit Club", "Lunar Bloom", "Solar Vibe", "Neon Echo"]

function PageContent() {
  const searchParams = useSearchParams()
  const debugEnabled = searchParams.get("debug") === "1"
  const { clock, now, latestResult, connectionStatus, retryCount, retry, lastMessageAt, lastError } =
    useGlobalClock()
  const [giftTrayOpen, setGiftTrayOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [isWalletConnected, setIsWalletConnected] = useState(false)
  const [bidAmount, setBidAmount] = useState("")
  const [lastBidUpdate, setLastBidUpdate] = useState(0)

  const countdown = formatCountdown(clock ? Math.max(0, clock.phaseEndsAt - now) : 0)
  const isEarn = clock?.phase === "EARN_TRIVIA"
  const phaseLabel = !clock ? "SYNCING" : isEarn ? "EARN" : "SPEND"
  const isDisconnected = connectionStatus === "disconnected" || connectionStatus === "error"
  const showRetry = isDisconnected && retryCount >= 5
  const connectionMessage =
    connectionStatus === "connected"
      ? "Live"
      : connectionStatus === "connecting"
        ? "Connecting…"
        : "Disconnected. Retrying…"
  
  const handleConnectWallet = () => {
    // TODO: Implement actual wallet connection
    setIsWalletConnected(true)
  }

  const handleBid = () => {
    const amount = parseInt(bidAmount, 10)
    if (isNaN(amount) || amount <= 0) return
    // TODO: Implement actual bid submission
    console.log("Bid submitted:", amount)
    setBidAmount("")
  }

  const quickBidPresets = [50, 100, 250, 500]
  const roundId = clock?.round?.id ?? 1
  const giftWindowId = clock?.giftWindowId ?? 1

  const giftWindowLabel = useMemo(() => `Gift window #${giftWindowId}`, [giftWindowId])

  const highestBid = useMemo(() => 1240 + ((giftWindowId % 5) * 90), [giftWindowId])

  useEffect(() => {
    if (!isEarn && highestBid) {
      setLastBidUpdate(Date.now())
    }
  }, [highestBid, isEarn])

  const timeRemaining = clock ? Math.max(0, clock.phaseEndsAt - now) : 0
  const secondsRemaining = Math.floor(timeRemaining / 1000)
  const isFrantic = !isEarn && secondsRemaining <= 40 && secondsRemaining > 0
  const isGiftStart = !isEarn && clock && now - (clock.phaseEndsAt - 600000) < 2000

  const voteShares = useMemo(
    () => triviaOptions.map((_, index) => 24 + (((clock?.round?.id ?? 1) + index * 3) % 30)),
    [clock?.round?.id],
  )

  return (
    <main className="alive-stage" data-phase={phaseLabel.toLowerCase()}>
      <div className="stage-halo" />
      <div className="stage-content">
        {(!clock || isDisconnected) && (
          <div className="sync-overlay">
            <div className="sync-content">
              <h2 className="sync-title">
                {!clock ? "SYNCING CLOCK" : "DISCONNECTED"}
              </h2>
              <p className="sync-message">
                {!clock
                  ? "Connecting to global show clock..."
                  : showRetry
                    ? "Can't connect to clock. Check your connection."
                    : "Retrying connection..."}
              </p>
              {showRetry && (
                <button className="sync-retry-btn" onClick={retry}>
                  Retry Now
                </button>
              )}
            </div>
          </div>
        )}
        <div className="stage-meta">
          <p className="stage-phase-pill">{phaseLabel}</p>
          <p className="stage-countdown">{clock ? `next flip in ${countdown}` : "syncing clock..."}</p>
          <p className={`connection-indicator ${isDisconnected ? "disconnected" : "connected"}`}>
            {showRetry ? (
              <>
                Can&apos;t connect. <button onClick={retry}>Retry</button>
              </>
            ) : (
              connectionMessage
            )}
          </p>
        </div>
        <h1 className="stage-heading">
          {isEarn ? `Trivia Round ${roundId}` : "Gift Spotlight"}
        </h1>
        <p className="stage-subtext">
          {isEarn
            ? "Global trivia pulses across the show clock. Everyone votes in sync."
            : "A 10-minute gift takeover is live - threshold, ring, and highest bid animate together."}
        </p>

        <section className={`phase-panel ${isEarn ? "panel-earn" : "panel-spend"}`} data-phase={phaseLabel}>
          {isEarn ? (
            <>
              <p className="panel-note">Question reveals + vote window (14s)</p>
              <div className="question-card">
                <p className="question">Which orbiting icon powers the neon aurora?</p>
                <div className="answers-grid">
                  {triviaOptions.map((option, index) => (
                    <div className="answer-pill" key={option}>
                      <span>{option}</span>
                      <small>{voteShares[index]}%</small>
                    </div>
                  ))}
                </div>
              </div>
              {latestResult && (
                <div className="distribution-card">
                  <header>
                    <p>Last round distribution</p>
                    <small>
                      Correct: {latestResult.correctAnswer} · {latestResult.difficulty} ·{" "}
                      {latestResult.crowdAwarded ? "Awarded" : "No award"}
                    </small>
                  </header>
                  <div className="answers-grid">
                    {triviaOptions.map((option, index) => (
                      <div
                        className={`answer-pill ${
                          option === latestResult.correctAnswer ? "answer-correct" : "answer-incorrect"
                        }`}
                        key={option}
                      >
                        <span>{option}</span>
                        <small>{latestResult.distribution[index]} votes</small>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="panel-note">{giftWindowLabel} - 10:00 gift window</p>
              <div className={`gift-card ${isGiftStart ? "gift-slam-in" : ""} ${isFrantic ? "gift-frantic" : ""}`}>
                <div className={`gift-circle ${lastBidUpdate > 0 ? "gift-ring-pulse" : ""}`} key={lastBidUpdate}>
                  <span className="gift-label">Now Live</span>
                  <strong className="gift-name">Prismatic Halo</strong>
                </div>
                <div className="gift-metrics">
                  <div>
                    <span>Threshold</span>
                    <strong>1,500 pts</strong>
                  </div>
                  <div>
                    <span>Highest bid</span>
                    <strong>{highestBid.toLocaleString()} pts</strong>
                  </div>
                </div>
                <div className="gift-action-section">
                  {!isWalletConnected ? (
                    <button className="gift-primary-btn" onClick={handleConnectWallet}>
                      CONNECT WALLET TO BID
                    </button>
                  ) : (
                    <div className="gift-bid-controls">
                      <div className="gift-bid-input-group">
                        <input
                          type="number"
                          className="gift-bid-input"
                          placeholder="Enter bid amount"
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          min="1"
                        />
                        <button className="gift-bid-submit" onClick={handleBid} disabled={!bidAmount}>
                          BID
                        </button>
                      </div>
                      <div className="gift-quick-bids">
                        {quickBidPresets.map((preset) => (
                          <button
                            key={preset}
                            className="gift-quick-bid"
                            onClick={() => setBidAmount(preset.toString())}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <div className="bottom-left">
        <button className="corner-pill" onClick={() => setGiftTrayOpen((prev) => !prev)}>
          Gifts bought today <span>{giftsBoughtToday.length}</span>
        </button>
        {debugEnabled && (
          <div className="floating-panel debug-panel">
            <header>
              <p>Debug HUD</p>
            </header>
            <ul>
              <li>WS state: {connectionStatus}</li>
              <li>Retry count: {retryCount}</li>
              <li>Last message: {lastMessageAt ? new Date(lastMessageAt).toLocaleTimeString() : "—"}</li>
              <li>Phase: {clock?.phase ?? "unknown"}</li>
              <li>Ends at: {clock?.phaseEndsAt ? new Date(clock.phaseEndsAt).toLocaleTimeString() : "—"}</li>
              <li>Last error: {lastError ?? "none"}</li>
            </ul>
            {showRetry && (
              <button onClick={retry} className="corner-pill">
                Retry now
              </button>
            )}
          </div>
        )}
        {giftTrayOpen && (
          <div className="floating-panel tray-panel">
            <header>
              <p>Today&apos;s gifts</p>
              <button aria-label="Close gifts tray" onClick={() => setGiftTrayOpen(false)}>
                x
              </button>
            </header>
            <ul>
              {giftsBoughtToday.map((gift) => (
                <li key={gift.name}>
                  <strong>{gift.name}</strong>
                  <span>{gift.cost} pts</span>
                  <small>{gift.timestamp}</small>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="bottom-right">
        <div className="points-pill">
          <p>Points</p>
          <strong>{profileSnapshot.points.toLocaleString()}</strong>
        </div>
        <button className="avatar" onClick={() => setProfileOpen((prev) => !prev)} aria-label="Open profile">
          <span>OW</span>
        </button>
        {profileOpen && (
          <div className="floating-panel profile-panel">
            <header>
              <p>Profile</p>
              <button aria-label="Close profile" onClick={() => setProfileOpen(false)}>
                x
              </button>
            </header>
            <div className="profile-body">
              <p className="profile-name">@{profileSnapshot.username}</p>
              <p>
                Points available: <strong>{profileSnapshot.points.toLocaleString()}</strong>
              </p>
              <p>
                Glimmer claimable: <strong>{profileSnapshot.glimmer}</strong>
              </p>
              <p>
                Gifts won: <strong>{profileSnapshot.wonGifts}</strong>
              </p>
              <div className="profile-recent">
                <p>Latest win: Neon Bloom</p>
                <p>Next Glimmer drop in sync with show clock</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PageContent />
    </Suspense>
  )
}
