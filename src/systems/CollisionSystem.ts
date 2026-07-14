import * as THREE from 'three';
import type { Pickup } from '../entities/Pickup';

export type ObstacleCollider = {
  position: THREE.Vector3;
  radius: number;
  active: boolean;
};

export class CollisionSystem {
  private readonly delta = new THREE.Vector3();
  private hitCooldown = 0;

  update(delta: number): void {
    this.hitCooldown = Math.max(0, this.hitCooldown - delta);
  }

  collectPickups(playerPosition: THREE.Vector3, pickups: Pickup[], playerRadius: number): Pickup[] {
    const collected: Pickup[] = [];

    for (const pickup of pickups) {
      if (!pickup.active) continue;
      this.delta.copy(playerPosition).sub(pickup.group.position);
      const radius = playerRadius + pickup.radius;
      if (this.delta.lengthSq() <= radius * radius) {
        pickup.collect();
        collected.push(pickup);
      }
    }

    return collected;
  }

  hitObstacle<T extends ObstacleCollider>(playerPosition: THREE.Vector3, playerRadius: number, obstacles: T[]): T | null {
    if (this.hitCooldown > 0) return null;

    for (const obstacle of obstacles) {
      if (!obstacle.active) continue;
      this.delta.copy(playerPosition).sub(obstacle.position);
      const radius = obstacle.radius + playerRadius;
      if (this.delta.lengthSq() <= radius * radius) {
        this.hitCooldown = 0.7;
        return obstacle;
      }
    }

    return null;
  }
}
