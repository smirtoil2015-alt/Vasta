"use client";

import { useEffect, useState } from "react";
import { onSnapshot, collection, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function VastaMessageStatus({ conversationId, messageId, peerId }: { conversationId: string; messageId: string; peerId: string }) {
  const [read, setRead] = useState(false);

  useEffect(() => {
    if (!conversationId || !messageId || !peerId) return;
    const ref = collection(db, "conversations", conversationId, "messages", messageId, "receipts");
    const stop: Unsubscribe = onSnapshot(ref, (snapshot) => setRead(snapshot.docs.some((item) => item.id === peerId)));
    return stop;
  }, [conversationId, messageId, peerId]);

  return <span aria-label={read ? "تمت القراءة" : "تم الإرسال"} style={{ fontSize: 12, marginInlineStart: 6, letterSpacing: -2 }}>{read ? "✓✓" : "✓"}</span>;
}
