"use client";

import { useRef } from "react";

export function MediaPicker({ onPick, disabled = false }: { onPick: (file: File) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <button type="button" className="attach" disabled={disabled} onClick={() => inputRef.current?.click()} aria-label="إرفاق صورة أو فيديو أو ملف">
        ＋
      </button>
      <input
        ref={inputRef}
        hidden
        type="file"
        accept="image/*,video/*,application/pdf"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onPick(file);
          event.currentTarget.value = "";
        }}
      />
    </>
  );
}
