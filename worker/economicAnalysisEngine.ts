export type EconomicEventInput = {
  event: string;
  currency?: string;
  date?: string;
  time?: string;
  impact?: string;
  actual?: string | number | null;
  forecast?: string | number | null;
  previous?: string | number | null;
};

type NumericValue = { raw: string; value: number; unit: string };

function parseComparableValue(input: unknown): NumericValue | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim();
  if (!raw || /^(-|—|n\/?a|none|pending)$/i.test(raw)) return null;

  const cleaned = raw.replace(/,/g, '').replace(/\s+/g, '');
  const match = cleaned.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))([kmb])?(%|bps?|pp)?$/i);
  if (!match) return null;

  let value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const scale = (match[2] || '').toLowerCase();
  if (scale === 'k') value *= 1_000;
  if (scale === 'm') value *= 1_000_000;
  if (scale === 'b') value *= 1_000_000_000;

  return { raw, value, unit: (match[3] || '').toLowerCase() };
}

function comparable(a: NumericValue, b: NumericValue) {
  return a.unit === b.unit;
}

function classifyEvent(event: string) {
  const name = event.toLowerCase();
  if (/cpi|consumer price|inflation|pce price|producer price|ppi/.test(name)) return 'inflation';
  if (/unemployment claims|jobless claims|initial claims|continuing claims/.test(name)) return 'claims';
  if (/unemployment rate/.test(name)) return 'unemployment';
  if (/nonfarm|non-farm|payroll|employment change|jobs added|employment report/.test(name)) return 'employment';
  if (/gdp|gross domestic product/.test(name)) return 'growth';
  if (/retail sales|consumer spending/.test(name)) return 'consumption';
  if (/pmi| ism manufacturing|ism services|purchasing managers/.test(name)) return 'business_activity';
  if (/interest rate|rate decision|policy rate|fomc|federal funds|cash rate/.test(name)) return 'central_bank';
  if (/average hourly earnings|wage growth|employment cost index/.test(name)) return 'wages';
  return 'other';
}

function describeSurprise(delta: number, unit: string) {
  const sign = delta > 0 ? 'supérieur' : delta < 0 ? 'inférieur' : 'identique';
  const magnitude = Math.abs(delta);
  const rounded = Number(magnitude.toFixed(4)).toLocaleString('fr-FR');
  return { direction: delta > 0 ? 'above' : delta < 0 ? 'below' : 'inline', text: delta === 0 ? 'L’Actual correspond au Forecast.' : 'L’Actual est ' + sign + ' au Forecast de ' + rounded + (unit ? ' ' + unit : '') + '.' };
}

function macroContext(family: string, direction: 'above' | 'below' | 'inline' | 'unknown', currency: string) {
  const subject = currency || 'la devise concernée';
  const higher = direction === 'above';
  const lower = direction === 'below';
  let context = '';
  switch (family) {
    case 'inflation':
      context = higher
        ? 'Une inflation supérieure aux attentes peut renforcer les anticipations de politique monétaire restrictive, si cette lecture est confirmée par les autres données.'
        : lower
          ? 'Une inflation inférieure aux attentes peut réduire la pression en faveur d’une politique monétaire restrictive, sous réserve des autres indicateurs.'
          : 'La surprise sur l’inflation est neutre par rapport au consensus ; la tendance et les composantes restent déterminantes.';
      break;
    case 'claims':
    case 'unemployment':
      context = higher
        ? 'Une détérioration du marché du travail peut peser sur les anticipations de taux, mais doit être vérifiée avec les autres données d’emploi.'
        : lower
          ? 'Une lecture plus solide du marché du travail peut soutenir les anticipations de taux, selon le contexte de politique monétaire.'
          : 'Le résultat ne crée pas de surprise par rapport au consensus ; la tendance de l’emploi compte également.';
      break;
    case 'employment':
    case 'wages':
      context = higher
        ? 'Une donnée plus forte peut soutenir les anticipations de taux si elle traduit un marché du travail tendu ; les révisions et salaires doivent être examinés.'
        : lower
          ? 'Une donnée plus faible peut modérer les anticipations de taux ; les révisions et les autres composantes du rapport sont importantes.'
          : 'Le résultat est conforme au consensus ; les révisions et les composantes du rapport peuvent modifier sa lecture.';
      break;
    case 'growth':
    case 'consumption':
    case 'business_activity':
      context = higher
        ? 'Une activité supérieure aux attentes peut signaler une économie plus résistante et influencer les anticipations de taux.'
        : lower
          ? 'Une activité inférieure aux attentes peut signaler un ralentissement et modifier les anticipations de politique monétaire.'
          : 'La donnée est conforme aux attentes ; la tendance et les détails de publication restent importants.';
      break;
    case 'central_bank':
      context = 'La décision doit être comparée au consensus et au communiqué. Le ton, les projections et les indications futures peuvent compter davantage que le chiffre seul.';
      break;
    default:
      context = 'La signification macroéconomique de cet indicateur n’est pas classée automatiquement. Il faut vérifier sa définition, son unité, les révisions et le contexte de politique monétaire.';
  }

  const marketNote = currency === 'USD'
    ? ' Pour le dollar et l’or, la réaction dépend aussi des taux réels, des attentes déjà intégrées dans les prix, du positionnement et du contexte de risque.'
    : ' Pour cette devise et pour l’or, la réaction dépend aussi des attentes de taux, des devises concurrentes, du contexte de risque et des prix déjà intégrés au marché.';
  return { currency: subject, context: context + marketNote };
}

export function analyzeEconomicEvent(input: EconomicEventInput) {
  const event = String(input.event || '').trim();
  const actual = parseComparableValue(input.actual);
  const forecast = parseComparableValue(input.forecast);
  const previous = parseComparableValue(input.previous);
  let surprise: ReturnType<typeof describeSurprise> | null = null;
  let direction: 'above' | 'below' | 'inline' | 'unknown' = 'unknown';
  const notes: string[] = [];

  if (actual && forecast && comparable(actual, forecast)) {
    const delta = actual.value - forecast.value;
    surprise = describeSurprise(delta, actual.unit);
    direction = surprise.direction as typeof direction;
  } else if (input.actual != null && String(input.actual).trim() && input.forecast != null && String(input.forecast).trim()) {
    notes.push('Actual et Forecast sont présents mais leurs formats/unités ne permettent pas une comparaison numérique fiable.');
  } else {
    notes.push('Comparaison Actual/Forecast indisponible : une valeur au moins manque ou n’est pas encore publiée.');
  }

  if (actual && previous && !comparable(actual, previous)) {
    notes.push('Actual et Previous utilisent des unités/formats différents ; aucune variation n’est calculée.');
  } else if (actual && previous && comparable(actual, previous)) {
    notes.push('Écart brut Actual/Previous : ' + Number((actual.value - previous.value).toFixed(4)).toLocaleString('fr-FR') + (actual.unit ? ' ' + actual.unit : '') + '. Vérifier les éventuelles révisions et la comparabilité des périodes.');
  }

  const family = classifyEvent(event);
  const interpretation = macroContext(family, direction, String(input.currency || '').toUpperCase());
  return {
    event,
    currency: String(input.currency || '').toUpperCase(),
    category: family,
    actual: actual?.raw ?? null,
    forecast: forecast?.raw ?? null,
    previous: previous?.raw ?? null,
    surprise,
    interpretation: interpretation.context,
    notes,
    status: actual && forecast ? (surprise ? 'analyzed' : 'partial') : 'insufficient_data',
    analyzedAt: new Date().toISOString(),
    disclaimer: 'Analyse indicative fondée sur les valeurs reçues ; ce résultat ne constitue pas un signal de trading.',
  };
}
