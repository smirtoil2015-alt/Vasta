import { doc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type VastaPresence = {
  uid: string;
  online: boolean;
  lastSeenAt?: unknown;
};

export async function setPresence(uid: string, online: boolean) {
  return setDoc(doc(db, "presence", uid), {
    uid,
    online,
    lastSeenAt: online ? serverTimestamp() : serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export function watchPresence(uid: string, onChange: (presence: VastaPresence | null) => void, onError?: (error: Error) => void): Unsubscribe {
  return onSnapshot(doc(db, "presence", uid), (snapshot) => {
    onChange(snapshot.exists() ? (snapshot.data() as VastaPresence) : null);
  }, (error) => onError?.(error));
}

export function presenceLabel(presence: VastaPresence | null, showLastSeen = true) {
  if (!presence) return "غير متصل";
  if (presence.online) return "متصل الآن";
  if (!showLastSeen || !presence.lastSeenAt) return "غير متصل";
  const value = presence.lastSeenAt as { toMillis?: () => number };
  const millis = typeof value?.toMillis === "function" ? value.toMillis() : Date.now();
  return `آخر ظهور ${new Date(millis).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" })}`;
}
