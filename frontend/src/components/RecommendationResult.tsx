'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Icon, type IconName } from '@/components/Icons';
import { requestReferral } from '@/features/assessment/api';
import type {
  ImageAssessmentResult,
  RecommendationResult as Recommendation,
} from '@/features/assessment/types';

const label = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

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
  const [reason, setReason] = useState(
    recommendation.draft.recommended_action.referral_reason ?? '',
  );
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const referral = recommendation.referral_required;
  const needsRetake = recommendation.guidance_level === 'retake_or_review';
  const isEscalation =
    recommendation.safety.urgency === 'urgent' ||
    recommendation.safety.urgency === 'emergency';

  async function submitReferral(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await requestReferral({
        assessment_id: recommendation.assessment_id,
        name,
        contact,
        reason,
        summary: {
          condition: recommendation.condition,
          guidance_level: recommendation.guidance_level,
          referral_required: referral,
        },
      });
      setSent(true);
    } catch {
      setError('We could not record your request yet. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[32px] bg-forest text-white shadow-lift">
          <div className="grid lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="p-6 sm:p-9">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a5ddcc]">
                  Preliminary assessment
                </span>
                <span className="rounded-full border border-white/12 px-3 py-1.5 text-[10px] font-bold text-white/65">
                  {label(recommendation.guidance_level)}
                </span>
              </div>
              <h1 className="mt-6 font-display text-4xl tracking-[-0.035em] sm:text-5xl">
                {label(recommendation.condition)}
              </h1>
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/65">
                <strong className="text-white">
                  {label(recommendation.confidence_level)} confidence
                </strong>
                <span aria-hidden="true">·</span>
                <span>AI-assisted, not a diagnosis</span>
              </p>
              {needsRetake ? (
                <p className="mt-5 max-w-xl text-sm leading-7 text-white/68">
                  The image did not provide enough clarity for reliable guidance.
                  A clearer, evenly lit photo may help.
                </p>
              ) : null}
            </div>
            <div className="border-t border-white/10 bg-white/[0.04] p-6 lg:min-w-64 lg:border-l lg:border-t-0 lg:p-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                Safety status
              </p>
              <p className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-[#a5ddcc]">
                <Icon name="shield" className="h-4 w-4" />
                {label(recommendation.safety.urgency)}
              </p>
              {needsRetake ? (
                <Link
                  href={`/assessment/${recommendation.assessment_id}`}
                  className="ss-button-accent mt-5 w-full"
                >
                  Retake photo
                </Link>
              ) : referral && !isEscalation ? (
                <button
                  type="button"
                  onClick={() => setShowReferral(true)}
                  className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-forest transition hover:bg-sage"
                >
                  <Icon name="heart" className="h-4 w-4" />
                  Request review
                </button>
              ) : (
                <p className="mt-4 text-xs leading-5 text-white/45">
                  No deterministic red flag was reported in your answers.
                </p>
              )}
            </div>
          </div>
        </section>

        {assessment?.visual_findings.length ? (
          <section className="ss-card overflow-hidden">
            <div className="grid lg:grid-cols-[.76fr_1.24fr]">
              <div className="border-b border-forest/8 bg-sage/35 p-6 sm:p-7 lg:border-b-0 lg:border-r">
                <span className="ss-icon-box bg-white">
                  <Icon name="sparkles" className="h-5 w-5" />
                </span>
                <p className="ss-kicker mt-5">Explainable assessment</p>
                <h2 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-forest">
                  Why the AI leaned this way
                </h2>
                <p className="mt-3 text-sm leading-7 text-forest/55">
                  These controlled findings came from the image assessment—not from the recommendation model.
                </p>
              </div>
              <div className="p-6 sm:p-7">
                <div className="flex flex-wrap gap-2">
                  {assessment.visual_findings.map((finding) => (
                    <span
                      key={finding}
                      className="rounded-full border border-moss/15 bg-sage/50 px-3 py-1.5 text-xs font-bold text-forest"
                    >
                      {label(finding)}
                    </span>
                  ))}
                </div>
                {assessment.alternative_conditions.length ? (
                  <div className="mt-6 border-t border-forest/8 pt-5">
                    <p className="text-xs font-bold text-forest/40">
                      Similar patterns considered
                    </p>
                    <p className="mt-2 text-sm font-semibold text-forest/70">
                      {assessment.alternative_conditions.map(label).join(' · ')}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_.7fr]">
          <div className="space-y-6">
            <ContentCard icon="info" eyebrow="Understanding the pattern" title="What this may mean">
              <p>{recommendation.draft.explanation}</p>
            </ContentCard>

            <ContentCard
              icon={referral ? 'heart' : 'leaf'}
              eyebrow={referral ? 'Review-first guidance' : 'Your practical guide'}
              title={
                referral
                  ? 'Why professional review is recommended'
                  : 'Suggested next steps'
              }
              tone={referral ? 'amber' : 'green'}
            >
              {referral &&
              recommendation.draft.recommended_action.referral_reason ? (
                <p>{recommendation.draft.recommended_action.referral_reason}</p>
              ) : (
                <NumberedList
                  items={recommendation.draft.recommended_action.steps}
                />
              )}
            </ContentCard>

            {referral &&
            !isEscalation &&
            recommendation.draft.recommended_action.steps.length ? (
              <ContentCard
                icon="leaf"
                eyebrow="Low-risk support"
                title="Cautious steps while arranging review"
              >
                <NumberedList
                  items={recommendation.draft.recommended_action.steps}
                />
              </ContentCard>
            ) : null}

            {!isEscalation ? (
              <ContentCard
                icon="shield"
                eyebrow="Longer-term habits"
                title="Prevention and care"
              >
                <CheckList items={recommendation.draft.prevention} />
              </ContentCard>
            ) : null}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24">
            <SideCard
              icon="sparkles"
              title="Possible contributors"
              items={recommendation.draft.possible_contributing_factors}
            />
            <SideCard
              icon="heart"
              title="Melanin-rich skin context"
              items={recommendation.draft.skin_tone_considerations}
            />
          </aside>
        </div>

        <section className="overflow-hidden rounded-[28px] border border-red-200 bg-red-50">
          <div className="flex gap-4 p-6 sm:p-7">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-100 text-red-700">
              <Icon name="warning" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.17em] text-red-700">
                Watch for change
              </p>
              <h2 className="mt-1 text-xl font-bold text-forest">
                Get medical care promptly if
              </h2>
              <CheckList
                items={recommendation.draft.warning_signs}
                className="mt-4"
                tone="red"
              />
            </div>
          </div>
        </section>

        <aside className="flex gap-3 rounded-2xl border border-forest/10 bg-white/70 p-5 text-xs leading-6 text-forest/55">
          <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-moss" />
          <p>
            <strong className="text-forest">Important:</strong>{' '}
            {recommendation.disclaimer}
          </p>
        </aside>

        <div className="flex flex-col items-center justify-between gap-4 rounded-[28px] bg-sage/45 p-6 text-center sm:flex-row sm:text-left">
          <div>
            <p className="text-sm font-bold text-forest">Want to explore another image?</p>
            <p className="mt-1 text-xs text-forest/50">Each assessment starts a separate, private session.</p>
          </div>
          <Link href="/" className="ss-button-primary shrink-0">
            Start a new assessment
            <Icon name="arrow-right" className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {showReferral ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="referral-title"
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-forest/65 p-4 backdrop-blur-sm"
        >
          <form
            onSubmit={submitReferral}
            className="my-6 w-full max-w-lg rounded-[28px] bg-white p-6 shadow-lift sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="ss-kicker">Prototype referral</p>
                <h2 id="referral-title" className="mt-2 text-2xl font-bold text-forest">
                  Request professional review
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowReferral(false)}
                className="grid h-10 w-10 place-items-center rounded-xl bg-mist text-forest/60 transition hover:bg-sage"
                aria-label="Close referral request"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>

            {sent ? (
              <div className="mt-6 rounded-2xl border border-moss/15 bg-sage/55 p-5">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-moss text-white">
                  <Icon name="check" className="h-5 w-5" />
                </span>
                <p className="mt-4 text-sm font-bold text-forest">Request recorded</p>
                <p className="mt-2 text-xs leading-6 text-forest/58">
                  This prototype does not currently notify a real care team.
                </p>
              </div>
            ) : (
              <>
                <p className="mt-4 text-sm leading-6 text-forest/55">
                  This form demonstrates the referral hand-off. No clinical provider is connected.
                </p>
                <label className="mt-6 block text-xs font-bold text-forest">
                  Name
                  <input
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="ss-input mt-2"
                  />
                </label>
                <label className="mt-4 block text-xs font-bold text-forest">
                  Phone or email
                  <input
                    required
                    autoComplete="email"
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                    className="ss-input mt-2"
                  />
                </label>
                <label className="mt-4 block text-xs font-bold text-forest">
                  Reason
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="ss-input mt-2 min-h-28 resize-y"
                  />
                </label>
                {error ? (
                  <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>
                ) : null}
                <button
                  disabled={submitting}
                  className="ss-button-accent mt-6 w-full"
                >
                  {submitting ? 'Recording request…' : 'Record request'}
                  {!submitting ? <Icon name="arrow-right" className="h-4 w-4" /> : null}
                </button>
              </>
            )}
          </form>
        </div>
      ) : null}
    </>
  );
}

function ContentCard({
  icon,
  eyebrow,
  title,
  children,
  tone = 'default',
}: {
  icon: IconName;
  eyebrow: string;
  title: string;
  children: ReactNode;
  tone?: 'default' | 'green' | 'amber';
}) {
  return (
    <section
      className={`rounded-[28px] border p-6 shadow-soft sm:p-7 ${
        tone === 'amber'
          ? 'border-amber-200 bg-amber-50/75'
          : tone === 'green'
            ? 'border-moss/15 bg-sage/35'
            : 'border-forest/10 bg-white/90'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="ss-icon-box bg-white">
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-moss">{eyebrow}</p>
          <h2 className="mt-1 text-xl font-bold tracking-[-0.015em] text-forest">{title}</h2>
        </div>
      </div>
      <div className="mt-5 text-sm leading-7 text-forest/66">{children}</div>
    </section>
  );
}

function SideCard({
  icon,
  title,
  items,
}: {
  icon: IconName;
  title: string;
  items: string[];
}) {
  return (
    <section className="ss-card p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-sage text-moss">
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-bold text-forest">{title}</h2>
      </div>
      <ul className="mt-5 space-y-4">
        {items.length ? (
          items.map((item) => (
            <li key={item} className="border-l-2 border-moss/20 pl-3 text-xs leading-6 text-forest/58">
              {item}
            </li>
          ))
        ) : (
          <li className="text-xs text-forest/40">No additional context was generated.</li>
        )}
      </ul>
    </section>
  );
}

function NumberedList({ items }: { items: string[] }) {
  if (!items.length) return <p>No additional steps were generated.</p>;
  return (
    <ol className="space-y-4">
      {items.map((item, index) => (
        <li key={item} className="flex gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-forest text-xs font-bold text-white">
            {index + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function CheckList({
  items,
  className = '',
  tone = 'green',
}: {
  items: string[];
  className?: string;
  tone?: 'green' | 'red';
}) {
  if (!items.length) return <p>No additional information available.</p>;
  return (
    <ul className={`space-y-3 ${className}`}>
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-7 text-forest/66">
          <span
            className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
              tone === 'red' ? 'bg-red-100 text-red-700' : 'bg-sage text-moss'
            }`}
          >
            <Icon name={tone === 'red' ? 'warning' : 'check'} className="h-3 w-3" />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
