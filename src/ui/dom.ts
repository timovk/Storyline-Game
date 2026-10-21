export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | ((ev: Event) => void)> = {},
  children: Array<Node | string | null | undefined> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') node.addEventListener(k, v);
    else if (typeof v === 'boolean') {
      if (v) node.setAttribute(k, '');
    } else if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c !== null && c !== undefined) node.append(c);
  return node;
}

export function button(label: string, sub: string | null, onClick: () => void, opts: { cls?: string; disabled?: boolean } = {}): HTMLButtonElement {
  const b = el('button', { class: `btn ${opts.cls ?? ''}`.trim(), click: onClick }, [label, sub ? el('small', {}, [sub]) : null]);
  if (opts.disabled) b.disabled = true;
  return b;
}

export function toast(msg: string): void {
  const host = document.getElementById('toasts')!;
  const t = el('div', { class: 'toast' }, [msg]);
  host.append(t);
  setTimeout(() => t.remove(), 2600);
}

export function modal(content: HTMLElement | null): void {
  const m = document.getElementById('modal')!;
  m.innerHTML = '';
  if (!content) {
    m.classList.add('hidden');
    return;
  }
  m.append(el('div', { class: 'box' }, [content]));
  m.classList.remove('hidden');
}

export function confirmModal(title: string, body: string, onYes: () => void): void {
  modal(
    el('div', {}, [
      el('h2', {}, [title]),
      el('p', {}, [body]),
      el('div', { class: 'row' }, [
        button('Yes', null, () => {
          modal(null);
          onYes();
        }, { cls: 'danger' }),
        button('No', null, () => modal(null)),
      ]),
    ]),
  );
}
