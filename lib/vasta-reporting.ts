import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type VastaReportReason = "spam" | "harassment" | "scam" | "inappropriate" | "other";

export async function reportUser(reporterId: string, reportedUserId: string, reason: VastaReportReason, details = "") {
  if (!reporterId || !reportedUserId || reporterId === reportedUserId) throw new Error("invalid_report");
  return addDoc(collection(db, "reports"), {
    reporterId,
    reportedUserId,
    reason,
    details: details.trim().slice(0, 1000),
    targetType: "user",
    createdAt: serverTimestamp(),
    status: "open",
  });
}

export async function reportMessage(
  reporterId: string,
  reportedUserId: string,
  conversationId: string,
  messageId: string,
  reason: VastaReportReason,
  details = "",
) {
  if (!reporterId || !reportedUserId || !conversationId || !messageId || reporterId === reportedUserId) throw new Error("invalid_report");
  return addDoc(collection(db, "reports"), {
    reporterId,
    reportedUserId,
    conversationId,
    messageId,
    reason,
    details: details.trim().slice(0, 1000),
    targetType: "message",
    createdAt: serverTimestamp(),
    status: "open",
  });
}
