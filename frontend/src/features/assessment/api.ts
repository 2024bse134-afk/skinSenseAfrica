import { getJson, postFormData, postJson, putJson } from '@/lib/api-client';
import type {
  AssessmentDetail,
  ClassifyAssessmentResponse,
  CreateAssessmentResponse,
  Questionnaire,
  RecommendationResult,
  ReferralRequest,
  UploadAssessmentImageResponse,
} from './types';

export async function createAssessment(): Promise<CreateAssessmentResponse> {
  return postJson<CreateAssessmentResponse>('/v1/assessments', {});
}

export async function uploadAssessmentImage(
  assessmentId: string,
  image: File,
): Promise<UploadAssessmentImageResponse> {
  const formData = new FormData();
  formData.append('image', image);
  return postFormData<UploadAssessmentImageResponse>(`/v1/assessments/${assessmentId}/image`, formData);
}

export async function classifyAssessment(assessmentId: string): Promise<ClassifyAssessmentResponse> {
  return postJson<ClassifyAssessmentResponse>(`/v1/assessments/${assessmentId}/classify`, {});
}

export async function getAssessmentRecommendation(assessmentId: string) {
  return postJson<RecommendationResult>(`/v1/assessments/${assessmentId}/recommendation`, {});
}

export function saveQuestionnaire(assessmentId: string, questionnaire: Questionnaire) {
  return putJson(`/v1/assessments/${assessmentId}/questionnaire`, questionnaire);
}

export function getAssessment(assessmentId: string) {
  return getJson<AssessmentDetail>(`/v1/assessments/${assessmentId}`);
}

export function requestReferral(request: ReferralRequest) {
  return postJson('/v1/referrals', request);
}
