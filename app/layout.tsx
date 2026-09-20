import type { Metadata } from "next";
import { Lato } from "next/font/google";
import "./globals.css";
import HeaderGuard from "../components/HeaderGuard";
import FooterGuard from "@/components/FooterGuard";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

const lato = Lato({
  subsets: ["latin"],
  // Lato has no native 500 face; CSS uses its requested 500 UI weight with
  // the browser's standard synthesized medium face.
  weight: ["400", "700"],
  variable: "--font-lato",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Grouh Academy",
  description: "Practical digital skills and internship opportunities.",
  appleWebApp: {
    capable: true,
    title: "Grouh Academy",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${lato.variable}`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegistration />
        <HeaderGuard />
        {children}
        <FooterGuard />
      </body>
    </html>
  );
}
