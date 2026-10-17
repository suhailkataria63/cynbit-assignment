import type { Metadata } from "next";
import { Cormorant_Garamond, Geist } from "next/font/google";
import { MotionProvider } from "@/components/providers/motion-provider";
import { themeInitScript } from "@/lib/theme/preference";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const editorial = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-editorial",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Cynbit AI Solutions Architect", template: "%s | Cynbit" },
  description: "Explore business discovery, solution recommendations, and architecture blueprints in the Cynbit AI Solutions Architect proof of concept.",
  applicationName: "Cynbit",
  openGraph: { title: "Cynbit AI Solutions Architect", description: "Explore business discovery, solution recommendations, and architecture blueprints in the Cynbit AI Solutions Architect proof of concept.", siteName: "Cynbit", type: "website", locale: "en_US" },
  twitter: { card: "summary", title: "Cynbit AI Solutions Architect", description: "Explore business discovery, solution recommendations, and architecture blueprints in the Cynbit AI Solutions Architect proof of concept." },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${editorial.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body><a href="#main-content" className="skip-link">Skip to content</a><MotionProvider>{children}</MotionProvider></body>
    </html>
  );
}
