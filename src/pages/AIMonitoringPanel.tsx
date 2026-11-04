import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock3, RefreshCw, Server, ShieldCheck, Zap } from 'lucide-react';
import { adminGetAiMonitoring } from '../services/adminConsole';

type AIEvent = {
  assistant: string;
  provider: string;
  model: string;
  keyAlias: string;
  status: number | null;
  latencyMs: number;
  attempts: number;
  failovers: number;
  outcome: 'success' | 'failure';
  errorCategory: string;
  createdAt: string;
};
type MonitoringData = {
  success: boolean;
  keys: Array<{ alias: string; configured: boolean }>;
  events: AIEvent[];
};

const assistantLabel: Record<string, string> = {
  chloe: 'Chloé',
  vyra: 'VYRA',
  'instrument-suggest': 'Suggestions instruments',
  'economic-calendar-analysis': 'Analyse économique'
};
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
};

export function AIMonitoringPanel() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminGetAiMonitoring<MonitoringData>();
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger la supervision IA.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const events = data?.events || [];
  const summary = useMemo(() => {
    const successful = events.filter(event => event.outcome === 'success').length;
    const failed = events.length - successful;
    const latencies = events.map(event => event.latencyMs).filter(value => value > 0);
    return {
      total: events.length,
      successful,
      failed,
      successRate: events.length ? Math.round(successful / events.length * 100) : null,
      averageLatency: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null,
      failovers: events.reduce((sum, event) => sum + event.failovers, 0)
    };
  }, [events]);

  const keyUsage = useMemo(() => (data?.keys || []).map(key => ({
    ...key,
    calls: events.filter(event => event.keyAlias === key.alias).length,
    errors: events.filter(event => event.keyAlias === key.alias && event.outcome === 'failure').length
  })), [data, events]);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-emerald-700"><ShieldCheck className="h-4 w-4" /> Supervision sécurisée</div>
          <h2 className="mt-2 text-xl font-black text-[#10243b]">Moteur IA central</h2>
          <p className="mt-1 text-sm text-slate-500">État de configuration des clés et activité réelle enregistrée côté serveur.</p>
        </div>
        <button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
        </button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Appels enregistrés', value: summary.total.toLocaleString('fr-FR'), icon: Activity },
          { label: 'Taux de réussite', value: summary.successRate === null ? 'Non disponible' : `${summary.successRate}%`, icon: CheckCircle2 },
          { label: 'Latence moyenne', value: summary.averageLatency === null ? 'Non disponible' : `${summary.averageLatency} ms`, icon: Clock3 },
          { label: 'Basculements', value: summary.total ? summary.failovers.toLocaleString('fr-FR') : 'Non disponible', icon: Zap }
        ].map(item => <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>{item.label}</span><item.icon className="h-4 w-4 text-slate-400" /></div>
          <div className="mt-3 break-words text-2xl font-black tracking-tight text-[#10243b]">{item.value}</div>
        </div>)}
      </div>

      <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><Server className="h-4 w-4 text-slate-500" /><h3 className="font-extrabold text-[#10243b]">Clés Gemini</h3></div>
          <p className="mt-1 text-xs text-slate-500">Les valeurs secrètes ne sont jamais transmises au navigateur.</p>
          <div className="mt-4 space-y-2">
            {keyUsage.map(key => <div key={key.alias} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
              <div className="min-w-0"><div className="text-sm font-bold text-slate-800">{key.alias}</div><div className="mt-0.5 text-xs text-slate-500">{key.calls} appel(s) observé(s) · {key.errors} échec(s)</div></div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${key.configured ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{key.configured ? 'Configurée' : 'Absente'}</span>
            </div>)}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-slate-400">La configuration ne garantit pas que la clé est valide ou que son quota est disponible. L’état de cooldown par instance Worker n’est pas exposé ici.</p>
        </section>

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><h3 className="font-extrabold text-[#10243b]">Activité par assistant</h3><span className="text-xs text-slate-400">250 derniers événements maximum</span></div>
          <div className="mt-4 space-y-3">
            {Object.entries(assistantLabel).map(([id, label]) => {
              const assistantEvents = events.filter(event => event.assistant === id);
              const errors = assistantEvents.filter(event => event.outcome === 'failure').length;
              return <div key={id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <div className="min-w-0"><div className="text-sm font-bold text-slate-800">{label}</div><div className="text-xs text-slate-500">{assistantEvents.length} appel(s) observé(s)</div></div>
                <div className="text-right text-xs"><div className="font-bold text-slate-700">{assistantEvents.length ? `${assistantEvents.length - errors} succès` : 'Aucune donnée'}</div><div className={errors ? 'text-rose-600' : 'text-slate-400'}>{errors} échec(s)</div></div>
              </div>;
            })}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h3 className="font-extrabold text-[#10243b]">Derniers appels IA</h3><p className="mt-1 text-xs text-slate-500">Aucun prompt, fichier joint, token ou contenu privé n’est affiché.</p></div><span className="text-xs font-semibold text-slate-400">{events.length} événement(s)</span></div>
        {loading && !data ? <div className="p-8 text-center text-sm text-slate-500">Chargement de la supervision…</div> : events.length === 0 ? <div className="p-8 text-center"><AlertTriangle className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-2 text-sm font-semibold text-slate-600">Aucun événement de télémétrie disponible.</p><p className="mt-1 text-xs text-slate-400">Les statistiques apparaîtront après les prochains appels IA, si la persistance Firestore est configurée.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>{['Date','Assistant','Modèle','Clé','Résultat','Latence','Basculements'].map(label => <th key={label} className="px-4 py-3 font-bold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{events.map((event,index) => <tr key={event.createdAt + event.assistant + index} className="text-slate-600"><td className="whitespace-nowrap px-4 py-3">{dateLabel(event.createdAt)}</td><td className="px-4 py-3 font-semibold text-slate-800">{assistantLabel[event.assistant] || event.assistant}</td><td className="px-4 py-3">{event.model || '—'}</td><td className="px-4 py-3">{event.keyAlias || '—'}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 font-bold ${event.outcome === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{event.outcome === 'success' ? 'Succès' : `Échec · ${event.errorCategory || event.status || 'erreur'}`}</span></td><td className="px-4 py-3 tabular-nums">{event.latencyMs ? `${event.latencyMs} ms` : '—'}</td><td className="px-4 py-3 tabular-nums">{event.failovers}</td></tr>)}</tbody></table></div>}
      </section>
    </section>
  );
}
