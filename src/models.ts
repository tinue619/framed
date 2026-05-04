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
  id:       string;
  profileId: string;
  offsetX:  number;
  offsetY:  number;
  sides?:   ProfileSide[];
  insets?:  CornerInsets;
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
