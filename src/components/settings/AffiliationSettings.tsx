import React, { useEffect, useState } from 'react';
import { auth } from '../../services/firebase';

type ReferralStats = { code: string; link: string; invited: number; paid: number; target: number; credit: number; currency: string; rewardStatus: string };
export function AffiliationSettings() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Chargement de votre espace affiliation…</div>;
  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>;
  if (!stats) return null;
  const progress = Math.min(100, Math.round(stats.paid / stats.target * 100));
  return <div className="space-y-5">
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Programme IAMTRADER</p>
      <h2 className="mt-2 text-2xl font-black text-slate-950">Votre espace affiliation</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Invitez des traders à rejoindre IAMTRADER. Les conversions sont validées uniquement après confirmation effective du paiement de leur abonnement.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Invitations attribuées</p><p className="mt-1 text-2xl font-black text-slate-900">{stats.invited}</p></div>
        <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Abonnements payés</p><p className="mt-1 text-2xl font-black text-slate-900">{stats.paid} / {stats.target}</p></div>
        <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Crédit disponible</p><p className="mt-1 text-2xl font-black text-slate-900">{stats.credit.toFixed(2)} {stats.currency}</p></div>
      </div>
      <div className="mt-5"><div className="mb-2 flex justify-between text-xs font-semibold text-slate-600"><span>Progression vers le seuil de récompense</span><span>{stats.paid} / {stats.target}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: progress + '%' }} /></div></div>
    </section>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <h3 className="text-sm font-extrabold text-slate-900">Votre code personnel</h3>
      <div className="mt-3 flex flex-wrap items-center gap-3"><code className="rounded-xl bg-slate-100 px-4 py-3 text-lg font-black tracking-widest text-slate-900">{stats.code}</code><button onClick={() => copy(stats.code)} className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50">Copier le code</button></div>
      <h3 className="mt-6 text-sm font-extrabold text-slate-900">Votre lien de parrainage</h3>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input readOnly value={stats.link} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700" /><button onClick={() => copy(stats.link)} className="rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white">Copier le lien</button></div>
      <p className="mt-4 text-xs leading-5 text-slate-500">Le code reste associé à votre compte. Un filleul ne peut être attribué qu'une seule fois. Les inscriptions seules ne déclenchent aucune récompense.</p>
    </section>
  </div>;
}
