import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../src/design/tokens.css";

export const metadata: Metadata = {
  title: "Panteon",
  description: "Pedidos à mesa e operação do restaurante",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
