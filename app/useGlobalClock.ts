"use client"

import { useEffect, useRef, useState } from "react"
import type { ClockMessage } from "../src/clock/messages"
import type { ClockState } from "../src/clock/schedule"
import type { TriviaResultPayload } from "../src/trivia/types"

const WS_URL = process.env.NEXT_PUBLIC_CLOCK_WS_URL
const HTTP_URL = process.env.NEXT_PUBLIC_CLOCK_HTTP_URL ?? (WS_URL ? WS_URL.replace("ws", "http") : undefined)

export const useGlobalClock = () => {
  const [clock, setClock] = useState<ClockState | null>(null)
  const [latestResult, setLatestResult] = useState<TriviaResultPayload | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const offsetRef = useRef<number>(0)

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now() + offsetRef.current), 200)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    let socket: WebSocket | null = null
    let closed = false

    const handleMessage = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data) as ClockMessage
        if (parsed.type === "snapshot" || parsed.type === "tick") {
          offsetRef.current = parsed.state.now - Date.now()
          setClock(parsed.state)
          if ("latestResult" in parsed && parsed.latestResult) {
            setLatestResult(parsed.latestResult)
          }
        }
        if (parsed.type === "trivia_result") {
          setLatestResult(parsed.result)
        }
      } catch (error) {
        console.warn("Discarding bad clock payload", error)
      }
    }

    const fetchSnapshot = async () => {
      if (!HTTP_URL) return
      const response = await fetch(HTTP_URL, { cache: "no-store" })
      if (!response.ok) return
      const data = (await response.json()) as ClockState
      offsetRef.current = data.now - Date.now()
      setClock(data as ClockState)
    }

    const connect = () => {
      if (!WS_URL) return
      socket = new WebSocket(WS_URL)
      socket.addEventListener("message", handleMessage)
      socket.addEventListener("close", () => {
        if (closed) return
        retryRef.current = setTimeout(connect, 750)
      })
      socket.addEventListener("error", () => {
        socket?.close()
      })
    }

    fetchSnapshot().catch((error) => console.warn("Snapshot fetch failed", error))
    connect()

    return () => {
      closed = true
      if (retryRef.current) clearTimeout(retryRef.current)
      socket?.close()
    }
  }, [])

  return { clock, now, latestResult }
}
