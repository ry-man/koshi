(function () {
'use strict';

function sawtoothClip() {
  const points = [];
  for (let i = 0; i <= 24; i++) points.push(`${i % 2 ? '100%' : 'calc(100% - 32px)'} ${i / 24 * 100}%`);
  for (let i = 24; i >= 0; i--) points.push(`${i % 2 ? '0px' : '32px'} ${i / 24 * 100}%`);
  return `polygon(${points.join(',')})`;
}

class PhaseTransition {
  constructor() {
    this.busy = false;
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'phase-transition';
    this.dialog.setAttribute('aria-label', 'Changing game screen');
    this.dialog.addEventListener('cancel', event => event.preventDefault());
    this.cover = document.createElement('div');
    this.cover.className = 'phase-transition-cover';
    this.cover.style.clipPath = sawtoothClip();
    this.dialog.append(this.cover);
    document.body.append(this.dialog);
  }
  run(action) {
    if (this.busy) return;
    if (this.motion.matches) { action(); return; }
    this.busy = true;
    this.perform(action).catch(error => {
      console.error('Game screen transition failed:', error);
      const message = document.querySelector('#level-error');
      message.textContent = `Game screen transition failed: ${error.message}. Please try again.`;
      message.hidden = false;
    });
  }
  async perform(action) {
    let focus;
    let animation;
    try {
      this.cover.style.transform = 'translateX(-100%)';
      this.dialog.showModal();
      animation = this.cover.animate([{ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }],
        { duration: 1050, easing: 'ease-in', fill: 'forwards' });
      await animation.finished;
      this.cover.style.transform = 'translateX(0)';
      animation.cancel();
      // Swap phases in one task while black; release modal inertness for destination focus.
      this.dialog.close();
      action();
      focus = document.activeElement;
      this.dialog.showModal();
      animation = this.cover.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }],
        { duration: 1050, easing: 'ease-out', fill: 'forwards' });
      await animation.finished;
    } finally {
      if (animation) animation.cancel();
      this.dialog.close();
      this.busy = false;
      if (focus?.isConnected) focus.focus({ preventScroll: true });
    }
  }
}

globalThis.KoshiPhaseTransition = PhaseTransition;
})();
