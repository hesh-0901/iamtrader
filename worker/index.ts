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
}

type EnvWithPayments = Env & PaymentEnv;

export default {
  async email(message: any, env: EnvWithPayments): Promise<void> {
    await handleInboundEmail(message, env);
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
