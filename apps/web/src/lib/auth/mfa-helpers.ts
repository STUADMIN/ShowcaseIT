import type { SupabaseClient } from '@supabase/supabase-js';

/** After password sign-in: true when user must complete TOTP to reach AAL2. */
export async function mfaLoginStepRequired(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return data.currentLevel === 'aal1' && data.nextLevel === 'aal2';
}

export async function verifyTotpForLogin(
  supabase: SupabaseClient,
  code: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cleaned = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(cleaned)) {
    return { ok: false, error: 'Enter the 6-digit code from your authenticator app.' };
  }

  const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
  if (listErr) return { ok: false, error: listErr.message };

  const totpFactors = factors?.totp ?? [];
  const totp = totpFactors.find((f) => f.status === 'verified');
  if (!totp) {
    return { ok: false, error: 'No verified authenticator is enrolled for this account.' };
  }

  const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: totp.id });
  if (chErr || !challenge?.id) {
    return { ok: false, error: chErr?.message || 'Could not start MFA verification.' };
  }

  const { error: verErr } = await supabase.auth.mfa.verify({
    factorId: totp.id,
    challengeId: challenge.id,
    code: cleaned,
  });
  if (verErr) return { ok: false, error: verErr.message };
  return { ok: true };
}
