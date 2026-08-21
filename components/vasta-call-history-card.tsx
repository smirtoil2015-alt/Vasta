"use client";

export type VastaCallHistoryItem = {
  id: string;
  displayName: string;
  kind: "audio" | "video";
  direction: "incoming" | "outgoing";
  status: "completed" | "missed" | "declined" | "failed";
  createdAt: number;
  durationMs?: number;
  conversationId: string;
  peerId: string;
};

function duration(ms = 0) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}

export default function VastaCallHistoryCard({ item, onCallBack }: { item: VastaCallHistoryItem; onCallBack: (item: VastaCallHistoryItem) => void }) {
  const icon = item.kind === "video" ? "📹" : "📞";
  const direction = item.direction === "incoming" ? "↙ واردة" : "↗ صادرة";
  const state = item.status === "missed" ? "فائتة" : item.status === "declined" ? "مرفوضة" : item.status === "failed" ? "فشلت" : "مكتملة";
  return (
    <article style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, border: "1px solid #17353a", borderRadius: 16, background: "#0d1d21" }}>
      <div style={{ width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", background: "#102a2f", fontSize: 22 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: "block" }}>{item.displayName}</b>
        <div style={{ color: "#8da7a2", fontSize: 12 }}>{direction} · {state} · {duration(item.durationMs)}</div>
        <div style={{ color: "#67847f", fontSize: 11, marginTop: 3 }}>{new Date(item.createdAt).toLocaleString("ar")}</div>
      </div>
      <button type="button" onClick={() => onCallBack(item)} style={{ border: "1px solid #21474c", background: "#12342f", color: "#18e6ae", borderRadius: 12, padding: "9px 12px", cursor: "pointer", fontWeight: 800 }}>إعادة الاتصال</button>
    </article>
  );
}
