import React, { useEffect } from 'react';
import { X } from 'lucide-react';
interface ModalProps { isOpen:boolean; onClose:()=>void; title:string; subtitle?:string; children:React.ReactNode; maxWidth?:string; slideFromRight?:boolean; rightPanel?:boolean; }
export function Modal({isOpen,onClose,title,subtitle,children,maxWidth='max-w-2xl',slideFromRight=false,rightPanel=false}:ModalProps) {
  useEffect(()=>{const h=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};if(isOpen){document.body.style.overflow='hidden';window.addEventListener('keydown',h)}return()=>{document.body.style.overflow='unset';window.removeEventListener('keydown',h)}},[isOpen,onClose]);
  if(!isOpen)return null;
  return <div className={`fixed inset-0 z-50 flex overflow-hidden ${rightPanel ? "justify-end" : "items-center justify-center overflow-y-auto p-4 sm:p-6"}`}>
    <div className="fixed inset-0 bg-[#030604]/82 backdrop-blur-md" onClick={onClose} aria-hidden="true"/>
    <div className={`relative z-10 flex flex-col overflow-hidden border border-[#D7E2EA] bg-white shadow-[0_30px_100px_rgba(10,25,47,.20)] animate-in duration-300 ${rightPanel ? "h-[100dvh] w-full rounded-none border-y-0 border-r-0 border-l sm:w-1/2 sm:rounded-l-[28px] sm:rounded-r-none slide-in-from-right" : `my-8 max-h-[90vh] w-full ${maxWidth} rounded-[26px] fade-in ${slideFromRight ? "slide-in-from-left" : "zoom-in-95"}`}`}>
      <div className="flex items-start justify-between px-6 py-5 border-b border-[#E6EDF2] bg-[#F8FBFD] shrink-0">
        <div><h3 className="text-lg font-bold text-[#0A192F] tracking-tight">{title}</h3>{subtitle&&<p className="text-[11px] text-[#60758D] mt-1">{subtitle}</p>}</div>
        <button onClick={onClose} className="p-2 text-[#60758D] hover:text-[#0A192F] rounded-xl hover:bg-[#EAF4F1] transition-all cursor-pointer" aria-label="Fermer"><X className="w-5 h-5"/></button>
      </div>
      <div className={`min-h-0 flex-1 overflow-y-auto ${rightPanel ? "p-5 sm:p-8 lg:p-10" : "p-6"}`}>{children}</div>
    </div>
  </div>;
}
