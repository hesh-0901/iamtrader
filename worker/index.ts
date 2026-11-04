import { onRequest as handleAiChat } from '../functions/api/ai-chat';
import { onRequest as handleChloeChat } from '../functions/api/chloe-chat';
import { onRequest as handleInstrumentSuggest } from '../functions/api/instrument-suggest';
import { onRequestPost as handleContactReply } from '../functions/api/contact-reply';
import { handlePaymentRequest, handlePaymentCallback, handleCinetPayNotification, handleSasPayWebhook, handleSasPayVerifyRequest, handleSasPayStatusRequest } from './payments';
import { resolvePromotion } from './promotions';
import type { PaymentEnv } from './firebaseAdmin';
import { firestoreQueryCollection, firestorePatch } from './firebaseAdmin';
import { handleSubscriptionStatus } from './subscriptionStatus';
import { handlePaymentHistory } from './paymentHistory';
import { handleAdminMutation } from './admin';
import { handleInboundEmail } from './inboundEmail';
import { handleEconomicCalendar } from './economicCalendar';
import { refreshIamtraderEconomicCalendar } from './iamtraderEconomicCalendar';
import { handleEconomicEventAnalysis } from './economicEventAnalysis';
import { handlePushConfig, handlePushRegister, handlePipTalkPush } from './pushNotifications';
import { handlePipTalkInviteJoin } from './piptalkInvites';
import { handleReferralRequest } from './referrals';

interface Env {
  ASSETS: Fetcher;
  GEMINI_API_KEY?: string;
  GEMINI_API_KEY_2?: string;
  GEMINI_API_KEY_3?: string;
  GEMINI_API_KEY_4?: string;
  GEMINI_MODEL?: string;
  GEMINI_CHLOE_MODEL?: string;
  GEMINI_VYRA_MODEL?: string;
  GEMINI_INSTRUMENT_MODEL?: string;
  GEMINI_ECONOMIC_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_INSTRUMENT_MODEL?: string;
  FINNHUB_API_KEY?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_REPLY_TO?: string;
  BANK_TRANSFER_BANK_NAME?: string;
  BANK_TRANSFER_ACCOUNT_NAME?: string;
  BANK_TRANSFER_ACCOUNT_NUMBER?: string;
  BANK_TRANSFER_SWIFT?: string;
  BANK_TRANSFER_BRANCH?: string;
  BANK_TRANSFER_INSTRUCTIONS?: string;
  CINETPAY_API_KEY?: string;
  CINETPAY_API_PASSWORD?: string;
  CINETPAY_COUNTRY?: string;
  CINETPAY_PLUS_AMOUNT_CDF?: string;
  CINETPAY_COMMUNITY_AMOUNT_CDF?: string;
  SASPAY_API_KEY?: string;
  SASPAY_WEBHOOK_SECRET?: string;
  SASPAY_COUNTRY?: string;
  FIREBASE_API_KEY?: string;
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  PAYMENT_SIMULATION_ENABLED?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
}

type EnvWithPayments = Env & PaymentEnv;

export default {
  async email(message: any, env: EnvWithPayments): Promise<void> {
    await handleInboundEmail(message, env);
  },

  async scheduled(_controller: ScheduledController, env: EnvWithPayments, _ctx: ExecutionContext): Promise<void> {
    await Promise.all([
      cleanupPipTalkMediaQuota(env),
      refreshIamtraderEconomicCalendar(env),
      cleanupExpiredPromotions(env),
    ]);
  },

  async fetch(request: Request, env: EnvWithPayments): Promise<Response> {
    const url = new URL(request.url);

    // Serve short PipTalk invite URLs through the SPA entry point without changing the visible URL.
    const invitePath = url.pathname.match(/^\/i\/([A-Za-z0-9]{6})\/?$/);
    if (invitePath && request.method === 'GET') {
      const appUrl = new URL('/', url.origin);
      appUrl.searchParams.set('piptalkInvite', invitePath[1]);
      return env.ASSETS.fetch(new Request(appUrl.toString(), request));
    }

    if (url.pathname === '/api/referrals') return handleReferralRequest(request, env);

    if (url.pathname === '/api/push/config') return handlePushConfig(request, env);

    if (url.pathname === '/api/push/register') return handlePushRegister(request, env);

    if (url.pathname === '/api/piptalk/push') return handlePipTalkPush(request, env);

    if (url.pathname === '/api/piptalk/invite/join') return handlePipTalkInviteJoin(request, env);

    if (url.pathname === '/api/economic-calendar/analysis') {
      return handleEconomicEventAnalysis(request, env);
    }

    if (url.pathname === '/api/economic-calendar') {
      return handleEconomicCalendar(request, env);
    }

    if (url.pathname === '/api/ai-chat') {
      return handleAiChat({ request, env });
    }

    if (url.pathname === '/api/chloe-chat') {
      return handleChloeChat({ request, env });
    }

    if (url.pathname === '/api/instruments/suggest') {
      return handleInstrumentSuggest({ request, env });
    }

    if (url.pathname === '/api/contact-reply') {
      return handleContactReply({ request, env });
    }

    if (url.pathname === '/api/subscription/status') {
      return handleSubscriptionStatus(request, env);
    }

    if (url.pathname === '/api/payments/history') {
      return handlePaymentHistory(request, env);
    }

    if (url.pathname === '/api/promotions/quote') {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      try {
        const body = await request.json() as { plan?: string; months?: number; code?: string };
        const plan = body.plan === 'community' ? 'community' : body.plan === 'pro' ? 'pro' : null;
        if (!plan) return new Response(JSON.stringify({ success: false, message: 'Forfait invalide.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        const months = Math.max(1, Math.min(12, Math.floor(Number(body.months) || 1)));
        const baseAmount = plan === 'pro' ? Math.round(9.99 * months * 100) / 100 : Math.round((89.99 / 6 * months) * 100) / 100;
        const result = await resolvePromotion(env, plan, baseAmount, String(body.code || '').trim());
        if (!result.applied) return new Response(JSON.stringify({ success: false, message: result.message || 'Aucune réduction applicable.' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
        return new Response(JSON.stringify({ success: true, promotion: result.applied }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
      } catch (error) {
        console.error('Promotion quote failed:', error);
        return new Response(JSON.stringify({ success: false, message: 'Impossible de vérifier cette promotion pour le moment.' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
      }
    }

    if (url.pathname === '/api/promotions/active') {
      if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      try {
        const now = Date.now();
        const promotions = await firestoreQueryCollection(env, 'promotions', 500, 'endsAt');
        const active = promotions.filter(item => item.active === true &&
          Number.isFinite(new Date(String(item.startsAt || '')).getTime()) &&
          Number.isFinite(new Date(String(item.endsAt || '')).getTime()) &&
          new Date(String(item.startsAt)).getTime() <= now &&
          new Date(String(item.endsAt)).getTime() >= now &&
          Array.isArray(item.plans) && item.plans.length > 0
        ).map(item => ({
          id: String(item.id || ''),
          kind: item.kind === 'seasonal' ? 'seasonal' : 'code',
          code: item.kind === 'code' ? String(item.code || '') : '',
          name: String(item.name || ''),
          discountType: item.discountType === 'fixed' ? 'fixed' : 'percent',
          discountValue: Number(item.discountValue || 0),
          plans: item.plans,
          startsAt: String(item.startsAt || ''),
          endsAt: String(item.endsAt || ''),
          imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : ''
        }));
        return new Response(JSON.stringify({ success: true, promotions: active }), {
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' }
        });
      } catch (error) {
        console.error('Active promotions fetch failed:', error);
        return new Response(JSON.stringify({ success: false, promotions: [] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (url.pathname === '/api/admin/mutation') {
      return handleAdminMutation(request, env);
    }

    if (url.pathname === '/api/payments/initialize' || url.pathname === '/api/payments') {
      return handlePaymentRequest(request, env);
    }

    if (url.pathname === '/api/payments/status') {
      return handleSasPayStatusRequest(request, env);
    }

    if (url.pathname === '/api/payments/cinetpay/notify') {
      return handleCinetPayNotification(request, env);
    }

    if (url.pathname === '/api/payments/saspay/webhook') {
      return handleSasPayWebhook(request, env);
    }

    if (url.pathname === '/api/payments/verify') {
      return handleSasPayVerifyRequest(request, env);
    }

    if (url.pathname === '/api/payments/callback') {
      return handlePaymentCallback(request, env);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;


/** Keep PipTalk message media below the 20 GB quota by deleting the oldest assets first. */
async function cleanupPipTalkMediaQuota(env: EnvWithPayments): Promise<void> {
  const cloud = env.CLOUDINARY_CLOUD_NAME;
  const key = env.CLOUDINARY_API_KEY;
  const secret = env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) {
    console.error('PipTalk quota cleanup skipped: Cloudinary Worker credentials are missing.');
    return;
  }

  const quotaBytes = 20_000_000_000;
  // Profile pictures and market-analysis images are not PipTalk message attachments.
  const excludedPrefixes = [
    'piptalk/groups/', 'piptalk/group-avatars/', 'piptalk/avatars/', 'piptalk/profiles/',
    'piptalk/profile/', 'piptalk/users/', 'piptalk/user-avatars/', 'piptalk/members/',
    'piptalk/analyses/', 'piptalk/analysis/', 'piptalk/market-analysis/', 'piptalk/charts/'
  ];
  const auth = 'Basic ' + btoa(key + ':' + secret);
  const assets: Array<{
    public_id: string;
    created_at: string;
    bytes: number;
    resource_type: 'image' | 'video' | 'raw';
  }> = [];

  // Read every page before deleting anything. If listing is incomplete, abort safely:
  // an incomplete inventory must never be used to decide which assets to remove.
  for (const resourceType of ['image', 'video', 'raw'] as const) {
    let cursor = '';
    let pages = 0;
    do {
      const params = new URLSearchParams({ prefix: 'piptalk/', max_results: '500' });
      if (cursor) params.set('next_cursor', cursor);
      const listing = await fetch(
        'https://api.cloudinary.com/v1_1/' + cloud + '/resources/' + resourceType + '/upload?' + params,
        { headers: { Authorization: auth } }
      );
      if (!listing.ok) {
        console.error('PipTalk quota inventory failed:', resourceType, listing.status, (await listing.text()).slice(0, 300));
        return;
      }
      const data = await listing.json() as {
        resources?: Array<{ public_id?: string; created_at?: string; bytes?: number }>;
        next_cursor?: string;
      };
      for (const asset of data.resources || []) {
        const publicId = String(asset.public_id || '');
        const segments = publicId.split('/');
        if (segments.length < 4 || segments[0] !== 'piptalk' || excludedPrefixes.some(prefix => publicId.startsWith(prefix))) continue;
        assets.push({
          public_id: publicId,
          created_at: String(asset.created_at || ''),
          bytes: Math.max(0, Number(asset.bytes) || 0),
          resource_type: resourceType
        });
      }
      cursor = data.next_cursor || '';
      pages += 1;
      if (cursor && pages >= 100) {
        console.error('PipTalk quota cleanup aborted: Cloudinary inventory exceeds the safe 50,000-assets scan limit.');
        return;
      }
    } while (cursor);
  }

  let usedBytes = assets.reduce((total, asset) => total + asset.bytes, 0);
  console.log('PipTalk media storage inventory:', {
    assets: assets.length,
    usedBytes,
    quotaBytes
  });
  if (usedBytes <= quotaBytes) return;

  const oldestFirst = assets
    .filter(asset => Number.isFinite(Date.parse(asset.created_at)))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

  let deletedCount = 0;
  for (const asset of oldestFirst) {
    if (usedBytes <= quotaBytes) break;
    const deletion = await fetch(
      'https://api.cloudinary.com/v1_1/' + cloud + '/' + asset.resource_type + '/destroy',
      {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ public_id: asset.public_id, invalidate: 'true' })
      }
    );
    if (!deletion.ok) {
      console.error('PipTalk Cloudinary deletion failed:', asset.public_id, deletion.status, (await deletion.text()).slice(0, 300));
      continue;
    }
    const result = await deletion.json() as { result?: string };
    if (result.result === 'ok' || result.result === 'not found') {
      usedBytes = Math.max(0, usedBytes - asset.bytes);
      deletedCount += 1;
      console.log('PipTalk Cloudinary asset removed:', asset.public_id, result.result);
    } else {
      console.error('PipTalk Cloudinary deletion was not confirmed:', asset.public_id, result.result || 'unknown result');
    }
  }

  console.log('PipTalk quota cleanup finished:', { deletedCount, remainingBytes: usedBytes, quotaBytes });
  if (usedBytes > quotaBytes) {
    console.error('PipTalk storage remains above quota; some assets could not be deleted or have no valid creation date.');
  }
}

/** Delete Cloudinary campaign banners once their promotion has expired. */
async function cleanupExpiredPromotions(env: EnvWithPayments): Promise<void> {
  const cloud = env.CLOUDINARY_CLOUD_NAME || 'ocgef9bk';
  const key = env.CLOUDINARY_API_KEY;
  const secret = env.CLOUDINARY_API_SECRET;
  if (!key || !secret) {
    console.error('Promotion image cleanup skipped: Cloudinary API credentials are missing.');
    return;
  }
  const now = Date.now();
  let promotions: Array<Record<string, any>> = [];
  try {
    promotions = await firestoreQueryCollection(env, 'promotions', 500, 'endsAt');
  } catch (error) {
    console.error('Could not load promotions for image cleanup:', error);
    return;
  }
  const authHeader = 'Basic ' + btoa(key + ':' + secret);
  for (const promotion of promotions) {
    if (!promotion.imagePublicId || !promotion.endsAt || new Date(promotion.endsAt).getTime() >= now) continue;
    const publicId = String(promotion.imagePublicId);
    if (!publicId.startsWith('iamtrader/promotions/')) continue;
    try {
      const response = await fetch('https://api.cloudinary.com/v1_1/' + cloud + '/image/destroy', {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ public_id: publicId, invalidate: 'true' })
      });
      if (!response.ok) {
        console.error('Expired promotion image deletion failed:', publicId, response.status);
        continue;
      }
      const result = await response.json() as { result?: string };
      if (result.result === 'ok' || result.result === 'not found') {
        await firestorePatch(env, 'promotions/' + encodeURIComponent(String(promotion.id)), {
          imageUrl: null, imagePublicId: null, imageDeletedAt: new Date().toISOString()
        }, ['imageUrl', 'imagePublicId', 'imageDeletedAt']);
      }
    } catch (error) {
      console.error('Expired promotion image cleanup failed:', publicId, error);
    }
  }
}
