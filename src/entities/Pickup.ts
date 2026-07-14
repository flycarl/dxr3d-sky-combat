import * as THREE from 'three';

export class Pickup {
  readonly group = new THREE.Group();
  readonly radius = 1.28;
  active = true;

  private readonly coreGeometry = new THREE.IcosahedronGeometry(0.3, 1);
  private readonly ringGeometry = new THREE.TorusGeometry(0.86, 0.035, 8, 40);
  private readonly archGeometry = new THREE.BoxGeometry(0.08, 1.05, 0.08);
  private readonly coreMaterial = new THREE.MeshStandardMaterial({
    color: '#48baa7',
    emissive: '#0f5249',
    emissiveIntensity: 0.8,
    roughness: 0.28,
    metalness: 0.1,
  });
  private readonly ringMaterial = new THREE.MeshBasicMaterial({
    color: '#f6f1df',
  });
  private readonly archMaterial = new THREE.MeshStandardMaterial({
    color: '#203d45',
    roughness: 0.36,
    metalness: 0.22,
    emissive: '#0f5249',
    emissiveIntensity: 0.24,
  });

  constructor(
    readonly index: number,
    position: THREE.Vector3,
  ) {
    const core = new THREE.Mesh(this.coreGeometry, this.coreMaterial);
    core.castShadow = true;
    this.group.add(core);

    const ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
    this.group.add(ring);

    const leftPost = new THREE.Mesh(this.archGeometry, this.archMaterial);
    leftPost.position.set(-0.88, 0, 0);
    leftPost.castShadow = true;
    this.group.add(leftPost);

    const rightPost = new THREE.Mesh(this.archGeometry, this.archMaterial);
    rightPost.position.set(0.88, 0, 0);
    rightPost.castShadow = true;
    this.group.add(rightPost);

    this.group.position.copy(position);
  }

  update(delta: number, elapsed: number): void {
    if (!this.active) return;
    this.group.rotation.y += delta * 1.8;
    this.group.children[0].rotation.x -= delta * 1.2;
    this.group.position.y += Math.sin(elapsed * 2.6 + this.index) * 0.002;
  }

  collect(): void {
    this.active = false;
    this.group.visible = false;
  }

  dispose(): void {
    this.coreGeometry.dispose();
    this.ringGeometry.dispose();
    this.archGeometry.dispose();
    this.coreMaterial.dispose();
    this.ringMaterial.dispose();
    this.archMaterial.dispose();
  }
}
