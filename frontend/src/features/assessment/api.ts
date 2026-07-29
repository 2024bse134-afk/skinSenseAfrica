import { getJson, postFormData, postJson, putJson } from '@/lib/api-client';
import type {
  AssessmentDetail,
  CreateAssessmentResponse,
  ImageAssessmentResult,
  Questionnaire,
  QuestionnaireResponse,
  RecommendationResult,
  ReferralRequest,
} from './types';

export async function createAssessment(): Promise<CreateAssessmentResponse> {
  return postJson<CreateAssessmentResponse>('/v1/assessments', {});
}

export async function assessImage(
  assessmentId: string,
  image: File,
): Promise<ImageAssessmentResult> {
  const formData = new FormData();
  formData.append('image', image);
  return postFormData<ImageAssessmentResult>(
    `/v1/assessments/${assessmentId}/image-assessment`,
    formData,
  );
}

export async function getAssessmentRecommendation(assessmentId: string) {
  return postJson<RecommendationResult>(`/v1/assessments/${assessmentId}/recommendation`, {});
}

export function saveQuestionnaire(assessmentId: string, questionnaire: Questionnaire) {
  return putJson<QuestionnaireResponse>(`/v1/assessments/${assessmentId}/questionnaire`, questionnaire);
}

export function getAssessment(assessmentId: string) {
  return getJson<AssessmentDetail>(`/v1/assessments/${assessmentId}`);
}

export function requestReferral(request: ReferralRequest) {
  return postJson('/v1/referrals', request);
}
