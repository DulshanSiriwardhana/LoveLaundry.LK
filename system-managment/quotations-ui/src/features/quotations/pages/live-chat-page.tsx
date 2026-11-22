import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChatCircleDots,
  Robot,
  UserCircle,
  PaperPlaneTilt,
  CircleNotch,
  XCircle,
  CheckCircle,
} from '@phosphor-icons/react'
import { chatApi, type ConversationDetail, type ConversationSummary } from '../../../api/chat.service'
import { TIME_ZONE } from '../../../lib/time'

function formatTime(value?: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(d)
}

function MessageBubble({ msg }: { msg: ConversationDetail['messages'][number] }) {
  if (msg.sender === 'admin') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[var(--danger-deep)] px-4 py-2.5 text-[13px] leading-relaxed text-white">
          <p className="mb-0.5 text-[10px] font-semibold text-white/70">
            You ({msg.sender_name ?? 'Admin'})
          </p>
          <p className="whitespace-pre-line">{msg.text}</p>
          <p className="mt-1 text-[10px] text-white/60">{formatTime(msg.timestamp)}</p>
        </div>
      </div>
    )
  }
  const isBot = msg.sender === 'bot'
  return (
    <div className="flex justify-start gap-2">
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--danger-deep)]">
        {isBot ? <Robot size={15} /> : <UserCircle size={15} />}
      </div>
      <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-[var(--surface-2)] px-4 py-2.5 text-[13px] leading-relaxed text-[var(--text-primary)]">
        <p className="mb-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
          {isBot ? 'Bot' : msg.sender_name ?? 'Guest'}
        </p>
        <p className="whitespace-pre-line">{msg.text}</p>
        <p className="mt-1 text-[10px] text-[var(--text-faint)]">{formatTime(msg.timestamp)}</p>
      </div>
    </div>
  )
}

export default function LiveChatPage() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const listQuery = useQuery({
    queryKey: ['admin-chat-conversations'],
    queryFn: () => chatApi.listConversations(),
    refetchInterval: 5000,
  })

  const detailQuery = useQuery({
    queryKey: ['admin-chat-conversation', selectedId],
    queryFn: () => chatApi.getConversation(selectedId as string),
    enabled: !!selectedId,
    refetchInterval: 3000,
  })

  const conversations: ConversationSummary[] = listQuery.data ?? []
  const detail: ConversationDetail | null = detailQuery.data ?? null

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [detail?.messages.length])

  const send = async () => {
    const text = draft.trim()
    if (!text || !selectedId || sending) return
    setSending(true)
    try {
      await chatApi.sendAdminMessage(selectedId, text)
      setDraft('')
      await queryClient.invalidateQueries({ queryKey: ['admin-chat-conversation', selectedId] })
      await queryClient.invalidateQueries({ queryKey: ['admin-chat-conversations'] })
    } finally {
      setSending(false)
    }
  }

  const setStatus = async (status: string) => {
    if (!selectedId) return
    await chatApi.updateConversation(selectedId, { status })
    await queryClient.invalidateQueries({ queryKey: ['admin-chat-conversation', selectedId] })
    await queryClient.invalidateQueries({ queryKey: ['admin-chat-conversations'] })
  }

  return (
    <div className="flex h-[calc(100vh-52px)] flex-col">
      <div className="border-b border-[var(--border)] px-6 py-4">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
          <ChatCircleDots size={20} weight="fill" className="text-[var(--danger-deep)]" />
          Live Chat
        </h1>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Public website conversations. Take over a chat to answer as yourself — the bot stays
          silent once you join.
        </p>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Conversation list */}
        <div className="w-full max-w-[320px] shrink-0 overflow-y-auto border-r border-[var(--border)]">
          {listQuery.isLoading ? (
            <div className="p-4 text-[13px] text-[var(--text-faint)]">Loading conversations…</div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-[13px] text-[var(--text-faint)]">
              No conversations yet.
            </div>
          ) : (
            conversations.map((c) => {
              const active = c.conversation_id === selectedId
              return (
                <button
                  key={c.conversation_id}
                  type="button"
                  onClick={() => setSelectedId(c.conversation_id)}
                  className={`flex w-full flex-col gap-1 border-b border-[var(--border)] px-4 py-3 text-left transition-colors ${
                    active ? 'bg-[var(--surface-2)]' : 'hover:bg-[var(--surface-2)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
                      {c.guest_name || 'Website visitor'}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        c.status === 'closed'
                          ? 'bg-[var(--surface-2)] text-[var(--text-secondary)]'
                          : 'bg-[var(--success-soft)] text-[var(--success-text)]'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <p className="truncate text-[12px] text-[var(--text-secondary)]">
                    {c.last_message?.text ?? 'No messages'}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-faint)]">
                    <span>{formatTime(c.updated_at)}</span>
                    {c.assigned_admin_name && (
                      <span className="flex items-center gap-1 text-[var(--danger-deep)]">
                        <UserCircle size={12} /> {c.assigned_admin_name}
                      </span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Thread */}
        <div className="flex min-w-0 flex-1 flex-col bg-[var(--surface-2)]">
          {!detail ? (
            <div className="flex flex-1 items-center justify-center text-[13px] text-[var(--text-faint)]">
              Select a conversation to view the chat.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-[var(--border)] bg-white px-5 py-3">
                <div>
                  <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                    {detail.guest_name || 'Website visitor'}
                  </p>
                  <p className="text-[11px] text-[var(--text-faint)]">
                    {detail.assigned_admin_name
                      ? `Handled by ${detail.assigned_admin_name}`
                      : 'Bot is answering'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {detail.status !== 'closed' ? (
                    <button
                      type="button"
                      onClick={() => setStatus('closed')}
                      className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-2)]"
                    >
                      <XCircle size={14} /> Close
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setStatus('open')}
                      className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] font-medium text-[var(--success-text)] transition hover:bg-[var(--surface-2)]"
                    >
                      <CheckCircle size={14} /> Reopen
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {detail.messages.map((m) => (
                  <MessageBubble key={m.id} msg={m} />
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-[var(--border)] bg-white px-4 py-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        send()
                      }
                    }}
                    rows={1}
                    placeholder="Reply as yourself… (Enter to send)"
                    className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-[var(--border)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--danger-deep)]/40"
                  />
                  <button
                    type="button"
                    onClick={send}
                    disabled={!draft.trim() || sending}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--danger-deep)] text-white transition hover:bg-[var(--danger-deep)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {sending ? <CircleNotch size={16} className="animate-spin" /> : <PaperPlaneTilt size={16} />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
