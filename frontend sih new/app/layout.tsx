import "./globals.css";
import "reactflow/dist/style.css";

export const metadata = {
  title: "ChainTrace — VASP Attribution",
  description: "Prototype for blockchain wallet attribution and investigation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}