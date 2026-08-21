import {
  addDoc,
  collection,
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
};

export function normalizePhone(phone: string) {
  return phone.replace(/[^+\d]/g, "");
}

export function conversationIdFor(a: string, b: string) {
  return [a, b].sort().join("__");
}

export async function ensureProfile(user: User): Promise<VastaProfile> {
  const ref = doc(db, "users", user.uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) return snapshot.data() as VastaProfile;

  const profile: VastaProfile = {
    uid: user.uid,
    phoneNumber: normalizePhone(user.phoneNumber ?? ""),
    displayName: "مستخدم Vasta",
    photoURL: user.photoURL ?? "",
    bio: "متاح على Vasta",
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, profile);
  return profile;
}

export function watchConversations(
  uid: string,
  onChange: (items: VastaConversation[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", uid),
    orderBy("lastMessageAt", "desc"),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onChange(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<VastaConversation, "id">),
        })),
      );
    },
    (error) => onError?.(error),
  );
}

export function watchMessages(
  conversationId: string,
  onChange: (items: VastaMessage[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, "conversations", conversationId, "messages"),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onChange(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<VastaMessage, "id">),
        })),
      );
    },
    (error) => onError?.(error),
  );
}

export async function findProfileByPhone(phone: string) {
  const normalized = normalizePhone(phone);
  const q = query(collection(db, "users"), where("phoneNumber", "==", normalized));
  const snapshot = await import("firebase/firestore").then(({ getDocs }) => getDocs(q));
  const first = snapshot.docs[0];
  return first ? (first.data() as VastaProfile) : null;
}

export async function openConversation(current: VastaProfile, other: VastaProfile) {
  if (current.uid === other.uid) return null;
  const id = conversationIdFor(current.uid, other.uid);
  const payload: Omit<VastaConversation, "id"> = {
    participants: [current.uid, other.uid],
    names: {
      [current.uid]: current.displayName,
      [other.uid]: other.displayName,
    },
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
  await addDoc(collection(db, "conversations", conversationId, "messages"), {
    text: value,
    senderId: sender.uid,
    createdAt: now,
  });
  await setDoc(
    doc(db, "conversations", conversationId),
    { lastMessage: value, lastMessageAt: now },
    { merge: true },
  );
}
