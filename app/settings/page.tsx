"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { setPresence } from "@/lib/vasta-presence";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [showLastSeen, setShowLastSeen] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, async (next) => {
    setUser(next);
    if (!next) return;
    try {
      const snapshot = await getDoc(doc(db, "users", next.uid));
      setShowLastSeen((snapshot.data()?.showLastSeen as boolean | undefined) ?? true);
      await setPresence(next.uid, true);
    } catch (err) {
      console.error(err);
      setError("تعذر تحميل إعدادات الخصوصية.");
    }
  }), []);

  useEffect(() => {
    if (!user) return;
    const handleExit = () => { void setPresence(user.uid, false); };
    window.addEventListener("beforeunload", handleExit);
    return () => {
      window.removeEventListener("beforeunload", handleExit);
      handleExit();
    };
  }, [user]);

  async function savePrivacy(next: boolean) {
    if (!user) return;
    setShowLastSeen(next);
    setSaved(false);
    setError("");
    try {
      await setDoc(doc(db, "users", user.uid), { showLastSeen: next }, { merge: true });
      setSaved(true);
    } catch (err) {
      console.error(err);
      setError("تعذر حفظ الإعداد.");
    }
  }

  if (!user) return <main dir="rtl" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#071316", color: "#e7f3f1", fontFamily: "sans-serif" }}>سجّل الدخول أولًا إلى Vasta.</main>;

  return (
    <main dir="rtl" style={{ minHeight: "100vh", background: "#071316", color: "#e7f3f1", padding: 24, fontFamily: "sans-serif" }}>
      <section style={{ maxWidth: 720, margin: "40px auto", background: "#0d1d21", border: "1px solid #17353a", borderRadius: 24, padding: 28 }}>
        <div style={{ color: "#18e6ae", fontWeight: 900, letterSpacing: 1 }}>VASTA</div>
        <h1>الخصوصية والحضور</h1>
        <p style={{ color: "#91aaa6", lineHeight: 1.8 }}>تحكم في ظهور حالتك للطرف الآخر داخل المحادثات الخاصة.</p>
        <button onClick={() => void savePrivacy(!showLastSeen)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: 18, borderRadius: 18, border: "1px solid #21474c", background: "#102226", color: "white", cursor: "pointer" }}>
          <span><strong>إظهار آخر ظهور</strong><br /><small style={{ color: "#88a39f" }}>{showLastSeen ? "الطرف الآخر يمكنه رؤية آخر ظهورك." : "آخر ظهورك مخفي."}</small></span>
          <span style={{ fontSize: 24 }}>{showLastSeen ? "🟢" : "⚪"}</span>
        </button>
        <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: "#09171a", color: "#88a39f" }}>الحالة المباشرة: متصل الآن أثناء استخدام Vasta.</div>
        {saved && <div style={{ color: "#18e6ae", marginTop: 14 }}>تم حفظ الإعداد ✓</div>}
        {error && <div style={{ color: "#ff7784", marginTop: 14 }}>{error}</div>}
      </section>
    </main>
  );
}
