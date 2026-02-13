import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import AuthPage from "@/components/AuthPage";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/chat");

  return <AuthPage />;
}
