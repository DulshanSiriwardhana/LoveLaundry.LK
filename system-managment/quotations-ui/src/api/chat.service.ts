import api from './api'

export interface ChatMessage {
  id: string
  sender: 'guest' | 'bot' | 'admin'
  text: string
  sender_name?: string | null
  timestamp: string
}

export interface ConversationSummary {
  conversation_id: string
  guest_id: string | null
  guest_name: string | null
  assigned_admin_name: string | null
  status: string
  message_count: number
  last_message: ChatMessage | null
  created_at: string
  updated_at: string
}

export interface ConversationDetail {
  conversation_id: string
  guest_id: string | null
  guest_name: string | null
  assigned_admin_name: string | null
  status: string
  messages: ChatMessage[]
  created_at: string
  updated_at: string
}

export const chatApi = {
  listConversations: (status?: string) =>
    api
      .get<ConversationSummary[]>('/chat/admin/conversations', {
        params: status ? { status } : {},
      })
      .then((r) => r.data),

  getConversation: (id: string) =>
    api.get<ConversationDetail>(`/chat/admin/conversations/${id}`).then((r) => r.data),

  sendAdminMessage: (id: string, text: string) =>
    api
      .post<ConversationDetail>(`/chat/admin/conversations/${id}/messages`, { text })
      .then((r) => r.data),

  updateConversation: (
    id: string,
    body: { status?: string; guest_name?: string; assigned_admin_name?: string },
  ) =>
    api.patch<ConversationDetail>(`/chat/admin/conversations/${id}`, body).then((r) => r.data),
}
