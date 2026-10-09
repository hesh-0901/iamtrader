import { onRequest as handleAiChat } from '../functions/api/ai-chat';
import { onRequest as handleChloeChat } from '../functions/api/chloe-chat';
import { onRequestPost as handleContactReply } from '../functions/api/contact-reply';
import { handlePaymentRequest, handlePaymentCallback, handleCinetPayNotification, handleSimulatedPaymentRequest, handleSimulatedPaymentConfirm } from './payments';
import type { PaymentEnv } from './firebaseAdmin';
import { handleSubscriptionStatus } from './subscriptionStatus';
import { handlePaymentHistory } from './paymentHistory';
import { handleAdminMutation } from './admin';
import { handleInboundEmail } from './inboundEmail';
import { handleEconomicCalendar } from './economicCalendar';
import { handleEconomicEventAnalysis } from './economicEventAnalysis';

interface Env {
  ASSETS: Fetcher;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  FINNHUB_API_KEY?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_REPLY_TO?: string;
  CINETPAY_API_KEY?: string;
  CINETPAY_API_PASSWORD?: string;
  CINETPAY_COUNTRY?: string;
  CINETPAY_PLUS_AMOUNT_CDF?: string;
  CINETPAY_COMMUNITY_AMOUNT_CDF?: string;
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
    await cleanupExpiredCloudinaryMedia(env);
  },

  async fetch(request: Request, env: EnvWithPayments): Promise<Response> {
    const url = new URL(request.url);

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

    if (url.pathname === '/api/contact-reply') {
      return handleContactReply({ request, env });
    }

    if (url.pathname === '/api/payments/simulate') {
      return handleSimulatedPaymentRequest(request, env);
    }

    if (url.pathname === '/api/payments/simulate/confirm') {
      return handleSimulatedPaymentConfirm(request, env);
    }

    if (url.pathname === '/api/subscription/status') {
      return handleSubscriptionStatus(request, env);
    }

    if (url.pathname === '/api/payments/history') {
      return handlePaymentHistory(request, env);
    }

    if (url.pathname === '/api/admin/mutation') {
      return handleAdminMutation(request, env);
    }

    if (url.pathname === '/api/payments') {
      return handlePaymentRequest(request, env);
    }

    if (url.pathname === '/api/payments/cinetpay/notify') {
      return handleCinetPayNotification(request, env);
    }

    if (url.pathname === '/api/payments/callback') {
      return handlePaymentCallback(request, env);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;


/** Delete PipTalk Cloudinary assets after 72 hours. */
async function cleanupExpiredCloudinaryMedia(env: EnvWithPayments): Promise<void> {
  const cloud = env.CLOUDINARY_CLOUD_NAME;
  const key = env.CLOUDINARY_API_KEY;
  const secret = env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) {
    console.error('PipTalk cleanup skipped: Cloudinary Worker credentials are missing.');
    return;
  }

  const cutoff = Date.now() - 72 * 60 * 60 * 1000;
  const auth = 'Basic ' + btoa(key + ':' + secret);
  for (const resourceType of ['image', 'video', 'raw']) {
    let cursor = '';
    let pages = 0;
    do {
      const params = new URLSearchParams({ prefix: 'piptalk/', max_results: '500' });
      if (cursor) params.set('next_cursor', cursor);
      const listing = await fetch('https://api.cloudinary.com/v1_1/' + cloud + '/resources/' + resourceType + '/upload?' + params, {
        headers: { Authorization: auth }
      });
      if (!listing.ok) {
        console.error('Cloudinary listing failed:', resourceType, listing.status, (await listing.text()).slice(0, 300));
        break;
      }
      const data = await listing.json() as { resources?: Array<{ public_id: string; created_at: string }>; next_cursor?: string };
      for (const asset of data.resources || []) {
        if (!asset.public_id.startsWith('piptalk/') || !asset.created_at || new Date(asset.created_at).getTime() > cutoff) continue;
        const body = new URLSearchParams({ public_id: asset.public_id, invalidate: 'true' });
        const deletion = await fetch('https://api.cloudinary.com/v1_1/' + cloud + '/' + resourceType + '/destroy', {
          method: 'POST',
          headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
          body
        });
        if (!deletion.ok) console.error('Cloudinary deletion failed:', asset.public_id, deletion.status);
      }
      cursor = data.next_cursor || '';
      pages += 1;
    } while (cursor && pages < 10);
  }
}
