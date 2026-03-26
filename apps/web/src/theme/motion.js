export const motion = {
  duration: {
    fast: 150,
    normal: 200,
    slow: 300,
  },
  easing: {
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  },
  spring: {
    stiff: { stiffness: 300, damping: 30 },
    gentle: { stiffness: 100, damping: 20 },
  },
};
