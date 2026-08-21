import { updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const MAX_NAME = 60;
const MAX_BIO = 160;

export function normalizeProfileText(value: string, max: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

export async function updateVastaProfile(input: { displayName: string; bio: string; photoURL?: string }) {
  const user = auth.currentUser;
  if (!user) throw new Error("auth");
  const displayName = normalizeProfileText(input.displayName, MAX_NAME) || "مستخدم Vasta";
  const bio = normalizeProfileText(input.bio, MAX_BIO);
  const photoURL = (input.photoURL ?? "").trim().slice(0, 1000);
  await updateProfile(user, { displayName, photoURL: photoURL || null });
  await setDoc(doc(db, "users", user.uid), { displayName, bio, photoURL, updatedAt: Date.now() }, { merge: true });
  return { displayName, bio, photoURL };
}

export async function setReadReceiptsPreference(uid: string, enabled: boolean) {
  return setDoc(doc(db, "users", uid, "settings", "privacy"), { readReceipts: enabled, updatedAt: Date.now() }, { merge: true });
}
