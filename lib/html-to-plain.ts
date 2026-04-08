/** Strip HTML for task descriptions / previews (browser only). */
export function htmlToPlainText(html: string): string {
  if (typeof document === 'undefined') {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.innerText || '').replace(/\s+\n/g, '\n').trim();
}
