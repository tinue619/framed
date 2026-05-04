import type { Product, Profile } from './models';

const get  = <T>(k: string): T | null => { try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; } };
const set  = (k: string, v: unknown)  => localStorage.setItem(k, JSON.stringify(v));
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function upsert<T extends { id: string }>(list: T[], item: T) {
  const i = list.findIndex(x => x.id === item.id);
  if (i >= 0) list[i] = item; else list.push(item);
}

function seed() {
  if (get('_seeded_v3')) return;
  const id = newId;
  set('products', [
    { id: id(), name: 'Фасад стандарт',   glassType: 'Прозрачное', width: 400, height: 700 },
    { id: id(), name: 'Витрина 600×900',   glassType: 'Матовое',    width: 600, height: 900 },
    { id: id(), name: 'Дверная вставка',   glassType: 'Бронза',     width: 300, height: 2000 },
  ]);
  set('profiles', [{
    id: id(), name: 'Профиль 20×15', glassThickness: 8, colors: [],
    shapes: [[{ x: -10, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 15 }, { x: -10, y: 15 }]],
  }]);
  set('_seeded_v3', true);
}

// ── Products ─────────────────────────────────────────────────

export const getProducts   = (): Product[] => get<Product[]>('products') ?? [];
export const getProduct    = (id: string): Product | null => getProducts().find(x => x.id === id) ?? null;
export const saveProduct   = (p: Product)  => { const l = getProducts(); upsert(l, p); set('products', l); return p; };
export const deleteProduct = (id: string)  => set('products', getProducts().filter(x => x.id !== id));

// ── Profiles ─────────────────────────────────────────────────

export const getProfiles   = (): Profile[] => get<Profile[]>('profiles') ?? [];
export const saveProfile   = (p: Profile)  => { const l = getProfiles(); upsert(l, p); set('profiles', l); return p; };
export const deleteProfile = (id: string)  => set('profiles', getProfiles().filter(x => x.id !== id));

seed();
