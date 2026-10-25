'use client';

import {forwardRef, useEffect, useImperativeHandle, useRef} from 'react';
import {motion, useMotionValue, useReducedMotion, useSpring} from 'motion/react';

// Adapted from React Bits SpotlightCard (MIT):
// https://github.com/DavidHDev/react-bits/blob/main/src/content/Components/SpotlightCard/SpotlightCard.jsx
// Uses the PeopleOS theme and a local pointer listener; no idle animation loop.
const SpotlightCard = forwardRef(function SpotlightCard({children, className='', spotlightColor='rgba(130, 176, 145, 0.18)', onPointerMove, onPointerLeave, style, ...props}, forwardedRef) {
  const root = useRef(null);
  const reduceMotion = useReducedMotion();
  useImperativeHandle(forwardedRef, () => root.current);
  function move(event) {
    onPointerMove?.(event);
    if (reduceMotion || event.pointerType === 'touch') return;
    const bounds = root.current.getBoundingClientRect();
    root.current.style.setProperty('--spotlight-x', `${event.clientX - bounds.left}px`);
    root.current.style.setProperty('--spotlight-y', `${event.clientY - bounds.top}px`);
    root.current.style.setProperty('--spotlight-opacity', '1');
  }
  function leave(event) {
    root.current?.style.setProperty('--spotlight-opacity', '0');
    onPointerLeave?.(event);
  }
  return <div ref={root} className={`saas-spotlight-card ${className}`} style={{'--spotlight-color':spotlightColor, ...style}} onPointerMove={move} onPointerLeave={leave} {...props}>
    <span className="saas-card-glow" aria-hidden="true"/>{children}
  </div>;
});

const MotionSpotlightCard = motion.create(SpotlightCard);

export function AnimatedCard({children, className='', delay=0, tilt=false, style, onPointerMove, onPointerLeave, ...props}) {
  const reduced = useReducedMotion();
  const rotateX=useMotionValue(0),rotateY=useMotionValue(0);
  const springX=useSpring(rotateX,{stiffness:230,damping:25}),springY=useSpring(rotateY,{stiffness:230,damping:25});
  useEffect(()=>{if(reduced||!tilt){rotateX.set(0);rotateY.set(0)}},[reduced,tilt,rotateX,rotateY]);
  function move(event){onPointerMove?.(event);if(!tilt||reduced||event.pointerType!=='mouse')return;const bounds=event.currentTarget.getBoundingClientRect();rotateX.set(-(event.clientY-bounds.top-bounds.height/2)/Math.max(bounds.height,1)*7);rotateY.set((event.clientX-bounds.left-bounds.width/2)/Math.max(bounds.width,1)*7)}
  function leave(event){rotateX.set(0);rotateY.set(0);onPointerLeave?.(event)}
  return <MotionSpotlightCard className={`card saas-animated-card ${tilt?'saas-tilt-card':''} ${className}`} initial={reduced ? false : {opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{duration:0.4,delay:reduced?0:delay,ease:[0.22,1,0.36,1]}} whileHover={tilt&&!reduced?{y:-3}:undefined} onPointerMove={move} onPointerLeave={leave} style={{...(tilt&&!reduced?{rotateX:springX,rotateY:springY,transformPerspective:1000}:{}),...style}} {...props}>{children}</MotionSpotlightCard>;
}

export {SpotlightCard};
export default SpotlightCard;
