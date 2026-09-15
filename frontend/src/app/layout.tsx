import type { Metadata } from 'next';
import './globals.css';
import BackButton from '../components/BackButton';

export const metadata: Metadata = {
  title: 'SkinSense Africa',
  description: 'AI-assisted skin screening and educational guidance.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', margin: 0 }}>
        <nav className="navbar">
          <a href="/" className="brand">
            <svg width="32" height="36" viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 0L30.9328 6.96825V17.0689C30.9328 26.2307 24.5826 34.6198 16 36C7.41744 34.6198 1.06718 26.2307 1.06718 17.0689V6.96825L16 0Z" stroke="#1cc686" strokeWidth="2.13437" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="16" cy="14" r="4.5" fill="#1cc686" />
              <path d="M9 28C9 24.5 12 21.5 16 21.5C20 21.5 23 24.5 23 28" stroke="#1cc686" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div>
              SkinSense Africa
              <span className="subtitle">Smarter skin health guidance</span>
            </div>
          </a>
          <div className="nav-links">
            <a href="/" className="nav-link">Home</a>
            <a href="/#how-it-works" className="nav-link">How It Works</a>
            <a href="/#my-assessments" className="nav-link">My Assessments</a>
            <a href="/#safety-limitations" className="nav-link">Safety & Limitations</a>
            <a href="/" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>Start Screening</a>
          </div>
        </nav>
        <BackButton />
        <main style={{ flex: 1 }}>
          {children}
        </main>

        <footer style={{ marginTop: "auto", borderTop: "1px solid rgba(229, 231, 235, 0.4)", padding: "4rem 2rem 2rem", background: "rgba(255, 255, 255, 0.6)", backdropFilter: "blur(16px)", textAlign: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
            <div className="brand" style={{ justifyContent: "center" }}>
              <svg width="32" height="36" viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 0L30.9328 6.96825V17.0689C30.9328 26.2307 24.5826 34.6198 16 36C7.41744 34.6198 1.06718 26.2307 1.06718 17.0689V6.96825L16 0Z" stroke="#1cc686" strokeWidth="2.13437" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="16" cy="14" r="4.5" fill="#1cc686" />
                <path d="M9 28C9 24.5 12 21.5 16 21.5C20 21.5 23 24.5 23 28" stroke="#1cc686" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <div>
                SkinSense Africa
                <span className="subtitle">Smarter skin health guidance</span>
              </div>
            </div>
            <p style={{ color: "#6b7280", margin: 0, marginTop: "0.5rem" }}>Smarter skin health guidance.</p>
          </div>

          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "3rem", marginBottom: "3rem", fontWeight: 500 }}>
            <a href="/" style={{ color: "#6b7280", textDecoration: "none" }}>Home</a>
            <a href="/#how-it-works" style={{ color: "#6b7280", textDecoration: "none" }}>How It Works</a>
            <a href="/#my-assessments" style={{ color: "#6b7280", textDecoration: "none" }}>My Assessments</a>
            <a href="/#safety-limitations" style={{ color: "#6b7280", textDecoration: "none" }}>Safety & Limitations</a>
            <a href="#" style={{ color: "#8c94a2", textDecoration: "none" }}>Privacy</a>
            <a href="#" style={{ color: "#8c94a2", textDecoration: "none" }}>Terms</a>
          </div>

          <div style={{ background: "#daf9ed", color: "#1cc686", padding: "2rem", borderRadius: "12px", maxWidth: "800px", margin: "0 auto 3rem", fontSize: "0.95rem", lineHeight: 1.6, fontWeight: 500 }}>
            SkinSense Africa provides educational screening guidance and does not replace professional medical diagnosis or care. Your results may indicate when professional medical attention is recommended.
          </div>

          <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>© 2026 SkinSense Africa</p>
        </footer>
      </body>
    </html>
  );
}
