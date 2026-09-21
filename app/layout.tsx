import type { Metadata } from "next";
import { Lato } from "next/font/google";
import "./globals.css";
import HeaderGuard from "../components/HeaderGuard";
import FooterGuard from "@/components/FooterGuard";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { getSiteUrl } from "@/lib/site-url";

const lato = Lato({
  subsets: ["latin"],
  // Lato has no native 500 face; CSS uses its requested 500 UI weight with
  // the browser's standard synthesized medium face.
  weight: ["400", "700"],
  variable: "--font-lato",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: "Grouh Academy | Practical Digital Skills and Internships", template: "%s | Grouh Academy" },
  description: "Build practical digital skills through career-ready courses, expert mentorship, and real-world internship opportunities at Grouh Academy.",
  applicationName: "Grouh Academy",
  keywords: ["online courses", "digital skills", "tech internship", "career development", "Nigeria", "Grouh Academy"],
  authors: [{ name: "Grouh Academy" }],
  creator: "Grouh Academy",
  publisher: "Grouh Academy",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
  openGraph: { type: "website", locale: "en_NG", url: "/", siteName: "Grouh Academy", title: "Grouh Academy | Practical Digital Skills and Internships", description: "Build practical digital skills through career-ready courses, expert mentorship, and real-world internship opportunities.", images: [{ url: "/logo.png", width: 512, height: 512, alt: "Grouh Academy" }] },
  twitter: { card: "summary", title: "Grouh Academy | Practical Digital Skills and Internships", description: "Career-ready courses, expert mentorship, and real-world internship opportunities." },
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
