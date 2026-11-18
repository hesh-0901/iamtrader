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
    <section id="testimonials" className="relative isolate overflow-hidden border-y border-[#dcebe5] bg-[#f5faf8] px-5 py-12 sm:px-10 sm:py-14 lg:px-14 scroll-mt-20">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,199,150,0.12),transparent_58%)]" />
      <div className="pointer-events-none absolute -right-24 top-24 -z-10 h-80 w-80 rounded-full bg-[#00a982]/[0.045] blur-3xl" />
      <div className="mx-auto max-w-[1440px]">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-[11px] font-black uppercase tracking-[0.22em] text-[#00a982]">La parole aux traders</span>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-[#081827] sm:text-4xl">Les traders racontent leur progression</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#647b8d]">Découvrez les expériences et les parcours de la communauté IAMTRADER.</p>
        </div>

        <div className="mt-9 grid items-center gap-8 lg:grid-cols-[minmax(390px,.88fr)_minmax(0,1.32fr)] lg:gap-14 xl:gap-20">
          <div className="relative mx-auto w-full max-w-[510px]" aria-label="Galerie de témoignages">
            <div className="absolute inset-x-8 -bottom-4 top-8 rotate-[-3deg] rounded-[28px] border border-[#dcebe5] bg-white/65 shadow-[0_12px_32px_rgba(8,24,39,.06)]" />
            <div className="absolute inset-x-4 -bottom-2 top-4 rotate-[2deg] rounded-[28px] border border-[#cfe5dc] bg-[#eaf7f2] shadow-[0_14px_34px_rgba(8,24,39,.07)]" />
            <div className="relative z-10 rounded-[28px] border border-[#dcebe5] bg-white p-5 shadow-[0_22px_55px_rgba(8,24,39,.12)] sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[.2em] text-[#00a982]">Galerie IAMTRADER</span>
                <span className="rounded-full bg-[#eafbf6] px-3 py-1.5 text-[10px] font-bold text-[#168c73]">{items.length ? items.length + ' avis' : 'Aperçu'}</span>
              </div>
              {items.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {items.slice(0, 4).map(item => {
                    const itemIndex = items.findIndex(entry => entry.id === item.id);
                    const selected = itemIndex === activeIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveIndex(itemIndex)}
                        aria-pressed={selected}
                        className={'group flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-200 ' + (selected ? 'border-[#55c9a8] bg-[#effbf6] shadow-[0_7px_20px_rgba(0,169,130,.10)] ring-1 ring-[#00a982]/15' : 'border-[#e8f0ec] bg-white hover:-translate-y-0.5 hover:border-[#b9ded1] hover:shadow-md')}
                      >
                        <img src={item.photoURL} alt="" className="h-[58px] w-[58px] shrink-0 rounded-xl object-cover ring-2 ring-white shadow-sm" />
                        <span className="min-w-0 flex-1">
                          <b className="block truncate text-[12px] font-extrabold text-[#183047]">{item.fullName}</b>
                          <span className="mt-1.5 block text-[10px] leading-4 text-[#7d918a] line-clamp-2">{item.message}</span>
                          <span className="mt-2 flex gap-0.5">{[1,2,3,4,5].map(star => <Star key={star} className={'h-3 w-3 ' + (star <= item.rating ? 'fill-[#e9b34c] text-[#e9b34c]' : 'text-[#d9e1dd]')} />)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[0, 1].map(index => <div key={index} className="rounded-2xl border border-[#dcebe5] bg-[#f7fbf9] p-4"><div className="h-12 w-12 rounded-xl bg-[#dff5ec]" /><div className="mt-3 h-2 w-24 rounded bg-[#dcebe5]" /><div className="mt-2 h-2 w-full rounded bg-[#edf3f0]" /></div>)}
                </div>
              )}
              <div className="mt-5 flex items-center justify-between border-t border-[#edf2ef] pt-3">
                <span className="text-[10px] font-semibold text-[#8aa095]">Chaque carte raconte une expérience.</span>
                <div className="flex gap-1"><span className="h-1.5 w-5 rounded-full bg-[#00a982]" /><span className="h-1.5 w-1.5 rounded-full bg-[#dcebe5]" /><span className="h-1.5 w-1.5 rounded-full bg-[#dcebe5]" /></div>
              </div>
            </div>
            <p className="mt-7 text-center text-[10px] font-semibold tracking-wide text-[#81958d]">Sélectionnez une carte pour lire le témoignage complet</p>
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3 border-b border-[#dcebe5] pb-4">
              <span className="text-[10px] font-black uppercase tracking-[.2em] text-[#00a982]">Témoignage à la une</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setActiveIndex(index => items.length ? (index - 1 + items.length) % items.length : 0)} disabled={!items.length} aria-label="Témoignage précédent" className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dcebe5] text-[#36566b] transition hover:border-[#00a982] hover:text-[#008f70] disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" onClick={() => setActiveIndex(index => items.length ? (index + 1) % items.length : 0)} disabled={!items.length} aria-label="Témoignage suivant" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#081827] text-white transition hover:bg-[#00a982] disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>

            {activeItem ? (
              <div key={activeItem.id} className="relative isolate overflow-hidden pt-6 sm:pt-7 animate-[landing-fade-up_.45s_ease_both]">
                <div aria-hidden="true" className="pointer-events-none absolute -right-1 -top-7 -z-10 select-none bg-gradient-to-br from-[#00b889]/25 via-[#00b889]/10 to-transparent bg-clip-text text-[190px] font-black leading-none text-transparent sm:-right-2 sm:text-[230px]">“</div>
                <div className="relative flex items-center gap-5 sm:gap-7">
                  <img src={activeItem.photoURL} alt={activeItem.fullName} className="h-24 w-24 shrink-0 rounded-[26px] border-4 border-white object-cover shadow-[0_12px_32px_rgba(8,24,39,.15)] ring-1 ring-[#cfe5dc] sm:h-28 sm:w-28 sm:rounded-[30px] lg:h-32 lg:w-32" />
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black tracking-tight text-[#10243b] sm:text-xl">{activeItem.fullName}</h3>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[.16em] text-[#8aa095]">Utilisateur IAMTRADER</p>
                    <div className="mt-2.5 flex gap-1">{[1, 2, 3, 4, 5].map(number => <Star key={number} className={'h-4 w-4 ' + (number <= activeItem.rating ? 'fill-[#e9b34c] text-[#e9b34c]' : 'text-[#d9e1dd]')} />)}</div>
                  </div>
                </div>
                <div className="relative mt-7 pl-1 sm:mt-8 sm:pl-2">
                  <span aria-hidden="true" className="pointer-events-none absolute -left-3 -top-10 select-none bg-gradient-to-b from-[#00b889]/30 to-[#00b889]/[0.04] bg-clip-text text-7xl font-black leading-none text-transparent sm:-left-5 sm:-top-12 sm:text-8xl">“</span>
                  <p className="relative whitespace-pre-line text-[16px] font-medium leading-8 text-[#405c72] sm:text-[18px] sm:leading-[2.05rem]">{activeItem.message}</p>
                  <span aria-hidden="true" className="absolute -bottom-12 right-1 select-none bg-gradient-to-t from-[#00b889]/25 to-[#00b889]/[0.04] bg-clip-text text-7xl font-black leading-none text-transparent sm:-bottom-14 sm:text-8xl">”</span>
                </div>
                <div className="mt-12 flex items-center justify-between border-t border-[#dcebe5] pt-4 text-[10px] font-bold text-[#168c73]">
                  <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Témoignage vérifié et modéré</span>
                  <span className="tabular-nums">{activeIndex + 1} / {items.length}</span>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[230px] flex-col items-center justify-center py-8 text-center">
                <MessageSquareQuote className="h-9 w-9 text-[#00a982]" />
                <h3 className="mt-3 text-base font-extrabold text-[#183047]">Les premiers témoignages arrivent bientôt.</h3>
                <p className="mt-2 max-w-sm text-xs leading-6 text-[#7a8f87]">Les expériences validées par notre équipe apparaîtront ici.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
