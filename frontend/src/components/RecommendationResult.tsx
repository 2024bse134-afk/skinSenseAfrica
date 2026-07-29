'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { FormEvent, ReactNode } from 'react';
import { requestReferral } from '@/features/assessment/api';
import type {
  ImageAssessmentResult,
  RecommendationResult as Recommendation,
} from '@/features/assessment/types';

const label = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function RecommendationResult({
  recommendation,
  assessment,
}: {
  recommendation: Recommendation;
  assessment?: ImageAssessmentResult | null;
}) {
  const [showReferral, setShowReferral] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [reason, setReason] = useState(recommendation.draft.recommended_action.referral_reason ?? '');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const referral = recommendation.referral_required;
  const needsRetake = recommendation.guidance_level === 'retake_or_review';
  const isEscalation =
    recommendation.safety.urgency === 'urgent' ||
    recommendation.safety.urgency === 'emergency';

  async function submitReferral(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setError(null);
    try { await requestReferral({ assessment_id: recommendation.assessment_id, name, contact, reason, summary: { condition: recommendation.condition, guidance_level: recommendation.guidance_level, referral_required: referral } }); setSent(true); }
    catch { setError('We could not send your request yet. Please try again.'); }
    finally { setSubmitting(false); }
  }
  return <>
    <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
      <div className={referral || needsRetake ? 'rounded-2xl bg-amber-50 p-5' : ''}><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Preliminary assessment</p><h1 className="mt-2 text-3xl font-semibold text-ink">{label(recommendation.condition)}</h1><p className="mt-2 text-sm text-slate-700"><strong>{label(recommendation.confidence_level)} confidence</strong>. This estimate is not a diagnosis.</p>{needsRetake ? <><p className="mt-4 text-sm leading-6 text-slate-700">The image did not provide enough clarity for reliable guidance. A clearer, well-lit photo may help.</p><Link href={`/assessment/${recommendation.assessment_id}`} className="mt-4 inline-block rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white">Retake photo</Link></> : null}{referral && !isEscalation ? <button type="button" onClick={() => setShowReferral(true)} className="mt-5 rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white">Request professional review</button> : null}</div>
      {assessment?.visual_findings.length ? <Block title="Why the AI leaned this way"><p>The visual assessment noted:</p><List items={assessment.visual_findings.map(label)} />{assessment.alternative_conditions.length ? <p className="mt-3">It also considered patterns associated with {assessment.alternative_conditions.map(label).join(', ')}.</p> : null}</Block> : null}
      <Block title="What this may mean"><p>{recommendation.draft.explanation}</p></Block>
      <Block title="Possible contributing factors"><List items={recommendation.draft.possible_contributing_factors} /></Block>
      <Block title="Skin-tone considerations"><List items={recommendation.draft.skin_tone_considerations} /></Block>
      <Block title={referral ? 'Why professional review is recommended' : 'Suggested next steps'}>{referral && recommendation.draft.recommended_action.referral_reason ? <p>{recommendation.draft.recommended_action.referral_reason}</p> : <List items={recommendation.draft.recommended_action.steps} />}</Block>
      {referral && !isEscalation && recommendation.draft.recommended_action.steps.length ? <Block title="Cautious steps while arranging review"><List items={recommendation.draft.recommended_action.steps} /></Block> : null}
      {!isEscalation ? <Block title="Prevention and care"><List items={recommendation.draft.prevention} /></Block> : null}
      <Block title="Get medical care promptly if"><List items={recommendation.draft.warning_signs} /></Block>
      <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Important:</strong> {recommendation.disclaimer}</aside>
    </section>
    {showReferral ? <div role="dialog" aria-modal="true" aria-label="Request professional review" className="fixed inset-0 z-10 grid place-items-center bg-slate-950/40 p-4"><form onSubmit={submitReferral} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-soft"><h2 className="text-xl font-semibold text-ink">Request professional review</h2>{sent ? <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">Your request was recorded in this prototype. No care-team notification integration is active yet.</p> : <><label className="mt-4 block text-sm font-medium">Name<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="mt-3 block text-sm font-medium">Phone or email<input required value={contact} onChange={(event) => setContact(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="mt-3 block text-sm font-medium">Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>{error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}<button disabled={submitting} className="mt-5 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white">{submitting ? 'Sending…' : 'Send request'}</button></>}<button type="button" onClick={() => setShowReferral(false)} className="ml-3 mt-5 text-sm font-semibold text-slate-600">Close</button></form></div> : null}
  </>;
}
function Block({ title, children }: { title: string; children: ReactNode }) { return <section><h2 className="text-lg font-semibold text-ink">{title}</h2><div className="mt-2 text-sm leading-6 text-slate-700">{children}</div></section>; }
function List({ items }: { items: string[] }) { return items.length ? <ul className="space-y-2">{items.map((item) => <li key={item}>• {item}</li>)}</ul> : <p>No additional information available.</p>; }
