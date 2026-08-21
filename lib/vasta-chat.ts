import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";

export type VastaProfile = {
  uid: string;
  phoneNumber: string;
  displayName: string;
  photoURL: string;
  bio: string;
  updatedAt: unknown;
};

export type VastaConversation = {
  id: string;
  participants: string[];
  names: Record<string, string>;
  lastMessage: string;
  lastMessageAt: number;
};

export type VastaMessage = {
  id: string;
  text: string;
  senderId: string;
  createdAt: number;
  kind?: "text" | "voice" | "media";
  audioUrl?: string;
  mediaUrl?: string;
  storagePath?: string;
  durationMs?: number;
  mimeType?: string;
  mediaKind?: "image" | "video" | "file";
  fileName?: string;
  sizeBytes?: number;
};

export function normalizePhone(phone: string) {
  return phone.replace(/[^+\d]/g, "");
}

export function phoneIndexId(phone: string) {
  return encodeURIComponent(normalizePhone(phone));
}

export function conversationIdFor(a: string, b: string) {
  return [a, b].sort().join("__");
}

export async function ensureProfile(user: User): Promise<VastaProfile> {
  const ref = doc(db, "users", user.uid);
  const snapshot = await getDoc(ref);
  const existing = snapshot.exists() ? (snapshot.data() as VastaProfile) : null;
  const profile: VastaProfile = existing ?? {
    uid: user.uid,
    phoneNumber: normalizePhone(user.phoneNumber ?? ""),
    displayName: "مستخدم Vasta",
    photoURL: user.photoURL ?? "",
    bio: "متاح على Vasta",
    updatedAt: serverTimestamp(),
  };
  if (!snapshot.exists()) await setDoc(ref, profile);
  const phoneNumber = normalizePhone(user.phoneNumber ?? profile.phoneNumber);
  if (phoneNumber) await setDoc(doc(db, "phoneIndex", phoneIndexId(phoneNumber)), { uid: user.uid, displayName: profile.displayName });
  return { ...profile, phoneNumber };
}

export function watchConversations(uid: string, onChange: (items: VastaConversation[]) => void, onError?: (error: Error) => void): Unsubscribe {
  const q = query(collection(db, "conversations"), where("participants", "array-contains", uid), orderBy("lastMessageAt", "desc"));
  return onSnapshot(q, (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<VastaConversation, "id">) }))), (error) => onError?.(error));
}

export function watchMessages(conversationId: string, onChange: (items: VastaMessage[]) => void, onError?: (error: Error) => void): Unsubscribe {
  const q = query(collection(db, "conversations", conversationId, "messages"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<VastaMessage, "id">) }))), (error) => onError?.(error));
}

export function watchTyping(conversationId: string, onChange: (uid: string | null) => void, currentUid: string): Unsubscribe {
  return onSnapshot(collection(db, "conversations", conversationId, "typing"), (snapshot) => {
    const active = snapshot.docs
      .map((item) => ({ uid: item.id, ...(item.data() as { active?: boolean }) }))
      .find((item) => item.uid !== currentUid && item.active);
    onChange(active?.uid ?? null);
  });
}

export function watchReadReceipts(conversationId: string, messageId: string, onChange: (uids: string[]) => void): Unsubscribe {
  return onSnapshot(collection(db, "conversations", conversationId, "messages", messageId, "receipts"), (snapshot) => onChange(snapshot.docs.map((item) => item.id)));
}

export async function setTyping(conversationId: string, uid: string, active: boolean) {
  const ref = doc(db, "conversations", conversationId, "typing", uid);
  if (!active) return deleteDoc(ref);
  return setDoc(ref, { active: true, updatedAt: serverTimestamp() });
}

export async function markMessageRead(conversationId: string, messageId: string, uid: string) {
  return setDoc(doc(db, "conversations", conversationId, "messages", messageId, "receipts", uid), { readAt: serverTimestamp() }, { merge: true });
}

export async function findProfileByPhone(phone: string): Promise<VastaProfile | null> {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const indexSnapshot = await getDoc(doc(db, "phoneIndex", phoneIndexId(normalized)));
  if (!indexSnapshot.exists()) return null;
  const { uid } = indexSnapshot.data() as { uid: string };
  const profileSnapshot = await getDoc(doc(db, "users", uid));
  return profileSnapshot.exists() ? (profileSnapshot.data() as VastaProfile) : null;
}

export async function openConversation(current: VastaProfile, other: VastaProfile) {
  if (current.uid === other.uid) return null;
  const id = conversationIdFor(current.uid, other.uid);
  const payload: Omit<VastaConversation, "id"> = {
    participants: [current.uid, other.uid],
    names: { [current.uid]: current.displayName, [other.uid]: other.displayName },
    lastMessage: "ابدأ المحادثة ✨",
    lastMessageAt: Date.now(),
  };
  await setDoc(doc(db, "conversations", id), payload, { merge: true });
  return { id, ...payload };
}

export async function sendTextMessage(conversationId: string, sender: VastaProfile, text: string) {
  const value = text.trim();
  if (!value) return;
  const now = Date.now();
  await addDoc(collection(db, "conversations", conversationId, "messages"), { kind: "text", text: value, senderId: sender.uid, createdAt: now });
  await setDoc(doc(db, "conversations", conversationId), { lastMessage: value, lastMessageAt: now }, { merge: true });
}

export async function sendVoiceMessage(
  conversationId: string,
  sender: VastaProfile,
  audioUrl: string,
  storagePath: string,
  durationMs: number,
  mimeType: string,
) {
  const now = Date.now();
  await addDoc(collection(db, "conversations", conversationId, "messages"), {
    kind: "voice",
    text: "",
    senderId: sender.uid,
    createdAt: now,
    audioUrl,
    storagePath,
    durationMs,
    mimeType,
  });
  await setDoc(doc(db, "conversations", conversationId), { lastMessage: "🎤 رسالة صوتية", lastMessageAt: now }, { merge: true });
}
