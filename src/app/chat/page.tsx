'use client'

import { Suspense, useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import Image from 'next/image'
import Link from 'next/link'
import {
  Send,
  ArrowLeft,
  MessageSquare,
  CheckCheck,
  Check,
  MoreVertical,
  Calendar,
  Loader2,
} from 'lucide-react'
import { getPusherClient } from '@/lib/pusher-client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Partner {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

interface ConversationSummary {
  id: string
  bookingId: string
  partner: Partner
  lastMessage: {
    id: string
    content: string
    senderId: string
    createdAt: string
  } | null
  unreadCount: number
  booking: {
    startTime: string
    status: string
  }
}

interface ChatMessage {
  id: string
  content: string
  senderId: string
  isRead: boolean
  createdAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Avatar({
  user,
  size = 40,
  className = '',
}: {
  user: Pick<Partner, 'name' | 'email' | 'avatarUrl'>
  size?: number
  className?: string
}) {
  const initial = (user.name || user.email || '?')[0].toUpperCase()
  if (user.avatarUrl) {
    return (
      <Image
        src={user.avatarUrl}
        alt={user.name || 'User'}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
      />
    )
  }
  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white font-bold flex-shrink-0 ${className}`}
    >
      <span style={{ fontSize: size * 0.38 }}>{initial}</span>
    </div>
  )
}

function formatSidebarTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return 'now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatBubbleTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatDateDivider(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function shouldShowDateDivider(curr: ChatMessage, prev?: ChatMessage): boolean {
  if (!prev) return true
  return new Date(curr.createdAt).toDateString() !== new Date(prev.createdAt).toDateString()
}

function shouldShowTimeSeparator(curr: ChatMessage, prev?: ChatMessage): boolean {
  if (!prev) return false
  return new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60_000
}

// ── Main inner component (uses useSearchParams so needs Suspense wrapper) ──────

function ChatContent() {
  const { currentUser, isLoading: userLoading } = useUser()
  const searchParams = useSearchParams()
  const router = useRouter()

  const bookingIdParam = searchParams.get('bookingId')

  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoadingConvs, setIsLoadingConvs] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isMobileShowChat, setIsMobileShowChat] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const selectedConv = conversations.find((c) => c.id === selectedConvId) ?? null

  // ── Scroll to latest message ────────────────────────────────────────────────
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // ── Initial load: resolve bookingId param → conversation ───────────────────
  useEffect(() => {
    if (!currentUser) return
    const userId = currentUser.id

    const init = async () => {
      setIsLoadingConvs(true)

      // If a bookingId is provided, find/create the conversation first so we
      // can pre-select it once the conversation list is loaded.
      let targetConvId: string | null = null
      if (bookingIdParam) {
        try {
          const res = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: bookingIdParam, userId }),
          })
          const conv: ConversationSummary = await res.json()
          if (conv.id) {
            targetConvId = conv.id
            setIsMobileShowChat(true)
          }
        } catch (e) {
          console.error('[Chat] create conversation error:', e)
        }
      }

      // Load all conversations for the sidebar
      try {
        const res = await fetch(`/api/conversations?userId=${userId}`)
        const data: ConversationSummary[] = await res.json()
        setConversations(data)
        if (targetConvId) setSelectedConvId(targetConvId)
        else if (data.length > 0 && !bookingIdParam) {
          // Auto-select first conversation on desktop when no bookingId provided
          setSelectedConvId(data[0].id)
        }
      } catch (e) {
        console.error('[Chat] load conversations error:', e)
      }

      setIsLoadingConvs(false)
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, bookingIdParam])

  // ── Load messages when selected conversation changes ───────────────────────
  useEffect(() => {
    if (!selectedConvId || !currentUser) return

    const load = async () => {
      setIsLoadingMessages(true)
      setMessages([])
      try {
        const res = await fetch(
          `/api/messages?conversationId=${selectedConvId}&userId=${currentUser.id}`
        )
        const data: ChatMessage[] = await res.json()
        setMessages(data)
        // Reset unread badge for this conversation
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedConvId ? { ...c, unreadCount: 0 } : c))
        )
      } catch (e) {
        console.error('[Chat] load messages error:', e)
      }
      setIsLoadingMessages(false)
      scrollToBottom(false)
    }

    load()
  }, [selectedConvId, currentUser, scrollToBottom])

  // ── Pusher: subscribe to selected conversation's channel ──────────────────
  // React's effect cleanup guarantees the previous return-cleanup runs before
  // the next effect fires, so we don't need a manual "pre-cleanup" block here.
  useEffect(() => {
    if (!selectedConvId) return

    const pusher = getPusherClient()
    if (!pusher) return

    const channelName = `conversation-${selectedConvId}`
    const channel = pusher.subscribe(channelName)

    // Named handler so we can unbind precisely rather than using unbind_all()
    const handleNewMessage = (data: ChatMessage) => {
      setMessages((prev) => {
        // Deduplicate: the fetch-response fallback in handleSend may add this
        // id before (or after) the Pusher echo — either way, only keep one copy.
        if (prev.some((m) => m.id === data.id)) return prev
        return [...prev, data]
      })

      // Keep sidebar last-message snippet up to date
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConvId
            ? {
                ...c,
                lastMessage: {
                  id: data.id,
                  content: data.content,
                  senderId: data.senderId,
                  createdAt: data.createdAt,
                },
              }
            : c
        )
      )
    }

    channel.bind('new-message', handleNewMessage)

    // Strict cleanup: unbind only our specific handler, then drop the channel
    return () => {
      channel.unbind('new-message', handleNewMessage)
      pusher.unsubscribe(channelName)
    }
  }, [selectedConvId])

  // ── Cleanup Pusher connection on unmount ───────────────────────────────────
  useEffect(() => {
    return () => {
      getPusherClient()?.disconnect()
    }
  }, [])

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSelectConversation = (conv: ConversationSummary) => {
    setSelectedConvId(conv.id)
    setIsMobileShowChat(true)
    // Remove bookingId from URL so the page doesn't try to re-init
    router.replace('/chat', { scroll: false })
  }

  const handleSend = async () => {
    if (!draft.trim() || !selectedConvId || !currentUser || isSending) return

    const content = draft.trim()
    setDraft('')
    setIsSending(true)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConvId,
          senderId: currentUser.id,
          content,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const saved: ChatMessage = await res.json()

      // Primary delivery is via the Pusher echo (handleNewMessage above).
      // This fallback ensures the message appears even if the Pusher event is
      // delayed or lost — it is a no-op when Pusher already added it.
      if (saved?.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === saved.id)) return prev
          return [...prev, saved]
        })
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConvId
              ? {
                  ...c,
                  lastMessage: {
                    id: saved.id,
                    content: saved.content,
                    senderId: saved.senderId,
                    createdAt: saved.createdAt,
                  },
                }
              : c
          )
        )
      }
    } catch (e) {
      console.error('[Chat] send message error:', e)
      // Restore the draft so the user can retry
      setDraft(content)
    }

    setIsSending(false)
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
  }

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-purple-600" size={36} />
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in to access messages.</p>
          <Link
            href="/auth/signin"
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition"
          >
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-57px)] bg-gray-100 overflow-hidden">
      {/* ───────────── LEFT SIDEBAR ───────────── */}
      <aside
        className={`
          w-full md:w-[320px] lg:w-[360px] flex-shrink-0
          bg-white border-r border-gray-200 flex flex-col
          ${isMobileShowChat ? 'hidden md:flex' : 'flex'}
        `}
      >
        {/* Sidebar header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Messages</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-xs font-medium text-purple-600 hover:text-purple-800 transition bg-purple-50 px-3 py-1.5 rounded-lg"
          >
            ← Dashboard
          </Link>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingConvs ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="animate-spin text-purple-500" size={28} />
              <p className="text-sm text-gray-400">Loading conversations…</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center">
                <MessageSquare size={28} className="text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">No conversations yet</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Once a booking is confirmed, a chat channel opens automatically.
                </p>
              </div>
              <Link
                href="/dashboard"
                className="text-sm text-purple-600 hover:underline font-medium"
              >
                Go to Dashboard →
              </Link>
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = selectedConvId === conv.id
              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3.5 text-left
                    border-b border-gray-50 transition-colors
                    hover:bg-gray-50
                    ${isActive ? 'bg-purple-50 border-l-[3px] border-l-purple-600' : ''}
                  `}
                >
                  {/* Avatar with unread dot */}
                  <div className="relative flex-shrink-0">
                    <Avatar user={conv.partner} size={44} />
                    {conv.unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 flex items-center justify-center text-[9px] text-white font-bold">
                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-1 mb-0.5">
                      <span
                        className={`text-sm truncate ${
                          conv.unreadCount > 0
                            ? 'font-bold text-gray-900'
                            : 'font-semibold text-gray-800'
                        }`}
                      >
                        {conv.partner.name || conv.partner.email}
                      </span>
                      <span className="text-[11px] text-gray-400 flex-shrink-0">
                        {conv.lastMessage
                          ? formatSidebarTime(conv.lastMessage.createdAt)
                          : formatSidebarTime(conv.booking.startTime)}
                      </span>
                    </div>
                    <p
                      className={`text-xs truncate ${
                        conv.unreadCount > 0 ? 'text-gray-800 font-medium' : 'text-gray-500'
                      }`}
                    >
                      {conv.lastMessage ? (
                        <>
                          {conv.lastMessage.senderId === currentUser.id ? (
                            <span className="text-gray-400">You: </span>
                          ) : null}
                          {conv.lastMessage.content}
                        </>
                      ) : (
                        <span className="italic text-gray-400">Say hello 👋</span>
                      )}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* ───────────── RIGHT: CHAT AREA ───────────── */}
      <main
        className={`flex-1 flex flex-col min-w-0 ${
          isMobileShowChat ? 'flex' : 'hidden md:flex'
        }`}
      >
        {!selectedConv ? (
          /* ── Empty state ── */
          <div className="flex-1 flex flex-col items-center justify-center bg-white gap-5">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
              <MessageSquare size={40} className="text-purple-500" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900">Select a conversation</h2>
              <p className="text-sm text-gray-500 mt-1">
                Choose from the sidebar or open a chat from your{' '}
                <Link href="/dashboard" className="text-purple-600 hover:underline">
                  dashboard
                </Link>
                .
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* ── Chat header ── */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm z-10">
              {/* Back button (mobile) */}
              <button
                onClick={() => setIsMobileShowChat(false)}
                className="md:hidden flex-shrink-0 p-1.5 rounded-full hover:bg-gray-100 transition"
                aria-label="Back to conversations"
              >
                <ArrowLeft size={20} className="text-gray-600" />
              </button>

              <Avatar user={selectedConv.partner} size={40} className="ring-2 ring-purple-100" />

              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-gray-900 truncate">
                  {selectedConv.partner.name || selectedConv.partner.email}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Calendar size={11} className="text-gray-400" />
                  <p className="text-[11px] text-gray-500 truncate">
                    {new Date(selectedConv.booking.startTime).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    ·{' '}
                    <span
                      className={
                        selectedConv.booking.status === 'CONFIRMED'
                          ? 'text-blue-600 font-medium'
                          : 'text-green-600 font-medium'
                      }
                    >
                      {selectedConv.booking.status}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="hidden sm:flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
                <button className="p-1.5 rounded-full hover:bg-gray-100 transition text-gray-500">
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>

            {/* ── Messages area ── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50 space-y-1">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="animate-spin text-purple-500" size={28} />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center">
                    <MessageSquare size={22} className="text-purple-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-600">No messages yet</p>
                  <p className="text-xs text-gray-400">
                    Say hello to{' '}
                    {selectedConv.partner.name || selectedConv.partner.email}!
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = msg.senderId === currentUser.id
                  const prev = messages[idx - 1]
                  const next = messages[idx + 1]

                  const showDateDivider = shouldShowDateDivider(msg, prev)
                  const showTimeSep = !showDateDivider && shouldShowTimeSeparator(msg, prev)

                  // Avatar logic: show avatar for first message in a run of "theirs"
                  const isNewSenderRun = !prev || prev.senderId !== msg.senderId
                  // Tail logic: last message in a run gets the "tail" rounding
                  const isLastInRun = !next || next.senderId !== msg.senderId

                  return (
                    <div key={msg.id}>
                      {/* ── Date divider ── */}
                      {showDateDivider && (
                        <div className="flex items-center justify-center my-4">
                          <span className="text-[11px] font-medium text-gray-400 bg-gray-200 px-3 py-1 rounded-full">
                            {formatDateDivider(msg.createdAt)}
                          </span>
                        </div>
                      )}

                      {/* ── Time separator (5+ min gap) ── */}
                      {showTimeSep && (
                        <div className="flex items-center justify-center my-2">
                          <span className="text-[10px] text-gray-300">
                            {formatBubbleTime(msg.createdAt)}
                          </span>
                        </div>
                      )}

                      {/* ── Message row ── */}
                      <div
                        className={`flex items-end gap-2 mb-0.5 ${
                          isMe ? 'flex-row-reverse' : 'flex-row'
                        }`}
                      >
                        {/* Partner avatar */}
                        {!isMe && (
                          <div className="w-7 flex-shrink-0">
                            {isLastInRun ? (
                              <Avatar user={selectedConv.partner} size={28} />
                            ) : (
                              <div className="w-7 h-7" />
                            )}
                          </div>
                        )}

                        {/* Bubble */}
                        <div
                          className={`
                            flex flex-col gap-0.5
                            ${isMe ? 'items-end' : 'items-start'}
                            max-w-[68%] sm:max-w-[56%]
                          `}
                        >
                          {/* Sender name (first message in a run, not me) */}
                          {!isMe && isNewSenderRun && (
                            <span className="text-[11px] text-gray-400 px-1 font-medium">
                              {selectedConv.partner.name || selectedConv.partner.email}
                            </span>
                          )}

                          <div
                            className={`
                              px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap
                              ${
                                isMe
                                  ? `bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-sm
                                     ${isNewSenderRun ? 'rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl' : 'rounded-2xl'}
                                     ${isLastInRun ? 'rounded-br-sm' : 'rounded-2xl'}`
                                  : `bg-white text-gray-900 shadow-sm border border-gray-100
                                     ${isNewSenderRun ? 'rounded-tr-2xl rounded-tl-2xl rounded-br-2xl' : 'rounded-2xl'}
                                     ${isLastInRun ? 'rounded-bl-sm' : 'rounded-2xl'}`
                              }
                            `}
                          >
                            {msg.content}
                          </div>

                          {/* Time + read receipt (only on last in run) */}
                          {isLastInRun && (
                            <div
                              className={`flex items-center gap-1 px-1 ${
                                isMe ? 'flex-row-reverse' : 'flex-row'
                              }`}
                            >
                              <span className="text-[10px] text-gray-400">
                                {formatBubbleTime(msg.createdAt)}
                              </span>
                              {isMe && (
                                msg.isRead
                                  ? <CheckCheck size={12} className="text-blue-500" />
                                  : <Check size={12} className="text-gray-400" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Input area ── */}
            <div className="bg-white border-t border-gray-100 px-4 py-3">
              <div className="flex items-end gap-3 max-w-3xl mx-auto">
                <div className="flex-1 bg-gray-100 rounded-2xl px-4 py-2.5 flex items-end gap-2 ring-1 ring-transparent focus-within:ring-purple-400 focus-within:bg-white transition-all">
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value)
                      autoResize(e.target)
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${selectedConv.partner.name || selectedConv.partner.email}…`}
                    rows={1}
                    disabled={isSending}
                    className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 resize-none outline-none max-h-32 leading-relaxed disabled:opacity-50"
                  />
                </div>

                <button
                  onClick={handleSend}
                  disabled={!draft.trim() || isSending}
                  aria-label="Send message"
                  className="
                    w-11 h-11 flex-shrink-0 rounded-full flex items-center justify-center
                    bg-gradient-to-br from-purple-600 to-blue-600 text-white
                    hover:from-purple-700 hover:to-blue-700
                    disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed
                    shadow-md hover:shadow-lg hover:scale-105 active:scale-95
                    transition-all duration-150
                  "
                >
                  {isSending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} className="translate-x-0.5" />
                  )}
                </button>
              </div>
              <p className="text-center text-[11px] text-gray-400 mt-2">
                Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Enter</kbd> to send ·{' '}
                <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Shift+Enter</kbd> for new line
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// ── Page shell: wraps ChatContent in Suspense (required for useSearchParams) ──

function ChatFallback() {
  return (
    <div className="flex h-[calc(100vh-57px)] items-center justify-center bg-gray-50">
      <Loader2 className="animate-spin text-purple-600" size={36} />
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatFallback />}>
      <ChatContent />
    </Suspense>
  )
}
