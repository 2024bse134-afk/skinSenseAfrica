'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/Icons';
import type {
  AssessmentDetail,
  ClinicianSummary,
  SafetyResult,
} from '@/features/assessment/types';

const label = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

function buildClinicianText(safety: SafetyResult, summary: ClinicianSummary) {
  return [
    'SkinSense preliminary assessment summary',
    'This is not a confirmed diagnosis.',
    `Urgency: ${label(safety.urgency)}`,
    `Preliminary condition: ${label(summary.preliminary_condition)}`,
    `Confidence: ${label(summary.confidence_level)}`,
    `Duration: ${label(summary.duration)}`,
    `Affected area: ${label(summary.affected_body_area)}`,
    `Pain: ${summary.pain_level}/10`,
    `Reported signs: ${summary.reported_yes_answers.map(label).join(', ') || 'None'}`,
  ].join('\n');
}

export function SafetyFeedbackResult({
  assessment,
}: {
  assessment: AssessmentDetail;
}) {
  const safety = assessment.safety;
  const feedback = safety?.feedback;
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );

  if (!safety) return null;

  const urgent = safety.urgency === 'urgent';
  const emergency = safety.urgency === 'emergency';
  const tone = urgent || emergency ? 'bg-[#7f2d2d]' : 'bg-[#765316]';
  const title = emergency
    ? 'Seek emergency help now'
    : urgent
      ? 'Seek urgent medical care'
      : 'Professional review recommended';

  async function copySummary() {
    if (!feedback) return;
    try {
      await navigator.clipboard.writeText(
        buildClinicianText(safety, feedback.clinician_summary),
      );
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  return (
    <div className="mx-auto max-w-[950px] space-y-5">
      <section className={`rounded-[30px] p-6 text-white shadow-lift sm:p-8 ${tone}`}>
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/75">
          <Icon name="warning" className="h-4 w-4" />
          {label(safety.urgency)}
        </span>
        <h1 className="mt-5 max-w-2xl font-display text-4xl leading-tight tracking-[-0.035em] sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75">
          {safety.action_message}
        </p>
      </section>

      {feedback ? (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            <section className="ss-card p-5 sm:p-6">
              <p className="ss-kicker">Why it was flagged</p>
              <ul className="mt-4 space-y-3">
                {feedback.triggers.slice(0, 4).map((trigger) => (
                  <li
                    key={trigger.code}
                    className="flex gap-3 text-sm leading-6 text-forest/65"
                  >
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-amber-600" />
                    {trigger.label}
                  </li>
                ))}
              </ul>
            </section>

            <section className="ss-card p-5 sm:p-6">
              <p className="ss-kicker">What to do now</p>
              <ol className="mt-4 space-y-3">
                {feedback.next_steps.slice(0, 3).map((nextStep, index) => (
                  <li
                    key={nextStep}
                    className="flex gap-3 text-sm leading-6 text-forest/65"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-forest text-[10px] font-bold text-white">
                      {index + 1}
                    </span>
                    {nextStep}
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <section className="flex flex-col gap-4 rounded-2xl border border-forest/10 bg-white/75 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-forest">
                {label(feedback.clinician_summary.preliminary_condition)}
                <span className="font-medium text-forest/40">
                  {' '}
                  · {label(feedback.clinician_summary.confidence_level)} confidence
                </span>
              </p>
              <p className="mt-1 text-xs text-forest/48">
                {label(feedback.clinician_summary.duration)} ·{' '}
                {label(feedback.clinician_summary.affected_body_area)} · pain{' '}
                {feedback.clinician_summary.pain_level}/10
              </p>
            </div>
            <button
              type="button"
              onClick={copySummary}
              className="ss-button-secondary min-h-10 shrink-0 py-2"
            >
              <Icon
                name={copyStatus === 'copied' ? 'check' : 'copy'}
                className="h-4 w-4"
              />
              {copyStatus === 'copied' ? 'Copied' : 'Copy summary'}
            </button>
          </section>

          {copyStatus === 'failed' ? (
            <p role="alert" className="text-center text-sm text-red-700">
              Copying was unavailable. You can show this screen instead.
            </p>
          ) : null}
        </>
      ) : (
        <section className="ss-card p-5 sm:p-6">
          <p className="ss-kicker">Why it was flagged</p>
          <p className="mt-3 text-sm leading-6 text-forest/60">
            {safety.red_flags.map(label).join(', ') ||
              'The safety policy requires professional review.'}
          </p>
        </section>
      )}

      <div className="flex flex-col gap-4 rounded-2xl bg-mist/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-xs leading-5 text-forest/50">
          This AI showcase cannot confirm a diagnosis. The safety action above
          takes priority over the preliminary pattern.
        </p>
        <Link href="/" className="ss-button-primary shrink-0">
          New assessment
          <Icon name="arrow-right" className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
