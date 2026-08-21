"use client";

import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export function useVastaUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => onAuthStateChanged(auth, (value) => { setUser(value); setLoading(false); }), []);
  return { user, loading };
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useVastaUser();
  const [register, setRegister] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const credentials = register
        ? await createUserWithEmailAndPassword(auth, email.trim(), password)
        : await signInWithEmailAndPassword(auth, email.trim(), password);
      if (register) {
        const displayName = name.trim() || "Vasta User";
        await updateProfile(credentials.user, { displayName });
        await setDoc(doc(db, "users", credentials.user.uid), {
          uid: credentials.user.uid,
          email: credentials.user.email ?? email.trim(),
          displayName,
          username: email.trim().split("@")[0].toLowerCase(),
          online: true,
          createdAt: Date.now(),
        });
      }
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
      const map: Record<string, string> = {
        "auth/invalid-credential": "البريد أو كلمة المرور غير صحيحة.",
        "auth/email-already-in-use": "هذا البريد مستخدم بالفعل.",
        "auth/weak-password": "كلمة المرور يجب أن تكون 6 أحرف أو أكثر.",
        "auth/invalid-email": "البريد الإلكتروني غير صحيح.",
      };
      setError(map[code] ?? "حدث خطأ. تحقق من إعداد Firebase ثم حاول مرة أخرى.");
    } finally { setBusy(false); }
  }

  if (loading) return <main className="vasta-loading"><div className="logo-mark">V</div><strong>Vasta</strong><span>نجهز تجربتك...</span></main>;
  if (user) return <>{children}</>;

  return (
    <main className="auth-page">
      <div className="auth-orb orb-one" /><div className="auth-orb orb-two" />
      <section className="auth-card">
        <div className="auth-brand"><div className="logo-mark">V</div><div><div className="brand">Vasta</div><p>مراسلة أسرع. أذكى. أكثر حرية.</p></div></div>
        <div className="auth-feature-row"><span>⚡ لحظي</span><span>🔒 خاص</span><span>✨ ذكي</span></div>
        <div className="auth-tabs"><button className={register ? "active" : ""} onClick={() => setRegister(true)}>إنشاء حساب</button><button className={!register ? "active" : ""} onClick={() => setRegister(false)}>تسجيل الدخول</button></div>
        <form onSubmit={submit} className="auth-form">
          {register && <label><span>الاسم</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك" /></label>}
          <label><span>البريد الإلكتروني</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          <label><span>كلمة المرور</span><input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 أحرف أو أكثر" /></label>
          {error && <div className="error-box">{error}</div>}
          <button className="primary-button" disabled={busy}>{busy ? "جارٍ التنفيذ..." : register ? "ابدأ مع Vasta" : "دخول إلى Vasta"}</button>
        </form>
        <small>حسابك هو بوابتك إلى رسائل Vasta من أي جهاز متصل بالإنترنت.</small>
      </section>
    </main>
  );
}
