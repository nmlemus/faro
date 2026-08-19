import type { Metadata } from "next";
import { Fraunces, Instrument_Sans, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["opsz"] });
const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument" });
const splineMono = Spline_Sans_Mono({ subsets: ["latin"], variable: "--font-spline-mono" });

export const metadata: Metadata = {
  title: "Faro",
  description: "The AI-native agency, operated in the open.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${instrument.variable} ${splineMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
