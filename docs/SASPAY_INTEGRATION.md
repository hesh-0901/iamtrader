# SasPay checkout setup (IAMTRADER)

## Worker secrets

In Cloudflare Dashboard → Workers & Pages → `iamtrader` → Settings → Variables and Secrets, add these as **secrets** (never put their values in `wrangler.jsonc` or the frontend):

- `SASPAY_API_KEY`: SasPay secret API key with **payin** permission. A payout-only key returns `api_key_scope_forbidden`.
- `SASPAY_WEBHOOK_SECRET`: the signing secret configured for the webhook in the SasPay dashboard.

The non-secret country configuration is `SASPAY_COUNTRY=XC`, already set in `wrangler.jsonc`. The country list returned by SasPay marks `XC` (DRC/USD) active. If the merchant account does not support this country/currency combination, confirm the correct setup with SasPay before enabling live payments.

## SasPay dashboard webhook

Create a webhook endpoint with this URL:

`https://iamtrader.trade/api/payments/saspay/webhook`

Subscribe it to:
- `transaction.success`
- `transaction.failed`
- `transaction.cancelled`

Copy the webhook signing secret when SasPay displays it and save it as `SASPAY_WEBHOOK_SECRET`. SasPay does not reveal the signing secret again after creation; rotate it in the dashboard if it is lost.

## Security and activation

- The browser redirect is not treated as proof of payment.
- The webhook timestamp (maximum age: 5 minutes) and HMAC signature over the exact raw body are verified.
- The server fetches the canonical transaction from SasPay and checks its transaction ID, IAMTRADER reference in the description, amount, currency, and status before marking the payment as paid.
- CinetPay remains available and keeps its existing endpoint.

## Production validation checklist

1. Confirm `PAYMENT_SIMULATION_ENABLED=false` in the production Worker configuration. Simulation is only exposed in development builds to administrators.
2. Confirm the API key is allowed to create payin checkout sessions.
3. Add both secrets to the **production** Worker environment.
4. Configure the webhook and send a test delivery from the SasPay dashboard.
5. Test one low-value payment using the actual production flow.
6. Verify the payment record, transaction amount/currency, and user subscription in Firestore.
7. Verify that a failed/cancelled payment does not activate a subscription.
8. Check Cloudflare Worker logs for webhook signature or transaction validation errors.

Do not share API keys or webhook signing secrets in chat, commits, screenshots, or client-side code.
