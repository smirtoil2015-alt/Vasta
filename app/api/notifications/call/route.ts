import { NextResponse } from "next/server";
import { adminAuth, adminDb, adminMessaging } from "@/lib/vasta-admin";

export const runtime = "nodejs";

type Body = {
  conversationId?: string;
  callId?: string;
  kind?: "audio" | "video";
};

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(authHeader.slice("Bearer ".length).trim());
    const callerId = decoded.uid;
    const payload = (await request.json()) as Body;
    if (!payload.conversationId || !payload.callId || !payload.kind) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const conversation = await adminDb.doc(`conversations/${payload.conversationId}`).get();
    if (!conversation.exists) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    const conversationData = conversation.data() as { participants?: string[]; names?: Record<string, string> };
    const participants = conversationData.participants ?? [];
    if (participants.length !== 2 || !participants.includes(callerId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const callRef = adminDb.doc(`conversations/${payload.conversationId}/calls/${payload.callId}`);
    const call = await callRef.get();
    if (!call.exists) return NextResponse.json({ error: "Call not found" }, { status: 404 });
    const callData = call.data() as { callerId?: string; calleeId?: string; kind?: "audio" | "video"; status?: string };
    if (callData.callerId !== callerId || callData.calleeId == null || callData.kind !== payload.kind || callData.status !== "ringing") {
      return NextResponse.json({ error: "Invalid call" }, { status: 400 });
    }
    if (!participants.includes(callData.calleeId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const preference = await adminDb.doc(`users/${callData.calleeId}/settings/notifications`).get();
    if (preference.exists && preference.data()?.enabled === false) return NextResponse.json({ sent: 0 });

    const devices = await adminDb.collection(`users/${callData.calleeId}/devices`).get();
    const tokens = devices.docs.map((item) => item.id).filter(Boolean).slice(0, 500);
    if (!tokens.length) return NextResponse.json({ sent: 0 });

    const callerName = conversationData.names?.[callerId] || "Vasta";
    const title = payload.kind === "video" ? "مكالمة فيديو واردة" : "مكالمة صوتية واردة";
    const result = await adminMessaging.sendEachForMulticast({
      tokens,
      notification: { title, body: `من ${callerName}` },
      data: { type: "incoming-call", conversationId: payload.conversationId, callId: payload.callId, kind: payload.kind },
    });

    return NextResponse.json({ sent: result.successCount, failed: result.failureCount });
  } catch (error) {
    console.error("Vasta call notification error", error);
    return NextResponse.json({ error: "Call notification service unavailable" }, { status: 500 });
  }
}
