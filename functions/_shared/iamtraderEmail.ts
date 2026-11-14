export type IamtraderEmailVariant = 'new-message' | 'support-reply';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function sanitizeRichHtml(input: string): string {
  const allowedTags = new Set(['p','br','div','span','strong','b','em','i','u','ul','ol','li','blockquote','a','h1','h2','h3','font']);
  return input
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<(iframe|object|svg|math)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (full, rawTag, rawAttrs) => {
      const tag = String(rawTag).toLowerCase();
      if (!allowedTags.has(tag)) return '';
      if (full.startsWith('</')) return tag === 'br' ? '' : `</${tag}>`;
      const attrs = String(rawAttrs || '');
      const style = attrs.match(/style=["']([^"']*)["']/i)?.[1] || '';
      const safeStyle = style.split(';').map(rule => rule.trim()).filter(rule => /^(font-family|font-size|color|text-align|font-weight|font-style|text-decoration):\s*[#(),.% a-zA-Z0-9_-]+$/.test(rule)).join(';');
      const href = tag === 'a' ? attrs.match(/href=["'](https?:\/\/[^"']+|mailto:[^"']+)["']/i)?.[1] : '';
      const fontSize = tag === 'font' ? ({'1':'10px','2':'13px','3':'16px','4':'18px','5':'24px','6':'32px','7':'40px'} as Record<string,string>)[attrs.match(/size=["']([1-7])["']/i)?.[1] || ''] : '';
      const fontColor = tag === 'font' ? attrs.match(/color=["'](#[0-9a-f]{3,8}|[a-z]{3,20})["']/i)?.[1] : '';
      const fontFace = tag === 'font' ? attrs.match(/face=["']([a-zA-Z ,'-]{1,60})["']/i)?.[1] : '';
      const extraStyle = [fontSize ? `font-size:${fontSize}` : '', fontColor ? `color:${fontColor}` : '', fontFace ? `font-family:${fontFace}` : ''].filter(Boolean).join(';');
      return `<${tag === 'font' ? 'span' : tag}${safeStyle || extraStyle ? ` style="${[safeStyle,extraStyle].filter(Boolean).join(';')}"` : ''}${href ? ` href="${href}" target="_blank" rel="noopener noreferrer"` : ''}>`;
    });
}

export function buildIamtraderEmail(message: string, variant: IamtraderEmailVariant, messageHtml?: string): string {
  const safeMessage = messageHtml ? sanitizeRichHtml(messageHtml) : escapeHtml(message).replace(/\n/g, '<br>');
  const preheader = variant === 'support-reply'
    ? 'Une réponse de l’équipe iamtrader.'
    : 'Un message de l’équipe iamtrader.';

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>iamtrader</title>
</head>
<body style="margin:0;padding:0;background:#f1f6f4;font-family:Arial,Helvetica,sans-serif;color:#203b32">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#f1f6f4">
    <tr>
      <td align="center" style="padding:30px 14px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #dce9e3;border-radius:12px;overflow:hidden">
          <tr><td style="height:4px;background:#00b889;font-size:0;line-height:0">&nbsp;</td></tr>
          <tr>
            <td style="padding:25px 32px 23px;border-bottom:1px solid #e6efea">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
                <tr>
                  <td valign="middle" style="padding-right:14px">
                    <img src="https://iamtrader.trade/brand/logo-iamtrader-full.png" width="104" alt="iamtrader" style="display:block;width:104px;max-width:104px;height:auto;border:0">
                  </td>
                  <td valign="middle">
                    <div style="font-size:14px;font-weight:700;letter-spacing:.25px;line-height:1.3;color:#174536">iamtrader</div>
                    <div style="margin-top:4px;font-size:10px;font-weight:600;letter-spacing:.15px;line-height:1.5;color:#078766">le trader que vous devez être !</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:31px 32px 29px">
              <div style="font-size:15px;line-height:1.85;color:#263f38;overflow-wrap:anywhere">${safeMessage}</div>
              <div style="margin-top:29px;padding-top:19px;border-top:1px solid #e7efeb">
                <div style="font-size:13px;font-weight:700;line-height:1.5;color:#087f63">Iamtrader team</div>
                <div style="margin-top:9px;font-size:12px;line-height:1.8;color:#71877d">
                  <a href="mailto:hello@iamtrader.trade" style="color:#078766;text-decoration:none">hello@iamtrader.trade</a>
                  <span style="padding:0 7px;color:#a6b8af">·</span>
                  <a href="https://iamtrader.trade" style="color:#078766;text-decoration:none">iamtrader.trade</a>
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:14px 20px;background:#f7faf8;border-top:1px solid #e7efeb;font-size:10px;line-height:1.6;color:#87998f">© ${new Date().getFullYear()} iamtrader</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
