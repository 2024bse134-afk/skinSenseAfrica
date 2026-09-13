import type { SafetyResult } from "@/features/assessment/types";

export function SafetyFeedback({ safety }: { safety: SafetyResult }) {
    if (!safety || safety.recommendation_permission === "allowed") return null;

    const isEmergency = safety.urgency === "emergency";
    const isUrgent = safety.urgency === "urgent";

    return (
        <div
            className="glass-panel animated"
            style={{
                padding: "2.5rem",
                border: isEmergency ? "2px solid var(--error)" : isUrgent ? "2px solid var(--accent)" : "1px solid var(--border)",
                background: isEmergency ? "rgba(239, 68, 68, 0.05)" : isUrgent ? "rgba(245, 158, 11, 0.05)" : "var(--glass-bg)"
            }}
        >
            <h2 style={{
                color: isEmergency ? "var(--error)" : isUrgent ? "var(--accent)" : "var(--foreground)",
                marginBottom: "1rem"
            }}>
                {safety.feedback?.heading || "Professional Review Required"}
            </h2>

            <p style={{ fontWeight: 600, marginBottom: "1.5rem", fontSize: "1.1rem" }}>
                {safety.action_message}
            </p>

            {safety.feedback && (
                <div style={{ marginTop: "2rem" }}>

                    {safety.feedback.triggers?.length > 0 && (
                        <>
                            <h4 style={{ marginBottom: "0.5rem" }}>Reported Warning Signs:</h4>
                            <ul style={{ paddingLeft: "1.5rem", marginBottom: "2rem", opacity: 0.9 }}>
                                {safety.feedback.triggers.map(t => (
                                    <li key={t.code} style={{ marginBottom: "0.5rem" }}>{t.label}</li>
                                ))}
                            </ul>
                        </>
                    )}

                    {safety.feedback.next_steps?.length > 0 && (
                        <>
                            <h4 style={{ marginBottom: "0.5rem" }}>Recommended Next Steps:</h4>
                            <ul style={{ paddingLeft: "1.5rem", marginBottom: "2rem", opacity: 0.9 }}>
                                {safety.feedback.next_steps.map((step, i) => (
                                    <li key={i} style={{ marginBottom: "0.5rem", fontWeight: 500 }}>{step}</li>
                                ))}
                            </ul>
                        </>
                    )}

                    <p style={{
                        opacity: 0.7,
                        fontSize: "0.85rem",
                        marginTop: "2rem",
                        borderTop: "1px solid var(--border)",
                        paddingTop: "1rem"
                    }}>
                        {safety.feedback.guidance_withheld_reason}
                    </p>

                    {safety.feedback.clinician_summary && (
                        <div style={{ marginTop: "2rem" }}>
                            <button
                                className="btn-secondary"
                                style={{ fontSize: "0.9rem" }}
                                onClick={() => {
                                    const text = JSON.stringify(safety.feedback!.clinician_summary, null, 2);
                                    if (navigator.clipboard) {
                                        navigator.clipboard.writeText(text).catch(err => console.error(err));
                                    } else {
                                        const textArea = document.createElement("textarea");
                                        textArea.value = text;
                                        textArea.style.position = "fixed";
                                        textArea.style.left = "-999999px";
                                        document.body.appendChild(textArea);
                                        textArea.focus();
                                        textArea.select();
                                        try {
                                            document.execCommand('copy');
                                        } catch (err) {
                                            console.error("Fallback copy failed", err);
                                        }
                                        document.body.removeChild(textArea);
                                    }
                                    alert("Clinician summary copied to clipboard.");
                                }}
                            >
                                Copy Clinician Summary
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
