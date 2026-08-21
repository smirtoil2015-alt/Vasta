"use client";

import { useState } from "react";
import { reportMessage, reportUser, type VastaReportReason } from "@/lib/vasta-reporting";

const reasons: Array<[VastaReportReason, string]> = [
  ["spam", "رسائل مزعجة أو إعلانات"],
  ["harassment", "إساءة أو مضايقة"],
  ["scam", "احتيال أو نصب"],
  ["inappropriate", "محتوى غير مناسب"],
  ["other", "سبب آخر"],
];

export default function VastaReportDialog({
  reporterId,
  reportedUserId,
  conversationId,
  messageId,
  onClose,
}: {
  reporterId: string;
  reportedUserId: string;
  conversationId?: string;
  messageId?: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<VastaReportReason>("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true); setError("");
    try {
      if (conversationId && messageId) await reportMessage(reporterId, reportedUserId, conversationId, messageId, reason, details);
      else await reportUser(reporterId, reportedUserId, reason, details);
      setDone(true);
    } catch (e) {
      console.error(e);
      setError("تعذر إرسال البلاغ الآن.");
    } finally { setBusy(false); }
  }

  return <div dir="rtl" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "grid", placeItems: "center", zIndex: 1000, padding: 20 }}>
    <section style={{ width: "min(440px,100%)", background: "#0d1d21", color: "#e7f3f1", border: "1px solid #21474c", borderRadius: 22, padding: 22 }}>
      {done ? <><h2>تم إرسال البلاغ ✅</h2><p style={{ color: "#91aaa6" }}>شكرًا لمساعدتك في الحفاظ على أمان Vasta.</p><button onClick={onClose}>إغلاق</button></> : <>
        <h2 style={{ marginTop: 0 }}>إبلاغ</h2>
        <p style={{ color: "#91aaa6" }}>اختر سبب البلاغ.</p>
        <select value={reason} onChange={(e) => setReason(e.target.value as VastaReportReason)} style={{ width: "100%", padding: 12, borderRadius: 12, background: "#09171a", color: "white", border: "1px solid #21474c" }}>{reasons.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} placeholder="تفاصيل إضافية (اختياري)" style={{ width: "100%", minHeight: 110, marginTop: 12, padding: 12, borderRadius: 12, background: "#09171a", color: "white", border: "1px solid #21474c", boxSizing: "border-box" }} />
        {error && <p style={{ color: "#ff7784" }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}><button onClick={onClose}>إلغاء</button><button onClick={() => void submit()} disabled={busy}>{busy ? "إرسال..." : "إرسال البلاغ"}</button></div>
      </>}
    </section>
  </div>;
}
