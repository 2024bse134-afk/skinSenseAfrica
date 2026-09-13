import type { RecommendationResult } from "@/features/assessment/types";

export function RecommendationResult({ recommendation }: { recommendation: RecommendationResult }) {
    if (!recommendation || recommendation.safety.recommendation_permission !== "allowed") return null;

    const CONFIDENCE_THRESHOLD = 0.82;
    const confidenceScore = recommendation.confidence_score;
    const isLowConfidence = confidenceScore === null || confidenceScore < CONFIDENCE_THRESHOLD;

    if (isLowConfidence) {
        return (
            <div className="glass-panel animated" style={{ padding: "2.5rem" }}>
                <h2 className="title" style={{ marginBottom: "2rem" }}>Assessment Results</h2>
                <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid var(--accent)", padding: "1.5rem", borderRadius: "12px", marginBottom: "2rem" }}>
                    <h3 style={{ margin: 0, color: "var(--accent)", textTransform: "capitalize" }}>Low Confidence</h3>
                    <p style={{ marginTop: "0.5rem", opacity: 0.8 }}>
                        The confidence score ({confidenceScore ?? "N/A"}) is below the required threshold of {CONFIDENCE_THRESHOLD}. Please retake the photo.
                    </p>
                </div>
                <div style={{ marginTop: "2rem", display: "flex", justifyContent: "center" }}>
                    <button className="btn-primary" onClick={() => {
                        sessionStorage.removeItem("assessment_id");
                        window.location.href = "/";
                    }}>
                        Take Another Photo
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-panel animated" style={{ padding: "2.5rem" }}>
            <h2 className="title" style={{ marginBottom: "2rem" }}>Assessment Results</h2>

            <div style={{
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid var(--success)",
                padding: "1.5rem",
                borderRadius: "12px",
                marginBottom: "2rem"
            }}>
                <h3 style={{ margin: 0, color: "var(--success)", textTransform: "capitalize" }}>
                    Condition: {recommendation.condition.replace(/_/g, ' ')}
                </h3>
                <p style={{ marginTop: "0.5rem", opacity: 0.8, textTransform: "capitalize" }}>
                    Confidence: {recommendation.confidence_level}
                </p>
            </div>

            <div style={{ marginBottom: "2rem" }}>
                <h3 style={{ marginBottom: "1rem" }}>Explanation</h3>
                <p style={{ lineHeight: 1.6, opacity: 0.9 }}>{recommendation.draft.explanation}</p>
            </div>

            <div style={{ marginBottom: "2rem" }}>
                <h3 style={{ marginBottom: "1rem" }}>Recommended Actions</h3>
                <ul style={{ paddingLeft: "1.5rem", lineHeight: 1.6, opacity: 0.9 }}>
                    {recommendation.draft.recommended_action.steps.map((step, i) => (
                        <li key={i} style={{ marginBottom: "0.5rem" }}>{step}</li>
                    ))}
                </ul>
            </div>

            {recommendation.draft.prevention && recommendation.draft.prevention.length > 0 && (
                <div style={{ marginBottom: "2rem" }}>
                    <h3 style={{ marginBottom: "1rem" }}>Prevention tips</h3>
                    <ul style={{ paddingLeft: "1.5rem", lineHeight: 1.6, opacity: 0.9 }}>
                        {recommendation.draft.prevention.map((step, i) => (
                            <li key={i} style={{ marginBottom: "0.5rem" }}>{step}</li>
                        ))}
                    </ul>
                </div>
            )}

            {recommendation.draft.warning_signs && recommendation.draft.warning_signs.length > 0 && (
                <div style={{ marginBottom: "2rem" }}>
                    <h3 style={{ marginBottom: "1rem", color: "var(--accent)" }}>When to seek care</h3>
                    <ul style={{ paddingLeft: "1.5rem", lineHeight: 1.6, opacity: 0.9 }}>
                        {recommendation.draft.warning_signs.map((sign, i) => (
                            <li key={i} style={{ marginBottom: "0.5rem" }}>{sign}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1.5rem", opacity: 0.7, fontSize: "0.9rem", marginTop: "2rem" }}>
                <h4 style={{ marginBottom: "0.5rem" }}>For Healthcare Professionals</h4>
                <p style={{ marginBottom: "1rem" }}>
                    Review the AI-generated diagnosis alongside the patient's medical history, symptoms, and clinical examination. Use the AI assessment as a supporting reference, then apply professional clinical judgment to confirm, refine, or rule out the diagnosis and determine the appropriate treatment or referral.
                </p>
                <p><strong>Disclaimer:</strong> {recommendation.disclaimer}</p>
                <ul style={{ marginTop: "1rem", paddingLeft: "1.5rem" }}>
                    {recommendation.draft.limitations.map((lim, i) => (
                        <li key={i}>{lim}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
