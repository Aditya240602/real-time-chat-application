"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { getMessages, sendMessage as apiSendMessage } from "@/lib/api"
import { Message } from "@/lib/types"

export function useMessages(userId?: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const lastMessageId = useRef<number | undefined>(undefined)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch messages initially and setup polling
  useEffect(() => {
    if (!userId) {
      setMessages([])
      lastMessageId.current = undefined
      return
    }

    let mounted = true

    const fetchInitial = async () => {
      try {
        const data = await getMessages(userId)
        if (!mounted) return
        
        const mapped: Message[] = data.map((d: any) => ({
          id: String(d.id),
          conversationId: userId,
          senderId: String(d.sender), // From backend structure
          text: d.content,
          timestamp: d.timestamp,
          status: "read", // Assume read if received from backend
          reactions: [],
        }))
        
        setMessages(mapped)
        if (data.length > 0) {
          lastMessageId.current = data[data.length - 1].id
        }
      } catch (err) {
        console.error("Failed to fetch initial messages", err)
      }
    }

    const poll = async () => {
      if (!userId) return
      try {
        const data = await getMessages(userId, lastMessageId.current)
        if (!mounted || data.length === 0) return
        
        const mapped: Message[] = data.map((d: any) => ({
          id: String(d.id),
          conversationId: userId,
          senderId: String(d.sender),
          text: d.content,
          timestamp: d.timestamp,
          status: "read",
          reactions: [],
        }))

        setMessages((prev) => [...prev, ...mapped])
        lastMessageId.current = data[data.length - 1].id
      } catch (err) {
        console.error("Failed to poll messages", err)
      }
    }

    fetchInitial().then(() => {
      if (mounted) {
        pollingRef.current = setInterval(poll, 3000)
      }
    })

    return () => {
      mounted = false
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [userId])

  const sendMessage = useCallback(async (content: string) => {
    if (!userId) return
    const tempId = `temp-${Date.now()}`
    
    // Optimistic update
    const optimisticMessage: Message = {
      id: tempId,
      conversationId: userId,
      senderId: "me", // We will fix standard senderId handling if possible
      text: content,
      timestamp: new Date().toISOString(),
      status: "sent",
      reactions: [],
    }
    
    setMessages((prev) => [...prev, optimisticMessage])

    try {
      const resp = await apiSendMessage(userId, content)
      // replace optimistic
      setMessages((prev) => prev.map((m) => {
        if (m.id === tempId) {
          return {
            ...m,
            id: String(resp.id),
            status: "delivered", // or 'read' based on backend
          }
        }
        return m
      }))
      lastMessageId.current = Math.max(lastMessageId.current ?? 0, resp.id)
    } catch (err) {
      console.error("Failed to send message", err)
      // Revert optimistic or mark as failed
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "sent" /* could add failed state */ } : m))
    }
  }, [userId])

  return {
    messages,
    sendMessage,
  }
}
