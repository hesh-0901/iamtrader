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
function dateTime(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset' }).format(new Date(value));
}


function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] || char));
}

function printInvoice(item: PaymentHistoryItem, number: number) {
  const popup = window.open('', '_blank', 'width=900,height=1100');
  if (!popup) return;

  const plan = escapeHtml(item.planName || (item.plan === 'pro' ? 'Plus' : 'Community'));
  const reference = escapeHtml(item.reference || item.id);
  const invoice = escapeHtml(item.invoiceNumber || ('INV-' + String(number).padStart(4, '0')));
  const buyerEmail = escapeHtml(item.buyerEmail || '—');
  const displayName = escapeHtml(item.displayName || item.payerName || '—');
  const fullName = escapeHtml(item.fullName || '—');
  const payerPhone = escapeHtml(item.payerPhone || '—');
  const issuedAt = dateTime(item.createdAt);
  const paidAt = dateTime(item.paidAt || item.createdAt);
  const action = item.subscriptionAction === 'renewal' ? 'Renouvellement' : item.subscriptionAction === 'upgrade' ? 'Upgrade programmé' : 'Nouvelle souscription';
  const activation = item.activationStartAt ? date(item.activationStartAt) + ' → ' + date(item.activationExpiresAt) : '—';
  const total = money(item.amount, item.currency);
  const base = money(item.baseAmount, item.currency);
  const fee = money(item.paymentFee, item.currency);

  const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Facture ' + invoice + ' — IAMTRADER</title><style>' +
    '*{box-sizing:border-box}body{margin:0;background:#eef2f5;color:#101828;font-family:Inter,Arial,sans-serif}.page{width:794px;min-height:1123px;margin:28px auto;background:#fff;padding:48px 56px;position:relative;box-shadow:0 18px 55px rgba(16,24,40,.12);overflow:hidden}.page:before{content:"";position:absolute;top:0;left:0;right:0;height:5px;background:#00a982}.header{display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0 30px;border-bottom:1px solid #e4e7ec}.invoice-logo{display:block;width:190px;height:auto;max-height:58px;object-fit:contain;object-position:left center}.subtitle{margin-top:7px;font-size:10px;color:#667085;letter-spacing:.03em}.invoice-title{text-align:right}.invoice-title h1{margin:0;font-size:28px;letter-spacing:.12em;font-weight:900;color:#071a2d}.invoice-title .number{display:inline-block;margin-top:8px;padding:5px 9px;border-radius:6px;background:#f0fbf8;color:#007f60;font-size:11px;font-weight:900;letter-spacing:.04em}.summary{display:grid;grid-template-columns:1.15fr 1fr .85fr;gap:0;margin:25px 0 30px;border:1px solid #e4e7ec;border-radius:10px;overflow:hidden}.summary div{background:#f8fafc;padding:13px 15px;border-right:1px solid #e4e7ec}.summary div:last-child{border-right:0}.label{font-size:8px;text-transform:uppercase;letter-spacing:.14em;color:#98a2b3;font-weight:900}.value{margin-top:5px;font-size:11px;font-weight:800;color:#101828}.columns{display:grid;grid-template-columns:1.15fr .85fr;gap:38px;margin:30px 0 34px}.section-title{font-size:8px;text-transform:uppercase;letter-spacing:.16em;font-weight:900;color:#98a2b3;margin-bottom:10px}.buyer-name{font-size:18px;font-weight:900;letter-spacing:-.02em;margin-bottom:9px;color:#071a2d}.detail{font-size:10.5px;color:#475467;line-height:1.9}.detail strong{color:#344054;font-weight:800}.transaction{border-left:1px solid #e4e7ec;padding-left:28px}.table{width:100%;border-collapse:collapse;margin-top:6px}.table th{font-size:8px;text-transform:uppercase;letter-spacing:.12em;color:#98a2b3;text-align:left;border-top:1px solid #101828;border-bottom:1px solid #d0d5dd;padding:11px 8px}.table td{font-size:11.5px;padding:18px 8px;border-bottom:1px solid #eaecf0;color:#344054}.table td strong{color:#101828;font-weight:900}.right{text-align:right}.muted{font-size:9.5px;color:#98a2b3;margin-top:5px}.totals{width:285px;margin:25px 0 0 auto}.totals div{display:flex;justify-content:space-between;padding:7px 0;font-size:10.5px;color:#667085}.totals div b{color:#344054}.grand{margin-top:8px;padding:13px 0!important;border-top:2px solid #071a2d;font-size:17px!important;font-weight:900;color:#071a2d!important}.grand span:last-child{color:#00a982}.paid-box{margin-top:42px;padding:17px 19px;border:1px solid #b7eadf;border-radius:10px;background:linear-gradient(90deg,#f0fbf8,#f8fffd);display:flex;justify-content:space-between;align-items:center}.paid-title{font-size:9px;font-weight:900;color:#007f60;text-transform:uppercase;letter-spacing:.14em}.paid-text{font-size:9.5px;color:#667085;margin-top:5px}.paid{padding:6px 12px;border-radius:999px;background:#071a2d;color:#fff;font-size:8px;font-weight:900;letter-spacing:.1em}.footer{position:absolute;left:56px;right:56px;bottom:38px;border-top:1px solid #e4e7ec;padding-top:13px;display:flex;justify-content:space-between;gap:30px;font-size:8.5px;line-height:1.6;color:#98a2b3}.footer strong{color:#344054}@page{size:A4;margin:0}@media print{html,body{background:#fff!important;margin:0!important;padding:0!important}.page{width:210mm;min-height:297mm;margin:0;box-shadow:none;padding:48px 56px}.no-print{display:none!important}}' +
    '</style></head><body><main class="page">' +
    '<header class="header"><div><img class="invoice-logo" src="/brand/logo-iamtrader-full.png" alt="IAMTRADER"><div class="subtitle">Trading Performance SaaS</div></div><div class="invoice-title"><h1>FACTURE</h1><div class="number">' + invoice + '</div></div></header>' +
    '<section class="summary"><div><div class="label">Référence</div><div class="value">' + reference + '</div></div><div><div class="label">Émise le</div><div class="value">' + issuedAt + '</div></div><div><div class="label">Statut</div><div class="value">Paiement confirmé</div></div></section>' +
    '<section class="columns"><div><div class="section-title">Facturé à</div><div class="buyer-name">' + fullName + '</div><div class="detail"><strong>Nom complet :</strong> ' + fullName + '<br><strong>Display name :</strong> ' + displayName + '<br><strong>Email :</strong> ' + buyerEmail + '<br><strong>Mobile Money :</strong> ' + payerPhone + '</div></div>' +
    '<div class="transaction"><div class="section-title">Transaction</div><div class="detail"><strong>Type :</strong> ' + action + '<br><strong>Paiement :</strong> ' + paidAt + '<br><strong>Méthode :</strong> Mobile Money</div></div></section>' +
    '<table class="table"><thead><tr><th>Description</th><th>Période d’activation</th><th class="right">Montant</th></tr></thead><tbody><tr><td><strong>Abonnement ' + plan + '</strong><div class="muted">Accès aux fonctionnalités IAMTRADER</div></td><td>' + activation + '</td><td class="right">' + base + '</td></tr></tbody></table>' +
    '<div class="totals"><div><span>Sous-total</span><b>' + base + '</b></div><div><span>Frais de paiement · 3 %</span><b>+' + fee + '</b></div><div class="grand"><span>Total payé</span><span>' + total + '</span></div></div>' +
    '<div class="paid-box"><div><div class="paid-title">Transaction réglée</div><div class="paid-text">Le paiement a été enregistré avec succès le ' + paidAt + '.</div></div><span class="paid">PAYÉ</span></div>' +
    '<footer class="footer"><div><strong>IAMTRADER</strong><br>Justificatif officiel de paiement.</div><div style="text-align:right"><strong>' + invoice + '</strong><br>Référence : ' + reference + '</div></footer>' +
    '</main><div class="no-print toolbar" role="toolbar" aria-label="Actions de facture"><button onclick="window.print()" title="Imprimer" aria-label="Imprimer" class="icon-btn print-btn"><span aria-hidden="true">🖨</span></button><button onclick="saveInvoice()" title="Enregistrer la facture" aria-label="Enregistrer la facture" class="icon-btn save-btn"><span aria-hidden="true">↓</span></button></div><script>function saveInvoice(){const clone=document.documentElement.cloneNode(true);clone.querySelectorAll(".no-print").forEach(function(el){el.remove()});const blob=new Blob(["<!doctype html>\\n"+clone.outerHTML],{type:"text/html;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=document.title.replace(/[^a-zA-Z0-9_-]+/g,"-")+".html";document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000)}</script><style>.toolbar{position:fixed;top:18px;right:18px;display:flex;gap:6px;padding:5px;border:1px solid rgba(16,24,40,.08);border-radius:10px;background:rgba(255,255,255,.88);backdrop-filter:blur(10px);box-shadow:0 6px 22px rgba(16,24,40,.08)}.icon-btn{width:32px;height:32px;border:0;border-radius:7px;background:transparent;color:#667085;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;cursor:pointer}.icon-btn:hover{background:#f2f4f7;color:#071a2d}.print-btn span{font-size:14px}.save-btn span{font-size:18px;line-height:1;transform:translateY(-1px)}</style></body></html>';

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
                  <div className="mt-1 text-[10px] text-slate-400">Réf. {item.reference} · {item.invoiceNumber || ('INV-' + String((page - 1) * pageSize + index + 1).padStart(4, '0'))} · {dateTime(item.paidAt || item.createdAt)}</div>
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
