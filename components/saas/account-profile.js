'use client';

import {useState} from 'react';
import {ArrowLeft,ArrowRight,Building2,Check,ChevronRight,Globe,Hash,LockKeyhole,Mail,Palette,Settings,ShieldCheck,UserRound} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {usePreferences} from '@/components/saas/preferences';
import {ShimmerBlock} from '@/components/saas/dashboard-skeleton';
import {roleNames} from '@/lib/demo';

const permissions={
  admin:['Manage workspace members and roles','Manage employee and HR records','Review requests and compliance checks'],
  hr:['Manage employee and HR records','Review time off and compensation requests','Maintain compliance checks and announcements'],
  employee:['View your personal dashboard and records','Submit time off and compensation requests','Read workspace announcements'],
};

function AccountAvatar({user,t}){
  const [loaded,setLoaded]=useState(''),[failed,setFailed]=useState('');
  const source=typeof user.image==='string'?user.image:'';
  const initials=(user.name||user.email||'HR').split(' ').map(word=>word[0]).join('').slice(0,2).toUpperCase();
  const loading=!!source&&loaded!==source&&failed!==source;
  return <span className="account-profile-avatar" aria-busy={loading}>{source&&failed!==source?<img src={source} alt={t('{name} profile photo',{name:user.name||t('Your account')})} className={loading?'is-loading':''} onLoad={()=>setLoaded(source)} onError={()=>setFailed(source)}/>:<span>{initials}</span>}{loading&&<ShimmerBlock width="100%" height="100%" className="account-profile-avatar-shimmer"/>}<i><Check size={12}/></i></span>;
}

export function AccountProfile({user={},workspaceName,onSettings,onBack}){
  const {t}=usePreferences();
  const role=roleNames[user.role]||'Workspace member';
  const workspace=workspaceName||user.workspaceName||t('Not assigned');
  const fields=[{label:'Full name',value:user.name,Icon:UserRound},{label:'Email address',value:user.email,Icon:Mail,ltr:true},{label:'Member ID',value:user.memberCode,Icon:Hash,ltr:true},{label:'Workspace',value:workspace,Icon:Building2},{label:'Workspace role',value:t(role),Icon:ShieldCheck}];
  return <div className="account-profile-page"><div className="account-profile-topline"><button className="account-profile-back" type="button" onClick={onBack}><ArrowLeft size={15}/>{t('Back to overview')}</button><span><ShieldCheck size={13}/>{t('Workspace account')}</span></div>
    <section className="card account-profile-hero"><AccountAvatar user={user} t={t}/><div className="account-profile-identity"><span className="eyebrow">{t('YOUR ACCOUNT')}</span><h2>{user.name||t('Your account')}</h2><p>{user.email?<><Mail size={13}/><bdi>{user.email}</bdi></>:t('Not provided')}</p><div><span className="permission-pill"><ShieldCheck size={12}/>{t(role)}</span><span><Building2 size={12}/>{workspace}</span></div></div>{onSettings&&<Button variant="outline" onClick={onSettings}><Settings size={14}/>{t('Settings')}<ChevronRight size={14}/></Button>}</section>
    <div className="account-profile-grid"><section className="card account-profile-information"><div className="account-profile-card-heading"><span><UserRound size={19}/></span><div><h3>{t('Account information')}</h3><p>{t('Your identity and access, in one place.')}</p></div></div><dl className="account-profile-fields">{fields.map(({label,value,Icon,ltr})=><div key={label}><Icon size={16}/><div><dt>{t(label)}</dt><dd>{ltr?<bdi>{value||t('Not provided')}</bdi>:value||t('Not provided')}</dd></div></div>)}</dl><div className="account-profile-note"><LockKeyhole size={13}/><span>{t('Workspace access is controlled by your role.')}</span></div></section>
      <aside className="account-profile-side"><section className="card account-profile-permissions"><div className="account-profile-card-heading"><span><ShieldCheck size={19}/></span><div><h3>{t('Your permissions')}</h3><p>{t(role)}</p></div></div>{permissions[user.role]?.length?<ul>{permissions[user.role].map(permission=><li key={permission}><Check size={14}/><span>{t(permission)}</span></li>)}</ul>:<p className="account-profile-permission-empty">{t('No permissions are assigned to this account.')}</p>}</section><section className="card account-profile-preferences"><span><Palette size={21}/></span><h3>{t('Personalize your workspace')}</h3><p>{t('Choose your language, fonts, and colors in Settings.')}</p>{onSettings&&<button onClick={onSettings}><Globe size={14}/>{t('Open workspace settings')}<ArrowRight size={14}/></button>}</section></aside>
    </div>
  </div>;
}

export function AccountProfileSkeleton(){
  const {t}=usePreferences();
  return <div className="layout-skeleton account-profile-skeleton" role="status" aria-busy="true" aria-label={t('Loading your workspace')}><span className="saas-visually-hidden">{t('Loading your workspace…')}</span><div aria-hidden="true"><div className="account-profile-topline"><ShimmerBlock width={145} height={11}/><ShimmerBlock width={112} height={11}/></div><div className="card account-profile-hero"><ShimmerBlock width={96} height={99} className="account-profile-skeleton-avatar"/><div className="account-profile-identity"><ShimmerBlock width={98} height={9}/><ShimmerBlock width={214} height={28}/><ShimmerBlock width={228} height={12}/><div><ShimmerBlock width={108} height={26}/><ShimmerBlock width={115} height={12}/></div></div><ShimmerBlock width={116} height={35}/></div><div className="account-profile-grid"><div className="card account-profile-information"><div className="account-profile-card-heading"><ShimmerBlock width={37} height={37}/><div><ShimmerBlock width={152} height={15}/><ShimmerBlock width={224} height={10}/></div></div><div className="account-profile-fields">{[0,1,2,3,4].map(index=><div key={index}><ShimmerBlock width={16} height={16}/><div><ShimmerBlock width={95} height={9}/><ShimmerBlock width={index%2?150:122} height={13}/></div></div>)}</div><div className="account-profile-note"><ShimmerBlock width="80%" height={9}/></div></div><div className="account-profile-side"><div className="card account-profile-permissions"><div className="account-profile-card-heading"><ShimmerBlock width={37} height={37}/><div><ShimmerBlock width={145} height={14}/><ShimmerBlock width={105} height={9}/></div></div><div className="account-profile-skeleton-permissions">{[0,1,2].map(index=><div key={index}><ShimmerBlock width={14} height={14} circle/><ShimmerBlock width="87%" height={11}/></div>)}</div></div><div className="card account-profile-preferences"><ShimmerBlock width={42} height={42} circle/><ShimmerBlock width="80%" height={18}/><ShimmerBlock width="100%" height={11}/><ShimmerBlock width="77%" height={11}/><ShimmerBlock width={160} height={12}/></div></div></div></div></div>;
}
