"use client";

import { useEffect, useRef, useState } from "react";
import {
  ConfirmationResult,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirmation = useRef<ConfirmationResult | null>(null);

  useEffect(() => onAuthStateChanged(auth, (next) => {
    setUser(next);
    setBooting(false);
  }), []);

  function setupRecaptcha() {
    if (window.recaptchaVerifier) return window.recaptchaVerifier;
    window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
      callback: () => undefined,
    });
    return window.recaptchaVerifier;
  }

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const normalized = phone.trim().replace(/\s+/g, "");
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      setError("اكتب رقم الهاتف بالصيغة الدولية، مثل +90xxxxxxxxxx.");
      return;
    }

    setBusy(true);
    try {
      confirmation.current = await signInWithPhoneNumber(auth, normalized, setupRecaptcha());
      setPhone(normalized);
      setStep("code");
    } catch (err) {
      console.error(err);
      setError("تعذر إرسال رمز التحقق. تأكد من تفعيل Phone Authentication وإعداد نطاق الموقع في Firebase.");
      window.recaptchaVerifier?.clear();
      window.recaptchaVerifier = undefined;
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!confirmation.current || !/^\d{6}$/.test(code.trim())) {
      setError("أدخل رمز التحقق المكوّن من 6 أرقام.");
      return;
    }

    setBusy(true);
    try {
      await confirmation.current.confirm(code.trim());
    } catch (err) {
      console.error(err);
      setError("رمز التحقق غير صحيح أو انتهت صلاحيته.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setCode("");
    setStep("phone");
    setError("");
    confirmation.current = null;
    window.recaptchaVerifier?.clear();
    window.recaptchaVerifier = undefined;
  }

  if (booting) {
    return <main className="vasta-loading"><div className="logo-mark">V</div><strong>Vasta</strong><span>نجهز حسابك...</span></main>;
  }

  if (!user) {
    return (
      <main className="auth-page">
        <div className="auth-glow glow-one" />
        <div className="auth-glow glow-two" />
        <section className="auth-card">
          <div className="auth-topline">
            <div className="logo-mark">V</div>
            <div><div className="brand">Vasta</div><p>مراسلة حديثة، سريعة، ومتصلة دائمًا.</p></div>
          </div>

          <div className="hero-copy">
            <span className="eyebrow">NEXT-GEN MESSAGING</span>
            <h1>{step === "phone" ? "أدخل رقم هاتفك" : "تحقق من رقمك"}</h1>
            <p>{step === "phone" ? "سيرسل Vasta رمزًا لمرة واحدة عبر SMS لتسجيل الدخول." : `أرسلنا رمز التحقق إلى ${phone}.`}</p>
          </div>

          {step === "phone" ? (
            <form className="auth-form" onSubmit={sendCode}>
              <label><span>رقم الهاتف</span><input dir="ltr" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 5XX XXX XX XX" autoComplete="tel" required /></label>
              <button className="primary-button" disabled={busy}>{busy ? "جارٍ إرسال الرمز..." : "إرسال رمز التحقق"}</button>
              <div id="recaptcha-container" />
            </form>
          ) : (
            <form className="auth-form" onSubmit={verifyCode}>
              <label><span>رمز التحقق</span><input dir="ltr" className="otp-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="••••••" required /></label>
              <button className="primary-button" disabled={busy}>{busy ? "جارٍ التحقق..." : "تأكيد الرقم"}</button>
              <button type="button" className="secondary-button" onClick={() => void resend()}>تغيير رقم الهاتف</button>
            </form>
          )}

          {error && <div className="error-box">{error}</div>}
          <div className="auth-benefits"><span>⚡ سريع</span><span>🔒 آمن</span><span>🌍 عالمي</span></div>
          <small>باستخدام رقم الهاتف، قد تتلقى رسالة SMS للتحقق وقد تطبق رسوم شركة الاتصالات.</small>
        </section>
      </main>
    );
  }

  return (
    <main className="vasta-shell">
      <section className="app-frame">
        <aside className="sidebar">
          <header className="sidebar-head"><div><div className="brand">Vasta</div><div className="brand-subtitle">مستقبلك في المراسلة</div></div><button className="icon-button">⋮</button></header>
          <div className="search-wrap"><span>⌕</span><input placeholder="البحث عن محادثة أو جهة اتصال" /></div>
          <div className="feature-card"><div className="feature-icon">✦</div><div><strong>Vasta AI قريبًا</strong><span>مساعد ذكي داخل محادثاتك.</span></div></div>
          <div className="chat-list"><div className="empty-chats"><div className="welcome-logo">V</div><strong>مرحبًا بك في Vasta</strong><span>تم تسجيل دخولك برقم <b dir="ltr">{user.phoneNumber}</b>.</span><small>سنضيف جهات الاتصال والمحادثات والمجموعات في المرحلة التالية.</small></div></div>
          <footer className="sidebar-footer"><div className="profile-mini"><div className="avatar small">V</div><div><strong>حساب Vasta</strong><span dir="ltr">{user.phoneNumber}</span></div></div><button className="logout-button" onClick={() => void signOut(auth)}>خروج</button></footer>
        </aside>
        <section className="conversation welcome-conversation">
          <div className="welcome-panel"><div className="welcome-logo large">V</div><span className="eyebrow">WELCOME TO VASTA</span><h1>أنت داخل Vasta الآن ✨</h1><p>تسجيل الدخول برقم الهاتف أصبح جاهزًا. الخطوة التالية هي بناء جهات الاتصال، المحادثات الفورية، الصور والملفات، ثم المكالمات والميزات الذكية.</p><div className="feature-grid"><div><b>⚡ لحظي</b><span>رسائل عبر الإنترنت مباشرة.</span></div><div><b>🔒 خاص</b><span>قواعد وصول محكمة عبر Firebase.</span></div><div><b>🧠 ذكي</b><span>ذكاء اصطناعي داخل التجربة.</span></div><div><b>🎨 شخصي</b><span>ثيمات وملفات شخصية وتخصيص.</span></div></div></div>
        </section>
      </section>
    </main>
  );
}
