"use client"

import { useEffect, useRef, useState } from "react"
import type { ClockMessage } from "../src/clock/messages"
import type { ClockState } from "../src/clock/schedule"
import type { TriviaResultPayload } from "../src/trivia/types"
import { getApiBaseUrl, getClockWsUrl } from "./urlHelpers"

const toClockWsUrl = (base: string): string => {
  try {
    const url = new URL(base)
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
    url.pathname = "/clock"
    url.search = ""
    url.hash = ""
    return url.toString()
  } catch {
    return ""
  }
}

const deriveClockUrls = () => {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? getApiBaseUrl()
  const wsUrl =
    process.env.NEXT_PUBLIC_CLOCK_WS_URL ??
    (process.env.NEXT_PUBLIC_API_BASE_URL ? getClockWsUrl({ env: process.env }) : getClockWsUrl({}))
  const httpUrl =
    process.env.NEXT_PUBLIC_CLOCK_HTTP_URL ??
    (process.env.NEXT_PUBLIC_API_BASE_URL ? `${apiBase}/clock` : `${getApiBaseUrl()}/clock`)

  const fallbackOrigin =
    typeof window !== "undefined" ? window.location.origin.replace(/\/+$/, "") : apiBase
  const fallbackWs = toClockWsUrl(fallbackOrigin)
  const fallbackHttp = `${fallbackOrigin}/clock`

  try {
    const apiHost = new URL(apiBase).host
    const wsHost = wsUrl ? new URL(wsUrl).host.replace(/^wss?:\/\//, "") : "same-origin"
    console.info(`[clock] resolved API host ${apiHost}, WS host ${wsHost}`)
  } catch (error) {
    console.warn("[clock] URL resolution log skipped", error)
  }

  return {
    primary: { api: apiBase, ws: wsUrl, http: httpUrl },
    fallback: { api: fallbackOrigin, ws: fallbackWs, http: fallbackHttp },
  }
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
  const [useFallbackHost, setUseFallbackHost] = useState(false)

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now() + offsetRef.current), 200)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    const urls = deriveClockUrls()
    const active = useFallbackHost ? urls.fallback : urls.primary
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
      if (!active.http) return
      try {
        const response = await fetch(active.http, { cache: "no-store" })
        if (!response.ok) return
        const data = (await response.json()) as ClockState
        offsetRef.current = data.now - Date.now()
        setClock(data as ClockState)
      } catch (error) {
        console.warn("Snapshot fetch failed", error)
        setLastError(error instanceof Error ? error.message : "snapshot fetch failed")
        setUseFallbackHost(true)
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
      if (!active.ws) {
        setConnectionStatus("error")
        setLastError("No WebSocket URL")
        return
      }
      setConnectionStatus(isRetry ? "connecting" : "connecting")
      if (!lastAttemptLogged) {
        console.info("[clock] connecting", { ws: active.ws, http: active.http, api: active.api })
        lastAttemptLogged = true
      }
      socket = new WebSocket(active.ws)
      socket.addEventListener("open", () => {
        setConnectionStatus("connected")
        setRetryCount(0)
      })
      socket.addEventListener("message", handleMessage)
      const activateFallback = () => {
        if (!useFallbackHost) {
          console.warn("[clock] falling back to same-origin clock")
          setUseFallbackHost(true)
        }
      }

      socket.addEventListener("close", (event) => {
        if (closed) return
        console.warn("[clock] WebSocket closed", {
          ws: active.ws,
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        })
        setConnectionStatus("disconnected")
        setLastError(`Connection closed (code: ${event.code}${event.reason ? `, reason: ${event.reason}` : ""})`)
        scheduleReconnect()
        if (!useFallbackHost) activateFallback()
      })
      socket.addEventListener("error", (event) => {
        console.error("[clock] WebSocket error", { ws: active.ws, event })
        setConnectionStatus("error")
        setLastError(`WebSocket error: ${active.ws}`)
        socket?.close()
        activateFallback()
      })
    }

    fetchSnapshot()
    connect()

    return () => {
      closed = true
      if (retryRef.current) clearTimeout(retryRef.current)
      socket?.close()
    }
  }, [useFallbackHost])

  const forceRetry = () => {
    if (retryRef.current) clearTimeout(retryRef.current)
    setRetryCount((prev) => prev + 1)
  }

  return { clock, now, latestResult, connectionStatus, retryCount, retry: forceRetry, lastMessageAt, lastError }
}
