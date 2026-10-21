type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  exiting: boolean;
}

let toastId = 0;
let container: HTMLDivElement | null = null;
let toasts: ToastItem[] = [];

function ensureContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

function render() {
  const c = ensureContainer();
  c.innerHTML = toasts.map(t =>
    `<div class="toast ${t.type}${t.exiting ? ' out' : ''}">${escapeHtml(t.message)}</div>`
  ).join('');
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function addToast(message: string, type: ToastType, duration: number = 3000) {
  const id = ++toastId;
  toasts.push({ id, message, type, exiting: false });
  render();
  setTimeout(() => {
    const t = toasts.find(t => t.id === id);
    if (t) t.exiting = true;
    render();
    setTimeout(() => {
      toasts = toasts.filter(t => t.id !== id);
      render();
    }, 200);
  }, duration);
}

export const toast = {
  success: (msg: string) => addToast(msg, 'success', 3000),
  error: (msg: string) => addToast(msg, 'error', 5000),
  info: (msg: string) => addToast(msg, 'info', 3000),
  warning: (msg: string) => addToast(msg, 'warning', 4000),
};
