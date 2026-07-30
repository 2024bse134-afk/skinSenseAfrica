'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppFooter, AppHeader } from '@/components/AppChrome';
import { Icon } from '@/components/Icons';
import { createAssessment } from '@/features/assessment/api';
import { ApiClientError } from '@/lib/api-client';
import { APP_TAGLINE } from '@/lib/constants';

const trustPoints = [
  { icon: 'lock' as const, label: 'Images are not retained' },
  { icon: 'shield' as const, label: 'Safety rules come first' },
  { icon: 'sparkles' as const, label: 'Two-stage AI reasoning' },
];

const journey = [
  {
    number: '01',
    title: 'Share one clear image',
    text: 'Use your camera or choose a photo. We check quality before assessment.',
  },
  {
    number: '02',
    title: 'Add the human context',
    text: 'A short, structured questionnaire checks symptoms and urgent warning signs.',
  },
  {
    number: '03',
    title: 'Understand the result',
    text: 'See what the AI noticed, what else it considered, and safety-shaped next steps.',
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStartAssessment() {
    setIsStarting(true);
    setError(null);
    try {
      const response = await createAssessment();
      window.sessionStorage.setItem('skinsense:assessment_id', response.id);
      router.push(`/assessment/${response.id}`);
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiClientError
          ? caughtError.message
          : 'Unable to start an assessment right now.',
      );
      setIsStarting(false);
    }
  }

  return (
    <div className="min-h-screen overflow-hidden">
      <AppHeader
        action={
          <span className="hidden items-center gap-2 rounded-full bg-sage/70 px-3 py-1.5 text-[11px] font-bold text-moss sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-moss" />
            AI showcase
          </span>
        }
      />

      <main>
        <section className="relative">
          <div className="pointer-events-none absolute left-[-10rem] top-20 h-80 w-80 rounded-full bg-sage/70 blur-3xl" />
          <div className="pointer-events-none absolute right-[-9rem] top-4 h-80 w-80 rounded-full bg-[#f6d8b7]/40 blur-3xl" />

          <div className="ss-container relative grid min-h-[calc(100vh-72px)] items-center gap-12 py-12 lg:grid-cols-[1.06fr_.94fr] lg:gap-20 lg:py-20">
            <div className="max-w-2xl">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-moss/15 bg-white/75 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-moss shadow-sm">
                <Icon name="sparkles" className="h-4 w-4" />
                Built for melanin-rich skin
              </div>
              <h1 className="ss-title">
                Skin insight that
                <span className="relative mx-2 inline-block italic text-moss">
                  explains
                  <svg
                    aria-hidden="true"
                    className="absolute -bottom-2 left-0 h-3 w-full text-coral/60"
                    viewBox="0 0 180 12"
                    preserveAspectRatio="none"
                  >
                    <path d="M2 9C42 2 115 2 178 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </span>
                itself.
              </h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-forest/68 sm:text-lg">
                {APP_TAGLINE} Upload one image, answer a focused safety check,
                and see the visual clues and context behind your educational
                guidance.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handleStartAssessment}
                  disabled={isStarting}
                  className="ss-button-accent min-w-52 px-6"
                >
                  {isStarting ? 'Opening assessment…' : 'Start skin assessment'}
                  {!isStarting ? <Icon name="arrow-right" className="h-4 w-4" /> : null}
                </button>
                <a href="#how-it-works" className="ss-button-secondary px-6">
                  See how it works
                </a>
              </div>

              {error ? (
                <p
                  role="alert"
                  className="mt-5 max-w-xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  {error}
                </p>
              ) : null}

              <div className="mt-9 flex flex-col gap-3 border-t border-forest/10 pt-6 sm:flex-row sm:flex-wrap sm:gap-x-6">
                {trustPoints.map((point) => (
                  <span key={point.label} className="inline-flex items-center gap-2 text-xs font-semibold text-forest/60">
                    <Icon name={point.icon} className="h-4 w-4 text-moss" />
                    {point.label}
                  </span>
                ))}
              </div>
            </div>

            <HeroVisual />
          </div>
        </section>

        <section id="how-it-works" className="border-y border-forest/8 bg-white/55 py-16 sm:py-20">
          <div className="ss-container">
            <div className="max-w-2xl">
              <p className="ss-kicker">A clearer AI journey</p>
              <h2 className="mt-4 font-display text-3xl leading-tight tracking-[-0.025em] text-forest sm:text-4xl">
                From image to understandable guidance in three thoughtful steps.
              </h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {journey.map((item) => (
                <article key={item.number} className="ss-card group p-6 transition duration-300 hover:-translate-y-1 hover:shadow-lift sm:p-7">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-3xl italic text-moss">{item.number}</span>
                    <span className="h-px w-12 bg-forest/12 transition-all group-hover:w-20 group-hover:bg-coral/60" />
                  </div>
                  <h3 className="mt-8 text-lg font-bold tracking-[-0.015em] text-forest">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-forest/62">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="ss-container py-16 sm:py-20">
          <div className="grid overflow-hidden rounded-[32px] bg-forest text-white shadow-lift lg:grid-cols-[1fr_.74fr]">
            <div className="p-7 sm:p-10 lg:p-12">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#9ed9c7]">
                <Icon name="shield" className="h-6 w-6" />
              </span>
              <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-[#9ed9c7]">Safety by design</p>
              <h2 className="mt-3 max-w-xl font-display text-3xl leading-tight tracking-[-0.025em] sm:text-4xl">
                The AI can explain. It cannot overrule the safety layer.
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
                Deterministic checks assess urgent warning signs before recommendations are shaped.
                This prototype never confirms a diagnosis and should not replace qualified medical care.
              </p>
            </div>
            <div className="grid border-t border-white/10 bg-white/[0.04] p-7 lg:border-l lg:border-t-0 lg:p-10">
              <div className="self-center">
                <p className="text-sm font-bold">Your image lifecycle</p>
                <ul className="mt-5 space-y-4 text-sm text-white/68">
                  {[
                    'Validated and stripped of metadata',
                    'Used for one assessment request',
                    'Image bytes are not kept by the backend',
                  ].map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#9ed9c7]/15 text-[#9ed9c7]">
                        <Icon name="check" className="h-3 w-3" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      <AppFooter />

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-forest/10 bg-cream/95 p-3 backdrop-blur-xl sm:hidden">
        <button
          type="button"
          onClick={handleStartAssessment}
          disabled={isStarting}
          className="ss-button-accent w-full"
        >
          {isStarting ? 'Opening assessment…' : 'Start skin assessment'}
          {!isStarting ? <Icon name="arrow-right" className="h-4 w-4" /> : null}
        </button>
      </div>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto hidden w-full max-w-[520px] lg:block">
      <div className="absolute -left-8 top-20 z-10 ss-float rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-lift backdrop-blur">
        <p className="flex items-center gap-2 text-xs font-bold text-forest">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-sage text-moss">
            <Icon name="shield" className="h-4 w-4" />
          </span>
          Safety checked first
        </p>
      </div>
      <div className="absolute -right-5 bottom-20 z-10 rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-lift backdrop-blur">
        <p className="ss-kicker">Image privacy</p>
        <p className="mt-1 text-xs font-bold text-forest">Not retained</p>
      </div>

      <div className="relative ml-auto w-[88%] rotate-[1.5deg] rounded-[36px] border border-white/80 bg-[#e6eee8] p-3 shadow-[0_38px_100px_rgba(14,59,54,.2)]">
        <div className="overflow-hidden rounded-[28px] bg-forest">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#91d4bd]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">Assessment preview</span>
            </div>
            <Icon name="sparkles" className="h-4 w-4 text-[#f2c75c]" />
          </div>
          <div className="relative aspect-[4/3] overflow-hidden bg-[radial-gradient(circle_at_30%_22%,#e8b795_0,transparent_18%),radial-gradient(circle_at_58%_52%,#9b4e45_0,transparent_5%),radial-gradient(circle_at_63%_60%,#c97869_0,transparent_3%),linear-gradient(135deg,#d9a783,#b87568)]">
            <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_center,transparent_0,rgba(14,59,54,.5)_100%)]" />
            <div className="absolute left-[39%] top-[37%] h-24 w-24 rounded-full border border-white/80">
              <span className="absolute -left-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-coral" />
              <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-coral" />
            </div>
            <div className="absolute bottom-4 left-4 rounded-full bg-forest/70 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur">
              Controlled visual findings
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#91d4bd]">Preliminary pattern</p>
                <p className="mt-2 font-display text-3xl text-white">Explained, not asserted.</p>
              </div>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold text-white/75">
                AI + safety
              </span>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {['Visual clues', 'Alternatives', 'Next steps'].map((item) => (
                <div key={item} className="rounded-xl bg-white/[0.07] px-3 py-3 text-center text-[10px] font-semibold text-white/65">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
