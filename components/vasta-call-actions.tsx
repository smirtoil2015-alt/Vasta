"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { setCallStatus, watchIncomingCall, type VastaCall } from "@/lib/vasta-calls";

export default function VastaCallActions({ conversationId, peerId }: { conversationId: string; peerId: string }) {
  const router = useRouter();
  const [incoming, setIncoming] = useState<VastaCall | null>(null);
  const [uid, setUid] = useState("");

  useEffect(() => onAuthStateChanged(auth, (user) => setUid(user?.uid ?? "")), []);
  useEffect(() => {
    if (!uid || !conversationId) return;
    return watchIncomingCall(conversationId, uid, setIncoming);
  }, [conversationId, uid]);

  function open(kind: "audio" | "video") {
    const query = new URLSearchParams({ conversationId, peerId, kind });
    router.push(`/call?${query.toString()}`);
  }

  async function reject() {
    if (!incoming) return;
    await setCallStatus(conversationId, incoming.id, "ended").catch(() => undefined);
    setIncoming(null);
  }

  function accept() {
    if (!incoming) return;
    const query = new URLSearchParams({ conversationId, peerId: incoming.callerId, kind: incoming.kind, callId: incoming.id });
    router.push(`/call?${query.toString()}`);
  }

  return (
    <>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => open("audio")} aria-label="مكالمة صوتية" title="مكالمة صوتية">📞</button>
        <button type="button" onClick={() => open("video")} aria-label="مكالمة فيديو" title="مكالمة فيديو">📹</button>
      </div>
      {incoming && (
        <div role="dialog" aria-live="assertive" style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", background: "rgba(0,0,0,.72)" }}>
          <div style={{ width: "min(92vw, 380px)", borderRadius: 24, padding: 24, background: "#0d1d21", border: "1px solid #21474c", textAlign: "center", boxShadow: "0 24px 70px rgba(0,0,0,.45)" }}>
            <div style={{ fontSize: 52, marginBottom: 10 }}>{incoming.kind === "video" ? "📹" : "📞"}</div>
            <h2 style={{ margin: "0 0 8px" }}>مكالمة واردة</h2>
            <p style={{ margin: "0 0 20px", color: "#9ab0ac" }}>{incoming.kind === "video" ? "مكالمة فيديو خاصة" : "مكالمة صوتية خاصة"}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button type="button" onClick={() => void reject()} style={{ border: 0, borderRadius: 14, padding: "12px 20px", background: "#e95062", color: "white", fontWeight: 800 }}>رفض</button>
              <button type="button" onClick={accept} style={{ border: 0, borderRadius: 14, padding: "12px 20px", background: "#18e6ae", color: "#04231b", fontWeight: 800 }}>قبول</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
