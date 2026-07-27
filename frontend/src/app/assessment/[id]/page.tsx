'use client';

import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ImageUploader } from '@/components/ImageUploader';
import { ProcessingState } from '@/components/ProcessingState';
import { QuestionnaireStep } from '@/components/QuestionnaireStep';
import { classifyAssessment, getAssessmentRecommendation, saveQuestionnaire, uploadAssessmentImage } from '@/features/assessment/api';
import type { Questionnaire } from '@/features/assessment/types';
import { useAssessment } from '@/features/assessment/useAssessment';
import { ApiClientError } from '@/lib/api-client';

function readableCondition(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

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
  useEffect(() => () => { if (data.imagePreviewUrl) URL.revokeObjectURL(data.imagePreviewUrl); }, [data.imagePreviewUrl]);

  useEffect(() => {
    if (phase !== 'generatingRecommendation' || !assessmentId || startedGeneration.current) return;
    startedGeneration.current = true;
    getAssessmentRecommendation(assessmentId).then((recommendation) => {
      transition({ type: recommendation.referral_required ? 'markRequiresReview' : 'markCompleted' });
      router.push(`/result/${assessmentId}`);
    }).catch((error) => transition({
      type: 'markFailed',
      error: error instanceof ApiClientError && error.code === 'RECOMMENDATION_UNAVAILABLE'
        ? 'Your guidance could not be prepared right now. Your answers are saved, so you can safely retry.'
        : error instanceof ApiClientError ? error.message : 'We could not prepare your guidance right now.',
    }));
  }, [assessmentId, phase, router, transition]);

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
      await uploadAssessmentImage(assessmentId, data.imageFile);
      transition({ type: 'startClassifying' });
      const response = await classifyAssessment(assessmentId);
      transition({ type: 'setClassificationResult', classificationResult: response });
      transition({ type: 'startCollectingSymptoms' });
    } catch (error) {
      const message = error instanceof ApiClientError && error.code === 'INVALID_IMAGE'
        ? 'We could not use this photo. Please retake it in good light and make sure the skin area is in focus.'
        : error instanceof ApiClientError ? error.message : 'We could not process this image. Please try again.';
      transition({ type: 'markFailed', error: message });
    }
  }

  async function handleQuestionnaireComplete(questionnaire: Questionnaire) {
    if (!assessmentId) return;
    setIsSavingQuestionnaire(true);
    try {
      await saveQuestionnaire(assessmentId, questionnaire);
      transition({ type: 'setQuestionnaire', questionnaire });
      startedGeneration.current = false;
      transition({ type: 'startGeneratingRecommendation' });
    } catch (error) {
      transition({ type: 'markFailed', error: error instanceof ApiClientError ? error.message : 'We could not save your answers. Please try again.' });
    } finally { setIsSavingQuestionnaire(false); }
  }

  function retryRecommendation() {
    startedGeneration.current = false;
    transition({ type: 'startGeneratingRecommendation' });
  }

  const isWorking = phase === 'uploading' || phase === 'classifying';
  const result = data.classificationResult;
  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">SkinSense Africa</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Capture and review your image</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Use bright, natural light if possible. Keep the affected area in focus, avoid filters, and include only the skin area you want assessed.</p>
      </header>
      {phase === 'generatingRecommendation' ? <ProcessingState /> : phase === 'collectingSymptoms' ? (
        <QuestionnaireStep onComplete={handleQuestionnaireComplete} isSaving={isSavingQuestionnaire} />
      ) : result ? (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-soft" aria-live="polite">
          <p className="text-sm font-semibold text-emerald-900">Image classified</p>
          <h2 className="mt-3 text-2xl font-semibold text-ink">Condition detected: {readableCondition(result.condition)}</h2>
          <p className="mt-2 text-base text-slate-700">Confidence: <strong>{Math.round(result.confidence * 100)}%</strong></p>
          <p className="mt-5 text-sm leading-6 text-slate-700">This is an educational classification, not a medical diagnosis. Continue by answering a few symptom questions.</p>
        </section>
      ) : data.imagePreviewUrl && data.imageFile ? (
        <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
          <div><h2 className="text-lg font-semibold text-ink">Review your image</h2><p className="mt-1 text-sm text-slate-600">Check that it is sharp, well-lit, and shows the affected area.</p></div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100"><Image src={data.imagePreviewUrl} alt="Selected skin image for review" fill unoptimized className="object-contain" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={handleReplace} disabled={isWorking} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-ink disabled:opacity-60">Retake or replace</button>
            <button type="button" onClick={handleConfirm} disabled={isWorking} className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{phase === 'uploading' ? 'Uploading image…' : phase === 'classifying' ? 'Classifying image…' : 'Confirm and continue'}</button>
          </div>
        </section>
      ) : <ImageUploader onFileSelected={handleFileSelected} onValidationError={setSelectionError} disabled={isWorking} />}
      {selectionError ? <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{selectionError}</p> : null}
      {phase === 'failed' && data.error ? <section role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p>{data.error}</p>{data.questionnaire ? <button type="button" onClick={retryRecommendation} className="mt-3 rounded-xl bg-ink px-4 py-2 font-semibold text-white">Retry guidance</button> : <button type="button" onClick={handleReplace} className="mt-3 rounded-xl bg-ink px-4 py-2 font-semibold text-white">Retake photo</button>}</section> : null}
      <p className="mt-8 text-xs leading-5 text-slate-500">Your image is used temporarily for this assessment and is not intended for long-term storage in the V1 flow.</p>
    </main>
  );
}
