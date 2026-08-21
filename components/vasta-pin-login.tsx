"use client";

import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { normalizePhone, phoneIndexId, type VastaProfile } from "@/lib/vasta-chat";

type Mode = "login" | "register";

function accountEmail(phone: string) {
  return `${normalizePhone(phone).replace(/\D/g, "")}@phone.vasta.local`;
}

async function savePhoneProfile(user: User, phone: string) {
  const normalized = normalizePhone(phone);
  const ref = doc(db, "users", user.uid);
  const profile: VastaProfile = {
    uid: user.uid,
    phoneNumber: normalized,
    displayName: user.displayName || "مستخدم Vasta",
    photoURL: user.photoURL || "",
    bio: "متاح على Vasta",
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, profile, { merge: true });
  await setDoc(doc(db, "phoneIndex", phoneIndexId(normalized)), {
    uid: user.uid,
    displayName: profile.displayName,
  }, { merge: true });
}

export default function VastaPinLogin() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [mode, setMode] = useState<Mode>("login");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const normalized = normalizePhone(phone);
    const digits = normalized.replace(/\D/g, "");
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      setError("اكتب رقم الهاتف بصيغة دولية، مثل +963938754177.");
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setError("PIN يجب أن يتكون من 6 أرقام.");
      return;
    }
    if (mode === "register" && displayName.trim().length < 2) {
      setError("اكتب اسمًا من حرفين على الأقل.");
      return;
    }

    setBusy(true);
    const email = accountEmail(normalized);
    try {
      let signedIn: User;
      if (mode === "register") {
        const result = await createUserWithEmailAndPassword(auth, email, pin);
        signedIn = result.user;
        await updateProfile(signedIn, { displayName: displayName.trim() });
      } else {
        const result = await signInWithEmailAndPassword(auth, email, pin);
        signedIn = result.user;
      }
      await savePhoneProfile(signedIn, `+${digits}`);
    } catch (err: any) {
      console.error(err);
      const code = String(err?.code || "");
      if (code === "auth/email-already-in-use") {
        setError("هذا الرقم لديه حساب بالفعل. اختر الدخول بدل إنشاء حساب.");
      } else if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setError("رقم الهاتف أو PIN غير صحيح.");
      } else if (code === "auth/operation-not-allowed") {
        setError("فعّل Email/Password من Firebase Authentication أولًا.");
      } else {
        setError("تعذر تسجيل الدخول الآن. حاول مرة أخرى.");
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
        <div className="vasta-pin-subtitle">دخول مجاني برقم الهاتف + PIN</div>

        <div className="vasta-pin-tabs">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>دخول</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>إنشاء حساب</button>
        </div>

        <form onSubmit={submit} className="vasta-pin-form">
          <label>
            <span>رقم الهاتف</span>
            <input dir="ltr" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+963 938 754 177" autoComplete="tel" required />
          </label>

          {mode === "register" && <label>
            <span>الاسم</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="اسمك" autoComplete="name" required />
          </label>}

          <label>
            <span>PIN من 6 أرقام</span>
            <input dir="ltr" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••••" autoComplete={mode === "register" ? "new-password" : "current-password"} required />
          </label>

          <button type="submit" className="vasta-pin-submit" disabled={busy}>
            {busy ? "جارٍ التحقق..." : mode === "login" ? "دخول إلى Vasta" : "إنشاء حساب Vasta"}
          </button>
        </form>

        {error && <div className="vasta-pin-error">{error}</div>}
        <p className="vasta-pin-note">لا يتم إرسال SMS. رقم الهاتف هنا هو معرّف الدخول فقط، لذلك يظل رقم الهاتف الذي تستخدمه خاصًا.</p>
      </section>
    </div>
  );
}
