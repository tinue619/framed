import { getProfiles, deleteProfile, saveProfile, newId } from '../../db';
import { navigate } from '../../router';
import type { Profile, Point } from '../../models';
import { esc } from '../../shared/utils';
import { showToast } from '../../shared/toast';

export function renderProfilesScreen(root: HTMLElement): () => void {
  function render() {
    const profiles = getProfiles();

    root.innerHTML = `
      <div class="prl-screen">
        <div class="prl-header">
          <h2 class="prl-title">Профили сечений</h2>
          <button class="btn btn-primary" id="prl-add">
            <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Новый профиль
          </button>
        </div>
        <div class="prl-grid">
          ${profiles.map(p => profileCard(p)).join('')}
          ${!profiles.length ? `
            <div class="prl-empty">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p>Нет профилей. Создайте первый!</p>
            </div>` : ''}
        </div>
      </div>`;

    root.querySelector('#prl-add')?.addEventListener('click', () => {
      const p = saveProfile({
        id: newId(), name: 'Новый профиль',
        glassThickness: 8, shapes: [], colors: [],
      });
      navigate('profile-editor', p.id);
    });

    root.querySelectorAll<HTMLElement>('.prl-card').forEach(card => {
      card.addEventListener('click', () => navigate('profile-editor', card.dataset.id!));
    });

    root.querySelectorAll<HTMLElement>('.prl-card-del').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const p = profiles.find(x => x.id === btn.dataset.id);
        if (!p) return;
        if (!confirm(`Удалить «${p.name}»?`)) return;
        deleteProfile(p.id);
        showToast('Удалено', 'success');
        render();
      });
    });

    // Рисуем миниатюры сечений
    root.querySelectorAll<HTMLCanvasElement>('.prl-card-canvas').forEach(cv => {
      const id = cv.dataset.id!;
      const p  = profiles.find(x => x.id === id);
      if (p) drawMini(cv, p);
    });
  }

  render();
  return () => { root.innerHTML = ''; };
}

// ── card template ─────────────────────────────────────────────

function profileCard(p: Profile): string {
  const colorDots = p.colors.slice(0, 5).map(c =>
    `<span class="prl-color-dot" style="background:${esc(c.hex)}" title="${esc(c.name)}"></span>`
  ).join('');
  const moreDots = p.colors.length > 5
    ? `<span class="prl-color-more">+${p.colors.length - 5}</span>` : '';

  return `
    <div class="prl-card" data-id="${esc(p.id)}">
      <div class="prl-card-preview">
        <canvas class="prl-card-canvas" width="160" height="100" data-id="${esc(p.id)}"></canvas>
      </div>
      <div class="prl-card-body">
        <div class="prl-card-name">${esc(p.name)}</div>
        <div class="prl-card-meta">
          <span>Стекло ${p.glassThickness} мм</span>
          <span>${p.shapes[0]?.length ?? 0} точек</span>
        </div>
        <div class="prl-card-colors">${colorDots}${moreDots}</div>
      </div>
      <button class="prl-card-del" data-id="${esc(p.id)}" title="Удалить">
        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`;
}

// ── mini shape preview ────────────────────────────────────────

function drawMini(cv: HTMLCanvasElement, p: Profile) {
  const ctx  = cv.getContext('2d')!;
  const W = cv.width, H = cv.height;
  const pts: Point[] = p.shapes[0] ?? [];
  const gt  = p.glassThickness;

  ctx.fillStyle = '#f0f2f5';
  ctx.fillRect(0, 0, W, H);

  if (!pts.length) {
    ctx.fillStyle = '#c0c8d4'; ctx.font = '11px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Нет сечения', W / 2, H / 2);
    return;
  }

  const pad = 14;
  const xs  = pts.map(p => p.x), ys = pts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min((W - pad * 2) / (maxX - minX || 1), (H - pad * 2) / (maxY - minY || 1));

  const sx = (x: number) => pad + (x - minX) * scale;
  const sy = (y: number) => H - pad - (y - minY) * scale;

  // Glass reference
  const gL = (W - gt * scale) / 2, gR = (W + gt * scale) / 2;
  ctx.fillStyle = 'rgba(147,210,240,0.22)';
  ctx.fillRect(gL, 0, gR - gL, H);

  // Shape
  ctx.beginPath();
  pts.forEach((p, i) => { if (i === 0) ctx.moveTo(sx(p.x), sy(p.y)); else ctx.lineTo(sx(p.x), sy(p.y)); });
  ctx.closePath();
  ctx.fillStyle   = 'rgba(47,102,126,0.20)';
  ctx.strokeStyle = '#2f667e';
  ctx.lineWidth   = 1.5;
  ctx.fill();
  ctx.stroke();
}
