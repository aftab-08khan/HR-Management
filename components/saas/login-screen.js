'use client';

import { usePreferences } from "@/components/saas/preferences";
import {useRef, useState} from 'react';
import { ArrowRight, ArrowUpRight, Building2, Check, Eye, EyeOff, Heart, KeyRound, LoaderCircle, LockKeyhole, Mail, Moon, ShieldCheck, Sun, UserRound, Users } from 'lucide-react';
import { LanguageSwitcher } from '@/components/saas/preferences';
import { AnimatedCard } from '@/components/ui/spotlight-card';
const roles = [{
  id: 'admin',
  title: 'Administrator',
  email: 'alex@peopleos.co',
  Icon: Building2
}, {
  id: 'hr',
  title: 'HR manager',
  email: 'lana@peopleos.co',
  Icon: Users
}, {
  id: 'employee',
  title: 'Employee',
  email: 'olivia@peopleos.co',
  Icon: UserRound
}];
const DEMO_PASSWORD = 'PeopleOS@2026!';
function GoogleMark() {
  const {
    t
  } = usePreferences();
  return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" /><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.12H3.04v2.59A10 10 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.39 13.92a6 6 0 0 1 0-3.84V7.49H3.04a10 10 0 0 0 0 9.02l3.35-2.59Z" /><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.86-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.96 5.49l3.35 2.59C7.18 7.72 9.39 5.96 12 5.96Z" /></svg>;
}
export function LoginScreen({
  onCredentials,
  onGoogle,
  googleEnabled = false,
  demoEnabled = true,
  credentialsEnabled = false,
  dark = false,
  onToggleTheme,
  loading = false,
  error = ''
}) {
  const {
    t
  } = usePreferences();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const emailInput = useRef(null);
  const submitLock = useRef(false);
  const busy = loading || submitting;
  const canUseCredentials = typeof onCredentials === 'function' && (credentialsEnabled || demoEnabled);
  const visibleError = error || submitError;
  async function submitCredentials(event) {
    event.preventDefault();
    if (busy || submitLock.current || !canUseCredentials) return;
    submitLock.current = true; setSubmitting(true); setSubmitError('');
    try {await onCredentials({email: email.trim().toLowerCase(), password});}
    catch {setSubmitError('Unable to sign in. Check your email and password and try again.');}
    finally {submitLock.current = false; setSubmitting(false);}
  }
  function chooseDemo(role) {
    setEmail(role.email); setPassword(DEMO_PASSWORD); setSelectedDemo(role.id); setShowPassword(false); setSubmitError('');
    emailInput.current?.focus();
  }
  return <div className="saas-login has-credentials">
    <header className="saas-login-header"><a className="saas-login-brand" href="/" aria-label={t("PeopleOS home")}><span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span>people<span>os</span><sup>®</sup></a><div><LanguageSwitcher /><span className="saas-login-header-note">{t("A better day at work starts here.")}</span><button className="saas-login-theme" type="button" onClick={onToggleTheme} aria-label={t(dark ? 'Switch to light mode' : 'Switch to dark mode')} title={t(dark ? 'Switch to light mode' : 'Switch to dark mode')}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button></div></header>
    <div className="saas-login-body">
      <section className="saas-login-story" aria-label={t("PeopleOS workplace platform")}><div className="saas-login-story-top"><span className="saas-pill"><i />{t("THE PEOPLE-FIRST WORKSPACE")}</span><h1>{t("Great work begins")}<br />{t("with")} <em>{t("your people.")}</em></h1><p>{t("One calm, connected space for the people who make your company, your company.")}</p></div>
        <div className="saas-login-art" aria-hidden="true"><div className="saas-art-ring saas-ring-one" /><div className="saas-art-ring saas-ring-two" /><div className="saas-art-ring saas-ring-three" />
          <AnimatedCard className="saas-login-art-card saas-art-main" delay={0.1}><div className="saas-art-card-header"><span className="saas-art-icon"><Users size={18} /></span><span>{t("Good things happen together.")}</span><span className="saas-art-dots">···</span></div><div className="saas-art-people">{['OR', 'PB', 'LS', 'DW', 'DC'].map((name, i) => <span key={name} style={{
                '--person-color': ['#e4c7ae', '#bccfbe', '#ddbdc6', '#e3d79e', '#cbc2de'][i]
              }}>{name}</span>)}<span className="saas-art-person-more">+3</span></div><div className="saas-art-visual"><div><small>{t("YOUR WORKPLACE, IN SYNC")}</small><strong>{t("A little more")}<br />{t("human.")}</strong></div><div className="saas-art-bars">{[40, 64, 54, 82, 72, 98].map((h, i) => <i key={i} style={{
                  height: `${h}%`
                }} />)}</div></div><div className="saas-art-bottom"><span><i />{t("A shared space. A stronger team.")}</span><ArrowUpRight size={14} /></div></AnimatedCard>
          <AnimatedCard className="saas-login-art-card saas-art-floating" delay={0.3}><span className="saas-art-check"><Check size={15} /></span><div><strong>{t("Time off, taken care of.")}</strong><small>{t("A little space to recharge.")}</small></div><span className="saas-art-spark">✦</span></AnimatedCard>
          <span className="saas-art-flower">✳</span><span className="saas-art-dot" />
        </div>
        <div className="saas-login-story-footer"><span><ShieldCheck size={15} />{t("Access shaped around your role")}</span><span><Heart size={15} />{t("Made for better work")}</span></div>
      </section>
      <section className="saas-login-form" aria-labelledby="saas-signin-title"><div className="saas-login-form-inner"><span className="saas-login-form-eyebrow"><span />{t("YOUR PEOPLE. YOUR WORKPLACE.")}</span><h2 id="saas-signin-title">{t("Welcome to your")}<br />{t("workplace.")}</h2><p className="saas-login-intro">{t("Sign in to pick up where your people are.")}</p>
        {visibleError && <div className="saas-login-error" id="credentials-error" role="alert">{t(visibleError)}</div>}
        <button type="button" className="saas-google-button" onClick={onGoogle} disabled={!googleEnabled || busy}><GoogleMark />{t('Continue with Google')}<ArrowRight size={17} /></button>
        <div className="login-credentials-divider"><span/>{t('or sign in with email')}<span/></div>
        <form className="login-credentials-form" onSubmit={submitCredentials} aria-busy={busy} aria-describedby={visibleError ? 'credentials-error' : 'credentials-note'}>
          <label htmlFor="signin-email">{t('Email address')}</label><div className="login-credentials-input"><Mail size={16} aria-hidden="true"/><input ref={emailInput} id="signin-email" name="email" type="email" autoComplete="username" inputMode="email" dir="ltr" spellCheck={false} placeholder="you@company.com" value={email} onChange={event => {setEmail(event.target.value); setSelectedDemo('');}} required disabled={busy}/></div>
          <label htmlFor="signin-password">{t('Password')}</label><div className="login-credentials-input login-password-input"><LockKeyhole size={16} aria-hidden="true"/><input id="signin-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" dir="ltr" placeholder={t('Enter your password')} value={password} onChange={event => {setPassword(event.target.value); setSelectedDemo('');}} required disabled={busy}/><button type="button" className="login-password-visibility" onClick={() => setShowPassword(value => !value)} aria-label={t(showPassword ? 'Hide password' : 'Show password')} aria-pressed={showPassword} title={t(showPassword ? 'Hide password' : 'Show password')} disabled={busy}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
          <button type="submit" className="btn btn-primary login-credentials-submit" disabled={busy || !canUseCredentials}>{busy ? <LoaderCircle size={16} className="login-credentials-spinner"/> : <KeyRound size={16}/>}<span>{t(busy ? 'Signing in…' : 'Sign in')}</span>{!busy && <ArrowRight size={16}/>}</button>
          {busy && <span className="saas-visually-hidden" role="status">{t('Signing in…')}</span>}
        </form>
        <p className="login-credentials-note" id="credentials-note"><ShieldCheck size={12}/>{t(credentialsEnabled ? 'Your account opens the workspace and role assigned to you.' : demoEnabled ? 'Choose a demo account below, then select Sign in.' : 'Email sign-in is not configured for this application.')}</p>
        {demoEnabled && <section className="login-demo-credentials" aria-label={t('Demo credentials')}><div className="login-demo-heading"><span><KeyRound size={14}/>{t('Try a demo account')}</span><small>{t('3 roles. One workspace.')}</small></div><div className="login-demo-password"><span>{t('Demo password')}</span><code dir="ltr">{DEMO_PASSWORD}</code></div><div className="login-demo-accounts">{roles.map(role => <button type="button" className={`login-demo-account ${selectedDemo === role.id ? 'selected' : ''}`} key={role.id} onClick={() => chooseDemo(role)} disabled={busy} aria-label={t('Fill {role} demo credentials', {role: t(role.title)})} aria-pressed={selectedDemo === role.id}><span className={`saas-role-icon saas-role-${role.id}`}><role.Icon size={16}/></span><span><strong>{t(role.title)}</strong><small dir="ltr">{role.email}</small></span><span className="login-demo-fill">{selectedDemo === role.id ? <Check size={14}/> : <ArrowUpRight size={14}/>}</span></button>)}</div><p>{t('Selecting an account fills the form. Sign in to open its demo workspace.')}</p><span className="saas-visually-hidden" role="status">{selectedDemo ? t('Demo credentials filled. Select Sign in to continue.') : ''}</span></section>}
        <div className="saas-login-trust"><ShieldCheck size={15} /><span>{t("Your workspace, with the right access for every person.")}</span></div>
      </div></section>
    </div>
    <footer className="saas-login-footer"><span>© {new Date().getFullYear()}{t("PeopleOS")}</span><span>{t("Made for people. Built for better work.")}<span>✦</span></span></footer>
  </div>;
}
