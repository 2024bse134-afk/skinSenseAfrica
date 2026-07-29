'use client';

import { useState } from 'react';
import type { Answer, Questionnaire } from '@/features/assessment/types';

const initialQuestionnaire: Questionnaire = {
  duration: 'unsure',
  itching: 'unsure',
  pain_level: 0,
  rapidly_spreading: 'unsure',
  affected_body_area: 'unsure',
  fever: 'unsure',
  high_fever: 'unsure',
  swelling: 'unsure',
  difficulty_breathing: 'unsure',
  lip_tongue_throat_swelling: 'unsure',
  bleeding: 'unsure',
  blistering: 'unsure',
  open_wound: 'unsure',
  eye_involvement: 'unsure',
  possible_infection: 'unsure',
  previous_treatment: [],
  known_allergies: [],
  current_products: [],
  age_group: 'prefer_not_to_say',
  recurrent: 'unsure',
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
  { key: 'recurrent', title: 'Has this concern happened before?', description: 'Recurring or persistent concerns need professional review.', kind: 'answer' },
  { key: 'itching', title: 'Is the area itchy?', description: 'Choose unsure if you cannot tell.', kind: 'answer' },
  { key: 'affected_body_area', title: 'Where is the affected area?', description: 'Choose the main area shown.', kind: 'area' },
  { key: 'fever', title: 'Do you have any fever or feel feverish?', description: 'This is separate from the high-fever warning sign.', kind: 'answer' },
  { key: 'swelling', title: 'Is the affected area swollen?', description: 'This can include puffiness around the area.', kind: 'answer' },
  { key: 'previous_treatment', title: 'What have you already tried?', description: 'Add medicines, home remedies, or treatments if applicable.', kind: 'list' },
  { key: 'known_allergies', title: 'Do you have known allergies?', description: 'Add medicine, skincare, or other allergies if known.', kind: 'list' },
  { key: 'current_products', title: 'Which products are you using?', description: 'Add creams, soaps, oils, or other products used on this area.', kind: 'list' },
  { key: 'age_group', title: 'What is your age group?', description: 'This helps identify concerns outside the prototype scope.', kind: 'age' },
];

const answerOptions: { value: Answer; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Unsure' },
];

export function QuestionnaireStep({
  onComplete,
  isSaving = false,
}: {
  onComplete: (answers: Questionnaire) => void;
  isSaving?: boolean;
}) {
  const [answers, setAnswers] = useState<Questionnaire>(initialQuestionnaire);
  const [step, setStep] = useState(0);
  const [entry, setEntry] = useState('');
  const question = questions[step];
  const value = answers[question.key];
  const list = Array.isArray(value) ? value : [];

  function setValue(next: Questionnaire[keyof Questionnaire]) {
    setAnswers((current) => ({ ...current, [question.key]: next }) as Questionnaire);
  }

  function addListItem() {
    const item = entry.trim();
    if (!item || list.length >= 10 || item.length > 100) return;
    setValue([...list, item]);
    setEntry('');
  }

  function next() {
    if (step === questions.length - 1) onComplete(answers);
    else {
      setEntry('');
      setStep((current) => current + 1);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft" aria-live="polite">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        <span>Question {step + 1} of {questions.length}</span>
        <span>{Math.round(((step + 1) / questions.length) * 100)}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-moss transition-all" style={{ width: `${((step + 1) / questions.length) * 100}%` }} />
      </div>
      <h2 className="mt-6 text-xl font-semibold text-ink">{question.title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{question.description}</p>

      <div className="mt-5">
        {question.kind === 'answer' ? (
          <div className="grid grid-cols-3 gap-2">
            {answerOptions.map((option) => (
              <button key={option.value} type="button" onClick={() => setValue(option.value)} className={`rounded-2xl border px-3 py-3 text-sm font-semibold ${value === option.value ? 'border-moss bg-moss text-white' : 'border-slate-300 text-ink'}`}>
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
        {question.kind === 'duration' ? (
          <select value={String(value)} onChange={(event) => setValue(event.target.value as Questionnaire['duration'])} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm">
            <option value="less_than_one_week">Less than a week</option>
            <option value="one_to_four_weeks">1–4 weeks</option>
            <option value="one_to_six_months">1–6 months</option>
            <option value="more_than_six_months">More than 6 months</option>
            <option value="unsure">Unsure</option>
          </select>
        ) : null}
        {question.kind === 'area' ? (
          <select value={String(value)} onChange={(event) => setValue(event.target.value as Questionnaire['affected_body_area'])} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm">
            <option value="face_or_neck">Face or neck</option><option value="scalp">Scalp</option>
            <option value="chest_or_back">Chest or back</option><option value="arms_or_hands">Arms or hands</option>
            <option value="legs_or_feet">Legs or feet</option><option value="groin_or_skin_folds">Groin or skin folds</option>
            <option value="other">Other</option><option value="unsure">Unsure</option>
          </select>
        ) : null}
        {question.kind === 'age' ? (
          <select value={String(value)} onChange={(event) => setValue(event.target.value as Questionnaire['age_group'])} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm">
            <option value="infant">Infant</option><option value="child">Child</option>
            <option value="adolescent">Adolescent</option><option value="adult">Adult</option>
            <option value="older_adult">Older adult</option><option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        ) : null}
        {question.kind === 'pain' ? (
          <>
            <input aria-label="Pain level" type="range" min="0" max="10" value={Number(value)} onChange={(event) => setValue(Number(event.target.value))} className="w-full accent-moss" />
            <p className="mt-2 text-center text-lg font-semibold text-ink">{Number(value)} / 10</p>
          </>
        ) : null}
        {question.kind === 'list' ? (
          <>
            <div className="flex gap-2">
              <input value={entry} maxLength={100} onChange={(event) => setEntry(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addListItem(); } }} placeholder="Type an item" className="min-w-0 flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
              <button type="button" onClick={addListItem} className="rounded-2xl bg-slate-100 px-4 text-sm font-semibold text-ink">Add</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {list.map((item, index) => <button key={`${item}-${index}`} type="button" onClick={() => setValue(list.filter((_, itemIndex) => itemIndex !== index))} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{item} ×</button>)}
            </div>
          </>
        ) : null}
      </div>

      <div className="mt-7 flex justify-between gap-3">
        <button type="button" onClick={() => step > 0 && setStep((current) => current - 1)} disabled={step === 0 || isSaving} className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-600 disabled:opacity-40">Back</button>
        <button type="button" onClick={next} disabled={isSaving} className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white">
          {step === questions.length - 1 ? (isSaving ? 'Saving…' : 'Finish') : 'Continue'}
        </button>
      </div>
    </section>
  );
}
