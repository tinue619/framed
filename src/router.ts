export type ScreenId = 'products' | 'product-editor' | 'section-editor';
export interface Route { screen: ScreenId; id?: string; }
export type RouteHandler = (r: Route) => void;

const TITLES: Record<ScreenId, string> = {
  'products':       'Изделия',
  'product-editor': 'Изделие',
  'section-editor': 'Редактор сечения',
};

const VALID: ScreenId[] = ['products', 'product-editor', 'section-editor'];

export function navigate(screen: ScreenId, id?: string) {
  window.location.hash = id ? `${screen}/${id}` : screen;
}

export function parseHash(hash: string): Route {
  const [screen, id] = (hash.replace(/^#/, '') || 'products').split('/');
  const s = (VALID.includes(screen as ScreenId) ? screen : 'products') as ScreenId;
  return { screen: s, id };
}

export function initRouter(handler: RouteHandler) {
  window.addEventListener('hashchange', () => handler(parseHash(window.location.hash)));
  handler(parseHash(window.location.hash));
}

export function updateNav(screen: ScreenId) {
  const el = document.getElementById('header-title');
  if (el) el.textContent = TITLES[screen] ?? 'Администрирование';
  document.querySelectorAll<HTMLElement>('[data-screen]').forEach(e =>
    e.classList.toggle('active', e.dataset.screen === screen)
  );
  const main = document.querySelector<HTMLElement>('.admin-main');
  if (main) main.classList.toggle('se-fullscreen', screen === 'section-editor');
}
