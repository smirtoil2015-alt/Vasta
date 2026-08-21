"use client";

import { useEffect, useState } from "react";
import { onSnapshot, collection, type Unsubscribe } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function VastaTypingIndicator({ conversationId }: { conversationId: string }) {
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !conversationId) return;
    const stop: Unsubscribe = onSnapshot(collection(db, "conversations", conversationId, "typing"), (snapshot) => {
      const active = snapshot.docs.some((item) => item.id !== uid && Boolean(item.data()?.active));
      setTyping(active);
    });
    return stop;
  }, [conversationId]);

  if (!typing) return null;
  return <div dir="rtl" style={{ padding: "0 16px 8px", color: "#18e6ae", fontSize: 12 }}>يكتب الآن…</div>;
}
