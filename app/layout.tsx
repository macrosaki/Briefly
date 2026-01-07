import "./globals.css";

export const metadata = {
  title: "Briefly — Alive Loop",
  description:
    "A full-screen stage guided by a synchronized show clock. Earn trivia rounds, spend on gifts, and feel the beats.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

