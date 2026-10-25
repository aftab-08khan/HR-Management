'use client';

import Link from 'next/link';
import {ArrowLeft,ArrowUpRight,CalendarDays,FileText,ShieldCheck,Pencil,Wallet,BriefcaseBusiness,Users,CheckCircle2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {usePreferences} from '@/components/saas/preferences';
import {intlLocale} from '@/lib/i18n';
import {PAGE_PATHS,RESOURCE_PAGES,profilePath} from '@/lib/navigation';

const fields={requests:[['Employee','name'],['Request type','type'],['From','from'],['To','to'],['Status','status']],jobs:[['Department','department'],['Location','location'],['Employment type','type'],['Position status','status'],['Applicants','applicants']],reviews:[['Employee','name'],['Review cycle','cycle'],['Rating / 5','score'],['Status','status']],announcements:[['Category','category'],['Date','date']],compliance:[['Category','category'],['Responsible person','owner'],['Due date','dueDate'],['Priority','priority'],['Review status','status']],compensation:[['Employee','name'],['Request type','type'],['Amount (USD)','amount'],['Status','status'],['Submitted','submittedAt']],memberships:[['Full name','name'],['Email address','email'],['Member ID','memberCode'],['Workspace role','role'],['Access status','status']]};
const dateFields=new Set(['from','to','dueDate','submittedAt','createdAt','updatedAt']);

export function RecordDetails({resource,record,user,employees=[],onEdit,onBack,onSetPassword}){
  const {t,locale}=usePreferences();
  const parent=RESOURCE_PAGES[resource];
  if(!record)return <DetailNotFound onBack={onBack}/>;
  const manager=['admin','hr'].includes(user?.role);
  const canEdit=resource==='memberships'?user?.role==='admin':manager||(['requests','compensation'].includes(resource)&&record.status==='Pending');
  const person=employees.find(employee=>record.owner?employee.email?.toLowerCase()===record.owner.toLowerCase():record.email?employee.email?.toLowerCase()===record.email.toLowerCase():employee.name===record.name);
  const title=record.title||(resource==='memberships'?record.name||record.email:resource==='reviews'?record.cycle:record.type)||t('Record details');
  const Icon=resource==='jobs'?BriefcaseBusiness:resource==='compensation'?Wallet:resource==='memberships'?Users:resource==='compliance'?ShieldCheck:FileText;
  const format=(value,key)=>{
    if(value===undefined||value===null||value==='')return '—';
    if(key==='amount')return new Intl.NumberFormat(intlLocale(locale),{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(value)||0);
    if(dateFields.has(key)){const date=new Date(String(value).length===10?`${value}T12:00:00Z`:value);if(Number.isFinite(date.getTime()))return date.toLocaleDateString(intlLocale(locale),{month:'short',day:'numeric',year:'numeric',timeZone:'Asia/Dubai'});}
    if(typeof value==='number')return new Intl.NumberFormat(intlLocale(locale)).format(value);
    return t(value);
  };
  const narrative=resource==='announcements'?record.body:resource==='compliance'?record.description:record.reason;
  const timeline=[['Created',record.createdAt||record.submittedAt],['Last updated',record.updatedAt],['Decision recorded',record.reviewedAt]].filter(([,value])=>value);
  return <div className="record-details-page"><button className="record-back" onClick={onBack}><ArrowLeft size={15}/>{t('Back to {page}',{page:t(parent)})}</button><section className="card record-hero"><span className="record-hero-icon"><Icon size={27}/></span><div><span className="eyebrow">{t(parent)}</span><h2>{t(title)}</h2><p>{record.name||record.department||t('Your workspace')}</p></div><div className="record-hero-actions">{record.status&&<span className={`workflow-status status-${record.status.toLowerCase().replaceAll(' ','-')}`}>{t(record.status)}</span>}{resource==='memberships'&&user?.role==='admin'&&record.status==='Active'&&onSetPassword&&<Button variant="outline" onClick={()=>onSetPassword(record)}><ShieldCheck size={14}/>{t('Set sign-in password')}</Button>}{canEdit&&onEdit&&<Button variant="outline" onClick={()=>onEdit(record)}><Pencil size={14}/>{t('Edit details')}</Button>}</div></section><div className="record-details-grid"><div className="record-detail-stack"><section className="card"><div className="card-heading"><div><h3>{t('Record details')}</h3><p>{t('The information behind this record.')}</p></div><FileText size={18}/></div><dl className="record-fields">{(fields[resource]||[]).map(([label,key])=><div key={key}><dt>{t(label)}</dt><dd dir={['email','memberCode'].includes(key)?'ltr':undefined}>{format(record[key],key)}</dd></div>)}</dl></section><section className="card"><div className="card-heading"><h3>{t(resource==='announcements'?'Message':resource==='compliance'?'Description':'Supporting details')}</h3></div><div className="record-narrative"><p>{narrative||t('No additional details have been added.')}</p>{record.reviewNote&&<div><h4>{t('Review note')}</h4><p>{record.reviewNote}</p></div>}</div></section></div><aside className="record-detail-stack">{person&&<section className="card"><div className="card-heading"><h3>{t('Employee profile')}</h3><Users size={17}/></div><Link href={profilePath(person.id)} className="record-person"><span>{person.photoUrl?<img src={person.photoUrl} alt={person.name}/>:person.name?.split(' ').map(word=>word[0]).join('').slice(0,2)}</span><div><strong>{person.name}</strong><small>{t(person.role)}</small><small>{person.employeeCode}</small></div><ArrowUpRight size={17}/></Link></section>}<section className="card"><div className="card-heading"><h3>{t('Record activity')}</h3><CalendarDays size={17}/></div><div className="record-timeline">{timeline.length?timeline.map(([label,date])=><div key={label}><i/><span><strong>{t(label)}</strong><small>{format(date,'createdAt')}</small></span></div>):<p>{t('No timestamps were recorded for this item.')}</p>}</div></section><div className="record-access-note"><ShieldCheck size={16}/><p>{t('Visible only to the people with access to this workspace record.')}</p></div>{resource==='compensation'&&<div className="record-access-note"><CheckCircle2 size={16}/><p>{t('Amounts in USD · approval does not initiate payment.')}</p></div>}</aside></div></div>;
}

export function DetailNotFound({onBack}){const {t}=usePreferences();return <section className="card detail-not-found"><FileText size={32}/><h2>{t('Record not available')}</h2><p>{t('This record may have been removed or is outside your workspace access.')}</p><Button variant="outline" onClick={onBack}><ArrowLeft size={14}/>{t('Back to workspace')}</Button></section>}
