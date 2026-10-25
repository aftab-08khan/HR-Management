'use client';

import {useEffect, useId, useState} from 'react';
import Link from 'next/link';
import {ArrowLeft, ArrowUpRight, BriefcaseBusiness, Building2, CalendarDays, ChartNoAxesCombined, Check, CheckCheck, Clock3, FileText, Fingerprint, Heart, LockKeyhole, Mail, MapPin, Pencil, QrCode, ShieldCheck, Sparkles, Wallet} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {PhotoUploader} from '@/components/saas/photo-uploader';
import {usePreferences} from '@/components/saas/preferences';
import {recordPath} from '@/lib/navigation';

export {EmployeeProfileSkeleton as ProfileSkeleton} from '@/components/saas/dashboard-skeleton';

const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const safeNumber = value => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : null;
const personalTabs = [{id: 'about', label: 'About', icon: FileText}, {id: 'requests', label: 'Requests', icon: CalendarDays}, {id: 'compensation', label: 'Compensation', icon: Wallet}, {id: 'performance', label: 'Performance', icon: ChartNoAxesCombined}];

/** Filter supplied, already authorized records without fetching or widening their scope. */
function forEmployee(records, employee, workspaceId) {
  return records.filter(record => {
    if (workspaceId && record.workspaceId && record.workspaceId !== workspaceId) return false;
    if (record.employeeId && record.employeeId !== employee.id) return false;
    const recordEmail = normalizeEmail(record.owner || record.email);
    if (recordEmail) return !!normalizeEmail(employee.email) && recordEmail === normalizeEmail(employee.email);
    if (record.employeeId) return true;
    // Older local demo records predate owner IDs and contain an exact employee name.
    return !!employee.name && record.name === employee.name;
  });
}

function leaveDays(record) {
  if (record.status !== 'Approved' || record.type === 'Work from home' || !/^\d{4}-\d{2}-\d{2}$/.test(record.from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(record.to || '')) return 0;
  const difference = (Date.parse(`${record.to}T00:00:00Z`) - Date.parse(`${record.from}T00:00:00Z`)) / 86400000;
  return Number.isFinite(difference) && difference >= 0 ? difference + 1 : 0;
}

function ProfileAvatar({employee, label}) {
  const [settled, setSettled] = useState('');
  const [failed, setFailed] = useState('');
  const source = `${employee.id}:${employee.photoUrl || ''}`;
  const loading = !!employee.photoUrl && source !== settled && source !== failed;
  return <span className="employee-profile-avatar" aria-busy={loading}>
    {employee.photoUrl && source !== failed ? <img src={employee.photoUrl} alt={employee.name} className={loading ? 'is-loading' : ''} onLoad={() => setSettled(source)} onError={() => setFailed(source)}/> : <span>{employee.name?.split(' ').map(part => part[0]).join('').slice(0, 2) || 'HR'}</span>}
    {loading && <span className="employee-profile-avatar-shimmer saas-shimmer" role="status" aria-label={label}/>}
    <i><Check size={12}/></i>
  </span>;
}

function Status({value, t}) {
  const positive = ['Approved', 'Completed', 'Full-time'].includes(value);
  const pending = ['Pending', 'In progress', 'On leave'].includes(value);
  return <span className={`employee-profile-status ${positive ? 'positive-status' : pending ? 'pending-status' : ''}`}><i/>{t(value || 'Not available')}</span>;
}

function EmptySection({icon: Icon, title, text, t}) {
  return <div className="employee-profile-empty"><span><Icon size={26} strokeWidth={1.4}/></span><h3>{t(title)}</h3><p>{t(text)}</p></div>;
}

function Detail({icon: Icon, label, children, t}) {
  return <div className="employee-profile-detail"><span><Icon size={16}/></span><div><dt>{t(label)}</dt><dd>{children || t('Not provided')}</dd></div></div>;
}

export function EmployeeProfile({employee, user, workspaceName, requests = [], reviews = [], compensation = [], counts = {}, onBack, onEdit, onPass, onPhotoUploaded, isDemo}) {
  const {locale, t} = usePreferences();
  const [tab, setTab] = useState('about');
  const tabId = useId();
  useEffect(() => {setTab('about');}, [employee?.id]);
  const manager = ['admin', 'hr'].includes(user?.role);
  const own = !!normalizeEmail(user?.email) && normalizeEmail(user?.email) === normalizeEmail(employee?.email);
  const sameWorkspace = !user?.workspaceId || !employee?.workspaceId || user.workspaceId === employee.workspaceId;
  const allowed = !!employee && sameWorkspace && (manager || (user?.role === 'employee' && own));
  if (!allowed) return <section className="card employee-profile-unavailable"><span><LockKeyhole size={30}/></span><h2>{t('Profile unavailable')}</h2><p>{t('This employee profile is not available with your current workspace access.')}</p><Button variant="outline" onClick={onBack}><ArrowLeft size={15}/>{t('Back to workspace')}</Button></section>;

  const workspaceId = employee.workspaceId || user.workspaceId;
  const requestRows = forEmployee(requests, employee, workspaceId);
  const reviewRows = forEmployee(reviews, employee, workspaceId);
  const compensationRows = forEmployee(compensation, employee, workspaceId);
  const total = (resource, rows) => Math.max(rows.length, Number.isSafeInteger(counts?.[resource]) && counts[resource] >= 0 ? counts[resource] : rows.length);
  const requestCount = total('requests', requestRows);
  const reviewCount = total('reviews', reviewRows);
  const compensationCount = total('compensation', compensationRows);
  const partialRequests = requestCount > requestRows.length;
  const partialReviews = reviewCount > reviewRows.length;
  const partialCompensation = compensationCount > compensationRows.length;
  const pending = requestRows.filter(record => record.status === 'Pending').length;
  const completedReviews = reviewRows.filter(record => record.status === 'Completed');
  const approvedClaims = compensationRows.filter(record => record.status === 'Approved');
  const days = requestRows.reduce((total, record) => total + leaveDays(record), 0);
  const salary = manager || own ? safeNumber(employee.salary) : null;
  const formatter = new Intl.NumberFormat(locale === 'ar' ? 'ar-AE' : 'en-US');
  function money(value, currency = 'USD') {
    const amount = safeNumber(value);
    if (amount === null) return t('Not available');
    try {return new Intl.NumberFormat(locale === 'ar' ? 'ar-AE' : 'en-US', {style: 'currency', currency: /^[A-Z]{3}$/.test(currency) ? currency : 'USD', maximumFractionDigits: 2}).format(amount);} catch {return `${formatter.format(amount)} ${t('USD')}`;}
  }
  function date(value) {
    if (!value) return t('Not provided');
    const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
    return Number.isNaN(parsed.getTime()) ? t('Not provided') : parsed.toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Dubai'});
  }
  const approvedTotals = approvedClaims.reduce((totals, record) => {
    const amount = safeNumber(record.amount);
    if (amount === null) return totals;
    const currency = /^[A-Z]{3}$/.test(record.currency || '') ? record.currency : 'USD';
    return {...totals, [currency]: (totals[currency] || 0) + amount};
  }, {});
  const stats = [
    {icon: CalendarDays, label: 'Time off requests', value: requestCount, note: t(partialRequests ? '{count} awaiting review in loaded records' : '{count} awaiting review', {count: formatter.format(pending)})},
    {icon: Heart, label: 'Approved leave days', value: days, note: t(partialRequests ? 'Across loaded approved leave' : 'Across recorded approved leave')},
    {icon: ChartNoAxesCombined, label: 'Review cycles', value: reviewCount, note: t(partialReviews ? '{count} completed in loaded records' : '{count} completed', {count: formatter.format(completedReviews.length)})},
    {icon: Wallet, label: 'Compensation requests', value: compensationCount, note: t(partialCompensation ? '{count} approved in loaded records' : '{count} approved', {count: formatter.format(approvedClaims.length)})},
  ];
  function recentNotice(rows, count) {
    return count > rows.length ? <p className="employee-profile-recent-note"><Clock3 size={13}/>{t('Showing {loaded} of {total} records, most recent first.', {loaded: formatter.format(rows.length), total: formatter.format(count)})}</p> : null;
  }
  function switchTab(event, index) {
    const step = locale === 'ar' ? -1 : 1;
    let next = index;
    if (event.key === 'ArrowRight') next = (index + step + personalTabs.length) % personalTabs.length;
    else if (event.key === 'ArrowLeft') next = (index - step + personalTabs.length) % personalTabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = personalTabs.length - 1;
    else return;
    event.preventDefault(); setTab(personalTabs[next].id); event.currentTarget.parentElement.children[next]?.focus();
  }
  return <div className="employee-profile-page">
    <div className="employee-profile-topline"><button type="button" className="employee-profile-back" onClick={onBack}><ArrowLeft size={15}/>{t(manager ? 'Back to employees' : 'Back to overview')}</button><span><ShieldCheck size={13}/>{t('Workspace profile')}</span></div>
    <section className="card employee-profile-hero"><div className="employee-profile-hero-accent" aria-hidden="true"/><div className="employee-profile-hero-main"><ProfileAvatar employee={employee} label={t('Loading profile photo…')}/><div className="employee-profile-identity"><span className="employee-profile-kicker">{t('YOUR PEOPLE, AT THE CENTER')}</span><h2>{employee.name}</h2><p>{employee.role || t('Not provided')}<i/>{t(employee.department || 'Unassigned')}</p><div className="employee-profile-identity-meta"><span><MapPin size={12}/>{t(employee.location || 'Not provided')}</span><span><Fingerprint size={12}/><bdi>{employee.employeeCode || t('Not assigned')}</bdi></span></div></div><div className="employee-profile-hero-actions"><Status value={employee.status} t={t}/><div>{onPass && <Button variant="outline" size="sm" onClick={() => onPass(employee)}><QrCode size={14}/>{t('Profile pass')}</Button>}{manager && onEdit && <Button size="sm" onClick={() => onEdit(employee)}><Pencil size={13}/>{t('Edit profile')}</Button>}</div></div></div>{onPhotoUploaded && (manager || own) && <div className="employee-profile-photo-controls"><span><ShieldCheck size={13}/>{t(own ? 'Your profile, your place in the team.' : 'Keep this employee’s profile up to date.')}</span><PhotoUploader employee={employee} isDemo={isDemo} compact onUploaded={onPhotoUploaded}/></div>}</section>
    {(partialRequests || partialReviews || partialCompensation) && <p className="employee-profile-recent-note employee-profile-limit-note"><Clock3 size={14}/>{t("This profile shows up to 100 recent records per section. Record counts include all records; status totals and leave days reflect loaded records only.")}</p>}
    <div className="employee-profile-stats">{stats.map(({icon: Icon, label, value, note}) => <section className="card employee-profile-stat" key={label}><div><span>{t(label)}</span><i><Icon size={16}/></i></div><strong>{formatter.format(value)}</strong><p>{note}</p></section>)}</div>
    <div className="employee-profile-tabs" role="tablist" aria-label={t('Employee profile sections')}>{personalTabs.map(({id, label, icon: Icon}, index) => <button type="button" role="tab" key={id} id={`${tabId}-${id}-tab`} aria-controls={`${tabId}-${id}-panel`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={event => switchTab(event, index)} className={tab === id ? 'selected' : ''}><Icon size={15}/>{t(label)}{id !== 'about' && <span>{formatter.format(id === 'requests' ? requestCount : id === 'compensation' ? compensationCount : reviewCount)}</span>}</button>)}</div>
    <section role="tabpanel" id={`${tabId}-${tab}-panel`} aria-labelledby={`${tabId}-${tab}-tab`} tabIndex={0} className="employee-profile-tab-content">
      {tab === 'about' && <div className="employee-profile-about"><section className="card employee-profile-details-card"><div className="employee-profile-card-heading"><span><BriefcaseBusiness size={19}/></span><div><h3>{t('Employee information')}</h3><p>{t('The details that connect this person to your team.')}</p></div></div><dl className="employee-profile-details-grid"><Detail icon={Fingerprint} label="Employee ID" t={t}><bdi>{employee.employeeCode || t('Not assigned')}</bdi></Detail><Detail icon={Building2} label="Workspace" t={t}>{workspaceName}</Detail><Detail icon={BriefcaseBusiness} label="Job title" t={t}>{employee.role}</Detail><Detail icon={Building2} label="Department" t={t}>{t(employee.department || 'Unassigned')}</Detail><Detail icon={CheckCheck} label="Employment" t={t}>{t(employee.status || 'Not provided')}</Detail><Detail icon={CalendarDays} label="Start date" t={t}>{date(employee.joined)}</Detail><Detail icon={MapPin} label="Location" t={t}>{t(employee.location || 'Not provided')}</Detail><Detail icon={Mail} label="Work email" t={t}>{employee.email && <a href={`mailto:${employee.email}`}><bdi>{employee.email}</bdi><ArrowUpRight size={12}/></a>}</Detail></dl><div className="employee-profile-detail-foot"><LockKeyhole size={13}/>{t('Profile details are visible according to your workspace role.')}</div></section><div className="employee-profile-about-side"><section className="card employee-profile-base-pay"><span><Wallet size={20}/>{t('BASE COMPENSATION')}</span><strong>{salary === null ? t('Not added yet') : money(salary)}</strong><p>{t('Annual base salary (USD)')}</p><div><span>{t('Estimated monthly base')}</span><strong>{salary === null ? t('Not available') : money(salary / 12)}</strong></div><small>{t('Recorded base pay only. Payments and deductions are not calculated here.')}</small></section><section className="card employee-profile-connection"><span><Sparkles size={20}/></span><h3>{t('Every person has a place.')}</h3><p>{t('One profile for the details, requests, and conversations that shape a workday.')}</p><div><Building2 size={13}/>{workspaceName || t('Your workspace')}</div></section></div></div>}
      {tab === 'requests' && <section className="card employee-profile-records"><div className="employee-profile-card-heading"><span><CalendarDays size={19}/></span><div><h3>{t('Time off requests')}</h3><p>{t('Every recorded request, with its current decision.')}</p></div><span className="employee-profile-record-count">{formatter.format(requestCount)}</span></div>{recentNotice(requestRows, requestCount)}{requestRows.length ? <div className="employee-profile-record-list">{requestRows.map(record => <article key={record.id} className="employee-profile-request-row"><span className="employee-profile-row-icon"><CalendarDays size={18}/></span><div className="employee-profile-record-copy"><div><h4><Link href={recordPath('requests', record.id)}>{t(record.type || 'Time off')}<ArrowUpRight size={13}/></Link></h4><Status value={record.status} t={t}/></div><p className="employee-profile-record-date"><CalendarDays size={12}/>{date(record.from)}<span>—</span>{date(record.to)}</p>{record.reason && <p>{record.reason}</p>}</div></article>)}</div> : <EmptySection icon={CalendarDays} title="No time off requests yet" text="Requests linked to this employee will appear here." t={t}/>}</section>}
      {tab === 'compensation' && <><div className="employee-profile-comp-summary"><div><Wallet size={17}/><span>{t(partialCompensation ? 'Approved compensation in loaded records' : 'Approved compensation')}</span><strong>{Object.entries(approvedTotals).length ? Object.entries(approvedTotals).map(([currency, amount]) => money(amount, currency)).join(' · ') : money(0)}</strong></div><p><ShieldCheck size={13}/>{t('Approval records do not initiate payments.')}</p></div><section className="card employee-profile-records"><div className="employee-profile-card-heading"><span><Wallet size={19}/></span><div><h3>{t('Compensation requests')}</h3><p>{t('Reimbursements, benefits, and salary adjustment requests.')}</p></div><span className="employee-profile-record-count">{formatter.format(compensationCount)}</span></div>{recentNotice(compensationRows, compensationCount)}{compensationRows.length ? <div className="employee-profile-record-list">{compensationRows.map(record => <article key={record.id} className="employee-profile-comp-row"><span className="employee-profile-row-icon"><Wallet size={18}/></span><div className="employee-profile-record-copy"><div><h4><Link href={recordPath('compensation', record.id)}>{t(record.type || 'Compensation')}<ArrowUpRight size={13}/></Link></h4><Status value={record.status} t={t}/></div><p className="employee-profile-record-date"><Clock3 size={12}/>{t('Submitted')}: {date(record.submittedAt)}</p>{record.reason && <p>{record.reason}</p>}{record.reviewNote && <div className="employee-profile-review-note"><ShieldCheck size={13}/><span><strong>{t('Review note')}</strong>{record.reviewNote}</span></div>}</div><strong className="employee-profile-request-amount">{money(record.amount, record.currency || 'USD')}</strong></article>)}</div> : <EmptySection icon={Wallet} title="No compensation requests yet" text="Requests linked to this employee will appear here." t={t}/>}</section></>}
      {tab === 'performance' && <section className="card employee-profile-records"><div className="employee-profile-card-heading"><span><ChartNoAxesCombined size={19}/></span><div><h3>{t('Performance reviews')}</h3><p>{t('A clear view of recorded review cycles and ratings.')}</p></div><span className="employee-profile-record-count">{formatter.format(reviewCount)}</span></div>{recentNotice(reviewRows, reviewCount)}{reviewRows.length ? <div className="employee-profile-review-grid">{reviewRows.map(record => {const score = safeNumber(record.score);const validScore = score !== null && score >= 0 && score <= 5; return <article key={record.id} className="employee-profile-review-card"><div><span><ChartNoAxesCombined size={18}/></span><Status value={record.status} t={t}/></div><h4><Link href={recordPath('reviews', record.id)}>{record.cycle || t('Review cycle')}<ArrowUpRight size={13}/></Link></h4><p>{t('Recorded rating')}</p><strong>{validScore ? formatter.format(score) : '—'}<small> / {formatter.format(5)}</small></strong><div className="employee-profile-rating-track" role="img" aria-label={validScore ? t('{score} out of 5', {score: formatter.format(score)}) : t('No rating recorded')}><span style={{width: `${validScore ? score / 5 * 100 : 0}%`}}/></div><span className="employee-profile-review-foot"><ShieldCheck size={12}/>{t('Maintained by your HR team')}</span></article>;})}</div> : <EmptySection icon={ChartNoAxesCombined} title="No performance reviews yet" text="Review cycles linked to this employee will appear here." t={t}/>}</section>}
    </section>
  </div>;
}
