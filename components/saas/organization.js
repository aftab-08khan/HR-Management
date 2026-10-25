'use client';

import Link from 'next/link';
import {recordPath} from '@/lib/navigation';
import { usePreferences } from "@/components/saas/preferences";
import { useMemo, useState } from 'react';
import { ArrowUpRight, Bell, Building2, CalendarDays, Check, CheckCheck, ChevronRight, Database, Heart, Leaf, LockKeyhole, Mail, Megaphone, Moon, Newspaper, Pencil, Plus, Search, ShieldCheck, Sparkles, Sun, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedCard } from '@/components/ui/spotlight-card';
import { roleNames } from '@/lib/demo';
const categoryDetails = {
  Culture: {
    icon: Heart,
    tone: 'rose'
  },
  'Company news': {
    icon: Megaphone,
    tone: 'sage'
  },
  Benefits: {
    icon: Leaf,
    tone: 'sand'
  },
  Events: {
    icon: CalendarDays,
    tone: 'lavender'
  }
};
function CategoryMark({
  category,
  small = false
}) {
  const {
    t
  } = usePreferences();
  const {
    icon: Icon,
    tone
  } = categoryDetails[category] || {
    icon: Newspaper,
    tone: 'sage'
  };
  return <span className={`org-category-icon org-tone-${tone} ${small ? 'small' : ''}`}><Icon size={small ? 15 : 20} /></span>;
}
function AnnouncementMeta({
  record
}) {
  const {
    t
  } = usePreferences();
  return <div className="org-announcement-meta"><span>{record.category || 'Company news'}</span><i /><span><CalendarDays size={12} />{record.date || 'Company update'}</span></div>;
}
export function AnnouncementsPanel({
  records = [],
  canManage,
  onEdit,
  onAdd
}) {
  const {
    t
  } = usePreferences();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All updates');
  const categories = useMemo(() => ['All updates', ...new Set(records.map(record => record.category).filter(Boolean))], [records]);
  const shown = records.filter(record => (category === 'All updates' || record.category === category) && `${record.title} ${record.body} ${record.category}`.toLowerCase().includes(search.trim().toLowerCase()));
  const [featured, ...rest] = shown;
  const filtering = !!search || category !== 'All updates';
  function resetFilters() {
    setSearch('');
    setCategory('All updates');
  }
  return <div className="org-announcements">
    <div className="org-updates-toolbar">
      <div className="org-filter-tabs" role="group" aria-label={t("Filter announcements by category")}>{categories.map(value => <button key={value} type="button" className={category === value ? 'selected' : ''} aria-pressed={category === value} onClick={() => setCategory(value)}>{t(value)}{value === 'All updates' && <span>{records.length}</span>}</button>)}</div>
      <label className="org-updates-search"><Search size={16} /><input type="search" aria-label={t("Search announcements")} placeholder={t("Search updates\u2026")} value={search} onChange={event => setSearch(event.target.value)} /></label>
    </div>
    {featured ? <>
      <div className="org-feature-grid">
        <AnimatedCard className="org-featured-announcement">
          <div className="org-feature-art" aria-hidden="true"><div className="org-art-ring one" /><div className="org-art-ring two" /><div className="org-art-ring three" /><div className="org-art-tile"><Megaphone size={39} strokeWidth={1.25} /><span className="org-art-spark"><Sparkles size={18} /></span></div><span className="org-art-note">{t("a little more")}<br /><b>{t("connected.")}</b></span></div>
          <div className="org-feature-copy"><span className="org-section-kicker"><span /> {t(filtering ? 'MATCHING UPDATE' : 'IN THE SPOTLIGHT')}</span><AnnouncementMeta record={featured} /><h2><Link className="record-name-link" href={recordPath('announcements',featured.id)}>{featured.title}</Link></h2><p>{featured.body}</p><div className="org-feature-bottom"><span><Building2 size={14} />{t("Your People team")}</span>{canManage && <Button variant="outline" size="sm" onClick={() => onEdit(featured)}><Pencil size={13} />{t("Edit update")}</Button>}</div></div>
        </AnimatedCard>
        <aside className="org-bulletin-card"><span className="org-bulletin-symbol"><Bell size={22} strokeWidth={1.5} /></span><span className="org-section-kicker">{t("THE COMPANY BULLETIN")}</span><h3>{t("Good things")}<br />{t("are happening.")}</h3><p>{t("A shared space for the news, moments, and updates that bring us together.")}</p><div className="org-bulletin-stats"><div><strong>{records.length.toString().padStart(2, '0')}</strong><span>{t("Team updates")}</span></div><div><strong>{(categories.length - 1).toString().padStart(2, '0')}</strong><span>{t("Topics to explore")}</span></div></div><div className="org-bulletin-foot"><CheckCheck size={15} />{t("Available to everyone in your workspace")}</div></aside>
      </div>
      <div className="org-section-heading"><div><h3>{t(filtering ? 'More matching updates' : 'More from your team')} <span>{rest.length}</span></h3><p>{t(filtering ? `${shown.length} ${shown.length === 1 ? 'announcement matches' : 'announcements match'} your filters.` : 'Stay close to the things that matter.')}</p></div>{filtering && <button className="org-subtle-action" onClick={resetFilters}><X size={13} />{t("Clear filters")}</button>}</div>
      {rest.length > 0 ? <div className="org-update-grid">{rest.map((record, index) => <AnimatedCard className="org-update-card" key={record.id} delay={index * 0.04}><div className="org-update-card-top"><CategoryMark category={record.category} /><span className="org-update-date">{record.date || 'Company update'}</span></div><span className="org-update-category">{record.category || 'Company news'}</span><h3><Link className="record-name-link" href={recordPath('announcements',record.id)}>{record.title}</Link></h3><p>{record.body}</p><div className="org-update-card-bottom"><span><Building2 size={13} />{t("People team")}</span>{canManage && <button className="org-subtle-action" onClick={() => onEdit(record)} aria-label={`Edit ${record.title}`}>{t("Edit update")}<ArrowUpRight size={14} /></button>}</div></AnimatedCard>)}</div> : <div className="org-all-updates"><CheckCheck size={17} /><span>{t("You\u2019re all caught up with")}{t(filtering ? 'this view' : 'the latest team news')}.</span></div>}
    </> : <section className="card org-updates-empty"><span className="org-empty-icon"><Newspaper size={28} /></span><h3>{t(records.length ? 'No matching announcements' : 'Your next update starts here')}</h3><p>{t(records.length ? 'Try a different search or category to find what you’re looking for.' : 'Company news, upcoming events, and team moments will appear here.')}</p>{records.length ? <Button variant="outline" onClick={resetFilters}>{t("Clear filters")}</Button> : canManage ? <Button onClick={onAdd}><Plus size={15} />{t("Create announcement")}</Button> : null}</section>}
  </div>;
}
const rolePermissions = {
  admin: ['Manage workspace members and roles', 'Manage employee and HR records', 'Review requests and compliance checks'],
  hr: ['Manage employee and HR records', 'Review time off and compensation requests', 'Maintain compliance checks and announcements'],
  employee: ['View your personal dashboard and records', 'Submit time off and compensation requests', 'Read workspace announcements']
};
export function SettingsPanel({
  user,
  workspace,
  settings,
  onSettingsChange,
  onSave,
  dark,
  onThemeChange,
  config = {},
  isDemo,
  onNavigate,
  photoControl,
  photoUrl
}) {
  const {
    t
  } = usePreferences();
  const role = user?.role || 'employee';
  const canRename = isDemo && role === 'admin';
  const workspaceName = isDemo ? settings.company : workspace?.name;
  const initials = (user?.name || 'Team member').split(' ').map(part => part[0]).join('').slice(0, 2);
  return <div className="org-settings">
    <section className="card org-account-overview"><div className="org-account-avatar">{photoUrl ? <img src={photoUrl} alt={`${user?.name} profile photo`} /> : initials}<span><Check size={11} /></span></div><div className="org-account-copy"><span className="org-section-kicker">{t("YOUR ACCOUNT")}</span><h2>{user?.name || 'Team member'}</h2><p><Mail size={13} />{user?.email || 'No email on this account'}</p></div>{photoControl && <div className="org-account-photo-control">{photoControl}</div>}<div className="org-account-status"><span className="org-role-badge"><ShieldCheck size={13} />{t(roleNames[role] || 'Team member')}</span><span>{t(isDemo ? 'Demo account · this browser' : 'Signed in with Google')}</span></div></section>
    <div className="org-settings-grid">
      <div className="org-settings-main">
        <section className="card org-settings-section"><div className="org-settings-card-heading"><span className="org-settings-icon"><Building2 size={19} /></span><div><h3>{t("Workspace preferences")}</h3><p>{t("The details that make this space feel like yours.")}</p></div></div><form onSubmit={event => {
            event.preventDefault();
            onSave();
          }}><div className="org-settings-fields"><label className="field">{t("Organization name")}<input required maxLength={80} value={canRename ? settings.company : workspaceName || ''} readOnly={!canRename} onChange={event => canRename && onSettingsChange({
                  ...settings,
                  company: event.target.value
                })} /><small>{t(canRename ? 'Updates the name displayed in your demo workspace.' : isDemo ? 'Your administrator manages the organization name.' : 'Organization details are managed by your workspace administrator.')}</small></label><label className="field">{t("First day of the week")}<select value={settings.week || 'Monday'} onChange={event => onSettingsChange({
                  ...settings,
                  week: event.target.value
                })}><option value="Monday">{t("Monday")}</option><option value="Sunday">{t("Sunday")}</option></select><small>{t("Your preferred start of the working week.")}</small></label></div><div className="org-settings-form-footer"><span><LockKeyhole size={13} />{t("Preferences are saved on this browser.")}</span><Button type="submit"><Check size={14} />{t("Save preferences")}</Button></div></form></section>
        <section className="card org-settings-section"><div className="org-settings-card-heading"><span className="org-settings-icon"><Sun size={19} /></span><div><h3>{t("Appearance")}</h3><p>{t("Find the right light for your workday.")}</p></div><span className="org-saved-indicator"><Check size={12} />{t("Auto-saved")}</span></div><div className="org-appearance-options" role="group" aria-label={t("Choose appearance")}>{[{
              label: 'Light',
              value: false,
              icon: Sun
            }, {
              label: 'Dark',
              value: true,
              icon: Moon
            }].map(({
              label,
              value,
              icon: Icon
            }) => <button type="button" key={label} className={`org-theme-choice ${dark === value ? 'selected' : ''}`} aria-pressed={dark === value} onClick={() => onThemeChange(value)}><span className={`org-theme-preview ${value ? 'night' : 'day'}`} aria-hidden="true"><span className="org-preview-nav"><i /><i /><i /><i /></span><span className="org-preview-body"><span /><span><i /><i /><i /></span><span /></span></span><span className="org-theme-choice-label"><Icon size={15} />{t(label)}<span className="org-theme-radio">{dark === value && <Check size={11} />}</span></span></button>)}</div></section>
      </div>
      <div className="org-settings-side">
        <section className="card org-settings-section org-services"><div className="org-settings-card-heading"><span className="org-settings-icon"><Database size={18} /></span><div><h3>{t("Connected services")}</h3><p>{t("Your workspace infrastructure.")}</p></div></div><div className="org-service"><div className="org-service-top"><span className="org-google-mark" aria-hidden="true">G</span><strong>{t("Google sign-in")}</strong><span className={`org-service-badge ${config.google ? 'configured' : ''}`}>{t(config.google ? 'Configured' : 'Not configured')}</span></div><p>{t(config.google ? isDemo ? 'Google authentication is configured. You are currently using a demo account.' : 'Your account is authenticated with Google.' : 'Google authentication has not been configured for this application.')}</p></div><div className="org-service"><div className="org-service-top"><span className="org-database-mark"><Leaf size={19} /></span><strong>{t("MongoDB")}</strong><span className={`org-service-badge ${config.database ? 'configured' : ''}`}>{t(config.database ? 'Configured' : 'Not configured')}</span></div><p>{t(isDemo ? 'This demo saves workspace records in this browser.' : config.database ? 'Workspace records use your configured MongoDB database.' : 'A database connection is required to load workspace records.')}</p></div><div className="org-service-note"><ShieldCheck size={14} /><span>{t(isDemo ? 'Demo data stays in this browser.' : 'Workspace access is controlled by your role.')}</span></div></section>
        <section className="card org-settings-section org-permissions"><div className="org-settings-card-heading"><span className="org-settings-icon"><ShieldCheck size={19} /></span><div><h3>{t("Your permissions")}</h3><p>{t(roleNames[role] || 'Team member')}{t("access")}</p></div></div><ul>{(rolePermissions[role] || rolePermissions.employee).map(permission => <li key={permission}><Check size={14} /><span>{t(permission)}</span></li>)}</ul>{role === 'admin' ? <button className="org-manage-access" onClick={() => onNavigate('Workspace')}><Users size={15} />{t("Manage workspace access")}<ChevronRight size={15} /></button> : <p className="org-permissions-note"><LockKeyhole size={13} />{t("Contact your administrator to change your role.")}</p>}</section>
      </div>
    </div>
  </div>;
}
