"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { getAssessment, getAssessmentRecommendation } from "@/features/assessment/api";
import type { AssessmentDetail } from "@/features/assessment/types";
import { ImageUploader } from "@/components/ImageUploader";
import { QuestionnaireStep } from "@/components/QuestionnaireStep";
import { RetakeGuidance } from "@/components/RetakeGuidance";
import { ApiErrorPanel } from "@/components/ApiErrorPanel";

export default function AssessmentPage(props: { params: Promise<{ id: string }> }) {
    const params = use(props.params);
    const id = params.id;
    const router = useRouter();

    const [data, setData] = useState<AssessmentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);
    const [generating, setGenerating] = useState(false);

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

    useEffect(() => {
        if (!data) return;

        const needsRecommendation =
            (["questionnaire_completed", "completed", "professional_review_required", "urgent", "emergency"].includes(data.status) && !data.recommendation) &&
            data.questionnaire &&
            !generating;

        if (needsRecommendation) {
            setGenerating(true);
            (async () => {
                try {
                    // Generate recommendation, then navigate to result
                    await getAssessmentRecommendation(id);
                    router.push(`/result/${id}`);
                } catch (err: any) {
                    console.error(err);
                    if (err?.code === "RECOMMENDATION_BLOCKED" || err?.code === "RED_FLAG_ESCALATION_REQUIRED") {
                        // Safety overrides should be viewed on result page
                        router.push(`/result/${id}`);
                    } else {
                        setError(err);
                        setGenerating(false);
                    }
                }
            })();
        } else if (["completed", "professional_review_required", "urgent", "emergency"].includes(data.status)) {
            // Enforce questionnaire is taken before redirecting to the diagnosis/result page
            if (data.questionnaire && !generating) {
                router.push(`/result/${id}`);
            }
        }
    }, [data, id, router, generating]);

    if (loading) return (
        <div style={{ textAlign: "center", padding: "4rem" }}>
            <h3 className="title">Loading Assessment...</h3>
        </div>
    );

    return (
        <div style={{ marginTop: "1rem" }}>
            <ApiErrorPanel error={error} onRetry={error?.retryable ? loadData : undefined} />

            {data?.status === "draft" && (
                <ImageUploader assessmentId={id} onComplete={loadData} />
            )}

            {data?.status === "retake_required" && (
                <RetakeGuidance assessmentData={data} onRetake={loadData} />
            )}

            {(data?.status === "assessment_completed" ||
                (["completed", "professional_review_required", "urgent", "emergency"].includes(data?.status || "") && !data?.questionnaire)) && (
                    <QuestionnaireStep assessmentId={id} onComplete={loadData} />
                )}

            {(data?.status === "questionnaire_completed" || generating) && (
                <div className="glass-panel animated" style={{ textAlign: "center", padding: "4rem" }}>
                    <h3 className="title">Analyzing context...</h3>
                    <p className="subtitle">Preparing your customized educational recommendations.</p>
                </div>
            )}
        </div>
    );
}
