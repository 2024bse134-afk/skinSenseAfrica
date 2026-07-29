'use client';

import Link from 'next/link';
import { useState } from 'react';
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
}: {
  assessment: AssessmentDetail;
}) {
  const safety = assessment.safety;
  const feedback = safety?.feedback;
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );

  if (!safety) return null;

  const isEmergency = safety.urgency === 'emergency';
  const title = isEmergency
    ? 'Seek emergency help now'
    : safety.urgency === 'urgent'
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
    <div className="space-y-5">
      <section
        className={`rounded-3xl border p-6 shadow-soft ${
          isEmergency
            ? 'border-red-300 bg-red-50'
            : 'border-amber-300 bg-amber-50'
        }`}
        aria-live="assertive"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
          {label(safety.urgency)}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">{title}</h1>
        <p className="mt-4 text-sm leading-6 text-slate-800">
          {safety.action_message}
        </p>
      </section>

      {feedback ? (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
            <h2 className="text-xl font-semibold text-ink">
              {feedback.heading}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              These are the exact safety rules triggered by the information
              submitted.
            </p>
            <ul className="mt-4 space-y-3">
              {feedback.triggers.map((trigger) => (
                <li
                  key={trigger.code}
                  className="flex gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-slate-800"
                >
                  <span aria-hidden="true" className="font-bold text-amber-700">
                    !
                  </span>
                  <span>{trigger.label}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
            <h2 className="text-xl font-semibold text-ink">Safest next steps</h2>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              {feedback.next_steps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Preliminary assessment
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">
              {label(feedback.clinician_summary.preliminary_condition)}
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              <strong>
                {label(feedback.clinician_summary.confidence_level)} confidence
              </strong>
              . This is not a confirmed diagnosis.
            </p>
            {assessment.assessment?.limitations.map((limitation) => (
              <p key={limitation} className="mt-2 text-xs text-slate-500">
                {limitation}
              </p>
            ))}
          </section>

          <ClinicianSummaryCard
            safety={safety}
            summary={feedback.clinician_summary}
            copyStatus={copyStatus}
            onCopy={copySummary}
          />

          <aside className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
            <strong>Why treatment guidance was withheld:</strong>{' '}
            {feedback.guidance_withheld_reason}
          </aside>
        </>
      ) : (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-ink">Why this was flagged</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {safety.red_flags.map((flag) => (
              <li key={flag}>• {label(flag)}</li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-slate-700">
            No treatment-like guidance was generated for this result.
          </p>
        </section>
      )}

      <Link
        href="/"
        className="inline-block rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white"
      >
        Start a new assessment
      </Link>
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
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">
            Reported-information summary
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            You can show this structured summary to a healthcare professional.
          </p>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-ink"
        >
          {copyStatus === 'copied' ? 'Copied' : 'Copy summary'}
        </button>
      </div>

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <SummaryItem labelText="Urgency" value={label(safety.urgency)} />
        <SummaryItem
          labelText="Duration"
          value={label(summary.duration)}
        />
        <SummaryItem
          labelText="Affected area"
          value={label(summary.affected_body_area)}
        />
        <SummaryItem labelText="Age group" value={label(summary.age_group)} />
        <SummaryItem
          labelText="Pain level"
          value={`${summary.pain_level} / 10`}
        />
        <SummaryItem
          labelText="Reported yes"
          value={listText(summary.reported_yes_answers)}
        />
        <SummaryItem
          labelText="Reported unsure"
          value={listText(summary.reported_unsure_answers)}
        />
        <SummaryItem
          labelText="Previous treatment"
          value={listText(summary.previous_treatment)}
        />
        <SummaryItem
          labelText="Known allergies"
          value={listText(summary.known_allergies)}
        />
        <SummaryItem
          labelText="Current products"
          value={listText(summary.current_products)}
        />
      </dl>
      {copyStatus === 'failed' ? (
        <p role="alert" className="mt-4 text-sm text-red-700">
          Copying was unavailable. You can show this screen instead.
        </p>
      ) : null}
    </section>
  );
}

function SummaryItem({
  labelText,
  value,
}: {
  labelText: string;
  value: string;
}) {
  return (
    <div>
      <dt className="font-semibold text-slate-500">{labelText}</dt>
      <dd className="mt-1 leading-6 text-slate-800">{value}</dd>
    </div>
  );
}
