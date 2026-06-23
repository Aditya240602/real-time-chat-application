"use client"

import { useEffect, useRef } from "react"
import { useChat } from "@/context/chat-context"
import { CONVERSATIONS, INCOMING_SNIPPETS } from "@/lib/mock-data"

/**
 * Simulates a WebSocket connection that pushes incoming messages and
 * typing indicators on an interval. No real network — purely mock.
 */
export function useWebSocket() {
  const {
    receiveMessage,
    setTyping,
    activeConversationId,
    settings,
  } = useChat()

  // keep latest values without re-subscribing the interval
  const activeRef = useRef(activeConversationId)
  const settingsRef = useRef(settings)
  activeRef.current = activeConversationId
  settingsRef.current = settings

  useEffect(() => {
    let typingTimeout: ReturnType<typeof setTimeout>

    const tick = () => {
      const pool = CONVERSATIONS.filter((c) => c.participantId !== "david")
      const conversation = pool[Math.floor(Math.random() * pool.length)]
      const snippet =
        INCOMING_SNIPPETS[
          Math.floor(Math.random() * INCOMING_SNIPPETS.length)
        ]

      // If the chat is the active one, show a typing indicator first.
      if (conversation.id === activeRef.current) {
        setTyping(conversation.id)
        typingTimeout = setTimeout(() => {
          setTyping(null)
          receiveMessage(conversation.id, snippet)
        }, 2200)
      } else {
        receiveMessage(conversation.id, snippet)
      }
    }

    const interval = setInterval(tick, 9000)
    return () => {
      clearInterval(interval)
      clearTimeout(typingTimeout)
      setTyping(null)
    }
  }, [receiveMessage, setTyping])
}
