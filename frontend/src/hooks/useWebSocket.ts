import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store'
import type { WebSocketMessage } from '../types'
import toast from 'react-hot-toast'

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
const RECONNECT_DELAY = 3000
const MAX_RECONNECT_ATTEMPTS = 10

export const useWebSocket = () => {
  const ws = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { setWsConnected, addNotification, triggerStatsRefresh, triggerArticlesRefresh } = useAppStore()

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return

    try {
      ws.current = new WebSocket(WS_URL)

      ws.current.onopen = () => {
        setWsConnected(true)
        reconnectAttempts.current = 0
        console.log('WebSocket connected')
      }

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          handleMessage(message)
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }

      ws.current.onclose = () => {
        setWsConnected(false)
        scheduleReconnect()
      }

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
    } catch (error) {
      console.error('WebSocket connection error:', error)
      scheduleReconnect()
    }
  }, [])

  const handleMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'crisis_alert':
      case 'crisis_detected': {
        const alertData = message.data as { crisis_clusters_found?: number }
        const count = alertData?.crisis_clusters_found || 1
        toast.error(`تنبيه أزمة: تم رصد ${count} تجمع أزمة جديد`, {
          duration: 8000,
          icon: '🚨',
        })
        addNotification(`تنبيه أزمة جديد`, 'error')
        triggerStatsRefresh()
        break
      }

      case 'new_article': {
        const articleData = message.data as { new_articles?: number }
        if ((articleData?.new_articles || 0) > 5) {
          triggerArticlesRefresh()
          triggerStatsRefresh()
        }
        break
      }

      case 'stats_update':
        triggerStatsRefresh()
        triggerArticlesRefresh()
        break

      case 'heartbeat':
        ws.current?.send(JSON.stringify({ type: 'ping' }))
        break
    }
  }

  const scheduleReconnect = () => {
    if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) return

    reconnectAttempts.current++
    const delay = RECONNECT_DELAY * Math.min(reconnectAttempts.current, 5)

    reconnectTimer.current = setTimeout(connect, delay)
  }

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      ws.current?.close()
    }
  }, [connect])

  return { wsConnected: useAppStore((s) => s.wsConnected) }
}
