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

type Feature = {
  icon: string;
  title: string;
  text: string;
};

const features: Feature[] = [
  { icon: "⚡", title: "Vasta Pulse", text: "مراسلة لحظية مصممة للسرعة والوضوح." },
  { icon: "🧠", title: "Vasta AI", text: "مساعد داخل المحادثة بدل فتح تطبيق آخر." },
  { icon: "✨", title: "Vasta Spaces", text: "مجموعات ومساحات أوسع من مجرد دردشة جماعية." },
  { icon: "🔒", title: "Vasta Privacy", text: "قواعد وصول قوية من الخادم قبل أي ميزات إضافية." },
];

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

  function resetPhoneFlow() {
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
            <div><div className="brand">Vasta</div><p>المراسلة التي لا تريد أن تكون نسخة من أحد.</p></div>
          </div>

          <div className="hero-copy">
            <span className="eyebrow">NEXT-GEN MESSAGING</span>
            <h1>{step === "phone" ? "دخولك يبدأ من رقمك" : "تحقق من رقمك"}</h1>
            <p>{step === "phone" ? "سيرسل Vasta رمزًا لمرة واحدة عبر SMS." : `أرسلنا رمز التحقق إلى ${phone}.`}</p>
          </div>

          {step === "phone" ? (
            <form className="auth-form" onSubmit={sendCode}>
              <label><span>رقم الهاتف</span><input dir="ltr" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 5XX XXX XX XX" autoComplete="tel" required /></label>
              <button id="send-code" className="primary-button" disabled={busy}>{busy ? "جارٍ إرسال الرمز..." : "متابعة عبر SMS"}</button>
              <div id="recaptcha-container" />
            </form>
          ) : (
            <form className="auth-form" onSubmit={verifyCode}>
              <label><span>رمز التحقق</span><input dir="ltr" className="otp-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="••••••" required /></label>
              <button className="primary-button" disabled={busy}>{busy ? "جارٍ التحقق..." : "دخول إلى Vasta"}</button>
              <button type="button" className="secondary-button" onClick={resetPhoneFlow}>تغيير رقم الهاتف</button>
            </form>
          )}

          {error && <div className="error-box">{error}</div>}
          <div className="auth-benefits"><span>⚡ لحظي</span><span>🧠 ذكي</span><span>🔒 خاص</span></div>
          <p className="auth-note">قد تطبق شركة الاتصالات رسوم SMS. رقم الهاتف يستخدم لتسجيل الدخول والتحقق من الحساب.</p>

          <div className="feature-strip">
            {features.map((feature) => (
              <div key={feature.title} className="mini-feature">
                <span className="mini-icon">{feature.icon}</span>
                <div><strong>{feature.title}</strong><span>{feature.text}</span></div>
              </div>
            ))}
          </div>
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
          <div className="feature-card"><div className="feature-icon">✦</div><div><strong>Vasta AI</strong><span>مساعد ذكي داخل المحادثة — قريبًا.</span></div><span className="soon-badge">SOON</span></div>
          <div className="chat-list">
            <div className="empty-chats">
              <div className="welcome-logo">V</div>
              <strong>مرحبًا بك في الجيل التالي</strong>
              <span>تم الدخول برقم <b dir="ltr">{user.phoneNumber}</b>.</span>
              <small>الخطوة التالية: جهات الاتصال والمحادثات الفورية.</small>
            </div>
          </div>
          <footer className="sidebar-footer"><div className="profile-mini"><div className="avatar small">V</div><div><strong>حساب Vasta</strong><span dir="ltr">{user.phoneNumber}</span></div></div><button className="logout-button" onClick={() => void signOut(auth)}>خروج</button></footer>
        </aside>
        <section className="conversation welcome-conversation">
          <div className="welcome-panel">
            <div className="welcome-logo large">V</div>
            <span className="eyebrow">VASTA // THE NEXT WAVE</span>
            <h1>أنت داخل Vasta الآن.</h1>
            <p>هذه ليست نهاية تسجيل الدخول؛ إنها نقطة انطلاق لبناء منصة مراسلة جديدة، بميزات تتوسع من الرسائل إلى الذكاء والمجتمعات والملفات والمكالمات.</p>
            <div className="feature-grid">
              {features.map((feature) => (
                <div key={feature.title}><b>{feature.icon} {feature.title}</b><span>{feature.text}</span></div>
              ))}
            </div>
            <div className="vision-banner"><span>🚀</span><div><strong>نحن لا نبني نسخة من واتساب.</strong><p>نبني هوية Vasta ونضيف ميزات تجعل استخدامه مختلفًا.</p></div></div>
          </div>
        </section>
      </section>
    </main>
  );
}
