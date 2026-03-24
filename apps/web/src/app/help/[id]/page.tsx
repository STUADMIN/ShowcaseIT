import { HelpArticlePage } from '@/components/help/help-article-page';

export default async function HelpArticle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HelpArticlePage guideId={id} />;
}
