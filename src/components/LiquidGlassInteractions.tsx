import { useEffect } from 'react';
import {
  SPRING_THRESHOLD,
  TOGGLE_SCALE_X_DAMPING_RATIO,
  TOGGLE_SCALE_X_OMEGA_N,
  TOGGLE_SCALE_Y_DAMPING_RATIO,
  TOGGLE_SCALE_Y_OMEGA_N,
  springStepUnderdamped,
} from '../vendor/liquid-glass-webgl/spring';
import { VelocityTracker1D } from '../vendor/liquid-glass-webgl/velocity-tracker';

const CONTROL_SELECTOR = [
  '.header-icon-btn',
  '.record-tab-grid button',
  '.records-type-filter button',
  '.records-feeding-filter button',
  '.records-clear-filter',
  '.pill-option',
  '.pill-selection button',
  '.guide-pill',
  '.stats-segmented button',
  '.stats-summary-item',
  '.settings-segmented button',
  '.noise-segmented button',
  '.noise-category-tabs button',
  '.quick-duration-btn',
  '.quick-option-chip',
  '.quick-time-btn',
  '.primary-button',
  '.save-button',
  '.save-record-btn',
  '.settings-update-btn',
  '.baby-add-button',
  '.noise-track-option',
  '.incrementor-btn',
  '.timeline-edit-btn',
  '.timeline-delete-btn',
  '[role="switch"]',
].join(',');

type ActiveControl = {
  element: HTMLElement;
  pointerId: number;
  startX: number;
  tracker: VelocityTracker1D;
  frame: number | null;
};

/**
 * DOM adapter for the spring and velocity modules vendored from
 * martin65536/liquid-glass-webgl. The source renderer is canvas-based; this
 * adapter preserves its control physics while the app keeps semantic DOM UI.
 */
export function LiquidGlassInteractions() {
  useEffect(() => {
    let active: ActiveControl | null = null;

    const write = (element: HTMLElement, x: number, y: number) => {
      element.style.setProperty('--liquid-scale-x', x.toFixed(4));
      element.style.setProperty('--liquid-scale-y', y.toFixed(4));
    };

    const settle = (control: ActiveControl, releaseVelocity: number) => {
      if (control.frame !== null) cancelAnimationFrame(control.frame);
      let x = 0.965;
      let y = 0.975;
      let vx = Math.max(-0.35, Math.min(0.35, releaseVelocity * 0.012));
      let vy = 0;
      let previous = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(0.034, Math.max(0.001, (now - previous) / 1000));
        previous = now;
        const nextX = springStepUnderdamped(x, vx, 1, dt, TOGGLE_SCALE_X_OMEGA_N, TOGGLE_SCALE_X_DAMPING_RATIO);
        const nextY = springStepUnderdamped(y, vy, 1, dt, TOGGLE_SCALE_Y_OMEGA_N, TOGGLE_SCALE_Y_DAMPING_RATIO);
        x = nextX.current;
        vx = nextX.velocity;
        y = nextY.current;
        vy = nextY.velocity;
        write(control.element, x, y);
        if (Math.abs(x - 1) < SPRING_THRESHOLD && Math.abs(y - 1) < SPRING_THRESHOLD && Math.abs(vx) < 0.03 && Math.abs(vy) < 0.03) {
          write(control.element, 1, 1);
          control.element.classList.remove('liquid-interacting');
          control.frame = null;
          return;
        }
        control.frame = requestAnimationFrame(tick);
      };
      control.frame = requestAnimationFrame(tick);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const element = (event.target as Element | null)?.closest<HTMLElement>(CONTROL_SELECTOR);
      if (!element || element.hasAttribute('disabled')) return;
      if (active && active.frame !== null) cancelAnimationFrame(active.frame);
      const tracker = new VelocityTracker1D();
      tracker.addPosition(event.timeStamp, event.clientX);
      active = { element, pointerId: event.pointerId, startX: event.clientX, tracker, frame: null };
      element.classList.add('liquid-control', 'liquid-interacting');
      write(element, 0.965, 0.975);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!active || event.pointerId !== active.pointerId) return;
      active.tracker.addPosition(event.timeStamp, event.clientX);
      const stretch = Math.min(0.035, Math.abs(event.clientX - active.startX) / 700);
      write(active.element, 0.965 + stretch, 0.975 - stretch * 0.25);
    };

    const onPointerEnd = (event: PointerEvent) => {
      if (!active || event.pointerId !== active.pointerId) return;
      active.tracker.addPosition(event.timeStamp, event.clientX);
      const released = active;
      active = null;
      settle(released, released.tracker.calculateVelocity());
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerEnd, true);
    document.addEventListener('pointercancel', onPointerEnd, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerup', onPointerEnd, true);
      document.removeEventListener('pointercancel', onPointerEnd, true);
      if (active && active.frame !== null) cancelAnimationFrame(active.frame);
    };
  }, []);

  return null;
}
