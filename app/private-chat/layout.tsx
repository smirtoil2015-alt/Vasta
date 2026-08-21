"use client";

import { Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import VastaTypingIndicator from "@/components/vasta-typing-indicator";

function PrivateChatLayoutContent({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const conversationId = params.get("conversationId") ?? "";
  return (
    <>
      {children}
      {conversationId ? (
        <div style={{ position: "fixed", right: 24, bottom: 24, zIndex: 50, background: "#0d1d21", border: "1px solid #21474c", borderRadius: 14, boxShadow: "0 12px 32px rgba(0,0,0,.28)", maxWidth: 260 }}>
          <VastaTypingIndicator conversationId={conversationId} />
        </div>
      ) : null}
    </>
  );
}

export default function PrivateChatLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <PrivateChatLayoutContent>{children}</PrivateChatLayoutContent>
    </Suspense>
  );
}
