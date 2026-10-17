import { firestoreGet, firestoreQueryCollection, type PaymentEnv } from './firebaseAdmin';

export type PromotionPlan = 'pro' | 'community';
export type PromotionKind = 'code' | 'seasonal';

export interface Promotion {
  id: string;
  kind: PromotionKind;
  code?: string;
  name: string;
  active: boolean;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  plans: PromotionPlan[];
  startsAt: string;
  endsAt: string;
  maxUses?: number | null;
  uses?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppliedPromotion {
  promotionId: string;
  promotionKind: PromotionKind;
  promotionName: string;
  promoCode: string | null;
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  discountType: 'percent' | 'fixed';
  discountValue: number;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isValidWindow(promotion: Promotion, now: number) {
  const start = new Date(promotion.startsAt).getTime();
  const end = new Date(promotion.endsAt).getTime();
  return promotion.active === true && Number.isFinite(start) && Number.isFinite(end) && start <= now && now <= end;
}

function calculateDiscount(promotion: Promotion, baseAmount: number) {
  if (!Number.isFinite(promotion.discountValue) || promotion.discountValue <= 0) return 0;
  const raw = promotion.discountType === 'percent'
    ? baseAmount * Math.min(100, promotion.discountValue) / 100
    : Math.min(baseAmount, promotion.discountValue);
  return roundMoney(Math.min(baseAmount, raw));
}

export async function resolvePromotion(
  env: PaymentEnv,
  plan: PromotionPlan,
  baseAmount: number,
  promoCode?: string
): Promise<{ applied: AppliedPromotion | null; message?: string }> {
  const now = Date.now();
  const candidates: Promotion[] = [];
  const normalizedCode = String(promoCode || '').trim().toUpperCase();

  if (normalizedCode) {
    if (!/^[A-Z0-9_-]{3,32}$/.test(normalizedCode)) {
      return { applied: null, message: 'Le code promo doit contenir entre 3 et 32 caractères (lettres, chiffres, tiret ou soulignement).' };
    }
    const doc = await firestoreGet(env, 'promotions/' + encodeURIComponent(normalizedCode));
    if (!doc) return { applied: null, message: 'Ce code promo n’existe pas.' };
    const promotion = { ...doc, id: normalizedCode } as Promotion;
    if (promotion.kind !== 'code' || !isValidWindow(promotion, now)) return { applied: null, message: 'Ce code promo n’est pas actif ou sa période de validité est terminée.' };
    if (!Array.isArray(promotion.plans) || !promotion.plans.includes(plan)) return { applied: null, message: 'Ce code promo ne s’applique pas à ce forfait.' };
    if (Number.isFinite(Number(promotion.maxUses)) && Number(promotion.maxUses) > 0 && Number(promotion.uses || 0) >= Number(promotion.maxUses)) return { applied: null, message: 'La limite d’utilisation de ce code promo est atteinte.' };
    candidates.push(promotion);
  }

  const seasonal = await firestoreQueryCollection(env, 'promotions', 100, 'createdAt');
  for (const row of seasonal) {
    const promotion = { ...row, id: String(row.id || '') } as Promotion;
    if (promotion.kind !== 'seasonal' || !isValidWindow(promotion, now)) continue;
    if (!Array.isArray(promotion.plans) || !promotion.plans.includes(plan)) continue;
    if (Number.isFinite(Number(promotion.maxUses)) && Number(promotion.maxUses) > 0 && Number(promotion.uses || 0) >= Number(promotion.maxUses)) continue;
    candidates.push(promotion);
  }

  const best = candidates
    .map(promotion => ({ promotion, discount: calculateDiscount(promotion, baseAmount) }))
    .filter(item => item.discount > 0)
    .sort((a, b) => b.discount - a.discount)[0];

  if (!best) {
    if (normalizedCode) return { applied: null, message: 'Ce code promo ne donne pas de réduction applicable.' };
    return { applied: null };
  }

  const discountAmount = best.discount;
  return {
    applied: {
      promotionId: best.promotion.id,
      promotionKind: best.promotion.kind,
      promotionName: best.promotion.name,
      promoCode: best.promotion.kind === 'code' ? normalizedCode : null,
      baseAmount: roundMoney(baseAmount),
      discountAmount,
      finalAmount: roundMoney(baseAmount - discountAmount),
      discountType: best.promotion.discountType,
      discountValue: best.promotion.discountValue
    }
  };
}
