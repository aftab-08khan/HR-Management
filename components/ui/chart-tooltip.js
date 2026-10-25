'use client';

import {useId, useState} from 'react';

/** Keyboard and pointer access share the same visible chart detail. */
export function useChartTooltip() {
  const id = useId();
  const [active, setActive] = useState(null);
  function tooltipProps(detail) {
    return {
      tabIndex:0,
      'aria-label':[detail.title, detail.value, detail.description].filter(Boolean).join('. '),
      'aria-describedby':active?.key === detail.key ? id : undefined,
      onPointerEnter:() => setActive(detail),
      onPointerLeave:event => {if (event.currentTarget !== document.activeElement) setActive(null);},
      onFocus:() => setActive(detail),
      onBlur:() => setActive(null),
      onKeyDown:event => {if (event.key === 'Escape') setActive(null);},
    };
  }
  return {active, tooltipProps, tooltip:<ChartTooltip id={id} detail={active}/>};
}

export function ChartTooltip({id, detail, className='', style}) {
  if (!detail) return null;
  return <div className={`peopleos-chart-tooltip ${className}`} id={id} role="tooltip" style={style}><strong>{detail.title}</strong><span>{detail.value}</span>{detail.description&&<small>{detail.description}</small>}</div>;
}
