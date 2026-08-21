"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  ensureProfile,
  findProfileByPhone,
  openConversation,
  sendMediaMessage,
  sendTextMessage,
  type VastaConversation,
  type VastaMessage,
  type VastaProfile,
  watchMessages,
} from "@/lib/vasta-chat";
import VastaMediaPicker, { type VastaMediaSelection } from "@/components/vasta-media-picker";
import { uploadPrivateMedia } from "@/lib/vasta-media";
import VastaCallActions from "@/lib/vasta-call-actions";

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
}

export default function PrivateChat() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<VastaProfile | null>(null);
  const [phone, setPhone] = useState("");
  const [contact, setContact] = useState<VastaProfile | null>(null);
  const [conversation, setConversation] = useState<VastaConversation | null>(null);
  const [messages, setMessages] = useState<VastaMessage[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<VastaMessage | undefined>();
  const [mediaOpen, setMediaOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    setUser(nextUser);
    if (!nextUser) return;
    try {
      setProfile(await ensureProfile(nextUser));
    } catch (err) {
      console.error(err);
      setError("تعذر تجهيز الحساب.");
    }
  }), []);

  useEffect(() => {
    if (!conversation) return;
    return watchMessages(
      conversation.id,
      setMessages,
      (err) => {
        console.error(err);
        setError("تعذر تحديث الرسائل.");
      },
    );
  }, [conversation]);

  async function findContact() {
    if (!profile) return;
    setBusy(true);
    setError("");
    try {
      const found = await findProfileByPhone(phone);
      if (!found || found.uid === profile.uid) {
        setError("لم نجد مستخدم Vasta بهذا الرقم.");
        setContact(null);
        return;
      }
      setContact(found);
    } catch (err) {
      console.error(err);
      setError("فشل البحث.");
    } finally {
      setBusy(false);
    }
  }

  async function startChat() {
    if (!profile || !contact) return;
    setBusy(true);
    try {
      const nextConversation = await openConversation(profile, contact);
      setConversation(nextConversation);
      setError("");
    } catch (err) {
      console.error(err);
      setError("تعذر فتح المحادثة.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!profile || !conversation || !text.trim()) return;
    setBusy(true);
    try {
      await sendTextMessage(conversation.id, profile, text, replyTo);
      setText("");
      setReplyTo(undefined);
    } catch (err) {
      console.error(err);
      setError("تعذر إرسال الرسالة.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMedia(selection: VastaMediaSelection) {
    if (!profile || !conversation) return;
    setBusy(true);
    try {
      const media = await uploadPrivateMedia(conversation.id, profile.uid, selection.file);
      await sendMediaMessage(conversation.id, profile, media, replyTo);
      setReplyTo(undefined);
      setMediaOpen(false);
    } catch (err) {
      console.error(err);
      setError("تعذر رفع المرفق.");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return <main dir="rtl" style={{ padding: 40, fontFamily: "sans-serif" }}>سجّل الدخول أولًا إلى Vasta.</main>;
  }

  const peerId = conversation?.participants.find((id) => id !== profile?.uid) ?? "";
  const peerName = conversation && profile
    ? conversation.names[conversation.participants.find((id) => id !== profile.uid) ?? ""] ?? "محادثة خاصة"
    : "محادثة خاصة";

  return (
    <main dir="rtl" style={{ minHeight: "100vh", background: "#071316", color: "#e7f3f1", padding: 24, fontFamily: "sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", background: "#0d1d21", border: "1px solid #17353a", borderRadius: 24, overflow: "hidden" }}>
        <header style={{ padding: 18, borderBottom: "1px solid #17353a", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div><b style={{ fontSize: 22 }}>Vasta</b><div style={{ color: "#86a09c", fontSize: 12 }}>محادثات خاصة</div></div>
          {conversation && peerId ? <VastaCallActions conversationId={conversation.id} peerId={peerId} /> : null}
        </header>

        {!conversation ? (
          <section style={{ padding: 28 }}>
            <h1 style={{ marginTop: 0 }}>ابدأ محادثة جديدة</h1>
            <p style={{ color: "#91aaa6" }}>ابحث عن المستخدم برقم هاتفه.</p>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 ..." dir="ltr" style={{ flex: 1, padding: 14, borderRadius: 14, border: "1px solid #21474c", background: "#09171a", color: "white" }} />
              <button onClick={() => void findContact()} disabled={busy} style={{ padding: "0 18px", border: 0, borderRadius: 14, background: "#18e6ae", fontWeight: 800 }}>{busy ? "بحث..." : "بحث"}</button>
            </div>
            {contact ? (
              <button onClick={() => void startChat()} disabled={busy} style={{ width: "100%", marginTop: 16, padding: 16, textAlign: "right", borderRadius: 16, border: "1px solid #21474c", background: "#102226", color: "white" }}>
                <b>{contact.displayName}</b>
                <div dir="ltr" style={{ color: "#88a39f", fontSize: 12 }}>{contact.phoneNumber}</div>
              </button>
            ) : null}
            {error ? <p style={{ color: "#ff7784" }}>{error}</p> : null}
          </section>
        ) : (
          <section style={{ display: "flex", flexDirection: "column", height: "78vh" }}>
            <div style={{ padding: 16, borderBottom: "1px solid #17353a" }}><b>{peerName}</b></div>
            <div style={{ flex: 1, overflow: "auto", padding: 18 }}>
              {messages.map((message) => {
                const mine = message.senderId === user.uid;
                return (
                  <div key={message.id} style={{ display: "flex", justifyContent: mine ? "flex-start" : "flex-end", marginBottom: 10 }}>
                    <div style={{ maxWidth: "75%", padding: 12, borderRadius: 16, background: mine ? "#123e36" : "#17282d" }}>
                      {message.replyToText ? <div style={{ color: "#8fa7a3", fontSize: 11, marginBottom: 6 }}>↩ {message.replyToText}</div> : null}
                      {message.deleted ? <i style={{ color: "#88a39f" }}>تم حذف هذه الرسالة</i> : null}
                      {!message.deleted && message.kind === "text" ? <div>{message.text}</div> : null}
                      {!message.deleted && message.kind === "voice" ? <audio controls src={message.audioUrl} style={{ maxWidth: 260 }} /> : null}
                      {!message.deleted && message.kind === "media" ? (
                        message.mediaKind === "image" ? <img src={message.mediaUrl} alt={message.fileName ?? "صورة"} style={{ maxWidth: 320, maxHeight: 320, borderRadius: 12 }} />
                        : message.mediaKind === "video" ? <video controls src={message.mediaUrl} style={{ maxWidth: 320, maxHeight: 320, borderRadius: 12 }} />
                        : <a href={message.mediaUrl} target="_blank" rel="noreferrer" style={{ color: "#18e6ae" }}>📄 {message.fileName}</a>
                      ) : null}
                      <div style={{ marginTop: 6, fontSize: 10, color: "#6f8985" }}>{formatTime(message.createdAt)}</div>
                      <button onClick={() => setReplyTo(message)} style={{ marginTop: 6 }}>↩ رد</button>
                    </div>
                  </div>
                );
              })}
            </div>
            {replyTo ? <div style={{ padding: 8, borderTop: "1px solid #17353a", color: "#93aaa6" }}>↩ الرد على: {replyTo.text || "رسالة"}<button onClick={() => setReplyTo(undefined)} style={{ marginRight: 8 }}>×</button></div> : null}
            <form onSubmit={(e) => { e.preventDefault(); void send(); }} style={{ padding: 14, borderTop: "1px solid #17353a", display: "flex", gap: 8 }}>
              <VastaMediaPicker open={mediaOpen} onClose={() => setMediaOpen(false)} onSelect={(selection) => void sendMedia(selection)} />
              <button type="button" onClick={() => setMediaOpen(true)} disabled={busy}>📎</button>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب رسالة..." style={{ flex: 1, padding: 14, borderRadius: 14, border: "1px solid #21474c", background: "#09171a", color: "white" }} />
              <button type="submit" disabled={busy || !text.trim()} style={{ padding: "0 18px", border: 0, borderRadius: 14, background: "#18e6ae", fontWeight: 900 }}>إرسال</button>
            </form>
            {error ? <div style={{ padding: "0 14px 12px", color: "#ff7784" }}>{error}</div> : null}
          </section>
        )}
      </div>
    </main>
  );
}
