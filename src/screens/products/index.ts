import { getProducts, deleteProduct, newId, saveProduct } from '../../db';
import { navigate } from '../../router';
import { GLASS_TYPES } from '../../models';
import type { Product } from '../../models';
import { esc } from '../../shared/utils';
import { showToast } from '../../shared/toast';

// ── glass type colour tags ────────────────────────────────────

const GLASS_COLOR: Record<string, string> = {
  'Прозрачное': '#dbeafe',
  'Матовое':    '#f1f5f9',
  'Бронза':     '#fef3c7',
  'Серое':      '#e2e8f0',
  'Тонированное': '#ede9fe',
};

function glassTag(type: string) {
  const bg = GLASS_COLOR[type] ?? '#f0f4f6';
  return `<span class="prod-glass-tag" style="background:${bg}">${esc(type)}</span>`;
}

// ── card ─────────────────────────────────────────────────────

function cardHTML(p: Product) {
  return `
    <div class="prod-card" data-id="${esc(p.id)}">
      <div class="prod-card-body">
        <div class="prod-card-name">${esc(p.name)}</div>
        <div class="prod-card-meta">
          ${glassTag(p.glassType)}
          <span class="prod-card-dims">${p.width} × ${p.height} мм</span>
        </div>
      </div>
      <button class="prod-card-del" data-del="${esc(p.id)}" title="Удалить">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>`;
}

// ── add-card (new product shortcut) ──────────────────────────

const ADD_CARD = `
  <div class="prod-card prod-card-add" id="prod-add">
    <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    <span>Новое изделие</span>
  </div>`;

// ── render ────────────────────────────────────────────────────

export function renderProductsScreen(root: HTMLElement): () => void {
  function render() {
    const products = getProducts();
    root.innerHTML = `
      <div class="prod-screen">
        <div class="prod-grid">
          ${ADD_CARD}
          ${products.map(cardHTML).join('')}
        </div>
      </div>`;

    // new product
    root.querySelector('#prod-add')!.addEventListener('click', () => {
      const p: Product = {
        id:        newId(),
        name:      'Новое изделие',
        glassType: GLASS_TYPES[0],
        width:     400,
        height:    700,
      };
      saveProduct(p);
      navigate('product-editor', p.id);
    });

    // open existing
    root.querySelectorAll<HTMLElement>('.prod-card[data-id]').forEach(card => {
      card.addEventListener('click', e => {
        if ((e.target as HTMLElement).closest('[data-del]')) return;
        navigate('product-editor', card.dataset.id!);
      });
    });

    // delete
    root.querySelectorAll<HTMLElement>('[data-del]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.del!;
        deleteProduct(id);
        showToast('Удалено', 'success');
        render();
      });
    });
  }

  render();
  return () => { root.innerHTML = ''; };
}
