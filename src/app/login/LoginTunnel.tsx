"use client";

/**
 * LoginTunnel — Data Tunnel background effect.
 *
 * Faithful port of codepen.io/sabosugi/pen/azZmLoB (Three.js + UnrealBloomPass).
 * Curved lines converging to a focal point with glowing signal trails.
 *
 * Audio-reactive (only these 3 react to music):
 *   • lineOpacity  — mid frequencies
 *   • signal count — overall energy (visual pulse on scale)
 *   • signal speed — bass (low frequencies)
 *
 * Colors follow the selected CSS skin.
 * Background: always #0a0e14 (dark blue) or skin-darkened variant.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

// ══════════════════════════════════════════════════
// Skin color palettes
// ══════════════════════════════════════════════════

interface SkinPalette {
  bg: string;
  lines: string;
  signal1: string;
  signal2: string;
  signal3: string;
}

const PALETTES: Record<string, SkinPalette> = {
  "ignite": {
    bg: "#020201",
    lines: "#3a2010",
    signal1: "#E8530E",
    signal2: "#ff7a3a",
    signal3: "#b83d08",
  },
  "aurora": {
    bg: "#030405",
    lines: "#4a4230",
    signal1: "#c5a44e",
    signal2: "#e8d48a",
    signal3: "#8b7730",
  },
  "ember": {
    bg: "#040304",
    lines: "#3d2020",
    signal1: "#D31920",
    signal2: "#ff4f55",
    signal3: "#8fc9ff",
  },
  "matrix": {
    bg: "#020403",
    lines: "#1a3020",
    signal1: "#4CAF50",
    signal2: "#81C784",
    signal3: "#00E676",
  },
  "sienna": {
    bg: "#040403",
    lines: "#3a3020",
    signal1: "#c5894e",
    signal2: "#e8b87a",
    signal3: "#8B572A",
  },
  "sage": {
    bg: "#030403",
    lines: "#2a3525",
    signal1: "#8b9c7a",
    signal2: "#b0c4a0",
    signal3: "#6B705C",
  },
  "orchid": {
    bg: "#040308",
    lines: "#30203d",
    signal1: "#b06cc8",
    signal2: "#7B2D8E",
    signal3: "#d4a0ee",
  },
  "platinum": {
    bg: "#030303",
    lines: "#2a2a2e",
    signal1: "#A0A0A8",
    signal2: "#d0d0d8",
    signal3: "#707078",
  },
  "abyss": {
    bg: "#020308",
    lines: "#15253a",
    signal1: "#4a7ab0",
    signal2: "#1B3A5C",
    signal3: "#7aafe0",
  },
  "amber": {
    bg: "#040302",
    lines: "#3a2e10",
    signal1: "#B8860B",
    signal2: "#e0b040",
    signal3: "#8a6408",
  },
  "ocean": {
    bg: "#020404",
    lines: "#103030",
    signal1: "#00B8B8",
    signal2: "#008B8B",
    signal3: "#40E0D0",
  },
  "flux": {
    bg: "#030208",
    lines: "#2e2048",
    signal1: "#FF0072",
    signal2: "#FF4DA6",
    signal3: "#CC005A",
  },
  "neon": {
    bg: "#020508",
    lines: "#102838",
    signal1: "#61DAFB",
    signal2: "#90EEFF",
    signal3: "#30B0D0",
  },
  "svelte": {
    bg: "#040302",
    lines: "#382818",
    signal1: "#FF3E00",
    signal2: "#FF7040",
    signal3: "#CC3200",
  },
  "cobalt": {
    bg: "#020408",
    lines: "#162040",
    signal1: "#2979FF",
    signal2: "#5C9BFF",
    signal3: "#1560D0",
  },
  "coral": {
    bg: "#040202",
    lines: "#382020",
    signal1: "#FF6B6B",
    signal2: "#FF9E9E",
    signal3: "#D04040",
  },
  "moss": {
    bg: "#020402",
    lines: "#1a3020",
    signal1: "#2D6A4F",
    signal2: "#4D8A6F",
    signal3: "#1B5038",
  },
  "zinc": {
    bg: "#030303",
    lines: "#22222a",
    signal1: "#71717A",
    signal2: "#A1A1AA",
    signal3: "#52525B",
  },
  "indigo": {
    bg: "#020208",
    lines: "#1a1a40",
    signal1: "#6366F1",
    signal2: "#9598FF",
    signal3: "#4F46E5",
  },
  "rose": {
    bg: "#040204",
    lines: "#301828",
    signal1: "#E11D48",
    signal2: "#FF4575",
    signal3: "#BE123C",
  },
  "carbon": {
    bg: "#040302",
    lines: "#2a2018",
    signal1: "#F97316",
    signal2: "#FCA44A",
    signal3: "#C25D10",
  },
};

// ══════════════════════════════════════════════════
// Parameters (from user's screenshot)
// ══════════════════════════════════════════════════

const PARAMS = {
  lineCount: 80,
  positionX: -25,
  positionY: 0,
  // Geometry
  spreadHeight: 35.28,
  spreadDepth: 0,
  curveLength: 50,
  straightLength: 111.6,
  curvePower: 0.8265,
  // Lines
  waveSpeed: 0.6,
  waveHeight: 2.545,
  baseLineOpacity: 0.7,
  // Signals
  signalCount: 112,
  baseSpeed: 0.18,
  trailLength: 33,
  // Bloom
  bloomStrength: 2.99,
  bloomRadius: 0.56,
  // Internal
  segmentCount: 150,
};

// ══════════════════════════════════════════════════
// Path calculation (exact copy from original)
// ══════════════════════════════════════════════════

function getPathPoint(
  t: number,
  lineIndex: number,
  time: number,
  lineCount: number,
  waveSpeed: number,
  waveHeight: number
): THREE.Vector3 {
  const totalLen = PARAMS.curveLength + PARAMS.straightLength;
  const currentX = -PARAMS.curveLength + t * totalLen;

  let y = 0;
  const z = 0;

  const spreadFactor = (lineIndex / lineCount - 0.5) * 2;

  if (currentX < 0) {
    const ratio = (currentX + PARAMS.curveLength) / PARAMS.curveLength;
    let shapeFactor = (Math.cos(ratio * Math.PI) + 1) / 2;
    shapeFactor = Math.pow(shapeFactor, PARAMS.curvePower);

    y = spreadFactor * PARAMS.spreadHeight * shapeFactor;

    // Wave animation
    const waveFactor = shapeFactor;
    const wave =
      Math.sin(time * waveSpeed + currentX * 0.1 + lineIndex) *
      waveHeight *
      waveFactor;
    y += wave;
  }

  return new THREE.Vector3(currentX, y, z);
}

// ══════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════

interface LoginTunnelProps {
  scheme: string;
  audioData: Uint8Array<ArrayBufferLike> | null;
}

export function LoginTunnel({ scheme, audioData }: LoginTunnelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef(audioData);
  audioRef.current = audioData;
  const schemeRef = useRef(scheme);
  schemeRef.current = scheme;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // ── Palette ──
    const pal = PALETTES[scheme] || PALETTES["aurora"];

    // ── Scene ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(pal.bg);
    scene.fog = new THREE.FogExp2(new THREE.Color(pal.bg).getHex(), 0.002);

    // ── Camera ──
    const camera = new THREE.PerspectiveCamera(45, vw / vh, 1, 1000);
    camera.position.set(0, 0, 90);
    camera.lookAt(0, 0, 0);

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(vw, vh);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // ── Content group (for position/rotation) ──
    const contentGroup = new THREE.Group();
    contentGroup.position.set(PARAMS.positionX, PARAMS.positionY, 0);
    scene.add(contentGroup);

    // ── Post-processing: Bloom ──
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(vw, vh),
      PARAMS.bloomStrength,
      PARAMS.bloomRadius,
      0 // threshold
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    // ── Line material ──
    const bgMaterial = new THREE.LineBasicMaterial({
      color: pal.lines,
      transparent: true,
      opacity: PARAMS.baseLineOpacity,
      depthWrite: false,
    });

    // ── Signal material (vertex colors + additive blending) ──
    const signalMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
    });

    // ── Signal colors ──
    const signalColor1 = new THREE.Color(pal.signal1);
    const signalColor2 = new THREE.Color(pal.signal2);
    const signalColor3 = new THREE.Color(pal.signal3);

    function pickSignalColor(): THREE.Color {
      const choices = [signalColor1, signalColor2, signalColor3];
      return choices[Math.floor(Math.random() * choices.length)];
    }

    // ── Build lines ──
    const backgroundLines: THREE.Line[] = [];

    for (let i = 0; i < PARAMS.lineCount; i++) {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(PARAMS.segmentCount * 3);
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );

      const line = new THREE.Line(geometry, bgMaterial);
      line.userData = { id: i };
      line.renderOrder = 0;
      contentGroup.add(line);
      backgroundLines.push(line);
    }

    // ── Build signals ──
    interface Signal {
      mesh: THREE.Line;
      laneIndex: number;
      speed: number;
      progress: number;
      history: THREE.Vector3[];
      assignedColor: THREE.Color;
    }

    const signals: Signal[] = [];
    const maxTrail = 150;

    function createSignal(): Signal {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(maxTrail * 3);
      const colors = new Float32Array(maxTrail * 3);

      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const mesh = new THREE.Line(geometry, signalMaterial);
      mesh.frustumCulled = false;
      mesh.renderOrder = 1;
      contentGroup.add(mesh);

      const sig: Signal = {
        mesh,
        laneIndex: Math.floor(Math.random() * PARAMS.lineCount),
        speed: 0.2 + Math.random() * 0.5,
        progress: Math.random(),
        history: [],
        assignedColor: pickSignalColor(),
      };
      signals.push(sig);
      return sig;
    }

    for (let i = 0; i < PARAMS.signalCount; i++) {
      createSignal();
    }

    // ── Animation loop ──
    const clock = new THREE.Clock();
    let raf = 0;
    const audioBands = { low: 0, mid: 0, high: 0 };

    const animate = () => {
      if (disposed) return;
      raf = requestAnimationFrame(animate);

      const time = clock.getElapsedTime();

      // ── Audio analysis ──
      const ad = audioRef.current;
      if (ad && ad.length > 0) {
        const lowTarget =
          ad.slice(0, 4).reduce((a, b) => a + b, 0) / (4 * 255);
        const midTarget =
          ad.slice(4, 13).reduce((a, b) => a + b, 0) / (9 * 255);
        const highTarget =
          ad.slice(13, 29).reduce((a, b) => a + b, 0) / (16 * 255);
        audioBands.low += (lowTarget - audioBands.low) * 0.04;
        audioBands.mid += (midTarget - audioBands.mid) * 0.035;
        audioBands.high += (highTarget - audioBands.high) * 0.03;
      } else {
        audioBands.low *= 0.98;
        audioBands.mid *= 0.98;
        audioBands.high *= 0.98;
      }

      // ── Audio presence: 0 when silent, ramps to 1 with any sound ──
      const audioPresence = Math.min(
        (audioBands.low + audioBands.mid + audioBands.high) * 3.0,
        1.0
      );

      // ── Audio-reactive values — all start at zero, grow with music ──
      // lineOpacity: silent = 0, music = base + mid boost
      const lineOpacity =
        audioPresence * Math.min(PARAMS.baseLineOpacity + audioBands.mid * 0.5, 1.0);
      // signal speed: silent = near-zero crawl, music = normal + bass boost
      const speedMult = 0.05 + audioPresence * (0.95 + audioBands.low * 1.2);
      // waveSpeed: silent = still, music = base + treble boost
      const waveSpeed = audioPresence * (PARAMS.waveSpeed + audioBands.high * 0.8);
      // waveHeight: silent = flat, music = base + bass sway
      const waveHeight = audioPresence * (PARAMS.waveHeight + audioBands.low * 2.5);
      // signal visual pulse
      const audioEnergy =
        (audioBands.low + audioBands.mid + audioBands.high) / 3;

      // ── Update skin colors smoothly ──
      const currentPal =
        PALETTES[schemeRef.current] || PALETTES["aurora"];

      // Lerp background color
      const targetBg = new THREE.Color(currentPal.bg);
      (scene.background as THREE.Color).lerp(targetBg, 0.03);
      scene.fog!.color.lerp(targetBg, 0.03);

      // Lerp line color
      bgMaterial.color.lerp(new THREE.Color(currentPal.lines), 0.03);

      // Lerp signal colors
      signalColor1.lerp(new THREE.Color(currentPal.signal1), 0.03);
      signalColor2.lerp(new THREE.Color(currentPal.signal2), 0.03);
      signalColor3.lerp(new THREE.Color(currentPal.signal3), 0.03);

      // Apply audio-reactive opacity
      bgMaterial.opacity = lineOpacity;

      // Bloom: minimal glow when silent, full with music
      bloomPass.strength =
        0.3 + audioPresence * (PARAMS.bloomStrength - 0.3 + audioBands.low * 0.6);

      // ── Update lines (exact original logic) ──
      backgroundLines.forEach((line) => {
        const positions = line.geometry.attributes.position
          .array as Float32Array;
        const lineId = line.userData.id as number;

        for (let j = 0; j < PARAMS.segmentCount; j++) {
          const t = j / (PARAMS.segmentCount - 1);
          const vec = getPathPoint(
            t,
            lineId,
            time,
            PARAMS.lineCount,
            waveSpeed,
            waveHeight
          );
          positions[j * 3] = vec.x;
          positions[j * 3 + 1] = vec.y;
          positions[j * 3 + 2] = vec.z;
        }
        line.geometry.attributes.position.needsUpdate = true;
      });

      // ── Update signals (exact original logic + audio speed) ──
      signals.forEach((sig) => {
        sig.progress += sig.speed * 0.005 * PARAMS.baseSpeed * speedMult;

        if (sig.progress > 1.0) {
          sig.progress = 0;
          sig.laneIndex = Math.floor(Math.random() * PARAMS.lineCount);
          sig.history = [];
          sig.assignedColor = pickSignalColor();
        }

        const pos = getPathPoint(
          sig.progress,
          sig.laneIndex,
          time,
          PARAMS.lineCount,
          waveSpeed,
          waveHeight
        );
        sig.history.push(pos);

        if (sig.history.length > PARAMS.trailLength + 1) {
          sig.history.shift();
        }

        const positions = sig.mesh.geometry.attributes.position
          .array as Float32Array;
        const colors = sig.mesh.geometry.attributes.color
          .array as Float32Array;

        const drawCount = Math.max(1, PARAMS.trailLength);
        const currentLen = sig.history.length;

        for (let i = 0; i < drawCount; i++) {
          let index = currentLen - 1 - i;
          if (index < 0) index = 0;

          const p = sig.history[index] || new THREE.Vector3();
          positions[i * 3] = p.x;
          positions[i * 3 + 1] = p.y;
          positions[i * 3 + 2] = p.z;

          let alpha = 1;
          if (PARAMS.trailLength > 0) {
            alpha = Math.max(0, 1 - i / PARAMS.trailLength);
          }

          // Silent = dim signals, music = bright + energy boost
          const brightness = (0.15 + audioPresence * 0.85) * (1.0 + audioEnergy * 0.8);

          colors[i * 3] = sig.assignedColor.r * alpha * brightness;
          colors[i * 3 + 1] = sig.assignedColor.g * alpha * brightness;
          colors[i * 3 + 2] = sig.assignedColor.b * alpha * brightness;
        }

        sig.mesh.geometry.setDrawRange(0, drawCount);
        sig.mesh.geometry.attributes.position.needsUpdate = true;
        sig.mesh.geometry.attributes.color.needsUpdate = true;
      });

      composer.render();
    };
    raf = requestAnimationFrame(animate);

    // ── Resize ──
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // ── Cleanup ──
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);

      // Dispose signals
      signals.forEach((s) => {
        contentGroup.remove(s.mesh);
        s.mesh.geometry.dispose();
      });

      // Dispose lines
      backgroundLines.forEach((l) => {
        contentGroup.remove(l);
        l.geometry.dispose();
      });
      bgMaterial.dispose();
      signalMaterial.dispose();

      // Dispose postprocessing + renderer
      composer.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-0"
      style={{ background: "#020203" }}
    />
  );
}
