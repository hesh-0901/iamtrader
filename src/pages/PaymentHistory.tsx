import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, CreditCard, History, Receipt, ReceiptText, XCircle } from 'lucide-react';
import { getPaymentHistory, PaymentHistoryItem } from '../services/paymentHistory';

function money(value: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value);
}

function date(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] || char));
}

function printInvoice(item: PaymentHistoryItem, number: number) {
  const popup = window.open('', '_blank', 'width=900,height=1000');
  if (!popup) return;
  const plan = escapeHtml(item.planName || (item.plan === 'pro' ? 'Plus' : 'Community'));
  const reference = escapeHtml(item.reference || item.id);
  const invoiceNumber = 'INV-' + String(number).padStart(4, '0') + '-' + item.id.slice(-8).toUpperCase();
  const action = item.subscriptionAction === 'renewal' ? 'Renouvellement' : item.subscriptionAction === 'upgrade' ? 'Upgrade programmé' : 'Nouvelle souscription';
  const paymentDate = date(item.paidAt || item.createdAt);
  const activation = item.activationStartAt ? date(item.activationStartAt) + ' → ' + date(item.activationExpiresAt) : '—';
  const total = money(item.amount, item.currency);
  const base = money(item.baseAmount, item.currency);
  const fee = money(item.paymentFee, item.currency);
  const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Facture ' + invoiceNumber + ' — IAMTRADER</title><style>' +
    '*{box-sizing:border-box}body{margin:0;background:#f3f6f8;color:#0f172a;font-family:Inter,Arial,sans-serif}.page{width:820px;max-width:calc(100% - 40px);margin:40px auto;background:#fff;padding:52px;border-radius:18px;box-shadow:0 12px 40px rgba(15,23,42,.08)}.top{display:flex;justify-content:space-between;gap:30px;border-bottom:1px solid #e2e8f0;padding-bottom:30px}.brand{font-size:25px;font-weight:900;letter-spacing:-.04em;color:#071a2d}.brand span{color:#00a982}.label{font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:#64748b;font-weight:800}.title{font-size:30px;font-weight:900;margin:6px 0 0}.meta{text-align:right;font-size:12px;line-height:1.8;color:#475569}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:34px 0}.box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px}.box b{display:block;margin-top:5px;font-size:14px}.table{width:100%;border-collapse:collapse;margin-top:12px}.table th{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;text-align:left;border-bottom:1px solid #cbd5e1;padding:12px 8px}.table td{font-size:13px;padding:14px 8px;border-bottom:1px solid #e2e8f0}.right{text-align:right}.total{margin-top:18px;margin-left:auto;width:300px}.total div{display:flex;justify-content:space-between;padding:7px 0;font-size:12px;color:#475569}.grand{border-top:2px solid #0f172a;margin-top:6px;padding-top:14px!important;font-size:18px!important;font-weight:900;color:#0f172a!important}.footer{border-top:1px solid #e2e8f0;margin-top:40px;padding-top:22px;color:#64748b;font-size:11px;line-height:1.7}.paid{display:inline-block;padding:5px 10px;border:1px solid #a7f3d0;background:#ecfdf5;color:#047857;border-radius:999px;font-size:10px;font-weight:800}@media print{body{background:#fff}.page{width:auto;max-width:none;margin:0;box-shadow:none;border-radius:0;padding:35px}.no-print{display:none}}' +
    '</style></head><body><main class="page"><header class="top"><div><div class="brand">IAM<span>TRADER</span></div><div class="label" style="margin-top:8px">Plateforme de gestion de performance des traders</div></div><div class="meta"><div class="label">Facture</div><div class="title">' + invoiceNumber + '</div><div>Date : ' + paymentDate + '</div><div><span class="paid">PAYÉ</span></div></div></header><section class="grid"><div class="box"><div class="label">Client</div><b>Compte IAMTRADER</b><div style="font-size:12px;color:#64748b;margin-top:5px">Abonnement personnel</div></div><div class="box"><div class="label">Transaction</div><b>Réf. ' + reference + '</b><div style="font-size:12px;color:#64748b;margin-top:5px">Type : ' + action + '</div></div></section><table class="table"><thead><tr><th>Description</th><th>Période d’activation</th><th class="right">Montant</th></tr></thead><tbody><tr><td><strong>Abonnement ' + plan + '</strong><br><span style="font-size:11px;color:#64748b">Service IAMTRADER</span></td><td>' + activation + '</td><td class="right">' + base + '</td></tr></tbody></table><div class="total"><div><span>Sous-total</span><b>' + base + '</b></div><div><span>Frais de paiement (3 %)</span><b>+' + fee + '</b></div><div class="grand"><span>Total payé</span><span>' + total + '</span></div></div><div class="footer"><strong>IAMTRADER</strong><br>Cette facture constitue le justificatif de paiement de votre abonnement.<br>Référence de paiement : ' + reference + '</div></main><script>window.onload=function(){}</script><button class="no-print" onclick="window.print()" style="display:block;margin:28px auto 0;padding:11px 18px;border:0;border-radius:10px;background:#071a2d;color:#fff;font-weight:800;cursor:pointer">Imprimer / Enregistrer en PDF</button></body></html>';
  popup.document.write(html);
  popup.document.close();
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
                <div className="flex items-end justify-between gap-3 sm:justify-end"><div className="text-left sm:text-right"><div className="text-lg font-black text-slate-950">{money(item.amount, item.currency)}</div><div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total payé</div></div><button type="button" onClick={() => printInvoice(item, (page - 1) * pageSize + index + 1)} title="Générer la facture" aria-label="Générer la facture" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-[#b7eadf] hover:bg-[#f0fbf8] hover:text-[#008f70]"><ReceiptText className="h-4 w-4" /></button></div>
              </div>;
            })}
          </div>}
      </section>
    </div>
  );
}
