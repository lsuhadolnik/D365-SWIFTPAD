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
