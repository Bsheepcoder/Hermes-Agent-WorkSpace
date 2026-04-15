/**
 * Mr.DerDer Transition Core Engine
 * 统一架构：共享 ShaderMaterial + GPU morphing 粒子系统
 * Three.js r170 + EffectComposer + UnrealBloomPass
 */

const THREE = require('three');

// ══════════════════════════════════════════
// 五色渐变系统
// ══════════════════════════════════════════
const COLORS = {
  cyan:   new THREE.Color(0x00e5ff),
  purple: new THREE.Color(0xaa00ff),
  pink:   new THREE.Color(0xff3399),
  orange: new THREE.Color(0xff8800),
  gold:   new THREE.Color(0xffcc00),
};

// Bloom 参数（与片头统一）
const BLOOM = { strength: 0.7, radius: 0.8, threshold: 0.82 };

// ══════════════════════════════════════════
// 缓动函数库
// ══════════════════════════════════════════
const Ease = {
  linear: t => t,
  inOut3: t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2,
  out4: t => 1 - Math.pow(1 - t, 4),
  out3: t => 1 - Math.pow(1 - t, 3),
  outBack: t => { const c = 1.7; return 1 + c * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  inOut4: t => t < 0.5 ? 8*t*t*t*t : 1 - Math.pow(-2*t+2, 4)/2,
  outElastic: t => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10*t) * Math.sin((t*10 - 0.75) * (2*Math.PI)/3) + 1;
  },
  smoothstep: (a, b, t) => { t = Math.max(0, Math.min(1, (t-a)/(b-a))); return t*t*(3-2*t); },
};

// ══════════════════════════════════════════
// 形状生成器（返回 Float32Array of positions）
// ══════════════════════════════════════════
const Shapes = {
  sphere(count, radius = 3) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * (0.8 + Math.random() * 0.2);
      pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i*3+2] = r * Math.cos(phi);
    }
    return pos;
  },

  ring(count, radius = 3.5, tube = 0.3) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 2;
      const r = radius + tube * Math.cos(phi) * (0.5 + Math.random() * 0.5);
      pos[i*3]   = r * Math.cos(theta);
      pos[i*3+1] = (Math.random() - 0.5) * tube * 2;
      pos[i*3+2] = r * Math.sin(theta);
    }
    return pos;
  },

  helix(count, radius = 2.5, height = 6, turns = 3) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const t = (i / count + Math.random() * 0.02);
      const angle = t * Math.PI * 2 * turns;
      const strand = i % 2 === 0 ? 1 : -1;
      const r = radius + (Math.random() - 0.5) * 0.3;
      pos[i*3]   = r * Math.cos(angle + strand * 0.5);
      pos[i*3+1] = (t - 0.5) * height + (Math.random() - 0.5) * 0.2;
      pos[i*3+2] = r * Math.sin(angle + strand * 0.5);
    }
    return pos;
  },

  wave(count, gridSize = 50) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const gx = (i % gridSize) / gridSize - 0.5;
      const gy = Math.floor(i / gridSize) / gridSize - 0.5;
      const x = gx * 10 + (Math.random() - 0.5) * 0.15;
      const z = gy * 10 + (Math.random() - 0.5) * 0.15;
      const y = Math.sin(gx * Math.PI * 4) * Math.cos(gy * Math.PI * 4) * 0.8;
      pos[i*3]   = x;
      pos[i*3+1] = y + (Math.random() - 0.5) * 0.1;
      pos[i*3+2] = z;
    }
    return pos;
  },

  grid(count, size = 8) {
    const pos = new Float32Array(count * 3);
    const side = Math.ceil(Math.sqrt(count));
    for (let i = 0; i < count; i++) {
      const gx = (i % side) / side - 0.5;
      const gy = Math.floor(i / side) / side - 0.5;
      pos[i*3]   = gx * size + (Math.random() - 0.5) * 0.05;
      pos[i*3+1] = (Math.random() - 0.5) * 0.05;
      pos[i*3+2] = gy * size + (Math.random() - 0.5) * 0.05;
    }
    return pos;
  },

  vortex(count, radius = 3, height = 5) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const angle = t * Math.PI * 12;
      const r = radius * (1 - t * 0.7) + (Math.random() - 0.5) * 0.3;
      pos[i*3]   = r * Math.cos(angle);
      pos[i*3+1] = (t - 0.5) * height;
      pos[i*3+2] = r * Math.sin(angle);
    }
    return pos;
  },

  explode(count, spread = 8) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = spread * (0.5 + Math.random() * 0.5);
      pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i*3+2] = r * Math.cos(phi);
    }
    return pos;
  },

  tunnel(count, radius = 3, depth = 8) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const angle = Math.random() * Math.PI * 2;
      const r = radius * (0.8 + Math.random() * 0.4);
      pos[i*3]   = r * Math.cos(angle);
      pos[i*3+1] = r * Math.sin(angle);
      pos[i*3+2] = (t - 0.5) * depth;
    }
    return pos;
  },

  scatter(count) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i*3]   = (Math.random() - 0.5) * 12;
      pos[i*3+1] = (Math.random() - 0.5) * 8;
      pos[i*3+2] = (Math.random() - 0.5) * 6;
    }
    return pos;
  },

  lines(count, lineCount = 20, length = 6) {
    const pos = new Float32Array(count * 3);
    const perLine = Math.ceil(count / lineCount);
    for (let i = 0; i < count; i++) {
      const li = Math.floor(i / perLine);
      const t = (i % perLine) / perLine;
      const angle = (li / lineCount) * Math.PI * 2;
      const r = 1 + Math.random() * 0.2;
      pos[i*3]   = Math.cos(angle) * r * t * length;
      pos[i*3+1] = (Math.random() - 0.5) * 0.15;
      pos[i*3+2] = Math.sin(angle) * r * t * length;
    }
    return pos;
  },
};

// ══════════════════════════════════════════
// 顶点着色器 - GPU morphing
// ══════════════════════════════════════════
const vertexShader = `
uniform float uProgress;
uniform float uTime;
uniform float uSize;
uniform vec3 uColor1;
uniform vec3 uColor2;

attribute vec3 aTarget;
attribute float aRandom;
attribute float aOpacity;
attribute float aDelay;

varying vec3 vColor;
varying float vAlpha;

void main() {
  // Per-particle delay: staggered morphing
  float delay = aDelay * 0.4;
  float progress = clamp((uProgress - delay) / (1.0 - delay), 0.0, 1.0);

  // Quartic-out easing in shader
  progress = 1.0 - pow(1.0 - progress, 4.0);

  // Morph position
  vec3 pos = mix(position, aTarget, progress);

  // Midpoint scatter (particles fly outward during transition)
  float scatter = sin(progress * 3.14159) * (0.5 + aRandom * 0.8);
  pos += normalize(pos + vec3(0.001)) * scatter * aRandom * 1.5;

  // Gentle floating
  pos.x += sin(uTime * 0.5 + aRandom * 6.28) * 0.08;
  pos.y += cos(uTime * 0.3 + aRandom * 6.28) * 0.06;
  pos.z += sin(uTime * 0.4 + aRandom * 3.14) * 0.05;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Size with perspective attenuation + random variation
  float sizeBase = uSize * (0.6 + aRandom * 0.8);
  gl_PointSize = sizeBase * (200.0 / -mvPosition.z);

  // Color: gradient mix based on progress + random offset
  float colorMix = clamp(progress + aRandom * 0.2, 0.0, 1.0);
  vColor = mix(uColor1, uColor2, colorMix);

  // Opacity: fade in scatter phase, fade out at end
  vAlpha = aOpacity * (1.0 - 0.3 * scatter);
}
`;

// ══════════════════════════════════════════
// 片段着色器 - 圆形光点 + 辉光
// ══════════════════════════════════════════
const fragmentShader = `
varying vec3 vColor;
varying float vAlpha;

void main() {
  // 圆形粒子：distanceToCenter 技巧
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);

  // 软边圆形
  float alpha = smoothstep(0.5, 0.15, dist) * vAlpha;

  // 中心亮，边缘暗（发光感）
  float glow = exp(-dist * 4.0) * 0.6;

  gl_FragColor = vec4(vColor * (1.0 + glow), alpha);
}
`;

// ══════════════════════════════════════════
// TransitionScene - 核心场景管理
// ══════════════════════════════════════════
class TransitionScene {
  constructor(width = 1920, height = 1080) {
    this.width = width;
    this.height = height;
    this.particleCount = 8000;

    // Three.js 基础
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x08080c);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    this.camera.position.z = 7;

    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // Bloom 后处理
    const { EffectComposer } = require('three/examples/jsm/postprocessing/EffectComposer.js');
    const { RenderPass } = require('three/examples/jsm/postprocessing/RenderPass.js');
    const { UnrealBloomPass } = require('three/examples/jsm/postprocessing/UnrealBloomPass.js');

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      BLOOM.strength, BLOOM.radius, BLOOM.threshold
    );
    this.composer.addPass(bloomPass);

    // 粒子系统
    this.material = null;
    this.geometry = null;
    this.points = null;
  }

  /**
   * 创建 morphing 转场
   * @param {Float32Array} fromPos - 起始形状
   * @param {Float32Array} toPos - 目标形状
   * @param {Object} opts - { color1, color2, particleSize, extraRotation }
   */
  createMorph(fromPos, toPos, opts = {}) {
    const count = this.particleCount;
    const color1 = opts.color1 || COLORS.cyan;
    const color2 = opts.color2 || COLORS.gold;
    const size = opts.particleSize || 4.0;

    // Per-particle 属性
    const randoms = new Float32Array(count);
    const opacities = new Float32Array(count);
    const delays = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      randoms[i] = Math.random();
      opacities[i] = 0.4 + Math.random() * 0.6;
      delays[i] = Math.random();
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(fromPos, 3));
    this.geometry.setAttribute('aTarget', new THREE.BufferAttribute(toPos, 3));
    this.geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
    this.geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
    this.geometry.setAttribute('aDelay', new THREE.BufferAttribute(delays, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uSize: { value: size },
        uColor1: { value: color1 },
        uColor2: { value: color2 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);
  }

  /**
   * 渲染单帧
   * @param {number} progress - 0~1 转场进度
   * @param {number} time - 全局时间（秒）
   * @param {Object} cameraOpts - { rotX, rotY, rotZ, zoom }
   */
  renderFrame(progress, time, cameraOpts = {}) {
    // 更新 uniforms
    this.material.uniforms.uProgress.value = Math.max(0, Math.min(1, progress));
    this.material.uniforms.uTime.value = time;

    // 相机控制
    const co = cameraOpts;
    this.camera.position.x = Math.sin((co.rotY || 0) * Math.PI * 2) * 7;
    this.camera.position.y = Math.sin((co.rotX || 0) * Math.PI) * 3;
    this.camera.position.z = Math.cos((co.rotY || 0) * Math.PI * 2) * 7;
    this.camera.lookAt(0, 0, 0);

    if (co.zoom) {
      this.camera.position.multiplyScalar(1 / co.zoom);
    }

    this.composer.render();
    return this.renderer.domElement;
  }

  get domElement() {
    return this.renderer.domElement;
  }

  dispose() {
    if (this.geometry) this.geometry.dispose();
    if (this.material) this.material.dispose();
    this.renderer.dispose();
  }
}

module.exports = { TransitionScene, Shapes, COLORS, BLOOM, Ease };
