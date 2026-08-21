import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase";

const VOICE_MAX_BYTES = 10 * 1024 * 1024;

export function chooseVoiceMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? "";
}

export async function uploadVoiceBlob(
  conversationId: string,
  uid: string,
  blob: Blob,
) {
  if (blob.size === 0) throw new Error("empty-voice");
  if (blob.size > VOICE_MAX_BYTES) throw new Error("voice-too-large");
  const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
  const fileId = `${Date.now()}-${crypto.randomUUID()}`;
  const storagePath = `conversations/${conversationId}/${uid}/voice/${fileId}.${extension}`;
  const objectRef = ref(storage, storagePath);
  await uploadBytes(objectRef, blob, { contentType: blob.type || "audio/webm" });
  const audioUrl = await getDownloadURL(objectRef);
  return { audioUrl, storagePath, mimeType: blob.type || "audio/webm" };
}
