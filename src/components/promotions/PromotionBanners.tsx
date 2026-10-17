import React, { useEffect, useState } from 'react';
import { Copy, Check, Tag, Sparkles, X } from 'lucide-react';

type Offer = { id:string; kind:'code'|'seasonal'; code:string; name:string; discountType:'percent'|'fixed'; discountValue:number; plans:string[]; startsAt:string; endsAt:string; imageUrl?:string };
type Props = { placement:'hero'|'ticker'; onCopy?:()=>void };
export function PromotionBanners({ placement, onCopy }: Props) {
  const [offers,setOffers] = useState<Offer[]>([]);
  const [copied,setCopied] = useState('');
  const [dismissed,setDismissed] = useState(false);
  useEffect(() => {
    let alive=true;
    const load=async()=>{ try { const response=await fetch('/api/promotions/active'); const data=await response.json(); if(alive && response.ok) setOffers(Array.isArray(data.promotions)?data.promotions:[]); } catch {} };
    void load();
    const timer=window.setInterval(load,60000);
    return ()=>{alive=false;window.clearInterval(timer);};
  },[]);
  const seasonal=offers.find(o=>o.kind==='seasonal');
  const codes=offers.filter(o=>o.kind==='code' && o.code);
  const copy=async(code:string)=>{try{await navigator.clipboard.writeText(code);setCopied(code);onCopy?.();window.setTimeout(()=>setCopied(''),1800);}catch{setCopied('');}};
  if (placement==='ticker') return (codes.length || seasonal) ? <div className="overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/90 py-2 text-xs font-bold text-emerald-900"><div className="iam-promo-marquee flex w-max items-center gap-8">{[...codes,...codes].map((o,i)=><button key={o.id+'-'+i} onClick={()=>void copy(o.code)} className="inline-flex items-center gap-2 whitespace-nowrap px-3"><Tag className="h-3.5 w-3.5"/>{o.discountValue}% avec {o.code}<Copy className="h-3 w-3"/>{copied===o.code?'Copié !':'Cliquer pour copier'}</button>)}{seasonal && <span className="inline-flex items-center gap-2 whitespace-nowrap px-3"><Sparkles className="h-3.5 w-3.5"/>{seasonal.name} : {seasonal.discountValue}% de réduction</span>}</div><style>{'@keyframes iamPromoMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}.iam-promo-marquee{animation:iamPromoMarquee 24s linear infinite}.iam-promo-marquee:hover{animation-play-state:paused}@media(prefers-reduced-motion:reduce){.iam-promo-marquee{animation:none}}'}</style></div>:null;
  if (!seasonal || dismissed) return null;
  return <section className="relative mx-auto w-full max-w-7xl px-4 pt-4 sm:px-8"><div className="relative isolate overflow-hidden rounded-3xl border border-emerald-200 bg-[#092238] text-white shadow-xl animate-[promoIn_.6s_ease-out]"><style>{'@keyframes promoIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}'}</style>{seasonal.imageUrl&&<img src={seasonal.imageUrl} alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-35"/>}<button onClick={()=>setDismissed(true)} className="absolute right-3 top-3 z-10 rounded-full bg-black/30 p-2 text-white" aria-label="Fermer l’offre"><X className="h-4 w-4"/></button><div className="relative flex min-h-44 flex-col items-center justify-center gap-3 bg-gradient-to-r from-[#061a2c]/90 via-[#092238]/70 to-emerald-950/70 px-5 py-8 text-center sm:min-h-56"><span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.2em]"><Sparkles className="h-3.5 w-3.5"/>Offre limitée</span><h2 className="text-2xl font-black sm:text-4xl">{seasonal.name}</h2><p className="text-4xl font-black text-emerald-300 sm:text-6xl">{seasonal.discountValue}% <span className="text-xl sm:text-2xl">DE RÉDUCTION</span></p><p className="text-sm text-white/80">Offre valable jusqu’au {new Date(seasonal.endsAt).toLocaleDateString('fr-FR')}</p></div></div></section>;
}