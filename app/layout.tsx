import type { Metadata } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import { CrmProvider } from "@/components/crm/crm-provider";
import { PrototypeDiskGate } from "@/components/prototype-disk-gate";
import "./globals.css";

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans-ui",
  display: "swap",
});

const display = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Sirrus — CRM",
  description: "A production CRM workspace for any industry.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable} font-sans antialiased`}>
        <PrototypeDiskGate>
          <CrmProvider>{children}</CrmProvider>
        </PrototypeDiskGate>
      </body>
    </html>
  );
}
