import React, { useEffect, useState } from 'react';
import { auth } from '../../firebase/config';

type ReferralEntry = { uid: string; displayName: string; photoURL?: string; createdAt?: string | null; plan?: string | null; status: 'paid' | 'registered'; firstPaidAt?: string | null };
type ReferralStats = { code: string; link: string; invited: number; paid: number; target: number; credit: number; currency: string; rewardStatus: string; referrals: ReferralEntry[] };
export function AffiliationSettings() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; name: string } | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user) throw new Error('Session expirée. Reconnectez-vous.');
        const token = await user.getIdToken();
        const response = await fetch('/api/referrals', { headers: { Authorization: 'Bearer ' + token } });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Chargement impossible.');
        if (active) setStats(data);
      } catch (e: any) { if (active) setError(e.message || 'Erreur de chargement.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);
  const copy = async (value: string) => { await navigator.clipboard.writeText(value); };
  const CopyButton = ({ value, label }: { value: string; label: string }) => (
    <button
      type="button"
      onClick={() => copy(value)}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
      </svg>
    </button>
  );
  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Chargement de votre espace affiliation…</div>;
  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>;
  if (!stats) return null;
  const progress = Math.min(100, Math.round(stats.paid / stats.target * 100));
  return <div className="w-full min-w-0 space-y-2.5 sm:space-y-4">
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
      <div className="flex min-w-0 items-end gap-2.5 sm:gap-3">
        <div className="min-w-0 w-[34%] flex-none sm:w-auto sm:flex-1">
          <label className="mb-1.5 block truncate text-[9px] font-bold uppercase tracking-wide text-slate-500 sm:text-[10px]">Code personnel</label>
          <div className="flex min-w-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2">
            <code className="min-w-0 flex-1 truncate text-[11px] font-black tracking-wider text-slate-900 sm:text-sm sm:tracking-[0.16em]">{stats.code}</code>
            <CopyButton value={stats.code} label="Copier le code" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <label className="mb-1.5 block truncate text-[9px] font-bold uppercase tracking-wide text-slate-500 sm:text-[10px]">Lien de parrainage</label>
          <div className="flex min-w-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2">
            <span className="min-w-0 flex-1 truncate text-[10px] text-slate-700 sm:text-sm">{stats.link}</span>
            <CopyButton value={stats.link} label="Copier le lien de parrainage" />
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">Votre code reste permanent. Chaque filleul ne peut être attribué qu'une seule fois.</p>
    </section>
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Programme IAMTRADER</p>
      <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl">Votre espace affiliation</h2>
      <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500 sm:text-sm">Invitez des traders à rejoindre IAMTRADER. Les conversions sont validées après confirmation effective du paiement de leur abonnement.</p>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="min-w-0 rounded-xl bg-slate-50 px-2.5 py-3 sm:px-4"><p className="text-[9px] leading-4 text-slate-500 sm:text-xs">Invitations</p><p className="mt-1 text-lg font-extrabold tabular-nums text-slate-900 sm:text-2xl">{stats.invited}</p></div>
        <div className="min-w-0 rounded-xl bg-slate-50 px-2.5 py-3 sm:px-4"><p className="text-[9px] leading-4 text-slate-500 sm:text-xs">Payés</p><p className="mt-1 text-lg font-extrabold tabular-nums text-slate-900 sm:text-2xl">{stats.paid} / {stats.target}</p></div>
        <div className="min-w-0 rounded-xl bg-slate-50 px-2.5 py-3 sm:px-4"><p className="text-[9px] leading-4 text-slate-500 sm:text-xs">Crédit disponible</p><p className="mt-1 truncate text-lg font-extrabold tabular-nums text-slate-900 sm:text-2xl">{stats.credit.toFixed(2)} {stats.currency}</p></div>
      </div>
      <div className="mt-3"><div className="mb-1.5 flex justify-between text-[10px] font-semibold text-slate-500 sm:text-xs"><span>Progression vers la récompense</span><span>{stats.paid} / {stats.target}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: progress + '%' }} /></div></div>
    </section>
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-base font-extrabold text-slate-900">Mes filleuls</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">Traders inscrits avec votre code.</p>
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">{stats.invited} au total</span>
      </div>
      {stats.referrals.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm font-semibold text-slate-700">Aucun filleul pour le moment</p>
          <p className="mt-1 text-xs text-slate-500">Partagez votre lien pour inviter vos premiers traders.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200/70">
          {stats.referrals.map((referral, index) => (
            <div key={referral.uid} className="flex min-w-0 items-center gap-2.5 py-3 sm:gap-3">
              <span className="w-6 shrink-0 text-[11px] font-bold tabular-nums text-slate-400">{String(index + 1).padStart(2, '0')}</span>
              {referral.photoURL ? (
                <button type="button" onClick={() => setPreviewPhoto({ url: referral.photoURL!, name: referral.displayName })} aria-label={`Agrandir la photo de ${referral.displayName}`} title="Agrandir la photo" className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 transition hover:scale-105 hover:ring-2 hover:ring-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <img src={referral.photoURL} alt={referral.displayName} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                </button>
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-extrabold text-slate-600">
                  {referral.displayName.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'T'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{referral.displayName}</p>
                <p className="mt-0.5 text-[10px] leading-4 text-slate-500 sm:text-xs">
                  {referral.createdAt ? new Date(referral.createdAt).toLocaleDateString('fr-FR') : 'Date indisponible'}
                  {referral.plan ? ' · ' + referral.plan : ''}
                  {referral.firstPaidAt ? ' · Payé le ' + new Date(referral.firstPaidAt).toLocaleDateString('fr-FR') : ''}
                </p>
              </div>
              <span className={referral.status === 'paid' ? 'shrink-0 text-[10px] font-bold text-emerald-700 sm:text-xs' : 'shrink-0 text-[10px] font-bold text-amber-700 sm:text-xs'}>
                {referral.status === 'paid' ? 'Payé' : 'Inscrit'}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
    {previewPhoto && (
      <div role="dialog" aria-modal="true" aria-label={`Photo de profil de ${previewPhoto.name}`} onClick={() => setPreviewPhoto(null)} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
        <button type="button" aria-label="Fermer l'aperçu" onClick={() => setPreviewPhoto(null)} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20">×</button>
        <div className="max-h-[85vh] max-w-[min(90vw,560px)]" onClick={(event) => event.stopPropagation()}>
          <img src={previewPhoto.url} alt={previewPhoto.name} className="max-h-[78vh] max-w-full rounded-2xl object-contain shadow-2xl" />
          <p className="mt-3 text-center text-sm font-semibold text-white">{previewPhoto.name}</p>
        </div>
      </div>
    )}
  </div>;
}
