import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import {
  ArrowLeftRight, ArrowRight, ChartCandlestick, Clock3, Crosshair,
  Download, Eraser, FolderOpen, Minus, Pause, Play, Plus, Save, Trash2,
  TrendingUp, Upload, X
} from 'lucide-react';

type Candle = { time: UTCTimestamp; open: number; high: number; low: number; close: number };
type DrawingKind = 'trendline' | 'fibonacci' | 'path';
type DrawingPoint = { time: number; price: number };
type Drawing = { id: string; kind: DrawingKind; points: DrawingPoint[] };
type SimPosition = {
  id: string; side: 'BUY' | 'SELL'; entryTime: number; entryPrice: number;
  stopLoss: number | null; takeProfit: number | null; exitTime?: number;
  exitPrice?: number; pnl?: number; status: 'OPEN' | 'CLOSED';
};
type SavedReplay = {
  id: string; name: string; symbol: string; timeframe: string; datasetName?: string; datasetStart: number | null;
  datasetEnd: number | null; candleCount: number; currentIndex: number;
  drawings: Drawing[]; positions: SimPosition[]; updatedAt?: { toDate?: () => Date } | null;
};

const COLORS = {
  bg: '#131722', panel: '#1e222d', border: '#2a2e39', text: '#d1d4dc',
  muted: '#787b86', green: '#089981', red: '#f23645', blue: '#2962ff',
};

function parseCsv(text: string): Candle[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) throw new Error('Le fichier ne contient pas assez de lignes.');
  const delimiter = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
  const normalize = (value: string) => value.trim().toLowerCase().replace(/["']/g, '').replace(/[\s_-]/g, '');
  const headers = lines[0].split(delimiter).map(normalize);
  const findColumn = (...names: string[]) => headers.findIndex(header => names.includes(header));
  const timeIndex = findColumn('time', 'date', 'datetime', 'timestamp', 'gmttime', 'opentime');
  const openIndex = findColumn('open', 'o');
  const highIndex = findColumn('high', 'h');
  const lowIndex = findColumn('low', 'l');
  const closeIndex = findColumn('close', 'c');
  if ([timeIndex, openIndex, highIndex, lowIndex, closeIndex].some(index => index < 0)) {
    throw new Error('Colonnes attendues : time/date, open, high, low, close.');
  }
  const candles: Candle[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(delimiter).map(cell => cell.trim().replace(/^["']|["']$/g, ''));
    const rawTime = cells[timeIndex];
    const numericTime = Number(rawTime);
    let milliseconds: number;
    if (rawTime !== '' && Number.isFinite(numericTime)) {
      milliseconds = rawTime.length <= 10 ? numericTime * 1000 : numericTime;
    } else if (/(?:Z|[+-]\d{2}:?\d{2}|GMT)$/i.test(rawTime)) {
      milliseconds = Date.parse(rawTime);
    } else {
      const match = rawTime.match(/^(\d{4})[./-](\d{2})[./-](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
      milliseconds = match
        ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0))
        : Date.parse(rawTime);
    }
    const values = [cells[openIndex], cells[highIndex], cells[lowIndex], cells[closeIndex]].map(value => Number(value.replace(',', '.')));
    if (!Number.isFinite(milliseconds) || values.some(value => !Number.isFinite(value))) continue;
    const [open, high, low, close] = values;
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || high < low) continue;
    candles.push({ time: Math.floor(milliseconds / 1000) as UTCTimestamp, open, high, low, close });
  }
  const unique = new Map<number, Candle>();
  candles.sort((a, b) => Number(a.time) - Number(b.time)).forEach(candle => unique.set(Number(candle.time), candle));
  const result = [...unique.values()];
  if (result.length < 2) throw new Error('Aucune série OHLC valide trouvée dans le fichier.');
  return result;
}

function timeframeSeconds(value: string): number {
  const values: Record<string, number> = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400 };
  return values[value] || 900;
}
function detectSourceInterval(candles: Candle[]): number {
  const deltas: number[] = [];
  for (let index = 1; index < Math.min(candles.length, 200); index++) {
    const delta = Number(candles[index].time) - Number(candles[index - 1].time);
    if (delta > 0 && delta <= 7 * 86400) deltas.push(delta);
  }
  if (!deltas.length) return 60;
  deltas.sort((a, b) => a - b);
  return deltas[Math.floor(deltas.length / 2)];
}
function resampleCandles(candles: Candle[], targetSeconds: number, sourceSeconds: number): Candle[] {
  if (!candles.length || targetSeconds <= sourceSeconds) return candles;
  const buckets = new Map<number, Candle>();
  for (const candle of candles) {
    const bucketTime = Math.floor(Number(candle.time) / targetSeconds) * targetSeconds;
    const previous = buckets.get(bucketTime);
    if (!previous) {
      buckets.set(bucketTime, { time: bucketTime as UTCTimestamp, open: candle.open, high: candle.high, low: candle.low, close: candle.close });
    } else {
      buckets.set(bucketTime, { ...previous, high: Math.max(previous.high, candle.high), low: Math.min(previous.low, candle.low), close: candle.close });
    }
  }
  return [...buckets.values()].sort((a, b) => Number(a.time) - Number(b.time));
}

function formatPrice(value: number) {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}
function formatDate(value?: number | null) {
  return value ? new Date(value * 1000).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC' : '—';
}
function makeId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
}

export function BacktestModule() {
  const chartHostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pendingRestoreRef = useRef<SavedReplay | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [sourceIntervalSeconds, setSourceIntervalSeconds] = useState(60);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeframe, setTimeframe] = useState('M15');
  const [tool, setTool] = useState<'cursor' | DrawingKind>('cursor');
  const [draftPoints, setDraftPoints] = useState<DrawingPoint[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [positions, setPositions] = useState<SimPosition[]>([]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [stopLossText, setStopLossText] = useState('');
  const [takeProfitText, setTakeProfitText] = useState('');
  const [riskSize, setRiskSize] = useState('1');
  const [sessionName, setSessionName] = useState('Ma session XAUUSD');
  const [savedSessions, setSavedSessions] = useState<SavedReplay[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [datasetName, setDatasetName] = useState('');

  const displayCandles = useMemo(() => resampleCandles(candles, timeframeSeconds(timeframe), sourceIntervalSeconds), [candles, timeframe, sourceIntervalSeconds]);
  const visibleCandles = useMemo(() => displayCandles.slice(0, Math.min(currentIndex + 1, displayCandles.length)), [displayCandles, currentIndex]);

  useEffect(() => {
    if (displayCandles.length && currentIndex >= displayCandles.length) {
      setCurrentIndex(displayCandles.length - 1);
    }
  }, [displayCandles.length, currentIndex]);
  const currentCandle = visibleCandles[visibleCandles.length - 1];
  const openPositions = positions.filter(position => position.status === 'OPEN');
  const closedPositions = positions.filter(position => position.status === 'CLOSED');
  const realizedPnl = closedPositions.reduce((sum, position) => sum + (position.pnl || 0), 0);

  const refreshSessions = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setSavedSessions([]); return; }
    try {
      const sessionsRef = collection(db, 'replaySessions', uid, 'sessions');
      const result = await getDocs(query(sessionsRef, orderBy('updatedAt', 'desc')));
      setSavedSessions(result.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() } as SavedReplay)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les sessions sauvegardées.');
    }
  }, []);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (!chartHostRef.current || chartRef.current) return;
    const chart = createChart(chartHostRef.current, {
      autoSize: true,
      layout: { background: { color: COLORS.bg }, textColor: COLORS.text, fontFamily: 'Inter, Arial, sans-serif' },
      grid: { vertLines: { color: '#1d2330' }, horzLines: { color: '#1d2330' } },
      rightPriceScale: { borderColor: COLORS.border },
      timeScale: { borderColor: COLORS.border, timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { color: '#758696', labelBackgroundColor: COLORS.panel }, horzLine: { color: '#758696', labelBackgroundColor: COLORS.panel } },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.green, downColor: COLORS.red, borderUpColor: COLORS.green,
      borderDownColor: COLORS.red, wickUpColor: COLORS.green, wickDownColor: COLORS.red,
    });
    chartRef.current = chart;
    candleSeriesRef.current = series;
    const resizeObserver = new ResizeObserver(() => chart.timeScale().fitContent());
    resizeObserver.observe(chartHostRef.current);
    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = candleSeriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;
    series.setData(visibleCandles);
    if (visibleCandles.length > 0) {
      chart.timeScale().setVisibleLogicalRange({
        from: Math.max(0, visibleCandles.length - 100),
        to: Math.max(1, visibleCandles.length + 2),
      });
    }
  }, [visibleCandles]);

  useEffect(() => {
    if (!playing || displayCandles.length === 0) return;
    if (currentIndex >= displayCandles.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setInterval(() => {
      const nextIndex = currentIndex + 1;
      const candle = displayCandles[nextIndex];
      if (!candle) { setPlaying(false); return; }
      setPositions(previous => previous.map(position => {
        if (position.status !== 'OPEN') return position;
        const stopHit = position.stopLoss !== null && (position.side === 'BUY' ? candle.low <= position.stopLoss : candle.high >= position.stopLoss);
        const targetHit = position.takeProfit !== null && (position.side === 'BUY' ? candle.high >= position.takeProfit : candle.low <= position.takeProfit);
        if (!stopHit && !targetHit) return position;
        // Conservative OHLC rule: if SL and TP are both hit in the same candle, SL wins.
        const exitPrice = stopHit ? position.stopLoss! : position.takeProfit!;
        const pnl = (position.side === 'BUY' ? exitPrice - position.entryPrice : position.entryPrice - exitPrice) * Number(riskSize || 1);
        return { ...position, status: 'CLOSED', exitTime: Number(candle.time), exitPrice, pnl };
      }));
      setCurrentIndex(nextIndex);
    }, Math.max(80, 700 / speed));
    return () => window.clearInterval(timer);
  }, [playing, displayCandles, currentIndex, speed, riskSize]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!chart || !series) return;
    const onChartClick = (param: MouseEventParams<Time>) => {
      if (tool === 'cursor' || !param.point || !currentCandle) return;
      const time = chart.timeScale().coordinateToTime(param.point.x);
      const price = series.coordinateToPrice(param.point.y);
      if (time === null || price === null || !Number.isFinite(price)) return;
      const point = { time: Number(time), price: Number(price) };
      const next = [...draftPoints, point];
      if (next.length < 2) {
        setDraftPoints(next);
        return;
      }
      setDrawings(items => [...items, { id: makeId(), kind: tool, points: next }]);
      setNotice(tool === 'fibonacci' ? 'Fibonacci ajouté.' : tool === 'path' ? 'Flèche du chemin ajoutée.' : 'Ligne ajoutée.');
      setDraftPoints([]);
      setTool('cursor');
    };
    chart.subscribeClick(onChartClick);
    return () => chart.unsubscribeClick(onChartClick);
  }, [tool, currentCandle, draftPoints]);

  const loadCsv = (file?: File) => {
    if (!file) return;
    setError('');
    setNotice('');
    try {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = parseCsv(String(reader.result || ''));
          const pendingSession = pendingRestoreRef.current;
          const matchesSavedDataset = pendingSession && pendingSession.datasetName === file.name;
          const detectedInterval = detectSourceInterval(parsed);
          const targetBars = resampleCandles(parsed, timeframeSeconds(timeframe), detectedInterval);
          setSourceIntervalSeconds(detectedInterval);
          setCandles(parsed);
          setCurrentIndex(matchesSavedDataset ? Math.min(Math.max(0, pendingSession.currentIndex), targetBars.length - 1) : 0);
          setDrawings(matchesSavedDataset && Array.isArray(pendingSession.drawings) ? pendingSession.drawings : []);
          setPositions(matchesSavedDataset && Array.isArray(pendingSession.positions) ? pendingSession.positions : []);
          setDraftPoints([]);
          if (!matchesSavedDataset) setActiveSessionId('');
          setDatasetName(file.name);
          pendingRestoreRef.current = null;
          setNotice(matchesSavedDataset
            ? 'Session et historique rechargés. Vérifie que le fichier est bien la même version que lors de la sauvegarde.'
            : parsed.length.toLocaleString('fr-FR') + ' bougies sources chargées depuis ' + file.name + '.');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Le fichier historique ne peut pas être lu.');
        }
      };
      reader.onerror = () => setError('Impossible de lire le fichier sélectionné.');
      reader.readAsText(file);
    } catch {
      setError('Impossible de charger le fichier sélectionné.');
    }
  };

  const placePosition = (direction: 'BUY' | 'SELL') => {
    if (!currentCandle) { setError('Importe d’abord un fichier historique réel au format CSV.'); return; }
    if (!Number.isFinite(Number(riskSize)) || Number(riskSize) <= 0) { setError('La taille virtuelle doit être un nombre positif.'); return; }
    const stop = stopLossText.trim() ? Number(stopLossText) : null;
    const target = takeProfitText.trim() ? Number(takeProfitText) : null;
    if ((stop !== null && (!Number.isFinite(stop) || stop <= 0)) || (target !== null && (!Number.isFinite(target) || target <= 0))) {
      setError('Les niveaux SL/TP doivent être des prix positifs.'); return;
    }
    if (stop !== null && (direction === 'BUY' ? stop >= currentCandle.close : stop <= currentCandle.close)) {
      setError('Le Stop Loss doit être sous le prix d’entrée pour BUY et au-dessus pour SELL.'); return;
    }
    if (target !== null && (direction === 'BUY' ? target <= currentCandle.close : target >= currentCandle.close)) {
      setError('Le Take Profit doit être au-dessus du prix d’entrée pour BUY et sous le prix pour SELL.'); return;
    }
    setPositions(previous => [...previous, {
      id: makeId(), side: direction, entryTime: Number(currentCandle.time), entryPrice: currentCandle.close,
      stopLoss: stop, takeProfit: target, status: 'OPEN',
    }]);
    setError('');
    setNotice(direction + ' virtuel ouvert à ' + formatPrice(currentCandle.close) + '.');
  };

  const closePosition = (positionId: string) => {
    if (!currentCandle) return;
    setPositions(previous => previous.map(position => {
      if (position.id !== positionId || position.status !== 'OPEN') return position;
      const pnl = (position.side === 'BUY' ? currentCandle.close - position.entryPrice : position.entryPrice - currentCandle.close) * Number(riskSize || 1);
      return { ...position, status: 'CLOSED', exitTime: Number(currentCandle.time), exitPrice: currentCandle.close, pnl };
    }));
  };

  const saveSession = async (forceNew = false) => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setError('Connecte-toi à IAMTRADER pour sauvegarder tes sessions.'); return; }
    if (candles.length === 0) { setError('Importe un fichier de données historiques avant de sauvegarder.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const payload = {
        name: sessionName.trim() || 'Session XAUUSD',
        symbol: 'XAUUSD',
        timeframe,
        datasetName,
        datasetStart: Number(candles[0].time),
        datasetEnd: Number(candles[candles.length - 1].time),
        candleCount: displayCandles.length,
        currentIndex,
        drawings,
        positions,
        updatedAt: serverTimestamp(),
      };
      const sessionsRef = collection(db, 'replaySessions', uid, 'sessions');
      if (activeSessionId && !forceNew) {
        await updateDoc(doc(db, 'replaySessions', uid, 'sessions', activeSessionId), payload);
      } else {
        const created = await addDoc(sessionsRef, { ...payload, createdAt: serverTimestamp() });
        setActiveSessionId(created.id);
      }
      await refreshSessions();
      setNotice('Session sauvegardée. Pour la reprendre sur un autre appareil, réimporte le même fichier historique.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la sauvegarde de la session.');
    } finally {
      setBusy(false);
    }
  };

  const loadSession = (session: SavedReplay) => {
    setSessionName(session.name || 'Session XAUUSD');
    setCandles([]);
    setDatasetName('');
    setTimeframe(session.timeframe || 'M15');
    setDrawings(Array.isArray(session.drawings) ? session.drawings : []);
    setPositions(Array.isArray(session.positions) ? session.positions : []);
    setCurrentIndex(Math.max(0, Number(session.currentIndex || 0)));
    setActiveSessionId(session.id);
    pendingRestoreRef.current = session;
    setNotice('Session chargée. Réimporte le fichier historique correspondant pour reprendre le graphique.');
    setError('');
  };

  const removeSession = async (sessionId: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    if (!window.confirm('Supprimer définitivement cette session Replay ?')) return;
    try {
      await deleteDoc(doc(db, 'replaySessions', uid, 'sessions', sessionId));
      if (activeSessionId === sessionId) setActiveSessionId('');
      await refreshSessions();
      setNotice('Session supprimée.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de supprimer la session.');
    }
  };

  const deleteLastDrawing = () => {
    if (drawings.length) setDrawings(previous => previous.slice(0, -1));
    else setDraftPoints([]);
  };
  const clearDrawings = () => {
    setDrawings([]);
    setDraftPoints([]);
  };

  const exportTrades = () => {
    const rows = [['side', 'status', 'entry_time_utc', 'entry_price', 'stop_loss', 'take_profit', 'exit_time_utc', 'exit_price', 'pnl']];
    positions.forEach(position => rows.push([
      position.side, position.status, new Date(position.entryTime * 1000).toISOString(), String(position.entryPrice),
      position.stopLoss === null ? '' : String(position.stopLoss), position.takeProfit === null ? '' : String(position.takeProfit),
      position.exitTime ? new Date(position.exitTime * 1000).toISOString() : '',
      position.exitPrice === undefined ? '' : String(position.exitPrice), position.pnl === undefined ? '' : String(position.pnl),
    ]));
    const csv = rows.map(row => row.map(value => '"' + value.replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'iamtrader-replay-trades.csv'; anchor.click();
    URL.revokeObjectURL(url);
  };

  const chartPoints = useMemo(() => drawings.map(drawing => {
    const points = drawing.points.map(point => {
      const x = chartRef.current?.timeScale().timeToCoordinate(point.time as Time);
      const y = candleSeriesRef.current?.priceToCoordinate(point.price);
      return x === null || x === undefined || y === null || y === undefined ? null : { x, y, price: point.price };
    }).filter((point): point is { x: number; y: number; price: number } => point !== null);
    return { ...drawing, coords: points };
  }), [drawings, visibleCandles, currentIndex]);

  return (
    <div className="fixed inset-0 z-[100] flex h-[100dvh] w-screen flex-col overflow-hidden text-sm" style={{ background: COLORS.bg, color: COLORS.text, fontFamily: 'Inter, Arial, sans-serif' }}>
      <header className="flex min-h-[52px] shrink-0 items-center justify-between gap-3 border-b px-3 sm:px-4" style={{ background: COLORS.bg, borderColor: COLORS.border }}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: COLORS.blue }}><ChartCandlestick size={17} /></div>
          <div className="min-w-0">
            <div className="font-semibold text-white">IAMTRADER · XAUUSD Replay</div>
            <div className="text-[10px]" style={{ color: COLORS.muted }}>{candles.length ? datasetName + ' · données importées' : 'Aucune donnée historique chargée'}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-[#252a36]" style={{ borderColor: COLORS.border }}><Upload size={14} /> Importer CSV</button>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={event => { loadCsv(event.target.files?.[0]); event.currentTarget.value = ''; }} />
          <button onClick={() => { void saveSession(); }} disabled={busy || !candles.length} className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" style={{ background: COLORS.blue }}><Save size={14} /> {busy ? 'Sauvegarde…' : 'Sauvegarder'}</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2" style={{ borderColor: COLORS.border, background: COLORS.panel }}>
          <span className="text-xs font-bold text-white">XAUUSD</span>
          <span className="text-xs" style={{ color: COLORS.muted }}>{currentCandle ? formatPrice(currentCandle.close) : '—'}</span>
          <span className="mx-1 h-5 w-px" style={{ background: COLORS.border }} />
          <label className="flex items-center gap-2 text-xs" style={{ color: COLORS.muted }}>UT
            <select value={timeframe} onChange={event => setTimeframe(event.target.value)} className="rounded border bg-[#131722] px-2 py-1.5 text-xs text-white" style={{ borderColor: COLORS.border }}>
              {['M1','M5','M15','M30','H1','H4','D1'].map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
          <span className="text-[10px]" style={{ color: COLORS.muted }}>L’UT est un repère de session : les données importées ne sont pas automatiquement converties.</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => { setTool('cursor'); setDraftPoints([]); }} className={'rounded px-2.5 py-1.5 text-xs ' + (tool === 'cursor' ? 'bg-[#363d4d] text-white' : 'text-slate-300 hover:bg-[#292e3a]')}><Crosshair size={14} className="mr-1 inline" /> Curseur</button>
            <button onClick={() => { setTool('fibonacci'); setDraftPoints([]); setNotice('Clique deux points sur le graphique pour tracer Fibonacci.'); }} className={'rounded px-2.5 py-1.5 text-xs ' + (tool === 'fibonacci' ? 'bg-[#363d4d] text-white' : 'text-slate-300 hover:bg-[#292e3a]')}>Fibo</button>
            <button onClick={() => { setTool('trendline'); setDraftPoints([]); setNotice('Clique deux points sur le graphique pour tracer une ligne.'); }} className={'rounded px-2.5 py-1.5 text-xs ' + (tool === 'trendline' ? 'bg-[#363d4d] text-white' : 'text-slate-300 hover:bg-[#292e3a]')}><TrendingUp size={14} className="mr-1 inline" /> Tracé</button>
            <button onClick={() => { setTool('path'); setDraftPoints([]); setNotice('Clique deux points sur le graphique pour dessiner le chemin anticipé.'); }} className={'rounded px-2.5 py-1.5 text-xs ' + (tool === 'path' ? 'bg-[#363d4d] text-white' : 'text-slate-300 hover:bg-[#292e3a]')}><ArrowRight size={14} className="mr-1 inline" /> Chemin</button>
            <button onClick={deleteLastDrawing} title="Annuler le dernier tracé" className="rounded p-2 hover:bg-[#292e3a]"><Eraser size={14} /></button>
            <button onClick={clearDrawings} title="Effacer tous les tracés" className="rounded p-2 hover:bg-[#292e3a]"><Trash2 size={14} /></button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px]">
          <main className="relative min-h-[280px] min-w-0">
            <div ref={chartHostRef} className="absolute inset-0" />
            <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-label="Tracés du graphique">
              <defs><marker id="replay-arrow-head" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#f5c451" /></marker></defs>
              {chartPoints.map(drawing => {
                const pts = drawing.coords;
                if (pts.length < 2) return null;
                if (drawing.kind === 'fibonacci') {
                  const first = pts[0], second = pts[1];
                  const left = Math.min(first.x, second.x), right = Math.max(first.x, second.x);
                  const levels = [0, .236, .382, .5, .618, .786, 1];
                  return <g key={drawing.id}>{levels.map(level => {
                    const y = first.y + (second.y - first.y) * level;
                    const price = first.price + (second.price - first.price) * level;
                    return <g key={level}><line x1={left} y1={y} x2={right} y2={y} stroke="#8b9dfc" strokeWidth="1" strokeDasharray={level === .5 ? '0' : '4 3'} /><text x={right + 5} y={y - 3} fill="#b8c4ff" fontSize="10">{(level * 100).toFixed(1)}% · {formatPrice(price)}</text></g>;
                  })}</g>;
                }
                return <g key={drawing.id}><polyline points={pts.map(point => point.x + ',' + point.y).join(' ')} fill="none" stroke={drawing.kind === 'path' ? '#f5c451' : '#4da3ff'} strokeWidth="2" strokeDasharray={drawing.kind === 'path' ? '5 3' : undefined} markerEnd={drawing.kind === 'path' ? 'url(#replay-arrow-head)' : undefined} /></g>;
              })}
            </svg>
            {!candles.length && <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <div className="max-w-lg rounded-2xl border p-6" style={{ background: COLORS.panel, borderColor: COLORS.border }}>
                <ChartCandlestick size={30} className="mx-auto mb-3" style={{ color: COLORS.blue }} />
                <h2 className="text-base font-semibold text-white">Charger les données historiques XAUUSD</h2>
                <p className="mt-2 text-xs leading-5" style={{ color: COLORS.muted }}>Importe un CSV OHLC provenant d’une source de marché autorisée. Colonnes attendues : time/date, open, high, low, close. Aucune bougie synthétique ne sera créée.</p>
                <button onClick={() => fileRef.current?.click()} className="mt-4 rounded-lg px-4 py-2.5 text-xs font-semibold text-white" style={{ background: COLORS.blue }}><Upload size={14} className="mr-2 inline" /> Choisir un fichier CSV</button>
              </div>
            </div>}
          </main>

          <aside className="min-h-0 overflow-y-auto border-t xl:border-l xl:border-t-0" style={{ borderColor: COLORS.border, background: COLORS.panel }}>
            <section className="border-b p-4" style={{ borderColor: COLORS.border }}>
              <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white"><Clock3 size={14} /> Replay</h3>
              <div className="mb-3 flex items-center justify-between gap-2">
                <button disabled={!displayCandles.length || currentIndex === 0} onClick={() => { setPlaying(false); setCurrentIndex(index => Math.max(0, index - 1)); }} className="rounded border p-2 disabled:opacity-30" style={{ borderColor: COLORS.border }} title="Bougie précédente"><Minus size={14} /></button>
                <button disabled={!displayCandles.length} onClick={() => setPlaying(value => !value)} className="flex flex-1 items-center justify-center gap-2 rounded px-3 py-2 text-xs font-bold text-white disabled:opacity-30" style={{ background: playing ? '#555b6a' : COLORS.blue }}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pause' : 'Lecture'}</button>
                <button disabled={!displayCandles.length || currentIndex >= displayCandles.length - 1} onClick={() => { setPlaying(false); setCurrentIndex(index => Math.min(displayCandles.length - 1, index + 1)); }} className="rounded border p-2 disabled:opacity-30" style={{ borderColor: COLORS.border }} title="Bougie suivante"><Plus size={14} /></button>
              </div>
              <label className="mb-1 flex justify-between text-[10px]" style={{ color: COLORS.muted }}><span>Progression</span><span>{displayCandles.length ? (currentIndex + 1).toLocaleString('fr-FR') + ' / ' + displayCandles.length.toLocaleString('fr-FR') : '0 / 0'}</span></label>
              <input type="range" min={0} max={Math.max(0, displayCandles.length - 1)} value={displayCandles.length ? Math.min(currentIndex, displayCandles.length - 1) : 0} disabled={!displayCandles.length} onChange={event => { setPlaying(false); setCurrentIndex(Number(event.target.value)); }} className="w-full accent-blue-500" />
              <label className="mt-3 flex items-center justify-between text-xs" style={{ color: COLORS.muted }}>Vitesse
                <select value={speed} onChange={event => setSpeed(Number(event.target.value))} className="rounded border bg-[#131722] px-2 py-1.5 text-xs text-white" style={{ borderColor: COLORS.border }}><option value={0.5}>0,5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={5}>5×</option><option value={10}>10×</option></select>
              </label>
              <div className="mt-3 rounded-lg p-3" style={{ background: COLORS.bg }}>
                <p className="text-[10px]" style={{ color: COLORS.muted }}>Date de la bougie visible (UTC)</p>
                <p className="mt-1 text-xs font-semibold text-white">{currentCandle ? formatDate(Number(currentCandle.time)) : '—'}</p>
              </div>
            </section>

            <section className="border-b p-4" style={{ borderColor: COLORS.border }}>
              <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white"><ArrowLeftRight size={14} /> Simulation virtuelle</h3>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => placePosition('BUY')} disabled={!currentCandle} className="rounded-lg py-2.5 text-xs font-bold text-white disabled:opacity-30" style={{ background: COLORS.green }}>BUY</button>
                <button onClick={() => placePosition('SELL')} disabled={!currentCandle} className="rounded-lg py-2.5 text-xs font-bold text-white disabled:opacity-30" style={{ background: COLORS.red }}>SELL</button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-[10px]" style={{ color: COLORS.muted }}>Stop Loss<input value={stopLossText} onChange={event => setStopLossText(event.target.value)} inputMode="decimal" placeholder="Prix SL" className="mt-1 w-full rounded border bg-[#131722] px-2 py-2 text-xs text-white outline-none focus:border-blue-500" style={{ borderColor: COLORS.border }} /></label>
                <label className="text-[10px]" style={{ color: COLORS.muted }}>Take Profit<input value={takeProfitText} onChange={event => setTakeProfitText(event.target.value)} inputMode="decimal" placeholder="Prix TP" className="mt-1 w-full rounded border bg-[#131722] px-2 py-2 text-xs text-white outline-none focus:border-blue-500" style={{ borderColor: COLORS.border }} /></label>
              </div>
              <label className="mt-3 block text-[10px]" style={{ color: COLORS.muted }}>Taille virtuelle (multiplicateur P&amp;L)<input value={riskSize} onChange={event => setRiskSize(event.target.value)} inputMode="decimal" className="mt-1 w-full rounded border bg-[#131722] px-2 py-2 text-xs text-white outline-none focus:border-blue-500" style={{ borderColor: COLORS.border }} /></label>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg p-3" style={{ background: COLORS.bg }}><p className="text-[10px]" style={{ color: COLORS.muted }}>Positions ouvertes</p><p className="mt-1 text-lg font-bold text-white">{openPositions.length}</p></div>
                <div className="rounded-lg p-3" style={{ background: COLORS.bg }}><p className="text-[10px]" style={{ color: COLORS.muted }}>P&amp;L réalisé</p><p className={'mt-1 text-lg font-bold ' + (realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{realizedPnl.toFixed(2)}</p></div>
              </div>
              <div className="mt-3 space-y-2">
                {positions.slice().reverse().slice(0, 8).map(position => <div key={position.id} className="rounded-lg border p-3" style={{ borderColor: COLORS.border, background: COLORS.bg }}>
                  <div className="flex items-center justify-between gap-2"><span className={'text-xs font-bold ' + (position.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400')}>{position.side} · {position.status === 'OPEN' ? 'Ouverte' : 'Fermée'}</span><span className="text-xs text-white">{formatPrice(position.entryPrice)}</span></div>
                  <div className="mt-1 text-[10px]" style={{ color: COLORS.muted }}>SL {position.stopLoss === null ? '—' : formatPrice(position.stopLoss)} · TP {position.takeProfit === null ? '—' : formatPrice(position.takeProfit)}</div>
                  {position.status === 'CLOSED' && <div className="mt-1 text-xs" style={{ color: (position.pnl || 0) >= 0 ? COLORS.green : COLORS.red }}>P&amp;L {Number(position.pnl || 0).toFixed(2)} · sortie {formatPrice(position.exitPrice || 0)}</div>}
                  {position.status === 'OPEN' && <button onClick={() => closePosition(position.id)} className="mt-2 rounded border px-2 py-1 text-[10px] hover:bg-[#252a36]" style={{ borderColor: COLORS.border }}>Fermer au marché</button>}
                </div>)}
                {!positions.length && <p className="text-[10px]" style={{ color: COLORS.muted }}>Aucune position simulée.</p>}
              </div>
              <button onClick={exportTrades} disabled={!positions.length} className="mt-3 flex w-full items-center justify-center gap-2 rounded border px-3 py-2 text-xs disabled:opacity-30" style={{ borderColor: COLORS.border }}><Download size={13} /> Exporter les trades CSV</button>
            </section>

            <section className="border-b p-4" style={{ borderColor: COLORS.border }}>
              <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white"><Save size={14} /> Sessions sauvegardées</h3>
              <input value={sessionName} onChange={event => setSessionName(event.target.value)} placeholder="Nom de la session" className="mb-3 w-full rounded border bg-[#131722] px-3 py-2 text-xs text-white outline-none focus:border-blue-500" style={{ borderColor: COLORS.border }} />
              <button onClick={() => { void saveSession(true); }} disabled={!candles.length || busy} className="mb-3 w-full rounded border px-3 py-2 text-xs disabled:opacity-30" style={{ borderColor: COLORS.border }}>Enregistrer comme nouvelle session</button>
              <div className="space-y-2">
                {savedSessions.map(session => <div key={session.id} className="flex items-start gap-2 rounded-lg border p-3" style={{ borderColor: COLORS.border, background: COLORS.bg }}>
                  <FolderOpen size={15} className="mt-0.5 shrink-0" style={{ color: COLORS.blue }} />
                  <button onClick={() => loadSession(session)} className="min-w-0 flex-1 text-left"><span className="block truncate text-xs font-semibold text-white">{session.name}</span><span className="mt-1 block text-[10px]" style={{ color: COLORS.muted }}>{session.candleCount} bougies · {formatDate(session.datasetStart)}</span></button>
                  <button onClick={() => void removeSession(session.id)} title="Supprimer la session" className="rounded p-1 hover:bg-[#292e3a]"><Trash2 size={13} /></button>
                </div>)}
                {!savedSessions.length && <p className="text-[10px]" style={{ color: COLORS.muted }}>{auth.currentUser ? 'Aucune session sauvegardée.' : 'Connecte-toi pour conserver tes sessions dans ton compte.'}</p>}
              </div>
            </section>
          </aside>
        </div>
      </div>

      {(notice || error) && <div className="fixed bottom-4 left-1/2 z-[120] w-[min(92vw,640px)] -translate-x-1/2 rounded-xl border px-4 py-3 shadow-xl" role="status" style={{ background: error ? '#3b1f28' : '#1b302d', borderColor: error ? '#7d303e' : '#246b5e' }}>
        <div className="flex items-start gap-2"><span className="flex-1 text-xs leading-5">{error || notice}</span><button onClick={() => { setError(''); setNotice(''); }} aria-label="Fermer le message"><X size={14} /></button></div>
      </div>}
    </div>
  );
}
