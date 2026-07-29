export type Condition =
  | 'eczema'
  | 'fungal_infection'
  | 'scabies'
  | 'impetigo'
  | 'acne'
  | 'psoriasis'
  | 'folliculitis'
  | 'other_or_uncertain';

export type ConfidenceLevel = 'low' | 'moderate' | 'high' | 'unknown';
export type ImageQualityIssue =
  | 'blurred'
  | 'poor_lighting'
  | 'too_far'
  | 'obstructed'
  | 'multiple_unrelated_areas'
  | 'no_visible_skin_concern';
export type Urgency = 'routine' | 'professional_review' | 'urgent' | 'emergency';
export type RecommendationPermission = 'allowed' | 'blocked' | 'escalation_only';
export type Answer = 'yes' | 'no' | 'unsure';

export enum AssessmentStatus {
  Draft = 'draft',
  AssessmentCompleted = 'assessment_completed',
  RetakeRequired = 'retake_required',
  QuestionnaireCompleted = 'questionnaire_completed',
  Completed = 'completed',
  ProfessionalReviewRequired = 'professional_review_required',
  Urgent = 'urgent',
  Emergency = 'emergency',
}

export interface ImageAssessmentResult {
  assessment_status: 'completed' | 'retake_required';
  condition: Condition;
  confidence_level: ConfidenceLevel;
  confidence_score: number | null;
  visual_findings: string[];
  alternative_conditions: Condition[];
  image_quality: {
    status: 'acceptable' | 'retake_required';
    issues: ImageQualityIssue[];
  };
  needs_more_information: boolean;
  follow_up_question_ids: string[];
  visual_safety_signals: string[];
  recommendation_status:
    | 'pending_questionnaire'
    | 'allowed'
    | 'blocked'
    | 'escalation_only'
    | 'completed'
    | 'unavailable';
  assessment_engine: 'multimodal_llm_prototype' | 'trained_classifier' | 'mock';
  engine_version: string;
  prompt_version: string;
  limitations: string[];
  assessed_at: string;
  inference_ms: number;
}

export interface SafetyResult {
  urgency: Urgency;
  red_flags: string[];
  recommendation_permission: RecommendationPermission;
  policy_version: string;
  action_message: string;
  feedback: SafetyFeedback | null;
}

export interface SafetyTrigger {
  code: string;
  label: string;
}

export interface ClinicianSummary {
  preliminary_condition: Condition;
  confidence_level: ConfidenceLevel;
  duration: Questionnaire['duration'];
  affected_body_area: Questionnaire['affected_body_area'];
  age_group: Questionnaire['age_group'];
  pain_level: number;
  reported_yes_answers: string[];
  reported_unsure_answers: string[];
  previous_treatment: string[];
  known_allergies: string[];
  current_products: string[];
}

export interface SafetyFeedback {
  heading: string;
  triggers: SafetyTrigger[];
  next_steps: string[];
  guidance_withheld_reason: string;
  clinician_summary: ClinicianSummary;
}

export type GuidanceLevel =
  | 'urgent_referral'
  | 'professional_review'
  | 'retake_or_review'
  | 'cautious_guidance'
  | 'condition_specific_guidance';

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
  guidance_level: GuidanceLevel;
  referral_required: boolean;
  safety: SafetyResult;
  model_version: string;
  prompt_version: string;
  disclaimer: string;
  generated_at: string;
  draft: RecommendationDraft;
}

export interface Questionnaire {
  duration: 'less_than_one_week' | 'one_to_four_weeks' | 'one_to_six_months' | 'more_than_six_months' | 'unsure';
  itching: Answer;
  pain_level: number;
  rapidly_spreading: Answer;
  affected_body_area: 'face_or_neck' | 'scalp' | 'chest_or_back' | 'arms_or_hands' | 'legs_or_feet' | 'groin_or_skin_folds' | 'other' | 'unsure';
  fever: Answer;
  high_fever: Answer;
  swelling: Answer;
  difficulty_breathing: Answer;
  lip_tongue_throat_swelling: Answer;
  bleeding: Answer;
  blistering: Answer;
  open_wound: Answer;
  eye_involvement: Answer;
  possible_infection: Answer;
  previous_treatment: string[];
  known_allergies: string[];
  current_products: string[];
  age_group: 'infant' | 'child' | 'adolescent' | 'adult' | 'older_adult' | 'prefer_not_to_say';
  recurrent: Answer;
}

export interface AssessmentDetail {
  id: string;
  status: AssessmentStatus;
  assessment: ImageAssessmentResult | null;
  questionnaire: Questionnaire | null;
  safety: SafetyResult | null;
  recommendation: RecommendationResult | null;
}

export interface ReferralRequest {
  assessment_id: string;
  name: string;
  contact: string;
  reason: string;
  summary: { condition: Condition; guidance_level: GuidanceLevel; referral_required: boolean };
}

export interface SkinContext {
  tone_group: 'melanin_rich' | 'user_selected_tone_group' | 'unspecified';
}

export interface CreateAssessmentResponse {
  id: string;
  status: AssessmentStatus;
}

export interface QuestionnaireResponse {
  id: string;
  status: AssessmentStatus;
  safety: SafetyResult;
}

export interface BackendErrorDetails {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details: unknown;
    request_id: string;
  };
}
