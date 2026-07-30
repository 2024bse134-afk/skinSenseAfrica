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
  value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

function listText(items: string[]) {
  return items.length ? items.map(label).join(', ') : 'None reported';
}

function buildClinicianText(safety: SafetyResult, summary: ClinicianSummary) {
  return [
    'SkinSense preliminary assessment summary',
    'This is not a confirmed diagnosis.',
    `Urgency: ${label(safety.urgency)}`,
    `Preliminary condition: ${label(summary.preliminary_condition)}`,
    `Confidence level: ${label(summary.confidence_level)}`,
    `Duration: ${label(summary.duration)}`,
    `Affected area: ${label(summary.affected_body_area)}`,
    `Age group: ${label(summary.age_group)}`,
    `Pain level: ${summary.pain_level}/10`,
    `Reported yes: ${listText(summary.reported_yes_answers)}`,
    `Reported unsure: ${listText(summary.reported_unsure_answers)}`,
    `Previous treatment: ${listText(summary.previous_treatment)}`,
    `Known allergies: ${listText(summary.known_allergies)}`,
    `Current products: ${listText(summary.current_products)}`,
    `Safety triggers: ${safety.feedback?.triggers.map((trigger) => trigger.label).join(' ') ?? listText(safety.red_flags)}`,
  ].join('\n');
}

export function SafetyFeedbackResult({
  assessment,
  embedded = false,
}: {
  assessment: AssessmentDetail;
  embedded?: boolean;
}) {
  const safety = assessment.safety;
  const feedback = safety?.feedback;
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );

  if (!safety) return null;

  const isEmergency = safety.urgency === 'emergency';
  const isUrgent = safety.urgency === 'urgent';
  const title = isEmergency
    ? 'Seek emergency help now'
    : isUrgent
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
    <div className="space-y-6">
      <section
        className={`relative overflow-hidden rounded-[32px] text-white shadow-lift ${
          isEmergency || isUrgent ? 'bg-[#7f2d2d]' : 'bg-[#765316]'
        }`}
        aria-live="assertive"
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[34px] border-white/[0.04]" />
        <div className="relative p-6 sm:p-9">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">
              <Icon name="warning" className="h-4 w-4" />
              {label(safety.urgency)}
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] font-bold text-white/60">
              Safety policy {safety.policy_version}
            </span>
          </div>
          <h1 className="mt-7 max-w-2xl font-display text-4xl leading-[1.06] tracking-[-0.035em] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
            {safety.action_message}
          </p>
          {(isEmergency || isUrgent) ? (
            <p className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-xs font-bold text-white">
              <Icon name="shield" className="h-4 w-4" />
              Do not rely on the AI explanation instead of in-person care.
            </p>
          ) : null}
        </div>
      </section>

      {feedback ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="ss-card p-6 sm:p-7">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800">
                  <Icon name="warning" className="h-5 w-5" />
                </span>
                <div>
                  <p className="ss-kicker text-amber-800">Triggered checks</p>
                  <h2 className="mt-1 text-xl font-bold text-forest">{feedback.heading}</h2>
                </div>
              </div>
              <p className="mt-4 text-xs leading-6 text-forest/50">
                These labels come directly from deterministic safety rules.
              </p>
              <ul className="mt-5 space-y-3">
                {feedback.triggers.map((trigger) => (
                  <li
                    key={trigger.code}
                    className="flex gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm leading-6 text-forest/72"
                  >
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-600" />
                    <span>{trigger.label}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="ss-card p-6 sm:p-7">
              <div className="flex items-start gap-3">
                <span className="ss-icon-box">
                  <Icon name="arrow-right" className="h-5 w-5" />
                </span>
                <div>
                  <p className="ss-kicker">Action plan</p>
                  <h2 className="mt-1 text-xl font-bold text-forest">Safest next steps</h2>
                </div>
              </div>
              <ol className="mt-6 space-y-4">
                {feedback.next_steps.map((nextStep, index) => (
                  <li key={nextStep} className="flex gap-3 text-sm leading-7 text-forest/68">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-forest text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <span>{nextStep}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {!embedded ? (
            <section className="ss-card grid overflow-hidden lg:grid-cols-[.72fr_1.28fr]">
              <div className="bg-forest p-6 text-white sm:p-7">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a5ddcc]">
                  Preliminary pattern
                </p>
                <h2 className="mt-3 font-display text-3xl">
                  {label(feedback.clinician_summary.preliminary_condition)}
                </h2>
                <p className="mt-3 text-sm font-bold text-white/75">
                  {label(feedback.clinician_summary.confidence_level)} confidence
                </p>
              </div>
              <div className="p-6 sm:p-7">
                <p className="text-sm font-bold text-forest">Important limitation</p>
                <p className="mt-2 text-sm leading-7 text-forest/58">
                  This pattern is not a confirmed diagnosis. Safety guidance takes priority over the preliminary label.
                </p>
                {assessment.assessment?.limitations.map((limitation) => (
                  <p key={limitation} className="mt-2 text-xs text-forest/42">{limitation}</p>
                ))}
              </div>
            </section>
          ) : null}

          <ClinicianSummaryCard
            safety={safety}
            summary={feedback.clinician_summary}
            copyStatus={copyStatus}
            onCopy={copySummary}
          />

          <aside className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950">
            <Icon name="shield" className="mt-1 h-4 w-4 shrink-0" />
            <p>
              <strong>How safety changed the guidance:</strong>{' '}
              {feedback.guidance_withheld_reason}
            </p>
          </aside>
        </>
      ) : (
        <section className="ss-card p-6 sm:p-7">
          <h2 className="text-xl font-bold text-forest">Why this was flagged</h2>
          <ul className="mt-4 space-y-3">
            {safety.red_flags.map((flag) => (
              <li key={flag} className="flex gap-3 text-sm text-forest/65">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-amber-600" />
                {label(flag)}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-forest/58">
            AI guidance was not available for this result.
          </p>
        </section>
      )}

      {!embedded ? (
        <div className="text-center">
          <Link href="/" className="ss-button-primary">
            Start a new assessment
            <Icon name="arrow-right" className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function ClinicianSummaryCard({
  safety,
  summary,
  copyStatus,
  onCopy,
}: {
  safety: SafetyResult;
  summary: ClinicianSummary;
  copyStatus: 'idle' | 'copied' | 'failed';
  onCopy: () => void;
}) {
  const items = [
    ['Urgency', label(safety.urgency)],
    ['Duration', label(summary.duration)],
    ['Affected area', label(summary.affected_body_area)],
    ['Age group', label(summary.age_group)],
    ['Pain level', `${summary.pain_level} / 10`],
    ['Reported yes', listText(summary.reported_yes_answers)],
    ['Reported unsure', listText(summary.reported_unsure_answers)],
    ['Previous treatment', listText(summary.previous_treatment)],
    ['Known allergies', listText(summary.known_allergies)],
    ['Current products', listText(summary.current_products)],
  ];

  return (
    <section className="ss-card overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-forest/8 bg-mist/55 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div>
          <p className="ss-kicker">Portable summary</p>
          <h2 className="mt-1 text-xl font-bold text-forest">Reported information</h2>
          <p className="mt-1 text-xs leading-5 text-forest/48">
            Copy this structured context to show a healthcare professional.
          </p>
        </div>
        <button type="button" onClick={onCopy} className="ss-button-secondary min-h-10 py-2">
          <Icon name={copyStatus === 'copied' ? 'check' : 'copy'} className="h-4 w-4" />
          {copyStatus === 'copied' ? 'Copied' : 'Copy summary'}
        </button>
      </div>

      <dl className="grid sm:grid-cols-2 lg:grid-cols-5">
        {items.map(([labelText, value], index) => (
          <div
            key={labelText}
            className={`p-5 ${
              index < items.length - 1 ? 'border-b border-forest/8' : ''
            } sm:border-b sm:border-r sm:last:border-r-0 lg:[&:nth-child(n+6)]:border-b-0`}
          >
            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest/38">
              {labelText}
            </dt>
            <dd className="mt-2 break-words text-xs font-semibold leading-5 text-forest/72">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {copyStatus === 'failed' ? (
        <p role="alert" className="border-t border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">
          Copying was unavailable. You can show this screen instead.
        </p>
      ) : null}
    </section>
  );
}
