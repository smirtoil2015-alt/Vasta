"use client";

import { useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { normalizePhone, phoneIndexId, type VastaProfile } from "@/lib/vasta-chat";

type Step = "phone" | "code";

async function savePhoneProfile(user: User, phone: string) {
  const normalized = normalizePhone(phone);
  const profile: VastaProfile = {
    uid: user.uid,
    phoneNumber: normalized,
    displayName: user.displayName || "مستخدم Vasta",
    photoURL: user.photoURL || "",
    bio: "متاح على Vasta",
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, "users", user.uid), profile, { merge: true });
  await setDoc(doc(db, "phoneIndex", phoneIndexId(normalized)), {
    uid: user.uid,
    displayName: profile.displayName,
  }, { merge: true });
}

export default function VastaPinLogin() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  if (user) return null;

  function getRecaptcha() {
    if (recaptchaRef.current) return recaptchaRef.current;
    recaptchaRef.current = new RecaptchaVerifier(auth, "vasta-recaptcha", {
      size: "invisible",
      callback: () => undefined,
      "expired-callback": () => {
        recaptchaRef.current?.clear();
        recaptchaRef.current = null;
      },
    });
    return recaptchaRef.current;
  }

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const normalized = normalizePhone(phone);
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      setError("اكتب رقم الهاتف بصيغة دولية، مثل +963938754177.");
      return;
    }

    setBusy(true);
    try {
      const appVerifier = getRecaptcha();
      confirmationRef.current = await signInWithPhoneNumber(auth, normalized, appVerifier);
      setStep("code");
    } catch (err: any) {
      console.error(err);
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      const code = String(err?.code || "");
      if (code === "auth/invalid-phone-number") {
        setError("رقم الهاتف غير صحيح.");
      } else if (code === "auth/too-many-requests") {
        setError("تمت محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.");
      } else if (code === "auth/operation-not-allowed") {
        setError("فعّل تسجيل الدخول برقم الهاتف من Firebase Authentication.");
      } else if (code === "auth/unauthorized-domain") {
        setError("أضف نطاق Vasta إلى Authorized domains في Firebase.");
      } else {
        setError("تعذر إرسال رمز SMS الآن. حاول مرة أخرى.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(code)) {
      setError("أدخل رمز التحقق المكوّن من 6 أرقام.");
      return;
    }
    if (!confirmationRef.current) {
      setError("انتهت جلسة التحقق. اطلب رمزًا جديدًا.");
      setStep("phone");
      return;
    }

    setBusy(true);
    try {
      const result = await confirmationRef.current.confirm(code);
      await savePhoneProfile(result.user, normalizePhone(phone));
    } catch (err: any) {
      console.error(err);
      const firebaseCode = String(err?.code || "");
      if (firebaseCode === "auth/invalid-verification-code") {
        setError("رمز التحقق غير صحيح.");
      } else if (firebaseCode === "auth/code-expired") {
        setError("انتهت صلاحية الرمز. اطلب رمزًا جديدًا.");
      } else {
        setError("تعذر التحقق من الرمز. حاول مرة أخرى.");
      }
    } finally {
      setBusy(false);
    }
  }

  function backToPhone() {
    confirmationRef.current = null;
    setCode("");
    setError("");
    setStep("phone");
  }

  return (
    <div className="vasta-pin-login-wrap">
      <section className="vasta-pin-card">
        <div className="vasta-pin-logo">V</div>
        <div className="vasta-pin-brand">Vasta</div>
        <div className="vasta-pin-subtitle">دخول مجاني برقم الهاتف</div>

        {step === "phone" ? (
          <form onSubmit={sendCode} className="vasta-pin-form">
            <label>
              <span>رقم الهاتف</span>
              <input
                dir="ltr"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+963 938 754 177"
                autoComplete="tel"
                required
              />
            </label>
            <button type="submit" className="vasta-pin-submit" disabled={busy}>
              {busy ? "جارٍ إرسال الرمز..." : "متابعة عبر SMS"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="vasta-pin-form">
            <label>
              <span>رمز التحقق</span>
              <input
                dir="ltr"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                autoComplete="one-time-code"
                required
              />
            </label>
            <button type="submit" className="vasta-pin-submit" disabled={busy}>
              {busy ? "جارٍ التحقق..." : "تأكيد الرمز"}
            </button>
            <button type="button" className="vasta-pin-back" onClick={backToPhone} disabled={busy}>
              تغيير رقم الهاتف
            </button>
          </form>
        )}

        {error && <div className="vasta-pin-error">{error}</div>}
        <p className="vasta-pin-note">سيتم إرسال رمز تحقق SMS إلى رقم هاتفك. لن نعرض رقم هاتفك للمستخدمين الآخرين.</p>
        <div id="vasta-recaptcha" />
      </section>
    </div>
  );
}
