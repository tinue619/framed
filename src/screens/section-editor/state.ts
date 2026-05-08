import type { ProfileAssignment, MdfAssignment } from '../../models';

export interface SectionState {
  // данные изделия
  glassThickness: number;
  glassSetback:   number;
  assignments:    ProfileAssignment[];
  mdfPieces:      MdfAssignment[];
  // вид canvas
  panX:  number;
  panY:  number;
  scale: number;
  // интерактивность
  hover:    string | 'edge' | null;
  selected: string | null;
  // 3D
  show3d:    boolean;
  width3d:   number;
  height3d:  number;
}

export function createState(): SectionState {
  return {
    glassThickness: 8,
    glassSetback:   10,
    assignments:    [],
    mdfPieces:      [],
    panX:  0, panY: 0, scale: 4,
    hover: null, selected: null,
    show3d: false, width3d: 400, height3d: 600,
  };
}
