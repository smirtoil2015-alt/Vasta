"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { onSnapshot, collection, type Unsubscribe } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { setTyping } from "@/lib/vasta-chat";

export default function VastaTypingIndicator({ conversationId }: { conversationId: string }) {
  const [typing, setTypingPeer] = useState(false);

  useEffect(() => {
    if (!conversationId) return;
    let uid = auth.currentUser?.uid;
    let stopTypingWatch: Unsubscribe | null = null;
    let clearTimer: ReturnType<typeof setTimeout> | null = null;

    const stopWatch = () => {
      stopTypingWatch?.();
      stopTypingWatch = null;
    };
    const subscribe = (currentUid: string) => {
      uid = currentUid;
      stopWatch();
      stopTypingWatch = onSnapshot(collection(db, "conversations", conversationId, "typing"), (snapshot) => {
        const active = snapshot.docs.some((item) => item.id !== currentUid && Boolean(item.data()?.active));
        setTypingPeer(active);
      });
    };

    const stopAuth = onAuthStateChanged(auth, (user) => {
      if (user) subscribe(user.uid);
      else { stopWatch(); setTypingPeer(false); }
    });

    const onInput = (event: Event) => {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (!target || !target.placeholder.includes("اكتب رسالة")) return;
      const currentUid = uid;
      if (!currentUid) return;
      const active = target.value.trim().length > 0;
      void setTyping(conversationId, currentUid, active);
      if (clearTimer) clearTimeout(clearTimer);
      if (active) clearTimer = setTimeout(() => void setTyping(conversationId, currentUid, false), 1200);
    };

    document.addEventListener("input", onInput);
    return () => {
      stopAuth();
      stopWatch();
      document.removeEventListener("input", onInput);
      if (clearTimer) clearTimeout(clearTimer);
      if (uid) void setTyping(conversationId, uid, false);
    };
  }, [conversationId]);

  if (!typing) return null;
  return <div dir="rtl" style={{ padding: "10px 14px", color: "#18e6ae", fontSize: 12 }}>يكتب الآن…</div>;
}
