"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type {
  Attachment,
  Conversation,
  Message,
  NotificationItem,
  ReplyPreview,
  User,
} from "@/lib/types"
import {
  CONVERSATIONS,
  CURRENT_USER,
  INITIAL_NOTIFICATIONS,
  MESSAGES,
  USERS,
} from "@/lib/mock-data"
import { getCurrentUser, getUsers, getUnreadCounts, getPresence } from "@/lib/api";

import { useMessages } from "@/hooks/use-messages";

type Theme = "dark" | "light"

interface Settings {
  notifications: boolean
  sounds: boolean
  readReceipts: boolean
}

interface ChatContextValue {
  theme: Theme
  toggleTheme: () => void

  currentUser: User | null
  users: Record<string, User>
  conversations: Conversation[]

  activeConversationId: string
  setActiveConversation: (id: string) => void
  activeConversation: Conversation | undefined

  messagesByConversation: Record<string, Message[]>
  activeMessages: Message[]

  sendMessage: (
    text: string,
    options?: { attachment?: Attachment; replyTo?: ReplyPreview },
  ) => void
  receiveMessage: (conversationId: string, text: string) => void
  toggleReaction: (messageId: string, emoji: string) => void

  typingConversationId: string | null
  setTyping: (conversationId: string | null) => void

  replyTarget: ReplyPreview | null
  setReplyTarget: (reply: ReplyPreview | null) => void

  rightPanelOpen: boolean
  toggleRightPanel: () => void
  setRightPanelOpen: (open: boolean) => void

  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void

  searchOpen: boolean
  setSearchOpen: (open: boolean) => void

  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void

  notifications: NotificationItem[]
  unreadNotifications: number
  markNotificationsRead: () => void

  settings: Settings
  updateSettings: (partial: Partial<Settings>) => void

  lastMessageFor: (conversationId: string) => Message | undefined
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark")
  const [users, setUsers] = useState<Record<string, User>>({})
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  const [conversations, setConversations] = useState<Conversation[]>([])
  // Removed manual messagesByConversation state

  const [activeConversationId, setActiveConversationId] = useState<string>("")
  const [typingConversationId, setTypingConversationId] = useState<string | null>(null)
  
  // Real messages connection
  const { messages: activeMessages, sendMessage: apiSendMessage } = useMessages(activeConversationId)

  const [replyTarget, setReplyTarget] = useState<ReplyPreview | null>(null)

  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [notifications, setNotifications] = useState<NotificationItem[]>(
    INITIAL_NOTIFICATIONS,
  )
  const [settings, setSettings] = useState<Settings>({
    notifications: true,
    sounds: true,
    readReceipts: true,
  })

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
      root.classList.remove("light")
    } else {
      root.classList.add("light")
      root.classList.remove("dark")
    }
  }, [theme])

  // Fetch true data
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const meResult = await getCurrentUser();
        if (!mounted) return;
        
        const mappedCurrentUser: User = {
          id: String(meResult.id),
          name: meResult.username,
          handle: `@${meResult.username}`,
          avatar: "/media/placeholder.png", // Fallback
          status: "online",
        };
        setCurrentUser(mappedCurrentUser);

        // Fetch users, initial counts & presence
        const [usersList, presenceList] = await Promise.all([
          getUsers(),
          getPresence(),
        ]);
        
        try {
          // getUnreadCounts might fail if 0 unread on some endpoints, wrap it individually later if needed
          const unreadList = await getUnreadCounts();
          
          if (!mounted) return;
          
          const usersMap: Record<string, User> = {};
          const convs: Conversation[] = [];
  
          usersList.forEach((u: any) => {
            const uidStr = String(u.id);
            const presence = presenceList.find((p) => String(p.id) === uidStr);
            const status = presence?.online ? "online" : "offline";
  
            usersMap[uidStr] = {
              id: uidStr,
              name: u.username,
              handle: `@${u.username}`,
              avatar: "/media/placeholder.png",
              status,
              lastSeen: presence?.last_seen,
            };
  
            const unreads = unreadList.find((c) => String(c.user_id) === uidStr)?.count || 0;
  
            convs.push({
              id: uidStr, 
              name: u.username,
              avatar: "/media/placeholder.png",
              unread: unreads,
              status,
              isGroup: false,
              participantId: uidStr,
            });
          });
          
          setUsers(usersMap);
          setConversations(convs);
          if (convs.length > 0 && !activeConversationId) {
            setActiveConversationId(convs[0].id);
          }
        } catch(e) {
            console.error("Error fetching unread list", e);
        }

      } catch (error) {
        console.error("Failed to load user auth", error);
        // `apiFetch` redirects to /login on 401
      }
    }
    loadData();

    // Set up polling for users to update presence and unread counts
    const interval = setInterval(async () => {
      try {
        const [unreadList, presenceList] = await Promise.all([
           getUnreadCounts(), getPresence()
        ]);
        if (!mounted) return;
        
        setConversations(prev => [...prev].map(c => {
           const presence = presenceList.find(p => String(p.id) === c.id);
           const unreads = unreadList.find((u) => String(u.user_id) === c.id)?.count || 0;
           return {
             ...c,
             status: presence?.online ? "online" : "offline",
             unread: unreads,
           };
        }));

        setUsers(prev => {
          const next = { ...prev };
          presenceList.forEach(p => {
             const uid = String(p.id);
             if(next[uid]) {
                next[uid].status = p.online ? "online" : "offline";
                next[uid].lastSeen = p.last_seen;
             }
          });
          return next;
        });

      } catch (e) {
        // silently ignore polling errors
      }
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"))
  }, [])

  const setActiveConversation = useCallback((id: string) => {
    setActiveConversationId(id)
    setReplyTarget(null)
    // mark conversation as read
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)),
    )
  }, [])

  const sendMessage = useCallback<ChatContextValue["sendMessage"]>(
    (text, options) => {
      const trimmed = text.trim()
      if (!trimmed && !options?.attachment) return
      
      apiSendMessage(trimmed)
      setReplyTarget(null)
    },
    [apiSendMessage],
  )

  const receiveMessage = useCallback<ChatContextValue["receiveMessage"]>(
    (conversationId, text) => {
      const conversation = conversations.find((c) => c.id === conversationId)
      if (!conversation) return
      
      // push a notification
      setNotifications((prev) => [
        {
          id: `n-${Date.now()}`,
          type: "message",
          text: `${conversation.name} sent you a message`,
          conversationId,
          timestamp: new Date().toISOString(),
          read: false,
        },
        ...prev,
      ])
    },
    [conversations, activeConversationId],
  )

  const toggleReaction = useCallback<ChatContextValue["toggleReaction"]>(
    (messageId, emoji) => {
      // Reactions not supported by backend yet
    },
    [],
  )

  const setTyping = useCallback((id: string | null) => {
    setTypingConversationId(id)
  }, [])

  const toggleRightPanel = useCallback(() => {
    setRightPanelOpen((prev) => !prev)
  }, [])

  const markNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const updateSettings = useCallback((partial: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...partial }))
  }, [])

  const lastMessageFor = useCallback(
    (conversationId: string) => {
      return undefined
    },
    [],
  )

  // Global CMD+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
      if (e.key === "Escape") {
        setSearchOpen(false)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId),
    [conversations, activeConversationId],
  )
  const messagesByConversation = useMemo(() => ({}), [])
  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  )

  const value: ChatContextValue = {
    theme,
    toggleTheme,
    currentUser,
    users,
    conversations,
    activeConversationId,
    setActiveConversation,
    activeConversation,
    messagesByConversation,
    activeMessages,
    sendMessage,
    receiveMessage,
    toggleReaction,
    typingConversationId,
    setTyping,
    replyTarget,
    setReplyTarget,
    rightPanelOpen,
    toggleRightPanel,
    setRightPanelOpen,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    searchOpen,
    setSearchOpen,
    settingsOpen,
    setSettingsOpen,
    notifications,
    unreadNotifications,
    markNotificationsRead,
    settings,
    updateSettings,
    lastMessageFor,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error("useChat must be used within ChatProvider")
  return ctx
}
