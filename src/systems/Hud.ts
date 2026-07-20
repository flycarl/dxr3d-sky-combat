export class Hud {
  private readonly gateValue = this.getElement('#gate-value');
  private readonly targetValue = this.getElement('#target-value');
  private readonly timerValue = this.getElement('#timer-value');
  private readonly speedValue = this.getElement('#speed-value');
  private readonly altitudeValue = this.getElement('#altitude-value');
  private readonly damageValue = this.getElement('#damage-value');
  private readonly hudCoinValue = this.getElement('#hud-coin-value');
  private readonly missileCooldownValue = this.getElement('#missile-cooldown-value');
  private readonly boostFill = this.getElement('#boost-fill');
  private readonly statusLine = this.getElement('#status-line');
  private readonly rewardFlash = this.getElement('#reward-flash');
  private readonly killFeed = this.getElement('#kill-feed');
  private readonly overlay = this.getElement('#game-overlay');
  private readonly overlayTitle = this.getElement('#overlay-title');
  private readonly overlayText = this.getElement('#overlay-text');
  private readonly weaponCrosshair = this.getElement('#weapon-crosshair');
  private readonly damageDirection = this.getElement('#damage-direction');
  private hitMarkerTimer: number | undefined;
  private damageDirectionTimer: number | undefined;

  setTarget(target: number): void {
    this.targetValue.textContent = String(target);
  }

  setCoins(coins: number): void {
    this.hudCoinValue.textContent = String(coins);
  }

  flashReward(text: string): void {
    this.rewardFlash.textContent = text;
    this.rewardFlash.animate(
      [
        { opacity: 0, transform: 'translateY(4px)' },
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(-4px)' },
      ],
      { duration: 850, easing: 'ease-out' },
    );
  }

  addKillFeed(text: string): void {
    const item = document.createElement('div');
    item.className = 'kill-feed-item';
    item.textContent = text;
    this.killFeed.prepend(item);
    while (this.killFeed.children.length > 5) {
      this.killFeed.lastElementChild?.remove();
    }
    window.setTimeout(() => {
      item.classList.add('is-fading');
    }, 3600);
    window.setTimeout(() => {
      item.remove();
    }, 4100);
  }

  update(state: {
    gates: number;
    target: number;
    timeLeft: number;
    speed: number;
    altitude: number;
    boost: number;
    damage: number;
    missileCooldown: number;
    multiplayerMode: 'deathmatch' | 'three-lives' | 'timed-kills' | null;
    mode: 'menu' | 'playing' | 'paused' | 'won' | 'lost';
    deathReport?: string[];
  }): void {
    this.gateValue.textContent = String(state.gates);
    this.targetValue.textContent = String(state.target);
    const minutes = Math.floor(state.timeLeft / 60).toString().padStart(2, '0');
    const seconds = Math.floor(state.timeLeft % 60).toString().padStart(2, '0');
    this.timerValue.textContent = `${minutes}:${seconds}`;
    this.speedValue.textContent = state.speed.toString().padStart(3, '0');
    this.altitudeValue.textContent = state.altitude.toString().padStart(3, '0');
    this.damageValue.textContent = `${state.damage}%`;
    this.missileCooldownValue.textContent =
      state.multiplayerMode === null ? '联机' : state.missileCooldown <= 0 ? '就绪' : `${Math.ceil(state.missileCooldown)}s`;
    this.boostFill.style.transform = `scaleX(${state.boost.toFixed(3)})`;

    if (state.mode === 'menu') {
      this.hideOverlay();
    } else if (state.mode === 'won') {
      this.statusLine.textContent = '航线已清空';
      this.overlay.classList.remove('is-lost');
      this.showOverlay('任务完成', '返回主菜单后可再来一局');
    } else if (state.mode === 'lost') {
      this.statusLine.textContent = '飞机坠毁';
      this.showOverlay('死亡报告', state.deathReport?.length ? state.deathReport : ['选择下一步']);
      this.overlay.classList.add('is-lost');
    } else if (state.mode === 'paused') {
      this.statusLine.textContent = '已暂停';
      this.overlay.classList.remove('is-lost');
      this.showOverlay('已暂停', '按 P 或 Esc 继续');
    } else {
      this.statusLine.textContent = state.gates > 0 ? '寻找扳手维修' : '躲避敌机火力';
      this.hideOverlay();
    }
  }

  flashPickup(): void {
    this.statusLine.animate(
      [
        { transform: 'translateY(0)', borderLeftColor: '#f5ba49' },
        { transform: 'translateY(-3px)', borderLeftColor: '#48baa7' },
        { transform: 'translateY(0)', borderLeftColor: '#f5ba49' },
      ],
      { duration: 220, easing: 'ease-out' },
    );
  }

  flashHit(angle = 0): void {
    this.flashDamageDirection(angle);
    this.statusLine.animate(
      [
        { transform: 'translateX(0)', borderLeftColor: '#e23d2f' },
        { transform: 'translateX(5px)', borderLeftColor: '#e23d2f' },
        { transform: 'translateX(0)', borderLeftColor: '#f5ba49' },
      ],
      { duration: 260, easing: 'ease-out' },
    );
  }

  flashDamageDirection(angle: number): void {
    window.clearTimeout(this.damageDirectionTimer);
    this.damageDirection.style.setProperty('--damage-angle', `${angle}rad`);
    this.damageDirection.classList.remove('is-visible');
    void this.damageDirection.offsetWidth;
    this.damageDirection.classList.add('is-visible');
    this.damageDirectionTimer = window.setTimeout(() => {
      this.damageDirection.classList.remove('is-visible');
    }, 520);
  }

  flashTargetHit(): void {
    window.clearTimeout(this.hitMarkerTimer);
    this.weaponCrosshair.classList.remove('is-hit');
    void this.weaponCrosshair.offsetWidth;
    this.weaponCrosshair.classList.add('is-hit');
    this.hitMarkerTimer = window.setTimeout(() => {
      this.weaponCrosshair.classList.remove('is-hit');
    }, 180);
    this.weaponCrosshair.animate(
      [
        {
          filter: 'brightness(1)',
          transform: 'translate(-50%, calc(-50% + var(--pitch-y))) scale(1)',
        },
        {
          filter: 'brightness(1.85)',
          transform: 'translate(-50%, calc(-50% + var(--pitch-y))) scale(1.42)',
        },
        {
          filter: 'brightness(1)',
          transform: 'translate(-50%, calc(-50% + var(--pitch-y))) scale(1)',
        },
      ],
      { duration: 180, easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)' },
    );
  }

  private showOverlay(title: string, text: string | string[]): void {
    this.overlayTitle.textContent = title;
    this.overlayText.replaceChildren();
    if (Array.isArray(text)) {
      this.overlayText.classList.add('is-report');
      text.forEach((line) => {
        const item = document.createElement('span');
        item.textContent = line;
        this.overlayText.append(item);
      });
    } else {
      this.overlayText.classList.remove('is-report');
      this.overlayText.textContent = text;
    }
    this.overlay.classList.add('is-visible');
  }

  private hideOverlay(): void {
    this.overlay.classList.remove('is-lost');
    this.overlay.classList.remove('is-visible');
  }

  private getElement(selector: string): HTMLElement {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing HUD element: ${selector}`);
    return element;
  }
}
