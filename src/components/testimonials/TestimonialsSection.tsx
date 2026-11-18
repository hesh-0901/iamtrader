import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MessageSquareQuote, ShieldCheck, Star } from 'lucide-react';
import { subscribePublishedTestimonials, subscribeTestimonialReactions, toggleTestimonialReaction, TESTIMONIAL_REACTION_EMOJIS, type TestimonialReactionSummary, type TestimonialReactionEmoji, type TraderTestimonial } from '../../services/testimonials';

export function TestimonialsSection() {
  const [items, setItems] = useState<TraderTestimonial[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reactionSummary, setReactionSummary] = useState<TestimonialReactionSummary>({ counts: {}, myReaction: null });
  const [reactionBusy, setReactionBusy] = useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const reactionPickerRef = useRef<HTMLDivElement>(null);
  const activeItem = items.length ? items[Math.min(activeIndex, items.length - 1)] : null;

  useEffect(() => {
    return subscribePublishedTestimonials(setItems, error => console.error('[Testimonials]', error));
  }, []);

  useEffect(() => {
    setActiveIndex(index => items.length ? Math.min(index, items.length - 1) : 0);
  }, [items.length]);
  
  useEffect(() => {
    setReactionSummary({ counts: {}, myReaction: null });
    if (!activeItem) return;
    return subscribeTestimonialReactions(activeItem.id, setReactionSummary, error => {
      console.error('[Testimonial reactions]', error);
    });
  }, [activeItem?.id]);

  useEffect(() => {
    if (!reactionPickerOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (reactionPickerRef.current && !reactionPickerRef.current.contains(event.target as Node)) setReactionPickerOpen(false);
    };
    const closeOnScroll = () => setReactionPickerOpen(false);
    document.addEventListener('pointerdown', closeOnOutsideClick);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      window.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [reactionPickerOpen]);

  const handleReaction = async (emoji: TestimonialReactionEmoji) => {
    if (!activeItem || reactionBusy) return;
    setReactionBusy(true);
    setReactionPickerOpen(false);
    try {
      await toggleTestimonialReaction(activeItem.id, emoji);
    } catch (error: any) {
      console.error('[Testimonial reaction]', error);
    } finally {
      setReactionBusy(false);
    }
  };


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
          <div className="mx-auto w-full max-w-[510px]" aria-label="Galerie de témoignages">
            <div className="mb-5 flex items-center justify-between px-1">
              <span className="text-[10px] font-black uppercase tracking-[.2em] text-[#00a982]">Galerie IAMTRADER</span>
              <span className="rounded-full bg-[#eafbf6] px-3 py-1.5 text-[10px] font-bold text-[#168c73]">{items.length ? items.length + ' avis' : 'Aperçu'}</span>
            </div>
            {activeItem ? (
              <div className="relative isolate px-2 pb-5 pt-1">
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 bottom-1 top-7 -z-20 rotate-[4deg] rounded-[26px] border border-[#cfe5dc] bg-[#e4f4ed] shadow-[0_10px_24px_rgba(8,24,39,.05)]" />
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-4 bottom-2 top-4 -z-10 -rotate-[2.5deg] rounded-[26px] border border-[#dcebe5] bg-white shadow-[0_12px_28px_rgba(8,24,39,.07)]" />
                <button
                  key={activeItem.id}
                  type="button"
                  aria-label={"Afficher le témoignage suivant après : " + activeItem.fullName}
                  onClick={() => setActiveIndex(index => items.length ? (index + 1) % items.length : 0)}
                  className="relative z-10 flex min-h-[190px] w-full cursor-pointer items-start gap-4 rounded-[26px] border border-[#55c9a8] bg-[#f4fcf8] p-5 text-left shadow-[0_18px_42px_rgba(8,24,39,.11)] ring-1 ring-[#00a982]/15 transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a982] sm:p-6"
                >
                  <img src={activeItem.photoURL} alt="" className="h-[76px] w-[76px] shrink-0 rounded-2xl object-cover ring-2 ring-white shadow-sm sm:h-[88px] sm:w-[88px]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <b className="truncate text-[13px] font-extrabold text-[#183047]">{activeItem.fullName}</b>
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-[#00a982]">À la une</span>
                    </span>
                    <span className="mt-2 block text-[11px] leading-[1.7] text-[#71877e] line-clamp-4">{activeItem.message}</span>
                    <span className="mt-3 flex gap-0.5">{[1,2,3,4,5].map(star => <Star key={star} className={'h-3 w-3 ' + (star <= activeItem.rating ? 'fill-[#e9b34c] text-[#e9b34c]' : 'text-[#d9e1dd]')} />)}</span>
                  </span>
                </button>
              </div>
            ) : (
              <div className="rounded-[24px] border border-[#dcebe5] bg-white p-6 shadow-[0_12px_32px_rgba(8,24,39,.06)]">
                <div className="h-12 w-12 rounded-xl bg-[#dff5ec]" />
                <div className="mt-4 h-2 w-28 rounded bg-[#dcebe5]" />
                <div className="mt-3 h-2 w-full rounded bg-[#edf3f0]" />
                <div className="mt-2 h-2 w-4/5 rounded bg-[#edf3f0]" />
              </div>
            )}
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
                <div className="mt-8 flex items-center justify-between gap-3 border-t border-[#dcebe5] pt-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-2" aria-label="Réactions au témoignage">
                    {TESTIMONIAL_REACTION_EMOJIS.map(emoji => {
                      const count = reactionSummary.counts[emoji] || 0;
                      return (
                        <span key={emoji} title={emoji + ' : ' + count} className={'inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-xs font-semibold tabular-nums ' + (reactionSummary.myReaction === emoji ? 'bg-[#e4f8f1] text-[#087c61] ring-1 ring-[#00a982]/40' : 'bg-white/80 text-[#587064]')}>
                          <span className="text-base leading-none">{emoji}</span>
                          <span>{count}</span>
                        </span>
                      );
                    })}
                  </div>
                  <div ref={reactionPickerRef} className="relative shrink-0">
                    <button type="button" onClick={() => setReactionPickerOpen(open => !open)} disabled={reactionBusy} aria-label="Ajouter une réaction" aria-expanded={reactionPickerOpen} className={'flex h-9 w-9 items-center justify-center rounded-full border text-lg transition disabled:opacity-50 ' + (reactionPickerOpen || reactionSummary.myReaction ? 'border-[#00a982] bg-[#e4f8f1]' : 'border-[#dcebe5] bg-white hover:border-[#8bd7bf] hover:bg-[#f1fbf7]')}>
                      {reactionSummary.myReaction || '😊'}
                    </button>
                    {reactionPickerOpen && <div className="absolute bottom-11 right-0 z-30 flex items-center gap-1.5 rounded-2xl border border-[#dcebe5] bg-white p-2 shadow-[0_12px_32px_rgba(8,24,39,.16)] animate-[landing-fade-up_.16s_ease_both]">
                      {TESTIMONIAL_REACTION_EMOJIS.map(emoji => <button key={emoji} type="button" onClick={() => void handleReaction(emoji)} disabled={reactionBusy} aria-label={'Réagir avec ' + emoji} className={'flex h-9 w-9 items-center justify-center rounded-xl text-xl transition hover:scale-110 hover:bg-[#eafbf6] ' + (reactionSummary.myReaction === emoji ? 'bg-[#e4f8f1] ring-1 ring-[#00a982]' : '')}>{emoji}</button>)}
                    </div>}
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between text-[10px] font-bold text-[#168c73]">
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
