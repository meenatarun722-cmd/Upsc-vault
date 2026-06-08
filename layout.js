import "./globals.css";
export const metadata = { title: "UPSC Vault", description: "Your ultimate UPSC memorization app" };
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
