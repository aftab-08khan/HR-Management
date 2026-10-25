'use client';

import { usePreferences } from "@/components/saas/preferences";
import { useState } from 'react';
import { ShieldCheck, Wallet, Check, ArrowUpRight, Plus, Download, Clock3, FileText, Users, Building2, LockKeyhole, MoreHorizontal, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { roleNames } from '@/lib/demo';
import { CompletionChart } from '@/components/ui/data-chart';
export function CompliancePanel({
  records,
  onEdit,
  onAdd,
  onExport
}) {
  const {
    t
  } = usePreferences();
  const [filter, setFilter] = useState('All checks');
  const done = records.filter(r => r.status === 'Complete').length;
  const shown = filter === 'All checks' ? records : records.filter(r => r.status === filter);
  return <><div className="workflow-hero peopleos-chart-tooltip-host"><div><span className="eyebrow">{t("A HEALTHIER WORKPLACE STARTS HERE")}</span><h2>{t("Clarity. Confidence. Care.")}</h2><p>{t("Keep important reviews visible, accountable, and on schedule.")}</p><div className="workflow-tags"><span><ShieldCheck size={13} />{t("Internal review tracker")}</span><span><LockKeyhole size={13} />{t("HR & administrators")}</span></div></div><CompletionChart complete={done} total={records.length} label={t('Compliance checklist')} /></div><div className="workflow-summary"><span><i className="summary-dot green" />{done}{t("complete")}</span><span><i className="summary-dot yellow" />{records.filter(r => r.status === 'In progress').length}{t("in progress")}</span><span><i className="summary-dot peach" />{records.filter(r => r.status === 'Action needed').length}{t("need attention")}</span><Button variant="outline" size="sm" onClick={onExport}><Download size={14} />{t("Export checks")}</Button></div><section className="card"><div className="card-heading"><div><h3>{t("Compliance checklist")}</h3><p>{t("Operational records maintained by your team.")}</p></div><select className="mini-select" aria-label={t("Filter compliance checks")} value={filter} onChange={e => setFilter(e.target.value)}>{['All checks', 'Complete', 'In progress', 'Action needed'].map(v => <option key={v} value={v}>{t(v)}</option>)}</select></div><div className="compliance-list">{shown.map(r => <button className="compliance-item" key={r.id} onClick={() => onEdit(r)}><span className={`check-tile ${r.status === 'Complete' ? 'complete' : ''}`}>{r.status === 'Complete' ? <Check size={18} /> : <FileText size={18} />}</span><span className="check-details"><strong>{r.title}</strong><small>{t(r.category)} <i>·</i> {r.owner}</small></span><span className={`workflow-status status-${r.status.toLowerCase().replaceAll(' ', '-')}`}>{t(r.status)}</span><span className="check-due">{t("Due")}{r.dueDate}</span><ArrowUpRight size={16} /></button>)}{!shown.length && <div className="empty">{t("No checks in this view.")}</div>}</div><button className="card-bottom-link" onClick={onAdd}><Plus size={14} />{t("Add a compliance check")}</button></section><p className="footnote">{t("These are internal checks, not a legal certification. Your team defines the requirements applicable to its jurisdiction.")}</p></>;
}
export function CompensationPanel({
  records,
  employees,
  user,
  onEdit,
  onAdd,
  onExport
}) {
  const {
    t
  } = usePreferences();
  const [filter, setFilter] = useState('All requests');
  const canManage = user.role !== 'employee';
  const total = records.reduce((s, r) => s + Number(r.amount || 0), 0);
  const approved = records.filter(r => r.status === 'Approved').reduce((s, r) => s + Number(r.amount || 0), 0);
  const shown = filter === 'All requests' ? records : records.filter(r => r.status === filter);
  const mine = employees.find(e => e.email === user.email);
  return <><div className="workflow-hero compensation-hero"><div><span className="eyebrow">{t("RECOGNITION, WITH TRANSPARENCY")}</span><h2>{t(canManage ? 'Every request, a clear next step.' : 'Your compensation. Clearly.')}</h2><p>{t(canManage ? 'Review requests, record decisions, and keep your people informed.' : 'Review your base pay and track reimbursements and benefit claims.')}</p><Button onClick={onAdd}><Plus size={15} />{t("New compensation request")}</Button></div><div className="compensation-highlight"><Wallet size={22} /><span>{t(canManage ? 'Total requested (USD)' : 'Annual base salary (USD)')}</span><strong>${Number(canManage ? total : mine?.salary || 0).toLocaleString()}</strong><small>{t(canManage ? `${records.length} requests in this workspace` : mine ? 'From your employee profile' : 'A base salary has not been added yet')}</small></div></div><div className="workflow-summary"><span><Clock3 size={14} />{records.filter(r => r.status === 'Pending').length}{t("awaiting review")}</span><span><Check size={14} />${approved.toLocaleString()}{t("approved")}</span><span><ShieldCheck size={14} />{t("Decisions are recorded")}</span><Button variant="outline" size="sm" onClick={onExport}><Download size={14} />{t("Download records")}</Button></div><section className="card"><div className="card-heading"><div><h3>{t(canManage ? 'Compensation requests' : 'My requests')}</h3><p>{t("Amounts in USD \xB7 approval does not initiate payment.")}</p></div><select className="mini-select" aria-label={t("Filter compensation requests")} value={filter} onChange={e => setFilter(e.target.value)}>{['All requests', 'Pending', 'Approved', 'Declined'].map(v => <option key={v} value={v}>{t(v)}</option>)}</select></div><div className="table-scroll"><table><thead><tr><th>{t("Employee")}</th><th>{t("Request")}</th><th>{t("Amount (USD)")}</th><th>{t("Submitted")}</th><th>{t("Status")}</th><th /></tr></thead><tbody>{shown.map(r => <tr key={r.id}><td><strong>{r.name}</strong></td><td>{t(r.type)}</td><td className="money-cell">${Number(r.amount).toLocaleString()}</td><td>{r.submittedAt?.slice(0, 10)}</td><td><span className={`workflow-status status-${r.status?.toLowerCase()}`}>{t(r.status)}</span></td><td><Button size="sm" variant="outline" onClick={() => onEdit(r)}>{t(canManage ? 'Review' : 'View details')}<ArrowUpRight size={13} /></Button></td></tr>)}</tbody></table>{!shown.length && <div className="empty">{t("No requests in this view. Create one to get started.")}</div>}</div></section></>;
}
export function WorkspacePanel({
  workspace,
  user,
  members,
  audit,
  onEdit,
  onAdd
}) {
  const {
    t
  } = usePreferences();
  const admins = members.filter(m => m.role === 'admin' && m.status === 'Active').length;
  return <><div className="workspace-overview"><div className="card workspace-identity"><span className="workspace-large-icon"><Building2 size={28} /></span><span className="eyebrow">{t("YOUR WORKSPACE")}</span><h2>{workspace.name}</h2><p>{t("One organization. The right access for everyone.")}</p><div className="workspace-id"><LockKeyhole size={13} />{workspace.id}</div></div><div className="card workspace-plan"><span className="eyebrow">{t("WORKSPACE ACCESS")}</span><h2>{workspace.plan || 'Trial'}</h2><p>{members.length}{t("provisioned members \xB7")}{admins}{t("administrators")}</p><div className="plan-feature"><Check size={14} />{t("Role-based dashboards")}</div><div className="plan-feature"><Check size={14} />{t("Isolated organization records")}</div><div className="plan-feature"><Check size={14} />{t("HR workflow tracking")}</div><small>{t("Plan display only. Subscription billing is not connected.")}</small></div></div><section className="card"><div className="card-heading"><div><h3>{t("Members & permissions")}</h3><p>{t("Add members, then enable Google or set their sign-in password.")}</p></div><Button size="sm" onClick={onAdd}><Plus size={14} />{t("Add member")}</Button></div><div className="table-scroll"><table><thead><tr><th>{t("Member")}</th><th>{t("Role")}</th><th>{t("Access")}</th><th /></tr></thead><tbody>{members.map(m => <tr key={m.id}><td><div className="member-person"><span>{m.name?.[0] || m.email?.[0]}</span><div><strong>{m.name || m.email}</strong><small><bdi>{m.memberCode}</bdi> · {m.email}</small></div></div></td><td><span className="permission-pill"><ShieldCheck size={12} />{t(roleNames[m.role] || m.role)}</span></td><td><span className={`workflow-status status-${m.status === 'Active' ? 'approved' : 'declined'}`}>{m.status}</span></td><td><Button size="sm" variant="outline" onClick={() => onEdit(m)}>{t("Manage")}</Button></td></tr>)}</tbody></table>{!members.length && <div className="empty">{t("No workspace members have been provisioned.")}</div>}</div></section><section className="card activity-card"><div className="card-heading"><div><h3>{t("Workspace activity")}</h3><p>{t("Recent actions in this organization.")}</p></div><ShieldCheck size={19} /></div><div className="activity-list">{audit.slice(0, 8).map(a => <div key={a.id}><span className="activity-dot" /><div><strong>{a.action || 'Updated'} · {a.resource || 'Workspace'}</strong><small>{a.actor || a.actorEmail || 'Workspace member'} · {new Date(a.createdAt || a.at || Date.now()).toLocaleString()}</small></div></div>)}{!audit.length && <div className="empty">{t("Workspace actions will appear here as records change.")}</div>}</div></section></>;
}
