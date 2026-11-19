'use client';

import {useRef, useState} from 'react';
import {Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck, Check, ArrowRight} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {usePreferences} from '@/components/saas/preferences';

export function ChangePasswordForm({onSuccess, onCancel}) {
  const {t} = usePreferences();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const pending = useRef(false);

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const currentPassword = values.get('currentPassword');
    const newPassword = values.get('newPassword');
    const confirmPassword = values.get('confirmPassword');

    if (newPassword !== confirmPassword) {setError('New passwords do not match'); return;}
    if (currentPassword === newPassword) {setError('New password must be different from the current one'); return;}

    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/credentials/change-password', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({currentPassword, newPassword}),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'The password could not be changed');
      setSuccess(true);
      form.reset();
      setTimeout(() => onSuccess?.(), 2000);
    } catch (cause) {
      setError(cause.message || 'The password could not be changed');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="change-password-success">
        <div className="change-password-success-icon">
          <Check size={28} />
        </div>
        <h3>{t('Password changed!')}</h3>
        <p>{t('Your password has been updated successfully. You will need to sign in again with your new password.')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="change-password-form" aria-busy={busy}>
      <div className="change-password-header">
        <span className="form-icon"><LockKeyhole size={22} /></span>
        <div>
          <strong>{t('Change your password')}</strong>
          <p>{t('Enter your current password and choose a new one.')}</p>
        </div>
      </div>

      <div className="form-grid">
        <label className="field form-full">
          {t('Current password')}
          <div className="change-password-input-wrap">
            <input
              name="currentPassword"
              type={showCurrent ? 'text' : 'password'}
              minLength={12}
              maxLength={128}
              autoComplete="current-password"
              required
              disabled={busy}
              placeholder={t('Enter current password')}
            />
            <button type="button" className="password-toggle" onClick={() => setShowCurrent(v => !v)} aria-label={t(showCurrent ? 'Hide password' : 'Show password')} disabled={busy}>
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        <label className="field form-full">
          {t('New password')}
          <div className="change-password-input-wrap">
            <input
              name="newPassword"
              type={showNew ? 'text' : 'password'}
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
              disabled={busy}
              placeholder={t('Enter new password')}
            />
            <button type="button" className="password-toggle" onClick={() => setShowNew(v => !v)} aria-label={t(showNew ? 'Hide password' : 'Show password')} disabled={busy}>
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        <label className="field form-full">
          {t('Confirm new password')}
          <div className="change-password-input-wrap">
            <input
              name="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
              disabled={busy}
              placeholder={t('Confirm new password')}
            />
            <button type="button" className="password-toggle" onClick={() => setShowConfirm(v => !v)} aria-label={t(showConfirm ? 'Hide password' : 'Show password')} disabled={busy}>
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
      </div>

      <p className="change-password-hint">
        <ShieldCheck size={14} />
        {t('Use 12 to 128 characters. Choose a strong, unique password.')}
      </p>

      {error && <p className="form-error" role="alert">{t(error)}</p>}

      <div className="modal-actions">
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          {t('Cancel')}
        </Button>
        <Button disabled={busy} type="submit">
          {busy ? <LoaderCircle size={15} className="login-credentials-spinner" /> : <KeyRound size={15} />}
          {' '}{t(busy ? 'Changing…' : 'Change password')}
        </Button>
      </div>
    </form>
  );
}
