import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type VastaCallHistory = {
  id: string;
  conversationId: string;
  initiatorId: string;
  peerId: string;
  kind: "audio" | "video";
  status: "ringing" | "answered" | "missed" | "ended";
  startedAt?: unknown;
  endedAt?: unknown;
  durationSec?: number;
};

export async function recordCallHistory(call: Omit<VastaCallHistory, "id" | "startedAt">) {
  return addDoc(collection(db, "callHistory"), { ...call, startedAt: serverTimestamp() });
}

export function watchPrivateCallHistory(uid: string, onChange: (items: VastaCallHistory[]) => void): Unsubscribe {
  const q = query(collection(db, "callHistory"), where("initiatorId", "==", uid), orderBy("startedAt", "desc"));
  return onSnapshot(q, (snapshot) => onChange(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VastaCallHistory, "id">) }))));
}
