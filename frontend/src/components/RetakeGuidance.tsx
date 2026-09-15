import React from "react";
import type { AssessmentDetail } from "@/features/assessment/types";

interface RetakeGuidanceProps {
    assessmentData: AssessmentDetail;
    onRetake: () => void;
}

const issueMappings: Record<string, string> = {
    blurred: "The image is too blurry to resolve details.",
    poor_lighting: "The lighting is too dim, uneven, or casting harsh shadows.",
    too_far: "The camera is too far away from the skin concern.",
    obstructed: "The view is partially or completely covered.",
    multiple_unrelated_areas: "Too many unrelated skin areas are visible in one photograph.",
    no_visible_skin_concern: "No clear skin concern is visible in the frame."
};

export function RetakeGuidance({ assessmentData, onRetake }: RetakeGuidanceProps) {
    const issues = assessmentData.assessment?.image_quality?.issues || [];

    return (
        <div className="glass-panel animated" style={{ padding: "2rem" }}>
            <h3 className="title" style={{ fontSize: "1.5rem" }}>Clearer Focus Needed</h3>

            <div className="alert-error" style={{ margin: "1.5rem 0", background: "rgba(245, 158, 11, 0.1)", borderColor: "var(--accent)", color: "var(--foreground)" }}>
                <p style={{ fontWeight: 600, marginBottom: "1rem" }}>
                    The image provided could not be reliably assessed. Please capture another photo following our guidance.
                </p>

                {issues.length > 0 && (
                    <ul style={{ paddingLeft: "1.5rem", marginTop: "1rem", opacity: 0.9 }}>
                        {issues.map(issue => (
                            <li key={issue} style={{ marginBottom: "0.25rem" }}>
                                {issueMappings[issue] || issue.replace(/_/g, " ")}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div style={{ marginTop: "2rem", display: "flex", justifyContent: "center" }}>
                <button className="btn-primary" onClick={onRetake}>
                    Take Another Photo
                </button>
            </div>
        </div>
    );
}
