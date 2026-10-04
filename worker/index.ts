import { onRequest as handleAiChat } from '../functions/api/ai-chat';
import { onRequestPost as handleContactReply } from '../functions/api/contact-reply';
import { handlePaymentRequest, handlePaymentCallback, handleSimulatedPaymentRequest, handleSimulatedPaymentConfirm } from './payments';
import type { PaymentEnv } from './firebaseAdmin';
import { handleSubscriptionStatus } from './subscriptionStatus';
import { handlePaymentHistory } from './paymentHistory';
import { handleAdminMutation } from './admin';

interface Env {
  ASSETS: Fetcher;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_REPLY_TO?: string;
  LABYRINTHE_API_TOKEN?: string;
  FIREBASE_API_KEY?: string;
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  PAYMENT_SIMULATION_ENABLED?: string;
}

type EnvWithPayments = Env & PaymentEnv;

export default {
  async fetch(request: Request, env: EnvWithPayments): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/ai-chat') {
      return handleAiChat({ request, env });
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

    if (url.pathname === '/api/payments/callback') {
      return handlePaymentCallback(request, env);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
