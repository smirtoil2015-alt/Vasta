import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function isBlockedBy(blockerId: string, targetId: string): Promise<boolean> {
  const snapshot = await getDoc(doc(db, "users", blockerId, "blocks", targetId));
  return snapshot.exists();
}

export async function blockUser(blockerId: string, targetId: string) {
  if (!blockerId || !targetId || blockerId === targetId) throw new Error("invalid_block_target");
  return setDoc(doc(db, "users", blockerId, "blocks", targetId), { blockedAt: Date.now() });
}

export async function unblockUser(blockerId: string, targetId: string) {
  if (!blockerId || !targetId || blockerId === targetId) throw new Error("invalid_block_target");
  return deleteDoc(doc(db, "users", blockerId, "blocks", targetId));
}
