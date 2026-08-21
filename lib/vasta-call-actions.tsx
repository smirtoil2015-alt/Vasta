"use client";

import { useRouter } from "next/navigation";

export default function VastaCallActions({ conversationId, peerId }: { conversationId: string; peerId: string }) {
  const router = useRouter();
  function open(kind: "audio" | "video") {
    const query = new URLSearchParams({ conversationId, peerId, kind });
    router.push(`/call?${query.toString()}`);
  }
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button type="button" onClick={() => open("audio")} aria-label="مكالمة صوتية" title="مكالمة صوتية" style={{ border: "1px solid #21474c", background: "#102226", color: "white", borderRadius: 12, padding: "8px 10px", cursor: "pointer" }}>📞</button>
      <button type="button" onClick={() => open("video")} aria-label="مكالمة فيديو" title="مكالمة فيديو" style={{ border: "1px solid #21474c", background: "#102226", color: "white", borderRadius: 12, padding: "8px 10px", cursor: "pointer" }}>📹</button>
    </div>
  );
}
