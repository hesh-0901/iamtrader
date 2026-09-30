import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
  position?: 'top' | 'bottom';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children || (
        <button 
          type="button" 
          className="text-neutral-500 hover:text-neutral-300 transition-colors p-0.5 rounded cursor-help"
          aria-label="Aide"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      )}

      {isVisible && (
        <div 
          className={`absolute left-1/2 -translate-x-1/2 z-50 px-2.5 py-1.5 text-[11px] leading-tight text-neutral-200 bg-white/95 border border-white/10 rounded-lg shadow-xl backdrop-blur-md whitespace-nowrap pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95 ${
            position === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {content}
          <div 
            className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
              position === 'top' 
                ? 'top-full border-t-neutral-900/95' 
                : 'bottom-full border-b-neutral-900/95'
            }`}
          />
        </div>
      )}
    </div>
  );
}
