'use client';

import Link from 'next/link';
import { Icon } from '@/components/Icons';
import type {
  ImageAssessmentResult,
  RecommendationResult as Recommendation,
} from '@/features/assessment/types';

const label = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export function RecommendationResult({
  recommendation,
  assessment,
}: {
  recommendation: Recommendation;
  assessment?: ImageAssessmentResult | null;
}) {
  const urgent =
    recommendation.safety.urgency === 'urgent' ||
    recommendation.safety.urgency === 'emergency';
  const review = recommendation.safety.urgency === 'professional_review';
  const needsRetake = recommendation.guidance_level === 'retake_or_review';
  const heroTone = urgent
    ? 'bg-[#7f2d2d]'
    : review
      ? 'bg-[#765316]'
      : 'bg-forest';

  return (
    <div className="mx-auto max-w-[1050px] space-y-5">
      <section
        className={`overflow-hidden rounded-[30px] text-white shadow-lift ${heroTone}`}
      >
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/75">
                Preliminary pattern
              </span>
              <span className="rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-bold text-white/70">
                {label(recommendation.confidence_level)} confidence
              </span>
            </div>
            <h1 className="mt-5 font-display text-4xl tracking-[-0.035em] sm:text-5xl">
              {label(recommendation.condition)}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
              {urgent || review
                ? recommendation.safety.action_message
                : 'The image and your five follow-up answers were combined to shape this guidance.'}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 lg:min-w-48">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
              Safety check
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm font-bold">
              <Icon name="shield" className="h-4 w-4" />
              {label(recommendation.safety.urgency)}
            </p>
          </div>
        </div>
      </section>

      {assessment?.visual_findings.length ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-moss/12 bg-sage/35 px-5 py-4 sm:flex-row sm:items-center">
          <p className="flex shrink-0 items-center gap-2 text-xs font-bold text-moss">
            <Icon name="sparkles" className="h-4 w-4" />
            Image evidence
          </p>
          <div className="flex flex-wrap gap-2">
            {assessment.visual_findings.slice(0, 4).map((finding) => (
              <span
                key={finding}
                className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-forest/65"
              >
                {label(finding)}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <ReportCard icon="info" number="01" title="What it may be">
          <p>{recommendation.draft.explanation}</p>
        </ReportCard>

        <ReportCard
          icon="leaf"
          number="02"
          title={review || urgent ? 'Safest next step' : 'What to do now'}
          tone={review || urgent ? 'amber' : 'green'}
        >
          {recommendation.referral_required &&
          recommendation.draft.recommended_action.referral_reason ? (
            <p className="mb-4 font-semibold text-forest">
              {recommendation.draft.recommended_action.referral_reason}
            </p>
          ) : null}
          <CompactList
            items={recommendation.draft.recommended_action.steps.slice(0, 3)}
            numbered
          />
          {needsRetake ? (
            <Link
              href={`/assessment/${recommendation.assessment_id}`}
              className="ss-button-secondary mt-5 w-full"
            >
              <Icon name="camera" className="h-4 w-4" />
              Retake image
            </Link>
          ) : null}
        </ReportCard>

        <ReportCard icon="warning" number="03" title="When to get help" tone="red">
          <CompactList
            items={recommendation.draft.warning_signs.slice(0, 3)}
          />
        </ReportCard>
      </div>

      <details className="group rounded-2xl border border-forest/10 bg-white/75">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-bold text-forest">
          <span className="flex items-center gap-2">
            <Icon name="sparkles" className="h-4 w-4 text-moss" />
            More AI context
          </span>
          <Icon
            name="chevron-down"
            className="h-4 w-4 text-forest/40 transition group-open:rotate-180"
          />
        </summary>
        <div className="grid gap-6 border-t border-forest/8 px-5 py-5 sm:grid-cols-3">
          <ExtraList
            title="Possible contributors"
            items={recommendation.draft.possible_contributing_factors}
          />
          <ExtraList
            title="Melanin-rich skin context"
            items={recommendation.draft.skin_tone_considerations}
          />
          <ExtraList
            title="Prevention"
            items={recommendation.draft.prevention}
          />
        </div>
      </details>

      <div className="flex flex-col gap-4 rounded-2xl border border-forest/8 bg-mist/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-xs leading-5 text-forest/50">
          <strong className="text-forest">AI showcase:</strong>{' '}
          {recommendation.disclaimer}
        </p>
        <Link href="/" className="ss-button-primary shrink-0">
          New assessment
          <Icon name="arrow-right" className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function ReportCard({
  icon,
  number,
  title,
  tone = 'default',
  children,
}: {
  icon: 'info' | 'leaf' | 'warning';
  number: string;
  title: string;
  tone?: 'default' | 'green' | 'amber' | 'red';
  children: React.ReactNode;
}) {
  const toneClass = {
    default: 'border-forest/10 bg-white',
    green: 'border-moss/15 bg-sage/30',
    amber: 'border-amber-200 bg-amber-50/70',
    red: 'border-red-200 bg-red-50/60',
  }[tone];

  return (
    <section className={`rounded-[26px] border p-5 shadow-soft sm:p-6 ${toneClass}`}>
      <div className="flex items-center justify-between">
        <span className="ss-icon-box bg-white">
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <span className="font-display text-2xl text-forest/15">{number}</span>
      </div>
      <h2 className="mt-5 text-xl font-bold tracking-[-0.02em] text-forest">
        {title}
      </h2>
      <div className="mt-3 text-sm leading-6 text-forest/62">{children}</div>
    </section>
  );
}

function CompactList({
  items,
  numbered = false,
}: {
  items: string[];
  numbered?: boolean;
}) {
  if (!items.length) {
    return <p>No additional guidance was generated.</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <li key={item} className="flex gap-2.5">
          <span
            className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
              numbered ? 'bg-forest text-white' : 'bg-white text-moss'
            }`}
          >
            {numbered ? index + 1 : <Icon name="check" className="h-3 w-3" />}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ExtraList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-forest">{title}</h3>
      <ul className="mt-3 space-y-2 text-xs leading-5 text-forest/55">
        {items.slice(0, 3).map((item) => (
          <li key={item} className="border-l-2 border-moss/20 pl-3">
            {item}
          </li>
        ))}
        {!items.length ? <li>No additional context generated.</li> : null}
      </ul>
    </div>
  );
}
