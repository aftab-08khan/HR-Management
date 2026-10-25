'use client';

import {PieChart,Pie,Cell,ResponsiveContainer,Tooltip} from 'recharts';
import {usePreferences} from '@/components/saas/preferences';
import {intlLocale} from '@/lib/i18n';

export const DATA_CHART_COLORS=['var(--accent,#ff4000)','var(--accent-mid,#ff7a45)','var(--accent-pale,#ffb08a)','color-mix(in srgb,var(--accent) 45%,var(--muted))','var(--muted)','color-mix(in srgb,var(--accent-mid) 40%,var(--muted))'];

/** One tooltip appearance for every Recharts chart; rows contain translated copy. */
export function DataChartTooltip({active,payload}){
  const {locale}=usePreferences();
  if(!active||!payload?.length)return null;
  const item=payload.find(item=>item?.payload?.tooltip);
  const detail=item?.payload?.tooltipByKey?.[item.dataKey]||item?.payload?.tooltip;
  if(!detail)return null;
  return <div className="data-chart-tooltip" role="tooltip" dir={locale==='ar'?'rtl':'ltr'}><strong>{detail.title}</strong><span>{detail.value}</span>{detail.description&&<small>{detail.description}</small>}</div>;
}

export const stableTooltipProps={isAnimationActive:false,cursor:false,wrapperStyle:{pointerEvents:'none',zIndex:30},allowEscapeViewBox:{x:false,y:false}};

export function DataChartContainer({height=220,children,className='',label}){
  return <div className={`data-chart-frame ${className}`} style={{height,minHeight:height}} role="group" aria-label={label} dir="ltr"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{width:320,height}}>{children}</ResponsiveContainer></div>;
}

export function CompletionChart({complete=0,total=0,label,semicircle=false}){
  const {t,locale}=usePreferences();
  const safeTotal=Math.max(0,Number(total)||0);
  const safeComplete=Math.min(safeTotal,Math.max(0,Number(complete)||0));
  const percent=safeTotal?Math.round(safeComplete/safeTotal*100):0;
  const title=label||t('Compliance checklist');
  const tooltip={title,value:safeTotal?t('{percent}% complete',{percent}):t('No tasks tracked'),description:t('{count} of {total} tracked tasks complete',{count:safeComplete,total:safeTotal})};
  const rows=safeTotal?[{name:'complete',value:safeComplete,fill:'var(--accent,#ff4000)',tooltip},{name:'remaining',value:safeTotal-safeComplete,fill:'var(--border)',tooltip}]:[{name:'empty',value:1,fill:'var(--border)',tooltip}];
  return <div className={`data-completion-chart ${semicircle?'semicircle':''}`}><DataChartContainer height={semicircle?116:142} label={`${title}. ${tooltip.value}. ${tooltip.description}`}><PieChart accessibilityLayer><Pie data={rows} dataKey="value" nameKey="name" cx="50%" cy={semicircle?'90%':'50%'} innerRadius={semicircle?64:49} outerRadius={semicircle?77:61} startAngle={semicircle?180:90} endAngle={semicircle?0:-270} stroke="none" isAnimationActive={false}>{rows.map(row=><Cell key={row.name} fill={row.fill}/>)}</Pie><Tooltip content={<DataChartTooltip/>} {...stableTooltipProps}/></PieChart></DataChartContainer><div className="data-completion-center"><strong>{safeTotal?`${new Intl.NumberFormat(intlLocale(locale)).format(percent)}%`:'—'}</strong><span>{t('tasks complete')}</span></div></div>;
}
