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
      <body className="min-h-screen bg-mist text-ink antialiased relative z-0">
        <div className="fixed inset-0 -z-50 bg-cover bg-center bg-no-repeat opacity-60 mix-blend-multiply pointer-events-none" style={{ backgroundImage: "url('/skin_bg.png')" }} />
        {children}
      </body>
    </html>
  );
}
