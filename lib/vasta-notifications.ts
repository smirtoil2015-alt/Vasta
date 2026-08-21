import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type NotificationPreference = {
  enabled: boolean;
  updatedAt?: unknown;
};

export async function getNotificationPreference(uid: string): Promise<boolean> {
  const snapshot = await getDoc(doc(db, "users", uid, "settings", "notifications"));
  return snapshot.exists() ? Boolean((snapshot.data() as NotificationPreference).enabled) : true;
}

export async function setNotificationPreference(uid: string, enabled: boolean) {
  return setDoc(doc(db, "users", uid, "settings", "notifications"), { enabled, updatedAt: serverTimestamp() }, { merge: true });
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "default") return Notification.requestPermission();
  return Notification.permission;
}

export function showForegroundNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  new Notification(title, { body, icon: "/icon.svg" });
}

export async function registerDeviceTokenPlaceholder(uid: string, token: string) {
  if (!token) return;
  await setDoc(doc(db, "users", uid, "devices", token), {
    token,
    platform: "web",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
