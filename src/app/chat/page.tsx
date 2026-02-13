import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUserChats } from "@/lib/actions";
import ChatApp from "@/components/ChatApp";

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const chats = await getUserChats();

  return <ChatApp currentUser={user} initialChats={chats} />;
}
