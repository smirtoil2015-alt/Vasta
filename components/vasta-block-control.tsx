"use client";

import { useEffect, useState } from "react";
import { blockUser, isBlockedBy, unblockUser } from "@/lib/vasta-blocks";

export default function VastaBlockControl({ uid, peerId }: { uid: string; peerId: string }) {
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid || !peerId) return;
    let active = true;
    void isBlockedBy(uid, peerId).then((value) => { if (active) setBlocked(value); });
    return () => { active = false; };
  }, [uid, peerId]);

  async function toggle() {
    setBusy(true);
    try {
      if (blocked) await unblockUser(uid, peerId);
      else await blockUser(uid, peerId);
      setBlocked(!blocked);
    } finally {
      setBusy(false);
    }
  }

  if (!uid || !peerId) return null;
  return (
    <button onClick={() => void toggle()} disabled={busy} aria-label={blocked ? "فك الحظر" : "حظر المستخدم"}
      style={{ border: "1px solid #29474b", background: "#102226", color: blocked ? "#18e6ae" : "#ff8f8f", borderRadius: 12, padding: "8px 10px", cursor: busy ? "wait" : "pointer" }}>
      {busy ? "…" : blocked ? "🔓 فك الحظر" : "🚫 حظر"}
    </button>
  );
}
