import { addDoc, collection, doc, getDoc, onSnapshot, setDoc, where, query, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { VastaProfile } from "@/lib/vasta-chat";

export type VastaGroup = {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  memberIds: string[];
  createdAt: number;
};

export async function createGroup(owner: VastaProfile, name: string, members: VastaProfile[]) {
  const cleanName = name.trim();
  const memberIds = Array.from(new Set([owner.uid, ...members.map((member) => member.uid)]));
  if (!cleanName || memberIds.length < 2 || memberIds.length > 100) throw new Error("invalid-group");
  const ref = doc(collection(db, "groups"));
  const group: Omit<VastaGroup, "id"> = {
    name: cleanName,
    description: "مجموعة Vasta",
    ownerId: owner.uid,
    memberIds,
    createdAt: Date.now(),
  };
  await setDoc(ref, group);
  return { id: ref.id, ...group } satisfies VastaGroup;
}

export function watchMyGroups(uid: string, onChange: (groups: VastaGroup[]) => void, onError?: (error: Error) => void): Unsubscribe {
  const q = query(collection(db, "groups"), where("memberIds", "array-contains", uid));
  return onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<VastaGroup, "id">) })));
  }, (error) => onError?.(error));
}

export async function addGroupMember(groupId: string, requester: VastaProfile, member: VastaProfile) {
  const ref = doc(db, "groups", groupId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("group-not-found");
  const group = snapshot.data() as VastaGroup;
  if (group.ownerId !== requester.uid) throw new Error("not-owner");
  const memberIds = Array.from(new Set([...group.memberIds, member.uid]));
  if (memberIds.length > 100) throw new Error("group-full");
  await setDoc(ref, { memberIds }, { merge: true });
}

export async function sendGroupText(groupId: string, sender: VastaProfile, text: string) {
  const value = text.trim();
  if (!value) return;
  const groupRef = doc(db, "groups", groupId);
  const groupSnapshot = await getDoc(groupRef);
  if (!groupSnapshot.exists()) throw new Error("group-not-found");
  const group = groupSnapshot.data() as VastaGroup;
  if (!group.memberIds.includes(sender.uid)) throw new Error("not-member");
  const now = Date.now();
  await addDoc(collection(db, "groups", groupId, "messages"), { text: value, senderId: sender.uid, createdAt: now });
  await setDoc(groupRef, { lastMessage: value, lastMessageAt: now }, { merge: true });
}
