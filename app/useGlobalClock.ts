"use client"

import { useEffect, useRef, useState } from "react"
import type { ClockMessage } from "../src/clock/messages"
import type { ClockState } from "../src/clock/schedule"
import type { TriviaResultPayload } from "../src/trivia/types"
import { getApiBaseUrl, getClockWsUrl } from "./urlHelpers"

const getUrls = () => {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? getApiBaseUrl()
  const wsUrl =
    process.env.NEXT_PUBLIC_CLOCK_WS_URL ??
    (process.env.NEXT_PUBLIC_API_BASE_URL ? getClockWsUrl({ env: process.env }) : getClockWsUrl())
  const httpUrl =
    process.env.NEXT_PUBLIC_CLOCK_HTTP_URL ??
    (process.env.NEXT_PUBLIC_API_BASE_URL ? `${apiBase}/clock` : `${getApiBaseUrl()}/clock`)
  
  try {
    const apiHost = new URL(apiBase).host
    const wsHost = wsUrl ? new URL(wsUrl).host.replace(/^wss?:\/\//, "") : "same-origin"
    console.info(`[clock] resolved API host ${apiHost}, WS host ${wsHost}`)
  } catch (error) {
    console.warn("[clock] URL resolution log skipped", error)
  }
  
  return { apiBase, wsUrl, httpUrl }
}

export const useGlobalClock = () => {
  const [clock, setClock] = useState<ClockState | null>(null)
  const [latestResult, setLatestResult] = useState<TriviaResultPayload | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("connecting")
  const [retryCount, setRetryCount] = useState(0)
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const offsetRef = useRef<number>(0)

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now() + offsetRef.current), 200)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    const { apiBase: API_BASE, wsUrl: WS_URL, httpUrl: HTTP_URL } = getUrls()
    let socket: WebSocket | null = null
    let closed = false
    let lastAttemptLogged = false

    const handleMessage = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data) as ClockMessage
        if (parsed.type === "snapshot" || parsed.type === "tick") {
          offsetRef.current = parsed.state.now - Date.now()
          setClock(parsed.state)
          setLastMessageAt(Date.now())
          if ("latestResult" in parsed && parsed.latestResult) {
            setLatestResult(parsed.latestResult)
          }
        }
        if (parsed.type === "trivia_result") {
          setLatestResult(parsed.result)
          setLastMessageAt(Date.now())
        }
      } catch (error) {
        console.warn("Discarding bad clock payload", error)
        setLastError(error instanceof Error ? error.message : "unknown payload error")
      }
    }

    const fetchSnapshot = async () => {
      if (!HTTP_URL) return
      try {
        const response = await fetch(HTTP_URL, { cache: "no-store" })
        if (!response.ok) return
        const data = (await response.json()) as ClockState
        offsetRef.current = data.now - Date.now()
        setClock(data as ClockState)
      } catch (error) {
        console.warn("Snapshot fetch failed", error)
        setLastError(error instanceof Error ? error.message : "snapshot fetch failed")
      }
    }

    const scheduleReconnect = () => {
      if (closed) return
      const backoffMs = Math.min(10000, 500 * Math.pow(2, retryCount)) + Math.random() * 300
      retryRef.current = setTimeout(() => {
        setRetryCount((prev) => prev + 1)
        connect(true)
      }, backoffMs)
    }

    const connect = (isRetry = false) => {
      if (!WS_URL) {
        setConnectionStatus("error")
        setLastError("No WebSocket URL")
        return
      }
      setConnectionStatus(isRetry ? "connecting" : "connecting")
      if (!lastAttemptLogged) {
        console.info("[clock] connecting", { WS_URL, HTTP_URL, API_BASE })
        lastAttemptLogged = true
      }
      socket = new WebSocket(WS_URL)
      socket.addEventListener("open", () => {
        setConnectionStatus("connected")
        setRetryCount(0)
      })
      socket.addEventListener("message", handleMessage)
      socket.addEventListener("close", (event) => {
        if (closed) return
        console.warn("[clock] WebSocket closed", { WS_URL, code: event.code, reason: event.reason, wasClean: event.wasClean })
        setConnectionStatus("disconnected")
        setLastError(`Connection closed (code: ${event.code}${event.reason ? `, reason: ${event.reason}` : ""})`)
        scheduleReconnect()
      })
      socket.addEventListener("error", (event) => {
        console.error("[clock] WebSocket error", { WS_URL, event })
        setConnectionStatus("error")
        setLastError(`WebSocket error: ${WS_URL}`)
        socket?.close()
      })
    }

    fetchSnapshot()
    connect()

    return () => {
      closed = true
      if (retryRef.current) clearTimeout(retryRef.current)
      socket?.close()
    }
  }, [])

  const forceRetry = () => {
    if (retryRef.current) clearTimeout(retryRef.current)
    setRetryCount((prev) => prev + 1)
  }

  return { clock, now, latestResult, connectionStatus, retryCount, retry: forceRetry, lastMessageAt, lastError }
}
