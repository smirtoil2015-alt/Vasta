import { updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const MAX_NAME = 60;
const MAX_BIO = 160;
const MAX_CITY = 60;

export function normalizeProfileText(value: string, max: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

export async function updateVastaProfile(input: { displayName: string; bio: string; photoURL?: string; city?: string }) {
  const user = auth.currentUser;
  if (!user) throw new Error("auth");
  const displayName = normalizeProfileText(input.displayName, MAX_NAME) || "مستخدم Vasta";
  const bio = normalizeProfileText(input.bio, MAX_BIO);
  const city = normalizeProfileText(input.city ?? "", MAX_CITY);
  const photoURL = (input.photoURL ?? "").trim().slice(0, 1000);
  await updateProfile(user, { displayName, photoURL: photoURL || null });
  await setDoc(doc(db, "users", user.uid), { displayName, bio, city, photoURL, updatedAt: Date.now(), phonePrivate: true }, { merge: true });
  return { displayName, bio, city, photoURL };
}

export async function setReadReceiptsPreference(uid: string, enabled: boolean) {
  return setDoc(doc(db, "users", uid, "settings", "privacy"), { readReceipts: enabled, updatedAt: Date.now() }, { merge: true });
}
