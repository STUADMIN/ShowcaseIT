import { prisma } from '@/lib/db/prisma';

export interface WeeklyDigestPayload {
  userId: string;
  email: string;
  name: string | null;
  periodStart: string;
  periodEnd: string;
  totalGuides: number;
  publishedGuides: number;
  updatedThisWeek: number;
  recentGuides: Array<{ title: string; updatedAt: string; published: boolean }>;
}

const MS_WEEK = 7 * 24 * 60 * 60 * 1000;

export async function buildWeeklyDigestPayload(userId: string): Promise<WeeklyDigestPayload | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) return null;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - MS_WEEK);

  const [totalGuides, publishedGuides, updatedThisWeek, recentRaw] = await Promise.all([
    prisma.guide.count({ where: { userId } }),
    prisma.guide.count({ where: { userId, published: true } }),
    prisma.guide.count({ where: { userId, updatedAt: { gte: weekAgo } } }),
    prisma.guide.findMany({
      where: { userId, updatedAt: { gte: weekAgo } },
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: { title: true, updatedAt: true, published: true },
    }),
  ]);

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    periodStart: weekAgo.toISOString(),
    periodEnd: now.toISOString(),
    totalGuides,
    publishedGuides,
    updatedThisWeek,
    recentGuides: recentRaw.map((g) => ({
      title: g.title,
      updatedAt: g.updatedAt.toISOString(),
      published: g.published,
    })),
  };
}

export function formatWeeklyDigestText(p: WeeklyDigestPayload): string {
  const lines = [
    `Hi ${p.name || 'there'},`,
    '',
    `Your ShowcaseIt weekly digest (${new Date(p.periodStart).toLocaleDateString()} – ${new Date(p.periodEnd).toLocaleDateString()})`,
    '',
    `• Total guides: ${p.totalGuides}`,
    `• Published: ${p.publishedGuides}`,
    `• Updated in the last 7 days: ${p.updatedThisWeek}`,
    '',
    p.recentGuides.length
      ? 'Recently updated:\n' +
        p.recentGuides.map((g) => `  - ${g.title} (${g.published ? 'published' : 'draft'})`).join('\n')
      : 'No guide updates in the last 7 days.',
    '',
    'View analytics and engagement metrics will appear here as we add tracking.',
    '',
    '— ShowcaseIt',
  ];
  return lines.join('\n');
}

export function formatWeeklyDigestHtml(p: WeeklyDigestPayload): string {
  const recent =
    p.recentGuides.length === 0
      ? '<p>No guide updates in the last 7 days.</p>'
      : `<ul>${p.recentGuides.map((g) => `<li><strong>${escapeHtml(g.title)}</strong> — ${g.published ? 'published' : 'draft'}</li>`).join('')}</ul>`;

  return `
<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
  <p>Hi ${escapeHtml(p.name || 'there')},</p>
  <p>Your <strong>ShowcaseIt</strong> weekly digest<br/>
  <small>${escapeHtml(new Date(p.periodStart).toLocaleString())} – ${escapeHtml(new Date(p.periodEnd).toLocaleString())}</small></p>
  <ul>
    <li>Total guides: <strong>${p.totalGuides}</strong></li>
    <li>Published: <strong>${p.publishedGuides}</strong></li>
    <li>Updated in the last 7 days: <strong>${p.updatedThisWeek}</strong></li>
  </ul>
  <h3 style="font-size:14px;margin-top:1.5rem">Recently updated</h3>
  ${recent}
  <p style="margin-top:2rem;font-size:13px;color:#666">Detailed view counts and engagement are coming soon.</p>
  <p style="font-size:12px;color:#999">— ShowcaseIt</p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
