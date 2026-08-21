"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  deleteOwnMessage,
  editOwnMessage,
  ensureProfile,
  findProfileByPhone,
  markMessageRead,
  openConversation,
  sendMediaMessage,
  sendTextMessage,
  sendVoiceMessage,
  setMessagePinned,
  setMessageReaction,
  type VastaConversation,
  type VastaMessage,
  type VastaProfile,
  watchMessages,
  watchMessageReactions,
} from "@/lib/vasta-chat";
import { uploadVoiceBlob, chooseVoiceMimeType } from "@/lib/vasta-voice";
import VastaMediaPicker, { type VastaMediaSelection } from "@/components/vasta-media-picker";
import { uploadPrivateMedia } from "@/lib/vasta-media";
import VastaCallActions from "@/lib/vasta-call-actions";

function formatTime(value: number) { return new Date(value).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }); }
function duration(ms: number) { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`; }

export default function PrivateChat() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<VastaProfile | null>(null);
  const [phone, setPhone] = useState("");
  const [contact, setContact] = useState<VastaProfile | null>(null);
  const [conversation, setConversation] = useState<VastaConversation | null>(null);
  const [messages, setMessages] = useState<VastaMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [mediaOpen, setMediaOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<VastaMessage | null>(null);
  const [editing, setEditing] = useState<VastaMessage | null>(null);
  const [editText, setEditText] = useState("");
  const [reactions, setReactions] = useState<Record<string, Record<string, string>>>({});

  const [recording, setRecording] = useState(false);
  const [voiceMs, setVoiceMs] = useState(0);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceUrl, setVoiceUrl] = useState("");
  const [voiceType, setVoiceType] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u);
    if (!u) return;
    try { setProfile(await ensureProfile(u)); } catch (e) { console.error(e); setError("تعذر تجهيز الحساب."); }
  }), []);
  useEffect(() => { if (!conversation) return; return watchMessages(conversation.id, setMessages, (e) => { console.error(e); setError("تعذر تحديث الرسائل."); }); }, [conversation]);
  useEffect(() => { return () => { stream.current?.getTracks().forEach((t) => t.stop()); if (timer.current) clearInterval(timer.current); if (voiceUrl) URL.revokeObjectURL(voiceUrl); }; }, [voiceUrl]);
  useEffect(() => {
    if (!conversation || !messages.length) return;
    const last = messages[messages.length - 1];
    if (last.senderId !== user?.uid) void markMessageRead(conversation.id, last.id, user?.uid ?? "").catch(() => undefined);
  }, [conversation, messages, user]);
  useEffect(() => {
    if (!conversation) return;
    const cleanups = messages.map((m) => watchMessageReactions(conversation.id, m.id, (r) => setReactions((prev) => ({ ...prev, [m.id]: r }))));
    return () => cleanups.forEach((fn) => fn());
  }, [conversation, messages]);

  async function find() {
    if (!profile) return; setBusy(true); setError("");
    try { const found = await findProfileByPhone(phone); if (!found || found.uid === profile.uid) setError("لم نجد مستخدم Vasta بهذا الرقم."); else setContact(found); }
    catch (e) { console.error(e); setError("فشل البحث."); } finally { setBusy(false); }
  }
  async function open() { if (!profile || !contact) return; try { setConversation(await openConversation(profile, contact)); } catch (e) { console.error(e); setError("تعذر فتح المحادثة الخاصة."); } }
  async function send() {
    if (!profile || !conversation || !text.trim()) return;
    try { await sendTextMessage(conversation.id, profile, text, replyTo ?? undefined); setText(""); setReplyTo(null); }
    catch (e) { console.error(e); setError("تعذر إرسال الرسالة."); }
  }
  async function selectMedia(sel: VastaMediaSelection) {
    if (!profile || !conversation) return; setBusy(true);
    try {
      const uploaded = await uploadPrivateMedia(conversation.id, profile.uid, sel.file);
      await sendMediaMessage(
        conversation.id,
        profile,
        {
          mediaUrl: uploaded.mediaUrl,
          storagePath: uploaded.storagePath,
          mediaKind: uploaded.kind,
          fileName: uploaded.fileName,
          sizeBytes: uploaded.sizeBytes,
          mimeType: uploaded.mimeType,
        },
        replyTo ?? undefined,
      );
      setReplyTo(null);
    }
    catch (e) { console.error(e); setError("تعذر رفع المرفق الآن."); } finally { setBusy(false); }
  }
  async function startVoice() {
    if (recording || !conversation) return;
    try {
      const mime = chooseVoiceMimeType(); if (!mime) throw new Error("mime");
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true }); chunks.current = [];
      const r = new MediaRecorder(stream.current, { mimeType: mime }); recorder.current = r; setVoiceType(mime); started.current = Date.now(); setVoiceMs(0); setRecording(true);
      timer.current = setInterval(() => setVoiceMs(Date.now() - started.current), 200);
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => { const b = new Blob(chunks.current, { type: mime }); setVoiceBlob(b); setVoiceUrl(URL.createObjectURL(b)); stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
      r.start();
    } catch (e) { console.error(e); setError("اسمح للمتصفح باستخدام الميكروفون."); }
  }
  function stopVoice(cancel = false) {
    if (timer.current) clearInterval(timer.current); timer.current = null;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop(); recorder.current = null; setRecording(false);
    if (cancel) { setVoiceBlob(null); if (voiceUrl) URL.revokeObjectURL(voiceUrl); setVoiceUrl(""); setVoiceMs(0); }
  }
  async function sendVoice() {
    if (!profile || !conversation || !voiceBlob) return; setBusy(true);
    try { const up = await uploadVoiceBlob(conversation.id, profile.uid, voiceBlob); await sendVoiceMessage(conversation.id, profile, up.audioUrl, up.storagePath, Math.max(500, voiceMs), up.mimeType || voiceType); stopVoice(true); }
    catch (e) { console.error(e); setError("تعذر إرسال الرسالة الصوتية."); } finally { setBusy(false); }
  }
