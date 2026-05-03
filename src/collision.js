/**
 * collision.js — Çarpışma Kontrolü
 * Self-collision (bounding sphere) + Workspace limit
 */
export class CollisionChecker {
  constructor(kinematics) {
    this.kinematics = kinematics;
    this.workspaceRadius = 280; // mm — maksimum erişim yarıçapı
    this.linkRadius = 15; // mm — her link bounding sphere yarıçapı
    this.minLinkDistance = 30; // mm — iki link arası min mesafe
  }

  checkSelfCollision(angles) {
    const positions = this.kinematics.computeAllJointPositions(angles);
    const warnings = [];
    // Non-adjacent link çiftlerini kontrol et
    for (let i = 0; i < positions.length - 2; i++) {
      for (let j = i + 2; j < positions.length; j++) {
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        const dz = positions[i].z - positions[j].z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < this.minLinkDistance) {
          warnings.push({ linkA: i, linkB: j, distance: dist, type: 'self-collision' });
        }
      }
    }
    return warnings;
  }

  checkWorkspaceLimit(angles) {
    const fk = this.kinematics.computeFK(angles);
    const pos = fk.position;
    const dist = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
    if (dist > this.workspaceRadius) {
      return { exceeded: true, distance: dist, limit: this.workspaceRadius };
    }
    return { exceeded: false, distance: dist, limit: this.workspaceRadius };
  }

  checkAll(angles) {
    return {
      selfCollision: this.checkSelfCollision(angles),
      workspace: this.checkWorkspaceLimit(angles),
    };
  }
}
