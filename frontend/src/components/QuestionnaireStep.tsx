'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '@/components/Icons';
import type {
  Answer,
  Condition,
  ImageAssessmentResult,
  Questionnaire,
} from '@/features/assessment/types';

type ChangeFlag = 'spreading' | 'fever' | 'swelling' | 'infection';
type WarningFlag =
  | 'breathing'
  | 'face_swelling'
  | 'high_fever'
  | 'eye'
  | 'blistering'
  | 'bleeding'
  | 'open_wound';

type CompactDraft = {
  duration: Questionnaire['duration'] | null;
  recurrent: Answer | null;
  itching: Answer | null;
  painLevel: number | null;
  changes: ChangeFlag[] | 'none' | 'unsure' | null;
  warnings: WarningFlag[] | 'none' | 'unsure' | null;
  area: Questionnaire['affected_body_area'] | null;
  ageGroup: Questionnaire['age_group'] | null;
  productContext: string;
};

const emptyDraft: CompactDraft = {
  duration: null,
  recurrent: null,
  itching: null,
  painLevel: null,
  changes: null,
  warnings: null,
  area: null,
  ageGroup: null,
  productContext: '',
};

const demoDraft: CompactDraft = {
  duration: 'one_to_four_weeks',
  recurrent: 'no',
  itching: 'yes',
  painLevel: 2,
  changes: 'none',
  warnings: 'none',
  area: 'face_or_neck',
  ageGroup: 'adult',
  productContext: '',
};

const conditionCue: Record<Condition, string> = {
  eczema: 'Dryness and itching can help distinguish an eczema-like pattern.',
  fungal_infection: 'Spread, itch, and changes at the edge can add useful context.',
  scabies: 'Strong itching—especially at night or among close contacts—can be relevant.',
  impetigo: 'Rapid change, warmth, fluid, or crusting are especially useful to confirm.',
  acne: 'Pain, recurrence, and products used on the area help shape practical guidance.',
  psoriasis: 'Duration, recurrence, and discomfort help explain a psoriasis-like pattern.',
  folliculitis: 'Tenderness, spread, and recently used products can add useful context.',
  other_or_uncertain: 'A few symptoms can help the engine keep its guidance appropriately cautious.',
};

const answerOptions: Array<{ value: Answer; label: string }> = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Not sure' },
];

const changeOptions: Array<{ value: ChangeFlag; label: string }> = [
  { value: 'spreading', label: 'Spreading quickly' },
  { value: 'fever', label: 'Feverish' },
  { value: 'swelling', label: 'Swollen' },
  { value: 'infection', label: 'Warm, tender, or pus' },
];

const warningOptions: Array<{ value: WarningFlag; label: string }> = [
  { value: 'breathing', label: 'Breathing difficulty' },
  { value: 'face_swelling', label: 'Lip, tongue, or throat swelling' },
  { value: 'high_fever', label: 'High fever' },
  { value: 'eye', label: 'Eye or eyelid involved' },
  { value: 'blistering', label: 'Extensive blistering' },
  { value: 'bleeding', label: 'Significant bleeding' },
  { value: 'open_wound', label: 'Open or raw wound' },
];

function readable(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function groupAnswer<T extends string>(
  value: T[] | 'none' | 'unsure' | null,
  flag: T,
): Answer {
  if (value === 'unsure') return 'unsure';
  return Array.isArray(value) && value.includes(flag) ? 'yes' : 'no';
}

function toQuestionnaire(draft: CompactDraft): Questionnaire {
  return {
    duration: draft.duration ?? 'unsure',
    itching: draft.itching ?? 'unsure',
    pain_level: draft.painLevel ?? 0,
    rapidly_spreading: groupAnswer(draft.changes, 'spreading'),
    affected_body_area: draft.area ?? 'unsure',
    fever: groupAnswer(draft.changes, 'fever'),
    high_fever: groupAnswer(draft.warnings, 'high_fever'),
    swelling: groupAnswer(draft.changes, 'swelling'),
    difficulty_breathing: groupAnswer(draft.warnings, 'breathing'),
    lip_tongue_throat_swelling: groupAnswer(draft.warnings, 'face_swelling'),
    bleeding: groupAnswer(draft.warnings, 'bleeding'),
    blistering: groupAnswer(draft.warnings, 'blistering'),
    open_wound: groupAnswer(draft.warnings, 'open_wound'),
    eye_involvement: groupAnswer(draft.warnings, 'eye'),
    possible_infection: groupAnswer(draft.changes, 'infection'),
    previous_treatment: [],
    known_allergies: [],
    current_products: draft.productContext.trim()
      ? [draft.productContext.trim()]
      : [],
    age_group: draft.ageGroup ?? 'prefer_not_to_say',
    recurrent: draft.recurrent ?? 'unsure',
  };
}

function toggleGroup<T extends string>(
  current: T[] | 'none' | 'unsure' | null,
  value: T,
): T[] {
  const selected = Array.isArray(current) ? current : [];
  return selected.includes(value)
    ? selected.filter((item) => item !== value)
    : [...selected, value];
}

function hasGroupSelection<T extends string>(
  value: T[] | 'none' | 'unsure' | null,
) {
  return value === 'none' || value === 'unsure' || (Array.isArray(value) && value.length > 0);
}

export function QuestionnaireStep({
  assessment,
  onComplete,
  isSaving = false,
}: {
  assessment: ImageAssessmentResult;
  onComplete: (answers: Questionnaire) => void;
  isSaving?: boolean;
}) {
  const [draft, setDraft] = useState<CompactDraft>(emptyDraft);
  const [step, setStep] = useState(0);
  const [usingDemoAnswers, setUsingDemoAnswers] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const condition = readable(assessment.condition);
  const followUps = useMemo(
    () => new Set(assessment.follow_up_question_ids),
    [assessment.follow_up_question_ids],
  );

  const adaptiveNote = useMemo(() => {
    if (step === 1) return conditionCue[assessment.condition];
    if (
      step === 2 &&
      ['rapidly_spreading', 'fever', 'swelling', 'possible_infection'].some(
        (key) => followUps.has(key),
      )
    ) {
      return 'The image analysis specifically asked us to confirm how this is changing.';
    }
    if (step === 3 && assessment.visual_safety_signals.length) {
      return 'A visual safety signal was noticed, so this confirmation matters.';
    }
    return `Adapted from the preliminary ${condition.toLowerCase()} pattern.`;
  }, [
    assessment.condition,
    assessment.visual_safety_signals.length,
    condition,
    followUps,
    step,
  ]);

  const complete = [
    Boolean(draft.duration && draft.recurrent),
    draft.itching !== null && draft.painLevel !== null,
    hasGroupSelection(draft.changes),
    hasGroupSelection(draft.warnings),
    Boolean(draft.area && draft.ageGroup),
  ][step];

  useEffect(() => {
    if (step > 0) headingRef.current?.focus();
  }, [step]);

  function update(patch: Partial<CompactDraft>) {
    setUsingDemoAnswers(false);
    setDraft((current) => ({ ...current, ...patch }));
  }

  function next() {
    if (!complete) return;
    if (step === 4) {
      onComplete(toQuestionnaire(draft));
      return;
    }
    setStep((current) => current + 1);
  }

  const titles = [
    `How long has this ${condition.toLowerCase()}-like concern been present?`,
    'How does the area feel?',
    'Has it changed in any of these ways?',
    'Do any urgent warning signs apply?',
    'A little context for the recommendation',
  ];

  return (
    <section className="ss-card overflow-hidden" aria-live="polite">
      <div className="border-b border-forest/8 bg-mist/55 px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="ss-kicker">Image-aware follow-up</p>
            <p className="mt-1 text-sm font-bold text-forest">
              Question {step + 1}{' '}
              <span className="font-medium text-forest/35">of 5</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDraft(demoDraft);
              setUsingDemoAnswers(true);
            }}
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
              usingDemoAnswers
                ? 'border-moss/25 bg-sage text-moss'
                : 'border-forest/12 bg-white text-forest/60 hover:border-moss/30 hover:text-moss'
            }`}
          >
            <Icon
              name={usingDemoAnswers ? 'check' : 'sparkles'}
              className="h-4 w-4"
            />
            {usingDemoAnswers ? 'Demo profile ready' : 'Use demo profile'}
          </button>
        </div>

        <div className="mt-5 flex gap-2" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-full transition ${
                index <= step ? 'bg-moss' : 'bg-forest/10'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="px-5 py-7 sm:px-8 sm:py-9">
        <div className="mx-auto max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-sage/55 px-3 py-1.5 text-[11px] font-bold text-moss">
            <Icon name="sparkles" className="h-3.5 w-3.5" />
            Based on image analysis
          </div>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="mt-4 max-w-xl text-2xl font-bold leading-tight tracking-[-0.025em] text-forest outline-none sm:text-3xl"
          >
            {titles[step]}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-forest/55">
            {adaptiveNote}
          </p>

          <div className="mt-7 min-h-52">
            {step === 0 ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Duration">
                  <select
                    value={draft.duration ?? ''}
                    onChange={(event) =>
                      update({
                        duration: event.target
                          .value as Questionnaire['duration'],
                      })
                    }
                    className="ss-input"
                  >
                    <option value="" disabled>Select duration</option>
                    <option value="less_than_one_week">Less than a week</option>
                    <option value="one_to_four_weeks">1–4 weeks</option>
                    <option value="one_to_six_months">1–6 months</option>
                    <option value="more_than_six_months">More than 6 months</option>
                    <option value="unsure">Not sure</option>
                  </select>
                </Field>
                <Field label="Has it happened before?">
                  <AnswerButtons
                    value={draft.recurrent}
                    onChange={(recurrent) => update({ recurrent })}
                  />
                </Field>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-6 sm:grid-cols-[.9fr_1.1fr]">
                <Field label="Is it itchy?">
                  <AnswerButtons
                    value={draft.itching}
                    onChange={(itching) => update({ itching })}
                  />
                </Field>
                <Field label="Pain level">
                  <div className="rounded-2xl border border-forest/10 bg-mist/55 p-4">
                    <div className="flex items-center justify-between text-xs font-bold text-forest/45">
                      <span>No pain</span>
                      <strong className="text-2xl text-forest">
                        {draft.painLevel ?? '—'}
                        <span className="text-xs text-forest/35"> / 10</span>
                      </strong>
                      <span>Severe</span>
                    </div>
                    <input
                      aria-label="Pain level from zero to ten"
                      type="range"
                      min="0"
                      max="10"
                      value={draft.painLevel ?? 0}
                      onChange={(event) =>
                        update({ painLevel: Number(event.target.value) })
                      }
                      className="mt-5 h-2 w-full cursor-pointer accent-moss"
                    />
                    {draft.painLevel === null ? (
                      <button
                        type="button"
                        onClick={() => update({ painLevel: 0 })}
                        className="mt-3 text-xs font-bold text-moss underline-offset-4 hover:underline"
                      >
                        Select no pain
                      </button>
                    ) : null}
                  </div>
                </Field>
              </div>
            ) : null}

            {step === 2 ? (
              <FlagPicker
                options={changeOptions}
                value={draft.changes}
                onChange={(changes) => update({ changes })}
              />
            ) : null}

            {step === 3 ? (
              <FlagPicker
                options={warningOptions}
                value={draft.warnings}
                onChange={(warnings) => update({ warnings })}
                urgent
              />
            ) : null}

            {step === 4 ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Main area">
                  <select
                    value={draft.area ?? ''}
                    onChange={(event) =>
                      update({
                        area: event.target
                          .value as Questionnaire['affected_body_area'],
                      })
                    }
                    className="ss-input"
                  >
                    <option value="" disabled>Select area</option>
                    <option value="face_or_neck">Face or neck</option>
                    <option value="scalp">Scalp</option>
                    <option value="chest_or_back">Chest or back</option>
                    <option value="arms_or_hands">Arms or hands</option>
                    <option value="legs_or_feet">Legs or feet</option>
                    <option value="groin_or_skin_folds">Groin or skin folds</option>
                    <option value="other">Another area</option>
                    <option value="unsure">Not sure</option>
                  </select>
                </Field>
                <Field label="Age group">
                  <select
                    value={draft.ageGroup ?? ''}
                    onChange={(event) =>
                      update({
                        ageGroup: event.target
                          .value as Questionnaire['age_group'],
                      })
                    }
                    className="ss-input"
                  >
                    <option value="" disabled>Select age group</option>
                    <option value="infant">Infant</option>
                    <option value="child">Child</option>
                    <option value="adolescent">Adolescent</option>
                    <option value="adult">Adult</option>
                    <option value="older_adult">Older adult</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </Field>
                <label className="sm:col-span-2">
                  <span className="text-xs font-bold text-forest">
                    Product or treatment already used{' '}
                    <span className="font-medium text-forest/35">(optional)</span>
                  </span>
                  <input
                    value={draft.productContext}
                    maxLength={100}
                    onChange={(event) =>
                      update({ productContext: event.target.value })
                    }
                    placeholder="For example: salicylic acid cleanser"
                    className="ss-input mt-2"
                  />
                </label>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 border-t border-forest/8 bg-white/92 px-5 py-4 backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={step === 0 || isSaving}
            className="ss-button-secondary min-w-28"
          >
            <Icon name="chevron-left" className="h-4 w-4" />
            Back
          </button>
          <button
            type="button"
            onClick={next}
            disabled={!complete || isSaving}
            className="ss-button-primary min-w-32"
          >
            {step === 4
              ? isSaving
                ? 'Preparing…'
                : 'See guidance'
              : 'Continue'}
            {!isSaving ? <Icon name="arrow-right" className="h-4 w-4" /> : null}
          </button>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold text-forest">{label}</p>
      {children}
    </div>
  );
}

function AnswerButtons({
  value,
  onChange,
}: {
  value: Answer | null;
  onChange: (value: Answer) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2" role="group">
      {answerOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`min-h-12 rounded-xl border px-2 text-xs font-bold transition ${
            value === option.value
              ? 'border-forest bg-forest text-white'
              : 'border-forest/12 bg-white text-forest/60 hover:border-moss/35'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function FlagPicker<T extends string>({
  options,
  value,
  onChange,
  urgent = false,
}: {
  options: Array<{ value: T; label: string }>;
  value: T[] | 'none' | 'unsure' | null;
  onChange: (value: T[] | 'none' | 'unsure') => void;
  urgent?: boolean;
}) {
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const selected = Array.isArray(value) && value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(toggleGroup(value, option.value))}
              aria-pressed={selected}
              className={`flex min-h-14 items-center justify-between rounded-2xl border px-4 text-left text-sm font-bold transition ${
                selected
                  ? urgent
                    ? 'border-red-700 bg-red-50 text-red-900'
                    : 'border-forest bg-forest text-white'
                  : 'border-forest/12 bg-white text-forest/65 hover:border-moss/35'
              }`}
            >
              {option.label}
              <span
                className={`grid h-6 w-6 place-items-center rounded-full border ${
                  selected ? 'border-current/25 bg-current/5' : 'border-forest/15'
                }`}
              >
                {selected ? <Icon name="check" className="h-3.5 w-3.5" /> : null}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          { value: 'none' as const, label: 'None of these' },
          { value: 'unsure' as const, label: 'Not sure' },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`min-h-12 rounded-xl border px-3 text-xs font-bold transition ${
              value === option.value
                ? 'border-moss bg-sage text-forest'
                : 'border-forest/10 bg-mist/55 text-forest/55 hover:border-moss/30'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {Array.isArray(value) && value.length === 0 ? (
        <p className="mt-3 text-xs text-forest/42">
          Select at least one item, or choose “None of these”.
        </p>
      ) : null}
    </div>
  );
}
