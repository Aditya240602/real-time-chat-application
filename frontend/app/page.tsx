import { ChatProvider } from "@/context/chat-context"
import { AppShell } from "@/components/app-shell"

export default function Page() {
  return (
    <ChatProvider>
      <AppShell />
    </ChatProvider>
  )
}
