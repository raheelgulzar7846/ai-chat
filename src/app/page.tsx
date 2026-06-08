'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import styles from './page.module.css'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

type Chat = {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
}

function generateId() {
  return Math.random().toString(36).slice(2, 11)
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const activeChat = chats.find(c => c.id === activeChatId) || null

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeChat?.messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px'
    }
  }, [input])

  const createNewChat = useCallback(() => {
    const id = generateId()
    const newChat: Chat = {
      id,
      title: 'New Chat',
      messages: [],
      createdAt: new Date(),
    }
    setChats(prev => [newChat, ...prev])
    setActiveChatId(id)
    setInput('')
  }, [])

  useEffect(() => {
    createNewChat()
  }, [])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    let chatId = activeChatId
    if (!chatId) {
      const id = generateId()
      const newChat: Chat = { id, title: text.slice(0, 40), messages: [], createdAt: new Date() }
      setChats(prev => [newChat, ...prev])
      setActiveChatId(id)
      chatId = id
    }

    const userMsg: Message = { id: generateId(), role: 'user', content: text, createdAt: new Date() }

    setChats(prev => prev.map(c =>
      c.id === chatId
        ? {
            ...c,
            title: c.messages.length === 0 ? text.slice(0, 40) : c.title,
            messages: [...c.messages, userMsg]
          }
        : c
    ))
    setInput('')

    const currentMessages = (activeChat?.messages || []).concat(userMsg)
    const aiMsgId = generateId()
    const aiMsg: Message = { id: aiMsgId, role: 'assistant', content: '', createdAt: new Date() }

    setChats(prev => prev.map(c =>
      c.id === chatId ? { ...c, messages: [...c.messages, userMsg, aiMsg] } : c
    ))

    setIsStreaming(true)
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: currentMessages.map(m => ({ role: m.role, content: m.content }))
        }),
      })

      if (!res.ok) throw new Error('API error')

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              accumulated += parsed.text
              setChats(prev => prev.map(c =>
                c.id === chatId
                  ? { ...c, messages: c.messages.map(m => m.id === aiMsgId ? { ...m, content: accumulated } : m) }
                  : c
              ))
            } catch {}
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setChats(prev => prev.map(c =>
          c.id === chatId
            ? { ...c, messages: c.messages.map(m => m.id === aiMsgId ? { ...m, content: 'Error: Could not get response. Check your API key.' } : m) }
            : c
        ))
      }
    } finally {
      setIsStreaming(false)
    }
  }

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setChats(prev => prev.filter(c => c.id !== id))
    if (activeChatId === id) {
      const remaining = chats.filter(c => c.id !== id)
      setActiveChatId(remaining[0]?.id || null)
    }
  }

  const stopStreaming = () => {
    abortRef.current?.abort()
    setIsStreaming(false)
  }

  return (
    <div className={styles.app}>
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <span className={styles.logo}>✦ AI Chat</span>
          <button onClick={createNewChat} className={styles.newChatBtn} title="New chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>
        <div className={styles.chatList}>
          {chats.map(chat => (
            <div
              key={chat.id}
              className={`${styles.chatItem} ${chat.id === activeChatId ? styles.chatItemActive : ''}`}
              onClick={() => setActiveChatId(chat.id)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span className={styles.chatTitle}>{chat.title || 'New Chat'}</span>
              <button className={styles.deleteBtn} onClick={(e) => deleteChat(chat.id, e)} title="Delete">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <button className={styles.menuBtn} onClick={() => setSidebarOpen(p => !p)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18"/>
            </svg>
          </button>
          <span className={styles.headerTitle}>{activeChat?.title || 'New Chat'}</span>
          <span className={styles.modelBadge}>gemini-1.5-flash</span>
        </header>

        <div className={styles.messages}>
          {!activeChat || activeChat.messages.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>✦</div>
              <h2>What can I help you with?</h2>
              <p>Ask me anything — science, business, code, creative writing, analysis...</p>
            </div>
          ) : (
            activeChat.messages.map(msg => (
              <div key={msg.id} className={`${styles.msgRow} ${msg.role === 'user' ? styles.msgUser : styles.msgAi}`}>
                <div className={styles.msgAvatar}>
                  {msg.role === 'user' ? 'U' : '✦'}
                </div>
                <div className={styles.msgContent}>
                  <div className={styles.msgBubble}>
                    {msg.content || (isStreaming ? <span className={styles.cursor}>▋</span> : '')}
                  </div>
                  <span className={styles.msgTime}>{formatTime(msg.createdAt)}</span>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className={styles.inputArea}>
          <div className={styles.inputBox}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder="Message AI..."
              rows={1}
              className={styles.textarea}
              disabled={isStreaming}
            />
            <button
              className={`${styles.sendBtn} ${isStreaming ? styles.stopBtn : ''}`}
              onClick={isStreaming ? stopStreaming : sendMessage}
              disabled={!isStreaming && !input.trim()}
            >
              {isStreaming ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 19V5M5 12l7-7 7 7"/>
                </svg>
              )}
            </button>
          </div>
          <p className={styles.disclaimer}>AI can make mistakes. Verify important info.</p>
        </div>
      </main>
    </div>
  )
}
