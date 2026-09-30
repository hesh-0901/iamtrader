import React, { useEffect } from 'react';
import { X } from 'lucide-react';
interface ModalProps { isOpen:boolean; onClose:()=>void; title:string; subtitle?:string; children:React.ReactNode; maxWidth?:string; }
export function Modal({isOpen,onClose,title,subtitle,children,maxWidth='max-w-2xl'}:ModalProps) {
  useEffect(()=>{const h=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};if(isOpen){document.body.style.overflow='hidden';window.addEventListener('keydown',h)}return()=>{document.body.style.overflow='unset';window.removeEventListener('keydown',h)}},[isOpen,onClose]);
  if(!isOpen)return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
    <div className="fixed inset-0 bg-[#030604]/82 backdrop-blur-md" onClick={onClose} aria-hidden="true"/>
    <div className={`relative w-full ${maxWidth} bg-white border border-[#D7E2EA] rounded-[26px] shadow-[0_30px_100px_rgba(10,25,47,.20)] z-10 overflow-hidden my-8 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200`}>
      <div className="flex items-start justify-between px-6 py-5 border-b border-[#E6EDF2] bg-[#F8FBFD] shrink-0">
        <div><h3 className="text-lg font-bold text-[#0A192F] tracking-tight">{title}</h3>{subtitle&&<p className="text-[11px] text-[#60758D] mt-1">{subtitle}</p>}</div>
        <button onClick={onClose} className="p-2 text-[#60758D] hover:text-[#0A192F] rounded-xl hover:bg-[#EAF4F1] transition-all cursor-pointer" aria-label="Fermer"><X className="w-5 h-5"/></button>
      </div>
      <div className="p-6 overflow-y-auto flex-1">{children}</div>
    </div>
  </div>;
}
