import { WalkthroughPreview } from '@/components/walkthrough/walkthrough-preview';

const demoSteps = [
  {
    id: '1',
    order: 1,
    title: 'Open the Dashboard',
    description: 'Navigate to the main dashboard by clicking the home icon.',
    screenshotUrl: '',
    mousePosition: { x: 10, y: 10 },
    clickTarget: { x: 5, y: 50 },
  },
  {
    id: '2',
    order: 2,
    title: 'Click Settings',
    description: 'Open settings from the sidebar menu.',
    screenshotUrl: '',
    mousePosition: { x: 5, y: 50 },
    clickTarget: { x: 80, y: 15 },
  },
  {
    id: '3',
    order: 3,
    title: 'Configure Profile',
    description: 'Update your name, email, and avatar in the profile section.',
    screenshotUrl: '',
    mousePosition: { x: 50, y: 30 },
    clickTarget: { x: 60, y: 70 },
  },
];

export default function WalkthroughPreviewPage() {
  return <WalkthroughPreview guideTitle="Getting Started" steps={demoSteps} />;
}
