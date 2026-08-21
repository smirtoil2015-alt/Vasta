"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createCall, addIceCandidate, watchIceCandidates, watchCall, setCallStatus, type VastaCallKind } from "@/lib/vasta-calls";
import { getVastaRtcConfiguration } from "@/lib/vasta-rtc-config";

export default function CallPage() {
  const [user, setUser] = useState<User | null>(null);
  const [conversationId, setConversationId] = useState("");
  const [peerId, setPeerId] = useState("");
  const [callId, setCallId] = useState("");
  const [kind, setKind] = useState<VastaCallKind>("video");
  const [status, setStatus] = useState("جاهز للاتصال");
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);
  const [error, setError] = useState("");
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
  const cleanups = useRef<(() => void)[]>([]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setConversationId(query.get("conversationId") ?? "");
    setPeerId(query.get("peerId") ?? "");
    setKind(query.get("kind") === "audio" ? "audio" : "video");
  }, []);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => () => { cleanups.current.forEach((fn) => fn()); localStream.current?.getTracks().forEach((t) => t.stop()); pc.current?.close(); }, []);

  async function start() {
    if (!user || !conversationId || !peerId || callId) return;
    setError(""); setStatus("جاري الاتصال…");
    try {
      const connection = new RTCPeerConnection(getVastaRtcConfiguration());
      pc.current = connection;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" });
      localStream.current = stream;
      if (localVideo.current) localVideo.current.srcObject = stream;
      stream.getTracks().forEach((track) => connection.addTrack(track, stream));
      connection.onconnectionstatechange = () => {
        const state = connection.connectionState;
        if (state === "connected") { setConnected(true); setStatus("متصل"); }
        else if (state === "connecting") { setStatus("جاري الاتصال…"); }
        else if (state === "disconnected") { setStatus("انقطع الاتصال مؤقتًا"); }
        else if (state === "failed") { setStatus("فشل الاتصال"); setConnected(false); }
        else if (state === "closed") { setStatus("انتهت المكالمة"); setConnected(false); }
      };
      connection.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (kind === "video" && remoteVideo.current) remoteVideo.current.srcObject = remoteStream;
        if (remoteAudio.current) remoteAudio.current.srcObject = remoteStream;
      };
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      const id = await createCall(conversationId, user.uid, peerId, kind, offer);
      setCallId(id);
      connection.onicecandidate = (event) => { if (event.candidate) void addIceCandidate(conversationId, id, "caller", event.candidate.toJSON()); };
      cleanups.current.push(
        watchCall(conversationId, id, async (call) => {
          if (!call) return;
          if (call.answer && connection.signalingState !== "stable") await connection.setRemoteDescription(call.answer);
          if (call.status === "ringing") setStatus("يرن لدى الطرف الآخر…");
          if (call.status === "active") setStatus("متصل");
          if (call.status === "ended") { setStatus("انتهت المكالمة"); setConnected(false); }
        }),
        watchIceCandidates(conversationId, id, "callee", (candidate) => { void connection.addIceCandidate(candidate); }),
      );
    } catch (e) { console.error(e); setStatus("تعذر بدء المكالمة"); setError("تحقق من أذونات الميكروفون/الكاميرا."); }
  }

  async function hangup() {
    if (conversationId && callId) await setCallStatus(conversationId, callId, "ended").catch(() => undefined);
    cleanups.current.forEach((fn) => fn()); cleanups.current = [];
    localStream.current?.getTracks().forEach((t) => t.stop()); pc.current?.close();
    localStream.current = null; pc.current = null; setConnected(false); setCallId(""); setStatus("انتهت المكالمة");
  }

  function toggleMute() { localStream.current?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; }); setMuted((v) => !v); }
  function toggleCamera() { localStream.current?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; }); setCameraOff((v) => !v); }
  function toggleSpeaker() {
    const next = !speakerOff;
    if (remoteVideo.current) remoteVideo.current.muted = next;
    if (remoteAudio.current) remoteAudio.current.muted = next;
    setSpeakerOff(next);
  }

  if (!user) return <main style={{ padding: 40 }}>سجّل الدخول أولًا إلى Vasta.</main>;
  return <main dir="rtl" style={{ minHeight: "100vh", background: "#061214", color: "white", padding: 24, fontFamily: "sans-serif" }}>
    <section style={{ maxWidth: 1000, margin: "0 auto", background: "#0b1c20", borderRadius: 24, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div><h1 style={{ margin: 0 }}>{kind === "audio" ? "Vasta — مكالمة صوتية" : "Vasta — مكالمة فيديو"}</h1><div style={{ color: connected ? "#18e6ae" : "#91aaa6", marginTop: 6 }}>{status}</div></div>
        <span style={{ fontSize: 12, color: "#6f8985" }}>{callId ? "اتصال مباشر" : "غير متصل"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginTop: 16 }}>
        <input value={conversationId} onChange={(e) => setConversationId(e.target.value)} placeholder="معرّف المحادثة" style={{ padding: 12, borderRadius: 12 }} />
        <input value={peerId} onChange={(e) => setPeerId(e.target.value)} placeholder="معرّف الطرف الآخر" style={{ padding: 12, borderRadius: 12 }} />
      </div>
      <div style={{ display: "flex", gap: 8, margin: "14px 0", flexWrap: "wrap" }}>
        <button onClick={() => setKind("audio")} disabled={!!callId}>📞 صوت</button><button onClick={() => setKind("video")} disabled={!!callId}>📹 فيديو</button>
        <button onClick={() => void start()} disabled={connected || !!callId}>بدء المكالمة</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: kind === "video" ? "1fr 1fr" : "1fr", gap: 12 }}>
        {kind === "video" && <video ref={localVideo} autoPlay muted playsInline style={{ width: "100%", aspectRatio: "16/9", background: "black", borderRadius: 18 }} />}
        {kind === "video" && <video ref={remoteVideo} autoPlay playsInline style={{ width: "100%", aspectRatio: "16/9", background: "black", borderRadius: 18 }} />}
        <audio ref={remoteAudio} autoPlay style={{ display: "none" }} />
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
        <button onClick={toggleMute}>{muted ? "🔇 إلغاء الكتم" : "🎙️ كتم"}</button>
        {kind === "video" && <button onClick={toggleCamera}>{cameraOff ? "📷 تشغيل الكاميرا" : "📷 إيقاف الكاميرا"}</button>}
        <button onClick={toggleSpeaker}>{speakerOff ? "🔈 تشغيل الصوت" : "🔊 إيقاف الصوت"}</button>
        <button onClick={() => void hangup()} style={{ background: "#e95062", color: "white" }}>⏹ إنهاء</button>
      </div>
      {error && <p style={{ color: "#ff7885" }}>{error}</p>}
      <p style={{ color: "#7e9995", fontSize: 12 }}>TURN اختياري عبر NEXT_PUBLIC_TURN_URL وNEXT_PUBLIC_TURN_USERNAME وNEXT_PUBLIC_TURN_CREDENTIAL.</p>
    </section>
  </main>;
}
