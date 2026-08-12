import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Office Buds",
  description: "A tiny retro office where two friends can hang out.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // The game handles its own zoom; pinch-zooming the canvas would break the pixel grid.
  userScalable: false,
  themeColor: "#22222d",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
