"use client";

import { useEffect, useRef, useState } from "react";
import { mediaKind, validateMedia, VASTA_MEDIA_MAX_BYTES } from "@/lib/vasta-media";

export type VastaMediaSelection = {
  file: File;
  kind: "image" | "video" | "file";
  previewUrl: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (selection: VastaMediaSelection) => void;
};

export default function VastaMediaPicker({ open, onClose, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selection, setSelection] = useState<VastaMediaSelection | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (selection?.previewUrl) URL.revokeObjectURL(selection.previewUrl);
    };
  }, [selection]);

  if (!open) return null;

  function choose(file: File) {
    setError("");
    try {
      const kind = validateMedia(file);
      const next = { file, kind, previewUrl: URL.createObjectURL(file) };
      setSelection(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : `الملف يجب ألا يتجاوز ${VASTA_MEDIA_MAX_BYTES / 1024 / 1024}MB.`);
    }
  }

  function confirm() {
    if (!selection) return;
    onSelect(selection);
    setSelection(null);
    onClose();
  }

  function cancel() {
    if (selection?.previewUrl) URL.revokeObjectURL(selection.previewUrl);
    setSelection(null);
    setError("");
    onClose();
  }

  const kind = selection ? mediaKind(selection.file.type) : null;

  return (
    <div className="vasta-media-backdrop" role="dialog" aria-modal="true" aria-label="إرسال وسائط">
      <section className="vasta-media-modal">
        <header><strong>إرسال وسائط</strong><button onClick={cancel} aria-label="إغلاق">×</button></header>
        {!selection ? (
          <div className="media-dropzone">
            <button className="primary-button" onClick={() => inputRef.current?.click()}>📎 اختيار ملف</button>
            <input ref={inputRef} hidden type="file" accept="image/*,video/*,application/pdf" onChange={(e) => { const file = e.target.files?.[0]; if (file) choose(file); e.currentTarget.value = ""; }} />
            <span>صور، فيديو أو PDF — حتى 25MB</span>
          </div>
        ) : (
          <div className="media-preview">
            {kind === "image" && <img src={selection.previewUrl} alt={selection.file.name} />}
            {kind === "video" && <video src={selection.previewUrl} controls />}
            {kind === "file" && <div className="pdf-preview">📄<strong>{selection.file.name}</strong></div>}
            <div className="media-meta"><strong>{selection.file.name}</strong><span>{(selection.file.size / 1024 / 1024).toFixed(1)}MB</span></div>
            <div className="media-actions"><button className="secondary-button" onClick={cancel}>إلغاء</button><button className="primary-button" onClick={confirm}>إرسال</button></div>
          </div>
        )}
        {error && <div className="error-box">{error}</div>}
      </section>
    </div>
  );
}
