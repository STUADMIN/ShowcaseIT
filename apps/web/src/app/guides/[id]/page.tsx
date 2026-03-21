import { GuideEditor } from '@/components/editor/guide-editor';

export default async function GuideEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GuideEditor guideId={id} />;
}
