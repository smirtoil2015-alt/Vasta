"use client";

import { useRouter } from "next/navigation";

export default function VastaCallActions({ conversationId, peerId }: { conversationId: string; peerId: string }) {
  const router = useRouter();
  const open = (kind: "audio" | "video") => {
    const query = new URLSearchParams({ conversationId, peerId, kind });
    router.push(`/call?${query.toString()}`);
  };
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button type="button" onClick={() => open("audio")} aria-label="مكالمة صوتية" title="مكالمة صوتية">📞</button>
      <button type="button" onClick={() => open("video")} aria-label="مكالمة فيديو" title="مكالمة فيديو">📹</button>
    </div>
  );
}
