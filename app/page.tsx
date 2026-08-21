"use client";

import { useEffect, useRef, useState } from "react";
import {
  ConfirmationResult,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  ensureProfile,
  findProfileByPhone,
  normalizePhone,
  openConversation,
  sendTextMessage,
  watchConversations,
  watchMessages,
  type VastaConversation,
  type VastaMessage,
  type VastaProfile,
} from "@/lib/vasta-chat";

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

const features = [
  { icon: "⚡", title: "Vasta Pulse", text: "رسائل لحظية وتجربة محادثة سريعة." },
  { icon: "🧠", title: "Vasta", text: "المساعد الذكي داخل التطبيق نفسه." },
  { icon: "✨", title: "Vasta Spaces", text: "مجموعات ومساحات متقدمة." },
  { icon: "🔒", title: "Vasta Privacy", text: "أمان وصلاحيات على مستوى الخادم." },
];

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "V";
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<VastaProfile | null>(null);
  const [booting, setBooting] = useState(true);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirmation = useRef<ConfirmationResult | null>(null);

  const [conversations, setConversations] = useState<VastaConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<VastaConversation | null>(null);
  const [messages, setMessages] = useState<VastaMessage[]>([]);
  const [text, setText] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contact, setContact] = useState<VastaProfile | null>(null);
  const [searching, setSearching] = useState(false);
  const [appError, setAppError] = useState("");

  useEffect(() => onAuthStateChanged(auth, async (next) => {
    setUser(next);
    setBooting(false);
    if (!next) {
      setProfile(null);
      setConversations([]);
      setActiveConversation(null);
      return;
    }
    try {
      setProfile(await ensureProfile(next));
    } catch (err) {
      console.error(err);
      setAppError("تعذر تجهيز حساب Vasta. تحقق من اتصال Firebase.");
    }
  }), []);

  useEffect(() => {
    if (!user) return;
    return watchConversations(user.uid, setConversations, () => {
      setAppError("تعذر تحديث المحادثات. قد يطلب Firebase إنشاء فهرس للمحادثات.");
    });
  }, [user]);

  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      return;
    }
    return watchMessages(activeConversation.id, setMessages, () => {
      setAppError("تعذر تحديث الرسائل الآن.");
    });
  }, [activeConversation]);

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
    const normalized = normalizePhone(phone);
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
      setError("تعذر إرسال رمز التحقق. فعّل Phone Authentication واضبط نطاق الموقع في Firebase.");
      window.recaptchaVerifier?.clear();
      window.recaptchaVerifier = undefined;
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!confirmation.current || !/^\d{6}$/.test(code)) {
      setError("أدخل رمز التحقق المكوّن من 6 أرقام.");
      return;
    }
    setBusy(true);
    try {
      await confirmation.current.confirm(code);
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

  async function searchContact() {
    if (!profile) return;
    const normalized = normalizePhone(contactPhone);
    if (!normalized) return;
    setSearching(true);
    setContact(null);
    try {
      const found = await findProfileByPhone(normalized);
      if (!found || found.uid === profile.uid) {
        setAppError("لم نجد مستخدم Vasta بهذا الرقم.");
      } else {
        setContact(found);
      }
    } catch (err) {
      console.error(err);
      setAppError("تعذر البحث عن المستخدم.");
    } finally {
      setSearching(false);
    }
  }

  async function startConversation() {
    if (!profile || !contact) return;
    try {
      const conversation = await openConversation(profile, contact);
      if (conversation) setActiveConversation(conversation);
      setContact(null);
      setContactPhone("");
    } catch (err) {
      console.error(err);
      setAppError("تعذر إنشاء المحادثة. تحقق من قواعد Firestore.");
    }
  }

  async function sendMessage() {
    if (!profile || !activeConversation || !text.trim()) return;
    try {
      await sendTextMessage(activeConversation.id, profile, text);
      setText("");
    } catch (err) {
      console.error(err);
      setAppError("تعذر إرسال الرسالة.");
    }
  }

  function conversationName(item: VastaConversation) {
    if (!profile) return "محادثة";
    const otherId = item.participants.find((id) => id !== profile.uid) ?? profile.uid;
    return item.names[otherId] ?? "محادثة";
  }

  if (booting) {
    return <main className="vasta-loading"><div className="logo-mark">V</div><strong>Vasta</strong><span>نجهز تجربتك...</span></main>;
  }

  if (!user) {
    return (
      <main className="auth-page">
        <div className="auth-glow glow-one" />
        <div className="auth-glow glow-two" />
        <section className="auth-card">
          <div className="auth-topline"><div className="logo-mark">V</div><div><div className="brand">Vasta</div><p>المراسلة التي لا تريد أن تكون نسخة من أحد.</p></div></div>
          <div className="hero-copy"><span className="eyebrow">NEXT-GEN MESSAGING</span><h1>{step === "phone" ? "دخولك يبدأ من رقمك" : "تحقق من رقمك"}</h1><p>{step === "phone" ? "سيرسل Vasta رمزًا لمرة واحدة عبر SMS." : `أرسلنا رمز التحقق إلى ${phone}.`}</p></div>
          {step === "phone" ? (
            <form className="auth-form" onSubmit={sendCode}><label><span>رقم الهاتف</span><input dir="ltr" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 5XX XXX XX XX" autoComplete="tel" required /></label><button id="send-code" className="primary-button" disabled={busy}>{busy ? "جارٍ إرسال الرمز..." : "متابعة عبر SMS"}</button><div id="recaptcha-container" /></form>
          ) : (
            <form className="auth-form" onSubmit={verifyCode}><label><span>رمز التحقق</span><input dir="ltr" className="otp-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="••••••" required /></label><button className="primary-button" disabled={busy}>{busy ? "جارٍ التحقق..." : "دخول إلى Vasta"}</button><button type="button" className="secondary-button" onClick={resetPhoneFlow}>تغيير رقم الهاتف</button></form>
          )}
          {error && <div className="error-box">{error}</div>}
          <div className="auth-benefits"><span>⚡ لحظي</span><span>🧠 Vasta ذكي</span><span>🔒 خاص</span></div>
          <div className="feature-strip">{features.map((feature) => <div key={feature.title} className="mini-feature"><span className="mini-icon">{feature.icon}</span><div><strong>{feature.title}</strong><span>{feature.text}</span></div></div>)}</div>
        </section>
      </main>
    );
  }

  return (
    <main className="vasta-shell">
      <section className="app-frame">
        <aside className="sidebar">
          <header className="sidebar-head"><div><div className="brand">Vasta</div><div className="brand-subtitle">مراسلة الجيل التالي</div></div><button className="icon-button">⋮</button></header>
          <div className="contact-search"><div className="search-wrap"><span>⌕</span><input dir="ltr" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void searchContact()} placeholder="+90 رقم الهاتف" /></div><button className="search-button" onClick={() => void searchContact()}>{searching ? "بحث..." : "العثور على مستخدم"}</button></div>
          {contact && <button className="contact-result" onClick={() => void startConversation()}><div className="avatar">{initials(contact.displayName)}</div><div><strong>{contact.displayName}</strong><span dir="ltr">{contact.phoneNumber}</span></div><b>＋</b></button>}
          <div className="feature-card"><div className="feature-icon">✦</div><div><strong>Vasta</strong><span>المساعد الذكي داخل المحادثة.</span></div><span className="soon-badge">SOON</span></div>
          <div className="chat-list">{conversations.length === 0 ? <div className="empty-chats"><div className="welcome-logo">V</div><strong>ابدأ أول محادثة</strong><span>ابحث عن رقم هاتف لفتح محادثة.</span></div> : conversations.map((item) => <button key={item.id} className={`chat-item ${activeConversation?.id === item.id ? "active" : ""}`} onClick={() => setActiveConversation(item)}><div className="avatar">{initials(conversationName(item))}</div><div className="chat-copy"><div className="chat-title-row"><strong>{conversationName(item)}</strong><time>{new Date(item.lastMessageAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</time></div><div className="chat-message">{item.lastMessage}</div></div></button>)}</div>
          <footer className="sidebar-footer"><div className="profile-mini"><div className="avatar small">{initials(profile?.displayName ?? "V")}</div><div><strong>{profile?.displayName ?? "حساب Vasta"}</strong><span dir="ltr">{user.phoneNumber}</span></div></div><button className="logout-button" onClick={() => void signOut(auth)}>خروج</button></footer>
        </aside>

        <section className="conversation">
          {activeConversation ? (
            <>
              <header className="conversation-head"><div className="conversation-user"><div className="avatar">{initials(conversationName(activeConversation))}</div><div><strong>{conversationName(activeConversation)}</strong><span>محادثة Vasta عبر الإنترنت</span></div></div><div className="conversation-actions"><button className="icon-button">⌕</button><button className="icon-button">⋯</button></div></header>
              <div className="messages-area"><div className="secure-note">🔒 اتصال Vasta محفوظ بحسابك</div>{messages.length === 0 && <div className="conversation-empty">ابدأ أول رسالة 👋</div>}{messages.map((item) => <div key={item.id} className={`message ${item.senderId === user.uid ? "sent" : "received"}`}><span>{item.text}</span><time>{new Date(item.createdAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</time></div>)}</div>
              <div className="composer"><button className="attach" aria-label="مرفق">＋</button><input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void sendMessage()} placeholder="اكتب رسالة إلى Vasta..." /><button className="send" onClick={() => void sendMessage()} aria-label="إرسال">➤</button></div>
            </>
          ) : (
            <div className="welcome-panel"><div className="welcome-logo large">V</div><span className="eyebrow">VASTA // THE NEXT WAVE</span><h1>مرحبًا بك في Vasta.</h1><p>الآن لديك دخول برقم الهاتف، وطبقة محادثات لحظية عبر الإنترنت. ابحث عن شخص برقمه وابدأ أول رسالة حقيقية.</p><div className="feature-grid">{features.map((feature) => <div key={feature.title}><b>{feature.icon} {feature.title}</b><span>{feature.text}</span></div>)}</div><div className="vision-banner"><span>🚀</span><div><strong>Vasta لا ينسخ واتساب.</strong><p>نبني تجربة مختلفة ثم نضيف الميزات التي تجعلها أقوى.</p></div></div></div>
          )}
        </section>
      </section>
      {appError && <button className="toast" onClick={() => setAppError("")}>{appError}</button>}
    </main>
  );
}
