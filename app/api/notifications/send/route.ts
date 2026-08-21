import { NextResponse } from "next/server";
import { adminAuth, adminDb, adminMessaging } from "@/lib/vasta-admin";

export const runtime = "nodejs";

type Body = {
  conversationId?: string;
  body?: string;
};

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const idToken = authHeader.slice("Bearer ".length).trim();
    const decoded = await adminAuth.verifyIdToken(idToken);
    const senderId = decoded.uid;
    const payload = (await request.json()) as Body;
    if (!payload.conversationId || !payload.body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const conversation = await adminDb.doc(`conversations/${payload.conversationId}`).get();
    if (!conversation.exists) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    const data = conversation.data() as { participants?: string[]; names?: Record<string, string> };
    const participants = data.participants ?? [];
    if (!participants.includes(senderId) || participants.length !== 2) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const recipientId = participants.find((uid) => uid !== senderId);
    if (!recipientId) return NextResponse.json({ error: "Recipient not found" }, { status: 400 });

    const preference = await adminDb.doc(`users/${recipientId}/settings/notifications`).get();
    if (preference.exists && preference.data()?.enabled === false) return NextResponse.json({ sent: 0 });

    const devices = await adminDb.collection(`users/${recipientId}/devices`).get();
    const tokens = devices.docs.map((item) => item.id).filter(Boolean).slice(0, 500);
    if (!tokens.length) return NextResponse.json({ sent: 0 });

    const senderName = data.names?.[senderId] || "رسالة جديدة";
    const result = await adminMessaging.sendEachForMulticast({
      tokens,
      notification: { title: senderName, body: payload.body.slice(0, 240) },
      data: { type: "private-message", conversationId: payload.conversationId },
    });

    return NextResponse.json({ sent: result.successCount, failed: result.failureCount });
  } catch (error) {
    console.error("Vasta notification error", error);
    return NextResponse.json({ error: "Notification service unavailable" }, { status: 500 });
  }
}
