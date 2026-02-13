"use server";

import { db } from "@/db";
import { users, chats, chatMembers, messages } from "@/db/schema";
import { eq, and, desc, or, like } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createToken, setAuthCookie, removeAuthCookie, getCurrentUser } from "./auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// ============ AUTH ACTIONS ============

export async function registerAction(formData: FormData) {
  const phone = formData.get("phone") as string;
  const username = formData.get("username") as string;
  const displayName = formData.get("displayName") as string;
  const password = formData.get("password") as string;

  if (!phone || !username || !displayName || !password) {
    return { error: "All fields are required" };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { error: "Username can only contain letters, numbers, and underscores" };
  }

  // Check if user exists
  const existing = await db.select().from(users).where(
    or(eq(users.phone, phone), eq(users.username, username))
  );

  if (existing.length > 0) {
    return { error: "Phone number or username already registered" };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await db.insert(users).values({
    phone,
    username: username.toLowerCase(),
    displayName,
    passwordHash,
  }).returning();

  const user = result[0];
  const token = await createToken({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    phone: user.phone,
  });

  await setAuthCookie(token);
  redirect("/chat");
}

export async function loginAction(formData: FormData) {
  const login = formData.get("login") as string; // phone or username
  const password = formData.get("password") as string;

  if (!login || !password) {
    return { error: "All fields are required" };
  }

  const result = await db.select().from(users).where(
    or(eq(users.phone, login), eq(users.username, login.toLowerCase()))
  );

  if (result.length === 0) {
    return { error: "User not found" };
  }

  const user = result[0];
  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    return { error: "Invalid password" };
  }

  // Update online status
  await db.update(users).set({ isOnline: true, lastSeen: new Date() }).where(eq(users.id, user.id));

  const token = await createToken({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    phone: user.phone,
  });

  await setAuthCookie(token);
  redirect("/chat");
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) {
    await db.update(users).set({ isOnline: false, lastSeen: new Date() }).where(eq(users.id, user.id));
  }
  await removeAuthCookie();
  redirect("/");
}

// ============ CHAT ACTIONS ============

export async function createPrivateChat(targetUserId: number) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "Not authenticated" };

  // Check if private chat already exists between these users
  const existingChats = await db
    .select({ chatId: chatMembers.chatId })
    .from(chatMembers)
    .where(eq(chatMembers.userId, currentUser.id));

  for (const ec of existingChats) {
    const members = await db
      .select()
      .from(chatMembers)
      .where(eq(chatMembers.chatId, ec.chatId));

    const chat = await db.select().from(chats).where(
      and(eq(chats.id, ec.chatId), eq(chats.type, "private"))
    );

    if (chat.length > 0 && members.length === 2) {
      const hasTarget = members.some(m => m.userId === targetUserId);
      if (hasTarget) {
        revalidatePath("/chat");
        return { chatId: ec.chatId };
      }
    }
  }

  // Create new private chat
  const newChat = await db.insert(chats).values({
    type: "private",
    createdBy: currentUser.id,
  }).returning();

  await db.insert(chatMembers).values([
    { chatId: newChat[0].id, userId: currentUser.id, role: "member" as const },
    { chatId: newChat[0].id, userId: targetUserId, role: "member" as const },
  ]);

  revalidatePath("/chat");
  return { chatId: newChat[0].id };
}

export async function createGroupChat(name: string, memberIds: number[]) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "Not authenticated" };

  const newChat = await db.insert(chats).values({
    type: "group",
    name,
    createdBy: currentUser.id,
  }).returning();

  const allMembers = [currentUser.id, ...memberIds];
  await db.insert(chatMembers).values(
    allMembers.map((userId, i) => ({
      chatId: newChat[0].id,
      userId,
      role: (i === 0 ? "owner" : "member") as "owner" | "admin" | "member",
    }))
  );

  revalidatePath("/chat");
  return { chatId: newChat[0].id };
}

export async function sendMessage(chatId: number, text: string, replyToId?: number) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "Not authenticated" };

  if (!text.trim()) return { error: "Message cannot be empty" };

  const result = await db.insert(messages).values({
    chatId,
    senderId: currentUser.id,
    text: text.trim(),
    replyToId: replyToId || null,
  }).returning();

  revalidatePath("/chat");
  return { message: result[0] };
}

export async function editMessage(messageId: number, newText: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "Not authenticated" };

  await db.update(messages)
    .set({ text: newText, isEdited: true })
    .where(and(eq(messages.id, messageId), eq(messages.senderId, currentUser.id)));

  revalidatePath("/chat");
  return { success: true };
}

export async function deleteMessage(messageId: number) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "Not authenticated" };

  await db.update(messages)
    .set({ isDeleted: true })
    .where(and(eq(messages.id, messageId), eq(messages.senderId, currentUser.id)));

  revalidatePath("/chat");
  return { success: true };
}

// ============ DATA FETCHING ============

export async function getUserChats() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  const memberChats = await db
    .select({ chatId: chatMembers.chatId })
    .from(chatMembers)
    .where(eq(chatMembers.userId, currentUser.id));

  const chatList = [];

  for (const mc of memberChats) {
    const chat = await db.select().from(chats).where(eq(chats.id, mc.chatId));
    if (chat.length === 0) continue;

    const members = await db
      .select({
        userId: chatMembers.userId,
        role: chatMembers.role,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        isOnline: users.isOnline,
        lastSeen: users.lastSeen,
      })
      .from(chatMembers)
      .innerJoin(users, eq(chatMembers.userId, users.id))
      .where(eq(chatMembers.chatId, mc.chatId));

    const lastMsg = await db
      .select()
      .from(messages)
      .where(and(eq(messages.chatId, mc.chatId), eq(messages.isDeleted, false)))
      .orderBy(desc(messages.createdAt))
      .limit(1);

    // For private chats, get the other user's info
    let chatName = chat[0].name;
    let chatAvatar = chat[0].avatarUrl;
    let otherUserOnline = false;

    if (chat[0].type === "private") {
      const otherUser = members.find(m => m.userId !== currentUser.id);
      if (otherUser) {
        chatName = otherUser.displayName;
        chatAvatar = otherUser.avatarUrl;
        otherUserOnline = otherUser.isOnline ?? false;
      }
    }

    chatList.push({
      ...chat[0],
      name: chatName,
      avatarUrl: chatAvatar,
      members,
      lastMessage: lastMsg[0] || null,
      otherUserOnline,
    });
  }

  // Sort by last message time
  chatList.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt?.getTime() || a.createdAt?.getTime() || 0;
    const bTime = b.lastMessage?.createdAt?.getTime() || b.createdAt?.getTime() || 0;
    return bTime - aTime;
  });

  return chatList;
}

export async function getChatMessages(chatId: number) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  const msgs = await db
    .select({
      id: messages.id,
      chatId: messages.chatId,
      senderId: messages.senderId,
      text: messages.text,
      replyToId: messages.replyToId,
      isEdited: messages.isEdited,
      isDeleted: messages.isDeleted,
      createdAt: messages.createdAt,
      senderUsername: users.username,
      senderDisplayName: users.displayName,
      senderAvatar: users.avatarUrl,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.chatId, chatId))
    .orderBy(messages.createdAt);

  return msgs;
}

export async function searchUsers(query: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  if (!query.trim()) return [];

  const results = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      isOnline: users.isOnline,
    })
    .from(users)
    .where(
      and(
        or(
          like(users.username, `%${query.toLowerCase()}%`),
          like(users.displayName, `%${query}%`)
        ),
        // Exclude current user
        eq(users.id, users.id) // placeholder - we filter below
      )
    )
    .limit(20);

  return results.filter(u => u.id !== currentUser.id);
}

export async function getUserProfile() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const result = await db.select().from(users).where(eq(users.id, currentUser.id));
  if (result.length === 0) return null;

  const { passwordHash, ...profile } = result[0];
  return profile;
}

export async function updateProfile(formData: FormData) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "Not authenticated" };

  const displayName = formData.get("displayName") as string;
  const bio = formData.get("bio") as string;
  const username = formData.get("username") as string;

  if (!displayName) return { error: "Display name is required" };

  await db.update(users).set({
    displayName,
    bio: bio || "",
    username: username?.toLowerCase() || currentUser.username,
  }).where(eq(users.id, currentUser.id));

  revalidatePath("/chat");
  return { success: true };
}
