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
  markMessageRead,
  normalizePhone,
  openConversation,
  sendTextMessage,
  sendVoiceMessage,
  setTyping,
  watchConversations,
  watchMessages,
  watchReadReceipts,
  watchTyping,
  type VastaConversation,
  type VastaMessage,
  type VastaProfile,
} from "@/lib/vasta-chat";
import { chooseVoiceMimeType, uploadVoiceBlob } from "@/lib/vasta-voice";

declare global { interface Window { recaptchaVerifier?: RecaptchaVerifier; } }

const features = [
  { icon: "⚡", title: "Vasta Pulse", text: "رسائل لحظية وتجربة محادثة سريعة." },
  { icon: "👥", title: "Vasta Spaces", text: "مجموعات ومساحات متقدمة." },
  { icon: "🔒", title: "Vasta Privacy", text: "أمان وصلاحيات على مستوى الخادم." },
];

function initials(name: string) { return name.trim().slice(0, 1).toUpperCase() || "V"; }
function formatDuration(ms: number) { const total = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(total / 60).toString().padStart(2,"0")}:${(total % 60).toString().padStart(2,"0")}`; }

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
  const [typingUid, setTypingUid] = useState<string | null>(null);
  const [readBy, setReadBy] = useState<string[]>([]);
  const [appError, setAppError] = useState("");

  const [recording, setRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState("");
  const [voiceMimeType, setVoiceMimeType] = useState("");
  const [voiceBusy, setVoiceBusy] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const voiceStartedAt = useRef(0);
  const voiceTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => onAuthStateChanged(auth, async (next) => {
    setUser(next); setBooting(false);
    if (!next) { setProfile(null); setConversations([]); setActiveConversation(null); return; }
    try { setProfile(await ensureProfile(next)); }
    catch (err) { console.error(err); setAppError("تعذر تجهيز حساب Vasta. تحقق من اتصال Firebase."); }
  }), []);

  useEffect(() => { if (!user) return; return watchConversations(user.uid, setConversations, () => setAppError("تعذر تحديث المحادثات.")); }, [user]);
  useEffect(() => { if (!activeConversation) { setMessages([]); setTypingUid(null); return; } return watchMessages(activeConversation.id, setMessages, () => setAppError("تعذر تحديث الرسائل الآن.")); }, [activeConversation]);
  useEffect(() => { if (!activeConversation || !user) return; return watchTyping(activeConversation.id, setTypingUid, user.uid); }, [activeConversation, user]);
  useEffect(() => { if (!activeConversation || !user) return; const last = messages[messages.length-1]; if (!last || last.senderId===user.uid) return; void markMessageRead(activeConversation.id,last.id,user.uid).catch(()=>undefined); }, [messages,activeConversation,user]);
  useEffect(() => { const last=messages[messages.length-1]; if(!last||!activeConversation){setReadBy([]);return;} return watchReadReceipts(activeConversation.id,last.id,setReadBy); }, [messages,activeConversation]);

  useEffect(() => () => { if(voiceTimer.current) clearInterval(voiceTimer.current); mediaStream.current?.getTracks().forEach(t=>t.stop()); if(voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl); }, [voicePreviewUrl]);

  function setupRecaptcha(){ if(window.recaptchaVerifier) return window.recaptchaVerifier; window.recaptchaVerifier=new RecaptchaVerifier(auth,"recaptcha-container",{size:"invisible",callback:()=>undefined}); return window.recaptchaVerifier; }
  async function sendCode(event:React.FormEvent){ event.preventDefault(); setError(""); const normalized=normalizePhone(phone); if(!/^\+[1-9]\d{7,14}$/.test(normalized)){setError("اكتب رقم الهاتف بالصيغة الدولية، مثل +90xxxxxxxxxx.");return;} setBusy(true); try{confirmation.current=await signInWithPhoneNumber(auth,normalized,setupRecaptcha());setPhone(normalized);setStep("code");}catch(err){console.error(err);setError("تعذر إرسال رمز التحقق. فعّل Phone Authentication واضبط نطاق الموقع في Firebase.");window.recaptchaVerifier?.clear();window.recaptchaVerifier=undefined;}finally{setBusy(false);} }
  async function verifyCode(event:React.FormEvent){event.preventDefault();setError("");if(!confirmation.current||!/^\d{6}$/.test(code)){setError("أدخل رمز التحقق المكوّن من 6 أرقام.");return;}setBusy(true);try{await confirmation.current.confirm(code);}catch(err){console.error(err);setError("رمز التحقق غير صحيح أو انتهت صلاحيته.");}finally{setBusy(false);}}
  function resetPhoneFlow(){setCode("");setStep("phone");setError("");confirmation.current=null;window.recaptchaVerifier?.clear();window.recaptchaVerifier=undefined;}
  async function searchContact(){if(!profile)return;const normalized=normalizePhone(contactPhone);if(!normalized)return;setSearching(true);setContact(null);try{const found=await findProfileByPhone(normalized);if(!found||found.uid===profile.uid)setAppError("لم نجد مستخدم Vasta بهذا الرقم.");else setContact(found);}catch(err){console.error(err);setAppError("تعذر البحث عن المستخدم.");}finally{setSearching(false);}}
  async function startConversation(){if(!profile||!contact)return;try{const conversation=await openConversation(profile,contact);if(conversation)setActiveConversation(conversation);setContact(null);setContactPhone("");}catch(err){console.error(err);setAppError("تعذر إنشاء المحادثة. تحقق من قواعد Firestore.");}}
  async function sendMessage(){if(!profile||!activeConversation||!text.trim())return;try{await sendTextMessage(activeConversation.id,profile,text);setText("");await setTyping(activeConversation.id,profile.uid,false);}catch(err){console.error(err);setAppError("تعذر إرسال الرسالة.");}}
  function handleTextChange(value:string){setText(value);if(!profile||!activeConversation)return;void setTyping(activeConversation.id,profile.uid,value.trim().length>0);if(typingTimer.current)clearTimeout(typingTimer.current);typingTimer.current=setTimeout(()=>{if(profile&&activeConversation)void setTyping(activeConversation.id,profile.uid,false);},1800);}

  async function startRecording(){
    if(!profile||!activeConversation||recording||voiceBusy)return;setAppError("");
    try{
      if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined"){setAppError("المتصفح لا يدعم تسجيل الصوت.");return;}
      const mimeType=chooseVoiceMimeType(); if(!mimeType){setAppError("هذا المتصفح لا يوفر صيغة تسجيل صوت مناسبة.");return;}
      mediaStream.current=await navigator.mediaDevices.getUserMedia({audio:true}); chunks.current=[];
      const recorder=new MediaRecorder(mediaStream.current,{mimeType}); mediaRecorder.current=recorder; setVoiceBlob(null); setVoicePreviewUrl(""); setVoiceMimeType(mimeType); voiceStartedAt.current=Date.now(); setRecordingMs(0); setRecording(true);
      voiceTimer.current=setInterval(()=>setRecordingMs(Date.now()-voiceStartedAt.current),200);
      recorder.ondataavailable=e=>{if(e.data.size>0)chunks.current.push(e.data);};
      recorder.onerror=()=>{stopRecording(true);setAppError("حدث خطأ أثناء التسجيل.");};
      recorder.onstop=()=>{const blob=new Blob(chunks.current,{type:mimeType});setVoiceBlob(blob);setVoicePreviewUrl(URL.createObjectURL(blob));setRecordingMs(Date.now()-voiceStartedAt.current);mediaStream.current?.getTracks().forEach(t=>t.stop());mediaStream.current=null;};
      recorder.start();
    }catch(err){console.error(err);mediaStream.current?.getTracks().forEach(t=>t.stop());mediaStream.current=null;setAppError("لم يتم السماح باستخدام الميكروفون. فعّل إذن الميكروفون للمتصفح.");}
  }
  function stopRecording(cancel=false){if(voiceTimer.current)clearInterval(voiceTimer.current);voiceTimer.current=null;const recorder=mediaRecorder.current;if(recorder&&recorder.state!=="inactive")recorder.stop();mediaRecorder.current=null;setRecording(false);if(cancel){chunks.current=[];mediaStream.current?.getTracks().forEach(t=>t.stop());mediaStream.current=null;setVoiceBlob(null);if(voicePreviewUrl)URL.revokeObjectURL(voicePreviewUrl);setVoicePreviewUrl("");setRecordingMs(0);}}
  function cancelVoicePreview(){stopRecording(true);setVoiceBlob(null);setVoicePreviewUrl("");setRecordingMs(0);}
  async function sendRecordedVoice(){if(!profile||!activeConversation||!voiceBlob||voiceBusy)return;setVoiceBusy(true);try{const uploaded=await uploadVoiceBlob(activeConversation.id,profile.uid,voiceBlob);await sendVoiceMessage(activeConversation.id,profile,uploaded.audioUrl,uploaded.storagePath,Math.max(500,recordingMs),uploaded.mimeType||voiceMimeType);cancelVoicePreview();}catch(err){console.error(err);setAppError("تعذر رفع الرسالة الصوتية. تحقق من Firebase Storage.");}finally{setVoiceBusy(false);}}
  function conversationName(item:VastaConversation){if(!profile)return"محادثة";const otherId=item.participants.find(id=>id!==profile.uid)??profile.uid;return item.names[otherId]??"محادثة";}

  if(booting)return <main className="vasta-loading"><div className="logo-mark">V</div><strong>Vasta</strong><span>نجهز تجربتك...</span></main>;
  if(!user)return <main className="auth-page"><section className="auth-card"><div className="auth-topline"><div className="logo-mark">V</div><div><div className="brand">Vasta</div><p>مراسلة سريعة على الإنترنت.</p></div></div><div className="hero-copy"><span className="eyebrow">NEXT-GEN MESSAGING</span><h1>{step==="phone"?"دخولك يبدأ من رقمك":"تحقق من رقمك"}</h1><p>{step==="phone"?"سيرسل Vasta رمزًا لمرة واحدة عبر SMS.":`أرسلنا رمز التحقق إلى ${phone}.`}</p></div>{step==="phone"?<form className="auth-form" onSubmit={sendCode}><label><span>رقم الهاتف</span><input dir="ltr" type="tel" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+90 5XX XXX XX XX" autoComplete="tel" required/></label><button id="send-code" className="primary-button" disabled={busy}>{busy?"جارٍ إرسال الرمز...":"متابعة عبر SMS"}</button><div id="recaptcha-container"/></form>:<form className="auth-form" onSubmit={verifyCode}><label><span>رمز التحقق</span><input dir="ltr" className="otp-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} placeholder="••••••" required/></label><button className="primary-button" disabled={busy}>{busy?"جارٍ التحقق...":"دخول إلى Vasta"}</button><button type="button" className="secondary-button" onClick={resetPhoneFlow}>تغيير رقم الهاتف</button></form>}{error&&<div className="error-box">{error}</div>}<div className="auth-benefits"><span>⚡ لحظي</span><span>👥 جماعي قريبًا</span><span>🔒 خاص</span></div></section></main>;

  return <main className="vasta-shell"><style>{`.voice-panel{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:1px solid rgba(24,230,174,.18);border-radius:16px;background:rgba(24,230,174,.05)}.voice-panel .recording-dot{width:10px;height:10px;border-radius:50%;background:#ff5262;box-shadow:0 0 0 6px rgba(255,82,98,.1);animation:vastaPulse 1s infinite}.voice-panel .voice-text{flex:1;color:#cfe7e3;font-size:12px}.voice-time{font-variant-numeric:tabular-nums;font-weight:900}.voice-action{width:42px;height:42px;border-radius:13px;cursor:pointer;background:#12272d;color:#d8eeea}.voice-action.send{background:#18e6ae;color:#05241b}.voice-preview{display:flex;align-items:center;gap:10px;flex:1;min-width:0}.voice-preview audio{width:min(310px,100%);height:38px}.message.voice-message{display:flex;align-items:center;gap:10px;min-width:min(270px,72vw)}.voice-message .voice-chip{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:rgba(24,230,174,.12);color:#18e6ae;flex:0 0 auto}.voice-message .voice-content{min-width:0;flex:1}.voice-message audio{display:block;width:100%;height:36px}.voice-duration{margin-top:3px;color:#8fa9a6;font-size:10px}.voice-record-button{width:48px;height:48px;border-radius:15px;background:#15282e;color:#d2e9e4;cursor:pointer;font-size:20px}.voice-record-button:disabled{opacity:.55;cursor:wait}@keyframes vastaPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}`}</style><section className="app-frame">
    <aside className="sidebar"><header className="sidebar-head"><div><div className="brand">Vasta</div><div className="brand-subtitle">مراسلة الجيل التالي</div></div><button className="icon-button">⋮</button></header><div className="contact-search"><div className="search-wrap"><span>⌕</span><input dir="ltr" value={contactPhone} onChange={e=>setContactPhone(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void searchContact()} placeholder="+90 رقم الهاتف"/></div><button className="search-button" onClick={()=>void searchContact()}>{searching?"بحث...":"العثور على مستخدم"}</button></div>{contact&&<button className="contact-result" onClick={()=>void startConversation()}><div className="avatar">{initials(contact.displayName)}</div><div><strong>{contact.displayName}</strong><span dir="ltr">{contact.phoneNumber}</span></div><b>＋</b></button>}<div className="chat-list">{conversations.length===0?<div className="empty-chats"><div className="welcome-logo">V</div><strong>ابدأ أول محادثة</strong><span>ابحث عن رقم هاتف لفتح محادثة.</span></div>:conversations.map(item=><button key={item.id} className={`chat-item ${activeConversation?.id===item.id?"active":""}`} onClick={()=>setActiveConversation(item)}><div className="avatar">{initials(conversationName(item))}</div><div className="chat-copy"><div className="chat-title-row"><strong>{conversationName(item)}</strong><time>{new Date(item.lastMessageAt).toLocaleTimeString("ar",{hour:"2-digit",minute:"2-digit"})}</time></div><div className="chat-message">{item.lastMessage}</div></div></button>)}</div><footer className="sidebar-footer"><div className="profile-mini"><div className="avatar small">{initials(profile?.displayName??"V")}</div><div><strong>{profile?.displayName??"حساب Vasta"}</strong><span dir="ltr">{user.phoneNumber}</span></div></div><button className="logout-button" onClick={()=>void signOut(auth)}>خروج</button></footer></aside>
    <section className="conversation">{activeConversation?<><header className="conversation-head"><div className="conversation-user"><div className="avatar">{initials(conversationName(activeConversation))}</div><div><strong>{conversationName(activeConversation)}</strong><span>{typingUid?"يكتب الآن...":"محادثة Vasta عبر الإنترنت"}</span></div></div><div className="conversation-actions"><button className="icon-button">⌕</button><button className="icon-button">⋯</button></div></header><div className="messages-area"><div className="secure-note">🔒 اتصال Vasta محفوظ بحسابك</div>{messages.length===0&&<div className="conversation-empty">ابدأ أول رسالة 👋</div>}{messages.map(item=>item.kind==="voice"&&item.audioUrl?<div key={item.id} className={`message voice-message ${item.senderId===user.uid?"sent":"received"}`} style={item.senderId===user.uid?undefined:{alignSelf:"flex-start"}}><div className="voice-chip">🎤</div><div className="voice-content"><audio controls preload="metadata" src={item.audioUrl}/><div className="voice-duration">رسالة صوتية • {formatDuration(item.durationMs??0)}</div></div></div>:<div key={item.id} className={`message ${item.senderId===user.uid?"sent":"received"}`}><span>{item.text}</span><time>{new Date(item.createdAt).toLocaleTimeString("ar",{hour:"2-digit",minute:"2-digit"})}{item.senderId===user.uid&&<em>{readBy.some(uid=>uid!==user.uid)?"✓✓":"✓"}</em>}</time></div>)}{typingUid&&<div className="typing-indicator"><i/><i/><i/> يكتب الآن</div>}</div><div className="composer">{recording?<div className="voice-panel"><div className="recording-dot"/><div className="voice-text">جارٍ التسجيل <span className="voice-time">{formatDuration(recordingMs)}</span></div><button className="voice-action" onClick={()=>stopRecording(true)} aria-label="إلغاء التسجيل">🗑️</button><button className="voice-action send" onClick={()=>stopRecording(false)} aria-label="إيقاف التسجيل">✓</button></div>:voiceBlob&&voicePreviewUrl?<div className="voice-panel"><div className="voice-preview"><span className="voice-chip">🎤</span><audio controls src={voicePreviewUrl}/></div><button className="voice-action" onClick={cancelVoicePreview} aria-label="حذف التسجيل">🗑️</button><button className="voice-action send" disabled={voiceBusy} onClick={()=>void sendRecordedVoice()} aria-label="إرسال التسجيل">{voiceBusy?"…":"➤"}</button></div>:<><button className="attach" aria-label="مرفق">＋</button><input value={text} onChange={e=>handleTextChange(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void sendMessage()} placeholder="اكتب رسالة..."/>{text.trim()?<button className="send" onClick={()=>void sendMessage()} aria-label="إرسال">➤</button>:<button className="voice-record-button" onClick={()=>void startRecording()} aria-label="تسجيل رسالة صوتية">🎤</button>}</>}</div></>:<div className="welcome-panel"><div className="welcome-logo large">V</div><span className="eyebrow">VASTA // THE NEXT WAVE</span><h1>مرحبًا بك في Vasta.</h1><p>ابحث عن شخص برقمه وابدأ محادثة حقيقية عبر الإنترنت.</p><div className="feature-grid">{features.map(feature=><div key={feature.title}><b>{feature.icon} {feature.title}</b><span>{feature.text}</span></div>)}</div></div>}</section>
  </section>{appError&&<button className="toast" onClick={()=>setAppError("")}>{appError}</button>}</main>;
}
