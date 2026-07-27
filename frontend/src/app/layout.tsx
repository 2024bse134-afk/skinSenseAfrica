import type { Metadata } from 'next';
import { Space_Grotesk } from 'next/font/google';
import '../styles/globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

export const metadata: Metadata = {
  title: 'SkinSense Africa',
  description: 'Educational skin screening for melanin-rich skin tones.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <body className="min-h-screen bg-mist text-ink antialiased">{children}</body>
    </html>
  );
}
