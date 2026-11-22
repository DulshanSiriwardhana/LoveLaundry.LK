import { useState, useRef, useEffect, useCallback } from "react";
import {
    RiChat1Line,
    RiCloseLine,
    RiSendPlaneFill,
    RiRobot2Line,
    RiUser3Line,
} from "react-icons/ri";
import { useLanguage } from "../i18n";
import {
    getChatIds,
    sendGuestMessage,
    fetchConversation,
    type ServerMessage,
} from "../lib/chatApi";

interface LocalMessage {
    id: string;
    text: string;
    sender: "guest" | "bot" | "admin";
    senderName?: string | null;
}

const ChatWidget = () => {
    const { t, lang } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<LocalMessage[]>([]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [assignedAdmin, setAssignedAdmin] = useState<string | null>(null);
    const [sendError, setSendError] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Ensure a conversation exists for this visitor.
    useEffect(() => {
        getChatIds();
    }, []);

    // Poll the conversation for admin replies / takeover status while open.
    useEffect(() => {
        if (!isOpen) return;
        const { conversationId, guestId } = getChatIds();
        let active = true;
        const poll = async () => {
            try {
                const state = await fetchConversation(conversationId, guestId);
                if (!active) return;
                setMessages(
                    state.messages.map((m: ServerMessage) => ({
                        id: m.id,
                        text: m.text,
                        sender: m.sender,
                        senderName: m.sender_name ?? undefined,
                    })),
                );
                setAssignedAdmin(state.assigned_admin_name);
            } catch {
                // Keep whatever we have; ignore transient network errors.
            }
        };
        poll();
        const interval = setInterval(poll, 4000);
        return () => {
            active = false;
            clearInterval(interval);
        };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setIsOpen(false);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen]);

    const sendMessage = useCallback(
        async (text: string, draft = text) => {
            const trimmed = text.trim();
            if (!trimmed || isTyping) return;

            const { conversationId, guestId } = getChatIds();
            const optimistic: LocalMessage = {
                id: crypto.randomUUID(),
                text: trimmed,
                sender: "guest",
            };
            setMessages((prev) => [...prev, optimistic]);
            setInput("");
            setSendError("");
            setIsTyping(true);

            try {
                const state = await sendGuestMessage(
                    conversationId,
                    guestId,
                    trimmed,
                    lang,
                );
                setMessages(
                    state.messages.map((m: ServerMessage) => ({
                        id: m.id,
                        text: m.text,
                        sender: m.sender,
                        senderName: m.sender_name ?? undefined,
                    })),
                );
                setAssignedAdmin(state.assigned_admin_name);
            } catch (err) {
                setMessages((prev) => prev.filter((message) => message.id !== optimistic.id));
                setInput(draft);
                setSendError(err instanceof Error ? err.message : t("chatSendFailed"));
            } finally {
                setIsTyping(false);
            }
        },
        [isTyping, lang, t],
    );

    const handleQuickReply = (label: string, value: string) => {
        setInput(label);
        sendMessage(value, label);
    };

    const renderMessage = (msg: LocalMessage) => {
        if (msg.sender === "guest") {
            return (
                <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[80%] whitespace-pre-line rounded-2xl rounded-br-md bg-[#C1121F] px-4 py-3 text-[13px] leading-relaxed text-white">
                        {msg.text}
                    </div>
                </div>
            );
        }
        const isAdmin = msg.sender === "admin";
        return (
            <div key={msg.id} className="flex justify-start">
                <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F9E7E9] text-[#C1121F]">
                    {isAdmin ? <RiUser3Line className="h-3.5 w-3.5" /> : <RiRobot2Line className="h-3.5 w-3.5" />}
                </div>
                <div className="max-w-[80%] whitespace-pre-line rounded-2xl rounded-bl-md bg-[#F5F5F5] px-4 py-3 text-[13px] leading-relaxed text-[#000000]">
                    <p className="mb-0.5 text-[10px] font-semibold text-[#737373]">
                        {isAdmin ? `Admin ${msg.senderName ?? ""}`.trim() : "Love Laundry Bot"}
                    </p>
                    {msg.text}
                </div>
            </div>
        );
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-label={isOpen ? t("chatClose") : t("chatOpen")}
                aria-expanded={isOpen}
                aria-controls="love-laundry-chat"
                className="
                    fixed
                    bottom-6
                    right-6
                    z-[9999]
                    flex
                    h-14
                    w-14
                    items-center
                    justify-center
                    rounded-full
                    bg-[#C1121F]
                    text-white
                    shadow-[0_8px_28px_rgba(193, 18, 31, 0.4)]
                    transition-all
                    duration-300
                    hover:-translate-y-1
                    hover:bg-[#C1121F]
                    hover:shadow-[0_12px_36px_rgba(193, 18, 31, 0.5)]
                    sm:bottom-8
                    sm:right-8
                    sm:h-16
                    sm:w-16
                    md:bottom-10
                    md:right-10
                    md:h-[68px]
                    md:w-[68px]
                "
            >
                {isOpen ? (
                    <RiCloseLine className="h-6 w-6 sm:h-7 sm:w-7" />
                ) : (
                    <RiChat1Line className="h-6 w-6 sm:h-7 sm:w-7" />
                )}
                {!isOpen && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-40" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
                    </span>
                )}
            </button>

            {isOpen && (
                <div
                    id="love-laundry-chat"
                    role="dialog"
                    aria-labelledby="love-laundry-chat-title"
                    className="
                        fixed
                        bottom-24
                        right-4
                        z-[9998]
                        flex
                        w-[calc(100%-32px)]
                        max-w-[400px]
                        flex-col
                        overflow-hidden
                        rounded-2xl
                        border
                        border-[#E5E5E5]
                        bg-white
                        shadow-[0_24px_64px_rgba(0, 0, 0, 0.15)]
                        sm:bottom-28
                        sm:right-6
                        md:bottom-32
                        md:right-10
                    "
                    style={{
                        height: "min(520px, calc(100vh - 160px))",
                        maxHeight: "calc(100dvh - 160px)",
                    }}
                >
                    <div className="flex items-center gap-3 bg-[#C1121F] px-5 py-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                            {assignedAdmin ? (
                                <RiUser3Line className="h-5 w-5 text-white" />
                            ) : (
                                <RiRobot2Line className="h-5 w-5 text-white" />
                            )}
                        </div>
                        <div className="flex-1">
                            <div
                                id="love-laundry-chat-title"
                                className="text-sm font-bold text-white"
                            >
                                {t("chatTitle")}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-white/80">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                                {assignedAdmin
                                    ? `Chatting with ${assignedAdmin}`
                                    : t("chatOnline")}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            aria-label={t("chatClose")}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                        >
                            <RiCloseLine className="h-5 w-5" />
                        </button>
                    </div>

                    {assignedAdmin && (
                        <div className="bg-[#F9E7E9] px-5 py-2 text-center text-[11px] font-medium text-[#C1121F]">
                            You're now chatting with {assignedAdmin} from Love Laundry.
                        </div>
                    )}

                    <div
                        className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
                        role="log"
                        aria-label={t("chatConversation")}
                    >
                        {messages.length === 0 ? (
                            <div className="flex justify-start">
                                <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F9E7E9] text-[#C1121F]">
                                    <RiRobot2Line className="h-3.5 w-3.5" />
                                </div>
                                <div className="max-w-[80%] whitespace-pre-line rounded-2xl rounded-bl-md bg-[#F5F5F5] px-4 py-3 text-[13px] leading-relaxed text-[#000000]">
                                    {t("chatWelcome")}
                                </div>
                            </div>
                        ) : (
                            messages.map(renderMessage)
                        )}

                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F9E7E9] text-[#C1121F]">
                                    <RiRobot2Line className="h-3.5 w-3.5" />
                                </div>
                                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-[#F5F5F5] px-4 py-3">
                                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#737373]" style={{ animationDelay: "0ms" }} />
                                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#737373]" style={{ animationDelay: "150ms" }} />
                                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#737373]" style={{ animationDelay: "300ms" }} />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {sendError && (
                        <p role="alert" className="border-t border-[#E5E5E5] px-4 py-2 text-xs text-[#C1121F]">
                            {sendError}
                        </p>
                    )}

                    <div className="flex gap-2 overflow-x-auto border-t border-[#E5E5E5] px-4 py-2.5">
                        {[
                            { value: "Services", label: t("chatQuickServices") },
                            { value: "Pricing", label: t("chatQuickPricing") },
                            { value: "Locations", label: t("chatQuickLocations") },
                            { value: "Hours", label: t("chatQuickHours") },
                        ].map(({ value, label }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => handleQuickReply(label, value)}
                                disabled={isTyping}
                                className="
                                    shrink-0
                                    rounded-full
                                    border
                                    border-[#E5E5E5]
                                    bg-white
                                    px-3
                                    py-1.5
                                    text-[11px]
                                    font-semibold
                                    text-[#404040]
                                    transition-all
                                    duration-200
                                    hover:border-[#C1121F]/30
                                    hover:bg-[#F9E7E9]
                                    hover:text-[#C1121F]
                                    disabled:cursor-not-allowed
                                    disabled:opacity-50
                                "
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <form
                        className="flex items-center gap-2 border-t border-[#E5E5E5] px-4 py-3"
                        onSubmit={(event) => {
                            event.preventDefault();
                            sendMessage(input);
                        }}
                    >
                        <input
                            ref={inputRef}
                            aria-label={t("chatPlaceholder")}
                            type="text"
                            disabled={isTyping}
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                                setSendError("");
                            }}
                            placeholder={t("chatPlaceholder")}
                            className="
                                flex-1
                                rounded-full
                                border
                                border-[#E5E5E5]
                                bg-white
                                px-4
                                py-2.5
                                text-[13px]
                                text-[#000000]
                                placeholder-[#A3A3A3]
                                outline-none
                                transition-colors
                                duration-200
                                focus:border-[#C1121F]/40
                                focus:bg-white
                            "
                        />
                        <button
                            type="submit"
                            aria-label={t("chatSend")}
                            disabled={!input.trim() || isTyping}
                            className="
                                flex
                                h-10
                                w-10
                                shrink-0
                                items-center
                                justify-center
                                rounded-full
                                bg-[#C1121F]
                                text-white
                                shadow-[0_4px_12px_rgba(193, 18, 31, 0.25)]
                                transition-all
                                duration-200
                                hover:bg-[#C1121F]
                                disabled:cursor-not-allowed
                                disabled:opacity-40
                            "
                        >
                            <RiSendPlaneFill className="h-4 w-4" />
                        </button>
                    </form>

                    <div className="border-t border-[#E5E5E5] px-4 py-2 text-center text-[10px] text-[#A3A3A3]">
                        {t("chatPowered")}
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatWidget;
