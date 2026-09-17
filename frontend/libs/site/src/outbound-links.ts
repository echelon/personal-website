/** Extend the article's static link policy to links created or changed by an embed. */
export function watchOutboundLinks(root: HTMLElement, siteOrigin: string): () => void {
  const base = new URL(siteOrigin);
  const apply = (link: Element) => {
    const href = link.getAttribute('href');
    if (href === null) return;
    let destination: URL;
    try { destination = new URL(href, base); } catch { return; }
    if (!['http:', 'https:'].includes(destination.protocol) || destination.origin === base.origin) return;
    const tokens = (link.getAttribute('rel') ?? '').split(/[\t\n\f\r ]+/).filter(Boolean);
    for (const token of ['nofollow', 'noreferrer']) {
      if (!tokens.some(value => value.toLowerCase() === token)) tokens.push(token);
    }
    const value = tokens.join(' ');
    if (value !== link.getAttribute('rel')) link.setAttribute('rel', value);
  };
  const scan = (element: Element) => {
    if (element.matches('a[href], area[href]')) apply(element);
    element.querySelectorAll('a[href], area[href]').forEach(apply);
  };
  scan(root);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') {
        const element = record.target as Element;
        if (element.matches('a[href], area[href]')) apply(element);
      } else {
        for (const node of record.addedNodes) {
          if (node instanceof Element) scan(node);
        }
      }
    }
  });
  observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['href', 'rel'] });
  return () => observer.disconnect();
}
