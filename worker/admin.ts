import { firestoreGet, firestorePatch, firestoreDelete, firestoreSet, firestoreQueryCollection, verifyFirebaseIdToken, type PaymentEnv } from './firebaseAdmin';

type AdminEnv = PaymentEnv;

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
      if (kind === 'code' && existing && String(existing.id || id) !== id) return json({ error: 'Ce code existe déjà. Générez-en un autre.' }, 409);
      const maxUses = data.maxUses === '' || data.maxUses === null || data.maxUses === undefined ? null : Number(data.maxUses);
      if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) return json({ error: 'La limite d’utilisation doit être un entier positif.' }, 400);
      const record = {
        id, kind, ...(kind === 'code' ? { code: rawCode } : {}), name, active: data.active !== false,
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

    if (body.action === 'get-payments') {
      const payments = await firestoreQueryCollection(env, 'payments', 250, 'createdAt');
      return json({ success: true, payments: payments.map(payment => normalizePayment(payment)) });
    }

    if (body.action === 'update-payment') {
      if (!body.paymentId || !body.data) return json({ error: 'Paiement ou données manquants.' }, 400);
      const allowed = ['status','paidAt','confirmedAt','invalidatedAt','cancelledAt'];
      const data = Object.fromEntries(Object.entries(body.data).filter(([key, value]) => allowed.includes(key) && value !== undefined));
      if (!Object.keys(data).length) return json({ error: 'Aucune modification autorisée.' }, 400);
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

    if (body.action === 'update-user') {
      if (!body.uid || !body.data) return json({ error: 'Utilisateur ou données manquants.' }, 400);
      const allowed = ['role','plan','status','paymentDate','subscriptionStartAt','subscriptionExpiresAt','subscriptionStatus','paymentStatus','pendingPlan','planChangeRequestedAt','planChangeConfirmedAt'];
      const data = Object.fromEntries(Object.entries(body.data).filter(([key, value]) => allowed.includes(key) && value !== undefined));
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
