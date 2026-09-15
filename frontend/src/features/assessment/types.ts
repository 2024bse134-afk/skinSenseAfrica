export type QualityStatus = "acceptable" | "retake_required";
export type AssessmentStatus =
    | "draft"
    | "assessment_completed"
    | "retake_required"
    | "questionnaire_completed"
    | "completed"
    | "professional_review_required"
    | "urgent"
    | "emergency";

export type SafetyUrgency = "routine" | "professional_review" | "urgent" | "emergency";
export type RecommendationPermission = "allowed" | "blocked" | "escalation_only";
export type ImageQualityIssue = "blurred" | "poor_lighting" | "too_far" | "obstructed" | "multiple_unrelated_areas" | "no_visible_skin_concern";
export type VisualFinding = "dry_appearing_patch" | "visible_scaling" | "visible_bumps" | "color_change" | "crusting" | "pustules" | "plaque_like_area" | "non_specific_visible_change";
export type VisualSafetySignal = "possible_eye_involvement" | "possible_infection" | "possible_significant_bleeding" | "possible_open_wound" | "possible_extensive_blistering" | "unsupported_scope";
export type ConfidenceLevel = "low" | "moderate" | "high" | "unknown";
export type Condition = "eczema" | "fungal_infection" | "scabies" | "impetigo" | "acne" | "psoriasis" | "folliculitis" | "other_or_uncertain";

export interface CreateAssessmentResponse {
    id: string;
    status: "draft";
}

export interface ImageQuality {
    status: QualityStatus;
    issues: ImageQualityIssue[];
}

export interface ImageAssessmentResult {
    assessment_status: AssessmentStatus;
    condition: Condition;
    confidence_level: ConfidenceLevel;
    confidence_score: number | null;
    visual_findings: VisualFinding[];
    alternative_conditions: Condition[];
    image_quality: ImageQuality;
    needs_more_information: boolean;
    follow_up_question_ids: string[];
    visual_safety_signals: VisualSafetySignal[];
    recommendation_status: string;
    assessment_engine: string;
    engine_version: string;
    prompt_version: string;
    limitations: string[];
    assessed_at: string;
    inference_ms: number;
}

export type YesNoUnsure = "yes" | "no" | "unsure";
export type Duration = "less_than_one_week" | "one_to_four_weeks" | "one_to_six_months" | "more_than_six_months" | "unsure";
export type BodyArea = "face_or_neck" | "scalp" | "chest_or_back" | "arms_or_hands" | "legs_or_feet" | "groin_or_skin_folds" | "other" | "unsure";
export type AgeGroup = "infant" | "child" | "adolescent" | "adult" | "older_adult" | "prefer_not_to_say";

export interface Questionnaire {
    duration: Duration;
    itching: YesNoUnsure;
    pain_level: number;
    rapidly_spreading: YesNoUnsure;
    affected_body_area: BodyArea;
    fever: YesNoUnsure;
    high_fever: YesNoUnsure;
    swelling: YesNoUnsure;
    difficulty_breathing: YesNoUnsure;
    lip_tongue_throat_swelling: YesNoUnsure;
    bleeding: YesNoUnsure;
    blistering: YesNoUnsure;
    open_wound: YesNoUnsure;
    eye_involvement: YesNoUnsure;
    possible_infection: YesNoUnsure;
    previous_treatment: string[];
    known_allergies: string[];
    current_products: string[];
    age_group: AgeGroup;
    recurrent: YesNoUnsure;
}

export interface SafetyFeedbackDetail {
    heading: string;
    triggers: Array<{ code: string; label: string }>;
    next_steps: string[];
    guidance_withheld_reason: string;
    clinician_summary: any;
}

export interface SafetyResult {
    urgency: SafetyUrgency;
    red_flags: string[];
    recommendation_permission: RecommendationPermission;
    policy_version: string;
    action_message: string;
    feedback: SafetyFeedbackDetail | null;
}

export interface QuestionnaireResponse {
    id: string;
    status: AssessmentStatus;
    safety: SafetyResult;
}

export interface RecommendedAction {
    type: string;
    urgency: string;
    steps: string[];
    referral_reason: string | null;
}

export interface RecommendationDraft {
    explanation: string;
    possible_contributing_factors: string[];
    skin_tone_considerations: string[];
    recommended_action: RecommendedAction;
    prevention: string[];
    warning_signs: string[];
    limitations: string[];
}

export interface RecommendationResult {
    assessment_id: string;
    condition: Condition;
    confidence_level: ConfidenceLevel;
    confidence_score: number | null;
    guidance_level: string;
    referral_required: boolean;
    safety: SafetyResult;
    model_version: string;
    prompt_version: string;
    disclaimer: string;
    generated_at: string;
    draft: RecommendationDraft;
}

export interface SkinContext { }

export interface AssessmentDetail {
    id: string;
    status: AssessmentStatus;
    assessment: ImageAssessmentResult | null;
    questionnaire: Questionnaire | null;
    safety: SafetyResult | null;
    skin_context: SkinContext;
    recommendation: RecommendationResult | null;
}

export interface ReferralRequest {
    assessment_id: string;
    name: string;
    contact: string;
    reason: string;
}

export interface ReferralResponse {
    id: string;
    status: "received";
}
