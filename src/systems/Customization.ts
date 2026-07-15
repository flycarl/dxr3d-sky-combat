import * as THREE from 'three';

export type AircraftPartId = 'body' | 'leftWing' | 'rightWing' | 'propeller';
export type AircraftStyleId = 'standard' | 'red' | 'gold' | 'stealth' | 'teal';

export type AircraftCustomization = Record<AircraftPartId, AircraftStyleId>;

export type AircraftStyle = {
  id: AircraftStyleId;
  label: string;
  cost: number;
  color: string;
  metalness: number;
  roughness: number;
  emissive: string;
  emissiveIntensity: number;
};

export const AIRCRAFT_PART_LABELS: Record<AircraftPartId, string> = {
  body: '机身',
  leftWing: '左翼',
  rightWing: '右翼',
  propeller: '螺旋桨',
};

export const AIRCRAFT_STYLES: Record<AircraftStyleId, AircraftStyle> = {
  standard: {
    id: 'standard',
    label: '标准蓝',
    cost: 0,
    color: '#48d6c5',
    metalness: 0.26,
    roughness: 0.28,
    emissive: '#0d4f49',
    emissiveIntensity: 0.32,
  },
  red: {
    id: 'red',
    label: '赤红',
    cost: 80,
    color: '#f05b3f',
    metalness: 0.24,
    roughness: 0.32,
    emissive: '#5b120c',
    emissiveIntensity: 0.18,
  },
  gold: {
    id: 'gold',
    label: '金色',
    cost: 180,
    color: '#f1d97a',
    metalness: 0.46,
    roughness: 0.22,
    emissive: '#6a4f08',
    emissiveIntensity: 0.22,
  },
  stealth: {
    id: 'stealth',
    label: '黑色隐形',
    cost: 320,
    color: '#17191b',
    metalness: 0.34,
    roughness: 0.5,
    emissive: '#000000',
    emissiveIntensity: 0,
  },
  teal: {
    id: 'teal',
    label: '青色辉光',
    cost: 260,
    color: '#35ffe2',
    metalness: 0.38,
    roughness: 0.2,
    emissive: '#0d4f49',
    emissiveIntensity: 0.52,
  },
};

export const DEFAULT_CUSTOMIZATION: AircraftCustomization = {
  body: 'red',
  leftWing: 'standard',
  rightWing: 'standard',
  propeller: 'stealth',
};

export function isAircraftPartId(value: string): value is AircraftPartId {
  return value === 'body' || value === 'leftWing' || value === 'rightWing' || value === 'propeller';
}

export function isAircraftStyleId(value: string): value is AircraftStyleId {
  return value === 'standard' || value === 'red' || value === 'gold' || value === 'stealth' || value === 'teal';
}

export function applyStyleToMaterial(material: THREE.MeshStandardMaterial, styleId: AircraftStyleId): void {
  const style = AIRCRAFT_STYLES[styleId];
  material.color.set(style.color);
  material.metalness = style.metalness;
  material.roughness = style.roughness;
  material.emissive.set(style.emissive);
  material.emissiveIntensity = style.emissiveIntensity;
}
