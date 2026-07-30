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
    text: 'Five follow-ups adapt to the image result and check symptoms and warning signs.',
  },
  {
    number: '03',
    title: 'Understand the result',
    text: 'Get a clear three-part report: what it may be, what to do, and when to get help.',
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
            <div className="max-w-2xl py-10 lg:pt-16 lg:pb-24">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-pillBg px-4 py-1.5 text-sm font-semibold text-pillText">
                <span className="h-2 w-2 rounded-full bg-pillText" />
                SkinSense Africa
              </div>
              <h1 className="font-display text-5xl font-bold tracking-tight text-ink md:text-7xl lg:text-[84px] leading-tight mt-4">
                Smarter skin<br />health guidance.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-forest/70 md:text-xl md:leading-9">
                AI-assisted skin screening and educational guidance designed with melanin-rich skin in mind.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handleStartAssessment}
                  disabled={isStarting}
                  className="rounded-full bg-primary px-8 py-3.5 font-bold text-white transition-opacity hover:opacity-90 w-full sm:w-auto text-lg shadow-lg"
                >
                  {isStarting ? 'Opening assessment…' : 'Start Skin Screening'}
                </button>
                <a href="#how-it-works" className="font-bold text-pillText px-6 py-3.5 hover:underline text-lg">
                  Learn More
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
    <div className="relative mx-auto hidden w-full lg:block lg:pl-10">
      <div className="relative aspect-[16/16] w-full overflow-hidden rounded-[3rem] bg-forest/5 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.15)]">
        <img
          src="/hero.png"
          alt="Smiling clinic worker"
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      </div>
    </div>
  );
}
