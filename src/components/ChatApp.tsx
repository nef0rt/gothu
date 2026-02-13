"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { AuthUser } from "@/lib/auth";
import {
  sendMessage,
  getChatMessages,
  searchUsers,
  createPrivateChat,
  logoutAction,
  getUserChats,
  editMessage,
  deleteMessage,
  updateProfile,
  getUserProfile,
  createGroupChat,
} from "@/lib/actions";

interface ChatMember {
  userId: number;
  role: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isOnline: boolean | null;
  lastSeen: Date | null;
}

interface Message {
  id: number;
  chatId: number;
  senderId: number;
  text: string | null;
  replyToId: number | null;
  isEdited: boolean | null;
  isDeleted: boolean | null;
  createdAt: Date | null;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatar: string | null;
}

interface Chat {
  id: number;
  type: string;
  name: string | null;
  description: string | null;
  avatarUrl: string | null;
  createdBy: number | null;
  createdAt: Date | null;
  members: ChatMember[];
  lastMessage: {
    id: number;
    text: string | null;
    senderId: number;
    createdAt: Date | null;
  } | null;
  otherUserOnline: boolean;
}

interface SearchUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isOnline: boolean | null;
}

function Avatar({ name, size = 40, online }: { name: string; size?: number; online?: boolean }) {
  const colors = ["#5288c1", "#e17076", "#7bc862", "#e5c441", "#65aadd", "#ee7aae", "#6ec9cb", "#faa774"];
  const colorIndex = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;

  return (
    <div className="relative flex-shrink-0">
      <div
        className="rounded-full flex items-center justify-center font-medium text-white"
        style={{ width: size, height: size, background: colors[colorIndex], fontSize: size * 0.4 }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
      {online && (
        <div
          className="absolute bottom-0 right-0 rounded-full border-2"
          style={{ width: size * 0.3, height: size * 0.3, background: "var(--tg-green)", borderColor: "var(--tg-bg-primary)" }}
        />
      )}
    </div>
  );
}

function formatTime(date: Date | null) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: Date | null) {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ChatApp({ currentUser, initialChats }: { currentUser: AuthUser; initialChats: Chat[] }) {
  const [chats, setChats] = useState<Chat[]>(initialChats);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: Message } | null>(null);
  const [isPending, startTransition] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeChat = chats.find(c => c.id === activeChatId);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Poll for new messages
  useEffect(() => {
    if (!activeChatId) return;
    const interval = setInterval(async () => {
      const msgs = await getChatMessages(activeChatId);
      setMessages(msgs as Message[]);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeChatId]);

  // Poll for chat list updates
  useEffect(() => {
    const interval = setInterval(async () => {
      const updatedChats = await getUserChats();
      setChats(updatedChats as Chat[]);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Search users
  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      const results = await searchUsers(searchQuery);
      setSearchResults(results as SearchUser[]);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Close context menu on click outside
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  const openChat = useCallback(async (chatId: number) => {
    setActiveChatId(chatId);
    setShowSidebar(false);
    const msgs = await getChatMessages(chatId);
    setMessages(msgs as Message[]);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !activeChatId) return;

    if (editingMessage) {
      await editMessage(editingMessage.id, messageText);
      setEditingMessage(null);
    } else {
      await sendMessage(activeChatId, messageText, replyingTo?.id);
      setReplyingTo(null);
    }

    setMessageText("");
    const msgs = await getChatMessages(activeChatId);
    setMessages(msgs as Message[]);
    const updatedChats = await getUserChats();
    setChats(updatedChats as Chat[]);
  };

  const handleStartChat = async (userId: number) => {
    startTransition(async () => {
      const result = await createPrivateChat(userId);
      if (result.chatId) {
        setSearchQuery("");
        setIsSearching(false);
        const updatedChats = await getUserChats();
        setChats(updatedChats as Chat[]);
        openChat(result.chatId);
      }
    });
  };

  const handleContextMenu = (e: React.MouseEvent, message: Message) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, message });
  };

  return (
    <div className="h-screen flex" style={{ background: "var(--tg-bg-secondary)" }}>
      {/* Sidebar */}
      <div
        className={`${showSidebar ? "flex" : "hidden"} md:flex flex-col w-full md:w-[380px] flex-shrink-0 border-r`}
        style={{ background: "var(--tg-bg-primary)", borderColor: "var(--tg-border)" }}
      >
        {/* Sidebar Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--tg-border)" }}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-full transition-colors hover:bg-white/5"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setIsSearching(!!e.target.value); }}
              onFocus={() => setIsSearching(true)}
              className="w-full px-4 py-2 rounded-full text-sm"
              style={{ background: "var(--tg-input-bg)", color: "var(--tg-text-primary)" }}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setIsSearching(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--tg-text-secondary)" }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Hamburger Menu */}
        {showMenu && (
          <div className="absolute top-14 left-2 z-50 rounded-lg shadow-xl py-2 w-56 animate-fade-in" style={{ background: "var(--tg-bg-primary)", border: "1px solid var(--tg-border)" }}>
            <button
              onClick={() => { setShowNewGroup(true); setShowMenu(false); }}
              className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-white/5"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              New Group
            </button>
            <button
              onClick={() => { setShowProfile(true); setShowMenu(false); }}
              className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-white/5"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Profile
            </button>
            <div className="border-t my-1" style={{ borderColor: "var(--tg-border)" }} />
            <form action={logoutAction}>
              <button
                type="submit"
                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-white/5 text-red-400"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Log Out
              </button>
            </form>
          </div>
        )}

        {/* Chat List / Search Results */}
        <div className="flex-1 overflow-y-auto telegram-scrollbar">
          {isSearching ? (
            <div>
              {searchQuery && (
                <div className="px-4 py-2 text-xs font-medium" style={{ color: "var(--tg-text-secondary)" }}>
                  GLOBAL SEARCH
                </div>
              )}
              {searchResults.map(user => (
                <button
                  key={user.id}
                  onClick={() => handleStartChat(user.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
                >
                  <Avatar name={user.displayName} online={user.isOnline ?? false} />
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium" style={{ color: "var(--tg-text-primary)" }}>
                      {user.displayName}
                    </div>
                    <div className="text-xs" style={{ color: "var(--tg-text-secondary)" }}>
                      @{user.username}
                    </div>
                  </div>
                </button>
              ))}
              {searchQuery && searchResults.length === 0 && (
                <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--tg-text-secondary)" }}>
                  No users found
                </div>
              )}
            </div>
          ) : (
            <div>
              {chats.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <div className="text-4xl mb-3">💬</div>
                  <div className="text-sm" style={{ color: "var(--tg-text-secondary)" }}>
                    No chats yet. Search for users to start a conversation!
                  </div>
                </div>
              ) : (
                chats.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => openChat(chat.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                      activeChatId === chat.id ? "" : "hover:bg-white/5"
                    }`}
                    style={activeChatId === chat.id ? { background: "var(--tg-accent)" } : {}}
                  >
                    <Avatar name={chat.name || "Chat"} size={48} online={chat.otherUserOnline} />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate" style={{ color: "var(--tg-text-primary)" }}>
                          {chat.name || "Chat"}
                        </span>
                        <span className="text-xs flex-shrink-0 ml-2" style={{ color: activeChatId === chat.id ? "rgba(255,255,255,0.7)" : "var(--tg-text-secondary)" }}>
                          {formatTime(chat.lastMessage?.createdAt ?? null)}
                        </span>
                      </div>
                      <div className="text-xs truncate mt-0.5" style={{ color: activeChatId === chat.id ? "rgba(255,255,255,0.7)" : "var(--tg-text-secondary)" }}>
                        {chat.lastMessage?.text || "No messages yet"}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`${!showSidebar ? "flex" : "hidden"} md:flex flex-col flex-1`}>
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ background: "var(--tg-bg-primary)", borderColor: "var(--tg-border)" }}>
              <button
                onClick={() => setShowSidebar(true)}
                className="md:hidden p-2 rounded-full hover:bg-white/5"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <Avatar name={activeChat.name || "Chat"} size={40} online={activeChat.otherUserOnline} />
              <div className="flex-1">
                <div className="text-sm font-medium" style={{ color: "var(--tg-text-primary)" }}>
                  {activeChat.name || "Chat"}
                </div>
                <div className="text-xs" style={{ color: "var(--tg-text-secondary)" }}>
                  {activeChat.type === "private"
                    ? activeChat.otherUserOnline ? "online" : "last seen recently"
                    : `${activeChat.members.length} members`}
                </div>
              </div>
              <button className="p-2 rounded-full hover:bg-white/5">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
              <button className="p-2 rounded-full hover:bg-white/5">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto telegram-scrollbar px-4 py-4"
              style={{ background: "var(--tg-bg-chat)" }}
            >
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="text-4xl mb-3">👋</div>
                    <div className="text-sm" style={{ color: "var(--tg-text-secondary)" }}>
                      No messages yet. Say hello!
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto space-y-1">
                  {messages.map((msg, i) => {
                    const isOwn = msg.senderId === currentUser.id;
                    const showDate = i === 0 || formatDate(msg.createdAt) !== formatDate(messages[i - 1].createdAt);
                    const showAvatar = !isOwn && (i === messages.length - 1 || messages[i + 1]?.senderId !== msg.senderId);

                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="flex justify-center my-4">
                            <span className="px-3 py-1 rounded-full text-xs" style={{ background: "rgba(0,0,0,0.3)", color: "var(--tg-text-secondary)" }}>
                              {formatDate(msg.createdAt)}
                            </span>
                          </div>
                        )}
                        <div
                          className={`flex ${isOwn ? "justify-end" : "justify-start"} animate-fade-in`}
                          onContextMenu={(e) => handleContextMenu(e, msg)}
                        >
                          <div className={`flex items-end gap-2 max-w-[70%] ${isOwn ? "flex-row-reverse" : ""}`}>
                            {!isOwn && activeChat.type === "group" && (
                              <div className="w-8 h-8 flex-shrink-0">
                                {showAvatar && <Avatar name={msg.senderDisplayName} size={32} />}
                              </div>
                            )}
                            <div
                              className={`px-3 py-2 rounded-xl ${isOwn ? "rounded-br-sm" : "rounded-bl-sm"}`}
                              style={{ background: isOwn ? "var(--tg-bg-message-out)" : "var(--tg-bg-message-in)" }}
                            >
                              {!isOwn && activeChat.type === "group" && (
                                <div className="text-xs font-medium mb-1" style={{ color: "var(--tg-accent)" }}>
                                  {msg.senderDisplayName}
                                </div>
                              )}
                              {msg.replyToId && (
                                <div className="border-l-2 pl-2 mb-1 text-xs" style={{ borderColor: "var(--tg-accent)", color: "var(--tg-text-secondary)" }}>
                                  {messages.find(m => m.id === msg.replyToId)?.text?.slice(0, 50) || "..."}
                                </div>
                              )}
                              {msg.isDeleted ? (
                                <span className="text-sm italic" style={{ color: "var(--tg-text-secondary)" }}>
                                  Message deleted
                                </span>
                              ) : (
                                <div className="flex items-end gap-2">
                                  <span className="text-sm break-words" style={{ color: "var(--tg-text-primary)" }}>
                                    {msg.text}
                                  </span>
                                  <span className="text-[10px] flex-shrink-0 flex items-center gap-1" style={{ color: isOwn ? "rgba(255,255,255,0.5)" : "var(--tg-text-secondary)" }}>
                                    {msg.isEdited && "edited "}
                                    {formatTime(msg.createdAt)}
                                    {isOwn && (
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
              <div
                className="fixed z-50 rounded-lg shadow-xl py-1 w-48 animate-fade-in"
                style={{
                  left: contextMenu.x,
                  top: contextMenu.y,
                  background: "var(--tg-bg-primary)",
                  border: "1px solid var(--tg-border)",
                }}
              >
                <button
                  onClick={() => { setReplyingTo(contextMenu.message); setContextMenu(null); inputRef.current?.focus(); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 flex items-center gap-2"
                >
                  ↩️ Reply
                </button>
                {contextMenu.message.senderId === currentUser.id && !contextMenu.message.isDeleted && (
                  <>
                    <button
                      onClick={() => {
                        setEditingMessage(contextMenu.message);
                        setMessageText(contextMenu.message.text || "");
                        setContextMenu(null);
                        inputRef.current?.focus();
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 flex items-center gap-2"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={async () => {
                        await deleteMessage(contextMenu.message.id);
                        setContextMenu(null);
                        const msgs = await getChatMessages(activeChatId!);
                        setMessages(msgs as Message[]);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 flex items-center gap-2 text-red-400"
                    >
                      🗑️ Delete
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(contextMenu.message.text || "");
                    setContextMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 flex items-center gap-2"
                >
                  📋 Copy
                </button>
              </div>
            )}

            {/* Reply/Edit Bar */}
            {(replyingTo || editingMessage) && (
              <div className="flex items-center gap-3 px-4 py-2 border-t" style={{ background: "var(--tg-bg-primary)", borderColor: "var(--tg-border)" }}>
                <div className="flex-1 border-l-2 pl-3" style={{ borderColor: "var(--tg-accent)" }}>
                  <div className="text-xs font-medium" style={{ color: "var(--tg-accent)" }}>
                    {editingMessage ? "Editing" : `Reply to ${replyingTo?.senderDisplayName}`}
                  </div>
                  <div className="text-xs truncate" style={{ color: "var(--tg-text-secondary)" }}>
                    {(editingMessage || replyingTo)?.text?.slice(0, 100)}
                  </div>
                </div>
                <button
                  onClick={() => { setReplyingTo(null); setEditingMessage(null); setMessageText(""); }}
                  className="p-1 rounded-full hover:bg-white/5"
                  style={{ color: "var(--tg-text-secondary)" }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Message Input */}
            <div className="flex items-center gap-2 px-4 py-3 border-t" style={{ background: "var(--tg-bg-primary)", borderColor: "var(--tg-border)" }}>
              <button className="p-2 rounded-full hover:bg-white/5" style={{ color: "var(--tg-text-secondary)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              </button>
              <input
                ref={inputRef}
                type="text"
                placeholder="Message"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                className="flex-1 px-4 py-2 rounded-full text-sm"
                style={{ background: "var(--tg-input-bg)", color: "var(--tg-text-primary)" }}
              />
              {messageText.trim() ? (
                <button
                  onClick={handleSendMessage}
                  className="p-2 rounded-full transition-colors"
                  style={{ color: "var(--tg-accent)" }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              ) : (
                <button className="p-2 rounded-full" style={{ color: "var(--tg-text-secondary)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </button>
              )}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center" style={{ background: "var(--tg-bg-chat)" }}>
            <div className="text-center">
              <div className="w-32 h-32 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ background: "var(--tg-bg-primary)" }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--tg-text-secondary)" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-medium mb-2" style={{ color: "var(--tg-text-primary)" }}>
                Select a chat to start messaging
              </h2>
              <p className="text-sm" style={{ color: "var(--tg-text-secondary)" }}>
                Choose from your existing conversations or search for users
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Profile Modal */}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} currentUser={currentUser} />}

      {/* New Group Modal */}
      {showNewGroup && <NewGroupModal onClose={() => setShowNewGroup(false)} onCreated={(chatId) => { setShowNewGroup(false); openChat(chatId); }} />}

      {/* Click overlay to close menu */}
      {showMenu && <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />}
    </div>
  );
}

function ProfileModal({ onClose, currentUser }: { onClose: () => void; currentUser: AuthUser }) {
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [bio, setBio] = useState("");
  const [username, setUsername] = useState(currentUser.username);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getUserProfile().then(profile => {
      if (profile) {
        setDisplayName(profile.displayName);
        setBio(profile.bio || "");
        setUsername(profile.username);
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const formData = new FormData();
    formData.set("displayName", displayName);
    formData.set("bio", bio);
    formData.set("username", username);
    const result = await updateProfile(formData);
    setSaving(false);
    if (result.success) {
      setMessage("Profile updated!");
      setTimeout(() => setMessage(""), 2000);
    } else if (result.error) {
      setMessage(result.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl p-6 animate-fade-in"
        style={{ background: "var(--tg-bg-primary)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium">Edit Profile</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/5" style={{ color: "var(--tg-text-secondary)" }}>✕</button>
        </div>

        <div className="flex justify-center mb-6">
          <Avatar name={displayName} size={80} />
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--tg-text-secondary)" }}>Display Name</label>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg text-sm"
              style={{ background: "var(--tg-input-bg)", color: "var(--tg-text-primary)", border: "1px solid var(--tg-border)" }}
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--tg-text-secondary)" }}>Username</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg text-sm"
              style={{ background: "var(--tg-input-bg)", color: "var(--tg-text-primary)", border: "1px solid var(--tg-border)" }}
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--tg-text-secondary)" }}>Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg text-sm resize-none"
              style={{ background: "var(--tg-input-bg)", color: "var(--tg-text-primary)", border: "1px solid var(--tg-border)" }}
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--tg-text-secondary)" }}>Phone</label>
            <input
              value={currentUser.phone}
              disabled
              className="w-full px-4 py-2.5 rounded-lg text-sm opacity-50"
              style={{ background: "var(--tg-input-bg)", color: "var(--tg-text-primary)", border: "1px solid var(--tg-border)" }}
            />
          </div>
        </div>

        {message && (
          <div className="mt-3 text-sm text-center" style={{ color: message.includes("updated") ? "var(--tg-green)" : "#e17076" }}>
            {message}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-6 py-2.5 rounded-lg font-medium text-white text-sm transition-colors disabled:opacity-50"
          style={{ background: "var(--tg-accent)" }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function NewGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: (chatId: number) => void }) {
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<SearchUser[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (!searchQuery.trim()) { setSearchResults([]); return; }
      const results = await searchUsers(searchQuery);
      setSearchResults(results as SearchUser[]);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const toggleUser = (user: SearchUser) => {
    setSelectedUsers(prev =>
      prev.find(u => u.id === user.id)
        ? prev.filter(u => u.id !== user.id)
        : [...prev, user]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    setCreating(true);
    const result = await createGroupChat(groupName, selectedUsers.map(u => u.id));
    setCreating(false);
    if (result.chatId) {
      onCreated(result.chatId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl p-6 animate-fade-in max-h-[80vh] flex flex-col"
        style={{ background: "var(--tg-bg-primary)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">New Group</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/5" style={{ color: "var(--tg-text-secondary)" }}>✕</button>
        </div>

        <input
          value={groupName}
          onChange={e => setGroupName(e.target.value)}
          placeholder="Group name"
          className="w-full px-4 py-2.5 rounded-lg text-sm mb-4"
          style={{ background: "var(--tg-input-bg)", color: "var(--tg-text-primary)", border: "1px solid var(--tg-border)" }}
        />

        {selectedUsers.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedUsers.map(user => (
              <span
                key={user.id}
                className="flex items-center gap-1 px-3 py-1 rounded-full text-xs"
                style={{ background: "var(--tg-accent)", color: "white" }}
              >
                {user.displayName}
                <button onClick={() => toggleUser(user)} className="ml-1">✕</button>
              </span>
            ))}
          </div>
        )}

        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search users to add..."
          className="w-full px-4 py-2.5 rounded-lg text-sm mb-3"
          style={{ background: "var(--tg-input-bg)", color: "var(--tg-text-primary)", border: "1px solid var(--tg-border)" }}
        />

        <div className="flex-1 overflow-y-auto telegram-scrollbar mb-4">
          {searchResults.map(user => (
            <button
              key={user.id}
              onClick={() => toggleUser(user)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-white/5"
            >
              <Avatar name={user.displayName} size={36} />
              <div className="flex-1 text-left">
                <div className="text-sm" style={{ color: "var(--tg-text-primary)" }}>{user.displayName}</div>
                <div className="text-xs" style={{ color: "var(--tg-text-secondary)" }}>@{user.username}</div>
              </div>
              {selectedUsers.find(u => u.id === user.id) && (
                <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "var(--tg-accent)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={handleCreate}
          disabled={creating || !groupName.trim() || selectedUsers.length === 0}
          className="w-full py-2.5 rounded-lg font-medium text-white text-sm transition-colors disabled:opacity-50"
          style={{ background: "var(--tg-accent)" }}
        >
          {creating ? "Creating..." : `Create Group (${selectedUsers.length} members)`}
        </button>
      </div>
    </div>
  );
}
