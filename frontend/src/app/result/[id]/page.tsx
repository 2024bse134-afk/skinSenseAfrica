'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppFooter, AppHeader, MobileJourney } from '@/components/AppChrome';
import { Icon } from '@/components/Icons';
import { RecommendationResult } from '@/components/RecommendationResult';
import { SafetyFeedbackResult } from '@/components/SafetyFeedbackResult';
import { getAssessment } from '@/features/assessment/api';
import type { AssessmentDetail } from '@/features/assessment/types';

export default function ResultPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getAssessment(id)
      .then(setAssessment)
      .catch(() =>
        setError('We could not load this assessment. Please try again later.'),
      );
  }, [id]);

  const safety = assessment?.safety;
  const hardBlocked = safety?.recommendation_permission === 'blocked';

  return (
    <div className="min-h-screen">
      <AppHeader step="results" />
      <main className="ss-page">
        <div className="ss-container max-w-[1180px]">
          <MobileJourney step={3} />

          {error ? (
            <section className="mx-auto max-w-2xl rounded-[28px] border border-red-200 bg-red-50 p-6 shadow-soft sm:p-8">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-red-100 text-red-700">
                <Icon name="warning" className="h-6 w-6" />
              </span>
              <p className="ss-kicker mt-5 text-red-700">Unable to load</p>
              <h1 className="mt-2 font-display text-3xl text-forest">
                Results are unavailable
              </h1>
              <p className="mt-3 text-sm leading-7 text-red-800/75">{error}</p>
              <Link href="/" className="ss-button-primary mt-6">
                Start over
                <Icon name="arrow-right" className="h-4 w-4" />
              </Link>
            </section>
          ) : !assessment ? (
            <ResultSkeleton />
          ) : hardBlocked && safety ? (
            <SafetyFeedbackResult assessment={assessment} />
          ) : assessment.recommendation ? (
            <RecommendationResult
              recommendation={assessment.recommendation}
              assessment={assessment.assessment}
            />
          ) : safety && safety.urgency !== 'routine' ? (
            <SafetyFeedbackResult assessment={assessment} />
          ) : (
            <section className="mx-auto max-w-2xl ss-card p-6 sm:p-8">
              <span className="ss-icon-box">
                <Icon name="info" className="h-5 w-5" />
              </span>
              <h1 className="mt-5 font-display text-3xl text-forest">
                Guidance is not ready yet
              </h1>
              <p className="mt-3 text-sm leading-7 text-forest/58">
                Return to the assessment to complete any remaining steps.
              </p>
              <Link href={`/assessment/${id}`} className="ss-button-primary mt-6">
                Return to assessment
                <Icon name="arrow-right" className="h-4 w-4" />
              </Link>
            </section>
          )}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading your result" aria-live="polite">
      <section className="overflow-hidden rounded-[32px] bg-forest p-7 sm:p-10">
        <div className="h-5 w-36 animate-pulse rounded-full bg-white/10" />
        <div className="mt-7 h-12 w-64 max-w-full animate-pulse rounded-2xl bg-white/10" />
        <div className="mt-4 h-4 w-48 animate-pulse rounded-full bg-white/10" />
      </section>
      <div className="grid gap-6 lg:grid-cols-[1.3fr_.7fr]">
        <div className="ss-card space-y-4 p-7">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-sage" />
          <div className="h-6 w-52 animate-pulse rounded-lg bg-forest/8" />
          <div className="h-4 w-full animate-pulse rounded bg-forest/6" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-forest/6" />
        </div>
        <div className="ss-card space-y-4 p-7">
          <div className="h-6 w-36 animate-pulse rounded-lg bg-forest/8" />
          <div className="h-4 w-full animate-pulse rounded bg-forest/6" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-forest/6" />
        </div>
      </div>
      <p className="text-center text-xs font-semibold text-forest/40">
        Loading your assessment and guidance…
      </p>
    </div>
  );
}
