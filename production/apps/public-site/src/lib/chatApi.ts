/**
 * Public chatbot client.
 *
 * Conversations are persisted in the quotation-service so that admins can see
 * and take over public chats. The widget sends guest messages there; the
 * service asks lovelaundry-bot for a reply (unless an admin has taken over),
 * and the widget polls the conversation to learn who it is talking to.
 *
 * `VITE_CHAT_API_URL` must be set to the quotation-service base URL
 * (e.g. https://your-quotation-service.vercel.app). There is no same-origin
 * fallback: vercel.json only rewrites /api/*, and the public bot service does
 * not expose /chat/conversations, so a missing value is reported rather than
 * sending requests to a URL that cannot answer them.
 */
const CONFIGURED_BASE = (import.meta.env.VITE_CHAT_API_URL as string | undefined)?.trim()

function apiBase(): string {
    if (!CONFIGURED_BASE) {
        throw new Error(
            "Chat is unavailable: VITE_CHAT_API_URL is not configured. Set it to the quotation-service URL that serves /chat/conversations.",
        )
    }
    return CONFIGURED_BASE.replace(/\/+$/, "")
}

export interface ServerMessage {
    id: string
    sender: "guest" | "bot" | "admin"
    text: string
    sender_name?: string | null
    timestamp: string
}

export interface ConversationState {
    conversation_id: string
    messages: ServerMessage[]
    assigned_admin_name: string | null
}

function ids(): { conversationId: string; guestId: string } {
    let conversationId = localStorage.getItem("ll_chat_conversation_id")
    let guestId = localStorage.getItem("ll_chat_guest_id")
    if (!conversationId) {
        conversationId = crypto.randomUUID()
        localStorage.setItem("ll_chat_conversation_id", conversationId)
    }
    if (!guestId) {
        guestId = crypto.randomUUID()
        localStorage.setItem("ll_chat_guest_id", guestId)
    }
    return { conversationId, guestId }
}

export function getChatIds(): { conversationId: string; guestId: string } {
    return ids()
}

async function postJson(url: string, body: unknown): Promise<ConversationState> {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Chat API error: ${res.status}`)
    return (await res.json()) as ConversationState
}

async function getJson(url: string): Promise<ConversationState> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Chat API error: ${res.status}`)
    return (await res.json()) as ConversationState
}

export async function sendGuestMessage(
    conversationId: string,
    guestId: string,
    message: string,
    lang: "en" | "sin",
): Promise<ConversationState> {
    const base = apiBase()
    const url = `${base}/chat/conversations/${conversationId}/messages`
    return postJson(url, { message, guest_id: guestId, lang })
}

export async function fetchConversation(
    conversationId: string,
    guestId: string,
): Promise<ConversationState> {
    const base = apiBase()
    const url = `${base}/chat/conversations/${conversationId}?guest_id=${encodeURIComponent(guestId)}`
    return getJson(url)
}
