'use client';

import { WalkthroughViewer } from './walkthrough-viewer';

interface WalkthroughPreviewProps {
  guideTitle: string;
  steps: Array<{
    id: string;
    order: number;
    title: string;
    description: string;
    screenshotUrl: string;
    mousePosition?: { x: number; y: number };
    clickTarget?: { x: number; y: number };
  }>;
}

export function WalkthroughPreview({ guideTitle, steps }: WalkthroughPreviewProps) {
  return (
    <div className="p-8 bg-gray-950 min-h-screen flex items-start justify-center">
      <div className="w-full max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-100">Interactive Walkthrough Preview</h2>
          <div className="flex gap-2">
            <button className="btn-secondary text-sm py-2 px-4">Edit Steps</button>
            <button className="btn-primary text-sm py-2 px-4">Export as HTML</button>
          </div>
        </div>
        <WalkthroughViewer title={guideTitle} steps={steps} />
      </div>
    </div>
  );
}
