"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { getAssessment } from "@/features/assessment/api";
import type { AssessmentDetail } from "@/features/assessment/types";
import { SafetyFeedback } from "@/components/SafetyFeedback";
import { RecommendationResult } from "@/components/RecommendationResult";
import { ApiErrorPanel } from "@/components/ApiErrorPanel";

export default function ResultPage(props: { params: Promise<{ id: string }> }) {
    const params = use(props.params);
    const id = params.id;
    const router = useRouter();

    const [data, setData] = useState<AssessmentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const record = await getAssessment(id);
            setData(record);
        } catch (err: any) {
            if (err.code === "ASSESSMENT_NOT_FOUND") {
                sessionStorage.removeItem("assessment_id");
                alert("Your assessment session has expired or could not be found. Please start a new one.");
                router.push("/");
            } else {
                setError(err);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Poll for recommendation when assessment is still processing
    useEffect(() => {
        if (loading || error || !data) return;
        // If recommendation already present, no need to poll
        if (data.recommendation) return;
        // If assessment status indicates completed, but recommendation missing, keep polling
        const pollInterval = 3000; // 3 seconds
        const maxAttempts = 20; // ~1 minute max
        let attempts = 0;
        const intervalId = setInterval(async () => {
            attempts++;
            try {
                const refreshed = await getAssessment(id);
                setData(refreshed);
                if (refreshed.recommendation) {
                    clearInterval(intervalId);
                } else if (attempts >= maxAttempts) {
                    clearInterval(intervalId);
                    setError({ code: 'POLL_TIMEOUT', message: 'Timed out waiting for results.' });
                }
            } catch (err: any) {
                clearInterval(intervalId);
                setError(err);
            }
        }, pollInterval);
        return () => clearInterval(intervalId);
    }, [id, loading, error, data]);

    if (loading) return (
        <div style={{ textAlign: "center", padding: "4rem" }}>
            <h3 className="title">Loading Results...</h3>
        </div>
    );

    return (
        <div style={{ marginTop: "1rem" }}>
            <ApiErrorPanel error={error} onRetry={error?.retryable ? loadData : undefined} />

            {data?.safety && data.safety.recommendation_permission !== "allowed" ? (
                <>
                    {data.assessment && (
                        <div className="glass-panel animated" style={{ padding: "2.5rem", marginBottom: "2rem" }}>
                            <h2 style={{
                                marginBottom: "2rem",
                                fontFamily: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif",
                                color: "#111827",
                                fontSize: "2rem",
                                fontWeight: 700,
                                letterSpacing: "-0.025em"
                            }}>
                                Assessment Results
                            </h2>
                            <div style={{
                                backgroundColor: "#ecfdf5",
                                padding: "1.5rem",
                                borderRadius: "8px",
                                position: "relative"
                            }}>
                                <div style={{
                                    color: "#1f2937",
                                    fontWeight: 600,
                                    fontSize: "1.125rem",
                                    marginBottom: "0.5rem",
                                    textTransform: "capitalize"
                                }}>
                                    Condition: {data.assessment.condition.replace(/_/g, ' ')}
                                </div>
                                <div style={{
                                    color: "#6b7280",
                                    fontSize: "0.95rem",
                                    textTransform: "capitalize"
                                }}>
                                    Confidence: {data.assessment.confidence_level}
                                </div>
                            </div>
                        </div>
                    )}
                    <SafetyFeedback safety={data.safety} />
                </>
            ) : data?.recommendation ? (
                <RecommendationResult recommendation={data.recommendation} />
            ) : !error ? (
                <div className="glass-panel animated" style={{ padding: "3rem", textAlign: "center" }}>
                    <h3 className="title">Results not ready</h3>
                    <p className="subtitle" style={{ marginBottom: "2rem" }}>
                        Your assessment has not reached the final step.
                    </p>
                    <button className="btn-primary" onClick={() => router.push(`/assessment/${id}`)}>
                        Continue Assessment
                    </button>
                </div>
            ) : null}

            {/* Global restart action */}
            <div style={{ marginTop: "3rem", textAlign: "center" }}>
                <button
                    className="btn-secondary"
                    onClick={() => {
                        sessionStorage.removeItem("assessment_id");
                        router.push("/");
                    }}
                >
                    Start a New Assessment
                </button>
            </div>
        </div>
    );
}
