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
    default: "Dutch Car Reliability - Netherlands Vehicle Reliability Analysis",
    template: "%s | Dutch Car Reliability",
  },
  description:
    "Analysis of APK inspection data from RDW Open Data to determine the reliability of car brands and models in the Netherlands.",
  keywords: [
    "car reliability",
    "APK inspection",
    "RDW",
    "Dutch cars",
    "car statistics",
    "most reliable car",
    "license plate lookup",
  ],
  authors: [{ name: "Dutch Car Reliability" }],
  openGraph: {
    title: "Dutch Car Reliability",
    description:
      "Discover the most and least reliable car brands and models in the Netherlands based on APK inspection data.",
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
        <Navigation />

        <main className="flex-grow container mx-auto px-4 py-8">
          {children}
        </main>

        <footer className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="container mx-auto px-4 py-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Data from{" "}
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
                This website is not affiliated with the RDW
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
