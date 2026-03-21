/**
 * Optional Resend integration. Set RESEND_API_KEY and RESEND_FROM_EMAIL in production.
 */
export async function sendEmailViaResend(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) {
    return { ok: false, reason: 'RESEND_API_KEY or RESEND_FROM_EMAIL not configured' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, reason: err || `HTTP ${res.status}` };
  }
  return { ok: true };
}
