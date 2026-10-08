import React from 'react';
import { Users, MessageCircle, TrendingUp, Sparkles } from 'lucide-react';

export function CommunityView() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e8f8f3] text-[#00a982]">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-[#0b1f35]">Community</h1>
              <span className="rounded-full bg-[#eef7f4] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#008f72]">Bientôt</span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              L’espace Community d’IAMTRADER est en préparation. Il réunira les traders autour du partage d’expérience, de la progression et de la discipline.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: MessageCircle, title: 'Échanger', text: 'Partager vos analyses et expériences avec d’autres traders.' },
          { icon: TrendingUp, title: 'Progresser', text: 'Apprendre des parcours, setups et retours de la communauté.' },
          { icon: Sparkles, title: 'Construire', text: 'Un espace pensé pour une communauté de traders disciplinés.' },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
            <Icon className="h-5 w-5 text-[#00a982]" />
            <h2 className="mt-4 text-sm font-black text-[#0b1f35]">{title}</h2>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
