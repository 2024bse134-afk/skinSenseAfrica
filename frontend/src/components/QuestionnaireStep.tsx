'use client';

import { useState } from 'react';
import type { Questionnaire } from '@/features/assessment/types';

const emptyQuestionnaire: Questionnaire = {
  duration: null, itching: null, pain_level: null, rapidly_spreading: null, affected_area: null,
  fever: null, swelling: null, bleeding_or_open_wound: null, eye_involvement: null,
  previous_treatments: [], known_allergies: [], current_products: [],
};

type Question = { key: keyof Questionnaire; title: string; description: string; kind: 'boolean' | 'duration' | 'area' | 'pain' | 'list' };
const questions: Question[] = [
  { key: 'duration', title: 'How long has this been present?', description: 'Choose the closest answer, or skip if you are not sure.', kind: 'duration' },
  { key: 'itching', title: 'Is the area itchy?', description: 'This helps us understand your symptoms.', kind: 'boolean' },
  { key: 'pain_level', title: 'How painful is it?', description: '0 means no pain; 10 means the worst pain you can imagine.', kind: 'pain' },
  { key: 'rapidly_spreading', title: 'Is it spreading quickly?', description: 'For example, noticeably getting larger over hours or a few days.', kind: 'boolean' },
  { key: 'affected_area', title: 'Where is the affected area?', description: 'Choose the main area shown in your photo.', kind: 'area' },
  { key: 'fever', title: 'Do you have a fever?', description: 'Choose yes if you have a fever or feel feverish.', kind: 'boolean' },
  { key: 'swelling', title: 'Is there swelling?', description: 'This can include puffiness or swelling around the affected area.', kind: 'boolean' },
  { key: 'bleeding_or_open_wound', title: 'Is there bleeding or an open wound?', description: 'Choose yes even if the bleeding has stopped.', kind: 'boolean' },
  { key: 'eye_involvement', title: 'Does this involve your eye or eyelid?', description: 'This includes skin very close to the eye.', kind: 'boolean' },
  { key: 'previous_treatments', title: 'What have you already tried?', description: 'Add medicines, home remedies, or treatments. You may skip this.', kind: 'list' },
  { key: 'known_allergies', title: 'Do you have known allergies?', description: 'Add any medicine, skincare, or other allergies. You may skip this.', kind: 'list' },
  { key: 'current_products', title: 'Which products are you using?', description: 'Add creams, soaps, oils, or other products used on this area.', kind: 'list' },
];

export function QuestionnaireStep({ onComplete, isSaving = false }: { onComplete: (answers: Questionnaire) => void; isSaving?: boolean }) {
  const [answers, setAnswers] = useState<Questionnaire>(emptyQuestionnaire);
  const [step, setStep] = useState(0);
  const [entry, setEntry] = useState('');
  const question = questions[step];
  const value = answers[question.key];
  const set = (next: Questionnaire[keyof Questionnaire]) => setAnswers((current) => ({ ...current, [question.key]: next }) as Questionnaire);
  const next = () => step === questions.length - 1 ? onComplete(answers) : (setEntry(''), setStep((current) => current + 1));
  const list = Array.isArray(value) ? value : [];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft" aria-live="polite">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"><span>Question {step + 1} of {questions.length}</span><span>{Math.round(((step + 1) / questions.length) * 100)}%</span></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-moss transition-all" style={{ width: `${((step + 1) / questions.length) * 100}%` }} /></div>
      <h2 className="mt-6 text-xl font-semibold text-ink">{question.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{question.description}</p>
      <div className="mt-5">
        {question.kind === 'boolean' ? <div className="grid grid-cols-2 gap-3">{([true, false] as const).map((answer) => <button key={String(answer)} type="button" onClick={() => set(answer)} className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${value === answer ? 'border-moss bg-moss text-white' : 'border-slate-300 text-ink'}`}>{answer ? 'Yes' : 'No'}</button>)}</div> : null}
        {question.kind === 'duration' ? <select value={(value as string | null) ?? ''} onChange={(event) => set(event.target.value || null)} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"><option value="">Select an answer</option><option>Less than a week</option><option>1–4 weeks</option><option>1–6 months</option><option>More than 6 months</option></select> : null}
        {question.kind === 'area' ? <select value={(value as string | null) ?? ''} onChange={(event) => set(event.target.value || null)} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"><option value="">Select an area</option><option>Face or neck</option><option>Scalp</option><option>Chest or back</option><option>Arms or hands</option><option>Legs or feet</option><option>Groin or skin folds</option><option>Other</option></select> : null}
        {question.kind === 'pain' ? <><input aria-label="Pain level" type="range" min="0" max="10" value={(value as number | null) ?? 0} onChange={(event) => set(Number(event.target.value))} className="w-full accent-moss" /><p className="mt-2 text-center text-lg font-semibold text-ink">{value ?? 0} / 10</p></> : null}
        {question.kind === 'list' ? <><div className="flex gap-2"><input value={entry} onChange={(event) => setEntry(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (entry.trim()) { set([...list, entry.trim()]); setEntry(''); } } }} placeholder="Type an item" className="min-w-0 flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm" /><button type="button" onClick={() => { if (entry.trim()) { set([...list, entry.trim()]); setEntry(''); } }} className="rounded-2xl bg-slate-100 px-4 text-sm font-semibold text-ink">Add</button></div><div className="mt-3 flex flex-wrap gap-2">{list.map((item, index) => <button key={`${item}-${index}`} type="button" onClick={() => set(list.filter((_, itemIndex) => itemIndex !== index))} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{item} ×</button>)}</div></> : null}
      </div>
      <div className="mt-7 flex justify-between gap-3"><button type="button" onClick={() => step > 0 && setStep((current) => current - 1)} disabled={step === 0 || isSaving} className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-600 disabled:opacity-40">Back</button><div className="flex gap-2"><button type="button" onClick={next} disabled={isSaving} className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-600">Skip</button><button type="button" onClick={next} disabled={isSaving} className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white">{step === questions.length - 1 ? (isSaving ? 'Saving…' : 'Finish') : 'Continue'}</button></div></div>
    </section>
  );
}
