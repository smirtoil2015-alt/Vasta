"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createCall, addIceCandidate, watchIceCandidates, watchCall, setCallStatus, type VastaCallKind } from "@/lib/vasta-calls";
import { getVastaRtcConfiguration } from "@/lib/vasta-rtc-config";

export default function CallPage() {
  const params = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [conversationId, setConversationId] = useState(params.get("conversationId") ?? "");
  const [peerId, setPeerId] = useState(params.get("peerId") ?? "");
  const [callId, setCallId] = useState("");
  const [kind, setKind] = useState<VastaCallKind>(params.get("kind") === "audio" ? "audio" : "video");
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

  async function start() {
    if (!user || !conversationId || !peerId || callId) return;
    setError("");
    try {
      const connection = new RTCPeerConnection(getVastaRtcConfiguration());
      pc.current = connection;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" });
      localStream.current = stream;
      if (localVideo.current) localVideo.current.srcObject = stream;
      stream.getTracks().forEach((track) => connection.addTrack(track, stream));
      connection.ontrack = (event) => { if (remoteVideo.current) remoteVideo.current.srcObject = event.streams[0]; setConnected(true); };
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      const id = await createCall(conversationId, user.uid, peerId, kind, offer);
      setCallId(id);
      connection.onicecandidate = (event) => { if (event.candidate) void addIceCandidate(conversationId, id, "caller", event.candidate.toJSON()); };
      const stopCallWatch = watchCall(conversationId, id, async (call) => {
        if (!call) return;
        if (call.answer && connection.signalingState !== "stable") await connection.setRemoteDescription(call.answer);
        if (call.status === "ended") setConnected(false);
      });
      const stopIceWatch = watchIceCandidates(conversationId, id, "callee", (candidate) => { void connection.addIceCandidate(candidate); });
      void stopCallWatch; void stopIceWatch;
    } catch (e) { console.error(e); setError("تعذر بدء المكالمة. تحقق من الميكروفون/الكاميرا."); }
  }

  async function hangup() {
    if (conversationId && callId) await setCallStatus(conversationId, callId, "ended").catch(() => undefined);
    localStream.current?.getTracks().forEach((t) => t.stop()); pc.current?.close(); setConnected(false); setCallId("");
  }
  function toggleMute() { localStream.current?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; }); setMuted((v) => !v); }
  function toggleCamera() { localStream.current?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; }); setCameraOff((v) => !v); }

  if (!user) return <main style={{ padding: 40 }}>سجّل الدخول أولًا إلى Vasta.</main>;
  return <main dir="rtl" style={{ minHeight: "100vh", background: "#061214", color: "white", padding: 24, fontFamily: "sans-serif" }}>
    <section style={{ maxWidth: 1000, margin: "0 auto", background: "#0b1c20", borderRadius: 24, padding: 20 }}>
      <h1 style={{ marginTop: 0 }}>{kind === "audio" ? "Vasta — مكالمة صوتية" : "Vasta — مكالمة فيديو"}</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        <input value={conversationId} onChange={(e) => setConversationId(e.target.value)} placeholder="معرّف المحادثة" style={{ padding: 12, borderRadius: 12 }} />
        <input value={peerId} onChange={(e) => setPeerId(e.target.value)} placeholder="معرّف الطرف الآخر" style={{ padding: 12, borderRadius: 12 }} />
      </div>
      <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
        <button onClick={() => setKind("audio")}>📞 صوت</button><button onClick={() => setKind("video")}>📹 فيديو</button>
        <button onClick={() => void start()} disabled={connected || !!callId}>بدء المكالمة</button>
      </div>
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
      <p style={{ color: "#7e9995", fontSize: 12 }}>TURN اختياري عبر NEXT_PUBLIC_TURN_URL وNEXT_PUBLIC_TURN_USERNAME وNEXT_PUBLIC_TURN_CREDENTIAL.</p>
    </section>
  </main>;
}
