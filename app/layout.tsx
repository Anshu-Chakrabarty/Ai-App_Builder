import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/appbuilder/Shell";

export const metadata: Metadata = {
  title: "AppBuilder AI — Build, Preview & Deploy Applications",
  description:
    "Describe your idea, choose features and tech stack, connect repo & CI/CD, preview with AI, and publish.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
