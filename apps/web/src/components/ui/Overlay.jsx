import { useState, useRef, useEffect, cloneElement } from 'react';
import { cn } from '../../lib/utils';

export function Tooltip({ content, side = 'top', children, className, delay = 200 }) {
  const [show, setShow] = useState(false);
  const timer = useRef(null);
  const sides = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  };
  return (
    <span className="relative inline-flex" onMouseEnter={() => { timer.current = setTimeout(() => setShow(true), delay); }} onMouseLeave={() => { clearTimeout(timer.current); setShow(false); }}>
      {children}
      {show && content && (
        <span className={cn('absolute z-50 px-2 py-1 rounded-md text-xs font-medium bg-fg text-surface whitespace-nowrap pointer-events-none animate-fade shadow-lg', sides[side], className)}>
          {content}
        </span>
      )}
    </span>
  );
}

export function Dropdown({ trigger, children, align = 'left', className, position = 'bottom' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onEsc); };
  }, []);
  const alignClass = { left: 'left-0', right: 'right-0' }[align];
  const positionClass = { bottom: 'top-full mt-1', top: 'bottom-full mb-1' }[position];
  return (
    <span ref={ref} className="relative inline-block">
      <span onClick={() => setOpen(!open)}>{trigger}</span>
      {open && (
        <span className={cn('absolute z-50 min-w-[180px] rounded-lg border border-default bg-surface shadow-xl p-1 animate-fade', alignClass, positionClass, className)}>
          {children}
        </span>
      )}
    </span>
  );
}

export function Popover({ trigger, children, align = 'right', className, position = 'bottom' }) {
  return (
    <Dropdown trigger={trigger} children={children} align={align} className={className} position={position} />
  );
}
