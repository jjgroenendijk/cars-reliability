import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navigation } from "@/app/components/navigation";
import { Providers } from "@/app/components/providers";
import { FooterContent } from "@/app/components/footer_content";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://apkstat.nl"),
  title: {
    default: "apkstat.nl - Netherlands APK Inspection Data Analysis",
    template: "%s | apkstat.nl",
  },
  description:
    "Explore official RDW APK inspection data to analyze defect rates of car brands and models in the Netherlands.",
  keywords: [
    "APK inspection",
    "APK defects",
    "RDW",
    "Dutch cars",
    "car defect rates",
    "APK statistics",
    "license plate lookup",
  ],
  authors: [{ name: "apkstat.nl" }],
  openGraph: {
    title: "apkstat.nl",
    description:
      "Explore APK inspection defect data for car brands and models in the Netherlands based on official RDW data.",
    type: "website",
    locale: "en_US",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <Providers>
          <Navigation />

          <main className="flex-grow container mx-auto px-4 py-8">
            {children}
          </main>

          <footer className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="container mx-auto px-4 py-6">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <FooterContent />
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
