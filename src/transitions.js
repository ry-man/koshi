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
  run(action, options = {}) {
    if (this.busy) return;
    if (this.motion.matches) { action(); return; }
    this.busy = true;
    this.perform(action, options).catch(error => {
      console.error('Game screen transition failed:', error);
      const message = document.querySelector('#level-error');
      message.textContent = `Game screen transition failed: ${error.message}. Please try again.`;
      message.hidden = false;
    });
  }
  async perform(action, { fade = false } = {}) {
    let focus;
    let animation;
    try {
      this.cover.style.clipPath = fade ? 'none' : sawtoothClip();
      this.cover.style.transform = fade ? 'none' : 'translateX(-100%)';
      this.cover.style.opacity = fade ? '0' : '1';
      this.dialog.showModal();
      animation = this.cover.animate(fade ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }],
        { duration: fade ? 900 : 1050, easing: 'ease-in', fill: 'forwards' });
      await animation.finished;
      this.cover.style.transform = fade ? 'none' : 'translateX(0)';
      this.cover.style.opacity = '1';
      animation.cancel();
      if (fade) {
        animation = this.cover.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 650, fill: 'forwards' });
        await animation.finished;
        animation.cancel();
      }
      // Swap phases in one task while black; release modal inertness for destination focus.
      this.dialog.close();
      action();
      focus = document.activeElement;
      this.dialog.showModal();
      animation = this.cover.animate(fade ? [{ opacity: 1 }, { opacity: 0 }]
        : [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }],
        { duration: fade ? 900 : 1050, easing: 'ease-out', fill: 'forwards' });
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
