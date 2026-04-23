import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Drawer({ open, onClose, children }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white shadow-2xl transition-transform duration-300 dark:bg-gray-900 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <span className="font-semibold">Menu</span>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </>
  );
}
