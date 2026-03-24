'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type TotpFactor = {
  id: string;
  friendly_name?: string;
  status: string;
};

export function MfaSettingsSection({ userId }: { userId: string | undefined }) {
  const supabase = useMemo(() => createClient(), []);
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [enrolling, setEnrolling] = useState(false);
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [enrollMessage, setEnrollMessage] = useState<string | null>(null);

  const refreshFactors = useCallback(async () => {
    if (!userId) {
      setFactors([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) throw new Error(listErr.message);
      const totp = (data?.totp ?? []) as TotpFactor[];
      setFactors(totp.filter((f) => f.status === 'verified'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load MFA factors');
      setFactors([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    void refreshFactors();
  }, [refreshFactors]);

  const startEnroll = async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    setEnrollMessage(null);
    setOtp('');
    try {
      const { data, error: enErr } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator app',
      });
      if (enErr) throw new Error(enErr.message);
      if (!data?.id) throw new Error('Enrollment did not return a factor id');
      setEnrollFactorId(data.id);
      const totp = data.totp as { qr_code?: string; secret?: string } | undefined;
      setQrDataUrl(totp?.qr_code ?? null);
      setSecret(totp?.secret ?? null);
      setEnrolling(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start enrollment');
    } finally {
      setBusy(false);
    }
  };

  const cancelEnroll = () => {
    setEnrolling(false);
    setEnrollFactorId(null);
    setQrDataUrl(null);
    setSecret(null);
    setOtp('');
    setEnrollMessage(null);
  };

  const confirmEnroll = async () => {
    if (!enrollFactorId) return;
    const cleaned = otp.replace(/\s/g, '');
    if (!/^\d{6}$/.test(cleaned)) {
      setEnrollMessage('Enter the 6-digit code from your app.');
      return;
    }
    setBusy(true);
    setEnrollMessage(null);
    try {
      const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollFactorId,
        code: cleaned,
      });
      if (vErr) throw new Error(vErr.message);
      cancelEnroll();
      await refreshFactors();
      setEnrollMessage('Authenticator is enabled. You’ll enter a code when you sign in.');
    } catch (e) {
      setEnrollMessage(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  const removeFactor = async (factorId: string) => {
    if (!confirm('Remove this authenticator? You can add one again from this page.')) return;
    setBusy(true);
    setError(null);
    try {
      const { error: uErr } = await supabase.auth.mfa.unenroll({ factorId });
      if (uErr) throw new Error(uErr.message);
      await refreshFactors();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove factor');
    } finally {
      setBusy(false);
    }
  };

  if (!userId) {
    return null;
  }

  return (
    <section className="card mb-6">
      <h3 className="text-lg font-semibold mb-2">Security</h3>
      <p className="text-sm text-gray-400 mb-6">
        Two-step verification uses an authenticator app (TOTP), e.g. Google Authenticator or 1Password. Enable MFA in
        your{' '}
        <a
          href="https://supabase.com/docs/guides/auth/auth-mfa"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-400 hover:text-brand-300"
        >
          Supabase project
        </a>{' '}
        if it is not already on.
      </p>

      {error && (
        <p className="text-sm text-red-400 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}
      {enrollMessage && !enrolling && (
        <p className="text-sm text-green-400 mb-4 bg-green-500/10 border border-green-800/40 rounded-lg px-3 py-2">
          {enrollMessage}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading security settings…</p>
      ) : enrolling ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-300">Scan this QR code with your authenticator app, then enter the code.</p>
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="Authenticator QR code" className="mx-auto max-w-[200px] rounded-lg bg-white p-2" />
          )}
          {secret && (
            <p className="text-xs text-gray-500 break-all">
              Or enter manually: <span className="text-gray-400 font-mono">{secret}</span>
            </p>
          )}
          <div>
            <label className="text-sm text-gray-400 block mb-1.5">6-digit code</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full max-w-xs bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 outline-none focus:border-brand-600 transition-colors tracking-widest font-mono"
            />
          </div>
          {enrollMessage && enrolling && <p className="text-sm text-red-400">{enrollMessage}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} className="btn-primary text-sm" onClick={() => void confirmEnroll()}>
              {busy ? 'Verifying…' : 'Verify and enable'}
            </button>
            <button type="button" disabled={busy} className="btn-secondary text-sm" onClick={cancelEnroll}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {factors.length === 0 ? (
            <p className="text-sm text-gray-500">No authenticator app is linked yet.</p>
          ) : (
            <ul className="space-y-2">
              {factors.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-700/80 last:border-0"
                >
                  <span className="text-sm text-gray-200">{f.friendly_name || 'Authenticator app'}</span>
                  <button
                    type="button"
                    disabled={busy}
                    className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                    onClick={() => void removeFactor(f.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" disabled={busy} className="btn-secondary text-sm" onClick={() => void startEnroll()}>
            {factors.length === 0 ? 'Set up authenticator app' : 'Add another authenticator'}
          </button>
        </div>
      )}
    </section>
  );
}
