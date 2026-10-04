export const SUBSCRIPTION_PLANS = {
  pro: { name: 'Plus', durationDays: 30 },
  community: { name: 'Community', durationDays: 180 }
} as const;

export type SubscriptionAction = 'initial' | 'renewal' | 'upgrade';

export function decideSubscription(profile: Record<string, unknown>, planKey: keyof typeof SUBSCRIPTION_PLANS, now: Date) {
  const currentPlan = String(profile.plan || 'free') as keyof typeof SUBSCRIPTION_PLANS | 'free';
  const expiry = profile.subscriptionExpiresAt ? new Date(String(profile.subscriptionExpiresAt)) : null;
  const active = !!expiry && expiry.getTime() > now.getTime() && currentPlan !== 'free';

  if (profile.scheduledPlan && profile.scheduledStartAt) {
    return { error: 'Un abonnement est déjà programmé. Aucun nouvel achat ne peut être ajouté avant son démarrage.' } as const;
  }
  if (!active) {
    const start = now;
    const action = currentPlan !== 'free' && expiry ? 'renewal' as const : 'initial' as const;
    return { action, currentPlan, start, expires: new Date(start.getTime() + SUBSCRIPTION_PLANS[planKey].durationDays * 86400000) };
  }
  if (currentPlan === planKey) {
    return { error: 'Ce forfait est déjà actif. Le renouvellement sera possible après son expiration.' } as const;
  }
  if (currentPlan === 'community' && planKey === 'pro') {
    return { error: 'Le passage de Community à Plus est indisponible pendant votre période active.' } as const;
  }
  const start = expiry as Date;
  return { action: 'upgrade' as const, currentPlan, start, expires: new Date(start.getTime() + SUBSCRIPTION_PLANS[planKey].durationDays * 86400000) };
}

export function subscriptionFields(profile: Record<string, unknown>, planKey: keyof typeof SUBSCRIPTION_PLANS, action: SubscriptionAction, start: string, expires: string, paidAt: string) {
  const fields: Record<string, unknown> = { paymentDate: paidAt, paymentStatus: 'paid', planChangeConfirmedAt: paidAt, updatedAt: paidAt };
  if (action === 'upgrade') {
    fields.scheduledPlan = planKey;
    fields.scheduledStartAt = start;
    fields.scheduledExpiresAt = expires;
    fields.subscriptionStatus = 'scheduled';
  } else {
    fields.plan = planKey;
    fields.subscriptionStartAt = start;
    fields.subscriptionExpiresAt = expires;
    fields.subscriptionStatus = 'active';
    fields.scheduledPlan = '';
    fields.scheduledStartAt = '';
    fields.scheduledExpiresAt = '';
  }
  return fields;
}

export function lifecycleFields(profile: Record<string, unknown>, now: Date) {
  const scheduledPlan = String(profile.scheduledPlan || '');
  const scheduledStartAt = profile.scheduledStartAt ? new Date(String(profile.scheduledStartAt)) : null;
  const scheduledExpiresAt = profile.scheduledExpiresAt ? new Date(String(profile.scheduledExpiresAt)) : null;
  if (scheduledPlan && scheduledStartAt && scheduledExpiresAt && scheduledStartAt.getTime() <= now.getTime()) return {
    plan: scheduledPlan,
    subscriptionStartAt: scheduledStartAt.toISOString(),
    subscriptionExpiresAt: scheduledExpiresAt.toISOString(),
    subscriptionStatus: 'active',
    scheduledPlan: '',
    scheduledStartAt: '',
    scheduledExpiresAt: '',
    updatedAt: now.toISOString()
  };

  const expiry = profile.subscriptionExpiresAt ? new Date(String(profile.subscriptionExpiresAt)) : null;
  if (expiry && expiry.getTime() <= now.getTime() && String(profile.plan || 'free') !== 'free') {
    return { plan: 'free', subscriptionStatus: 'expired', updatedAt: now.toISOString() };
  }
  return null;
}