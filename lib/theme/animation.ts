export const ANIMATIONS = {
  SKELETON_GRADIENT: {
    duration: '1.5s',
    easing: 'ease-in-out',
    iteration: 'infinite',
    keyframes: `@keyframes skeleton-gradient {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }`,
  },
  AI_FLOW: {
    duration: '2s',
    easing: 'linear',
    iteration: 'infinite',
    keyframes: `@keyframes ai-flow {
      0% { background-position: 0% 50%; }
      100% { background-position: 200% 50%; }
    }`,
  },
  HOVER_LIFT: {
    duration: '300ms',
    easing: 'ease-out',
    iteration: '1',
    keyframes: `@keyframes hover-lift {
      0% { transform: translateY(0); }
      100% { transform: translateY(-4px); }
    }`,
  },
  BOUNCE_SUCCESS: {
    duration: '500ms',
    easing: 'ease-out',
    iteration: '1',
    keyframes: `@keyframes bounce-success {
      0% { transform: scale(1); }
      30% { transform: scale(1.15); }
      60% { transform: scale(0.95); }
      100% { transform: scale(1); }
    }`,
  },
  SHAKE_ERROR: {
    duration: '400ms',
    easing: 'ease-in-out',
    iteration: '1',
    keyframes: `@keyframes shake-error {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-6px); }
      40% { transform: translateX(6px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }`,
  },
  BLINK_NOTIFICATION: {
    duration: '2s',
    easing: 'ease-in-out',
    iteration: 'infinite',
    keyframes: `@keyframes blink-notification {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }`,
  },
} as const;
