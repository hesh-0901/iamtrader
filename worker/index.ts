import { onRequest as handleAiChat } from '../functions/api/ai-chat';
import { onRequestPost as handleContactReply } from '../functions/api/contact-reply';

interface Env {
  ASSETS: Fetcher;
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_REPLY_TO?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/ai-chat') {
      return handleAiChat({ request, env });
    }

    if (url.pathname === '/api/contact-reply') {
      return handleContactReply({ request, env });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
