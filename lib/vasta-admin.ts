import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function createAdminApp() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (raw) {
    const value = JSON.parse(raw) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };

    return initializeApp({
      credential: cert({
        projectId: value.project_id,
        clientEmail: value.client_email,
        privateKey: value.private_key.replace(/\\n/g, "\n"),
      }),
    });
  }

  return initializeApp();
}

const app = getApps()[0] ?? createAdminApp();

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
export const adminMessaging = getMessaging(app);
