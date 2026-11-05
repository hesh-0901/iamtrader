import { firestoreGet, firestorePatch, firestoreDelete, firestoreSet, firestoreQueryCollection, verifyFirebaseIdToken, type PaymentEnv } from './firebaseAdmin';
import { lifecycleFields, subscriptionFields, type SubscriptionAction } from './subscription';

type AdminEnv = PaymentEnv & { GEMINI_API_KEY?: string; GEMINI_API_KEY_2?: string; GEMINI_API_KEY_3?: string; GEMINI_API_KEY_4?: string; OPENAI_API_KEY?: string; DEEPSEEK_API_KEY?: string };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function legacyTransactionReference(payment: Record<string, unknown>) {
  const id = String(payment.id || payment.reference || 'UNKNOWN');
  const code = id.slice(-8).toUpperCase();
  return `IMAT-${code.slice(0, 4)} ${code.slice(4)}`;
}

function legacyInvoiceNumber(payment: Record<string, unknown>) {
  const id = String(payment.id || payment.reference || 'UNKNOWN');
  const year = new Date(String(payment.createdAt || new Date().toISOString())).getUTCFullYear().toString().slice(-2);
  return `INV-${year}-${id.slice(-8).toUpperCase()}`;
}

function normalizePayment(payment: Record<string, any>) {
  return {
    ...payment,
    reference: payment.transactionReference || payment.reference || legacyTransactionReference(payment),
    invoiceNumber: payment.invoiceNumber || legacyInvoiceNumber(payment)
  };
}

async function requireAdmin(request: Request, env: AdminEnv) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) throw new Response(JSON.stringify({ error: 'Authentification requise.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  const identity = await verifyFirebaseIdToken(env, header.slice(7));
  const profile = await firestoreGet(env, `users/${encodeURIComponent(identity.uid)}`);
  if (!profile || profile.role !== 'admin' || profile.status === 'suspended') {
    throw new Response(JSON.stringify({ error: 'Accès administrateur requis.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
  return identity;
}

export async function handleAdminMutation(request: Request, env: AdminEnv) {
  try {
    const identity = await requireAdmin(request, env);
    const body = await request.json().catch(() => null) as {
      action?: string;
      uid?: string;
      messageId?: string;
      paymentId?: string;
      data?: Record<string, unknown>;
      log?: Record<string, unknown>;
    } | null;

    if (!body?.action) return json({ error: 'Action administrative manquante.' }, 400);


    if (body.action === 'get-promotions') {
      const promotions = await firestoreQueryCollection(env, 'promotions', 200, 'createdAt');
      const payments = await firestoreQueryCollection(env, 'payments', 500, 'createdAt');
      const users = await firestoreQueryCollection(env, 'users', 500, 'createdAt');
      const userByUid = new Map(users.map(user => [String(user.uid || user.id || ''), user]));
      const enriched = promotions.map(promotion => {
        const id = String(promotion.id || '');
        const related = payments.filter(payment => String(payment.promotionId || '') === id && payment.status === 'paid');
        const newSubscriptions = related.filter(payment => String(payment.subscriptionAction || '') === 'initial').length;
        const renewals = related.filter(payment => ['renewal', 'upgrade'].includes(String(payment.subscriptionAction || ''))).length;
        const creator = userByUid.get(String(promotion.createdBy || ''));
        return { ...promotion, creatorName: String(creator?.displayName || creator?.email || promotion.createdBy || '—'), newSubscriptions, renewals };
      });
      return json({ success: true, promotions: enriched });
    }

    if (body.action === 'save-promotion') {
      const data = body.data as Record<string, any> | undefined;
      if (!data) return json({ error: 'Données de promotion manquantes.' }, 400);
      const kind = data.kind === 'seasonal' ? 'seasonal' : data.kind === 'code' ? 'code' : null;
      const name = String(data.name || '').trim().slice(0, 100);
      const discountType = data.discountType === 'fixed' ? 'fixed' : data.discountType === 'percent' ? 'percent' : null;
      const discountValue = Number(data.discountValue);
      const plans = Array.isArray(data.plans) ? data.plans.filter((plan: unknown) => plan === 'pro' || plan === 'community') : [];
      const startsAt = String(data.startsAt || '');
      const endsAt = String(data.endsAt || '');
      const startMs = new Date(startsAt).getTime();
      const endMs = new Date(endsAt).getTime();
      if (!kind || !name || !discountType || !Number.isFinite(discountValue) || discountValue <= 0 ||
          (discountType === 'percent' && discountValue > 100) || !plans.length ||
          !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
        return json({ error: 'Promotion invalide : vérifiez le nom, la réduction, les forfaits et les dates.' }, 400);
      }
      const rawCode = String(data.code || '').trim().toUpperCase();
      if (kind === 'code' && !/^(IAM|XAU|FX)-[A-Z0-9]{4,10}$/.test(rawCode)) {
        return json({ error: 'Le code promo doit commencer par IAM-, XAU- ou FX- et contenir un suffixe aléatoire.' }, 400);
      }
      const id = kind === 'code' ? rawCode : String(data.id || crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
      if (!id) return json({ error: 'Identifiant de promotion invalide.' }, 400);
      const existing = await firestoreGet(env, 'promotions/' + encodeURIComponent(id));
      if (kind === 'code' && existing && data.editing !== true) return json({ error: 'Ce code existe déjà. Générez-en un autre.' }, 409);
      if (kind === 'code' && data.editing === true && !existing) return json({ error: 'Le code à modifier est introuvable.' }, 404);
      const imageUrl = kind === 'seasonal' && typeof data.imageUrl === 'string' ? data.imageUrl : '';
      const imagePublicId = kind === 'seasonal' && typeof data.imagePublicId === 'string' ? data.imagePublicId : '';
      if (imageUrl && (!imageUrl.startsWith('https://res.cloudinary.com/ocgef9bk/') || !imagePublicId.startsWith('iamtrader/promotions/'))) {
        return json({ error: 'Référence Cloudinary invalide.' }, 400);
      }
      const maxUses = data.maxUses === '' || data.maxUses === null || data.maxUses === undefined ? null : Number(data.maxUses);
      if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) return json({ error: 'La limite d’utilisation doit être un entier positif.' }, 400);
      const record = {
        id, kind, ...(kind === 'code' ? { code: rawCode } : {}), ...(kind === 'seasonal' && imageUrl && imagePublicId ? { imageUrl, imagePublicId } : kind === 'seasonal' && data.imageUrl === null ? {} : kind === 'seasonal' && existing?.imageUrl ? { imageUrl: existing.imageUrl, imagePublicId: existing.imagePublicId } : {}), name, active: data.active !== false,
        discountType, discountValue, plans, startsAt: new Date(startMs).toISOString(), endsAt: new Date(endMs).toISOString(),
        maxUses, uses: Number(existing?.uses || 0), createdAt: String(existing?.createdAt || new Date().toISOString()),
        updatedAt: new Date().toISOString(), createdBy: String(existing?.createdBy || identity.uid)
      };
      await firestoreSet(env, 'promotions/' + encodeURIComponent(id), record);
      await firestoreSet(env, 'adminLogs/' + encodeURIComponent(crypto.randomUUID()), {
        action: 'promotion-saved', promotionId: id, adminUid: identity.uid, createdAt: new Date().toISOString()
      });
      return json({ success: true, promotion: record });
    }

    if (body.action === 'delete-promotion') {
      const promotionId = String(body.data?.id || '').trim();
      if (!promotionId) return json({ error: 'Promotion introuvable.' }, 400);
      const related = await firestoreQueryCollection(env, 'payments', 500, 'createdAt');
      if (related.some(payment => String(payment.promotionId || '') === promotionId && payment.status === 'paid')) {
        return json({ error: 'Cette offre possède déjà des paiements confirmés. Désactivez-la plutôt que de la supprimer.' }, 409);
      }
      await firestoreDelete(env, 'promotions/' + encodeURIComponent(promotionId));
      await firestoreSet(env, 'adminLogs/' + encodeURIComponent(crypto.randomUUID()), {
        action: 'promotion-deleted', promotionId, adminUid: identity.uid, createdAt: new Date().toISOString()
      });
      return json({ success: true });
    }

    if (body.action === 'get-ai-monitoring') {
      const [events, savedConfig] = await Promise.all([
        firestoreQueryCollection(env, 'aiTelemetry', 250, 'createdAt'),
        firestoreGet(env, 'system/aiEngineConfig')
      ]);
      const providers = [
        { id: 'gemini', label: 'Google Gemini', configured: [env.GEMINI_API_KEY, env.GEMINI_API_KEY_2, env.GEMINI_API_KEY_3, env.GEMINI_API_KEY_4].some(value => Boolean(value?.trim())), models: ['gemini-3.5-flash-lite', 'gemini-3.8-flash'] },
        { id: 'openai', label: 'OpenAI', configured: Boolean((env as any).OPENAI_API_KEY?.trim()), models: ['gpt-4o-mini'] },
        { id: 'deepseek', label: 'DeepSeek', configured: Boolean((env as any).DEEPSEEK_API_KEY?.trim()), models: ['deepseek-flash'] }
      ];
      const defaultAssistants = [
        { id: 'chloe', label: 'Chloé', enabled: true, providerOrder: ['gemini', 'openai', 'deepseek'], model: 'gemini-3.5-flash-lite', temperature: 0.2, maxTokens: 1000, timeoutMs: 20000 },
        { id: 'vyra', label: 'VYRA', enabled: true, providerOrder: ['gemini', 'openai', 'deepseek'], model: 'gemini-3.5-flash-lite', temperature: 0.3, maxTokens: 1200, timeoutMs: 15000 },
        { id: 'instrument-suggest', label: 'Suggestions instruments', enabled: true, providerOrder: ['gemini', 'openai', 'deepseek'], model: 'gemini-3.8-flash', temperature: 0.1, maxTokens: 300, timeoutMs: 12000 },
        { id: 'economic-calendar-analysis', label: 'Analyse économique', enabled: true, providerOrder: ['gemini', 'openai', 'deepseek'], model: 'gemini-3.5-flash-lite', temperature: 0.2, maxTokens: 500, timeoutMs: 12000 }
      ];
      const config = {
        assistants: Array.isArray(savedConfig?.assistants) ? savedConfig.assistants : defaultAssistants,
        updatedAt: String(savedConfig?.updatedAt || ''),
        updatedBy: String(savedConfig?.updatedBy || '')
      };
      return json({
        success: true, providers, assistants: config.assistants, configUpdatedAt: config.updatedAt,
        keys: [
          ...[env.GEMINI_API_KEY, env.GEMINI_API_KEY_2, env.GEMINI_API_KEY_3, env.GEMINI_API_KEY_4].map((value, index) => ({ alias: `KEY_0${index + 1}`, provider: 'gemini', configured: Boolean(value?.trim()) })),
          { alias: 'OPENAI_API_KEY', provider: 'openai', configured: Boolean((env as any).OPENAI_API_KEY?.trim()) },
          { alias: 'DEEPSEEK_API_KEY', provider: 'deepseek', configured: Boolean((env as any).DEEPSEEK_API_KEY?.trim()) }
        ],
        events: events.map(event => ({
          assistant: String(event.assistant || ''), provider: String(event.provider || 'gemini'),
          model: String(event.model || ''), keyAlias: String(event.keyAlias || ''),
          status: Number(event.status || 0) || null, latencyMs: Number(event.latencyMs || 0),
          attempts: Number(event.attempts || 0), failovers: Number(event.failovers || 0),
          outcome: event.outcome === 'success' ? 'success' : 'failure',
          errorCategory: String(event.errorCategory || ''), createdAt: String(event.createdAt || '')
        }))
      });
    }

    if (body.action === 'save-ai-config') {
      const input = body.data as { assistants?: Array<Record<string, unknown>> } | undefined;
      if (!Array.isArray(input?.assistants) || input.assistants.length > 20) return json({ error: 'Configuration des assistants invalide.' }, 400);
      const allowedIds = ['chloe', 'vyra', 'instrument-suggest', 'economic-calendar-analysis'];
      const allowedProviders = ['gemini', 'openai', 'deepseek'];
      const assistants = input.assistants.map(item => {
        const id = String(item.id || '');
        const providerOrder = Array.isArray(item.providerOrder) ? item.providerOrder.map(String).filter(provider => allowedProviders.includes(provider)) : [];
        const temperature = Number(item.temperature);
        const maxTokens = Number(item.maxTokens);
        const timeoutMs = Number(item.timeoutMs);
        if (!allowedIds.includes(id) || !providerOrder.length || !Number.isFinite(temperature) || temperature < 0 || temperature > 2 ||
            !Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 8192 ||
            !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) throw new Error('Paramètres IA invalides pour ' + id);
        return { id, enabled: item.enabled !== false, providerOrder: [...new Set(providerOrder)], model: String(item.model || '').slice(0, 100), temperature, maxTokens, timeoutMs };
      });
      if (new Set(assistants.map(item => item.id)).size !== assistants.length) return json({ error: 'Un assistant est déclaré plusieurs fois.' }, 400);
      const record = { assistants, updatedAt: new Date().toISOString(), updatedBy: identity.uid };
      await firestoreSet(env, 'system/aiEngineConfig', record);
      await firestoreSet(env, 'adminLogs/' + encodeURIComponent(crypto.randomUUID()), { action: 'ai-engine-config-updated', adminUid: identity.uid, createdAt: record.updatedAt });
      return json({ success: true, config: record });
    }

    if (body.action === 'get-payments') {
      const payments = await firestoreQueryCollection(env, 'payments', 250, 'createdAt');
      return json({ success: true, payments: payments.map(payment => normalizePayment(payment)) });
    }

    if (body.action === 'update-payment') {
      if (!body.paymentId || !body.data) return json({ error: 'Paiement ou données manquants.' }, 400);
      const allowed = ['status','paidAt','confirmedAt','invalidatedAt','cancelledAt'];
      const data = Object.fromEntries(Object.entries(body.data).filter(([key, value]) => allowed.includes(key) && value !== undefined));
      if (!Object.keys(data).length) return json({ error: 'Aucune modification autorisée.' }, 400);
      const payment = await firestoreGet(env, `payments/${encodeURIComponent(body.paymentId)}`);
      if (!payment) return json({ error: 'Paiement introuvable.' }, 404);
      if (data.status === 'paid' && payment.paymentMethod === 'bank_transfer') {
        if (payment.status === 'paid' && payment.subscriptionActivatedAt) return json({ success: true, alreadyConfirmed: true });
        const planKey = payment.plan === 'community' ? 'community' : payment.plan === 'pro' ? 'pro' : null;
        if (!planKey) return json({ error: 'Formule du paiement invalide.' }, 400);
        const profile = await firestoreGet(env, `users/${encodeURIComponent(String(payment.uid || ''))}`);
        if (!profile) return json({ error: 'Profil utilisateur introuvable.' }, 404);
        const start = new Date(String(payment.activationStartAt || ''));
        const expires = new Date(String(payment.activationExpiresAt || ''));
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(expires.getTime()) || expires <= start) {
          return json({ error: 'Période d’abonnement enregistrée invalide.' }, 409);
        }
        const paidAt = String(body.data.paidAt || new Date().toISOString());
        const action = ['initial', 'renewal', 'upgrade'].includes(String(payment.subscriptionAction))
          ? payment.subscriptionAction as SubscriptionAction
          : 'initial';
        const subscription = subscriptionFields(profile, planKey, action, start.toISOString(), expires.toISOString(), paidAt);
        await firestorePatch(env, `users/${encodeURIComponent(String(payment.uid))}`, subscription, Object.keys(subscription));
        data.paidAt = paidAt;
        data.confirmedAt = paidAt;
        data.subscriptionActivatedAt = paidAt;
      }
      data.updatedAt = new Date().toISOString();
      data.updatedBy = identity.uid;
      await firestorePatch(env, `payments/${encodeURIComponent(body.paymentId)}`, data, Object.keys(data));
      const logId = crypto.randomUUID();
      await firestoreSet(env, `adminLogs/${encodeURIComponent(logId)}`, {
        action: 'payment-' + String(data.status || 'update'),
        paymentId: body.paymentId,
        adminUid: identity.uid,
        createdAt: new Date().toISOString()
      });
      return json({ success: true });
    }

    if (body.action === 'migrate-subscription-expiry') {
      if (String(identity.email || '').trim().toLowerCase() !== 'henochshungu@gmail.com') {
        return json({ error: 'Seul l’administrateur principal peut lancer cette migration.' }, 403);
      }
      const users = await firestoreQueryCollection(env, 'users', 500, 'createdAt');
      const now = Date.now();
      let migrated = 0;
      let expired = 0;
      let withoutExpiry = 0;
      for (let offset = 0; offset < users.length; offset += 20) {
        const batch = users.slice(offset, offset + 20);
        await Promise.all(batch.map(async profile => {
          const uid = String(profile.uid || profile.id || '');
          if (!uid || profile.role === 'admin') return null;
          const lifecycle = lifecycleFields(profile, new Date(now));
          const rawExpiry = profile.subscriptionExpiresAt;
          const expiryMs = rawExpiry ? new Date(String(rawExpiry)).getTime() : NaN;
          const patch: Record<string, unknown> = lifecycle ? { ...lifecycle } : {};
          if (!lifecycle && Number.isFinite(expiryMs) && Number(profile.subscriptionExpiresAtMs) !== expiryMs) {
            patch.subscriptionExpiresAtMs = expiryMs;
          }
          if (!Number.isFinite(expiryMs) && !lifecycle && ['pro', 'community'].includes(String(profile.plan || ''))) {
            withoutExpiry += 1;
          }
          if (patch.plan === 'free' && String(profile.plan || 'free') !== 'free') expired += 1;
          if (!Object.keys(patch).length) return null;
          await firestorePatch(env, 'users/' + encodeURIComponent(uid), patch, Object.keys(patch));
          migrated += 1;
          return uid;
        }));
      }
      await firestoreSet(env, 'adminLogs/' + encodeURIComponent(crypto.randomUUID()), {
        action: 'subscription-expiry-migration',
        adminUid: identity.uid,
        migrated,
        expired,
        withoutExpiry,
        createdAt: new Date().toISOString()
      });
      return json({ success: true, scanned: users.length, migrated, expired, withoutExpiry, message: 'Migration des échéances terminée.' });
    }

    if (body.action === 'update-user') {
      if (!body.uid || !body.data) return json({ error: 'Utilisateur ou données manquants.' }, 400);

      // Only the primary administrator may grant or revoke administrative roles.
      if (Object.prototype.hasOwnProperty.call(body.data, 'role')) {
        if (String(identity.email || '').trim().toLowerCase() !== 'henochshungu@gmail.com') {
          return json({ error: 'Seul l’administrateur principal peut modifier les rôles.' }, 403);
        }
        if (body.data.role !== 'admin' && body.data.role !== 'trader') {
          return json({ error: 'Rôle utilisateur invalide.' }, 400);
        }
      }

      const allowed = ['role','plan','status','paymentDate','subscriptionStartAt','subscriptionExpiresAt','subscriptionStatus','paymentStatus','pendingPlan','planChangeRequestedAt','planChangeConfirmedAt'];
      const data = Object.fromEntries(Object.entries(body.data).filter(([key, value]) => allowed.includes(key) && value !== undefined));
      const existingProfile = await firestoreGet(env, `users/${encodeURIComponent(body.uid)}`);
      if (body.data.subscriptionExpiresAt !== undefined) {
        const expiryMs = body.data.subscriptionExpiresAt ? new Date(String(body.data.subscriptionExpiresAt)).getTime() : 0;
        if (!Number.isFinite(expiryMs)) return json({ error: 'Date d’expiration invalide.' }, 400);
        data.subscriptionExpiresAtMs = expiryMs;
      } else if (['plan', 'subscriptionStatus', 'paymentStatus'].some(key => body.data && Object.prototype.hasOwnProperty.call(body.data, key))) {
        const expiryMs = existingProfile?.subscriptionExpiresAt ? new Date(String(existingProfile.subscriptionExpiresAt)).getTime() : 0;
        data.subscriptionExpiresAtMs = Number.isFinite(expiryMs) ? expiryMs : 0;
      }
      data.updatedAt = new Date().toISOString();
      await firestorePatch(env, `users/${encodeURIComponent(body.uid)}`, data, Object.keys(data));
      return json({ success: true });
    }

    if (body.action === 'update-contact') {
      if (!body.messageId || !body.data) return json({ error: 'Message ou données manquants.' }, 400);
      const allowed = ['status','adminNote','handledBy','handledAt','lastReply','repliedAt','repliedBy','conversation'];
      const data = Object.fromEntries(Object.entries(body.data).filter(([key]) => allowed.includes(key)));
      data.updatedAt = new Date().toISOString();
      await firestorePatch(env, `contactMessages/${encodeURIComponent(body.messageId)}`, data, Object.keys(data));
      return json({ success: true });
    }

    if (body.action === 'delete-contact') {
      if (!body.messageId) return json({ error: 'Message manquant.' }, 400);
      await firestoreDelete(env, `contactMessages/${encodeURIComponent(body.messageId)}`);
      return json({ success: true });
    }

    if (body.action === 'add-log') {
      if (!body.log) return json({ error: 'Journal manquant.' }, 400);
      const log = { ...body.log, adminUid: identity.uid, createdAt: new Date().toISOString() };
      const id = crypto.randomUUID();
      await firestoreSet(env, `adminLogs/${encodeURIComponent(id)}`, log);
      return json({ success: true, id });
    }

    return json({ error: 'Action administrative inconnue.' }, 400);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Admin API error:', error);
    return json({ error: error instanceof Error ? error.message : 'Erreur serveur.' }, 500);
  }
}
