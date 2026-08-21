"use client";

import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { VastaProfile } from "@/lib/vasta-chat";

type Mode = "login" | "register";

async function saveEmailProfile(user: User) {
  const ref = doc(db, "users", user.uid);
  const profile: VastaProfile = {
    uid: user.uid,
    phoneNumber: user.phoneNumber || "",
    displayName: user.displayName || "مستخدم Vasta",
    photoURL: user.photoURL || "",
    bio: "متاح على Vasta",
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, profile, { merge: true });
}

export default function VastaPinLogin() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError("اكتب بريدًا إلكترونيًا صحيحًا.");
      return;
    }
    if (password.length < 6) {
      setError("كلمة المرور يجب أن تتكون من 6 أحرف أو أرقام على الأقل.");
      return;
    }
    if (mode === "register" && displayName.trim().length < 2) {
      setError("اكتب اسمًا من حرفين على الأقل.");
      return;
    }

    setBusy(true);
    try {
      let signedIn: User;
      if (mode === "register") {
        const result = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        signedIn = result.user;
        await updateProfile(signedIn, { displayName: displayName.trim() });
      } else {
        const result = await signInWithEmailAndPassword(auth, normalizedEmail, password);
        signedIn = result.user;
      }
      await saveEmailProfile(signedIn);
    } catch (err: any) {
      console.error(err);
      const code = String(err?.code || "");
      if (code === "auth/email-already-in-use") {
        setError("هذا البريد مستخدم بالفعل. اختر تسجيل الدخول.");
      } else if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setError("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
      } else if (code === "auth/operation-not-allowed") {
        setError("فعّل تسجيل الدخول بالبريد وكلمة المرور من Firebase Authentication.");
      } else if (code === "auth/weak-password") {
        setError("كلمة المرور ضعيفة. استخدم 6 أحرف أو أرقام على الأقل.");
      } else {
        setError("تعذر تسجيل الدخول الآن. حاول مرة أخرى.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setError("");
    setMessage("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError("اكتب بريدك الإلكتروني أولًا لإرسال رابط استعادة كلمة المرور.");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setMessage("تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني.");
    } catch (err: any) {
      console.error(err);
      const code = String(err?.code || "");
      if (code === "auth/user-not-found") {
        setError("لا يوجد حساب بهذا البريد الإلكتروني.");
      } else {
        setError("تعذر إرسال رابط استعادة كلمة المرور. حاول مرة أخرى.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vasta-pin-login-wrap">
      <section className="vasta-pin-card">
        <div className="vasta-pin-logo">V</div>
        <div className="vasta-pin-brand">Vasta</div>
        <div className="vasta-pin-subtitle">تسجيل دخول آمن بالبريد الإلكتروني</div>

        <div className="vasta-pin-tabs">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); setMessage(""); }}>دخول</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); setMessage(""); }}>إنشاء حساب</button>
        </div>

        <form onSubmit={submit} className="vasta-pin-form">
          {mode === "register" && (
            <label>
              <span>الاسم</span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="اسمك" autoComplete="name" required />
            </label>
          )}

          <label>
            <span>البريد الإلكتروني</span>
            <input dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" required />
          </label>

          <label>
            <span>كلمة المرور</span>
            <input dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === "register" ? "new-password" : "current-password"} required />
          </label>

          <button type="submit" className="vasta-pin-submit" disabled={busy}>
            {busy ? "جارٍ التحقق..." : mode === "login" ? "دخول إلى Vasta" : "إنشاء حساب Vasta"}
          </button>
        </form>

        {mode === "login" && (
          <button type="button" className="vasta-pin-back" onClick={resetPassword} disabled={busy}>
            نسيت كلمة المرور؟
          </button>
        )}

        {error && <div className="vasta-pin-error">{error}</div>}
        {message && <div className="vasta-pin-note">{message}</div>}
        <p className="vasta-pin-note">لا نحتاج إلى رقم هاتف أو SMS لتسجيل الدخول إلى Vasta.</p>
      </section>
    </div>
  );
}
