export function showToast(message: string, doc: Document = document) {
  const toast = doc.createElement('div');
  toast.className = 'dl-toast';
  toast.textContent = message;
  doc.body.append(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.addEventListener('transitionend', () => toast.remove());
  }, 2000);
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function debounce<T extends (...args: any[]) => void>(fn: T, wait: number) {
  let handle: number | undefined;
  return function (this: unknown, ...args: Parameters<T>) {
    if (handle) clearTimeout(handle);
    handle = window.setTimeout(() => fn.apply(this, args), wait);
  };
}
