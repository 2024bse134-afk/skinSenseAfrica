"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAssessment } from "@/features/assessment/api";
import { ApiErrorPanel } from "@/components/ApiErrorPanel";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await createAssessment();
      sessionStorage.setItem("assessment_id", resp.id);
      router.push(`/assessment/${resp.id}`);
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  };

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">SkinSense Africa</div>
          <h1>Smarter skin health guidance.</h1>
          <p>
            AI-assisted skin screening and educational guidance designed with melanin-rich skin in mind.
          </p>
          <div className="hero-actions">
            <button
              className="btn-primary"
              onClick={handleStart}
              disabled={loading}
              style={{ fontSize: "1.1rem", padding: "1rem 2rem" }}
            >
              {loading ? "Initializing..." : "Start Skin Screening"}
            </button>
            <button className="btn-link">Learn More</button>
          </div>
          {error && (
            <div style={{ marginTop: "1rem" }}>
              <ApiErrorPanel error={error} />
            </div>
          )}
        </div>

        <div className="hero-img-container">
          {/* Using a standard img tag because next/image requires strict build-time optimizations and sizing, which we can avoid since we control the static asset */}
          <img
            src="/hero_nurse.png"
            alt="Medical professional smiling"
            className="hero-img"
          />
        </div>
      </section>

      <section id="how-it-works" className="main-container" style={{ padding: "6rem 2rem", textAlign: "center" }}>
        <h2 className="title">How It Works</h2>
        <p className="subtitle" style={{ maxWidth: "600px", margin: "0 auto 2rem" }}>Take a simple photo and fill out a short questionnaire to receive instant, AI-powered educational skin health guidance.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2rem", marginTop: "4rem" }}>
          <div className="glass-panel">
            <h3 style={{ fontSize: "1.2rem", fontWeight: 600 }}>1. Take a Photo</h3>
            <p style={{ marginTop: "1rem", color: "var(--text-muted)", fontSize: "0.95rem" }}>Use your smartphone or computer to capture your skin concern.</p>
          </div>
          <div className="glass-panel">
            <h3 style={{ fontSize: "1.2rem", fontWeight: 600 }}>2. Answer Questions</h3>
            <p style={{ marginTop: "1rem", color: "var(--text-muted)", fontSize: "0.95rem" }}>Provide context such as duration, pain level, and other specific details.</p>
          </div>
          <div className="glass-panel">
            <h3 style={{ fontSize: "1.2rem", fontWeight: 600 }}>3. Get Guidance</h3>
            <p style={{ marginTop: "1rem", color: "var(--text-muted)", fontSize: "0.95rem" }}>Receive AI-assisted insights and know exactly what steps to take next.</p>
          </div>
        </div>
      </section>

      <section id="my-assessments" className="main-container" style={{ padding: "6rem 2rem", background: "rgba(28, 198, 134, 0.03)", borderRadius: "24px", marginTop: "2rem" }}>
        <div style={{ textAlign: "center" }}>
          <h2 className="title">My Assessments</h2>
          <p className="subtitle">Sign in or check your recent sessions to resume ongoing assessments.</p>
          <button className="btn-secondary" style={{ marginTop: "1.5rem" }}>Login / Sign Up</button>
        </div>
      </section>

      <section id="safety-limitations" className="main-container" style={{ padding: "8rem 2rem 6rem", textAlign: "center" }}>
        <h2 className="title">Safety & Limitations</h2>
        <p style={{ maxWidth: "800px", margin: "0 auto", color: "var(--text-muted)", lineHeight: 1.8 }}>SkinSense Africa is an educational tool. The generative assessments provided are specifically designed for informational purposes and are strictly <strong>not a medical diagnosis</strong>. Always consult a qualified physician or dermatologist for any severe, rapidly spreading, or medically concerning conditions.</p>
      </section>
    </>
  );
}
