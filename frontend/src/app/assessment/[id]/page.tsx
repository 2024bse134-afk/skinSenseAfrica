'use client';

import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AppFooter, AppHeader, MobileJourney } from '@/components/AppChrome';
import { Icon } from '@/components/Icons';
import { ImageUploader } from '@/components/ImageUploader';
import { ProcessingState } from '@/components/ProcessingState';
import { QuestionnaireStep } from '@/components/QuestionnaireStep';
import {
  assessImage,
  getAssessmentRecommendation,
  saveQuestionnaire,
} from '@/features/assessment/api';
import type {
  ImageQualityIssue,
  Questionnaire,
} from '@/features/assessment/types';
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
    if (
      phase !== 'generatingRecommendation' ||
      !assessmentId ||
      startedGeneration.current
    ) {
      return;
    }
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
            error instanceof ApiClientError &&
            error.code === 'RECOMMENDATION_UNAVAILABLE'
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
    transition({
      type: 'selectImage',
      file,
      previewUrl: URL.createObjectURL(file),
    });
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

  function handleRetry() {
    if (data.safety) {
      startedGeneration.current = false;
      transition({ type: 'startGeneratingRecommendation' });
      return;
    }
    handleReplace();
  }

  const isWorking = phase === 'uploading' || phase === 'assessingImage';
  const assessment = data.assessmentResult;
  const journeyStep =
    phase === 'generatingRecommendation' || Boolean(data.safety)
      ? 3
      : phase === 'collectingSymptoms'
        ? 2
        : 1;
  const headerStep =
    journeyStep === 3 ? 'results' : journeyStep === 2 ? 'questions' : 'image';

  return (
    <div className="min-h-screen">
      <AppHeader step={headerStep} />
      <main className="ss-page">
        <div className="ss-container max-w-[1000px]">
          <MobileJourney step={journeyStep} />

          {phase !== 'collectingSymptoms' && phase !== 'generatingRecommendation' ? (
            <header className="mb-7 sm:mb-9">
              <div className="flex flex-wrap items-center gap-2">
                <p className="ss-kicker">Step one · Image assessment</p>
                <span className="rounded-full bg-sage/65 px-2.5 py-1 text-[10px] font-bold text-moss">
                  Private by design
                </span>
              </div>
              <h1 className="mt-3 max-w-2xl font-display text-4xl leading-[1.08] tracking-[-0.03em] text-forest sm:text-5xl">
                Give the AI a clear view.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-forest/60 sm:text-base">
                One focused image is enough. You will review it before anything is sent.
              </p>
            </header>
          ) : phase === 'collectingSymptoms' ? (
            <header className="mb-7">
              <p className="ss-kicker">Step two · Safety and context</p>
              <h1 className="mt-3 font-display text-3xl tracking-[-0.03em] text-forest sm:text-4xl">
                Add what the image cannot tell us.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-forest/58">
                Your answers shape urgency and what the recommendation engine is allowed to provide.
              </p>
            </header>
          ) : (
            <header className="mb-7 text-center">
              <p className="ss-kicker">Step three · Guided result</p>
              <h1 className="mt-3 font-display text-3xl tracking-[-0.03em] text-forest sm:text-4xl">
                Connecting the visual clues and your answers.
              </h1>
            </header>
          )}

          {phase === 'generatingRecommendation' || isWorking ? (
            <ProcessingState mode={isWorking ? 'assessment' : 'recommendation'} />
          ) : phase === 'collectingSymptoms' ? (
            <QuestionnaireStep
              assessment={assessment!}
              onComplete={handleQuestionnaireComplete}
              isSaving={isSavingQuestionnaire}
            />
          ) : assessment && phase === 'retakeRequired' ? (
            <RetakeCard
              issues={assessment.image_quality.issues}
              onReplace={handleReplace}
            />
          ) : assessment && phase === 'assessmentReady' ? (
            <AssessmentReadyCard
              assessment={assessment}
              onContinue={() => transition({ type: 'startCollectingSymptoms' })}
            />
          ) : data.imagePreviewUrl && data.imageFile ? (
            <PreviewCard
              previewUrl={data.imagePreviewUrl}
              file={data.imageFile}
              onReplace={handleReplace}
              onConfirm={handleConfirm}
            />
          ) : (
            <ImageUploader
              onFileSelected={handleFileSelected}
              onValidationError={setSelectionError}
            />
          )}

          {selectionError ? (
            <Alert message={selectionError} />
          ) : null}
          {phase === 'failed' && data.error ? (
            <section
              role="alert"
              className="mt-5 flex flex-col gap-4 rounded-[24px] border border-red-200 bg-red-50 p-5 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex gap-3">
                <Icon name="warning" className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
                <div>
                  <p className="font-bold">Something interrupted this step</p>
                  <p className="mt-1 leading-6 text-red-800/80">{data.error}</p>
                </div>
              </div>
              <button type="button" onClick={handleRetry} className="ss-button-secondary shrink-0 border-red-200">
                <Icon name="refresh" className="h-4 w-4" />
                {data.safety ? 'Retry guidance' : 'Choose another image'}
              </button>
            </section>
          ) : null}

          <div className="mt-7 flex items-center justify-center gap-2 text-center text-[11px] leading-5 text-forest/42">
            <Icon name="lock" className="h-4 w-4 text-moss" />
            The backend sanitizes this image for one request and does not retain the image bytes.
          </div>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}

function PreviewCard({
  previewUrl,
  file,
  onReplace,
  onConfirm,
}: {
  previewUrl: string;
  file: File;
  onReplace: () => void;
  onConfirm: () => void;
}) {
  return (
    <section className="ss-card overflow-hidden">
      <div className="grid md:grid-cols-[1.18fr_.82fr]">
        <div className="relative min-h-[22rem] bg-[#e8eee9] md:min-h-[32rem]">
          <Image
            src={previewUrl}
            alt="Selected skin image ready for review"
            fill
            unoptimized
            className="object-contain p-3 sm:p-5"
          />
          <span className="absolute left-4 top-4 rounded-full bg-forest/75 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur">
            Local preview
          </span>
        </div>
        <div className="flex flex-col justify-between border-t border-forest/8 p-5 sm:p-7 md:border-l md:border-t-0">
          <div>
            <p className="ss-kicker">Review before upload</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-forest">
              Is the concern easy to see?
            </h2>
            <p className="mt-3 text-sm leading-7 text-forest/58">
              Confirm the area is sharp, evenly lit, and not hidden by glare, clothing, or hair.
            </p>
            <dl className="mt-6 space-y-3 rounded-2xl bg-mist/70 p-4 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-forest/45">File type</dt>
                <dd className="font-bold text-forest">{file.type.replace('image/', '').toUpperCase()}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-forest/45">File size</dt>
                <dd className="font-bold text-forest">{(file.size / 1024 / 1024).toFixed(1)} MB</dd>
              </div>
            </dl>
          </div>
          <div className="mt-7 grid gap-3">
            <button type="button" onClick={onConfirm} className="ss-button-accent w-full">
              Confirm and assess
              <Icon name="arrow-right" className="h-4 w-4" />
            </button>
            <button type="button" onClick={onReplace} className="ss-button-secondary w-full">
              <Icon name="refresh" className="h-4 w-4" />
              Retake or replace
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function AssessmentReadyCard({
  assessment,
  onContinue,
}: {
  assessment: NonNullable<ReturnType<typeof useAssessment>['data']['assessmentResult']>;
  onContinue: () => void;
}) {
  return (
    <section className="ss-card overflow-hidden" aria-live="polite">
      <div className="grid lg:grid-cols-[.84fr_1.16fr]">
        <div className="bg-forest p-6 text-white sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9ed9c7]">
              Preliminary pattern
            </p>
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold text-white/70">
              {readable(assessment.confidence_level)} confidence
            </span>
          </div>
          <h2 className="mt-5 font-display text-4xl tracking-[-0.03em]">
            {readable(assessment.condition)}
          </h2>
          <p className="mt-4 text-sm leading-7 text-white/65">
            This is an AI-assisted preliminary assessment, not a confirmed diagnosis.
          </p>
          <div className="mt-8 flex items-start gap-3 border-t border-white/10 pt-5">
            <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-[#9ed9c7]" />
            <p className="text-xs leading-5 text-white/55">
              Safety and symptom questions come next before educational guidance is generated.
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <p className="ss-kicker">What the visual engine noticed</p>
          {assessment.visual_findings.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {assessment.visual_findings.map((finding) => (
                <span key={finding} className="rounded-full border border-moss/15 bg-sage/55 px-3 py-1.5 text-xs font-bold text-forest">
                  {readable(finding)}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-forest/50">No controlled visual findings were returned.</p>
          )}

          {assessment.alternative_conditions.length ? (
            <div className="mt-7">
              <p className="text-xs font-bold text-forest/45">Patterns also considered</p>
              <p className="mt-2 text-sm leading-6 text-forest/70">
                {assessment.alternative_conditions.map(readable).join(' · ')}
              </p>
            </div>
          ) : null}

          <button type="button" onClick={onContinue} className="ss-button-primary mt-8 w-full sm:w-auto">
            Continue to safety questions
            <Icon name="arrow-right" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

function RetakeCard({
  issues,
  onReplace,
}: {
  issues: ImageQualityIssue[];
  onReplace: () => void;
}) {
  return (
    <section className="ss-card overflow-hidden">
      <div className="border-b border-amber-200 bg-amber-50 p-6 sm:p-8">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-800">
          <Icon name="camera" className="h-6 w-6" />
        </span>
        <p className="ss-kicker mt-5 text-amber-800">Image quality check</p>
        <h2 className="mt-2 font-display text-3xl text-forest sm:text-4xl">
          Let&apos;s try one clearer photo.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-forest/60">
          A better image helps the assessment stay useful and reduces avoidable uncertainty.
        </p>
      </div>
      <div className="p-6 sm:p-8">
        <ul className="grid gap-3 sm:grid-cols-2">
          {issues.map((issue) => (
            <li key={issue} className="flex gap-3 rounded-2xl border border-forest/8 bg-mist/55 p-4 text-sm leading-6 text-forest/70">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-800">
                <Icon name="check" className="h-3 w-3" />
              </span>
              {qualityHelp[issue]}
            </li>
          ))}
        </ul>
        <button type="button" onClick={onReplace} className="ss-button-accent mt-7">
          <Icon name="camera" className="h-4 w-4" />
          Take another photo
        </button>
      </div>
    </section>
  );
}

function Alert({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mt-5 flex gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <Icon name="warning" className="mt-0.5 h-5 w-5 shrink-0" />
      {message}
    </p>
  );
}
