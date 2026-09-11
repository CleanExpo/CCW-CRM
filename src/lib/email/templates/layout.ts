/**
 * Shared template scaffolding (UNI-2671 A2).
 *
 * Mobile-readable means: one column, no external stylesheet, no web fonts, no
 * images required to understand the message, and a plain-text part that is a
 * real message rather than a "view this in a browser" stub. Mail clients strip
 * <style> blocks, so everything here is inline.
 */

export type TemplateName = 'team-invitation' | 'password-reset' | 'booking-confirmation';

export type RenderedEmail = {
  template: TemplateName;
  subject: string;
  text: string;
  html: string;
};

/** Minimal, correct HTML escaping for values interpolated into the HTML part. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type LayoutInput = {
  /** Short line at the top of the message. Plain text; escaped by this function. */
  heading: string;
  /** Body paragraphs, in order. Plain text; escaped by this function. */
  paragraphs: string[];
  /** Optional single call to action. */
  action?: { label: string; url: string };
  /** Small print under the action, e.g. link expiry. */
  footnotes?: string[];
};

const FOOT = 'CC Warehouse — Optix';

/**
 * A single wrapper so all three templates look like one system. Kept
 * deliberately plain: a transactional email that looks like marketing is more
 * likely to be filtered, and this account has no sending reputation yet.
 */
export function renderLayout(input: LayoutInput): { text: string; html: string } {
  const textLines: string[] = [input.heading, '', ...input.paragraphs];

  if (input.action) {
    textLines.push('', input.action.label + ':', input.action.url);
  }
  if (input.footnotes?.length) {
    textLines.push('', ...input.footnotes);
  }
  textLines.push('', '--', FOOT);

  const htmlParagraphs = input.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#1f2933;">${escapeHtml(p)}</p>`
    )
    .join('');

  const htmlAction = input.action
    ? `<p style="margin:0 0 16px;">
         <a href="${escapeHtml(input.action.url)}"
            style="display:inline-block;padding:12px 20px;background:#1f2933;color:#ffffff;
                   text-decoration:none;border-radius:4px;font-size:16px;">${escapeHtml(
                     input.action.label
                   )}</a>
       </p>
       <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#52606d;
                 word-break:break-all;">If the button does not work, copy this link into your browser:<br>${escapeHtml(
                   input.action.url
                 )}</p>`
    : '';

  const htmlFootnotes = input.footnotes?.length
    ? input.footnotes
        .map(
          (f) =>
            `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#52606d;">${escapeHtml(f)}</p>`
        )
        .join('')
    : '';

  const html = `<!doctype html>
<html lang="en-AU">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7fa;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <h1 style="margin:0 0 20px;font-size:20px;line-height:1.3;color:#1f2933;">${escapeHtml(
      input.heading
    )}</h1>
    ${htmlParagraphs}
    ${htmlAction}
    ${htmlFootnotes}
    <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e4e7eb;
              font-size:13px;color:#7b8794;">${FOOT}</p>
  </div>
</body>
</html>`;

  return { text: textLines.join('\n'), html };
}
