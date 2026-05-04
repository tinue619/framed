export type ToastType = 'success' | 'error' | 'info';
export function showToast(msg: string, type: ToastType = 'info') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = Object.assign(document.createElement('div'), { className: `toast ${type}`, textContent: msg });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}
