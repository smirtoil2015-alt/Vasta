"use client";

import { useEffect, useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function VastaGoogleLogin() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const enhance = () => {
      const form = document.querySelector<HTMLElement>(".auth-form");
      const button = document.querySelector<HTMLElement>("#vasta-google-login");
      return Boolean(form || button);
    };
    if (enhance()) return;
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
      setError("تعذر تسجيل الدخول عبر Google. فعّل Google من Firebase Authentication ثم أعد المحاولة.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vasta-google-login-wrap">
      <button
        id="vasta-google-login"
        type="button"
        className="vasta-google-login"
        onClick={() => void signIn()}
        disabled={busy}
      >
        <span className="vasta-google-icon">G</span>
        {busy ? "جارٍ الدخول..." : "الدخول مجانًا عبر Google"}
      </button>
      {error && <div className="vasta-google-error">{error}</div>}
    </div>
  );
}
