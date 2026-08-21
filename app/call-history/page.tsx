"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { watchPrivateCallHistory, type VastaCallHistory } from "@/lib/vasta-call-history";

export default function CallHistoryPage() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<VastaCallHistory[]>([]);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => { if (!user) return watchPrivateCallHistory(user.uid, setItems); }, [user]);

  if (!user) return <main dir="rtl" style={{ padding: 40 }}>سجّل الدخول أولًا إلى Vasta.</main>;

  return (
    <main dir="rtl" style={{ minHeight: "100vh", background: "#071316", color: "#e7f3f1", padding: 24, fontFamily: "sans-serif" }}>
      <section style={{ maxWidth: 760, margin: "40px auto", background: "#0d1d21", border: "1px solid #17353a", borderRadius: 24, padding: 24 }}>
        <div style={{ color: "#18e6ae", fontWeight: 900 }}>Vasta</div>
        <h1>سجل المكالمات</h1>
        <p style={{ color: "#88a39f" }}>مكالماتك الخاصة الصوتية والمرئية.</p>
        {items.length === 0 ? <div style={{ padding: 24, borderRadius: 18, background: "#09171a", color: "#88a39f" }}>لا توجد مكالمات مسجلة بعد.</div> : items.map((item) => (
          <div key={item.id} style={{ padding: 16, marginTop: 10, borderRadius: 16, background: "#102226", border: "1px solid #21474c", display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div><b>{item.kind === "video" ? "📹 مكالمة فيديو" : "📞 مكالمة صوتية"}</b><div style={{ color: "#88a39f", fontSize: 12 }}>إلى: {item.peerId}</div></div>
            <span>{item.status === "missed" ? "❌ فائتة" : item.status === "ended" ? "✅ انتهت" : "📲"}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
