import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  buildWeeklyDigestPayload,
  formatWeeklyDigestHtml,
  formatWeeklyDigestText,
} from '@/lib/notifications/weekly-digest';
import { sendEmailViaResend } from '@/lib/email/resend';

const MS_WEEK = 7 * 24 * 60 * 60 * 1000;

function authorize(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === 'development';
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

/**
 * Weekly job: email users who opted into the digest.
 * Schedule with Vercel Cron, GitHub Actions, or `curl -H "Authorization: Bearer $CRON_SECRET"`.
 */
export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1';
  const now = new Date();
  const results: Array<{ userId: string; email: string; status: string }> = [];

  const users = await prisma.user.findMany({
    where: { notifyWeeklyDigest: true },
    select: { id: true, email: true, weeklyDigestLastSentAt: true },
  });

  for (const u of users) {
    if (u.weeklyDigestLastSentAt) {
      const elapsed = now.getTime() - u.weeklyDigestLastSentAt.getTime();
      if (elapsed < MS_WEEK) {
        results.push({ userId: u.id, email: u.email, status: 'skipped_recent' });
        continue;
      }
    }

    const payload = await buildWeeklyDigestPayload(u.id);
    if (!payload) {
      results.push({ userId: u.id, email: u.email, status: 'no_payload' });
      continue;
    }

    const subject = `Your ShowcaseIt weekly digest — ${new Date().toLocaleDateString()}`;
    const text = formatWeeklyDigestText(payload);
    const html = formatWeeklyDigestHtml(payload);

    if (dryRun) {
      results.push({ userId: u.id, email: u.email, status: 'dry_run' });
      continue;
    }

    const sent = await sendEmailViaResend({ to: payload.email, subject, text, html });
    if (sent.ok) {
      await prisma.user.update({
        where: { id: u.id },
        data: { weeklyDigestLastSentAt: now },
      });
      results.push({ userId: u.id, email: u.email, status: 'sent' });
    } else {
      console.warn('[weekly-digest] email failed', u.email, sent.reason);
      results.push({ userId: u.id, email: u.email, status: `failed:${sent.reason.slice(0, 80)}` });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: users.length,
    dryRun,
    results,
  });
}

/** Vercel Cron uses GET by default */
export async function GET(request: NextRequest) {
  return POST(request);
}
