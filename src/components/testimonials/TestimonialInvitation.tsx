import React, { useEffect, useRef, useState } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { Camera, ImagePlus, LoaderCircle, Send, Star, X, Check, Crop } from 'lucide-react';
import { auth, db } from '../../firebase/config';
import { submitTestimonial } from '../../services/testimonials';

async function createCroppedPhoto(file: File, sx: number, sy: number, side: number): Promise<File> {
  const image = await createImageBitmap(file);
  const safeSide = Math.max(1, Math.min(side, image.width - sx, image.height - sy));
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 900;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Impossible de préparer le recadrage.');
  context.drawImage(image, sx, sy, safeSide, safeSide, 0, 0, 900, 900);
  image.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Échec du recadrage.')), 'image/jpeg', 0.9));
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '-iamtrader.jpg', { type: 'image/jpeg', lastModified: Date.now() });
}

export function TestimonialInvitation({ uid }: { uid?: string }) {
  const [submitted,setSubmitted]=useState<boolean|null>(null);
  const [open,setOpen]=useState(true);
  const [name,setName]=useState(auth.currentUser?.displayName||'');
  const [rating,setRating]=useState(5);
  const [message,setMessage]=useState('');
  const [photo,setPhoto]=useState<File|null>(null);
  const [preview,setPreview]=useState('');
  const [cropOpen,setCropOpen]=useState(false);
  const [cropRect,setCropRect]=useState({x:0.12,y:0.12,size:0.76});
  const [cropNatural,setCropNatural]=useState({width:0,height:0});
  const cropFrameRef=useRef<HTMLDivElement>(null);
  const cropDragRef=useRef<{mode:'move'|'resize';startX:number;startY:number;initial:{x:number;y:number;size:number}}|null>(null);
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
    if(!photo||!cropFrameRef.current||!cropNatural.width||!cropNatural.height)return;
    try{
      const frame=cropFrameRef.current.clientWidth;
      const scale=Math.max(frame/cropNatural.width,frame/cropNatural.height);
      const side=cropRect.size*frame/scale;
      const offsetX=(frame-cropNatural.width*scale)/2;
      const offsetY=(frame-cropNatural.height*scale)/2;
      const sx=Math.max(0,Math.min(cropNatural.width-side,(cropRect.x*frame-offsetX)/scale));
      const sy=Math.max(0,Math.min(cropNatural.height-side,(cropRect.y*frame-offsetY)/scale));
      const cropped=await createCroppedPhoto(photo,sx,sy,side);
      setPhoto(cropped);setCropOpen(false);setCropRect({x:0.12,y:0.12,size:0.76});setError('');
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
    {open&&<div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto overscroll-contain bg-[#071725]/55 p-3 backdrop-blur-[5px]">
      <div role="dialog" aria-modal="true" aria-labelledby="dashboard-testimonial-title" className="my-auto max-h-[calc(100dvh-24px)] w-full max-w-5xl overflow-y-auto rounded-[28px] bg-white p-0 shadow-[0_30px_100px_rgba(0,0,0,.35)]">
        <div className="relative h-48 w-full overflow-hidden bg-[#062b35] sm:h-60 lg:h-64"><img src="/images/testimonial-invite.png" alt="" className="absolute inset-0 h-full w-full object-cover"/><div className="absolute inset-0 bg-gradient-to-r from-[#061e2c]/80 via-[#063c37]/30 to-transparent"/><div className="absolute bottom-5 left-6 right-6 text-white sm:bottom-7 sm:left-9"><span className="text-[10px] font-black uppercase tracking-[.18em]">Communauté IAMTRADER</span><h3 id="dashboard-testimonial-title" className="mt-1 text-2xl font-black sm:text-3xl lg:text-4xl">Racontez votre progression</h3><p className="mt-1 text-xs text-white/85 sm:text-sm">Votre expérience peut inspirer toute une communauté.</p></div></div>
        <form onSubmit={handleSubmit} className="space-y-6 p-6 sm:p-9 lg:p-10">
          <div><label className="mb-2 block text-xs font-bold text-slate-700">Votre photo *</label><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>{const file=e.target.files?.[0]||null;if(file&&file.size>3145728){setError('Photo de 3 Mo maximum.');return;}setPhoto(file);setCropRect({x:0.12,y:0.12,size:0.76});setError('');}}/><div className="flex items-center gap-4 rounded-2xl border border-[#d8ebe2] bg-[#f7fbf9] p-4 sm:p-5"><div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-[#9ed9c2] bg-white shadow-sm">{preview?<img src={preview} alt="Aperçu de la photo" className="h-full w-full rounded-full object-cover"/>:<span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e6f8f1] text-[#00a982]"><ImagePlus className="h-6 w-6"/></span>}<button type="button" onClick={()=>fileRef.current?.click()} aria-label="Ajouter une photo" className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white bg-[#00a982] text-white shadow-md transition hover:scale-105 hover:bg-[#008f70]"><Camera className="h-4 w-4"/></button></div><div className="min-w-0 flex-1"><p className="text-sm font-bold text-[#183047]">{photo?'Photo sélectionnée':'Ajoutez votre photo'}</p><p className="mt-1 text-[11px] text-slate-500">{photo?.name||'Choisissez une photo où votre visage est bien visible.'}</p><p className="mt-1 text-[10px] text-slate-400">JPG, PNG ou WEBP · 3 Mo maximum</p>{photo&&<button type="button" onClick={()=>setCropOpen(true)} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#cfe5dc] bg-white px-3 py-1.5 text-[10px] font-bold text-[#087b63]"><Crop className="h-3 w-3"/>Ajuster le cadrage</button>}</div></div></div>
          <div><label htmlFor="dashboard-testimonial-name" className="mb-1.5 block text-xs font-bold text-slate-700">Nom affiché</label><input id="dashboard-testimonial-name" required minLength={3} maxLength={90} value={name} onChange={e=>setName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base outline-none transition focus:border-[#00a982] focus:ring-4 focus:ring-[#00a982]/10" placeholder="Prénom et nom"/></div>
          <div><label className="mb-2 block text-xs font-bold text-slate-700">Votre appréciation</label><div className="flex gap-2">{[1,2,3,4,5].map(n=><button key={n} type="button" onClick={()=>setRating(n)} aria-label={n+' étoiles'} aria-pressed={rating===n}><Star className={'h-7 w-7 '+(n<=rating?'fill-amber-400 text-amber-400':'text-slate-200')}/></button>)}</div></div>
          <div><div className="mb-1.5 flex justify-between"><label htmlFor="dashboard-testimonial-message" className="text-xs font-bold text-slate-700">Votre expérience</label><span className="text-[10px] text-slate-400">{message.length}/700</span></div><textarea id="dashboard-testimonial-message" required minLength={30} maxLength={700} rows={5} value={message} onChange={e=>setMessage(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-4 text-base outline-none transition focus:border-[#00a982] focus:ring-4 focus:ring-[#00a982]/10" placeholder="Qu’est-ce qui a changé dans votre façon de trader ?"/></div>
          {error&&<p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={()=>{setOpen(false);setDismissed(true);}} className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600">Me le rappeler plus tard</button><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#00a982] px-4 py-3 text-xs font-extrabold text-white disabled:opacity-60">{busy?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Send className="h-4 w-4"/>}{busy?'Envoi…':'Envoyer mon témoignage'}</button></div>
        </form>
      </div>
    </div>}

    {cropOpen&&photo&&preview&&<div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#071725]/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between"><div><h3 className="text-base font-black text-[#10233a]">Recadrer votre photo</h3><p className="mt-1 text-[10px] text-slate-500">Déplacez le carré et tirez sa poignée pour choisir la zone.</p></div><button type="button" onClick={()=>setCropOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5"/></button></div>
        <div ref={cropFrameRef} className="relative mx-auto mt-5 aspect-square w-full max-w-[420px] overflow-hidden rounded-xl bg-slate-950">
          <img src={preview} alt="Photo à recadrer" draggable={false} onLoad={e=>setCropNatural({width:e.currentTarget.naturalWidth,height:e.currentTarget.naturalHeight})} className="absolute inset-0 h-full w-full select-none object-cover"/>
          <div className="pointer-events-none absolute inset-0 bg-black/40"/>
          <div className="absolute border-2 border-white" style={{left:(cropRect.x*100)+'%',top:(cropRect.y*100)+'%',width:(cropRect.size*100)+'%',height:(cropRect.size*100)+'%',boxShadow:'0 0 0 999px rgba(0,0,0,.42)'}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);cropDragRef.current={mode:'move',startX:e.clientX,startY:e.clientY,initial:cropRect};}} onPointerMove={e=>{const d=cropDragRef.current;if(!d||d.mode!=='move'||!cropFrameRef.current)return;const w=cropFrameRef.current.clientWidth;const dx=(e.clientX-d.startX)/w;const dy=(e.clientY-d.startY)/w;setCropRect({...d.initial,x:Math.max(0,Math.min(1-d.initial.size,d.initial.x+dx)),y:Math.max(0,Math.min(1-d.initial.size,d.initial.y+dy))});}} onPointerUp={()=>{cropDragRef.current=null;}}>
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">{Array.from({length:9},(_,i)=><span key={i} className="border border-white/45"/>)}</div>
            <button type="button" aria-label="Agrandir ou réduire la zone de rognage" className="absolute -bottom-3 -right-3 flex h-7 w-7 touch-none items-center justify-center rounded-full border-2 border-white bg-[#00a982] shadow-lg" onPointerDown={e=>{e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);cropDragRef.current={mode:'resize',startX:e.clientX,startY:e.clientY,initial:cropRect};}} onPointerMove={e=>{const d=cropDragRef.current;if(!d||d.mode!=='resize'||!cropFrameRef.current)return;const delta=Math.max(e.clientX-d.startX,e.clientY-d.startY)/cropFrameRef.current.clientWidth;const size=Math.max(.2,Math.min(1-d.initial.x,1-d.initial.y,d.initial.size+delta));setCropRect({...d.initial,size});}} onPointerUp={()=>{cropDragRef.current=null;}}><span className="h-2 w-2 rounded-full bg-white"/></button>
          </div>
        </div>
        <p className="mt-3 text-center text-[10px] text-slate-500">Glissez le carré pour le déplacer. Utilisez la poignée verte pour l’agrandir ou le réduire.</p>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={()=>setCropOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600">Annuler</button><button type="button" onClick={applyCrop} className="inline-flex items-center gap-2 rounded-xl bg-[#00a982] px-4 py-2.5 text-xs font-bold text-white"><Check className="h-4 w-4"/>Conserver cette zone</button></div>
      </div>
    </div>}
  </>;
}
