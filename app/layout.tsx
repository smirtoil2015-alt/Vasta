import type { Metadata } from "next";
import "./globals.css";
import "./white-theme.css";
import VastaPhonePicker from "@/components/vasta-phone-picker";
import VastaGoogleLogin from "@/components/vasta-google-login";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vasta",
  description: "Fast, simple and connected messaging.",
  icons: {
    icon: "/vasta-logo.svg",
    shortcut: "/vasta-logo.svg",
    apple: "/vasta-logo.svg",
  },
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
        <VastaGoogleLogin />
      </body>
    </html>
  );
}
