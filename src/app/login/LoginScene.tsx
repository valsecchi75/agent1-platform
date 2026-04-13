"use client";

/**
 * LoginScene — Three.js depth points image effect.
 *
 * Faithful rewrite of antonbobrov/threejs-depth-points-image:
 *   • Background plane: large (4000×4000), 1px white dots that wiggle via noise → star field
 *   • Image plane: sized to image aspect, 200×200 segments, depth-displaced from depth map
 *     - Mouse X controls an edge reveal line (left = scattered white, right = image color)
 *     - Mesh rotates on X/Y with mouse → 3D parallax
 *     - Edge line tinted with skin accent color
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";

// ══════════════════════════════════════════════════
// GLSL
// ══════════════════════════════════════════════════

const SNOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

// ── Background star field vertex — audio makes stars vibrate ──
const BG_VERT = SNOISE + /* glsl */ `
uniform float u_time;
uniform float u_audioLow;
uniform float u_audioMid;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec3 transformed = vec3(position);
  float noise = snoise(vec3(vUv, u_time * 0.010) * 500.0);
  // Base wiggle + audio-driven extra vibration
  transformed.x += noise * (20.0 + u_audioLow * 30.0);
  transformed.y -= noise * (20.0 + u_audioMid * 25.0);
  gl_PointSize = 1.2 + u_audioLow * 0.8;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}
`;

const BG_FRAG = /* glsl */ `
uniform vec3 u_accentColor;
varying vec2 vUv;
void main() {
  float d = distance(vUv, vec2(0.5));
  float alpha = 0.15 * (1.0 - smoothstep(0.0, 0.5, d));
  // Tint background stars with a hint of accent color
  vec3 color = mix(vec3(1.0), u_accentColor, 0.3);
  gl_FragColor = vec4(color, alpha);
}
`;

// ── Image plane vertex — 3-band audio displacement on X, Y, Z ──
const IMG_VERT = SNOISE + /* glsl */ `
uniform float u_edge;
uniform float u_maxDepth;
uniform float u_time;
uniform float u_audioLow;
uniform float u_audioMid;
uniform float u_audioHigh;
uniform sampler2D u_depthMap;

varying vec2 vUv;
varying float vAlpha;
varying float vEdge;

void main() {
  vUv = uv;
  vec3 transformed = vec3(position);

  // Circular alpha fade
  vAlpha = distance(vUv, vec2(0.5));
  vAlpha = 1.0 - smoothstep(0.1, 0.5, vAlpha);

  // Mouse edge reveal
  vEdge = smoothstep(u_edge - 0.025, u_edge + 0.025, vUv.x);

  // Depth displacement from depth map
  vec4 mapColor = texture2D(u_depthMap, vUv);
  float depth = (mapColor.r + mapColor.g + mapColor.b) / 3.0;
  transformed.z -= depth * u_maxDepth;

  // ── Audio displacement on 3 axes ──
  // Use noise seeded by UV so each pixel moves differently
  float nX = snoise(vec3(vUv * 8.0, u_time * 0.005));
  float nY = snoise(vec3(vUv * 8.0 + 100.0, u_time * 0.005));
  float nZ = snoise(vec3(vUv * 8.0 + 200.0, u_time * 0.005));

  // Low freq (bass) → X axis shake
  transformed.x += nX * u_audioLow * 15.0;
  // Mid freq → Y axis shake
  transformed.y += nY * u_audioMid * 12.0;
  // High freq → Z axis push/pull (depth breathing)
  transformed.z += nZ * u_audioHigh * 20.0;

  // Point size: base + edge reveal + audio makes points pulse
  float audioPulse = (u_audioLow + u_audioMid + u_audioHigh) / 3.0;
  gl_PointSize = 1.5 + vEdge * 1.5 + audioPulse * 1.2;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}
`;

// ── Image plane fragment ──
const IMG_FRAG = SNOISE + /* glsl */ `
uniform sampler2D u_diffuseMap;
uniform float u_time;
uniform vec3 u_accentColor;

varying vec2 vUv;
varying float vAlpha;
varying float vEdge;

void main() {
  vec3 mapColor = texture2D(u_diffuseMap, vUv).rgb;

  // vEdge=1 near mouse → show image colors
  // vEdge=0 far from mouse → white scattered
  mapColor = mix(mapColor, vec3(1.0), 1.0 - vEdge);

  // Accent color tint on the transition edge
  if (vEdge > 0.0 && vEdge < 1.0) {
    mapColor = mix(mapColor, u_accentColor * 1.5, 0.6);
  }

  // Organic alpha noise
  float noise = snoise(vec3(vUv, u_time * 0.0003) * 40.0);
  float alpha = 0.25 * vAlpha + (0.75 * vAlpha - noise * 0.5 * vAlpha) * vEdge;

  gl_FragColor = vec4(mapColor, alpha);
}
`;

// ══════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════

/** Load a texture and WAIT for it to be fully ready before returning */
function loadTexture(texLoader: THREE.TextureLoader, url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    texLoader.load(
      url,
      (tex) => {
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        resolve(tex);
      },
      undefined,
      reject
    );
  });
}

/** Try to load Xdepth.jpg. If it doesn't exist, generate from luminosity */
async function loadDepthTexture(
  imageName: string,
  texLoader: THREE.TextureLoader
): Promise<THREE.Texture> {
  const base = imageName.replace(/\.\w+$/, "");
  const ext = imageName.match(/\.\w+$/)?.[0] || ".jpg";
  const depthUrl = `/login/backgrounds/${base}depth${ext}`;

  try {
    const tex = await loadTexture(texLoader, depthUrl);
    // Depth maps should NOT be in sRGB — they are linear data
    tex.colorSpace = THREE.LinearSRGBColorSpace;
    console.log(`[LoginScene] Loaded depth map: ${depthUrl}`);
    return tex;
  } catch {
    // Fallback: generate from luminosity of the diffuse image
    console.log(`[LoginScene] No depth map for ${imageName}, generating from luminosity`);
    const diffuse = await loadTexture(texLoader, `/login/backgrounds/${imageName}`);
    // Read pixels from the diffuse to create a luminosity depth map
    const canvas = document.createElement("canvas");
    const w = 512, h = 512;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    // Draw from diffuse image (need the source image)
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((res) => { img.onload = () => res(); img.src = `/login/backgrounds/${imageName}`; });
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const depth = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      depth[i] = Math.round(data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114);
    }
    const tex = new THREE.DataTexture(depth, w, h, THREE.RedFormat);
    tex.needsUpdate = true;
    diffuse.dispose();
    return tex;
  }
}

// Accent colors matching CSS skins
const ACCENTS: Record<string, [number, number, number]> = {
  "essilor-luxottica": [0.77, 0.64, 0.31],
  "ray-ban": [0.83, 0.10, 0.13],
  "oakley": [0.89, 0.0, 0.17],
  "persol": [0.55, 0.34, 0.16],
  "oliver-peoples": [0.42, 0.44, 0.36],
  "vogue-eyewear": [0.48, 0.18, 0.56],
};

// ══════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════

interface LoginSceneProps {
  images: string[];
  scheme: string;
  audioData: Uint8Array<ArrayBufferLike> | null;
}

export function LoginScene({ images, scheme, audioData }: LoginSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef(audioData);
  audioRef.current = audioData;
  const schemeRef = useRef(scheme);
  schemeRef.current = scheme;
  const imagesRef = useRef(images);
  imagesRef.current = images;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || images.length === 0) return;
    let disposed = false;

    const init = async () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // ── Renderer ──
      const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
      renderer.setSize(vw, vh);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x0a0e14, 1);
      container.appendChild(renderer.domElement);

      // ── Camera ──
      const camera = new THREE.PerspectiveCamera(75, vw / vh, 1, 10000);
      camera.position.z = 700;

      const scene = new THREE.Scene();
      const texLoader = new THREE.TextureLoader();

      // ════════════════════════════════════════════
      // LAYER 1: Background star field
      // ════════════════════════════════════════════
      const bgGeo = new THREE.PlaneGeometry(4000, 4000, 300, 300);
      const accent = ACCENTS[scheme] || ACCENTS["essilor-luxottica"];
      const bgMat = new THREE.ShaderMaterial({
        vertexShader: BG_VERT,
        fragmentShader: BG_FRAG,
        uniforms: {
          u_time: { value: 0 },
          u_audioLow: { value: 0 },
          u_audioMid: { value: 0 },
          u_accentColor: { value: new THREE.Vector3(...accent) },
        },
        transparent: true,
        depthWrite: false,
      });
      const bgPoints = new THREE.Points(bgGeo, bgMat);
      bgPoints.position.z = -200; // behind image
      scene.add(bgPoints);

      // ════════════════════════════════════════════
      // LAYER 2: Image plane
      // ════════════════════════════════════════════

      // Load BOTH textures with await — guaranteed ready before use
      const diffuse = await loadTexture(texLoader, `/login/backgrounds/${images[0]}`);
      if (disposed) return;

      const depthTex = await loadDepthTexture(images[0], texLoader);
      if (disposed) return;

      // Get aspect from loaded texture
      const texImg = diffuse.image as HTMLImageElement;
      const imgAspect = texImg.width / texImg.height;
      console.log(`[LoginScene] Image: ${texImg.width}×${texImg.height}, aspect: ${imgAspect.toFixed(3)}`);

      // Size image plane in world units
      const imgW = 1000;
      const imgH = imgW / imgAspect;

      const maxDepth = Math.round(Math.sqrt(imgW ** 2 + imgH ** 2) * 0.75);

      // 500×400 segments = ~200K points (was 200×200 = 40K)
      const imgGeo = new THREE.PlaneGeometry(imgW, imgH, 500, 400);

      const imgMat = new THREE.ShaderMaterial({
        vertexShader: IMG_VERT,
        fragmentShader: IMG_FRAG,
        uniforms: {
          u_diffuseMap: { value: diffuse },
          u_depthMap: { value: depthTex },
          u_maxDepth: { value: maxDepth },
          u_edge: { value: 0.5 },
          u_time: { value: 0 },
          u_audioLow: { value: 0 },
          u_audioMid: { value: 0 },
          u_audioHigh: { value: 0 },
          u_accentColor: { value: new THREE.Vector3(...accent) },
        },
        transparent: true,
        depthWrite: false,
      });

      const imgPoints = new THREE.Points(imgGeo, imgMat);
      scene.add(imgPoints);

      // ════════════════════════════════════════════
      // Mouse + Render loop
      // ════════════════════════════════════════════
      const mouse = {
        x: { current: 0, target: 0 },
        y: { current: 0, target: 0 },
      };
      let time = 0;
      let raf = 0;

      const onMouseMove = (e: MouseEvent) => {
        // Normalize to -1..+1 from viewport center (like original scoped())
        mouse.x.target = ((e.clientX / window.innerWidth) - 0.5) * 2;
        mouse.y.target = ((e.clientY / window.innerHeight) - 0.5) * 2;
      };
      window.addEventListener("mousemove", onMouseMove);

      const onResize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
      };
      window.addEventListener("resize", onResize);

      // Smoothed audio band values
      const audioBands = { low: 0, mid: 0, high: 0 };

      const loop = () => {
        if (disposed) return;
        time += 1;

        // ── 3-band audio analysis ──
        const ad = audioRef.current;
        if (ad && ad.length > 0) {
          // Low (bass): bins 0-3
          const lowTarget = ad.slice(0, 4).reduce((a, b) => a + b, 0) / (4 * 255);
          // Mid: bins 4-12
          const midTarget = ad.slice(4, 13).reduce((a, b) => a + b, 0) / (9 * 255);
          // High: bins 13-28
          const highTarget = ad.slice(13, 29).reduce((a, b) => a + b, 0) / (16 * 255);

          audioBands.low += (lowTarget - audioBands.low) * 0.15;
          audioBands.mid += (midTarget - audioBands.mid) * 0.12;
          audioBands.high += (highTarget - audioBands.high) * 0.10;
        } else {
          audioBands.low *= 0.92;
          audioBands.mid *= 0.92;
          audioBands.high *= 0.92;
        }

        // Pass 3 bands to image shader
        imgMat.uniforms.u_audioLow.value = audioBands.low;
        imgMat.uniforms.u_audioMid.value = audioBands.mid;
        imgMat.uniforms.u_audioHigh.value = audioBands.high;
        imgMat.uniforms.u_time.value = time;

        // Pass audio to background too
        bgMat.uniforms.u_audioLow.value = audioBands.low;
        bgMat.uniforms.u_audioMid.value = audioBands.mid;
        bgMat.uniforms.u_time.value = time;

        // Smooth mouse (ease = 0.05 like original)
        mouse.x.current += (mouse.x.target - mouse.x.current) * 0.05;
        mouse.y.current += (mouse.y.target - mouse.y.current) * 0.05;

        // ── Rotate + translate IMAGE mesh (exactly like original) ──
        imgPoints.position.x = mouse.x.current * imgW * -0.1;
        imgPoints.position.y = mouse.y.current * imgH * 0.05;
        imgPoints.rotation.y = mouse.x.current * Math.PI * -0.1;
        imgPoints.rotation.x = mouse.y.current * Math.PI * -0.1;

        // Edge reveal (exactly like original)
        imgMat.uniforms.u_edge.value = 1.0 - (mouse.x.current + 1) / 2;

        // Update accent color smoothly when scheme changes
        const acc = ACCENTS[schemeRef.current] || ACCENTS["essilor-luxottica"];
        const v = imgMat.uniforms.u_accentColor.value as THREE.Vector3;
        v.x += (acc[0] - v.x) * 0.05;
        v.y += (acc[1] - v.y) * 0.05;
        v.z += (acc[2] - v.z) * 0.05;
        // Same for background
        const bv = bgMat.uniforms.u_accentColor.value as THREE.Vector3;
        bv.x += (acc[0] - bv.x) * 0.05;
        bv.y += (acc[1] - bv.y) * 0.05;
        bv.z += (acc[2] - bv.z) * 0.05;

        renderer.render(scene, camera);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

      // ════════════════════════════════════════════
      // Image cycling — swap diffuse + depth every 20s
      // ════════════════════════════════════════════
      let imageIndex = 0;
      let cycling = false;

      const cycleImage = async () => {
        if (cycling || disposed || imagesRef.current.length <= 1) return;
        cycling = true;

        imageIndex = (imageIndex + 1) % imagesRef.current.length;
        const nextName = imagesRef.current[imageIndex];
        console.log(`[LoginScene] Cycling to: ${nextName}`);

        try {
          // Load both textures for the next image
          const nextDiffuse = await loadTexture(texLoader, `/login/backgrounds/${nextName}`);
          if (disposed) return;
          const nextDepth = await loadDepthTexture(nextName, texLoader);
          if (disposed) return;

          // Dispose old textures
          const oldDiffuse = imgMat.uniforms.u_diffuseMap.value;
          const oldDepth = imgMat.uniforms.u_depthMap.value;

          // Swap
          imgMat.uniforms.u_diffuseMap.value = nextDiffuse;
          imgMat.uniforms.u_depthMap.value = nextDepth;

          // Dispose old
          if (oldDiffuse) oldDiffuse.dispose();
          if (oldDepth) oldDepth.dispose();
        } catch (e) {
          console.warn(`[LoginScene] Failed to load ${nextName}`, e);
        }

        cycling = false;
      };

      const cycleInterval = setInterval(cycleImage, 20000); // 20 seconds

      // Cleanup
      return () => {
        clearInterval(cycleInterval);
        disposed = true;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("resize", onResize);
        cancelAnimationFrame(raf);
        bgGeo.dispose(); bgMat.dispose();
        imgGeo.dispose(); imgMat.dispose();
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      };
    };

    let cleanup: (() => void) | undefined;
    init().then((fn) => { cleanup = fn; });
    return () => { cleanup?.(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-0"
      style={{ background: "#0a0e14" }}
    />
  );
}
