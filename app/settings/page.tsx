"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { setPresence } from "@/lib/vasta-presence";
import { getNotificationPreference, requestBrowserNotificationPermission, setNotificationPreference } from "@/lib/vasta-notifications";
import { setReadReceiptsPreference, updateVastaProfile } from "@/lib/vasta-profile-settings";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [showLastSeen, setShowLastSeen] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, async (next) => {
    setUser(next);
    if (!next) return;
    try {
      const snapshot = await getDoc(doc(db, "users", next.uid));
      const data = snapshot.data() ?? {};
      setDisplayName((next.displayName ?? data.displayName ?? "مستخدم Vasta") as string);
      setBio((data.bio ?? "") as string);
      setPhotoURL((next.photoURL ?? data.photoURL ?? "") as string);
      setShowLastSeen((data.showLastSeen as boolean | undefined) ?? true);
      const privacy = await getDoc(doc(db, "users", next.uid, "settings", "privacy"));
      setReadReceipts((privacy.data()?.readReceipts as boolean | undefined) ?? true);
      setNotifications(await getNotificationPreference(next.uid));
      await setPresence(next.uid, true);
    } catch (err) {
      console.error(err);
      setError("تعذر تحميل إعدادات Vasta.");
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

  async function saveProfile() {
    if (!user) return;
    setSaved(false); setError("");
    try {
      await updateVastaProfile({ displayName, bio, photoURL });
      setSaved(true);
    } catch (err) { console.error(err); setError("تعذر حفظ الملف الشخصي."); }
  }

  async function savePrivacy(next: boolean) {
    if (!user) return;
    setShowLastSeen(next); setSaved(false); setError("");
    try {
      await (await import("firebase/firestore")).setDoc(doc(db, "users", user.uid), { showLastSeen: next }, { merge: true });
      setSaved(true);
    } catch (err) { console.error(err); setError("تعذر حفظ الإعداد."); }
  }

  async function saveReadReceipts(next: boolean) {
    if (!user) return;
    setReadReceipts(next); setSaved(false); setError("");
    try { await setReadReceiptsPreference(user.uid, next); setSaved(true); }
    catch (err) { console.error(err); setError("تعذر حفظ خصوصية القراءة."); }
  }

  async function toggleNotifications() {
    if (!user) return;
    const next = !notifications;
    setSaved(false); setError("");
    try {
      if (next) {
        const permission = await requestBrowserNotificationPermission();
        if (permission !== "granted") throw new Error("permission");
      }
      await setNotificationPreference(user.uid, next);
      setNotifications(next); setSaved(true);
    } catch (err) {
      console.error(err);
      setError(next ? "اسمح بإشعارات المتصفح أولًا." : "تعذر حفظ إعداد الإشعارات.");
    }
  }

  if (!user) return <main dir="rtl" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#071316", color: "#e7f3f1", fontFamily: "sans-serif" }}>سجّل الدخول أولًا إلى Vasta.</main>;

  return (
    <main dir="rtl" style={{ minHeight: "100vh", background: "#071316", color: "#e7f3f1", padding: 24, fontFamily: "sans-serif" }}>
      <section style={{ maxWidth: 720, margin: "40px auto", background: "#0d1d21", border: "1px solid #17353a", borderRadius: 24, padding: 28 }}>
        <div style={{ color: "#18e6ae", fontWeight: 900, letterSpacing: 1 }}>VASTA</div>
        <h1>الحساب والخصوصية</h1>
        <p style={{ color: "#91aaa6", lineHeight: 1.8 }}>تحكم بملفك الشخصي وخصوصية محادثاتك.</p>

        <h2 style={{ fontSize: 18, marginTop: 24 }}>الملف الشخصي</h2>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="اسم العرض" maxLength={60} style={{ width: "100%", boxSizing: "border-box", padding: 14, borderRadius: 14, border: "1px solid #21474c", background: "#09171a", color: "white", marginTop: 8 }} />
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="نبذة قصيرة" maxLength={160} rows={3} style={{ width: "100%", boxSizing: "border-box", padding: 14, borderRadius: 14, border: "1px solid #21474c", background: "#09171a", color: "white", marginTop: 8, resize: "vertical" }} />
        <input dir="ltr" value={photoURL} onChange={(e) => setPhotoURL(e.target.value)} placeholder="رابط صورة الملف الشخصي" maxLength={1000} style={{ width: "100%", boxSizing: "border-box", padding: 14, borderRadius: 14, border: "1px solid #21474c", background: "#09171a", color: "white", marginTop: 8 }} />
        <button onClick={() => void saveProfile()} style={{ width: "100%", marginTop: 10, padding: 14, border: 0, borderRadius: 14, background: "#18e6ae", color: "#062019", fontWeight: 900 }}>حفظ الملف الشخصي</button>

        <h2 style={{ fontSize: 18, marginTop: 28 }}>الخصوصية</h2>
        <button onClick={() => void savePrivacy(!showLastSeen)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: 18, borderRadius: 18, border: "1px solid #21474c", background: "#102226", color: "white", cursor: "pointer", marginTop: 10 }}>
          <span><strong>إظهار آخر ظهور</strong><br /><small style={{ color: "#88a39f" }}>{showLastSeen ? "الطرف الآخر يمكنه رؤية آخر ظهورك." : "آخر ظهورك مخفي."}</small></span><span style={{ fontSize: 24 }}>{showLastSeen ? "🟢" : "⚪"}</span>
        </button>
        <button onClick={() => void saveReadReceipts(!readReceipts)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: 18, borderRadius: 18, border: "1px solid #21474c", background: "#102226", color: "white", cursor: "pointer", marginTop: 10 }}>
          <span><strong>إيصالات القراءة ✓✓</strong><br /><small style={{ color: "#88a39f" }}>{readReceipts ? "تظهر حالة قراءة الرسائل." : "إيصالات القراءة متوقفة."}</small></span><span style={{ fontSize: 24 }}>{readReceipts ? "✓✓" : "✓"}</span>
        </button>
        <button onClick={() => void toggleNotifications()} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: 18, borderRadius: 18, border: "1px solid #21474c", background: "#102226", color: "white", cursor: "pointer", marginTop: 10 }}>
          <span><strong>إشعارات الرسائل</strong><br /><small style={{ color: "#88a39f" }}>{notifications ? "إشعارات Vasta مفعّلة." : "الإشعارات متوقفة."}</small></span><span style={{ fontSize: 24 }}>{notifications ? "🔔" : "🔕"}</span>
        </button>
        <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: "#09171a", color: "#88a39f" }}>الحالة المباشرة: متصل الآن أثناء استخدام Vasta.</div>
        {saved && <div style={{ color: "#18e6ae", marginTop: 14 }}>تم الحفظ ✓</div>}
        {error && <div style={{ color: "#ff7784", marginTop: 14 }}>{error}</div>}
      </section>
    </main>
  );
}
