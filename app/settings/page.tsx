"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { setPresence } from "@/lib/vasta-presence";
import { getNotificationPreference, requestBrowserNotificationPermission, setNotificationPreference } from "@/lib/vasta-notifications";
import { setReadReceiptsPreference, updateVastaProfile } from "@/lib/vasta-profile-settings";

const CITY_OPTIONS = [
  "دمشق","حلب","حمص","حماة","اللاذقية","طرطوس","إدلب","الرقة","دير الزور","الحسكة","درعا","السويداء",
  "إسطنبول","غازي عنتاب","أنقرة","مرسين","هاتاي","بورصة","إزمير"
];

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [city, setCity] = useState("");
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
      setCity((data.city ?? "") as string);
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
    return () => { window.removeEventListener("beforeunload", handleExit); handleExit(); };
  }, [user]);

  async function saveProfile() {
    if (!user) return;
    setSaved(false); setError("");
    try {
      await updateVastaProfile({ displayName, bio, photoURL, city });
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

  if (!user) return <main dir="rtl" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f5f7f6", color: "#15211e", fontFamily: "sans-serif" }}>سجّل الدخول أولًا إلى Vasta.</main>;

  const inputStyle: React.CSSProperties = { width:"100%", boxSizing:"border-box", padding:14, borderRadius:14, border:"1px solid #dfe6e3", background:"#fff", color:"#15211e", marginTop:8 };
  const toggleStyle: React.CSSProperties = { width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:18, borderRadius:18, border:"1px solid #e0e7e4", background:"#fff", color:"#15211e", cursor:"pointer", marginTop:10 };

  return (
    <main dir="rtl" style={{ minHeight: "100vh", background: "#f5f7f6", color: "#15211e", padding: 24, fontFamily: "sans-serif" }}>
      <section style={{ maxWidth: 720, margin: "40px auto", background: "#fff", border: "1px solid #e2e8e5", borderRadius: 24, padding: 28, boxShadow:"0 20px 70px rgba(16,35,29,.08)" }}>
        <div style={{ color: "#20bd5b", fontWeight: 900, letterSpacing: 1 }}>VASTA</div>
        <h1>الحساب والخصوصية</h1>
        <p style={{ color: "#6f7f7a", lineHeight: 1.8 }}>تحكم بملفك الشخصي وخصوصية محادثاتك. رقم الهاتف يبقى خاصًا ولا يظهر في ملفك للآخرين.</p>

        <h2 style={{ fontSize: 18, marginTop: 24 }}>الملف الشخصي</h2>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="اسم العرض" maxLength={60} style={inputStyle} />
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="نبذة قصيرة" maxLength={160} rows={3} style={{...inputStyle,resize:"vertical"}} />
        <input dir="ltr" value={photoURL} onChange={(e) => setPhotoURL(e.target.value)} placeholder="رابط صورة الملف الشخصي" maxLength={1000} style={inputStyle} />
        <label style={{display:"grid",gap:8,marginTop:12,fontSize:12,color:"#6f7f7a"}}><span>المدينة</span><select value={city} onChange={(e)=>setCity(e.target.value)} style={inputStyle}><option value="">اختر مدينتك</option>{CITY_OPTIONS.map((item)=><option key={item} value={item}>{item}</option>)}</select></label>
        <button onClick={() => void saveProfile()} style={{ width: "100%", marginTop: 10, padding: 14, border: 0, borderRadius: 14, background: "#25d366", color: "#fff", fontWeight: 900 }}>حفظ الملف الشخصي</button>

        <h2 style={{ fontSize: 18, marginTop: 28 }}>الخصوصية</h2>
        <button onClick={() => void savePrivacy(!showLastSeen)} style={toggleStyle}><span><strong>إظهار آخر ظهور</strong><br /><small style={{ color: "#6f7f7a" }}>{showLastSeen ? "الطرف الآخر يمكنه رؤية آخر ظهورك." : "آخر ظهورك مخفي."}</small></span><span style={{ fontSize: 24 }}>{showLastSeen ? "🟢" : "⚪"}</span></button>
        <button onClick={() => void saveReadReceipts(!readReceipts)} style={toggleStyle}><span><strong>إيصالات القراءة ✓✓</strong><br /><small style={{ color: "#6f7f7a" }}>{readReceipts ? "تظهر حالة قراءة الرسائل." : "إيصالات القراءة متوقفة."}</small></span><span style={{ fontSize: 24 }}>{readReceipts ? "✓✓" : "✓"}</span></button>
        <button onClick={() => void toggleNotifications()} style={toggleStyle}><span><strong>إشعارات الرسائل</strong><br /><small style={{ color: "#6f7f7a" }}>{notifications ? "إشعارات Vasta مفعّلة." : "الإشعارات متوقفة."}</small></span><span style={{ fontSize: 24 }}>{notifications ? "🔔" : "🔕"}</span></button>
        <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: "#f7f9f8", color: "#6f7f7a" }}>رقم هاتفك يُستخدم للوصول والحساب، لكنه لا يُعرض كبيانات عامة في الملف الشخصي.</div>
        {saved && <div style={{ color: "#20bd5b", marginTop: 14 }}>تم الحفظ ✓</div>}
        {error && <div style={{ color: "#d9384a", marginTop: 14 }}>{error}</div>}
      </section>
    </main>
  );
}
