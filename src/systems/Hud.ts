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
      this.statusLine.textContent = 'Flight path cleared';
      this.showOverlay('Mission complete', 'Press R or Enter to fly again');
    } else if (state.mode === 'lost') {
      this.statusLine.textContent = 'Aircraft down';
      this.showOverlay('Crashed', 'Press R or Enter to restart');
    } else if (state.mode === 'paused') {
      this.statusLine.textContent = 'Paused';
      this.showOverlay('Paused', 'Press P or Esc to resume');
    } else {
      this.statusLine.textContent = state.gates > 0 ? 'Find a repair hammer' : 'Evade enemy fire';
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

  private showOverlay(title: string, text: string): void {
    this.overlayTitle.textContent = title;
    this.overlayText.textContent = text;
    this.overlay.classList.add('is-visible');
  }

  private hideOverlay(): void {
    this.overlay.classList.remove('is-visible');
  }

  private getElement(selector: string): HTMLElement {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing HUD element: ${selector}`);
    return element;
  }
}
