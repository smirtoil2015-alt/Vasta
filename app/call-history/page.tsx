"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { watchPrivateCallHistory, type VastaCallHistory } from "@/lib/vasta-call-history";

function asDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: unknown) {
  const date = asDate(value);
  return date ? date.toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" }) : "الآن";
}

function duration(value?: number) {
  const seconds = Math.max(0, Math.floor(value ?? 0));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function statusText(item: VastaCallHistory, uid: string) {
  if (item.status === "missed") return "❌ فائتة";
  if (item.status === "answered") return uid === item.initiatorId ? "✅ تم الرد" : "✅ تم الرد عليها";
  if (item.status === "ended") return "✅ انتهت";
  return "📲 جارية";
}

export default function CallHistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<VastaCallHistory[]>([]);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (!user) return;
    return watchPrivateCallHistory(user.uid, setItems);
  }, [user]);

  const title = useMemo(() => `${items.length} مكالمة`, [items.length]);

  if (!user) return <main dir="rtl" style={{ padding: 40 }}>سجّل الدخول أولًا إلى Vasta.</main>;

  return (
    <main dir="rtl" style={{ minHeight: "100vh", background: "#071316", color: "#e7f3f1", padding: 24, fontFamily: "sans-serif" }}>
      <section style={{ maxWidth: 820, margin: "40px auto", background: "#0d1d21", border: "1px solid #17353a", borderRadius: 24, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div><div style={{ color: "#18e6ae", fontWeight: 900 }}>Vasta</div><h1 style={{ margin: "6px 0" }}>سجل المكالمات</h1><p style={{ margin: 0, color: "#88a39f" }}>{title} • مكالماتك الخاصة</p></div>
          <button onClick={() => router.push("/private-chat")} style={{ border: 0, borderRadius: 12, padding: "10px 14px", background: "#18e6ae", fontWeight: 800 }}>محادثة خاصة</button>
        </div>

        {items.length === 0 ? <div style={{ marginTop: 20, padding: 28, borderRadius: 18, background: "#09171a", color: "#88a39f", textAlign: "center" }}>لا توجد مكالمات مسجلة بعد.</div> : items.map((item) => {
          const outgoing = item.initiatorId === user.uid;
          const peerLabel = item.peerId || "مستخدم Vasta";
          return (
            <div key={item.id} style={{ padding: 16, marginTop: 12, borderRadius: 18, background: "#102226", border: "1px solid #21474c", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <b>{item.kind === "video" ? "📹 مكالمة فيديو" : "📞 مكالمة صوتية"}</b>
                  <span style={{ color: "#88a39f", fontSize: 12 }}>{outgoing ? "📤 صادرة" : "📥 واردة"}</span>
                </div>
                <div style={{ color: "#88a39f", fontSize: 13, marginTop: 5 }}>{outgoing ? "إلى" : "من"}: {peerLabel}</div>
                <div style={{ color: "#6f8985", fontSize: 12, marginTop: 5 }}>{formatDate(item.startedAt)} • {statusText(item, user.uid)} • {duration(item.durationSec)}</div>
              </div>
              <button onClick={() => router.push(`/call?conversationId=${encodeURIComponent(item.conversationId)}&peerId=${encodeURIComponent(item.peerId)}&kind=${item.kind}`)} style={{ border: "1px solid #18e6ae", borderRadius: 12, padding: "9px 12px", background: "transparent", color: "#18e6ae", fontWeight: 800, whiteSpace: "nowrap" }}>
                {item.kind === "video" ? "📹 إعادة الاتصال" : "📞 إعادة الاتصال"}
              </button>
            </div>
          );
        })}
      </section>
    </main>
  );
}
