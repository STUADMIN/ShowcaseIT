'use client';

import { useState, useEffect, useCallback } from 'react';

interface WalkthroughStep {
  id: string;
  order: number;
  title: string;
  description: string;
  screenshotUrl: string;
  mousePosition?: { x: number; y: number };
  clickTarget?: { x: number; y: number };
}

interface WalkthroughViewerProps {
  title: string;
  steps: WalkthroughStep[];
  brandColors?: {
    primary: string;
    background: string;
    foreground: string;
  };
}

export function WalkthroughViewer({ title, steps, brandColors }: WalkthroughViewerProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isAnimating, setIsAnimating] = useState(false);
  const [showClick, setShowClick] = useState(false);

  const colors = brandColors ?? {
    primary: '#2563EB',
    background: '#0f1117',
    foreground: '#e4e6f0',
  };

  const step = steps[currentStep];

  const animateToTarget = useCallback(() => {
    if (!step?.clickTarget) return;

    setIsAnimating(true);
    const startPos = { ...mousePos };
    const endPos = step.clickTarget;
    const duration = 800;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setMousePos({
        x: startPos.x + (endPos.x - startPos.x) * eased,
        y: startPos.y + (endPos.y - startPos.y) * eased,
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setShowClick(true);
        setTimeout(() => {
          setShowClick(false);
          setIsAnimating(false);
        }, 600);
      }
    };

    requestAnimationFrame(animate);
  }, [step, mousePos]);

  useEffect(() => {
    if (step?.mousePosition) {
      setMousePos(step.mousePosition);
    }
  }, [currentStep, step]);

  const goNext = () => {
    if (step?.clickTarget) {
      animateToTarget();
      setTimeout(() => {
        if (currentStep < steps.length - 1) {
          setCurrentStep((prev) => prev + 1);
        }
      }, 1200);
    } else if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const goPrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  if (!step) return null;

  return (
    <div
      className="w-full max-w-5xl mx-auto rounded-2xl overflow-hidden shadow-2xl"
      style={{ backgroundColor: colors.background, color: colors.foreground }}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-sm opacity-60">
            Step {currentStep + 1} of {steps.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              className="w-2.5 h-2.5 rounded-full transition-all"
              style={{
                backgroundColor: i === currentStep ? colors.primary : 'rgba(255,255,255,0.2)',
                transform: i === currentStep ? 'scale(1.3)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{ backgroundColor: colors.primary }}
          >
            {step.order}
          </span>
          <div>
            <h3 className="font-semibold text-lg">{step.title}</h3>
            <p className="text-sm opacity-60">{step.description}</p>
          </div>
        </div>

        {/* Screenshot with mouse overlay */}
        <div className="relative rounded-xl overflow-hidden border border-gray-800 mb-6">
          {step.screenshotUrl ? (
            <img
              src={step.screenshotUrl}
              alt={step.title}
              className="w-full"
            />
          ) : (
            <div className="aspect-video bg-gray-800 flex items-center justify-center">
              <p className="text-gray-500">Screenshot placeholder</p>
            </div>
          )}

          {/* Animated mouse cursor */}
          <div
            className="absolute pointer-events-none z-10 transition-all"
            style={{
              left: `${mousePos.x}%`,
              top: `${mousePos.y}%`,
              transitionDuration: isAnimating ? '0ms' : '300ms',
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
            >
              <path
                d="M5 3L19 12L12 14L9 21L5 3Z"
                fill={colors.primary}
                stroke="white"
                strokeWidth="1.5"
              />
            </svg>

            {/* Click ripple */}
            {showClick && (
              <div
                className="absolute -top-3 -left-3 w-12 h-12 rounded-full border-2 animate-ping"
                style={{ borderColor: colors.primary }}
              />
            )}
          </div>

          {/* Click target indicator */}
          {step.clickTarget && (
            <div
              className="absolute w-10 h-10 rounded-full border-2 border-dashed opacity-30 animate-pulse"
              style={{
                left: `calc(${step.clickTarget.x}% - 20px)`,
                top: `calc(${step.clickTarget.y}% - 20px)`,
                borderColor: colors.primary,
              }}
            />
          )}
        </div>
      </div>

      {/* Footer controls */}
      <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={currentStep === 0}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-30"
          style={{
            backgroundColor: 'rgba(255,255,255,0.1)',
            color: colors.foreground,
          }}
        >
          Previous
        </button>

        <span className="text-sm opacity-40">
          Click to advance or use the buttons
        </span>

        <button
          onClick={goNext}
          disabled={currentStep === steps.length - 1 && !step.clickTarget}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-30"
          style={{ backgroundColor: colors.primary }}
        >
          {currentStep === steps.length - 1 ? 'Finish' : 'Next Step'}
        </button>
      </div>
    </div>
  );
}
