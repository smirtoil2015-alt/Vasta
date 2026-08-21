import type { Metadata } from "next";
import "./globals.css";
import "./white-theme.css";
import VastaPhonePicker from "@/components/vasta-phone-picker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vasta",
  description: "Fast, simple and connected messaging.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        {children}
        <VastaPhonePicker />
      </body>
    </html>
  );
}
