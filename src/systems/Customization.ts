import * as THREE from 'three';

export type AircraftSkinId = 'standard' | 'red' | 'warbird' | 'jet' | 'stealth' | 'heavy' | 'gold' | 'teal';

export type AircraftRecipeId =
  | 'classic-biplane'
  | 'ace-biplane'
  | 'warbird'
  | 'modern-jet'
  | 'stealth-delta'
  | 'heavy-attack'
  | 'gold-racer'
  | 'future-fighter';

export type AircraftSkin = {
  id: AircraftSkinId;
  label: string;
  category: string;
  description: string;
  recipe: AircraftRecipeId;
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
    label: '经典蓝色双翼机',
    category: '经典双翼机',
    description: '双层机翼、翼间支柱和开放式座舱。',
    recipe: 'classic-biplane',
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
    category: '竞技双翼机',
    description: '交错双翼与短机身组成的王牌座驾。',
    recipe: 'ace-biplane',
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
  warbird: {
    id: 'warbird',
    label: '银翼二战战斗机',
    category: '二战螺旋桨战斗机',
    description: '长机鼻、低单翼与水滴形座舱。',
    recipe: 'warbird',
    cost: 180,
    body: {
      color: '#aeb8bb',
      metalness: 0.48,
      roughness: 0.32,
      emissive: '#1d292c',
      emissiveIntensity: 0.1,
    },
    wing: {
      color: '#5d765e',
      metalness: 0.34,
      roughness: 0.38,
      emissive: '#152719',
      emissiveIntensity: 0.08,
    },
    canopy: {
      color: '#18384d',
      metalness: 0.18,
      roughness: 0.12,
      emissive: '#2b738c',
      emissiveIntensity: 0.24,
    },
    trim: {
      color: '#f0e4c1',
      metalness: 0.3,
      roughness: 0.3,
      emissive: '#52391d',
      emissiveIntensity: 0.08,
    },
    propeller: {
      color: '#282216',
      metalness: 0.26,
      roughness: 0.44,
      emissive: '#000000',
      emissiveIntensity: 0,
    },
  },
  jet: {
    id: 'jet',
    label: '苍穹现代喷气战机',
    category: '现代喷气战斗机',
    description: '后掠翼、双垂尾与双喷口战机。',
    recipe: 'modern-jet',
    cost: 420,
    body: {
      color: '#778b9e',
      metalness: 0.46,
      roughness: 0.3,
      emissive: '#182531',
      emissiveIntensity: 0.12,
    },
    wing: {
      color: '#516779',
      metalness: 0.42,
      roughness: 0.34,
      emissive: '#14293c',
      emissiveIntensity: 0.1,
    },
    canopy: {
      color: '#1d3448',
      metalness: 0.28,
      roughness: 0.1,
      emissive: '#65b8d8',
      emissiveIntensity: 0.28,
    },
    trim: {
      color: '#d9e2e4',
      metalness: 0.38,
      roughness: 0.24,
      emissive: '#315f75',
      emissiveIntensity: 0.12,
    },
    propeller: {
      color: '#ff8a35',
      metalness: 0.2,
      roughness: 0.26,
      emissive: '#ff5a24',
      emissiveIntensity: 0.8,
    },
  },
  stealth: {
    id: 'stealth',
    label: '黑曜隐形三角翼',
    category: '隐形三角翼战机',
    description: '低矮融合机身与宽阔三角翼。',
    recipe: 'stealth-delta',
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
      color: '#ff5738',
      metalness: 0.36,
      roughness: 0.28,
      emissive: '#b51f34',
      emissiveIntensity: 0.72,
    },
  },
  heavy: {
    id: 'heavy',
    label: '雷霆重型攻击机',
    category: '双发重型攻击机',
    description: '宽机身、平直机翼与双发动机舱。',
    recipe: 'heavy-attack',
    cost: 380,
    body: {
      color: '#66715d',
      metalness: 0.32,
      roughness: 0.46,
      emissive: '#1b2418',
      emissiveIntensity: 0.08,
    },
    wing: {
      color: '#3f4b3b',
      metalness: 0.28,
      roughness: 0.5,
      emissive: '#152014',
      emissiveIntensity: 0.06,
    },
    canopy: {
      color: '#203447',
      metalness: 0.2,
      roughness: 0.14,
      emissive: '#5b91a3',
      emissiveIntensity: 0.2,
    },
    trim: {
      color: '#d8c575',
      metalness: 0.28,
      roughness: 0.34,
      emissive: '#6a4f08',
      emissiveIntensity: 0.12,
    },
    propeller: {
      color: '#ffb054',
      metalness: 0.24,
      roughness: 0.3,
      emissive: '#ff6d24',
      emissiveIntensity: 0.76,
    },
  },
  gold: {
    id: 'gold',
    label: '金色闪电竞速机',
    category: '高性能竞速机',
    description: '窄机身、短翼与醒目整流罩。',
    recipe: 'gold-racer',
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
  teal: {
    id: 'teal',
    label: '青色未来战机',
    category: '未来前掠翼战机',
    description: '前掠翼、分叉尾翼与脉冲喷口。',
    recipe: 'future-fighter',
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
  return Object.prototype.hasOwnProperty.call(AIRCRAFT_SKINS, value);
}

export function resolveAircraftSkin(value: string): AircraftSkin {
  return isAircraftSkinId(value) ? AIRCRAFT_SKINS[value] : AIRCRAFT_SKINS[DEFAULT_SKIN];
}

export function applyMaterialStyle(material: THREE.MeshStandardMaterial, style: MaterialStyle): void {
  material.color.set(style.color);
  material.metalness = style.metalness;
  material.roughness = style.roughness;
  material.emissive.set(style.emissive);
  material.emissiveIntensity = style.emissiveIntensity;
}
