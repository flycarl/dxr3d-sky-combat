import * as THREE from 'three';
import {
  AIRCRAFT_SKINS,
  applyMaterialStyle,
  resolveAircraftSkin,
  type AircraftRecipeId,
  type AircraftSkin,
  type AircraftSkinId,
  type MaterialStyle,
} from '../systems/Customization';

export type AircraftModel = {
  group: THREE.Group;
  propellers: THREE.Group[];
  exhausts: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[];
  bodyMaterials: THREE.MeshStandardMaterial[];
  dispose(): void;
};

export type AircraftModelDiagnostic = {
  id: AircraftSkinId;
  recipe: AircraftRecipeId;
  meshes: number;
  propellers: number;
  exhausts: number;
};

type BuildContext = {
  root: THREE.Group;
  definition: AircraftSkin;
  materials: {
    body: THREE.MeshStandardMaterial;
    wing: THREE.MeshStandardMaterial;
    canopy: THREE.MeshStandardMaterial;
    trim: THREE.MeshStandardMaterial;
    propulsion: THREE.MeshStandardMaterial;
    dark: THREE.MeshStandardMaterial;
  };
  geometries: Set<THREE.BufferGeometry>;
  materialSet: Set<THREE.Material>;
  propellers: THREE.Group[];
  exhausts: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[];
  bodyMaterials: THREE.MeshStandardMaterial[];
};

type RecipeBuilder = (context: BuildContext) => void;

function material(style: MaterialStyle): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial();
  applyMaterialStyle(result, style);
  return result;
}

function createContext(definition: AircraftSkin): BuildContext {
  const body = material(definition.body);
  const wing = material(definition.wing);
  const canopy = material(definition.canopy);
  const trim = material(definition.trim);
  const propulsion = material(definition.propeller);
  const dark = new THREE.MeshStandardMaterial({
    color: '#11161b',
    roughness: 0.46,
    metalness: 0.5,
    emissive: '#020405',
    emissiveIntensity: 0.06,
  });
  return {
    root: new THREE.Group(),
    definition,
    materials: { body, wing, canopy, trim, propulsion, dark },
    geometries: new Set(),
    materialSet: new Set([body, wing, canopy, trim, propulsion, dark]),
    propellers: [],
    exhausts: [],
    bodyMaterials: [body, wing, trim],
  };
}

function addMesh(
  context: BuildContext,
  name: string,
  geometry: THREE.BufferGeometry,
  materialValue: THREE.MeshStandardMaterial,
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
  parent: THREE.Object3D = context.root,
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  context.geometries.add(geometry);
  context.materialSet.add(materialValue);
  const result = new THREE.Mesh(geometry, materialValue);
  result.name = name;
  result.position.set(...position);
  result.rotation.set(...rotation);
  result.scale.set(...scale);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}

function addBox(
  context: BuildContext,
  name: string,
  size: [number, number, number],
  materialValue: THREE.MeshStandardMaterial,
  position?: [number, number, number],
  rotation?: [number, number, number],
  parent?: THREE.Object3D,
): THREE.Mesh {
  return addMesh(context, name, new THREE.BoxGeometry(...size), materialValue, position, rotation, [1, 1, 1], parent);
}

function addCylinder(
  context: BuildContext,
  name: string,
  radii: [number, number],
  length: number,
  materialValue: THREE.MeshStandardMaterial,
  position?: [number, number, number],
  rotation: [number, number, number] = [Math.PI / 2, 0, 0],
  segments = 14,
  parent?: THREE.Object3D,
): THREE.Mesh {
  return addMesh(
    context,
    name,
    new THREE.CylinderGeometry(radii[0], radii[1], length, segments),
    materialValue,
    position,
    rotation,
    [1, 1, 1],
    parent,
  );
}

function addCone(
  context: BuildContext,
  name: string,
  radius: number,
  length: number,
  materialValue: THREE.MeshStandardMaterial,
  position?: [number, number, number],
  rotation: [number, number, number] = [-Math.PI / 2, 0, 0],
  segments = 14,
): THREE.Mesh {
  return addMesh(context, name, new THREE.ConeGeometry(radius, length, segments), materialValue, position, rotation);
}

function addCanopy(
  context: BuildContext,
  position: [number, number, number],
  scale: [number, number, number],
  name = 'cockpitGlass',
): THREE.Mesh {
  return addMesh(
    context,
    name,
    new THREE.SphereGeometry(0.38, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    context.materials.canopy,
    position,
    [0, 0, 0],
    scale,
  );
}

function planformGeometry(span: number, rootChord: number, tipChord: number, sweep: number, thickness = 0.06): THREE.ExtrudeGeometry {
  const half = span / 2;
  const shape = new THREE.Shape();
  shape.moveTo(0, -rootChord / 2);
  shape.lineTo(-half, -tipChord / 2 + sweep);
  shape.lineTo(-half, tipChord / 2 + sweep);
  shape.lineTo(0, rootChord / 2);
  shape.lineTo(half, tipChord / 2 + sweep);
  shape.lineTo(half, -tipChord / 2 + sweep);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, thickness / 2, 0);
  geometry.computeVertexNormals();
  return geometry;
}

function addWing(
  context: BuildContext,
  name: string,
  span: number,
  rootChord: number,
  tipChord: number,
  sweep: number,
  position: [number, number, number],
  materialValue = context.materials.wing,
  thickness = 0.06,
): THREE.Mesh {
  return addMesh(context, name, planformGeometry(span, rootChord, tipChord, sweep, thickness), materialValue, position);
}

function addPropeller(
  context: BuildContext,
  position: [number, number, number],
  radius: number,
  bladeCount = 2,
): THREE.Group {
  const propeller = new THREE.Group();
  propeller.name = 'propeller';
  propeller.position.set(...position);
  for (let index = 0; index < bladeCount; index += 1) {
    addBox(
      context,
      `propellerBlade${index + 1}`,
      [0.09, radius * 2, 0.045],
      context.materials.propulsion,
      [0, 0, 0],
      [0, 0, (Math.PI * index) / bladeCount],
      propeller,
    );
  }
  addMesh(
    context,
    'propellerHub',
    new THREE.SphereGeometry(radius * 0.18, 10, 7),
    context.materials.trim,
    [0, 0, -0.02],
    [0, 0, 0],
    [1, 1, 1],
    propeller,
  );
  context.root.add(propeller);
  context.propellers.push(propeller);
  return propeller;
}

function addExhaust(context: BuildContext, position: [number, number, number], radius = 0.16): THREE.Mesh {
  const exhaust = addCylinder(
    context,
    `engineExhaust${context.exhausts.length + 1}`,
    [radius, radius * 0.78],
    0.18,
    context.materials.propulsion,
    position,
  ) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  context.exhausts.push(exhaust);
  return exhaust;
}

function addTailAssembly(context: BuildContext, z: number, width: number, finHeight: number): void {
  addWing(context, 'tailPlane', width, 0.42, 0.22, 0.12, [0, 0.12, z], context.materials.wing, 0.045);
  addBox(context, 'verticalTail', [0.08, finHeight, 0.42], context.materials.wing, [0, finHeight / 2, z + 0.05], [-0.12, 0, 0]);
}

function addLandingHints(context: BuildContext, z: number, width: number): void {
  for (const side of [-1, 1]) {
    addBox(context, `landingStrut${side}`, [0.035, 0.42, 0.035], context.materials.dark, [side * width, -0.24, z], [0, 0, side * 0.22]);
    addCylinder(context, `landingWheel${side}`, [0.13, 0.13], 0.06, context.materials.dark, [side * width, -0.43, z], [0, 0, Math.PI / 2], 10);
  }
}

function buildClassicBiplane(context: BuildContext): void {
  addCylinder(context, 'fuselage', [0.3, 0.42], 2.65, context.materials.body);
  addCylinder(context, 'radialCowling', [0.36, 0.36], 0.42, context.materials.trim, [0, 0, -1.48]);
  addWing(context, 'lowerWing', 3.35, 0.72, 0.58, 0.08, [0, -0.08, -0.18]);
  addWing(context, 'upperWing', 3.55, 0.7, 0.54, 0.02, [0, 0.58, -0.28]);
  for (const x of [-1.15, -0.62, 0.62, 1.15]) addBox(context, `wingStrut${x}`, [0.045, 0.7, 0.045], context.materials.trim, [x, 0.25, -0.2], [0, 0, x > 0 ? -0.08 : 0.08]);
  addCanopy(context, [0, 0.3, 0.18], [0.82, 0.54, 0.72], 'openCockpit');
  addTailAssembly(context, 1.08, 1.25, 0.66);
  addLandingHints(context, -0.38, 0.62);
  addPropeller(context, [0, 0, -1.78], 0.68, 2);
}

function buildAceBiplane(context: BuildContext): void {
  addCylinder(context, 'compactFuselage', [0.27, 0.38], 2.4, context.materials.body);
  addCone(context, 'spinner', 0.29, 0.5, context.materials.trim, [0, 0, -1.42]);
  addWing(context, 'staggeredLowerWing', 3.0, 0.68, 0.4, 0.18, [0, -0.12, 0.02]);
  addWing(context, 'staggeredUpperWing', 3.3, 0.62, 0.32, -0.02, [0, 0.5, -0.42]);
  for (const x of [-1.0, -0.54, 0.54, 1.0]) addBox(context, `angledStrut${x}`, [0.04, 0.68, 0.04], context.materials.trim, [x, 0.2, -0.2], [0.18, 0, x > 0 ? -0.18 : 0.18]);
  addCanopy(context, [0, 0.29, 0.06], [0.72, 0.48, 0.66], 'aceCockpit');
  addWing(context, 'aceTailPlane', 1.05, 0.36, 0.14, 0.16, [0, 0.08, 0.92], context.materials.trim, 0.04);
  addBox(context, 'aceFin', [0.07, 0.62, 0.36], context.materials.wing, [0, 0.34, 0.96], [-0.2, 0, 0]);
  addLandingHints(context, -0.2, 0.54);
  addPropeller(context, [0, 0, -1.72], 0.62, 2);
}

function buildWarbird(context: BuildContext): void {
  addCylinder(context, 'longFuselage', [0.25, 0.42], 3.2, context.materials.body);
  addCylinder(context, 'engineCowling', [0.39, 0.39], 0.75, context.materials.body, [0, 0, -1.45]);
  addCone(context, 'warbirdSpinner', 0.3, 0.48, context.materials.trim, [0, 0, -1.99]);
  addWing(context, 'lowEllipticWing', 3.45, 0.86, 0.3, 0.16, [0, -0.16, -0.22], context.materials.wing, 0.085);
  addCanopy(context, [0, 0.34, -0.16], [0.82, 0.72, 1.18], 'bubbleCanopy');
  addTailAssembly(context, 1.3, 1.25, 0.72);
  addBox(context, 'leftWingMark', [0.34, 0.025, 0.34], context.materials.trim, [-1.0, -0.09, -0.08]);
  addBox(context, 'rightWingMark', [0.34, 0.025, 0.34], context.materials.trim, [1.0, -0.09, -0.08]);
  addPropeller(context, [0, 0, -2.27], 0.72, 3);
}

function buildModernJet(context: BuildContext): void {
  addCylinder(context, 'jetFuselage', [0.26, 0.48], 3.25, context.materials.body);
  addCone(context, 'pointedRadome', 0.28, 1.05, context.materials.body, [0, 0, -2.14]);
  addWing(context, 'sweptMainWing', 3.3, 1.25, 0.28, 0.58, [0, -0.08, -0.05], context.materials.wing, 0.075);
  addCanopy(context, [0, 0.34, -0.78], [0.72, 0.62, 1.3], 'fighterCanopy');
  for (const x of [-0.33, 0.33]) {
    addBox(context, `twinTail${x}`, [0.08, 0.78, 0.5], context.materials.wing, [x, 0.4, 1.08], [-0.18, 0, x > 0 ? -0.12 : 0.12]);
    addCylinder(context, `engineNacelle${x}`, [0.2, 0.25], 1.2, context.materials.dark, [x, -0.08, 0.82]);
    addExhaust(context, [x, -0.08, 1.48], 0.18);
  }
  addBox(context, 'leftHardpoint', [0.08, 0.12, 0.72], context.materials.trim, [-0.88, -0.2, 0.05]);
  addBox(context, 'rightHardpoint', [0.08, 0.12, 0.72], context.materials.trim, [0.88, -0.2, 0.05]);
  addWing(context, 'jetTailPlane', 1.35, 0.52, 0.18, 0.3, [0, 0.04, 1.13], context.materials.wing, 0.045);
}

function buildStealthDelta(context: BuildContext): void {
  addWing(context, 'blendedDeltaWing', 4.05, 2.85, 0.08, 1.36, [0, 0, 0.1], context.materials.body, 0.12);
  addCone(context, 'stealthNose', 0.24, 1.45, context.materials.body, [0, 0.02, -1.72], [-Math.PI / 2, 0, 0], 6);
  addCanopy(context, [0, 0.28, -0.68], [0.74, 0.46, 1.05], 'lowCanopy');
  addWing(context, 'stealthSpine', 1.3, 1.65, 0.16, 0.72, [0, 0.12, 0.02], context.materials.wing, 0.08);
  for (const x of [-0.72, 0.72]) {
    addBox(context, `cantedFin${x}`, [0.07, 0.56, 0.44], context.materials.wing, [x, 0.29, 0.88], [-0.22, 0, x > 0 ? -0.34 : 0.34]);
    addExhaust(context, [x * 0.54, -0.01, 1.39], 0.15);
  }
  addBox(context, 'leftSawtooth', [0.48, 0.035, 0.08], context.materials.trim, [-0.63, 0.1, 0.74], [0, 0.24, 0]);
  addBox(context, 'rightSawtooth', [0.48, 0.035, 0.08], context.materials.trim, [0.63, 0.1, 0.74], [0, -0.24, 0]);
}

function buildHeavyAttack(context: BuildContext): void {
  addCylinder(context, 'armoredFuselage', [0.4, 0.55], 3.15, context.materials.body);
  addCone(context, 'bluntNose', 0.42, 0.72, context.materials.body, [0, 0, -1.9]);
  addWing(context, 'straightAttackWing', 4.0, 0.92, 0.58, 0.08, [0, -0.12, -0.02], context.materials.wing, 0.11);
  addCanopy(context, [0, 0.4, -0.82], [0.88, 0.72, 1.0], 'armoredCanopy');
  for (const x of [-0.62, 0.62]) {
    addCylinder(context, `rearEnginePod${x}`, [0.28, 0.32], 1.35, context.materials.dark, [x, 0.12, 0.8]);
    addExhaust(context, [x, 0.12, 1.53], 0.23);
    addBox(context, `attackFin${x}`, [0.09, 0.67, 0.42], context.materials.wing, [x, 0.43, 1.23], [-0.14, 0, x > 0 ? -0.08 : 0.08]);
  }
  addWing(context, 'attackTailPlane', 1.75, 0.52, 0.28, 0.1, [0, 0.08, 1.24], context.materials.wing, 0.06);
  for (const x of [-1.25, -0.82, 0.82, 1.25]) addBox(context, `weaponPylon${x}`, [0.08, 0.2, 0.64], context.materials.trim, [x, -0.25, 0.1]);
  addBox(context, 'noseCannon', [0.1, 0.1, 0.74], context.materials.dark, [0.22, -0.18, -1.73]);
}

function buildGoldRacer(context: BuildContext): void {
  addCylinder(context, 'racerFuselage', [0.19, 0.31], 3.25, context.materials.body);
  addCone(context, 'longSpinner', 0.24, 0.72, context.materials.trim, [0, 0, -1.98]);
  addWing(context, 'clippedRacingWing', 2.75, 0.72, 0.34, 0.12, [0, -0.1, -0.12], context.materials.wing, 0.065);
  addCanopy(context, [0, 0.28, -0.42], [0.62, 0.48, 0.9], 'racerCanopy');
  addTailAssembly(context, 1.25, 0.95, 0.55);
  addBox(context, 'leftRacingStripe', [0.12, 0.035, 1.45], context.materials.trim, [-0.16, 0.3, -0.08]);
  addBox(context, 'rightRacingStripe', [0.12, 0.035, 1.45], context.materials.trim, [0.16, 0.3, -0.08]);
  addBox(context, 'leftWingTip', [0.14, 0.12, 0.42], context.materials.trim, [-1.38, -0.06, -0.04]);
  addBox(context, 'rightWingTip', [0.14, 0.12, 0.42], context.materials.trim, [1.38, -0.06, -0.04]);
  addPropeller(context, [0, 0, -2.36], 0.58, 3);
}

function buildFutureFighter(context: BuildContext): void {
  addCylinder(context, 'futureCore', [0.24, 0.42], 2.9, context.materials.body);
  addCone(context, 'needleNose', 0.25, 1.05, context.materials.body, [0, 0, -1.92], [-Math.PI / 2, 0, 0], 8);
  addWing(context, 'forwardSweptWing', 3.65, 1.0, 0.26, -0.5, [0, -0.05, 0.06], context.materials.wing, 0.075);
  addCanopy(context, [0, 0.32, -0.68], [0.66, 0.56, 1.12], 'futureCanopy');
  for (const x of [-0.42, 0.42]) {
    addBox(context, `splitTail${x}`, [0.07, 0.68, 0.45], context.materials.trim, [x, 0.36, 0.96], [-0.18, 0, x > 0 ? -0.28 : 0.28]);
    addCylinder(context, `pulseEngine${x}`, [0.19, 0.24], 0.82, context.materials.dark, [x, -0.02, 0.96]);
    addExhaust(context, [x, -0.02, 1.43], 0.17);
  }
  addBox(context, 'leftEnergyRail', [0.06, 0.035, 1.48], context.materials.trim, [-0.72, 0.05, 0.02], [0, -0.34, 0]);
  addBox(context, 'rightEnergyRail', [0.06, 0.035, 1.48], context.materials.trim, [0.72, 0.05, 0.02], [0, 0.34, 0]);
  addWing(context, 'futureTailPlane', 1.1, 0.45, 0.12, -0.16, [0, 0.02, 1.02], context.materials.wing, 0.04);
}

const recipes: Record<AircraftRecipeId, RecipeBuilder> = {
  'classic-biplane': buildClassicBiplane,
  'ace-biplane': buildAceBiplane,
  warbird: buildWarbird,
  'modern-jet': buildModernJet,
  'stealth-delta': buildStealthDelta,
  'heavy-attack': buildHeavyAttack,
  'gold-racer': buildGoldRacer,
  'future-fighter': buildFutureFighter,
};

export function createAircraftModelFromDefinition(definition: AircraftSkin): AircraftModel {
  const context = createContext(definition);
  context.root.name = `aircraft-${definition.id}`;
  (recipes[definition.recipe] ?? recipes['classic-biplane'])(context);

  return {
    group: context.root,
    propellers: context.propellers,
    exhausts: context.exhausts,
    bodyMaterials: context.bodyMaterials,
    dispose: () => {
      for (const geometry of context.geometries) geometry.dispose();
      for (const materialValue of context.materialSet) materialValue.dispose();
      context.geometries.clear();
      context.materialSet.clear();
    },
  };
}

export function createAircraftModel(id: AircraftSkinId): AircraftModel {
  return createAircraftModelFromDefinition(resolveAircraftSkin(id));
}

export function createAircraftModelCatalog(): AircraftModelDiagnostic[] {
  return Object.values(AIRCRAFT_SKINS).map((definition) => {
    const model = createAircraftModelFromDefinition(definition);
    let meshes = 0;
    model.group.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) meshes += 1;
    });
    const diagnostic = {
      id: definition.id,
      recipe: definition.recipe,
      meshes,
      propellers: model.propellers.length,
      exhausts: model.exhausts.length,
    };
    model.dispose();
    return diagnostic;
  });
}
