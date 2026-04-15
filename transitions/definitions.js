/**
 * 5个转场定义
 * 每个转场定义：from/to 形状、颜色、摄像机运动、时长
 */

const { Shapes, COLORS, Ease } = require('./core');

module.exports = [
  // ── T1: 球体 → 螺旋 ──
  {
    name: 't1-sphere-helix',
    duration: 1.8,
    particleCount: 8000,
    particleSize: 3.5,
    from: () => Shapes.sphere(8000, 3),
    to:   () => Shapes.helix(8000, 2.5, 6, 3),
    color1: COLORS.cyan,
    color2: COLORS.purple,
    // 摄像机动画：轻微旋转
    camera: (progress, time) => ({
      rotX: 0.05 * Math.sin(time * 0.5),
      rotY: progress * 0.3 + time * 0.08,
      zoom: 1 + Ease.out3(progress) * 0.2,
    }),
    easeFn: Ease.inOut3,
  },

  // ── T2: 环形 → 网格平面 ──
  {
    name: 't2-ring-grid',
    duration: 2.0,
    particleCount: 8000,
    particleSize: 3.0,
    from: () => Shapes.ring(8000, 3.5, 0.4),
    to:   () => Shapes.grid(8000, 7),
    color1: COLORS.purple,
    color2: COLORS.pink,
    camera: (progress, time) => ({
      rotX: 0.1 + Ease.inOut3(progress) * 0.3,  // 从侧面到俯视
      rotY: 0.15 * Math.sin(time * 0.4),
      zoom: 1,
    }),
    easeFn: Ease.inOut4,
  },

  // ── T3: 网格 → 涡旋 ──
  {
    name: 't3-wave-vortex',
    duration: 1.8,
    particleCount: 8000,
    particleSize: 3.8,
    from: () => Shapes.wave(8000, 90),
    to:   () => Shapes.vortex(8000, 3, 5),
    color1: COLORS.pink,
    color2: COLORS.orange,
    camera: (progress, time) => ({
      rotX: 0.15,
      rotY: progress * 0.5 + time * 0.1,
      zoom: 1.1 - Ease.out3(progress) * 0.3,
    }),
    easeFn: Ease.inOut3,
  },

  // ── T4: 螺旋 → 爆散 ──
  {
    name: 't4-helix-explode',
    duration: 1.5,
    particleCount: 8000,
    particleSize: 3.2,
    from: () => Shapes.helix(8000, 2, 5, 4),
    to:   () => Shapes.explode(8000, 7),
    color1: COLORS.orange,
    color2: COLORS.gold,
    camera: (progress, time) => ({
      rotX: 0.1,
      rotY: time * 0.15 - progress * 0.2,
      zoom: 1 - Ease.out4(progress) * 0.3,
    }),
    easeFn: Ease.out4,
  },

  // ── T5: 爆散 → 球体（闭环回到T1） ──
  {
    name: 't5-lines-sphere',
    duration: 2.0,
    particleCount: 8000,
    particleSize: 4.0,
    from: () => Shapes.tunnel(8000, 3.5, 8),
    to:   () => Shapes.sphere(8000, 3),
    color1: COLORS.gold,
    color2: COLORS.cyan,
    camera: (progress, time) => ({
      rotX: 0.1 + Ease.inOut3(progress) * 0.15,
      rotY: time * 0.1,
      zoom: 1 + Ease.outBack(progress) * 0.15,
    }),
    easeFn: Ease.inOut4,
  },
];
