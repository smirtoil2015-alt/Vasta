"use client";

import { useEffect, useState } from "react";
import { watchReadReceipts } from "@/lib/vasta-chat";

export default function VastaReadReceipt({ conversationId, messageId, peerId }: { conversationId: string; messageId: string; peerId: string }) {
  const [read, setRead] = useState(false);

  useEffect(() => {
    if (!conversationId || !messageId || !peerId) return;
    return watchReadReceipts(conversationId, messageId, (uids) => setRead(uids.includes(peerId)));
  }, [conversationId, messageId, peerId]);

  return (
    <span aria-label={read ? "تمت القراءة" : "تم الإرسال"} title={read ? "تمت القراءة" : "تم الإرسال"} style={{ fontSize: 11, letterSpacing: -2, marginInlineStart: 5, color: read ? "#18e6ae" : "#6f8985" }}>
      {read ? "✓✓" : "✓"}
    </span>
  );
}
