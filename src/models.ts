// ── Профиль сечения (базовые типы) ────────────────────────────

export interface Point { x: number; y: number; }

export type ProfileSide = 'top' | 'bottom' | 'left' | 'right';

export interface CornerInsets {
  tl: number;   // от угла top-left
  tr: number;   // от угла top-right
  br: number;   // от угла bottom-right
  bl: number;   // от угла bottom-left
}

export interface ProfileAssignment {
  id:        string;
  profileId: string;
  offsetX:   number;
  offsetY:   number;
  sides?:    ProfileSide[];
  insets?:   CornerInsets;
}

// ── МДФ основание ─────────────────────────────────────────────

export interface MdfAssignment {
  id:      string;
  offsetX: number;     // смещение сечения по X (мм)
  offsetY: number;     // смещение сечения по Y (мм)
  shape:   Point[];    // поперечное сечение (задаётся прямо в изделии)
}

// ── Изделие ───────────────────────────────────────────────────

export const GLASS_TYPES = [
  'Прозрачное',
  'Матовое',
  'Бронза',
  'Серое',
  'Тонированное',
] as const;

export type GlassType = typeof GLASS_TYPES[number];

export interface Product {
  id:                  string;
  name:                string;
  glassType:           GlassType;
  width:               number;              // мм
  height:              number;              // мм
  glassThickness?:     number;              // мм
  glassSetback?:       number;              // мм
  profileAssignments?: ProfileAssignment[];
  mdfPieces?:          MdfAssignment[];
}

// ── Профиль ───────────────────────────────────────────────────

export interface ProfileColor { id: string; name: string; hex: string; }

export interface Profile {
  id:             string;
  name:           string;
  glassThickness: number;
  shapes:         Point[][];
  colors:         ProfileColor[];
}
