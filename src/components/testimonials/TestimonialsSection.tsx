import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, MessageSquareQuote, ShieldCheck, Star } from 'lucide-react';
import { subscribePublishedTestimonials, type TraderTestimonial } from '../../services/testimonials';

export function TestimonialsSection() {
  const [items, setItems] = useState<TraderTestimonial[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeItem = items.length ? items[Math.min(activeIndex, items.length - 1)] : null;

  useEffect(() => {
    return subscribePublishedTestimonials(setItems, error => console.error('[Testimonials]', error));
  }, []);

  useEffect(() => {
    setActiveIndex(index => items.length ? Math.min(index, items.length - 1) : 0);
  }, [items.length]);

  return (
    <section id="testimonials" className="relative isolate overflow-hidden border-y border-[#dcebe5] bg-[#f5faf8] px-6 py-16 sm:px-12 sm:py-20 scroll-mt-20">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,199,150,0.10),transparent_55%)]" />
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#00a982]">La parole aux traders</span>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-[#081827] sm:text-4xl">Les traders racontent leur progression</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#647b8d]">Découvrez les expériences et les parcours de la communauté IAMTRADER.</p>
        </div>

        <div className="mt-10 grid items-center gap-8 lg:grid-cols-[.82fr_1.18fr] lg:gap-14">
          <div className="relative mx-auto h-[270px] w-full max-w-[430px] sm:h-[310px]" aria-label="Galerie de témoignages">
            <div className="absolute left-5 right-5 top-5 h-[215px] rotate-[-7deg] rounded-[26px] border border-[#dcebe5] bg-white/75 shadow-[0_16px_45px_rgba(8,24,39,.08)] sm:left-9 sm:right-9 sm:top-8 sm:h-[245px]" />
            <div className="absolute left-2 right-2 top-3 h-[220px] rotate-[5deg] rounded-[26px] border border-[#cfe5dc] bg-[#eaf7f2] shadow-[0_18px_48px_rgba(8,24,39,.10)] sm:left-5 sm:right-5 sm:top-5 sm:h-[250px]" />
            <div className="absolute inset-x-0 top-0 z-10 rounded-[26px] border border-[#dcebe5] bg-white p-5 shadow-[0_24px_60px_rgba(8,24,39,.14)]">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-[.18em] text-[#00a982]">Galerie IAMTRADER</span>
                <span className="rounded-full bg-[#eafbf6] px-2.5 py-1 text-[9px] font-bold text-[#168c73]">{items.length ? items.length + ' avis' : 'Aperçu'}</span>
              </div>
              {items.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: Math.max(2, Math.min(4, items.length)) }, (_, i) => items[(activeIndex + i) % items.length]).map((item, i) => (
                    <button key={item.id + '-' + i} type="button" onClick={() => setActiveIndex(items.findIndex(entry => entry.id === item.id))} className={'flex min-w-0 items-center gap-2 rounded-2xl border p-2.5 text-left transition-all ' + (i === 0 ? 'border-[#8edbc4] bg-[#f0fbf7] shadow-sm' : 'border-[#e8f0ec] bg-white hover:border-[#b9ded1]')}>
                      <img src={item.photoURL} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
                      <span className="min-w-0"><b className="block truncate text-[10px] text-[#183047]">{item.fullName}</b><span className="mt-0.5 block truncate text-[9px] text-[#7d918a]">{item.message}</span></span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {[0, 1].map(index => <div key={index} className="rounded-2xl border border-[#dcebe5] bg-[#f7fbf9] p-3"><div className="h-8 w-8 rounded-xl bg-[#dff5ec]" /><div className="mt-3 h-2 w-20 rounded bg-[#dcebe5]" /><div className="mt-2 h-2 w-full rounded bg-[#edf3f0]" /></div>)}
                </div>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-[#edf2ef] pt-3">
                <span className="text-[9px] font-semibold text-[#8aa095]">Des parcours. Une progression.</span>
                <div className="flex gap-1"><span className="h-1.5 w-5 rounded-full bg-[#00a982]" /><span className="h-1.5 w-1.5 rounded-full bg-[#dcebe5]" /><span className="h-1.5 w-1.5 rounded-full bg-[#dcebe5]" /></div>
              </div>
            </div>
            <p className="absolute bottom-0 left-0 right-0 text-center text-[10px] font-semibold tracking-wide text-[#81958d]">Sélectionnez une micro-carte pour afficher son témoignage</p>
          </div>

          <div className="min-w-0 py-2">
            <div className="flex items-center justify-between gap-3 border-b border-[#dcebe5] pb-4">
              <span className="text-[10px] font-black uppercase tracking-[.18em] text-[#00a982]">Témoignage à la une</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setActiveIndex(index => items.length ? (index - 1 + items.length) % items.length : 0)} disabled={!items.length} aria-label="Témoignage précédent" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dcebe5] text-[#36566b] transition hover:border-[#00a982] hover:text-[#008f70] disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" onClick={() => setActiveIndex(index => items.length ? (index + 1) % items.length : 0)} disabled={!items.length} aria-label="Témoignage suivant" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#081827] text-white transition hover:bg-[#00a982] disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>

            {activeItem ? (
              <div key={activeItem.id} className="animate-[landing-fade-up_.45s_ease_both]">
                <div className="mt-5 flex items-center gap-3">
                  <img src={activeItem.photoURL} alt={activeItem.fullName} className="h-12 w-12 rounded-full border-2 border-white object-cover shadow-sm" />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black text-[#10243b]">{activeItem.fullName}</h3>
                    <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-[#8aa095]">Utilisateur IAMTRADER</p>
                    <div className="mt-1.5 flex gap-0.5">{[1, 2, 3, 4, 5].map(number => <Star key={number} className={'h-3 w-3 ' + (number <= activeItem.rating ? 'fill-[#e9b34c] text-[#e9b34c]' : 'text-[#d9e1dd]')} />)}</div>
                  </div>
                </div>
                <p className="mt-5 whitespace-pre-line text-[14px] leading-7 text-[#53697e] sm:text-[15px] sm:leading-8">“{activeItem.message}”</p>
                <div className="mt-5 flex items-center justify-between border-t border-[#dcebe5] pt-3 text-[10px] font-bold text-[#168c73]">
                  <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Témoignage vérifié et modéré</span>
                  <span>{activeIndex + 1} / {items.length}</span>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[190px] flex-col items-center justify-center py-8 text-center">
                <MessageSquareQuote className="h-8 w-8 text-[#00a982]" />
                <h3 className="mt-3 text-base font-extrabold text-[#183047]">Les premiers témoignages arrivent bientôt.</h3>
                <p className="mt-2 max-w-sm text-xs leading-6 text-[#7a8f87]">Les expériences validées par notre équipe apparaîtront ici.</p>
              </div>
            )}

            {items.length > 0 && <div className="mt-5 flex flex-wrap items-center gap-2">{items.map((item, index) => (
              <button key={item.id} type="button" onClick={() => setActiveIndex(index)} aria-label={'Afficher le témoignage de ' + item.fullName} aria-pressed={activeIndex === index} className={'flex items-center gap-2 rounded-full border p-1.5 pr-3 transition-all ' + (activeIndex === index ? 'border-[#00a982] bg-white shadow-sm ring-2 ring-[#00a982]/10' : 'border-[#dcebe5] bg-white/70 hover:border-[#9bd8c5]')}>
                <img src={item.photoURL} alt="" className="h-7 w-7 rounded-full object-cover" /><span className="max-w-[110px] truncate text-[10px] font-bold text-[#36566b]">{item.fullName}</span>
              </button>
            ))}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
