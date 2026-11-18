import React, { useEffect, useRef, useState } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { BellRing, ImagePlus, LoaderCircle, Send, Star, X, ZoomIn, Move, Check, Crop } from 'lucide-react';
import { auth, db } from '../../firebase/config';
import { submitTestimonial } from '../../services/testimonials';

async function createCroppedPhoto(file: File, zoom: number, panX: number, panY: number): Promise<File> {
  const image = await createImageBitmap(file);
  const side = Math.min(image.width, image.height) / zoom;
  const maxX = image.width - side;
  const maxY = image.height - side;
  const sx = Math.max(0, Math.min(maxX, maxX / 2 + panX * maxX / 2));
  const sy = Math.max(0, Math.min(maxY, maxY / 2 + panY * maxY / 2));
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 900;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Impossible de préparer le recadrage.');
  context.drawImage(image, sx, sy, side, side, 0, 0, 900, 900);
  image.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Échec du recadrage.')), 'image/jpeg', 0.9));
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '-iamtrader.jpg', { type: 'image/jpeg', lastModified: Date.now() });
}

export function TestimonialInvitation({ uid }: { uid?: string }) {
  const [submitted,setSubmitted]=useState<boolean|null>(null);
  const [open,setOpen]=useState(false);
  const [name,setName]=useState(auth.currentUser?.displayName||'');
  const [rating,setRating]=useState(5);
  const [message,setMessage]=useState('');
  const [photo,setPhoto]=useState<File|null>(null);
  const [preview,setPreview]=useState('');
  const [cropOpen,setCropOpen]=useState(false);
  const [zoom,setZoom]=useState(1);
  const [panX,setPanX]=useState(0);
  const [panY,setPanY]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [dismissed,setDismissed]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{
    if(!uid){setSubmitted(null);return;}
    setSubmitted(false);
    return onSnapshot(doc(db,'testimonials',uid),snapshot=>setSubmitted(snapshot.exists()),error=>{
      console.error('Testimonial status subscription failed:',error);
      setSubmitted(false);
    });
  },[uid]);

  useEffect(()=>{if(!photo){setPreview('');return;}const url=URL.createObjectURL(photo);setPreview(url);return()=>URL.revokeObjectURL(url);},[photo]);

  async function applyCrop(){
    if(!photo)return;
    try{
      const cropped=await createCroppedPhoto(photo,zoom,panX,panY);
      setPhoto(cropped);setCropOpen(false);setZoom(1);setPanX(0);setPanY(0);setError('');
    }catch(e:any){setError(e?.message||'Recadrage impossible.');}
  }

  async function handleSubmit(e:React.FormEvent){
    e.preventDefault();
    if(!photo)return setError('Ajoutez une photo de profil.');
    setBusy(true);setError('');
    try{
      await submitTestimonial({fullName:name,rating,message,photo});
      setSubmitted(true);setOpen(false);setPhoto(null);setMessage('');
    }catch(e:any){setError(e?.message||'Envoi impossible.');}
    finally{setBusy(false);}
  }

  if(submitted!==false)return null;

  return <>
    {!dismissed&&!open&&<div className="fixed bottom-5 right-5 z-[90] w-[min(340px,calc(100vw-2rem))] animate-[landing-fade-up_.45s_ease_both]">
      <div className="relative overflow-hidden rounded-[22px] border border-[#cceadd] bg-white shadow-[0_18px_55px_rgba(8,24,39,.20)]">
        <button type="button" onClick={()=>setDismissed(true)} aria-label="Masquer l’invitation" className="absolute right-2 top-2 z-20 rounded-full bg-white/90 p-1.5 text-slate-400 shadow-sm hover:text-slate-700"><X className="h-3.5 w-3.5"/></button>
        <div className="relative h-[112px] overflow-hidden bg-gradient-to-br from-[#062b35] via-[#087b63] to-[#13bd8b]">
          <img src="/images/testimonial-invite.png" alt="" className="h-full w-full object-cover" onError={e=>{e.currentTarget.style.display='none';}}/>
          <div className="absolute inset-0 bg-gradient-to-r from-[#061e2c]/75 via-[#063c37]/35 to-transparent"/>
          <div className="absolute bottom-3 left-4 flex items-center gap-2 text-white"><span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/25 bg-white/15 backdrop-blur"><BellRing className="h-4 w-4"/></span><span className="text-[9px] font-black uppercase tracking-[.2em]">Communauté IAMTRADER</span></div>
        </div>
        <div className="p-4">
          <h2 className="text-[15px] font-black tracking-tight text-[#10233a]">Votre expérience compte.</h2>
          <p className="mt-1 text-[11px] leading-5 text-[#667b8d]">Partagez votre progression et inspirez d’autres traders.</p>
          <button type="button" onClick={()=>setOpen(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00a982] px-4 py-2.5 text-[11px] font-extrabold text-white shadow-md shadow-[#00a982]/15 transition hover:bg-[#008f70]">Partager mon témoignage <span aria-hidden="true">→</span></button>
        </div>
      </div>
    </div>}

    {open&&<div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto overscroll-contain bg-[#071725]/55 p-3 backdrop-blur-[5px]">
      <div role="dialog" aria-modal="true" aria-labelledby="dashboard-testimonial-title" className="my-auto max-h-[calc(100dvh-24px)] w-full max-w-3xl overflow-y-auto rounded-[30px] bg-white p-7 shadow-[0_30px_100px_rgba(0,0,0,.35)] sm:p-10 lg:p-12">
        <div className="flex items-start justify-between gap-4"><div><span className="text-[11px] font-black uppercase tracking-[.16em] text-[#00a982]">Communauté IAMTRADER</span><h3 id="dashboard-testimonial-title" className="mt-2 text-3xl font-black tracking-tight text-[#10233a] sm:text-4xl">Racontez votre progression</h3><p className="mt-2 text-sm text-slate-500">Votre témoignage sera vérifié avant publication.</p></div><span className="rounded-full bg-[#e7faf3] px-3 py-1.5 text-[10px] font-bold text-[#087b63]">Votre voix compte</span></div>
        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div><label className="mb-2 block text-xs font-bold text-slate-700">Votre photo *</label><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>{const file=e.target.files?.[0]||null;if(file&&file.size>3145728){setError('Photo de 3 Mo maximum.');return;}setPhoto(file);setZoom(1);setPanX(0);setPanY(0);setError('');}}/><div className="flex items-center gap-3 rounded-2xl border border-dashed border-[#bcd9cd] bg-[#f7fbf9] p-3">{preview?<img src={preview} alt="Aperçu recadré" className="h-16 w-16 rounded-full object-cover ring-2 ring-white shadow"/>:<span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e6f8f1] text-[#00a982]"><ImagePlus className="h-6 w-6"/></span>}<div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-700">{photo?.name||'Ajoutez une photo personnelle'}</p><p className="mt-1 text-[10px] text-slate-400">JPG, PNG ou WEBP · 3 Mo maximum</p><div className="mt-2 flex gap-2"><button type="button" onClick={()=>fileRef.current?.click()} className="rounded-lg bg-[#e4f7ef] px-3 py-1.5 text-[10px] font-bold text-[#087b63]">{photo?'Changer':'Choisir une photo'}</button>{photo&&<button type="button" onClick={()=>setCropOpen(true)} className="inline-flex items-center gap-1 rounded-lg border border-[#cfe5dc] px-3 py-1.5 text-[10px] font-bold text-[#36566b]"><Crop className="h-3 w-3"/>Rogner</button>}</div></div></div></div>
          <div><label htmlFor="dashboard-testimonial-name" className="mb-1.5 block text-xs font-bold text-slate-700">Nom affiché</label><input id="dashboard-testimonial-name" required minLength={3} maxLength={90} value={name} onChange={e=>setName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base outline-none transition focus:border-[#00a982] focus:ring-4 focus:ring-[#00a982]/10" placeholder="Prénom et nom"/></div>
          <div><label className="mb-2 block text-xs font-bold text-slate-700">Votre appréciation</label><div className="flex gap-2">{[1,2,3,4,5].map(n=><button key={n} type="button" onClick={()=>setRating(n)} aria-label={n+' étoiles'} aria-pressed={rating===n}><Star className={'h-7 w-7 '+(n<=rating?'fill-amber-400 text-amber-400':'text-slate-200')}/></button>)}</div></div>
          <div><div className="mb-1.5 flex justify-between"><label htmlFor="dashboard-testimonial-message" className="text-xs font-bold text-slate-700">Votre expérience</label><span className="text-[10px] text-slate-400">{message.length}/700</span></div><textarea id="dashboard-testimonial-message" required minLength={30} maxLength={700} rows={5} value={message} onChange={e=>setMessage(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-4 text-base outline-none transition focus:border-[#00a982] focus:ring-4 focus:ring-[#00a982]/10" placeholder="Qu’est-ce qui a changé dans votre façon de trader ?"/></div>
          {error&&<p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={()=>setOpen(false)} className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600">Me le rappeler plus tard</button><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#00a982] px-4 py-3 text-xs font-extrabold text-white disabled:opacity-60">{busy?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Send className="h-4 w-4"/>}{busy?'Envoi…':'Envoyer mon témoignage'}</button></div>
        </form>
      </div>
    </div>}

    {cropOpen&&photo&&preview&&<div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#071725]/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between"><div><h3 className="text-base font-black text-[#10233a]">Ajuster votre photo</h3><p className="mt-1 text-[10px] text-slate-500">Déplacez le cadrage pour choisir la partie visible.</p></div><button type="button" onClick={()=>setCropOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5"/></button></div>
        <div className="mx-auto mt-6 w-full max-w-[420px]"><div className="relative aspect-square overflow-hidden rounded-xl border-2 border-white bg-slate-950 shadow-[0_0_0_1px_#00a982,0_12px_35px_rgba(8,24,39,.18)]"><img src={preview} alt="Aperçu du recadrage" draggable={false} className="h-full w-full select-none object-cover" style={{objectPosition:(50+panX*25)+'% '+(50+panY*25)+'%',transform:'scale('+zoom+')'}}/><div className="pointer-events-none absolute inset-0"><div className="absolute inset-0 border-[3px] border-white/90"/><div className="absolute inset-y-0 left-1/3 border-l border-white/60"/><div className="absolute inset-y-0 left-2/3 border-l border-white/60"/><div className="absolute inset-x-0 top-1/3 border-t border-white/60"/><div className="absolute inset-x-0 top-2/3 border-t border-white/60"/><div className="absolute left-0 top-0 h-5 w-5 border-l-[3px] border-t-[3px] border-[#00d6a0]"/><div className="absolute right-0 top-0 h-5 w-5 border-r-[3px] border-t-[3px] border-[#00d6a0]"/><div className="absolute bottom-0 left-0 h-5 w-5 border-b-[3px] border-l-[3px] border-[#00d6a0]"/><div className="absolute bottom-0 right-0 h-5 w-5 border-b-[3px] border-r-[3px] border-[#00d6a0]"/></div><div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[#071725]/75 px-3 py-1.5 text-[10px] font-semibold text-white backdrop-blur">Zone conservée · carré</div></div><p className="mt-2 text-center text-[10px] text-slate-500">Ajustez le zoom et le positionnement pour choisir la partie à conserver.</p></div>
        <div className="mt-5 space-y-4">
          <label className="block text-[10px] font-bold text-slate-600"><span className="mb-2 flex items-center gap-2"><ZoomIn className="h-3.5 w-3.5"/>Zoom</span><input type="range" min="1" max="3" step="0.05" value={zoom} onChange={e=>setZoom(Number(e.target.value))} className="w-full accent-[#00a982]"/></label>
          <label className="block text-[10px] font-bold text-slate-600"><span className="mb-2 flex items-center gap-2"><Move className="h-3.5 w-3.5"/>Horizontal</span><input type="range" min="-1" max="1" step="0.01" value={panX} onChange={e=>setPanX(Number(e.target.value))} className="w-full accent-[#00a982]"/></label>
          <label className="block text-[10px] font-bold text-slate-600"><span className="mb-2 flex items-center gap-2"><Move className="h-3.5 w-3.5"/>Vertical</span><input type="range" min="-1" max="1" step="0.01" value={panY} onChange={e=>setPanY(Number(e.target.value))} className="w-full accent-[#00a982]"/></label>
        </div>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={()=>setCropOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600">Annuler</button><button type="button" onClick={applyCrop} className="inline-flex items-center gap-2 rounded-xl bg-[#00a982] px-4 py-2.5 text-xs font-bold text-white"><Check className="h-4 w-4"/>Conserver ce cadrage</button></div>
      </div>
    </div>}
  </>;
}
