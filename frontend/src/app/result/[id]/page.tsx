'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { RecommendationResult } from '@/components/RecommendationResult';
import { SafetyFeedbackResult } from '@/components/SafetyFeedbackResult';
import { getAssessment } from '@/features/assessment/api';
import type { AssessmentDetail } from '@/features/assessment/types';

export default function ResultPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (id) getAssessment(id).then(setAssessment).catch(() => setError('We could not load this assessment. Please try again later.')); }, [id]);
  const safety = assessment?.safety;
  const hardBlocked = safety?.recommendation_permission === 'blocked';
  const safetyShapedRecommendation =
    safety && safety.urgency !== 'routine' && assessment?.recommendation;
  return <main className="mx-auto min-h-screen max-w-3xl px-4 py-8 sm:px-6 sm:py-12">{error ? <section className="rounded-3xl border border-red-200 bg-red-50 p-6"><h1 className="text-2xl font-semibold text-ink">Results unavailable</h1><p className="mt-3 text-sm text-red-700">{error}</p><Link href="/" className="mt-5 inline-block font-semibold text-moss">Start over</Link></section> : !assessment ? <p className="text-sm text-slate-600">Loading your result…</p> : hardBlocked && safety ? <SafetyFeedbackResult assessment={assessment} /> : assessment.recommendation ? <div className="space-y-6">{safetyShapedRecommendation ? <><SafetyFeedbackResult assessment={assessment} embedded /><section className="rounded-3xl border border-sky-200 bg-sky-50 p-5"><p className="text-sm font-semibold text-sky-950">AI-generated context continues below</p><p className="mt-1 text-sm leading-6 text-sky-900">The safety result shaped what the recommendation engine was allowed to provide; it did not erase the explanation.</p></section></> : null}<RecommendationResult recommendation={assessment.recommendation} assessment={assessment.assessment} /></div> : safety && safety.urgency !== 'routine' ? <SafetyFeedbackResult assessment={assessment} /> : <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-2xl font-semibold text-ink">Guidance is not ready yet</h1><p className="mt-3 text-sm text-slate-700">Please return to your assessment or start a new one.</p><Link href={`/assessment/${id}`} className="mt-5 inline-block font-semibold text-moss">Return to assessment</Link></section>}</main>;
}
