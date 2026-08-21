"use client";

import { useEffect, useRef } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { auth } from "@/lib/firebase";

type CountryOption = { code: string; dial: string };

function setError(message: string) {
  const box = document.querySelector<HTMLElement>(".error-box");
  if (box) box.textContent = message;
}

function getFullPhone(input: HTMLInputElement): string {
  const digits = input.value.replace(/\D/g, "");
  if (input.value.trim().startsWith("+")) return `+${digits}`;
  const select = document.querySelector<HTMLSelectElement>(".vasta-country-picker");
  const dial = select?.selectedOptions[0]?.textContent?.match(/\+(\d+)/)?.[0] ?? "+90";
  return `${dial}${digits}`;
}

function isUsFictionalTestPhone(phone: string) {
  return /^\+1650555\d{4}$/.test(phone);
}

export default function VastaPhoneAuthBridge() {
  const confirmation = useRef<ConfirmationResult | null>(null);
  const recaptcha = useRef<RecaptchaVerifier | null>(null);
  const testMode = useRef(false);
  const attached = useRef(new WeakSet<HTMLFormElement>());

  useEffect(() => {
    const attach = () => {
      const form = document.querySelector<HTMLFormElement>("form.auth-form");
      if (!form || attached.current.has(form)) return;
      attached.current.add(form);

      const handler = async (event: Event) => {
        event.preventDefault();
        event.stopImmediatePropagation();

        const phoneInput = form.querySelector<HTMLInputElement>('input[type="tel"]');
        if (phoneInput) {
          const phone = getFullPhone(phoneInput);
          if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
            setError("اكتب رقم الهاتف بالشكل الصحيح.");
            return;
          }

          setError("");
          try {
            recaptcha.current?.clear();
            recaptcha.current = null;
            testMode.current = isUsFictionalTestPhone(phone);
            auth.settings.appVerificationDisabledForTesting = testMode.current;

            recaptcha.current = new RecaptchaVerifier(auth, "recaptcha-container", {
              size: testMode.current ? "invisible" : "invisible",
              callback: () => undefined,
              "expired-callback": () => setError("انتهت صلاحية التحقق. حاول مرة أخرى."),
            });

            confirmation.current = await signInWithPhoneNumber(auth, phone, recaptcha.current);
            phoneInput.value = phone;
            phoneInput.dispatchEvent(new Event("input", { bubbles: true }));

            const buttons = form.querySelectorAll<HTMLButtonElement>("button");
            const primary = Array.from(buttons).find((button) => !button.type || button.type === "submit");
            if (primary) primary.textContent = "تم إرسال/تجهيز الرمز";

            queueMicrotask(() => setError(""));
          } catch (error) {
            console.error(error);
            const code = error instanceof Error && "code" in error ? String((error as { code?: unknown }).code) : "";
            if (code.includes("quota-exceeded")) {
              setError("تم تجاوز حد SMS. استخدم رقم اختبار خيالي من Firebase مثل +1 650-555-3434.");
            } else if (code.includes("captcha")) {
              setError("فشل التحقق reCAPTCHA. أعد تحميل الصفحة وحاول مرة أخرى.");
            } else if (code.includes("operation-not-allowed")) {
              setError("Phone Authentication غير مفعّل في Firebase.");
            } else {
              setError(`تعذر بدء التحقق${code ? ` (${code})` : ""}.`);
            }
            recaptcha.current?.clear();
            recaptcha.current = null;
            auth.settings.appVerificationDisabledForTesting = false;
          }
          return;
        }

        const codeInput = form.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]');
        if (!codeInput) return;
        if (!confirmation.current) {
          setError("اطلب رمز التحقق أولًا.");
          return;
        }

        const code = codeInput.value.replace(/\D/g, "");
        if (!/^\d{6}$/.test(code)) {
          setError("أدخل رمز التحقق المكوّن من 6 أرقام.");
          return;
        }

        setError("");
        try {
          await confirmation.current.confirm(code);
          confirmation.current = null;
          recaptcha.current?.clear();
          recaptcha.current = null;
          auth.settings.appVerificationDisabledForTesting = false;
        } catch (error) {
          console.error(error);
          const firebaseCode = error instanceof Error && "code" in error ? String((error as { code?: unknown }).code) : "";
          setError(firebaseCode ? `رمز التحقق غير صحيح (${firebaseCode}).` : "رمز التحقق غير صحيح أو انتهت صلاحيته.");
        }
      };

      form.addEventListener("submit", handler, true);
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
