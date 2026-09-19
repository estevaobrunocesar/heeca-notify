export const metadata = { title: "Heeca Notify", robots: { index: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 40, color: "#111" }}>{children}</body>
    </html>
  );
}
