'use client';

import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ImageUploader } from '@/components/ImageUploader';
import { ProcessingState } from '@/components/ProcessingState';
import { QuestionnaireStep } from '@/components/QuestionnaireStep';
import {
  assessImage,
  getAssessmentRecommendation,
  saveQuestionnaire,
} from '@/features/assessment/api';
import type { ImageQualityIssue, Questionnaire } from '@/features/assessment/types';
import { useAssessment } from '@/features/assessment/useAssessment';
import { ApiClientError } from '@/lib/api-client';

const readable = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const qualityHelp: Record<ImageQualityIssue, string> = {
  blurred: 'Hold the camera steady and tap the affected area to focus.',
  poor_lighting: 'Use bright, even natural light and avoid deep shadows.',
  too_far: 'Move closer while keeping the affected area in focus.',
  obstructed: 'Remove anything covering the affected area.',
  multiple_unrelated_areas: 'Include one related skin concern in the image.',
  no_visible_skin_concern: 'Make sure the affected skin area is clearly visible.',
};

const assessmentErrorMessages: Record<string, string> = {
  INVALID_IMAGE_TYPE: 'Choose a genuine JPEG, PNG, or WebP image.',
  IMAGE_TOO_LARGE: 'This image is too large. Choose an image under 8 MB.',
  IMAGE_DECODE_FAILED: 'This image appears damaged or unreadable. Choose another image.',
  IMAGE_QUALITY_INSUFFICIENT: 'This image is too small for assessment. Take a closer photo.',
  ASSESSMENT_TIMEOUT: 'The assessment timed out. Please try the upload again.',
  ASSESSMENT_PROVIDER_UNAVAILABLE: 'Image assessment is temporarily unavailable.',
  ASSESSMENT_OUTPUT_INVALID: 'The assessment could not be safely interpreted. Please retry.',
};

export default function AssessmentImagePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const assessmentId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { phase, data, transition } = useAssessment(assessmentId ?? null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [isSavingQuestionnaire, setIsSavingQuestionnaire] = useState(false);
  const startedGeneration = useRef(false);

  useEffect(() => {
    if (assessmentId) transition({ type: 'setAssessmentId', assessmentId });
  }, [assessmentId, transition]);

  useEffect(
    () => () => {
      if (data.imagePreviewUrl) URL.revokeObjectURL(data.imagePreviewUrl);
    },
    [data.imagePreviewUrl],
  );

  useEffect(() => {
    if (phase !== 'generatingRecommendation' || !assessmentId || startedGeneration.current) return;
    startedGeneration.current = true;
    getAssessmentRecommendation(assessmentId)
      .then(() => {
        transition({ type: 'markCompleted' });
        router.push(`/result/${assessmentId}`);
      })
      .catch((error) => {
        if (data.safety && data.safety.urgency !== 'routine') {
          transition({ type: 'markRequiresReview' });
          router.push(`/result/${assessmentId}`);
          return;
        }
        transition({
          type: 'markFailed',
          error:
            error instanceof ApiClientError && error.code === 'RECOMMENDATION_UNAVAILABLE'
              ? 'Educational guidance could not be prepared right now. Please retry.'
              : error instanceof ApiClientError
                ? error.message
                : 'We could not prepare your guidance right now.',
        });
      });
  }, [assessmentId, data.safety, phase, router, transition]);

  function handleFileSelected(file: File) {
    if (data.imagePreviewUrl) URL.revokeObjectURL(data.imagePreviewUrl);
    setSelectionError(null);
    transition({ type: 'selectImage', file, previewUrl: URL.createObjectURL(file) });
  }

  function handleReplace() {
    if (data.imagePreviewUrl) URL.revokeObjectURL(data.imagePreviewUrl);
    setSelectionError(null);
    transition({ type: 'clearImage' });
  }

  async function handleConfirm() {
    if (!assessmentId || !data.imageFile) return;
    transition({ type: 'startUploading' });
    try {
      transition({ type: 'startAssessingImage' });
      const response = await assessImage(assessmentId, data.imageFile);
      transition({ type: 'setAssessmentResult', assessmentResult: response });
      transition({
        type:
          response.image_quality.status === 'retake_required'
            ? 'markRetakeRequired'
            : 'markAssessmentReady',
      });
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? assessmentErrorMessages[error.code] ?? error.message
          : 'We could not process this image. Please try again.';
      transition({ type: 'markFailed', error: message });
    }
  }

  async function handleQuestionnaireComplete(questionnaire: Questionnaire) {
    if (!assessmentId) return;
    setIsSavingQuestionnaire(true);
    try {
      const response = await saveQuestionnaire(assessmentId, questionnaire);
      transition({ type: 'setQuestionnaire', questionnaire });
      transition({ type: 'setSafety', safety: response.safety });
      if (response.safety.recommendation_permission !== 'blocked') {
        startedGeneration.current = false;
        transition({ type: 'startGeneratingRecommendation' });
      } else {
        transition({ type: 'markRequiresReview' });
        router.push(`/result/${assessmentId}`);
      }
    } catch (error) {
      transition({
        type: 'markFailed',
        error:
          error instanceof ApiClientError
            ? error.message
            : 'We could not save your answers. Please try again.',
      });
    } finally {
      setIsSavingQuestionnaire(false);
    }
  }

  const isWorking = phase === 'uploading' || phase === 'assessingImage';
  const assessment = data.assessmentResult;

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">SkinSense Africa</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Capture and review your image</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Use bright, natural light. Keep one affected area in focus and avoid filters.
        </p>
      </header>

      {phase === 'generatingRecommendation' || isWorking ? (
        <ProcessingState mode={isWorking ? 'assessment' : 'recommendation'} />
      ) : phase === 'collectingSymptoms' ? (
        <QuestionnaireStep onComplete={handleQuestionnaireComplete} isSaving={isSavingQuestionnaire} />
      ) : assessment && phase === 'retakeRequired' ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-soft">
          <p className="text-sm font-semibold text-amber-950">A clearer image is needed</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">Please retake this photo</h2>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
            {assessment.image_quality.issues.map((issue) => (
              <li key={issue}>• {qualityHelp[issue]}</li>
            ))}
          </ul>
          <button type="button" onClick={handleReplace} className="mt-5 rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white">
            Retake or replace
          </button>
        </section>
      ) : assessment && phase === 'assessmentReady' ? (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-soft" aria-live="polite">
          <p className="text-sm font-semibold text-emerald-900">Preliminary assessment</p>
          <h2 className="mt-3 text-2xl font-semibold text-ink">{readable(assessment.condition)}</h2>
          <p className="mt-2 text-base text-slate-700">
            Confidence level: <strong>{readable(assessment.confidence_level)}</strong>
          </p>
          <p className="mt-5 text-sm leading-6 text-slate-700">
            This is not a diagnosis. Answer the safety and symptom questions before any educational guidance is prepared.
          </p>
          <button type="button" onClick={() => transition({ type: 'startCollectingSymptoms' })} className="mt-5 rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white">
            Continue to safety questions
          </button>
        </section>
      ) : data.imagePreviewUrl && data.imageFile ? (
        <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
          <div>
            <h2 className="text-lg font-semibold text-ink">Review your image</h2>
            <p className="mt-1 text-sm text-slate-600">Check that it is sharp, well-lit, and shows one affected area.</p>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
            <Image src={data.imagePreviewUrl} alt="Selected skin image for review" fill unoptimized className="object-contain" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={handleReplace} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-ink">
              Retake or replace
            </button>
            <button type="button" onClick={handleConfirm} className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white">
              Confirm and assess
            </button>
          </div>
        </section>
      ) : (
        <ImageUploader onFileSelected={handleFileSelected} onValidationError={setSelectionError} />
      )}

      {selectionError ? <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{selectionError}</p> : null}
      {phase === 'failed' && data.error ? (
        <section role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{data.error}</p>
          <button type="button" onClick={handleReplace} className="mt-3 rounded-xl bg-ink px-4 py-2 font-semibold text-white">
            Choose another image
          </button>
        </section>
      ) : null}
      <p className="mt-8 text-xs leading-5 text-slate-500">
        The backend sanitizes this image for one assessment request and does not retain the image bytes.
      </p>
    </main>
  );
}
