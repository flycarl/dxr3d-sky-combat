export class Hud {
  private readonly gateValue = this.getElement('#gate-value');
  private readonly targetValue = this.getElement('#target-value');
  private readonly timerValue = this.getElement('#timer-value');
  private readonly speedValue = this.getElement('#speed-value');
  private readonly altitudeValue = this.getElement('#altitude-value');
  private readonly damageValue = this.getElement('#damage-value');
  private readonly boostFill = this.getElement('#boost-fill');
  private readonly statusLine = this.getElement('#status-line');
  private readonly overlay = this.getElement('#game-overlay');
  private readonly overlayTitle = this.getElement('#overlay-title');
  private readonly overlayText = this.getElement('#overlay-text');
  private readonly weaponCrosshair = this.getElement('#weapon-crosshair');

  setTarget(target: number): void {
    this.targetValue.textContent = String(target);
  }

  update(state: {
    gates: number;
    target: number;
    timeLeft: number;
    speed: number;
    altitude: number;
    boost: number;
    damage: number;
    mode: 'menu' | 'playing' | 'paused' | 'won' | 'lost';
  }): void {
    this.gateValue.textContent = String(state.gates);
    this.targetValue.textContent = String(state.target);
    const minutes = Math.floor(state.timeLeft / 60).toString().padStart(2, '0');
    const seconds = Math.floor(state.timeLeft % 60).toString().padStart(2, '0');
    this.timerValue.textContent = `${minutes}:${seconds}`;
    this.speedValue.textContent = state.speed.toString().padStart(3, '0');
    this.altitudeValue.textContent = state.altitude.toString().padStart(3, '0');
    this.damageValue.textContent = `${state.damage}%`;
    this.boostFill.style.transform = `scaleX(${state.boost.toFixed(3)})`;

    if (state.mode === 'menu') {
      this.hideOverlay();
    } else if (state.mode === 'won') {
      this.statusLine.textContent = '航线已清空';
      this.overlay.classList.remove('is-lost');
      this.showOverlay('任务完成', '返回主菜单后可再来一局');
    } else if (state.mode === 'lost') {
      this.statusLine.textContent = '飞机坠毁';
      this.showOverlay('坠机', '选择下一步');
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

  flashHit(): void {
    this.statusLine.animate(
      [
        { transform: 'translateX(0)', borderLeftColor: '#e23d2f' },
        { transform: 'translateX(5px)', borderLeftColor: '#e23d2f' },
        { transform: 'translateX(0)', borderLeftColor: '#f5ba49' },
      ],
      { duration: 260, easing: 'ease-out' },
    );
  }

  flashTargetHit(): void {
    this.weaponCrosshair.animate(
      [
        {
          borderColor: 'rgba(241, 217, 122, 0.95)',
          boxShadow: '0 0 10px rgba(241, 217, 122, 0.46), inset 0 0 8px rgba(241, 217, 122, 0.18)',
          filter: 'brightness(1)',
          transform: 'translate(-50%, -50%) scale(1)',
        },
        {
          borderColor: 'rgba(255, 245, 188, 1)',
          boxShadow: '0 0 26px rgba(255, 222, 78, 0.95), inset 0 0 16px rgba(255, 222, 78, 0.48)',
          filter: 'brightness(1.7)',
          transform: 'translate(-50%, -50%) scale(1.65)',
        },
        {
          borderColor: 'rgba(241, 217, 122, 0.95)',
          boxShadow: '0 0 10px rgba(241, 217, 122, 0.46), inset 0 0 8px rgba(241, 217, 122, 0.18)',
          filter: 'brightness(1)',
          transform: 'translate(-50%, -50%) scale(1)',
        },
      ],
      { duration: 180, easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)' },
    );
  }

  private showOverlay(title: string, text: string): void {
    this.overlayTitle.textContent = title;
    this.overlayText.textContent = text;
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
