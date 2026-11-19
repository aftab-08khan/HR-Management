'use client';

import {useRef,useState} from 'react';
import {KeyRound,ShieldCheck,LoaderCircle,Mail,Check,Send} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {usePreferences} from '@/components/saas/preferences';

export function CredentialForm({member,onSaved,onCancel,emailConfigured=false}){
  const {t}=usePreferences();
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [mode,setMode]=useState('manual'); // 'manual' | 'email'
  const [emailSent,setEmailSent]=useState(false);
  const pending=useRef(false);

  async function submitManual(event){
    event.preventDefault();if(pending.current)return;
    const form=event.currentTarget;
    const values=new FormData(form);
    if(values.get('password')!==values.get('confirmPassword')){setError('Passwords do not match');return;}
    pending.current=true;setBusy(true);setError('');
    try {
      const response=await fetch('/api/credentials',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:member.email,password:values.get('password')})});
      const result=await response.json();if(!response.ok)throw Error(result.error||'The password could not be saved');
      form.reset();onSaved?.();
    } catch(cause){setError(cause.message||'The password could not be saved');}
    finally{pending.current=false;setBusy(false);}
  }

  async function sendWelcome(){
    if(pending.current)return;
    pending.current=true;setBusy(true);setError('');
    try {
      const response=await fetch('/api/credentials/send-welcome',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:member.email})});
      const result=await response.json();
      if(!response.ok)throw Error(result.error||'Could not send welcome email');
      setEmailSent(true);
      setTimeout(()=>onSaved?.(),2500);
    } catch(cause){setError(cause.message||'Could not send welcome email');}
    finally{pending.current=false;setBusy(false);}
  }

  if(emailSent){
    return <div className="credential-email-sent">
      <div className="credential-email-sent-icon"><Check size={28}/></div>
      <h3>{t('Welcome email sent!')}</h3>
      <p>{t('{name} will receive their login credentials at {email}.', {name: member.name || member.email, email: member.email})}</p>
      <p className="credential-email-sent-note"><ShieldCheck size={13}/>{t('A temporary password was generated. They can change it after signing in.')}</p>
    </div>;
  }

  return <div className="credential-setup-container">
    {/* Mode selector */}
    {emailConfigured && <div className="credential-mode-selector">
      <button type="button" className={`credential-mode-tab ${mode==='email'?'active':''}`} onClick={()=>{setMode('email');setError('');}}>
        <Mail size={15}/>{t('Send welcome email')}
      </button>
      <button type="button" className={`credential-mode-tab ${mode==='manual'?'active':''}`} onClick={()=>{setMode('manual');setError('');}}>
        <KeyRound size={15}/>{t('Set password manually')}
      </button>
    </div>}

    {mode==='email' && emailConfigured ? (
      <div className="credential-email-mode">
        <div className="export-summary">
          <span className="form-icon"><Mail size={23}/></span>
          <div>
            <strong>{member.name||member.email}</strong>
            <p>{t('Send a welcome email with auto-generated login credentials to this member.')}</p>
          </div>
        </div>
        <div className="credential-email-preview">
          <div className="credential-email-preview-header">
            <Send size={14}/>
            <span>{t('Email preview')}</span>
          </div>
          <div className="credential-email-preview-body">
            <p><strong>{t('To:')}</strong> {member.email}</p>
            <p><strong>{t('Subject:')}</strong> {t('Welcome to your workspace — Your PeopleOS Login')}</p>
            <p className="credential-email-preview-content">{t('The email will include their email address, a temporary password, and a link to sign in.')}</p>
          </div>
        </div>
        <p className="export-privacy"><ShieldCheck size={15}/>{t('A secure temporary password will be generated automatically.')}</p>
        {error&&<p className="form-error" role="alert">{t(error)}</p>}
        <div className="modal-actions">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>{t('Cancel')}</Button>
          <Button disabled={busy} onClick={sendWelcome}>
            {busy?<LoaderCircle size={15} className="login-credentials-spinner"/>:<Mail size={15}/>} {t(busy?'Sending…':'Send welcome email')}
          </Button>
        </div>
      </div>
    ) : (
      <form onSubmit={submitManual} className="credential-setup-form" aria-busy={busy}>
        <div className="export-summary">
          <span className="form-icon"><KeyRound size={23}/></span>
          <div>
            <strong>{member.name||member.email}</strong>
            <p>{t('Set the sign-in password for this workspace member.')}</p>
          </div>
        </div>
        <div className="form-grid">
          <label className="field form-full">{t('Email address')}<input type="email" value={member.email} readOnly autoComplete="off" dir="ltr"/></label>
          <label className="field form-full">{t('New password')}<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required disabled={busy}/></label>
          <label className="field form-full">{t('Confirm password')}<input name="confirmPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required disabled={busy}/></label>
        </div>
        <p className="export-privacy"><ShieldCheck size={15}/>{t('Use 12 to 128 characters.')}</p>
        {error&&<p className="form-error" role="alert">{t(error)}</p>}
        <div className="modal-actions">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>{t('Cancel')}</Button>
          <Button disabled={busy} type="submit">{busy?<LoaderCircle size={15} className="login-credentials-spinner"/>:<KeyRound size={15}/>} {t(busy?'Saving…':'Save password')}</Button>
        </div>
      </form>
    )}
  </div>;
}
