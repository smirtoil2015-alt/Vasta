import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { addDoc, collection, doc, setDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import type { VastaProfile } from "@/lib/vasta-chat";

export type VastaMediaKind = "image" | "video" | "file";

export const VASTA_MEDIA_MAX_BYTES = 25 * 1024 * 1024;

export function mediaKind(type: string): VastaMediaKind | null {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type === "application/pdf") return "file";
  return null;
}

export function validateMedia(file: File) {
  const kind = mediaKind(file.type);
  if (!kind) throw new Error("Vasta يسمح بالصور والفيديو وملفات PDF فقط في هذه المرحلة.");
  if (file.size > VASTA_MEDIA_MAX_BYTES) throw new Error("حجم الملف يتجاوز 25MB.");
  return kind;
}

export async function sendMediaMessage(
  conversationId: string,
  sender: VastaProfile,
  file: File,
  caption = "",
) {
  const kind = validateMedia(file);
  const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 120) || "file";
  const storagePath = `conversations/${conversationId}/${sender.uid}/media/${crypto.randomUUID()}-${safeName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, { contentType: file.type });
  const url = await getDownloadURL(storageRef);
  const now = Date.now();
  await addDoc(collection(db, "conversations", conversationId, "messages"), {
    kind: "media",
    mediaKind: kind,
    text: caption.trim(),
    senderId: sender.uid,
    createdAt: now,
    mediaUrl: url,
    storagePath,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  });
  await setDoc(doc(db, "conversations", conversationId), {
    lastMessage: kind === "image" ? "🖼️ صورة" : kind === "video" ? "🎬 فيديو" : "📄 ملف",
    lastMessageAt: now,
  }, { merge: true });
  return { kind, url, storagePath, fileName: file.name };
}
