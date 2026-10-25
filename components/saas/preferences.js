'use client';

import {createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {Check,Globe,Palette,Type} from 'lucide-react';
import {translate} from '@/lib/i18n';

export const FONT_CHOICES=[
  {id:'dm-sans',name:'DM Sans',description:'Clean and familiar',family:'"DM Sans", "Cairo", sans-serif'},
  {id:'inter',name:'Inter',description:'Crisp and modern',family:'"Inter", "Cairo", sans-serif'},
  {id:'manrope',name:'Manrope',description:'Soft and thoughtful',family:'"Manrope", "Cairo", sans-serif'},
  {id:'cairo',name:'Cairo',description:'Modern Arabic and Latin',family:'"Cairo", sans-serif'},
  {id:'tajawal',name:'Tajawal',description:'Welcoming Arabic type',family:'"Tajawal", sans-serif'},
];
export const ACCENT_CHOICES=[
  {id:'ember',name:'Ember',description:'Warm and expressive',colors:['#ff4000','#ff7a45','#ffd8c2']},
  {id:'ocean',name:'Ocean',description:'Clear and focused',colors:['#2563eb','#60a5fa','#dbeafe']},
  {id:'violet',name:'Violet',description:'Calm and creative',colors:['#7c3aed','#a78bfa','#ede9fe']},
  {id:'teal',name:'Teal',description:'Fresh and balanced',colors:['#0f8b7d','#49b6a7','#d4f3eb']},
];
const defaults={locale:'en',font:'dm-sans',accent:'ember'};
const storageKey='peopleos-preferences';
const PreferencesContext=createContext(null);
function sanitizePreferences(input={}){return {locale:['en','ar'].includes(input.locale)?input.locale:defaults.locale,font:FONT_CHOICES.some(font=>font.id===input.font)?input.font:defaults.font,accent:ACCENT_CHOICES.some(accent=>accent.id===input.accent)?input.accent:defaults.accent};}
function applyPreferences(preferences){const root=document.documentElement;root.lang=preferences.locale;root.dir=preferences.locale==='ar'?'rtl':'ltr';root.dataset.font=preferences.font;root.dataset.accent=preferences.accent;}

export function PreferencesProvider({children}){
  const [preferences,setPreferences]=useState(defaults);
  const [ready,setReady]=useState(false);
  useEffect(()=>{let saved=defaults;try{saved=sanitizePreferences(JSON.parse(localStorage.getItem(storageKey)||'{}'))}catch{}setPreferences(saved);applyPreferences(saved);setReady(true);function sync(event){if(event.key!==storageKey)return;try{const next=sanitizePreferences(JSON.parse(event.newValue||'{}'));setPreferences(next);applyPreferences(next)}catch{}}window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync)},[]);
  useEffect(()=>{if(!ready)return;applyPreferences(preferences);try{localStorage.setItem(storageKey,JSON.stringify(preferences))}catch{}},[preferences,ready]);
  const setLocale=useCallback(locale=>setPreferences(previous=>({...previous,locale:['en','ar'].includes(locale)?locale:previous.locale})),[]);
  const setFont=useCallback(font=>setPreferences(previous=>({...previous,font:FONT_CHOICES.some(choice=>choice.id===font)?font:previous.font})),[]);
  const setAccent=useCallback(accent=>setPreferences(previous=>({...previous,accent:ACCENT_CHOICES.some(choice=>choice.id===accent)?accent:previous.accent})),[]);
  const t=useCallback((key,values)=>translate(key,preferences.locale,values),[preferences.locale]);
  const context=useMemo(()=>({...preferences,setLocale,setFont,setAccent,t}),[preferences,setLocale,setFont,setAccent,t]);
  return <PreferencesContext.Provider value={context}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(){const context=useContext(PreferencesContext);if(!context)throw new Error('usePreferences must be used within PreferencesProvider');return context;}

export function LanguageSwitcher({className=''}){
  const {locale,setLocale,t}=usePreferences();
  return <div className={`preferences-language-switch ${className}`} role="group" aria-label={t('Change language')}><button type="button" lang="en" className={locale==='en'?'selected':''} aria-pressed={locale==='en'} onClick={()=>setLocale('en')}>EN</button><span aria-hidden="true"/><button type="button" lang="ar" className={locale==='ar'?'selected':''} aria-pressed={locale==='ar'} onClick={()=>setLocale('ar')}>عربي</button></div>;
}

export function AppearancePreferences(){
  const {locale,setLocale,font,setFont,accent,setAccent,t}=usePreferences();
  return <section className="card preferences-panel"><div className="preferences-panel-heading"><span><Palette size={19}/></span><div><h3>{t('Personalize your workspace')}</h3><p>{t('Make every workday feel like you.')}</p></div><small><Check size={12}/>{t('Auto-saved')}</small></div>
    <div className="preferences-section"><div className="preferences-section-heading"><Globe size={16}/><h4>{t('Language')}</h4><span>{t('Applies to every page.')}</span></div><div className="preferences-languages" role="group" aria-label={t('Choose language')}>{[{id:'en',label:'English',native:'English',direction:'Left to right'},{id:'ar',label:'Arabic',native:'العربية',direction:'Right to left'}].map(option=><button type="button" key={option.id} className={`preferences-language ${locale===option.id?'selected':''}`} aria-pressed={locale===option.id} onClick={()=>setLocale(option.id)}><span lang={option.id}>{option.native}</span><span><strong>{t(option.label)}</strong><small>{t(option.direction)}</small></span><i>{locale===option.id&&<Check size={12}/>}</i></button>)}</div></div>
    <div className="preferences-section"><div className="preferences-section-heading"><Type size={16}/><h4>{t('Font family')}</h4></div><p>{t('Choose a font for your entire workspace.')}</p><div className="preferences-fonts" role="group" aria-label={t('Font family')}>{FONT_CHOICES.map(choice=><button type="button" key={choice.id} className={`preferences-font ${font===choice.id?'selected':''}`} aria-pressed={font===choice.id} onClick={()=>setFont(choice.id)} style={{'--font-preview':choice.family}}><div><strong>{choice.name}</strong><i>{font===choice.id&&<Check size={12}/>}</i></div><span>{t('The way you work, your way.')}</span><small>{t(choice.description)}</small></button>)}</div></div>
    <div className="preferences-section"><div className="preferences-section-heading"><Palette size={16}/><h4>{t('Color theme')}</h4></div><p>{t('Choose a color that makes this space yours.')}</p><div className="preferences-accents" role="group" aria-label={t('Color theme')}>{ACCENT_CHOICES.map(choice=><button type="button" key={choice.id} className={`preferences-accent ${accent===choice.id?'selected':''}`} aria-pressed={accent===choice.id} onClick={()=>setAccent(choice.id)}><span className="preferences-swatch" aria-hidden="true">{choice.colors.map(color=><i key={color} style={{background:color}}/>)}</span><span><strong>{t(choice.name)}</strong><small>{t(choice.description)}</small></span><i className="preferences-check">{accent===choice.id&&<Check size={12}/>}</i></button>)}</div></div><div className="preferences-panel-footer"><Check size={13}/>{t('Saved automatically on this browser.')}</div>
  </section>;
}
