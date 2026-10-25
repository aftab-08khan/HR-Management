'use client';

import { usePreferences } from "@/components/saas/preferences";
import { useState } from 'react';
import { Building2, ShieldCheck, ArrowRight, LogOut, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function WorkspaceSetup({
  user,
  onCreate,
  onLogout,
  error = ''
}) {
  const {
    t
  } = usePreferences();
  const [name, setName] = useState(''),
    [busy, setBusy] = useState(false),
    [problem, setProblem] = useState('');
  return <div className="workspace-setup"><section className="card"><span className="workspace-large-icon"><Building2 size={28} /></span><span className="eyebrow">{t("A NEW CHAPTER FOR YOUR PEOPLE")}</span><h1>{t(user?.verifiedGoogle ? 'Make room for your team.' : 'Your workspace needs a little attention.')}</h1><p>{t(user?.verifiedGoogle ? 'Create your organization’s workspace. You’ll be its first administrator, ready to invite your people.' : 'Your account does not currently have an active workspace role. Contact your administrator to restore access.')}</p><div className="setup-identity"><ShieldCheck size={16} />{user?.email}</div>{(error || problem) && <div className="setup-error" role="alert">{problem || error}</div>}{user?.verifiedGoogle && <form onSubmit={async e => {
        e.preventDefault();
        setBusy(true);
        setProblem('');
        try {
          await onCreate(name);
        } catch (e) {
          setProblem(e.message);
        } finally {
          setBusy(false);
        }
      }}><label className="field">{t("Organization name")}<input value={name} onChange={e => setName(e.target.value)} placeholder={t("e.g. Acme Studio")} required minLength={2} maxLength={80} /></label><Button type="submit" disabled={busy}>{t(busy ? 'Creating your workspace…' : 'Create workspace')}<ArrowRight size={15} /></Button></form>}<p className="setup-note"><LockKeyhole size={13} />{t("Your team\u2019s records stay scoped to this organization.")}</p><button className="text-link" onClick={onLogout}><LogOut size={13} />{t("Sign out")}</button></section></div>;
}
