import * as THREE from 'three';
import { DEMO } from './config.ts';
import type { GameState } from './progression.ts';
import { CAT_FROM_LOOP, SIGNS, fadedSigns } from './loopEcho.ts';
// デザイナー（山口さん）の待機画と歩き差分2枚。?inline でJSに埋め込み、ダブルクリック版でも読めるようにする。
// 3枚とも同じ枠（291x640、右向き）で切り出してあるので、差し替えても位置はずれない。
import girlIdleUrl from './assets/girl-idle.png?inline';
import girlWalk1Url from './assets/girl-walk1.png?inline';
import girlWalk2Url from './assets/girl-walk2.png?inline';

// 歩き差分は腰と手だけが違い脚は同じなので、間に待機画を挟んで脚が開く・閉じるを交互に見せる。
const WALK_CYCLE = [1, 0, 2, 0] as const;
const WALK_FRAME_SECONDS = 0.16;

/** TEMP art: simple geometry and generated shop signs, no supplied concept art. */
export class Street {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera();
  private girl = new THREE.Group();
  private sprite!: THREE.Mesh;
  private girlFrames: THREE.MeshBasicMaterial[] = [];
  private walkTime = 0;
  private tiles: THREE.Group[] = [];
  private machinePanels: THREE.Mesh[] = [];
  private gaps: THREE.Mesh[] = [];
  private lamps: THREE.Mesh[] = [];
  private signs: { index: number; draw: (text: string) => void }[] = [];
  private cats: THREE.Group[] = [];
  private shownLoops = -1;
  private rain: THREE.LineSegments;
  private rainPositions: Float32Array;
  private width = 1;
  private height = 1;
  private pixelsPerUnit = 1;
  private materials = new Map<string, THREE.MeshBasicMaterial>();
  private geometries = new Set<THREE.BufferGeometry>();
  private textures: THREE.Texture[] = [];
  private resizeObserver: ResizeObserver;
  private contextLost: (event: Event) => void;

  constructor(private host: HTMLElement, onContextLost: () => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor('#0b142c');
    this.renderer.domElement.setAttribute('aria-label', '雨の夜の商店街と少女');
    host.prepend(this.renderer.domElement);
    this.camera.position.z = 30;
    this.camera.near = 0.1;
    this.camera.far = 100;
    for (const offset of [-DEMO.streetLength, 0, DEMO.streetLength]) {
      const tile = this.makeStreet();
      tile.position.x = offset;
      this.scene.add(tile);
      this.tiles.push(tile);
    }
    // The next area deliberately stays quiet and simple for this one-puzzle demo.
    this.rect(this.scene, 33, -4.8, 70, 4, '#111f36', 0.1);
    this.rect(this.scene, 26, -2.8, 18, 0.12, '#77969c', 0.2, 0.4);
    this.label(this.scene, 'この先へ', 23, -1.3, 2, '#adc6ca', 1);
    this.makeGirl();
    this.scene.add(this.girl);
    this.rainPositions = new Float32Array(DEMO.rainCount * 6);
    for (let i = 0; i < DEMO.rainCount; i++) {
      this.rainPositions[i * 6] = (this.random(i + 9) - 0.5) * 70;
      this.rainPositions[i * 6 + 1] = this.random(i + 13) * 18 - 8;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.geometries.add(geometry);
    this.rain = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#6a9cb8', transparent: true, opacity: 0.25 }));
    this.scene.add(this.rain);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.contextLost = (event) => { event.preventDefault(); onContextLost(); };
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
    this.resize();
  }

  private random(n: number): number {
    const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  }

  private material(color: string, opacity: number): THREE.MeshBasicMaterial {
    const key = `${color}/${opacity}`;
    let material = this.materials.get(key);
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1 });
      this.materials.set(key, material);
    }
    return material;
  }

  private rect(parent: THREE.Object3D, x: number, y: number, w: number, h: number, color: string, z: number, opacity = 1): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(w, h);
    this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, this.material(color, opacity));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  private circle(parent: THREE.Object3D, x: number, y: number, radius: number, color: string, z: number, opacity = 1): THREE.Mesh {
    const geometry = new THREE.CircleGeometry(radius, 24);
    this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, this.material(color, opacity));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  /** Returns a redraw function so loop echoes can rewrite shop signs in place. */
  private label(parent: THREE.Object3D, text: string, x: number, y: number, width: number, color: string, z: number): (text: string) => void {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 96;
    const context = canvas.getContext('2d')!;
    const texture = new THREE.CanvasTexture(canvas);
    const draw = (value: string) => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = color;
      context.font = 'bold 36px "Yu Gothic UI", "Yu Gothic", "Hiragino Sans", "Noto Sans JP", Meiryo, sans-serif';
      context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillText(value, 256, 48);
      texture.needsUpdate = true;
    };
    draw(text);
    this.textures.push(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
    const geometry = new THREE.PlaneGeometry(width, width * 96 / 512);
    this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); parent.add(mesh);
    return draw;
  }

  private makeStreet(): THREE.Group {
    const root = new THREE.Group();
    this.rect(root, 0, 3, 36, 10, '#101d36', 0);
    for (let i = 0; i < 14; i++) {
      const x = -17 + i * 2.65;
      const h = 3 + this.random(i) * 5;
      this.rect(root, x, 2.5 + h / 2, 2.3, h, '#152440', 0.3);
      for (let j = 0; j < 5; j++) {
        this.rect(root, x - 0.55, 3 + j * 0.85, 0.28, 0.38, '#537c91', 0.4, this.random(i * 9 + j) > 0.6 ? 0.4 : 0.1);
      }
    }
    this.rect(root, 0, -4.5, 36, 4, '#14263d', 1);
    this.rect(root, 0, -2.9, 36, 0.17, '#45627a', 2);
    this.rect(root, 0, -3.08, 36, 0.12, '#0b162b', 2.1);
    const shops = [
      { x: -15, w: 4.5, h: 5.8, sign: SIGNS[0], color: '#7c9a9a' },
      { x: -9.8, w: 5.5, h: 7.8, sign: SIGNS[1], color: '#759bad' },
      { x: -3.8, w: 5.9, h: 6.3, sign: SIGNS[2], color: '#6b91ac' },
      { x: 4.4, w: 6.8, h: 7.4, sign: SIGNS[3], color: '#8c8eaa' },
      { x: 12.5, w: 8, h: 6.4, sign: SIGNS[4], color: '#6d8a9c' },
    ];
    for (const [index, shop] of shops.entries()) {
      this.rect(root, shop.x, shop.h / 2 - 2.8, shop.w, shop.h, index % 2 ? '#1b3049' : '#1c2d47', 2);
      this.rect(root, shop.x, 0, shop.w - 0.25, 3.5, '#101f34', 2.2);
      this.rect(root, shop.x, 1.5, shop.w - 0.25, 0.7, '#263f58', 2.3);
      this.signs.push({ index, draw: this.label(root, shop.sign, shop.x, 1.5, shop.w - 0.7, shop.color, 2.5) });
      this.rect(root, shop.x, 0.94, shop.w + 0.1, 0.22, '#42637c', 2.4);
      this.rect(root, shop.x, -0.95, shop.w - 0.7, 3.1, '#23354c', 2.3);
      for (let row = 0; row < 15; row++) {
        this.rect(root, shop.x, -2.35 + row * 0.2, shop.w - 0.7, 0.025, '#44556c', 2.4, 0.45);
      }
      for (const dx of [-shop.w / 3, shop.w / 3]) {
        this.rect(root, shop.x + dx, 3.3, 0.95, 1.25, '#101f33', 2.3);
        this.rect(root, shop.x + dx, 3.3, 0.75, 1.02, '#88b9c6', 2.4, index === 1 ? 0.22 : 0.06);
      }
    }
    for (const x of [-12, 8]) {
      this.rect(root, x, -0.2, 0.09, 5.5, '#536a7b', 3);
      this.rect(root, x + 0.36, 2.5, 0.8, 0.12, '#9dc3c8', 3.2);
      const glow = this.circle(root, x + 0.3, 1.8, 1.8, '#64a2bf', 3.1, 0.045);
      glow.scale.set(0.65, 1.5, 1);
      this.rect(root, x + 0.2, -4.4, 0.7, 1.7, '#82b8c5', 3.2, 0.08);
    }
    for (let i = 0; i < 28; i++) {
      this.rect(root, -17 + this.random(i + 30) * 34, -3.4 - this.random(i + 70) * 2.6,
        0.3 + this.random(i + 50) * 2.5, 0.015 + this.random(i + 11) * 0.06, '#8ab5c6', 3.5, 0.13);
    }
    this.machine(root);
    this.cats.push(this.makeCat(root));
    return root;
  }

  /** PROTOTYPE loop echo: the same black cat sits and stares at the machine. */
  private makeCat(root: THREE.Group): THREE.Group {
    const cat = new THREE.Group();
    this.circle(cat, 0, 0.22, 0.27, '#070d1b', 0).scale.set(1.1, 0.95, 1);
    this.circle(cat, 0.13, 0.55, 0.17, '#070d1b', 0.01);
    for (const dx of [0.05, 0.22]) {
      const ear = this.rect(cat, dx, 0.72, 0.09, 0.12, '#070d1b', 0.01);
      ear.rotation.z = dx > 0.1 ? -0.4 : 0.4;
    }
    const tail = this.rect(cat, -0.33, 0.12, 0.38, 0.06, '#070d1b', 0);
    tail.rotation.z = 0.5;
    for (const dx of [0.12, 0.22]) this.circle(cat, dx, 0.57, 0.025, '#e9e1a6', 0.02);
    cat.position.set(DEMO.machineX - 1.55, -2.85, 4.6);
    cat.visible = false;
    root.add(cat);
    return cat;
  }

  private machine(root: THREE.Group): void {
    const x = DEMO.machineX;
    this.rect(root, x, -1.35, 1.55, 2.95, '#0a1529', 4);
    const panel = this.rect(root, x, -1.3, 1.42, 2.8, '#668eaa', 4.1);
    this.machinePanels.push(panel);
    this.rect(root, x, -0.92, 1.17, 1.55, '#b8d9dd', 4.2);
    for (let i = 0; i < 4; i++) {
      const dx = x - 0.43 + i * 0.28;
      this.rect(root, dx, -0.67, 0.15, 0.5, DEMO.drinks[i].color, 4.3);
      this.rect(root, dx, -0.4, 0.16, 0.06, '#dfedef', 4.4);
      this.rect(root, dx, -1.25, 0.14, 0.05, '#8fb5be', 4.4);
    }
    this.rect(root, x, -2.2, 0.65, 0.25, '#12263c', 4.3);
    const gap = this.rect(root, x + 0.3, -1.6, 0.67, 0.95, '#d2d8d9', 4.5);
    gap.rotation.z = -0.04; this.gaps.push(gap);
    this.rect(root, x, -3.7, 1.25, 1.3, '#8bc7d1', 3.6, 0.12);
    this.lamps.push(this.circle(root, x, -1, 2.5, '#8ecedc', 3.7, 0.06));
  }

  private makeGirl(): void {
    this.circle(this.girl, 0, -0.02, 0.38, '#060e20', 6, 0.45).scale.y = 0.2;
    // 足元の中心が girl の原点に来るよう置く。左へ歩く時は左右反転する。
    const height = DEMO.girlHeight;
    const width = height * 291 / 640;
    const loader = new THREE.TextureLoader();
    for (const url of [girlIdleUrl, girlWalk1Url, girlWalk2Url]) {
      const texture = loader.load(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      this.textures.push(texture);
      // 夜の街から浮かないよう、少しだけ青暗く乗算する。
      this.girlFrames.push(new THREE.MeshBasicMaterial({ map: texture, color: '#c3cddc', transparent: true, alphaTest: 0.05, depthWrite: false }));
    }
    const geometry = new THREE.PlaneGeometry(width, height);
    geometry.translate(width * (0.5 - 150 / 291), height / 2, 0);
    this.geometries.add(geometry);
    this.sprite = new THREE.Mesh(geometry, this.girlFrames[0]);
    this.sprite.position.z = 7.5;
    this.girl.add(this.sprite);
    this.girl.position.y = -2.85;
  }

  private resize(): void {
    this.width = Math.max(1, this.host.clientWidth);
    this.height = Math.max(1, this.host.clientHeight);
    const aspect = this.width / this.height;
    let halfHeight = DEMO.viewHeight / 2;
    let halfWidth = halfHeight * aspect;
    if (halfWidth < DEMO.minViewWidth / 2) {
      halfWidth = DEMO.minViewWidth / 2;
      halfHeight = halfWidth / aspect;
    }
    this.pixelsPerUnit = this.height / (halfHeight * 2);
    this.camera.left = -halfWidth; this.camera.right = halfWidth;
    this.camera.top = halfHeight; this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  render(state: GameState, time: number, dt: number): { x: number; y: number; scale: number } {
    this.camera.position.x = state.x;
    this.girl.position.x = state.x;
    this.girl.scale.x = state.facing;
    // 歩いている間だけコマを進める。止まったら待機画に戻し、次に歩き出す時は1コマ目から。
    this.walkTime = state.moving ? this.walkTime + dt : 0;
    const frame = state.moving ? WALK_CYCLE[Math.floor(this.walkTime / WALK_FRAME_SECONDS) % WALK_CYCLE.length] : 0;
    this.sprite.material = this.girlFrames[frame];
    // 脚がそろう待機画のコマでわずかに体が上がる。
    this.girl.position.y = -2.85 + (state.moving && frame === 0 ? 0.03 : 0);
    this.gaps.forEach((gap) => { gap.visible = !state.repaired; });
    this.machinePanels.forEach((panel) => { panel.material = this.material(state.repaired ? '#7ba7b5' : '#668eaa', 1); });
    this.lamps.forEach((lamp) => { lamp.scale.setScalar(1 + Math.sin(time * 1.5) * 0.02); });
    if (state.loops !== this.shownLoops) {
      this.shownLoops = state.loops;
      const texts = fadedSigns(state.loops);
      this.signs.forEach((sign) => sign.draw(texts[sign.index]));
      this.cats.forEach((cat) => { cat.visible = state.loops >= CAT_FROM_LOOP; });
    }
    // After repair, only the original street remains. Its right-hand exit leads onward.
    this.tiles.forEach((tile, index) => { tile.visible = !state.repaired || index === 1; });
    for (let i = 0; i < DEMO.rainCount; i++) {
      const p = i * 6;
      this.rainPositions[p] -= dt * 1.4;
      this.rainPositions[p + 1] -= dt * (7 + this.random(i) * 4);
      if (this.rainPositions[p + 1] < -7) this.rainPositions[p + 1] = 8;
      if (this.rainPositions[p] < -35) this.rainPositions[p] = 35;
      this.rainPositions[p + 2] = 12;
      this.rainPositions[p + 3] = this.rainPositions[p] + 0.045;
      this.rainPositions[p + 4] = this.rainPositions[p + 1] + 0.25;
      this.rainPositions[p + 5] = 12;
    }
    this.rain.position.x = state.x;
    this.rain.geometry.attributes.position.needsUpdate = true;
    this.camera.updateMatrixWorld();
    this.renderer.render(this.scene, this.camera);
    let machineX = DEMO.machineX;
    if (!state.repaired) machineX += Math.round((state.x - machineX) / DEMO.streetLength) * DEMO.streetLength;
    const point = new THREE.Vector3(machineX, -1.3, 5).project(this.camera);
    return { x: (point.x + 1) * this.width / 2, y: (1 - point.y) * this.height / 2, scale: this.pixelsPerUnit };
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
    this.geometries.forEach((geometry) => geometry.dispose());
    const materials = new Set<THREE.Material>();
    this.scene.traverse((node) => {
      if ('material' in node) {
        const value = node.material as THREE.Material | THREE.Material[];
        (Array.isArray(value) ? value : [value]).forEach((material) => materials.add(material));
      }
    });
    this.materials.forEach((material) => materials.add(material));
    this.girlFrames.forEach((material) => materials.add(material));
    materials.forEach((material) => material.dispose());
    this.textures.forEach((texture) => texture.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
