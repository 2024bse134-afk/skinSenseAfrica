import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'SkinSense Africa',
  description: 'Explainable AI-assisted skin screening designed with melanin-rich skin tones in mind.',
  applicationName: 'SkinSense Africa',
  themeColor: '#F8F6EF',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-mist text-ink antialiased">{children}</body>
    </html>
  );
}
