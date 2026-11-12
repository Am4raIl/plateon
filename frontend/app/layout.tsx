import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "../src/design/tokens.css";

export const metadata: Metadata = {
  title: "Plateon",
  description: "Pedidos à mesa e operação do restaurante",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
      </head>
      <body>{children}</body>
    </html>
  );
}
