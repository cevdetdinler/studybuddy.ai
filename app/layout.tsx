import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyBuddy AI — Chat with your notes",
  description:
    "Upload lecture notes and PDFs. Chat with them, generate flashcards, take quizzes, and get ELI12 explanations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
