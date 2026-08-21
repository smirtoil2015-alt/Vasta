"use client";

export default function VastaCallActions({ conversationId, peerId }: { conversationId: string; peerId: string }) {
  return (
    <div style={{ display: "flex", gap: 8 }} data-conversation-id={conversationId} data-peer-id={peerId}>
      <a href={`/call?conversationId=${encodeURIComponent(conversationId)}&peerId=${encodeURIComponent(peerId)}&kind=audio`} aria-label="مكالمة صوتية">📞</a>
      <a href={`/call?conversationId=${encodeURIComponent(conversationId)}&peerId=${encodeURIComponent(peerId)}&kind=video`} aria-label="مكالمة فيديو">📹</a>
    </div>
  );
}
