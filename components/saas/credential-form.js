'use client';

import {useRef,useState} from 'react';
import {KeyRound,ShieldCheck,LoaderCircle} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {usePreferences} from '@/components/saas/preferences';

export function CredentialForm({member,onSaved,onCancel}){
  const {t}=usePreferences();
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const pending=useRef(false);
  async function submit(event){
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
  return <form onSubmit={submit} className="credential-setup-form" aria-busy={busy}><div className="export-summary"><span className="form-icon"><KeyRound size={23}/></span><div><strong>{member.name||member.email}</strong><p>{t('Set the sign-in password for this workspace member.')}</p></div></div><div className="form-grid"><label className="field form-full">{t('Email address')}<input type="email" value={member.email} readOnly autoComplete="off" dir="ltr"/></label><label className="field form-full">{t('New password')}<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required disabled={busy}/></label><label className="field form-full">{t('Confirm password')}<input name="confirmPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required disabled={busy}/></label></div><p className="export-privacy"><ShieldCheck size={15}/>{t('Use 12 to 128 characters.')}</p>{error&&<p className="form-error" role="alert">{t(error)}</p>}<div className="modal-actions"><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>{t('Cancel')}</Button><Button disabled={busy} type="submit">{busy?<LoaderCircle size={15} className="login-credentials-spinner"/>:<KeyRound size={15}/>} {t(busy?'Saving…':'Save password')}</Button></div></form>;
}
