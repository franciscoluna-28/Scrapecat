import { redirect } from "next/navigation";
import { Chat } from "@/src/_features/chat/components/Chat";
import { IS_DEMO } from "@/src/shared/constants";

export default function AppHomePage() {
  if (!IS_DEMO) {
    redirect("/app/dashboard");
  }

  return <Chat />;
}
