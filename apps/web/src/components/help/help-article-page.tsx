'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  List,
  Pencil,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useApi } from '@/hooks/use-api';

interface Step {
  id: string;
  order: number;
  title: string;
  description: string;
  screenshotUrl: string | null;
  styledScreenshotUrl: string | null;
}

interface HelpGuide {
  id: string;
  title: string;
  description: string | null;
  steps: Step[];
}

function readStepFromHash(): number {
  if (typeof window === 'undefined') return 0;
  const match = window.location.hash.match(/^#step-(\d+)$/);
  return match ? Math.max(0, parseInt(match[1], 10) - 1) : 0;
}

export function HelpArticlePage({ guideId }: { guideId: string }) {
  const { data: guide, loading, error } = useApi<HelpGuide>({
    url: `/api/help/${guideId}`,
  });
  const [activeStep, setActiveStepRaw] = useState(readStepFromHash);
  const [showToc, setShowToc] = useState(true);

  const steps = useMemo(() => guide?.steps ?? [], [guide]);

  const setActiveStep = useCallback(
    (val: number | ((prev: number) => number)) => {
      setActiveStepRaw((prev) => {
        const next = typeof val === 'function' ? val(prev) : val;
        const clamped = Math.max(0, Math.min(next, (steps.length || 1) - 1));
        window.history.replaceState(null, '', `#step-${clamped + 1}`);
        return clamped;
      });
    },
    [steps.length]
  );

  useEffect(() => {
    if (steps.length === 0) return;
    const fromHash = readStepFromHash();
    if (fromHash > 0 && fromHash < steps.length) {
      setActiveStepRaw(fromHash);
    }
  }, [steps.length]);

  useEffect(() => {
    const onPop = () => setActiveStepRaw(readStepFromHash());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const step = steps[activeStep];

  if (loading) {
    return (
      <AppShell>
        <div className="p-8 max-w-5xl mx-auto">
          <p className="text-gray-500">Loading article...</p>
        </div>
      </AppShell>
    );
  }

  if (error || !guide) {
    return (
      <AppShell>
        <div className="p-8 max-w-5xl mx-auto">
          <Link
            href="/help"
            className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Help Centre
          </Link>
          <div className="card p-16 text-center border border-red-900/50 bg-red-950/20">
            <p className="text-red-300/90 text-sm">
              {error ?? 'Article not found.'}
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const cleanedDescription = (guide.description ?? '')
    .replace(/\[auto-doc:[^\]]+\]/g, '')
    .trim();

  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Step table of contents sidebar */}
        {showToc && steps.length > 1 && (
          <aside className="hidden lg:flex w-72 flex-col border-r border-gray-800 bg-gray-950/60 overflow-y-auto">
            <div className="p-4 border-b border-gray-800">
              <Link
                href="/help"
                className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 mb-3"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Help Centre
              </Link>
              <h3 className="text-sm font-semibold text-gray-200 truncate">
                {guide.title}
              </h3>
              {cleanedDescription && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {cleanedDescription}
                </p>
              )}
            </div>
            <nav className="flex-1 p-3">
              <p className="text-[11px] uppercase tracking-wider text-gray-600 px-2 mb-2 font-semibold">
                Steps
              </p>
              {steps.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveStep(i)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors flex items-start gap-2 ${
                    i === activeStep
                      ? 'bg-brand-600/10 text-brand-400'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                  }`}
                >
                  <span
                    className={`flex-shrink-0 w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center mt-0.5 ${
                      i === activeStep
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-800 text-gray-500'
                    }`}
                  >
                    {s.order}
                  </span>
                  <span className="line-clamp-2">{s.title}</span>
                </button>
              ))}
            </nav>
          </aside>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <Link
                href="/help"
                className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 lg:hidden"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </Link>
              {steps.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowToc((v) => !v)}
                  className="hidden lg:inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200"
                >
                  <List className="w-4 h-4" />
                  {showToc ? 'Hide' : 'Show'} steps
                </button>
              )}
            </div>

            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="text-3xl font-bold text-gray-100">
                {guide.title}
              </h1>
              <Link
                href={`/guides/${guide.id}`}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit Guide
              </Link>
            </div>
            {cleanedDescription && (
              <p className="text-gray-400 mb-8">{cleanedDescription}</p>
            )}

            {steps.length === 0 ? (
              <div className="card p-12 text-center">
                <FileText className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">
                  This article has no steps yet.
                </p>
              </div>
            ) : (
              <>
                {/* Active step */}
                {step && (
                  <article className="space-y-6 mb-8">
                    <div className="flex items-start gap-4">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-600 text-white text-sm font-bold flex items-center justify-center mt-1">
                        {step.order}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-xl font-semibold text-gray-200">
                          {step.title}
                        </h2>
                        {step.description && (
                          <p className="text-gray-400 mt-1">{step.description}</p>
                        )}
                      </div>
                    </div>

                    {(step.styledScreenshotUrl || step.screenshotUrl) && (
                      <div className="rounded-xl overflow-hidden border border-gray-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={step.styledScreenshotUrl || step.screenshotUrl!}
                          alt={step.title}
                          className="w-full"
                        />
                      </div>
                    )}
                  </article>
                )}

                {/* Navigation */}
                {steps.length > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-800 pt-6">
                    <button
                      type="button"
                      onClick={() => setActiveStep((p) => Math.max(0, p - 1))}
                      disabled={activeStep === 0}
                      className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" /> Previous
                    </button>
                    <span className="text-sm text-gray-500 tabular-nums">
                      Step {activeStep + 1} of {steps.length}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveStep((p) =>
                          Math.min(steps.length - 1, p + 1)
                        )
                      }
                      disabled={activeStep === steps.length - 1}
                      className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
