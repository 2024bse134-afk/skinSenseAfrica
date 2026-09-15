"use client";

import { useState } from "react";
import { saveQuestionnaire } from "@/features/assessment/api";
import type { Questionnaire, QuestionnaireResponse } from "@/features/assessment/types";
import { ApiErrorPanel } from "./ApiErrorPanel";

interface QuestionnaireStepProps {
    assessmentId: string;
    onComplete: (data: QuestionnaireResponse) => void;
}

export function QuestionnaireStep({ assessmentId, onComplete }: QuestionnaireStepProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<any>(null);

    const [formData, setFormData] = useState<Partial<Questionnaire>>({
        duration: "unsure",
        itching: "unsure",
        pain_level: 0,
        rapidly_spreading: "unsure",
        affected_body_area: "unsure",
        fever: "unsure",
        high_fever: "unsure",
        swelling: "unsure",
        difficulty_breathing: "unsure",
        lip_tongue_throat_swelling: "unsure",
        bleeding: "unsure",
        blistering: "unsure",
        open_wound: "unsure",
        eye_involvement: "unsure",
        possible_infection: "unsure",
        previous_treatment: [],
        known_allergies: [],
        current_products: [],
        age_group: "prefer_not_to_say",
        recurrent: "unsure"
    });

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === "number" ? parseInt(value) || 0 : value
        }));
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const response = await saveQuestionnaire(assessmentId, formData as Questionnaire);
            onComplete(response);
        } catch (err) {
            setError(err);
            setLoading(false);
        }
    };

    const RadioGroup = ({ label, name }: { label: string, name: keyof Questionnaire }) => (
        <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 500, marginBottom: "0.5rem" }}>{label}</label>
            <div style={{ display: "flex", gap: "1rem" }}>
                {["yes", "no", "unsure"].map((opt) => (
                    <label key={opt} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <input
                            type="radio"
                            name={name}
                            value={opt}
                            checked={formData[name] === opt}
                            onChange={handleChange}
                        />
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </label>
                ))}
            </div>
        </div>
    );

    return (
        <div className="glass-panel animated" style={{ padding: "2rem" }}>
            <h3 className="title" style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Clinical Context</h3>

            <ApiErrorPanel error={error} onRetry={error?.retryable ? handleSubmit : undefined} />

            <form onSubmit={handleSubmit}>
                <div style={{ display: "grid", gap: "1.5rem" }}>

                    <div style={{ display: "flex", gap: "2rem" }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: "block", fontWeight: 500, marginBottom: "0.5rem" }}>Age Group</label>
                            <select name="age_group" value={formData.age_group} onChange={handleChange} style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--border)" }}>
                                <option value="prefer_not_to_say">Prefer not to say</option>
                                <option value="infant">Infant</option>
                                <option value="child">Child</option>
                                <option value="adolescent">Adolescent</option>
                                <option value="adult">Adult</option>
                                <option value="older_adult">Older Adult</option>
                            </select>
                        </div>

                        <div style={{ flex: 1 }}>
                            <label style={{ display: "block", fontWeight: 500, marginBottom: "0.5rem" }}>Affected Area</label>
                            <select name="affected_body_area" value={formData.affected_body_area} onChange={handleChange} style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--border)" }}>
                                <option value="unsure">Unsure</option>
                                <option value="face_or_neck">Face or Neck</option>
                                <option value="scalp">Scalp</option>
                                <option value="chest_or_back">Chest or Back</option>
                                <option value="arms_or_hands">Arms or Hands</option>
                                <option value="legs_or_feet">Legs or Feet</option>
                                <option value="groin_or_skin_folds">Groin or Skin Folds</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "2rem" }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: "block", fontWeight: 500, marginBottom: "0.5rem" }}>Duration</label>
                            <select name="duration" value={formData.duration} onChange={handleChange} style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--border)" }}>
                                <option value="unsure">Unsure</option>
                                <option value="less_than_one_week">Less than a week</option>
                                <option value="one_to_four_weeks">1 - 4 weeks</option>
                                <option value="one_to_six_months">1 - 6 months</option>
                                <option value="more_than_six_months">More than 6 months</option>
                            </select>
                        </div>

                        <div style={{ flex: 1 }}>
                            <label style={{ display: "block", fontWeight: 500, marginBottom: "0.5rem" }}>Pain Level (0-10)</label>
                            <input
                                type="number"
                                name="pain_level"
                                min="0" max="10"
                                value={formData.pain_level}
                                onChange={handleChange}
                                style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--border)" }}
                            />
                        </div>
                    </div>

                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
                        <h4 style={{ marginBottom: "1rem", fontWeight: 600 }}>Urgent Warning Signs Check</h4>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                            <RadioGroup label="Is it rapidly spreading?" name="rapidly_spreading" />
                            <RadioGroup label="Do you have high fever?" name="high_fever" />
                            <RadioGroup label="Difficulty breathing?" name="difficulty_breathing" />
                            <RadioGroup label="Lip/tongue/throat swelling?" name="lip_tongue_throat_swelling" />
                            <RadioGroup label="Any bleeding?" name="bleeding" />
                            <RadioGroup label="Are there open wounds?" name="open_wound" />
                            <RadioGroup label="Possible eye involvement?" name="eye_involvement" />
                            <RadioGroup label="Possible infection?" name="possible_infection" />
                        </div>
                    </div>

                    {/* Note: In a real app we would have tag-input components for arrays like known_allergies, etc. */}
                </div>

                <div style={{ marginTop: "2rem", borderTop: "1px solid var(--border)", paddingTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? "Submitting..." : "Submit Answers"}
                    </button>
                </div>
            </form>
        </div>
    );
}
