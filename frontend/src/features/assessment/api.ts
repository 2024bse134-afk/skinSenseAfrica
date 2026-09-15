import { apiRequest } from "@/lib/api-client";
import type {
    CreateAssessmentResponse,
    ImageAssessmentResult,
    Questionnaire,
    QuestionnaireResponse,
    RecommendationResult,
    AssessmentDetail,
    ReferralRequest,
    ReferralResponse,
} from "./types";

export async function createAssessment(): Promise<CreateAssessmentResponse> {
    return apiRequest<CreateAssessmentResponse>("/v1/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });
}

export async function assessImage(
    assessmentId: string,
    image: File,
): Promise<ImageAssessmentResult> {
    const formData = new FormData();
    formData.append("image", image);

    return apiRequest<ImageAssessmentResult>(`/v1/assessments/${assessmentId}/image-assessment`, {
        method: "POST",
        body: formData,
    });
}

export async function saveQuestionnaire(
    assessmentId: string,
    questionnaire: Questionnaire,
): Promise<QuestionnaireResponse> {
    return apiRequest<QuestionnaireResponse>(`/v1/assessments/${assessmentId}/questionnaire`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(questionnaire),
    });
}

export async function getAssessmentRecommendation(
    assessmentId: string,
): Promise<RecommendationResult> {
    return apiRequest<RecommendationResult>(`/v1/assessments/${assessmentId}/recommendation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });
}

export async function getAssessment(
    assessmentId: string,
): Promise<AssessmentDetail> {
    return apiRequest<AssessmentDetail>(`/v1/assessments/${assessmentId}`, {
        method: "GET",
    });
}

export async function requestReferral(
    request: ReferralRequest,
): Promise<ReferralResponse> {
    return apiRequest<ReferralResponse>("/v1/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
    });
}
