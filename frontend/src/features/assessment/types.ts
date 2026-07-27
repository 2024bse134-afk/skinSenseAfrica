export type SupportedCondition =
  | 'acne'
  | 'eczema_dermatitis'
  | 'hyperpigmentation'
  | 'possible_fungal_infection'
  | 'other_uncertain';

export enum AssessmentStatus {
  Draft = 'draft',
  ImageUploaded = 'image_uploaded',
  Classified = 'classified',
  QuestionnaireCompleted = 'questionnaire_completed',
  RecommendationPending = 'recommendation_pending',
  Completed = 'completed',
  ProfessionalReviewRequired = 'professional_review_required',
  FailedRetryable = 'failed_retryable',
  Cancelled = 'cancelled',
}

export interface ClassificationResult {
  condition: SupportedCondition;
  confidence: number;
  model_version: string;
  inference_ms: number;
  predicted_at: string;
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
  condition: SupportedCondition;
  confidence: number;
  guidance_level: GuidanceLevel;
  referral_required: boolean;
  urgency: string;
  model_version: string;
  prompt_version: string;
  disclaimer: string;
  generated_at: string;
  draft: RecommendationDraft;
}

export interface AssessmentDetail {
  id: string;
  status: AssessmentStatus;
  classification: ClassificationResult | null;
  questionnaire: Questionnaire | null;
  recommendation: RecommendationResult | null;
}

export interface ReferralRequest {
  assessment_id: string;
  name: string;
  contact: string;
  reason: string;
  summary: { condition: SupportedCondition; guidance_level: GuidanceLevel; referral_required: boolean };
}

export interface Questionnaire {
  duration: string | null;
  itching: boolean | null;
  pain_level: number | null;
  rapidly_spreading: boolean | null;
  affected_area: string | null;
  fever: boolean | null;
  swelling: boolean | null;
  bleeding_or_open_wound: boolean | null;
  eye_involvement: boolean | null;
  previous_treatments: string[];
  known_allergies: string[];
  current_products: string[];
}

export interface SkinContext {
  tone_group: 'melanin_rich' | 'user_selected_tone_group' | 'unspecified';
}

export interface CreateAssessmentResponse {
  id: string;
  status?: AssessmentStatus;
}

export interface UploadAssessmentImageResponse {
  id: string;
  status?: AssessmentStatus;
}

export type ClassifyAssessmentResponse = ClassificationResult;

export interface BackendErrorDetails {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details: unknown;
  };
}

export interface AssessmentCollectedData {
  assessmentId: string | null;
  imageFile: File | null;
  imagePreviewUrl: string | null;
  classificationResult: ClassificationResult | null;
  questionnaire: Questionnaire | null;
  skinContext: SkinContext | null;
  error: string | null;
}
