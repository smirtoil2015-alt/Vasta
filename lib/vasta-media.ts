import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_PREFIXES = ["image/", "video/"];

export function validateMediaFile(file: File) {
  if (file.size > MAX_FILE_BYTES) throw new Error("حجم الملف يتجاوز 25MB.");
  if (!ALLOWED_PREFIXES.some((prefix) => file.type.startsWith(prefix)) && file.type !== "application/pdf") {
    throw new Error("هذا النوع من الملفات غير مدعوم حاليًا.");
  }
}

export async function uploadConversationMedia(conversationId: string, uid: string, file: File) {
  validateMediaFile(file);
  const conversation = await getDoc(doc(db, "conversations", conversationId));
  if (!conversation.exists() || !(conversation.data().participants as string[]).includes(uid)) {
    throw new Error("لا تملك صلاحية رفع ملف إلى هذه المحادثة.");
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  const objectPath = `conversations/${conversationId}/${uid}/${crypto.randomUUID()}-${safeName}`;
  const objectRef = ref(storage, objectPath);
  const snapshot = await uploadBytes(objectRef, file, { contentType: file.type });
  return { url: await getDownloadURL(snapshot.ref), path: objectPath, fileName: file.name, mimeType: file.type, size: file.size };
}
