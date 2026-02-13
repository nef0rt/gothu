import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoviGram",
  description: "RoviGram Messenger - Fast and secure messaging",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased overflow-hidden h-screen">
        {children}
      </body>
    </html>
  );
}
