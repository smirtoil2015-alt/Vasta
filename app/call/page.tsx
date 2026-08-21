"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createCall, addIceCandidate, watchIceCandidates, watchCall, answerCall, setCallStatus, type VastaCallKind } from "@/lib/vasta-calls";

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function CallPage() {
  const [user, setUser] = useState<User | null>(null);
  const [conversationId, setConversationId] = useState("");
  const [peerId, setPeerId] = useState("");
  const [callId, setCallId] = useState("");
  const [kind, setKind] = useState<VastaCallKind>("video");
  const [incoming, setIncoming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState("");
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => () => { localStream.current?.getTracks().forEach((t) => t.stop()); pc.current?.close(); }, []);

  async function setupPeer(callKind: VastaCallKind) {
    const connection = new RTCPeerConnection(rtcConfig);
    pc.current = connection;
    localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: callKind === "video" });
    if (localVideo.current) localVideo.current.srcObject = localStream.current;
    localStream.current.getTracks().forEach((track) => connection.addTrack(track, localStream.current!));
    connection.ontrack = (event) => { if (remoteVideo.current) remoteVideo.current.srcObject = event.streams[0]; setConnected(true); };
    return connection;
  }

  async function start() {
    if (!user || !conversationId || !peerId) return;
    setError("");
    try {
      const connection = await setupPeer(kind);
      const originalAdd = connection.onicecandidate;
      connection.onicecandidate = (event) => { if (event.candidate && callId) void addIceCandidate(conversationId, callId, "caller", event.candidate.toJSON()); };
      void originalAdd;
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      const id = await createCall(conversationId, user.uid, peerId, kind, offer);
      setCallId(id);
      const unsubCall = watchCall(conversationId, id, async (call) => {
        if (!call) return;
        if (call.answer && connection.signalingState !== "stable") await connection.setRemoteDescription(call.answer);
        if (call.status === "ended") { setConnected(false); }
      });
      const unsubIce = watchIceCandidates(conversationId, id, "callee", (candidate) => { void connection.addIceCandidate(candidate); });
      return () => { unsubCall(); unsubIce(); };
    } catch (e) { console.error(e); setError("تعذر بدء المكالمة. تحقق من إذن الميكروفون/الكاميرا."); }
  }

  async function accept() {
    if (!user || !conversationId || !callId) return;
    try {
      const connection = await setupPeer(kind);
      const call = await new Promise<NonNullable<Parameters<typeof watchCall>[2]> extends never ? never : any>((resolve) => {
        const unsub = watchCall(conversationId, callId, (value) => { if (value) { unsub(); resolve(value); } });
      });
      await connection.setRemoteDescription(call.offer);
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      await answerCall(conversationId, callId, answer);
      connection.onicecandidate = (event) => { if (event.candidate) void addIceCandidate(conversationId, callId, "callee", event.candidate.toJSON()); };
      void watchIceCandidates(conversationId, callId, "caller", (candidate) => { void connection.addIceCandidate(candidate); });
      setIncoming(false); setConnected(true);
    } catch (e) { console.error(e); setError("تعذر قبول المكالمة."); }
  }

  async function hangup() {
    if (conversationId && callId) await setCallStatus(conversationId, callId, "ended").catch(() => undefined);
    localStream.current?.getTracks().forEach((t) => t.stop()); pc.current?.close(); setConnected(false);
  }

  function toggleMute() { localStream.current?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; }); setMuted((v) => !v); }
  function toggleCamera() { localStream.current?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; }); setCameraOff((v) => !v); }

  if (!user) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>سجّل الدخول أولًا إلى Vasta.</main>;
  return <main dir="rtl" style={{ minHeight: "100vh", background: "#061214", color: "white", padding: 24, fontFamily: "sans-serif" }}>
    <section style={{ maxWidth: 1000, margin: "0 auto", background: "#0b1c20", borderRadius: 24, padding: 20 }}>
      <h1 style={{ marginTop: 0 }}>Vasta — مكالمة خاصة</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        <input value={conversationId} onChange={(e) => setConversationId(e.target.value)} placeholder="معرّف المحادثة" style={{ padding: 12, borderRadius: 12 }} />
        <input value={peerId} onChange={(e) => setPeerId(e.target.value)} placeholder="معرّف الطرف الآخر" style={{ padding: 12, borderRadius: 12 }} />
      </div>
      <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
        <button onClick={() => setKind("audio")}>📞 صوت</button><button onClick={() => setKind("video")}>📹 فيديو</button>
        <button onClick={() => void start()} disabled={connected}>بدء المكالمة</button>
        <button onClick={() => setIncoming(true)}>اختبار مكالمة واردة</button>
      </div>
      {incoming && <div style={{ padding: 16, borderRadius: 16, background: "#10272c", marginBottom: 12 }}>مكالمة واردة <button onClick={() => void accept()}>قبول</button> <button onClick={() => setIncoming(false)}>رفض</button></div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <video ref={localVideo} autoPlay muted playsInline style={{ width: "100%", aspectRatio: "16/9", background: "black", borderRadius: 18 }} />
        <video ref={remoteVideo} autoPlay playsInline style={{ width: "100%", aspectRatio: "16/9", background: "black", borderRadius: 18 }} />
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
        <button onClick={toggleMute}>{muted ? "🔇 إلغاء الكتم" : "🎙️ كتم"}</button>
        {kind === "video" && <button onClick={toggleCamera}>{cameraOff ? "📷 تشغيل الكاميرا" : "📷 إيقاف الكاميرا"}</button>}
        <button onClick={() => void hangup()} style={{ background: "#e95062", color: "white" }}>⏹ إنهاء</button>
      </div>
      {error && <p style={{ color: "#ff7885" }}>{error}</p>}
    </section>
  </main>;
}
