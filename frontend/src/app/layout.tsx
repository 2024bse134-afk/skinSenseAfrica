import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'SkinSense Africa',
  description: 'Educational skin screening for melanin-rich skin tones.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-mist text-ink antialiased">{children}</body>
    </html>
  );
}
