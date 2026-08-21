import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured.");
  const value = JSON.parse(raw) as { project_id: string; client_email: string; private_key: string };
  return {
    projectId: value.project_id,
    clientEmail: value.client_email,
    privateKey: value.private_key.replace(/\\n/g, "\n"),
  };
}

const app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount()) });

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
export const adminMessaging = getMessaging(app);
