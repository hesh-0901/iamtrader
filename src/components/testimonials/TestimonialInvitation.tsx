import React, { useEffect, useRef, useState } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { BellRing, ImagePlus, LoaderCircle, Send, Star, X } from 'lucide-react';
import { auth, db } from '../firebase/config';
import { submitTestimonial } from '../services/testimonials';

export function TestimonialInvitation({ uid }: { uid?: string }) {
  const [submitted,setSubmitted]=useState<boolean|null>(null);
  const [open,setOpen]=useState(false);
  const [name,setName]=useState(auth.currentUser?.displayName||'');
  const [rating,setRating]=useState(5);
  const [message,setMessage]=useState('');
  const [photo,setPhoto]=useState<File|null>(null);
  const [preview,setPreview]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    if(!uid){setSubmitted(true);return;}
    return onSnapshot(doc(db,'testimonials',uid),snapshot=>setSubmitted(snapshot.exists()),()=>setSubmitted(true));
  },[uid]);
  useEffect(()=>{if(!photo){setPreview('');return;}const url=URL.createObjectURL(photo);setPreview(url);return()=>URL.revokeObjectURL(url);},[photo]);
  async function handleSubmit(e:React.FormEvent){e.preventDefault();if(!photo)return setError('Ajoutez une photo de profil.');setBusy(true);setError('');try{await submitTestimonial({fullName:name,rating,message,photo});setSubmitted(true);setOpen(false);setPhoto(null);setMessage('');}catch(e:any){setError(e?.message||'Envoi impossible.');}finally{setBusy(false);}}
  if(submitted!==false)return null;
  return <>
    <aside className="relative overflow-hidden rounded-2xl border border-[#bde9d8] bg-gradient-to-r from-[#effbf5] via-white to-[#f4fbf8] p-4 shadow-[0_8px_24px_rgba(0,169,130,.06)] sm:p-5" aria-live="polite">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#d9f7e9] text-[#078663]"><BellRing className="h-5 w-5"/></span><div><div className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#078663]">Votre voix compte</div><h2 className="mt-1 text-sm font-extrabold text-[#10233a]">Partagez votre expérience IAMTRADER</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[#61778a]">Votre retour aide les autres traders à découvrir la plateforme. Déposez un témoignage authentique : il sera vérifié avant publication.</p></div></div>
        <button type="button" onClick={()=>setOpen(true)} className="shrink-0 rounded-xl bg-[#00a982] px-4 py-3 text-xs font-extrabold text-white shadow-md shadow-[#00a982]/15 transition hover:bg-[#008f70]">Donner mon avis <span aria-hidden="true">→</span></button>
      </div>
    </aside>
    {open&&<div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-[#071725]/65 p-4 backdrop-blur-sm" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setOpen(false);}}>
      <div role="dialog" aria-modal="true" aria-labelledby="dashboard-testimonial-title" className="my-auto w-full max-w-xl rounded-[26px] bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between"><div><span className="text-[10px] font-black uppercase tracking-wider text-[#00a982]">Communauté IAMTRADER</span><h3 id="dashboard-testimonial-title" className="mt-2 text-xl font-black text-[#10233a]">Votre témoignage</h3><p className="mt-1 text-xs text-slate-500">Votre avis sera soumis à validation avant publication.</p></div><button type="button" onClick={()=>!busy&&setOpen(false)} aria-label="Fermer" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5"/></button></div>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div><label className="mb-2 block text-xs font-bold text-slate-700">Photo de profil *</label><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>setPhoto(e.target.files?.[0]||null)}/><button type="button" onClick={()=>fileRef.current?.click()} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-[#bcd9cd] bg-[#f7fbf9] p-3 text-left">{preview?<img src={preview} alt="Aperçu" className="h-12 w-12 rounded-full object-cover"/>:<span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e6f8f1] text-[#00a982]"><ImagePlus className="h-5 w-5"/></span>}<span className="text-xs font-semibold text-slate-700">{photo?.name||'Choisir une photo réelle'}<small className="mt-1 block text-[10px] font-normal text-slate-400">JPG, PNG ou WEBP · 3 Mo maximum</small></span></button></div>
          <div><label htmlFor="dashboard-testimonial-name" className="mb-1.5 block text-xs font-bold text-slate-700">Nom complet</label><input id="dashboard-testimonial-name" required minLength={3} maxLength={90} value={name} onChange={e=>setName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#00a982]" placeholder="Prénom et nom"/></div>
          <div><label className="mb-2 block text-xs font-bold text-slate-700">Note sur 5</label><div className="flex gap-2">{[1,2,3,4,5].map(n=><button key={n} type="button" onClick={()=>setRating(n)} aria-label={n+' étoiles'} aria-pressed={rating===n}><Star className={'h-7 w-7 '+(n<=rating?'fill-amber-400 text-amber-400':'text-slate-200')}/></button>)}</div></div>
          <div><div className="mb-1.5 flex justify-between"><label htmlFor="dashboard-testimonial-message" className="text-xs font-bold text-slate-700">Votre expérience</label><span className="text-[10px] text-slate-400">{message.length}/700</span></div><textarea id="dashboard-testimonial-message" required minLength={30} maxLength={700} rows={4} value={message} onChange={e=>setMessage(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#00a982]" placeholder="Expliquez ce que IAMTRADER vous apporte concrètement…"/></div>
          {error&&<p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={()=>setOpen(false)} className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600">Annuler</button><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#00a982] px-4 py-3 text-xs font-extrabold text-white disabled:opacity-60">{busy?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Send className="h-4 w-4"/>}{busy?'Envoi…':'Soumettre mon avis'}</button></div>
        </form>
      </div>
    </div>}
  </>;
}