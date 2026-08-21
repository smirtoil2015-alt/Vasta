import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, addDoc, where, type Unsubscribe } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type VastaCallKind = "audio" | "video";
export type VastaCall = {
  id: string;
  conversationId: string;
  callerId: string;
  calleeId: string;
  kind: VastaCallKind;
  status: "ringing" | "active" | "ended";
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
};

export async function createCall(conversationId: string, callerId: string, calleeId: string, kind: VastaCallKind, offer: RTCSessionDescriptionInit) {
  const ref = doc(collection(db, "conversations", conversationId, "calls"));
  await setDoc(ref, { callerId, calleeId, kind, status: "ringing", offer, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) {
      await fetch("/api/notifications/call", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId, callId: ref.id, kind }),
      });
    }
  } catch (error) {
    console.warn("Vasta call push notification failed", error);
  }
  return ref.id;
}

export function watchCall(conversationId: string, callId: string, onChange: (call: VastaCall | null) => void): Unsubscribe {
  return onSnapshot(doc(db, "conversations", conversationId, "calls", callId), (snapshot) => {
    onChange(snapshot.exists() ? ({ id: snapshot.id, conversationId, ...(snapshot.data() as Omit<VastaCall, "id" | "conversationId">) }) : null);
  });
}

export function watchIncomingCall(conversationId: string, calleeId: string, onChange: (call: VastaCall | null) => void): Unsubscribe {
  const q = query(collection(db, "conversations", conversationId, "calls"), where("calleeId", "==", calleeId), where("status", "==", "ringing"));
  return onSnapshot(q, (snapshot) => {
    const item = snapshot.docs[0];
    onChange(item ? ({ id: item.id, conversationId, ...(item.data() as Omit<VastaCall, "id" | "conversationId">) }) : null);
  });
}

export async function answerCall(conversationId: string, callId: string, answer: RTCSessionDescriptionInit) {
  await updateDoc(doc(db, "conversations", conversationId, "calls", callId), { answer, status: "active", updatedAt: serverTimestamp() });
}

export async function setCallStatus(conversationId: string, callId: string, status: VastaCall["status"]) {
  await updateDoc(doc(db, "conversations", conversationId, "calls", callId), { status, updatedAt: serverTimestamp() });
}

export async function addIceCandidate(conversationId: string, callId: string, side: "caller" | "callee", candidate: RTCIceCandidateInit) {
  await addDoc(collection(db, "conversations", conversationId, "calls", callId, `${side}Candidates`), { candidate, createdAt: serverTimestamp() });
}

export function watchIceCandidates(conversationId: string, callId: string, side: "caller" | "callee", onCandidate: (candidate: RTCIceCandidateInit) => void): Unsubscribe {
  return onSnapshot(collection(db, "conversations", conversationId, "calls", callId, `${side}Candidates`), (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const data = change.doc.data() as { candidate?: RTCIceCandidateInit };
        if (data.candidate) onCandidate(data.candidate);
      }
    });
  });
}
