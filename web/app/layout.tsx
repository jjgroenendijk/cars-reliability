import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navigation } from "@/app/components/navigation";
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
  title: {
    default: "Auto Betrouwbaarheid NL - Nederlandse Auto Betrouwbaarheidsanalyse",
    template: "%s | Auto Betrouwbaarheid NL",
  },
  description:
    "Analyse van APK-keuringsgegevens van RDW Open Data om de betrouwbaarheid van auto merken en modellen in Nederland te bepalen.",
  keywords: [
    "auto betrouwbaarheid",
    "APK keuring",
    "RDW",
    "Nederlandse auto's",
    "auto statistieken",
    "betrouwbaarste auto",
    "kenteken opzoeken",
  ],
  authors: [{ name: "Auto Betrouwbaarheid NL" }],
  openGraph: {
    title: "Auto Betrouwbaarheid NL",
    description:
      "Ontdek de meest en minst betrouwbare auto merken en modellen in Nederland op basis van APK-gegevens.",
    type: "website",
    locale: "nl_NL",
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
    <html lang="nl">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <Navigation />

        <main className="flex-grow container mx-auto px-4 py-8">
          {children}
        </main>

        <footer className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="container mx-auto px-4 py-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Data afkomstig van{" "}
                <a
                  href="https://opendata.rdw.nl/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  RDW Open Data
                </a>
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Deze website is niet gelieerd aan de RDW
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
