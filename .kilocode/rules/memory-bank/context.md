# Active Context: RoviGram Messenger

## Current State

**App Status**: ✅ RoviGram messenger built and deployed

RoviGram is a Telegram-like messaging application built with Next.js 16, featuring authentication, real-time chat, user search, group chats, and a dark Telegram-inspired UI.

## Recently Completed

- [x] Database schema (users, chats, chat_members, messages)
- [x] Authentication system (register, login, logout with JWT + cookies)
- [x] Chat system (private chats, group chats)
- [x] Messaging (send, edit, delete, reply)
- [x] User search functionality
- [x] Profile editing
- [x] Telegram-style dark theme UI
- [x] Responsive design (mobile sidebar toggle)
- [x] Polling-based message updates (3s for messages, 5s for chat list)

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/page.tsx` | Landing/Auth page | ✅ Ready |
| `src/app/chat/page.tsx` | Main chat interface | ✅ Ready |
| `src/app/layout.tsx` | Root layout | ✅ Ready |
| `src/components/AuthPage.tsx` | Login/Register form | ✅ Ready |
| `src/components/ChatApp.tsx` | Main chat UI (sidebar + messages) | ✅ Ready |
| `src/lib/auth.ts` | JWT auth utilities | ✅ Ready |
| `src/lib/actions.ts` | Server actions (all CRUD) | ✅ Ready |
| `src/db/schema.ts` | Database schema | ✅ Ready |
| `src/db/index.ts` | Database client | ✅ Ready |
| `src/db/migrate.ts` | Migration script | ✅ Ready |

## Features

- **Auth**: Register with phone/username/password, login, logout
- **Private Chats**: Start 1-on-1 conversations by searching users
- **Group Chats**: Create groups with multiple members
- **Messages**: Send, edit, delete, reply to messages
- **User Search**: Find users by username or display name
- **Profile**: Edit display name, username, bio
- **Online Status**: Shows online/offline indicators
- **Context Menu**: Right-click messages for reply/edit/delete/copy
- **Responsive**: Mobile-friendly with sidebar toggle

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
| 2026-02-13 | Built complete RoviGram messenger app |
