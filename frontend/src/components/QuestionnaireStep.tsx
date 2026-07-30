'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icons';
import type { Answer, Questionnaire } from '@/features/assessment/types';

type QuestionnaireDraft = {
  [Key in keyof Questionnaire]: Questionnaire[Key] | null;
};

const initialQuestionnaire: QuestionnaireDraft = {
  duration: null,
  itching: null,
  pain_level: null,
  rapidly_spreading: null,
  affected_body_area: null,
  fever: null,
  high_fever: null,
  swelling: null,
  difficulty_breathing: null,
  lip_tongue_throat_swelling: null,
  bleeding: null,
  blistering: null,
  open_wound: null,
  eye_involvement: null,
  possible_infection: null,
  previous_treatment: [],
  known_allergies: [],
  current_products: [],
  age_group: null,
  recurrent: null,
};

const syntheticDemoQuestionnaire: Questionnaire = {
  duration: 'one_to_four_weeks',
  itching: 'yes',
  pain_level: 2,
  rapidly_spreading: 'no',
  affected_body_area: 'face_or_neck',
  fever: 'no',
  high_fever: 'no',
  swelling: 'no',
  difficulty_breathing: 'no',
  lip_tongue_throat_swelling: 'no',
  bleeding: 'no',
  blistering: 'no',
  open_wound: 'no',
  eye_involvement: 'no',
  possible_infection: 'no',
  previous_treatment: [],
  known_allergies: [],
  current_products: [],
  age_group: 'adult',
  recurrent: 'no',
};

type QuestionKind = 'answer' | 'duration' | 'pain' | 'area' | 'age' | 'list';
type Question = {
  key: keyof Questionnaire;
  title: string;
  description: string;
  kind: QuestionKind;
};

const questions: Question[] = [
  { key: 'difficulty_breathing', title: 'Are you having difficulty breathing?', description: 'If yes, seek emergency help now.', kind: 'answer' },
  { key: 'lip_tongue_throat_swelling', title: 'Are your lips, tongue, or throat swollen?', description: 'If yes, seek emergency help now.', kind: 'answer' },
  { key: 'rapidly_spreading', title: 'Is the concern spreading quickly?', description: 'For example, noticeably larger over hours or a few days.', kind: 'answer' },
  { key: 'high_fever', title: 'Do you have a high fever?', description: 'Choose unsure if you cannot check.', kind: 'answer' },
  { key: 'pain_level', title: 'How painful is it?', description: '0 means no pain and 10 means the worst pain imaginable.', kind: 'pain' },
  { key: 'eye_involvement', title: 'Does it involve an eye or eyelid?', description: 'Include skin very close to the eye.', kind: 'answer' },
  { key: 'blistering', title: 'Is there extensive blistering?', description: 'Choose yes if several blisters cover a sizeable area.', kind: 'answer' },
  { key: 'possible_infection', title: 'Are there possible signs of infection?', description: 'For example pus, increasing warmth, or rapidly worsening tenderness.', kind: 'answer' },
  { key: 'bleeding', title: 'Is there significant bleeding?', description: 'Choose yes even if it has temporarily stopped.', kind: 'answer' },
  { key: 'open_wound', title: 'Is there an open wound?', description: 'This includes broken or raw skin.', kind: 'answer' },
  { key: 'duration', title: 'How long has this been present?', description: 'Choose the closest range.', kind: 'duration' },
  { key: 'recurrent', title: 'Has this concern happened before?', description: 'This helps the recommendation adapt to recurring or persistent patterns.', kind: 'answer' },
  { key: 'itching', title: 'Is the area itchy?', description: 'Choose unsure if you cannot tell.', kind: 'answer' },
  { key: 'affected_body_area', title: 'Where is the affected area?', description: 'Choose the main area shown.', kind: 'area' },
  { key: 'fever', title: 'Do you have any fever or feel feverish?', description: 'This is separate from the high-fever warning sign.', kind: 'answer' },
  { key: 'swelling', title: 'Is the affected area swollen?', description: 'This can include puffiness around the area.', kind: 'answer' },
  { key: 'previous_treatment', title: 'What have you already tried?', description: 'Add medicines, home remedies, or treatments if applicable.', kind: 'list' },
  { key: 'known_allergies', title: 'Do you have known allergies?', description: 'Add medicine, skincare, or other allergies if known.', kind: 'list' },
  { key: 'current_products', title: 'Which products are you using?', description: 'Add creams, soaps, oils, or other products used on this area.', kind: 'list' },
  { key: 'age_group', title: 'What is your age group?', description: 'This helps identify concerns outside the prototype scope.', kind: 'age' },
];

const answerOptions: { value: Answer; label: string; helper: string }[] = [
  { value: 'yes', label: 'Yes', helper: 'This applies' },
  { value: 'no', label: 'No', helper: 'This does not apply' },
  { value: 'unsure', label: 'Not sure', helper: 'I cannot tell' },
];

const sectionNames = ['Safety check', 'Skin story', 'Products & context'];

function sectionIndex(step: number) {
  if (step <= 9) return 0;
  if (step <= 15) return 1;
  return 2;
}

function isCompleteQuestionnaire(
  draft: QuestionnaireDraft,
): draft is Questionnaire {
  return Object.values(draft).every((value) => value !== null);
}

export function QuestionnaireStep({
  onComplete,
  isSaving = false,
}: {
  onComplete: (answers: Questionnaire) => void;
  isSaving?: boolean;
}) {
  const [answers, setAnswers] = useState<QuestionnaireDraft>(initialQuestionnaire);
  const [step, setStep] = useState(0);
  const [entry, setEntry] = useState('');
  const [usingDemoAnswers, setUsingDemoAnswers] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const question = questions[step];
  const value = answers[question.key];
  const list = Array.isArray(value) ? value : [];
  const hasCurrentAnswer = Array.isArray(value) || value !== null;
  const activeSection = sectionIndex(step);
  const progress = ((step + 1) / questions.length) * 100;

  useEffect(() => {
    if (step > 0) headingRef.current?.focus();
  }, [step]);

  function setValue(next: Questionnaire[keyof Questionnaire]) {
    setUsingDemoAnswers(false);
    setAnswers((current) => ({ ...current, [question.key]: next }));
  }

  function addListItem() {
    const item = entry.trim();
    if (!item || list.length >= 10 || item.length > 100) return;
    setValue([...list, item]);
    setEntry('');
  }

  function next() {
    if (!hasCurrentAnswer) return;
    if (step === questions.length - 1) {
      if (isCompleteQuestionnaire(answers)) onComplete(answers);
      return;
    }
    setEntry('');
    setStep((current) => current + 1);
  }

  return (
    <section className="ss-card overflow-hidden" aria-live="polite">
      <div className="border-b border-forest/8 bg-mist/55 px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="ss-kicker">Structured questionnaire</p>
            <p className="mt-1 text-sm font-bold text-forest">
              Question {step + 1} <span className="font-medium text-forest/35">of {questions.length}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setAnswers(syntheticDemoQuestionnaire);
              setUsingDemoAnswers(true);
            }}
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
              usingDemoAnswers
                ? 'border-moss/25 bg-sage text-moss'
                : 'border-forest/12 bg-white text-forest/60 hover:border-moss/30 hover:text-moss'
            }`}
          >
            <Icon name={usingDemoAnswers ? 'check' : 'sparkles'} className="h-4 w-4" />
            {usingDemoAnswers ? 'Demo answers loaded' : 'Load demo answers'}
          </button>
        </div>

        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-forest/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-moss to-[#4ea88f] transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-4 hidden grid-cols-3 gap-2 sm:grid">
          {sectionNames.map((name, index) => (
            <div
              key={name}
              className={`flex items-center gap-2 text-[11px] font-bold ${
                index === activeSection
                  ? 'text-forest'
                  : index < activeSection
                    ? 'text-moss'
                    : 'text-forest/30'
              }`}
            >
              <span
                className={`grid h-5 w-5 place-items-center rounded-full ${
                  index < activeSection
                    ? 'bg-moss text-white'
                    : index === activeSection
                      ? 'bg-forest text-white'
                      : 'border border-forest/10 bg-white'
                }`}
              >
                {index < activeSection ? <Icon name="check" className="h-3 w-3" /> : index + 1}
              </span>
              {name}
            </div>
          ))}
        </div>
      </div>

      {usingDemoAnswers ? (
        <div className="border-b border-sky-200 bg-sky-50 px-5 py-3 text-xs leading-5 text-sky-900 sm:px-7">
          <strong>Synthetic presentation profile:</strong> these answers demonstrate the full cycle and are not a person&apos;s medical history.
        </div>
      ) : null}

      <div className="px-5 py-7 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-bold text-moss sm:hidden">
            <span>{sectionNames[activeSection]}</span>
            <span className="text-forest/20">/</span>
            <span className="text-forest/40">{Math.round(progress)}%</span>
          </div>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="mt-3 max-w-xl text-2xl font-bold leading-tight tracking-[-0.025em] text-forest outline-none sm:text-3xl"
          >
            {question.title}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-forest/58">
            {question.description}
          </p>

          <div className="mt-7 min-h-36">
            {question.kind === 'answer' ? (
              <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label={question.title}>
                {answerOptions.map((option) => {
                  const selected = value === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setValue(option.value)}
                      aria-pressed={selected}
                      className={`group rounded-2xl border p-4 text-left transition duration-200 ${
                        selected
                          ? 'border-forest bg-forest text-white shadow-brand'
                          : 'border-forest/12 bg-white text-forest hover:-translate-y-0.5 hover:border-moss/40 hover:bg-sage/25'
                      }`}
                    >
                      <span className="flex items-center justify-between">
                        <span className="text-base font-bold">{option.label}</span>
                        <span
                          className={`grid h-6 w-6 place-items-center rounded-full border ${
                            selected ? 'border-white/30 bg-white/15' : 'border-forest/15'
                          }`}
                        >
                          {selected ? <Icon name="check" className="h-3.5 w-3.5" /> : null}
                        </span>
                      </span>
                      <span className={`mt-2 block text-xs ${selected ? 'text-white/60' : 'text-forest/42'}`}>
                        {option.helper}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {question.kind === 'duration' ? (
              <select
                value={value === null ? '' : String(value)}
                onChange={(event) => setValue(event.target.value as Questionnaire['duration'])}
                className="ss-input max-w-xl"
              >
                <option value="" disabled>Select a duration</option>
                <option value="less_than_one_week">Less than a week</option>
                <option value="one_to_four_weeks">1–4 weeks</option>
                <option value="one_to_six_months">1–6 months</option>
                <option value="more_than_six_months">More than 6 months</option>
                <option value="unsure">I&apos;m not sure</option>
              </select>
            ) : null}

            {question.kind === 'area' ? (
              <select
                value={value === null ? '' : String(value)}
                onChange={(event) => setValue(event.target.value as Questionnaire['affected_body_area'])}
                className="ss-input max-w-xl"
              >
                <option value="" disabled>Select the main area</option>
                <option value="face_or_neck">Face or neck</option>
                <option value="scalp">Scalp</option>
                <option value="chest_or_back">Chest or back</option>
                <option value="arms_or_hands">Arms or hands</option>
                <option value="legs_or_feet">Legs or feet</option>
                <option value="groin_or_skin_folds">Groin or skin folds</option>
                <option value="other">Another area</option>
                <option value="unsure">I&apos;m not sure</option>
              </select>
            ) : null}

            {question.kind === 'age' ? (
              <select
                value={value === null ? '' : String(value)}
                onChange={(event) => setValue(event.target.value as Questionnaire['age_group'])}
                className="ss-input max-w-xl"
              >
                <option value="" disabled>Select an age group</option>
                <option value="infant">Infant</option>
                <option value="child">Child</option>
                <option value="adolescent">Adolescent</option>
                <option value="adult">Adult</option>
                <option value="older_adult">Older adult</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            ) : null}

            {question.kind === 'pain' ? (
              <div className="max-w-xl rounded-[24px] border border-forest/10 bg-mist/55 p-5 sm:p-6">
                <div className="flex items-end justify-between">
                  <span className="text-xs font-bold text-forest/45">No pain</span>
                  <span className="font-display text-4xl text-forest">
                    {value === null ? '—' : Number(value)}
                    <span className="ml-1 text-base text-forest/35">/ 10</span>
                  </span>
                  <span className="text-xs font-bold text-forest/45">Severe</span>
                </div>
                <input
                  aria-label="Pain level from zero to ten"
                  type="range"
                  min="0"
                  max="10"
                  value={Number(value ?? 0)}
                  onChange={(event) => setValue(Number(event.target.value))}
                  className="mt-6 h-2 w-full cursor-pointer accent-moss"
                />
                {value === null ? (
                  <button type="button" onClick={() => setValue(0)} className="ss-button-secondary mx-auto mt-5 min-h-10 py-2">
                    Select no pain (0)
                  </button>
                ) : null}
              </div>
            ) : null}

            {question.kind === 'list' ? (
              <div className="max-w-xl">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={entry}
                    maxLength={100}
                    onChange={(event) => setEntry(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addListItem();
                      }
                    }}
                    placeholder="Type an item, if any"
                    className="ss-input min-w-0 flex-1"
                  />
                  <button type="button" onClick={addListItem} disabled={!entry.trim()} className="ss-button-secondary">
                    Add item
                  </button>
                </div>
                {list.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {list.map((item, index) => (
                      <button
                        key={`${item}-${index}`}
                        type="button"
                        onClick={() => setValue(list.filter((_, itemIndex) => itemIndex !== index))}
                        className="inline-flex items-center gap-2 rounded-full bg-sage/70 px-3 py-1.5 text-xs font-semibold text-forest transition hover:bg-red-50 hover:text-red-800"
                        aria-label={`Remove ${item}`}
                      >
                        {item}
                        <Icon name="x" className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 flex items-center gap-2 text-xs text-forest/40">
                    <Icon name="info" className="h-4 w-4" />
                    Nothing to add? You can continue.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 border-t border-forest/8 bg-white/92 px-5 py-4 backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => step > 0 && setStep((current) => current - 1)}
            disabled={step === 0 || isSaving}
            className="ss-button-secondary min-w-28"
          >
            <Icon name="chevron-left" className="h-4 w-4" />
            Back
          </button>
          <button
            type="button"
            onClick={next}
            disabled={isSaving || !hasCurrentAnswer}
            className="ss-button-primary min-w-32"
          >
            {step === questions.length - 1
              ? isSaving
                ? 'Preparing…'
                : 'Finish'
              : 'Continue'}
            {!isSaving ? <Icon name="arrow-right" className="h-4 w-4" /> : null}
          </button>
        </div>
      </div>
    </section>
  );
}
