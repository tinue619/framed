import type { ProfileAssignment } from '../../models';

export interface SectionState {
  // данные изделия
  glassThickness: number;   // мм
  glassSetback:   number;   // мм (заводка)
  assignments:    ProfileAssignment[];
  // вид canvas
  panX:  number;
  panY:  number;
  scale: number;            // пикселей на мм
  // интерактивность
  hover:    string | 'edge' | null;  // id назначения или 'edge'
  selected: string | null;
  // 3D
  show3d:    boolean;
  width3d:   number;   // мм
  height3d:  number;   // мм
}

export function createState(): SectionState {
  return {
    glassThickness: 8,
    glassSetback:   10,
    assignments:    [],
    panX:  0, panY: 0, scale: 4,
    hover: null, selected: null,
    show3d: false, width3d: 400, height3d: 600,
  };
}
