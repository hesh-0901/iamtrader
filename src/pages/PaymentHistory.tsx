import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, CreditCard, History, Receipt, XCircle } from 'lucide-react';
import { getPaymentHistory, PaymentHistoryItem } from '../services/paymentHistory';

function money(value: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value);
}

function date(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function status(item: PaymentHistoryItem) {
  if (item.status === 'paid') return { label: 'Payé', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: CheckCircle2 };
  if (item.status === 'failed') return { label: 'Échoué', cls: 'bg-rose-50 text-rose-700 border-rose-100', icon: XCircle };
  return { label: 'En traitement', cls: 'bg-amber-50 text-amber-700 border-amber-100', icon: Clock3 };
}

export function PaymentHistory() {
  const [items, setItems] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const paginatedItems = items.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    getPaymentHistory().then(setItems).catch((e) => setError(e?.message || 'Impossible de charger l’historique.')).finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const paid = items.filter(item => item.status === 'paid');
    return {
      total: paid.reduce((sum, item) => sum + item.amount, 0),
      fees: paid.reduce((sum, item) => sum + item.paymentFee, 0),
      count: paid.length,
      month: paid.filter(item => {
        if (!item.paidAt) return false;
        const d = new Date(item.paidAt), n = new Date();
        return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
      }).reduce((sum, item) => sum + item.amount, 0)
    };
  }, [items]);

  useEffect(() => {
    setPage(1);
  }, [items]);

  return (
    <div className="w-full max-w-6xl space-y-6">
      <div className="border-b border-slate-200/80 pb-4">
        <span className="rounded-full bg-[#e5faf5] border border-[#ccefe5] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-[#007f60]">Compte financier</span>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Mon historique</h1>
        <p className="mt-1 text-xs text-slate-500">Retrouvez vos abonnements, paiements et montants réellement enregistrés.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><Receipt className="h-4 w-4 text-[#00a982]" /><div className="mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Total dépensé</div><div className="mt-1 text-xl font-black text-slate-950">{money(stats.total, 'USD')}</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><CalendarDays className="h-4 w-4 text-indigo-500" /><div className="mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Ce mois-ci</div><div className="mt-1 text-xl font-black text-slate-950">{money(stats.month, 'USD')}</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><CreditCard className="h-4 w-4 text-slate-500" /><div className="mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Paiements réussis</div><div className="mt-1 text-xl font-black text-slate-950">{stats.count}</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><History className="h-4 w-4 text-amber-500" /><div className="mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Frais de paiement</div><div className="mt-1 text-xl font-black text-slate-950">{money(stats.fees, 'USD')}</div></div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-black text-slate-950">Historique des abonnements</h2><p className="mt-1 text-[11px] text-slate-500">Seules vos propres transactions sont affichées.</p></div>
        {loading ? <div className="py-16 text-center text-xs text-slate-500">Chargement de votre historique…</div> :
          error ? <div className="py-16 text-center text-xs text-rose-600">{error}</div> :
          items.length === 0 ? <div className="py-16 text-center text-xs text-slate-500">Aucun paiement enregistré pour le moment.</div> :
          <div className="divide-y divide-slate-100">
            {paginatedItems.map((item, index) => {
              const s = status(item), Icon = s.icon;
              return <div key={item.id} className="grid gap-4 px-5 py-4 sm:grid-cols-[40px_1.5fr_1fr_auto] sm:items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-xs font-black text-slate-500 border border-slate-200">{(page - 1) * pageSize + index + 1}</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="text-sm font-black text-slate-900">{item.planName || (item.plan === 'pro' ? 'Plus' : 'Community')}</span><span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${s.cls}`}><Icon className="mr-1 inline h-3 w-3" />{s.label}</span></div>
                  <div className="mt-1 text-[10px] text-slate-400">Réf. {item.reference} · {date(item.paidAt || item.createdAt)}</div>
                  <div className="mt-2 text-[10px] text-slate-500">{item.subscriptionAction === 'renewal' ? 'Renouvellement' : item.subscriptionAction === 'upgrade' ? 'Upgrade programmé' : 'Nouvelle souscription'} · Activation {date(item.activationStartAt)} → {date(item.activationExpiresAt)}</div>
                </div>
                <div className="text-[10px] text-slate-500 sm:text-right"><div>Abonnement <b className="text-slate-700">{money(item.baseAmount, item.currency)}</b></div><div className="mt-1">Frais 3 % <b className="text-slate-700">+{money(item.paymentFee, item.currency)}</b></div></div>
                <div className="text-left sm:text-right"><div className="text-lg font-black text-slate-950">{money(item.amount, item.currency)}</div><div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total payé</div></div>
              </div>;
            })}
          </div>}
      </section>
    </div>
  );
}
