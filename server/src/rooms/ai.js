// Advanced Competitive AI for Gang Beasts
// 6 difficulty tiers, predictive physics, hazard awareness, tactical grabbing and jump recovery.
import Matter from 'matter-js';
import { AI_DIFFICULTIES, AI_ARCHETYPES } from '../../../shared/modes.js';

const { Body } = Matter;

export class AIController {
  constructor(player, room, difficulty = 'advanced', archetype = 'aggressive') {
    this.p = player;
    this.room = room;
    this.diff = AI_DIFFICULTIES[difficulty] || AI_DIFFICULTIES.advanced;
    this.arch = AI_ARCHETYPES[archetype] || AI_ARCHETYPES.aggressive;
    this.lastDecision = 0;
    this.target = null;
    this.state = 'chase'; // 'chase', 'retreat', 'dodge', 'grab_throw', 'center'
    this.stateTimer = 0;
  }

  update(now) {
    if (!this.p.alive || !this.p.torso) return;

    // React at human/AI reaction interval based on difficulty tier
    if (now - this.lastDecision < this.diff.reactionMs) return;
    this.lastDecision = now;

    const me = this.p.torso.position;
    const map = this.room.map;

    // 1. SURVIVAL & RECOVERY: Are we falling or near danger zone?
    const distToCenter = me.x - 640;
    const isFalling = this.p.torso.velocity.y > 5 || me.y > 600;
    const isNearEdge = Math.abs(distToCenter) > 420;

    if (isFalling && this.diff.jumpRecovery) {
      this.p.input.j = 1;
      this.p.input.x = distToCenter > 0 ? -1 : 1;
      return;
    }

    if (isNearEdge && this.diff.useHazards) {
      // Step back towards the platform center
      this.p.input.x = distToCenter > 0 ? -0.9 : 0.9;
      if (Math.random() < 0.2) this.p.input.j = 1;
      return;
    }

    // 2. POWERUP OPPORTUNITY
    if (this.diff.predictMovement && this.room.powerups) {
      const activePowerup = this.room.powerups.find(pu => pu.active && Math.hypot(pu.x - me.x, pu.y - me.y) < 280);
      if (activePowerup) {
        const dx = activePowerup.x - me.x;
        this.p.input.x = Math.sign(dx) * 0.95;
        if (activePowerup.y < me.y - 30) this.p.input.j = 1;
        return;
      }
    }

    // 3. TARGET SELECTION
    const candidates = [...this.room.players.values()].filter(o => o !== this.p && o.alive && o.torso);
    if (!candidates.length) {
      this.p.input = { x: 0, j: 0, p: 0, g: 0 };
      return;
    }

    // Target closest opponent or opponent with highest damage
    candidates.sort((a, b) => {
      const da = Math.hypot(a.torso.position.x - me.x, a.torso.position.y - me.y);
      const db = Math.hypot(b.torso.position.x - me.x, b.torso.position.y - me.y);
      return (da - (a.damage || 0) * 0.5) - (db - (b.damage || 0) * 0.5);
    });
    this.target = candidates[0];

    const targetPos = this.target.torso.position;
    const targetVel = this.target.torso.velocity;
    const dx = targetPos.x + (this.diff.predictMovement ? targetVel.x * 6 : 0) - me.x;
    const dy = targetPos.y - me.y;
    const dist = Math.hypot(dx, dy);

    // 4. COMBAT EXECUTION
    const isFacingTarget = Math.sign(dx) === this.p.facing;

    // If currently grabbing an opponent: THROW THEM OFF THE PLATFORM!
    if (this.p.grab && this.p.grab.target) {
      const throwDirection = me.x > 640 ? 1 : -1; // Throw toward nearest edge
      this.p.facing = throwDirection;
      this.p.input.x = throwDirection;
      this.p.input.p = 1; // Punch activates throw
      this.p.input.g = 0; // Release grab constraint
      return;
    }

    // Move toward target
    this.p.input.x = Math.max(-1, Math.min(1, Math.sign(dx) * (dist > 30 ? 1 : 0.4)));

    // Jump if target is higher or to clear gaps
    if (dy < -40 || (dist < 100 && Math.random() < 0.25)) {
      this.p.input.j = 1;
    } else {
      this.p.input.j = 0;
    }

    // Attack Range
    if (dist < 75 && isFacingTarget) {
      if (Math.random() < this.arch.grabFreq && this.diff.comboAttacks && this.p.stamina > 20) {
        this.p.input.g = 1;
        this.p.input.p = 0;
      } else {
        this.p.input.p = 1;
        this.p.input.g = 0;
      }
    } else {
      this.p.input.p = 0;
      this.p.input.g = 0;
    }
  }
}
