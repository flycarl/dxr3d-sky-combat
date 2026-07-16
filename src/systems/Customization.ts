import * as THREE from 'three';

export type AircraftSkinId = 'standard' | 'red' | 'gold' | 'stealth' | 'teal';

export type AircraftSkin = {
  id: AircraftSkinId;
  label: string;
  cost: number;
  body: MaterialStyle;
  wing: MaterialStyle;
  canopy: MaterialStyle;
  trim: MaterialStyle;
  propeller: MaterialStyle;
};

export type MaterialStyle = {
  color: string;
  metalness: number;
  roughness: number;
  emissive: string;
  emissiveIntensity: number;
};

export const DEFAULT_SKIN: AircraftSkinId = 'standard';

export const AIRCRAFT_SKINS: Record<AircraftSkinId, AircraftSkin> = {
  standard: {
    id: 'standard',
    label: '蓝色双翼机',
    cost: 0,
    body: {
      color: '#2f8cff',
      metalness: 0.2,
      roughness: 0.36,
      emissive: '#0b2d64',
      emissiveIntensity: 0.18,
    },
    wing: {
      color: '#80d7ff',
      metalness: 0.22,
      roughness: 0.3,
      emissive: '#0d4f69',
      emissiveIntensity: 0.28,
    },
    canopy: {
      color: '#173b5e',
      metalness: 0.18,
      roughness: 0.12,
      emissive: '#1c83b6',
      emissiveIntensity: 0.28,
    },
    trim: {
      color: '#f4f0df',
      metalness: 0.2,
      roughness: 0.28,
      emissive: '#0d4f69',
      emissiveIntensity: 0.18,
    },
    propeller: {
      color: '#17223a',
      metalness: 0.18,
      roughness: 0.56,
      emissive: '#000000',
      emissiveIntensity: 0,
    },
  },
  red: {
    id: 'red',
    label: '红色王牌机',
    cost: 100,
    body: {
      color: '#f05b3f',
      metalness: 0.24,
      roughness: 0.32,
      emissive: '#5b120c',
      emissiveIntensity: 0.18,
    },
    wing: {
      color: '#ffd1bd',
      metalness: 0.2,
      roughness: 0.3,
      emissive: '#5b120c',
      emissiveIntensity: 0.16,
    },
    canopy: {
      color: '#31202a',
      metalness: 0.16,
      roughness: 0.16,
      emissive: '#ff8a35',
      emissiveIntensity: 0.22,
    },
    trim: {
      color: '#f4f0df',
      metalness: 0.18,
      roughness: 0.32,
      emissive: '#7d1f14',
      emissiveIntensity: 0.14,
    },
    propeller: {
      color: '#35110d',
      metalness: 0.2,
      roughness: 0.48,
      emissive: '#000000',
      emissiveIntensity: 0,
    },
  },
  gold: {
    id: 'gold',
    label: '金色飞机',
    cost: 250,
    body: {
      color: '#f1d97a',
      metalness: 0.48,
      roughness: 0.22,
      emissive: '#6a4f08',
      emissiveIntensity: 0.24,
    },
    wing: {
      color: '#fff0aa',
      metalness: 0.42,
      roughness: 0.24,
      emissive: '#6a4f08',
      emissiveIntensity: 0.2,
    },
    canopy: {
      color: '#3b2d16',
      metalness: 0.26,
      roughness: 0.14,
      emissive: '#f1d97a',
      emissiveIntensity: 0.26,
    },
    trim: {
      color: '#ffffff',
      metalness: 0.52,
      roughness: 0.18,
      emissive: '#6a4f08',
      emissiveIntensity: 0.12,
    },
    propeller: {
      color: '#866313',
      metalness: 0.45,
      roughness: 0.28,
      emissive: '#201400',
      emissiveIntensity: 0.08,
    },
  },
  stealth: {
    id: 'stealth',
    label: '黑色隐形机',
    cost: 500,
    body: {
      color: '#101318',
      metalness: 0.44,
      roughness: 0.34,
      emissive: '#05070a',
      emissiveIntensity: 0.08,
    },
    wing: {
      color: '#252b31',
      metalness: 0.38,
      roughness: 0.36,
      emissive: '#05070a',
      emissiveIntensity: 0.06,
    },
    canopy: {
      color: '#071f29',
      metalness: 0.3,
      roughness: 0.12,
      emissive: '#35ffe2',
      emissiveIntensity: 0.22,
    },
    trim: {
      color: '#b51f34',
      metalness: 0.42,
      roughness: 0.24,
      emissive: '#5f0712',
      emissiveIntensity: 0.34,
    },
    propeller: {
      color: '#050608',
      metalness: 0.36,
      roughness: 0.42,
      emissive: '#101318',
      emissiveIntensity: 0.12,
    },
  },
  teal: {
    id: 'teal',
    label: '青色发光机',
    cost: 320,
    body: {
      color: '#35ffe2',
      metalness: 0.38,
      roughness: 0.2,
      emissive: '#0d4f49',
      emissiveIntensity: 0.52,
    },
    wing: {
      color: '#b9fff4',
      metalness: 0.34,
      roughness: 0.22,
      emissive: '#0d4f49',
      emissiveIntensity: 0.4,
    },
    canopy: {
      color: '#083b3b',
      metalness: 0.24,
      roughness: 0.12,
      emissive: '#35ffe2',
      emissiveIntensity: 0.46,
    },
    trim: {
      color: '#102d3a',
      metalness: 0.36,
      roughness: 0.18,
      emissive: '#35ffe2',
      emissiveIntensity: 0.36,
    },
    propeller: {
      color: '#0c3f3b',
      metalness: 0.32,
      roughness: 0.34,
      emissive: '#0d4f49',
      emissiveIntensity: 0.22,
    },
  },
};

export function isAircraftSkinId(value: string): value is AircraftSkinId {
  return value === 'standard' || value === 'red' || value === 'gold' || value === 'stealth' || value === 'teal';
}

export function applyMaterialStyle(material: THREE.MeshStandardMaterial, style: MaterialStyle): void {
  material.color.set(style.color);
  material.metalness = style.metalness;
  material.roughness = style.roughness;
  material.emissive.set(style.emissive);
  material.emissiveIntensity = style.emissiveIntensity;
}
