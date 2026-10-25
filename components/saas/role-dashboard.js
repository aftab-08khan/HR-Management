'use client';

import { usePreferences } from "@/components/saas/preferences";
import { intlLocale } from "@/lib/i18n";
import { ArrowRight, ArrowUpRight, CalendarDays, Check, FileText, Heart, Wallet } from 'lucide-react';
import { AnimatedCard } from '@/components/ui/spotlight-card';
import { Button } from '@/components/ui/button';
import {BarChart,Bar,Tooltip,XAxis,YAxis} from 'recharts';
import {DataChartContainer,DataChartTooltip,stableTooltipProps} from '@/components/ui/data-chart';
const normalized = value => String(value || '').trim().toLowerCase();
function belongsTo(record, user) {
  return Boolean(record.employeeId && [user.employeeId, user.id].filter(Boolean).includes(record.employeeId) || record.owner && normalized(record.owner) === normalized(user.email) || record.email && normalized(record.email) === normalized(user.email) || record.name && normalized(record.name) === normalized(user.name));
}
function calendarDays(request) {
  const start = Date.parse(`${request.from}T00:00:00Z`);
  const end = Date.parse(`${request.to}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.round((end - start) / 86400000) + 1) : 0;
}
const formatMoney = (value, currency = 'USD',locale='en') => new Intl.NumberFormat(intlLocale(locale), {
  style: 'currency',
  currency,
  maximumFractionDigits: 0
}).format(value);
const shortDate = (value,locale='en') => value ? new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString(intlLocale(locale), {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC'
}) : '—';
export function RoleDashboard({
  user = {},
  data = {},
  onNavigate,
  onRequest
}) {
  const {
    t, locale
  } = usePreferences();
  const employee = (data.employees || []).find(record => belongsTo(record, user));
  const requests = (data.requests || []).filter(record => belongsTo(record, user));
  const compensation = (data.compensation || []).filter(record => belongsTo(record, user));
  const approvedDays = requests.filter(record => record.status === 'Approved' && record.type !== 'Work from home').reduce((sum, record) => sum + calendarDays(record), 0);
  const pending = requests.filter(record => record.status === 'Pending').length;
  const salary = employee?.salary;
  const currency = employee?.currency || 'USD';
  const requestStatuses = [{
    name: 'Approved',
    color: '#7da58a'
  }, {
    name: 'Pending',
    color: '#d3b77e'
  }, {
    name: 'Declined',
    color: '#c59696'
  }].map(item => ({
    ...item,
    count: requests.filter(r => r.status === item.name || item.name === 'Declined' && r.status === 'Rejected').length
  }));
  const requestTotal = requestStatuses.reduce((sum, item) => sum + item.count, 0);
  const requestChartRows=[{name:t('Your time off'),...Object.fromEntries(requestStatuses.map(status=>[status.name,status.count])),tooltip:{title:t('Your time off'),value:t('{count} requests',{count:requestTotal}),description:requestStatuses.map(status=>`${t(status.name)}: ${status.count}`).join(' · ')},tooltipByKey:Object.fromEntries(requestStatuses.map(status=>[status.name,{title:t('{status} time off',{status:t(status.name)}),value:t(status.count===1?'{count} request':'{count} requests',{count:status.count}),description:t('{percent}% of your time off requests',{percent:Math.round(status.count/(requestTotal||1)*100)})}]))}];
  const metrics = [{
    label: 'Annual base pay',
    value: salary === undefined ? '—' : formatMoney(Number(salary), currency,locale),
    hint: salary === undefined ? 'Your HR team can add your pay details' : t('{currency} · Your current base salary',{currency}),
    Icon: Wallet,
    color: 'peach'
  }, {
    label: 'Approved time off',
    value: approvedDays,
    hint: 'Calendar days across approved leave',
    Icon: CalendarDays,
    color: 'green'
  }, {
    label: 'Compensation requests',
    value: compensation.length,
    hint: 'Your reimbursements and benefit claims',
    Icon: Wallet,
    color: 'blue'
  }, {
    label: 'Requests in progress',
    value: pending,
    hint: 'Waiting for your HR team to review',
    Icon: FileText,
    color: 'purple'
  }];
  return <div className="saas-personal-dashboard">
    <section className="saas-personal-welcome"><div><span className="saas-pill"><Heart size={12} />{t("YOUR SPACE TO DO GREAT WORK")}</span><h2>{t("A good day starts")}<br />{t("with a little clarity.")}</h2><p>{t("Your time, your growth, and everything in between.")}<br />{t("Take care of your workday, all in one place.")}</p><Button onClick={onRequest}><CalendarDays size={14} />{t("Request time off")}<ArrowRight size={14} /></Button></div><div className="saas-personal-visual" aria-hidden="true"><div className="saas-personal-orbit" /><div className="saas-personal-orbit saas-personal-orbit-two" /><span className="saas-personal-flower">✳</span><span className="saas-personal-tile"><Heart size={29} /></span><div className="saas-personal-floating"><span><Check size={14} /></span><div><strong>{t("More balance. Better days.")}</strong><small>{t("Your people team is here for you.")}</small></div></div></div></section>
    <div className="stats-grid saas-personal-metrics">{metrics.map(({
        label,
        value,
        hint,
        Icon,
        color
      }, index) => <AnimatedCard className="stat-card" delay={index * .04} key={label}><div className="stat-top"><span>{t(label)}</span><span className={`stat-icon ${color}`}><Icon size={16} /></span></div><div className="stat-value"><span>{value}</span></div><p>{t(hint)}</p></AnimatedCard>)}</div>
    <div className="saas-personal-grid"><AnimatedCard className="saas-personal-requests"><div className="card-heading"><div><h3>{t("Your time off")}</h3><p>{t("A little space to recharge, with every request in view.")}</p></div><button className="text-link" onClick={() => onNavigate?.('Time off')}>{t("View all")}<ArrowUpRight size={13} /></button></div><div className="saas-request-summary data-timeoff-chart"><DataChartContainer height={68} label={t('Your time off')}><BarChart data={requestChartRows} layout="vertical" margin={{top:12,right:0,bottom:12,left:0}} accessibilityLayer><XAxis type="number" hide domain={[0,Math.max(requestTotal,1)]}/><YAxis type="category" dataKey="name" hide/><Tooltip shared={false} content={<DataChartTooltip/>} {...stableTooltipProps}/>{requestStatuses.map(status=><Bar key={status.name} dataKey={status.name} name={t(status.name)} stackId="requests" fill={status.color} barSize={17} radius={3} isAnimationActive={false}/>)}</BarChart></DataChartContainer><div className="data-timeoff-legend">{requestStatuses.map(status=><span key={status.name}><i style={{background:status.color}}/>{t(status.name)}<strong>{status.count}</strong></span>)}</div></div><div className="saas-personal-request-list">{requests.length ? requests.slice().sort((a, b) => String(b.from).localeCompare(String(a.from))).slice(0, 3).map(request => <div className="saas-personal-request" key={request.id}><span className="saas-request-date"><strong>{request.from?.slice(8, 10) || '—'}</strong><small>{request.from ? new Date(`${request.from}T12:00:00Z`).toLocaleDateString(intlLocale(locale), {
                  month: 'short',
                  timeZone: 'UTC'
                }) : ''}</small></span><div><strong>{t(request.type)}</strong><p>{shortDate(request.from,locale)} – {shortDate(request.to,locale)} <span>· {t(calendarDays(request)===1?'{count} calendar day':'{count} calendar days',{count:calendarDays(request)})}</span></p></div><span className={`badge ${request.status === 'Approved' ? 'positive' : request.status === 'Pending' ? 'warning' : 'neutral'}`}>{t(request.status)}</span></div>) : <div className="saas-personal-empty"><CalendarDays size={24} /><strong>{t("Your next break starts here.")}</strong><p>{t("Create a request when you need a little time away.")}</p><button onClick={onRequest}>{t("Request time off")}<ArrowRight size={13} /></button></div>}</div></AnimatedCard>
      <AnimatedCard className="saas-personal-pay" delay={.08}><div className="card-heading"><div><h3>{t("Your compensation")}</h3><p>{t("A clear view of your current base pay.")}</p></div><Wallet size={18} /></div><div className="saas-personal-pay-number"><span>{t("ESTIMATED MONTHLY BASE")}</span><strong>{salary === undefined ? t('Not available') : formatMoney(Math.round(Number(salary) / 12), currency,locale)}</strong><small>{salary === undefined ? t('Contact your HR team to link your employee profile.') : t('{currency} / month · Before deductions',{currency})}</small></div><div className="saas-personal-pay-details"><div><span>{t("Annual base salary")}</span><strong>{salary === undefined ? '—' : formatMoney(Number(salary), currency,locale)}</strong></div><div><span>{t("Compensation requests")}</span><strong>{compensation.length}</strong></div><div><span>{t("Employment")}</span><strong>{t(employee?.status || 'Profile pending')}</strong></div></div><button className="saas-personal-card-link" onClick={() => onNavigate?.('Compensation')}>{t("View your compensation")}<ArrowRight size={13} /></button></AnimatedCard></div>
    <div className="saas-personal-grid saas-personal-lower"><AnimatedCard className="saas-personal-claims" delay={.1}><div className="card-heading"><div><h3>{t("Your compensation requests")}</h3><p>{t("Your reimbursements and benefits, with every update in view.")}</p></div><button className="text-link" onClick={() => onNavigate?.('Compensation')}>{t("View all")}<ArrowUpRight size={13} /></button></div><div className="saas-personal-request-list">{compensation.length ? compensation.slice().sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt))).slice(0, 3).map(record => <div className="saas-personal-request" key={record.id}><span className="saas-claim-icon"><Wallet size={17} /></span><div><strong>{t(record.type)}</strong><p>{shortDate(record.submittedAt,locale)} · {formatMoney(Number(record.amount || 0), record.currency || 'USD',locale)}</p></div><span className={`badge ${record.status === 'Approved' ? 'positive' : record.status === 'Pending' ? 'warning' : 'neutral'}`}>{t(record.status)}</span></div>) : <div className="saas-personal-empty"><Wallet size={24} /><strong>{t("A little support, when you need it.")}</strong><p>{t("Submit a reimbursement or benefit claim to your HR team.")}</p><button onClick={() => onNavigate?.('Compensation')}>{t("Open compensation")}<ArrowRight size={13} /></button></div>}</div></AnimatedCard><AnimatedCard className="saas-personal-profile" delay={.15}><span className="saas-insight-eyebrow">{t("YOUR PLACE IN THE TEAM")}</span><div className="saas-personal-profile-top"><span>{employee?.photoUrl ? <img src={employee.photoUrl} alt={t('{name} profile photo',{name:user.name})} /> : (user.name || 'Team member').split(' ').map(word => word[0]).slice(0, 2).join('')}</span><div><h3>{user.name || t('Team member')}</h3><p>{employee?.role || t('Your employee workspace')}</p></div></div><div className="saas-personal-profile-lines"><span><small>{t("Department")}</small><strong>{t(employee?.department || 'Not assigned')}</strong></span><span><small>{t("Location")}</small><strong>{t(employee?.location || 'Not assigned')}</strong></span><span><small>{t("Workspace")}</small><strong>{user.workspaceName || t('Your organization')}</strong></span></div></AnimatedCard></div>
  </div>;
}
