// @ts-nocheck
/*
 * Due by Dusk farm engine.
 *
 * Imported from Gemini's v0.6.05 single-file build (a webpack bundle of its TypeScript sources: the Phaser
 * shim, geography, crops, skill tree, save system and the farm scene), formatted with Prettier. Claude's
 * farm patches from the one-day tests were applied before formatting: v0.6.02-style band at 22% height,
 * flat sky bands, no scarecrow/barn/Arthur, vegetables 20% bigger, 7 soil rows, field density, touch
 * Charge Cleave and bottom-edge reach, no swearing, the shell hooks (window.__od*, __dbdCoin) and the
 * coin jar target. Studio-only blobs (reference images and "copy code" strings) were removed.
 *
 * The code keeps Gemini's single-scope structure on purpose: everything shares the scene state
 * (mode, farm, meta, crops, cur, ...). startGeminiEngine() runs it once.
 */
let started = false;

export function startGeminiEngine() {
  if (started) return window.__PHASER_GAME;
  started = true;
  // ---- phaser shim (src/vendor/phaser-shim.ts) ----

  // UNUSED EXPORTS: game

  // ============================================================================
  // Due by Dusk · v0.6.00 — Spec-Compliant Offline Phaser 3 Runtime (`src/vendor/phaser-shim.ts`)
  // Used ONLY by `scripts/build-offline.cjs` when `registry.npmjs.org` is unreachable
  // in an air-gapped sandbox VM. When `npm install && npm run dev` is run in a
  // connected environment, Vite resolves `import Phaser from 'phaser'` to the
  // official `phaser` package from npm.
  // ============================================================================

  class TextureEntry {
    constructor(key, source, frames) {
      this.key = key;
      this.source = source;
      this.frames = frames || {
        __BASE: {
          frame: {
            x: 0,
            y: 0,
            w: source.width || 1,
            h: source.height || 1,
          },
          anchor: {
            x: 0.5,
            y: 0.5,
          },
        },
      };
    }
  }
  class TextureManager {
    list = {};
    exists(key) {
      return !!this.list[key];
    }
    get(key) {
      return this.list[key];
    }
    addImage(key, source) {
      const entry = new TextureEntry(key, source);
      this.list[key] = entry;
      return entry;
    }
    addCanvas(key, canvas) {
      const entry = new TextureEntry(key, canvas);
      this.list[key] = entry;
      return entry;
    }
    addAtlas(key, source, atlasJson) {
      const frames = {
        __BASE: {
          frame: {
            x: 0,
            y: 0,
            w: source.width || 1,
            h: source.height || 1,
          },
          anchor: {
            x: 0.5,
            y: 0.5,
          },
        },
      };
      if (atlasJson && atlasJson.frames) {
        for (const [k, v] of Object.entries(atlasJson.frames)) {
          frames[k] = {
            frame: v.frame,
            anchor: v.anchor || {
              x: 0.5,
              y: 0.5,
            },
          };
        }
      }
      const entry = new TextureEntry(key, source, frames);
      this.list[key] = entry;
      return entry;
    }
  }
  class AnimationManager {
    anims = {};
    exists(key) {
      return !!this.anims[key];
    }
    create(config) {
      this.anims[config.key] = config;
      return config;
    }
    get(key) {
      return this.anims[key];
    }
    generateFrameNames(key, config) {
      const prefix = config.prefix || '';
      const suffix = config.suffix || '';
      const start = config.start ?? 0;
      const end = config.end ?? 0;
      const out = [];
      for (let i = start; i <= end; i++) {
        out.push({
          key,
          frame: `${prefix}${i}${suffix}`,
        });
      }
      return out;
    }
  }
  class LoaderPlugin {
    queue = [];
    constructor(scene) {
      this.scene = scene;
    }
    image(key, url) {
      this.queue.push(
        () =>
          new Promise((resolve) => {
            let settled = false;
            const finish = () => {
              if (!settled) {
                settled = true;
                resolve();
              }
            };
            const timer = setTimeout(finish, 40);
            const embedded = window.__EMBEDDED_ASSETS?.[url] || url;
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              clearTimeout(timer);
              this.scene.textures.addImage(key, img);
              finish();
            };
            img.onerror = () => {
              clearTimeout(timer);
              finish();
            };
            img.src = embedded;
          }),
      );
      return this;
    }
    atlas(key, textureURL, atlasURL) {
      this.queue.push(
        () =>
          new Promise((resolve) => {
            let settled = false;
            const finish = () => {
              if (!settled) {
                settled = true;
                resolve();
              }
            };
            const timer = setTimeout(finish, 40);
            const embeddedTex = window.__EMBEDDED_ASSETS?.[textureURL] || textureURL;
            const embeddedJson = typeof atlasURL === 'object' ? atlasURL : window.__EMBEDDED_ASSETS?.[atlasURL] || null;
            const loadImg = (jsonObj) => {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => {
                clearTimeout(timer);
                this.scene.textures.addAtlas(key, img, jsonObj);
                finish();
              };
              img.onerror = () => {
                clearTimeout(timer);
                finish();
              };
              img.src = embeddedTex;
            };
            if (embeddedJson) {
              loadImg(typeof embeddedJson === 'string' ? JSON.parse(embeddedJson) : embeddedJson);
            } else if (typeof atlasURL === 'string') {
              fetch(atlasURL)
                .then((r) => r.json())
                .then((j) => loadImg(j))
                .catch(() =>
                  loadImg({
                    frames: {},
                  }),
                );
            } else {
              loadImg({
                frames: {},
              });
            }
          }),
      );
      return this;
    }
    async startLoad() {
      const tasks = this.queue.splice(0, this.queue.length);
      await Promise.all(tasks.map((fn) => fn()));
    }
  }
  class GameObject {
    x = 0;
    y = 0;
    scaleX = 1;
    scaleY = 1;
    rotation = 0;
    alpha = 1;
    depth = 0;
    visible = true;
    active = true;
    originX = 0.5;
    originY = 0.5;
    constructor(scene, x = 0, y = 0) {
      this.scene = scene;
      this.x = x;
      this.y = y;
    }
    setPosition(x, y) {
      this.x = x;
      this.y = y;
      return this;
    }
    setScale(sx, sy) {
      this.scaleX = sx;
      this.scaleY = sy !== undefined ? sy : sx;
      return this;
    }
    setRotation(r) {
      this.rotation = r;
      return this;
    }
    setAlpha(a) {
      this.alpha = a;
      return this;
    }
    setDepth(d) {
      this.depth = d;
      return this;
    }
    setVisible(v) {
      this.visible = v;
      return this;
    }
    setOrigin(ox, oy) {
      this.originX = ox;
      this.originY = oy !== undefined ? oy : ox;
      return this;
    }
    preUpdate(_time, _delta) {}
    render(_ctx) {}
    destroy() {
      this.active = false;
      this.visible = false;
      this.scene.children.remove(this);
    }
  }
  class ImageGameObject extends GameObject {
    displayWidth = null;
    displayHeight = null;
    constructor(scene, x, y, textureKey, frameName = '__BASE') {
      super(scene, x, y);
      this.textureKey = textureKey;
      this.frameName = frameName;
      const tex = scene.textures.get(textureKey);
      const f = tex?.frames[frameName];
      if (f?.anchor) {
        this.originX = f.anchor.x;
        this.originY = f.anchor.y;
      }
    }
    setTexture(key, frame = '__BASE') {
      this.textureKey = key;
      this.frameName = frame;
      const tex = this.scene.textures.get(key);
      const f = tex?.frames[frame];
      if (f?.anchor) {
        this.originX = f.anchor.x;
        this.originY = f.anchor.y;
      }
      return this;
    }
    setDisplaySize(w, h) {
      this.displayWidth = w;
      this.displayHeight = h;
      return this;
    }
    render(ctx) {
      if (!this.visible || this.alpha <= 0) return;
      const tex = this.scene.textures.get(this.textureKey);
      if (!tex) return;
      const fData = tex.frames[this.frameName] || tex.frames.__BASE;
      if (!fData) return;
      const { x: sx, y: sy, w: sw, h: sh } = fData.frame;
      const dw = this.displayWidth !== null ? this.displayWidth : sw * Math.abs(this.scaleX);
      const dh = this.displayHeight !== null ? this.displayHeight : sh * Math.abs(this.scaleY);
      ctx.save();
      ctx.globalAlpha *= this.alpha;
      ctx.translate(this.x, this.y);
      if (this.rotation) ctx.rotate(this.rotation);
      if (this.scaleX < 0 || this.scaleY < 0) {
        ctx.scale(this.scaleX < 0 ? -1 : 1, this.scaleY < 0 ? -1 : 1);
      }
      ctx.drawImage(tex.source, sx, sy, sw, sh, -dw * this.originX, -dh * this.originY, dw, dh);
      ctx.restore();
    }
  }
  class SpriteGameObject extends ImageGameObject {
    currentAnim = null;
    currentFrameIndex = 0;
    animAccumulator = 0;
    isPlaying = false;
    play(key, ignoreIfPlaying = true) {
      if (ignoreIfPlaying && this.isPlaying && this.currentAnim?.key === key) {
        return this;
      }
      const anim = this.scene.anims.get(key);
      if (!anim || !anim.frames.length) return this;
      this.currentAnim = anim;
      this.currentFrameIndex = 0;
      this.animAccumulator = 0;
      this.isPlaying = true;
      const first = anim.frames[0];
      this.setTexture(first.key, first.frame);
      return this;
    }
    preUpdate(_time, delta) {
      if (!this.isPlaying || !this.currentAnim) return;
      const fps = this.currentAnim.frameRate || 10;
      const frameDur = 1000 / fps;
      this.animAccumulator += delta;
      while (this.animAccumulator >= frameDur) {
        this.animAccumulator -= frameDur;
        this.currentFrameIndex++;
        if (this.currentFrameIndex >= this.currentAnim.frames.length) {
          if (this.currentAnim.repeat === -1) {
            this.currentFrameIndex = 0;
          } else {
            this.currentFrameIndex = this.currentAnim.frames.length - 1;
            this.isPlaying = false;
          }
        }
        const ref = this.currentAnim.frames[this.currentFrameIndex];
        if (ref) {
          this.textureKey = ref.key;
          this.frameName = ref.frame;
        }
      }
    }
  }
  class CustomDrawGameObject extends GameObject {
    constructor(scene, drawFn, depth = 0) {
      super(scene, 0, 0);
      this.drawFn = drawFn;
      this.depth = depth;
    }
    render(ctx) {
      if (!this.visible || this.alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha *= this.alpha;
      this.drawFn(ctx);
      ctx.restore();
    }
  }
  class Camera2D {
    shakeTimer = 0;
    shakeIntensity = 0;
    flashTimer = 0;
    flashDuration = 0.25;
    flashColor = '255,240,180';
    zoom = 1;
    shake(durationMs = 180, intensity = 0.008) {
      this.shakeTimer = durationMs / 1000;
      this.shakeIntensity = intensity * 650;
      return this;
    }
    flash(durationMs = 250, r = 255, g = 240, b = 180) {
      this.flashDuration = durationMs / 1000;
      this.flashTimer = this.flashDuration;
      this.flashColor = `${r},${g},${b}`;
      return this;
    }
    setZoom(z) {
      this.zoom = z;
      return this;
    }
    update(dt) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      this.flashTimer = Math.max(0, this.flashTimer - dt);
    }
  }
  class TweenManager {
    tweens = [];
    add(config) {
      const targets = Array.isArray(config.targets) ? config.targets : [config.targets];
      const duration = (config.duration || 400) / 1000;
      const props = {};
      for (const k of Object.keys(config)) {
        if (['targets', 'duration', 'ease', 'onComplete', 'delay'].includes(k)) continue;
        if (typeof config[k] === 'number' && targets[0] && typeof targets[0][k] === 'number') {
          props[k] = {
            from: targets[0][k],
            to: config[k],
          };
        }
      }
      this.tweens.push({
        targets,
        props,
        elapsed: 0,
        duration,
        onComplete: config.onComplete,
      });
    }
    update(dt) {
      for (let i = this.tweens.length - 1; i >= 0; i--) {
        const tw = this.tweens[i];
        tw.elapsed += dt;
        const t = Math.min(1, tw.elapsed / tw.duration);
        const ease = 1 - Math.pow(1 - t, 3);
        for (const target of tw.targets) {
          for (const [k, range] of Object.entries(tw.props)) {
            target[k] = range.from + (range.to - range.from) * ease;
          }
        }
        if (t >= 1) {
          if (tw.onComplete) tw.onComplete();
          this.tweens.splice(i, 1);
        }
      }
    }
  }
  class SceneChildren {
    list = [];
    add(obj) {
      this.list.push(obj);
      return obj;
    }
    remove(obj) {
      const idx = this.list.indexOf(obj);
      if (idx >= 0) this.list.splice(idx, 1);
    }
  }
  class SceneFactory {
    constructor(scene) {
      this.scene = scene;
    }
    image(x, y, key, frame = '__BASE') {
      return this.scene.children.add(new ImageGameObject(this.scene, x, y, key, frame));
    }
    sprite(x, y, key, frame = '__BASE') {
      return this.scene.children.add(new SpriteGameObject(this.scene, x, y, key, frame));
    }
    custom(drawFn, depth = 0) {
      return this.scene.children.add(new CustomDrawGameObject(this.scene, drawFn, depth));
    }
  }
  class SceneManagerProxy {
    constructor(game) {
      this.game = game;
    }
    start(key, data) {
      this.game.startScene(key, data);
    }
    get(key) {
      return this.game.sceneMap[key];
    }
  }
  class Scene {
    constructor(config) {
      this.sysKey = typeof config === 'string' ? config : config.key;
    }
    init(_data) {}
    preload() {}
    create(_data) {}
    update(_time, _delta) {}
  }
  class Game {
    textures = new TextureManager();
    anims = new AnimationManager();
    sceneMap = {};
    activeScene = null;
    lastTime = 0;
    constructor(config) {
      this.config = config;
      const existing = config.canvas || document.getElementById('field');
      if (existing) {
        this.canvas = existing;
      } else {
        this.canvas = document.createElement('canvas');
        const parent = typeof config.parent === 'string' ? document.getElementById(config.parent) : config.parent;
        (parent || document.body).appendChild(this.canvas);
      }
      this.ctx = this.canvas.getContext('2d');
      const sceneClasses = config.scene || [];
      for (const SCls of sceneClasses) {
        const inst = typeof SCls === 'function' ? new SCls() : SCls;
        inst.game = this;
        inst.textures = this.textures;
        inst.anims = this.anims;
        inst.load = new LoaderPlugin(inst);
        inst.children = new SceneChildren();
        inst.add = new SceneFactory(inst);
        inst.cameras = {
          main: new Camera2D(),
        };
        inst.tweens = new TweenManager();
        inst.scene = new SceneManagerProxy(this);
        this.sceneMap[inst.sysKey] = inst;
      }
      if (sceneClasses.length > 0) {
        const firstKey = Object.keys(this.sceneMap)[0];
        this.startScene(firstKey);
      }
      requestAnimationFrame((t) => this.step(t));
    }
    async startScene(key, data) {
      const sc = this.sceneMap[key];
      if (!sc) return;
      sc.children = new SceneChildren();
      sc.add = new SceneFactory(sc);
      sc.cameras = {
        main: new Camera2D(),
      };
      sc.tweens = new TweenManager();
      sc.init(data);
      sc.preload();
      await sc.load.startLoad();
      this.activeScene = sc;
      sc.create(data);
    }
    step(now) {
      const dtMs = this.lastTime ? Math.min(100, Math.max(0, now - this.lastTime)) : 16.67;
      this.lastTime = now;
      const sc = this.activeScene;
      if (sc) {
        sc.cameras.main.update(dtMs / 1000);
        sc.tweens.update(dtMs / 1000);
        for (const child of sc.children.list) {
          if (child.active) child.preUpdate(now, dtMs);
        }
        sc.update(now, dtMs);
        // Sort display list by depth and render
        sc.children.list.sort((a, b) => a.depth - b.depth);
        for (const child of sc.children.list) {
          if (child.visible) child.render(this.ctx);
        }
      }
      requestAnimationFrame((t) => this.step(t));
    }
  }
  const PhaserShim = {
    AUTO: 0,
    CANVAS: 1,
    WEBGL: 2,
    Scale: {
      RESIZE: 3,
      FIT: 1,
    },
    Game,
    Scene,
    GameObjects: {
      GameObject,
      Image: ImageGameObject,
      Sprite: SpriteGameObject,
    },
  };
  /* harmony default export */ const phaser_shim = PhaserShim; // CONCATENATED MODULE: ./.ts-build/data/geography.js

  // ============================================================================
  // Due by Dusk · v0.6.10 — Geographical World & Country Atlas Data
  // World Map -> Select Playable Country -> Geographically Positioned Cities -> Farm
  // Featuring 12 Minimal Vector Cultural Veggie Characters (3 per Playable Country)
  // ============================================================================

  const GEOGRAPHY = {
    // Non-playable countries rendered on the World Map so the globe is a true geographical map
    lockedCountries: [
      {
        code: 'MX',
        name: 'Mexico',
        labelX: 175,
        labelY: 242,
        path: 'M 135,205 L 185,215 L 212,248 L 235,255 L 218,268 L 182,258 L 145,232 Z',
      },
      {
        code: 'AR',
        name: 'Argentina & Andes',
        labelX: 302,
        labelY: 415,
        path: 'M 278,335 L 315,345 L 325,388 L 305,465 L 282,458 L 272,385 Z',
      },
      {
        code: 'CO',
        name: 'Northern Andes',
        labelX: 268,
        labelY: 295,
        path: 'M 242,265 L 298,268 L 292,315 L 262,338 L 245,305 Z',
      },
      {
        code: 'GB',
        name: 'United Kingdom',
        labelX: 462,
        labelY: 112,
        path: 'M 465,102 L 478,105 L 482,126 L 464,128 L 458,115 Z',
      },
      {
        code: 'ES',
        name: 'Spain & Portugal',
        labelX: 462,
        labelY: 176,
        path: 'M 452,160 L 485,162 L 482,186 L 450,185 Z',
      },
      {
        code: 'DE',
        name: 'Central Europe',
        labelX: 528,
        labelY: 132,
        path: 'M 505,115 L 568,112 L 575,152 L 512,152 Z',
      },
      {
        code: 'IT',
        name: 'Italy',
        labelX: 522,
        labelY: 172,
        path: 'M 510,152 L 525,152 L 542,185 L 530,192 L 514,165 Z',
      },
      {
        code: 'NO',
        name: 'Scandinavia',
        labelX: 518,
        labelY: 75,
        path: 'M 495,52 L 548,48 L 555,95 L 525,102 L 498,88 Z',
      },
      {
        code: 'RU',
        name: 'Northern Eurasia',
        labelX: 685,
        labelY: 85,
        path: 'M 568,48 L 895,52 L 915,115 L 795,135 L 655,132 L 572,112 Z',
      },
      {
        code: 'EG',
        name: 'Egypt & Sahara',
        labelX: 545,
        labelY: 235,
        path: 'M 488,196 L 585,202 L 605,265 L 485,268 Z',
      },
      {
        code: 'ZA',
        name: 'Sub-Saharan Africa',
        labelX: 545,
        labelY: 345,
        path: 'M 485,268 L 605,268 L 615,325 L 565,418 L 525,418 L 495,335 Z',
      },
      {
        code: 'ME',
        name: 'Middle East',
        labelX: 615,
        labelY: 205,
        path: 'M 575,165 L 658,172 L 668,235 L 598,242 L 582,195 Z',
      },
      {
        code: 'IN',
        name: 'India',
        labelX: 705,
        labelY: 238,
        path: 'M 672,185 L 742,192 L 712,282 L 692,278 L 675,222 Z',
      },
      {
        code: 'ID',
        name: 'Southeast Asia',
        labelX: 785,
        labelY: 285,
        path: 'M 748,242 L 835,255 L 845,312 L 758,308 Z',
      },
      {
        code: 'AU',
        name: 'Australia',
        labelX: 835,
        labelY: 392,
        path: 'M 775,348 L 882,345 L 895,412 L 845,438 L 772,415 Z',
      },
    ],
    // 4 Fully Playable Countries with World Map geometry + Detailed Country Map geometry + 5-6 Real Cities
    countries: {
      CN: {
        code: 'CN',
        name: 'China',
        subtitle: 'Shaolin Bitter Melon (Gong Monk), Sifu Bok Choy (Fan Master) & Zen Lotus Root (Tea Sage)',
        flag: '🇨🇳',
        envStyle: 'china',
        worldLabelX: 775,
        worldLabelY: 182,
        worldPath: 'M 685,132 L 828,135 L 838,205 L 785,235 L 725,212 L 682,175 Z',
        countryOutline:
          'M 175,185 L 315,115 L 495,125 L 645,85 L 715,145 L 675,245 L 695,345 L 595,435 L 455,445 L 325,385 L 205,315 Z',
        geographicFeatures: [
          {
            type: 'river',
            name: 'Yangtze River (Chang Jiang)',
            lx: 485,
            ly: 295,
            path: 'M 265,305 Q 455,315 665,265',
          },
          {
            type: 'river',
            name: 'Yellow River (Huang He)',
            lx: 495,
            ly: 195,
            path: 'M 325,225 Q 475,175 635,205',
          },
          {
            type: 'mountain',
            name: 'Guilin Karst & Wuyi Peaks',
            lx: 525,
            ly: 375,
            path: 'M 415,365 L 535,385 L 625,345',
          },
        ],
        cities: [
          {
            id: 'cn_guilin',
            name: 'Guilin & Li River',
            province: 'Guangxi · 25.3°N, 110.3°E',
            x: 495,
            y: 395,
            mul: 1.25,
            rival: 'Abbot Huineng',
            record: 220,
            buff: 'Shaolin Bitter Melon, Sifu Bok Choy & Zen Lotus Root pay +20% more',
            desc: 'Emerald river terraces framed by misty limestone karst peaks and bamboo groves—home to Shaolin Bitter Melon, Sifu Bok Choy, and Zen Lotus Root!',
            subTheme: 'karst',
            crops: ['bittermelon', 'bokchoy', 'lotusroot', 'carrot', 'radish', 'cabbage', 'onion', 'pumpkin', 'golden'],
          },
          {
            id: 'cn_hangzhou',
            name: 'Hangzhou & West Lake',
            province: 'Zhejiang · 30.3°N, 120.2°E',
            x: 645,
            y: 285,
            mul: 1.55,
            rival: 'Tea Master Lu Yu',
            record: 440,
            buff: '+12% wider scythe swing across all farms',
            desc: 'Misty lotus ponds and Dragon Well tea hills patrolled by Zen Lotus Root, Sifu Bok Choy, and Shaolin Bitter Melon.',
            subTheme: 'westlake',
            crops: ['lotusroot', 'bokchoy', 'bittermelon', 'carrot', 'radish', 'cabbage', 'golden', 'pumpkin'],
          },
          {
            id: 'cn_chengdu',
            name: 'Chengdu Basin',
            province: 'Sichuan · 30.6°N, 104.1°E',
            x: 385,
            y: 305,
            mul: 1.85,
            rival: 'Grandmaster Mei',
            record: 680,
            buff: '+1.5 s of daylight on all farms',
            desc: 'Fertile "Land of Abundance" irrigated by ancient Dujiangyan channels—famed for Sifu Bok Choy, Shaolin Bitter Melon, and Zen Lotus Root.',
            subTheme: 'sichuan',
            crops: ['bokchoy', 'bittermelon', 'lotusroot', 'carrot', 'radish', 'onion', 'cabbage', 'pumpkin'],
          },
        ],
      },
      MA: {
        code: 'MA',
        name: 'Morocco',
        subtitle:
          'Hummus Chickpea (Mint-Tea Host), Zaalouk Eggplant (Lantern Mystic) & Beldi Green Olive (Gnawa Drummer)',
        flag: '🇲🇦',
        envStyle: 'morocco',
        worldLabelX: 452,
        worldLabelY: 215,
        worldPath: 'M 432,192 L 478,192 L 482,226 L 438,238 L 426,214 Z',
        countryOutline: 'M 220,105 L 580,105 L 660,185 L 590,340 L 420,445 L 210,460 L 145,355 L 185,215 Z',
        geographicFeatures: [
          {
            type: 'mountain',
            name: 'High Atlas Mountains',
            lx: 415,
            ly: 255,
            path: 'M 235,310 Q 410,235 575,195',
          },
          {
            type: 'river',
            name: 'Oued Tensift & Draa',
            lx: 385,
            ly: 345,
            path: 'M 395,265 Q 315,315 215,335',
          },
        ],
        cities: [
          {
            id: 'ma_marrakech',
            name: 'Marrakech & Ourika',
            province: 'Marrakech-Safi · 31.6°N, 8.0°W',
            x: 345,
            y: 295,
            mul: 1.25,
            rival: 'Pasha El-Mansour',
            record: 215,
            buff: 'Hummus Chickpea, Zaalouk Eggplant & Beldi Green Olive pay +20% more',
            desc: 'Sun-drenched red-earth kasbah terraces at the foot of the snow-crowned High Atlas—home to Hummus Chickpea, Zaalouk Eggplant, and Beldi Green Olive!',
            subTheme: 'oasis',
            crops: ['chickpea', 'eggplant', 'olive', 'carrot', 'radish', 'pumpkin', 'golden'],
          },
          {
            id: 'ma_meknes',
            name: 'Meknes & Volubilis',
            province: 'Fès-Meknès · 33.9°N, 5.5°W',
            x: 455,
            y: 175,
            mul: 1.5,
            rival: 'Kaid Moulay',
            record: 425,
            buff: '+12% wider scythe swing across all farms',
            desc: 'Ancient imperial olive groves and sun-warmed aubergine gardens patrolled by Beldi Green Olive, Zaalouk Eggplant, and Hummus Chickpea.',
            subTheme: 'oasis',
            crops: ['olive', 'chickpea', 'eggplant', 'carrot', 'radish', 'golden', 'pumpkin'],
          },
          {
            id: 'ma_fes',
            name: 'Fes & Sais Plain',
            province: 'Fès-Meknès · 34.0°N, 5.0°W',
            x: 515,
            y: 165,
            mul: 1.75,
            rival: 'Master Zellige',
            record: 650,
            buff: '+1.5 s of daylight on all farms',
            desc: 'Fertile Sais Valley chickpea fields & lantern-lit medina orchards famed for Hummus Chickpea, Zaalouk Eggplant, and Beldi Green Olive.',
            subTheme: 'oasis',
            crops: ['eggplant', 'chickpea', 'olive', 'carrot', 'radish', 'onion', 'pumpkin'],
          },
        ],
      },
      US: {
        code: 'US',
        name: 'United States',
        subtitle: 'Sheriff Habanero (Texas Cowboy), Quarterback Sweetcorn (Iowa) & Smokey Brisket-Onion (Georgia)',
        flag: '🤠',
        envStyle: 'canada',
        worldLabelX: 195,
        worldLabelY: 185,
        worldPath: 'M 115,140 L 245,140 L 265,162 L 248,208 L 222,218 L 195,212 L 175,228 L 155,205 L 112,192 Z',
        countryOutline:
          'M 110,130 L 660,130 L 710,185 L 650,380 L 580,435 L 430,400 L 360,465 L 285,390 L 130,360 L 95,240 Z',
        geographicFeatures: [
          {
            type: 'river',
            name: 'Mississippi River',
            lx: 465,
            ly: 285,
            path: 'M 445,145 Q 465,265 445,410',
          },
          {
            type: 'mountain',
            name: 'Rocky Mountains',
            lx: 235,
            ly: 255,
            path: 'M 205,145 L 245,265 L 265,375',
          },
        ],
        cities: [
          {
            id: 'us_austin',
            name: 'Austin & Rio Grande',
            province: 'Texas · 30.3°N, 97.7°W',
            x: 365,
            y: 415,
            mul: 1.25,
            rival: 'Sheriff Buckhorn',
            record: 210,
            buff: 'Sheriff Habanero, Quarterback Sweetcorn & Smokey Brisket-Onion pay +20% more',
            desc: 'Sun-baked Texas ranchland & smokehouse pastures—home to Sheriff Habanero, Quarterback Sweetcorn, and Smokey Brisket-Onion!',
            subTheme: 'prairie',
            crops: ['habanero', 'sweetcorn', 'brisket_onion', 'carrot', 'radish', 'pumpkin', 'golden'],
          },
          {
            id: 'us_desmoines',
            name: 'Des Moines (Corn Belt)',
            province: 'Iowa · 41.6°N, 93.6°W',
            x: 435,
            y: 245,
            mul: 1.5,
            rival: 'Coach Gridiron',
            record: 420,
            buff: '+12% wider scythe swing across all farms',
            desc: 'Heartland gridiron cornfields patrolled by blitzing Quarterback Sweetcorn, Sheriff Habanero, and Smokey Brisket-Onion.',
            subTheme: 'prairie',
            crops: ['sweetcorn', 'habanero', 'brisket_onion', 'carrot', 'radish', 'golden', 'pumpkin'],
          },
          {
            id: 'us_vidalia',
            name: 'Vidalia & Savannah',
            province: 'Georgia · 32.2°N, 82.4°W',
            x: 585,
            y: 365,
            mul: 1.75,
            rival: 'Pitmaster Beauregard',
            record: 640,
            buff: '+1.5 s of daylight on all farms',
            desc: 'Sweet sandy coastal-plain soil famed for pitmaster Smokey Brisket-Onions, Sheriff Habanero, and Quarterback Sweetcorn.',
            subTheme: 'marsh',
            crops: ['brisket_onion', 'habanero', 'sweetcorn', 'carrot', 'radish', 'onion', 'pumpkin'],
          },
        ],
      },
      CA: {
        code: 'CA',
        name: 'Canada',
        subtitle: 'Hoser Russet (Hockey Potato), Lumberjack Fiddlehead & Mountie Saskaberry',
        flag: '🍁',
        envStyle: 'canada',
        worldLabelX: 185,
        worldLabelY: 98,
        worldPath:
          'M 95,72 L 122,62 L 165,58 L 205,62 L 225,78 L 208,98 L 215,118 L 232,126 L 245,105 L 268,96 L 298,112 L 318,128 L 302,142 L 282,146 L 252,156 L 235,142 L 115,140 L 102,122 L 96,95 Z M 228,48 L 278,46 L 295,68 L 265,82 L 235,68 Z M 332,32 L 395,28 L 412,58 L 378,88 L 342,76 Z',
        countryOutline:
          'M 92,165 L 118,95 L 225,85 L 335,92 L 395,112 L 425,148 L 398,195 L 405,255 L 445,278 L 462,312 L 482,312 L 488,268 L 525,215 L 548,162 L 615,175 L 678,248 L 705,305 L 665,335 L 615,368 L 655,375 L 692,402 L 668,422 L 628,405 L 598,418 L 562,452 L 522,478 L 498,485 L 508,452 L 482,425 L 445,412 L 142,412 L 112,372 L 102,295 L 86,225 Z M 74,345 L 96,355 L 102,398 L 82,392 Z M 265,42 L 365,38 L 385,74 L 285,78 Z M 445,35 L 575,45 L 612,128 L 545,142 L 465,98 Z M 708,325 L 758,318 L 768,368 L 718,372 Z',
        geographicFeatures: [
          {
            type: 'water',
            name: 'Hudson Bay',
            lx: 455,
            ly: 225,
            path: 'M 402,188 C 395,235 415,278 462,310 C 485,310 492,265 522,215 C 495,182 442,175 402,188 Z',
          },
          {
            type: 'water',
            name: 'Great Lakes',
            lx: 472,
            ly: 462,
            path: 'M 428,408 Q 468,395 498,425 Q 528,455 568,428 Q 538,478 492,482 Q 465,442 428,408 Z',
          },
          {
            type: 'river',
            name: 'St. Lawrence',
            lx: 625,
            ly: 355,
            path: 'M 565,428 Q 615,388 675,342',
          },
          {
            type: 'mountain',
            name: 'Rocky Mountains',
            lx: 155,
            ly: 255,
            path: 'M 128,145 L 158,245 L 188,395',
          },
        ],
        cities: [
          {
            id: 'ca_toronto',
            name: 'Toronto (Holland Marsh)',
            province: 'Ontario · 43.7°N, 79.4°W',
            x: 548,
            y: 446,
            mul: 1.0,
            rival: 'Reeve MacLeod',
            record: 165,
            buff: '+10% vegetable sell value across all farms',
            desc: 'Rich black muck-soil kettle marsh north of Lake Ontario—home to Hoser Russet, Lumberjack Fiddlehead, Mountie Saskaberry, Gym-Bro Carrot & Runaway Radish.',
            subTheme: 'marsh',
            crops: [
              'pei_russet',
              'fiddlehead',
              'saskaberry',
              'carrot',
              'radish',
              'onion',
              'cabbage',
              'pumpkin',
              'golden',
            ],
          },
          {
            id: 'ca_gatineau',
            name: 'Gatineau & Outaouais',
            province: 'Quebec & NB · 45.4°N, 75.7°W',
            x: 588,
            y: 414,
            mul: 1.15,
            rival: 'Madame Tremblay',
            record: 240,
            buff: '+1.0 s of daylight on all farms',
            desc: 'Rolling Laurentian & Maritime river valleys famed for coiled Lumberjack Fiddlehead ferns, Hoser Russets, and Mountie Saskaberries.',
            subTheme: 'maple',
            crops: ['fiddlehead', 'pei_russet', 'saskaberry', 'carrot', 'radish', 'cabbage', 'pumpkin', 'golden'],
          },
          {
            id: 'ca_saskatoon',
            name: 'Saskatoon',
            province: 'Saskatchewan · 52.1°N, 106.7°W',
            x: 305,
            y: 358,
            mul: 1.35,
            rival: 'Foreman Kowalski',
            record: 380,
            buff: 'Saskaberries & Canadian crops pay +20% more',
            desc: 'Vast golden prairie chernozem plains patrolled by polite Mountie Saskaberries, Hoser Russets, and Lumberjack Fiddleheads.',
            subTheme: 'prairie',
            crops: ['saskaberry', 'pei_russet', 'fiddlehead', 'carrot', 'radish', 'golden', 'pumpkin', 'cabbage'],
          },
          {
            id: 'ca_kelowna',
            name: 'Kelowna (Okanagan)',
            province: 'British Columbia · 49.9°N, 119.5°W',
            x: 175,
            y: 378,
            mul: 1.55,
            rival: 'Vintner Alistair',
            record: 520,
            buff: '+8% critical harvest chance on all farms',
            desc: 'Sun-drenched lake terraces nestled between pine-clad Interior mountains—renowned for Mountie Saskaberries and orchard produce.',
            subTheme: 'mountain',
            crops: ['saskaberry', 'fiddlehead', 'pei_russet', 'carrot', 'radish', 'berry', 'onion', 'pumpkin'],
          },
          {
            id: 'ca_charlottetown',
            name: 'Charlottetown',
            province: 'Prince Edward Island · 46.2°N, 63.1°W',
            x: 695,
            y: 392,
            mul: 1.75,
            rival: 'Captain Arsenault',
            record: 720,
            buff: 'Potatoes & Root crops take +25% bonus damage',
            desc: 'Iron-rich red-sandstone coastal farmland famous worldwide for toothless hockey-stick-tapping Hoser Russet potatoes!',
            subTheme: 'maritime',
            crops: ['pei_russet', 'fiddlehead', 'saskaberry', 'carrot', 'radish', 'potato', 'onion', 'pumpkin'],
          },
          {
            id: 'ca_leamington',
            name: 'Leamington (Essex)',
            province: 'Ontario South · 42.1°N, 82.6°W',
            x: 512,
            y: 472,
            mul: 1.95,
            rival: 'Baroness Vance',
            record: 980,
            buff: '+12% faster crop sprouting on all farms',
            desc: 'Canada’s warmest southern peninsula jutting into Lake Erie—lush market rows and high-yield harvests.',
            subTheme: 'marsh',
            crops: ['pei_russet', 'saskaberry', 'fiddlehead', 'carrot', 'radish', 'golden', 'pumpkin', 'potato'],
          },
        ],
      },
      BR: {
        code: 'BR',
        name: 'Brazil',
        subtitle: 'Carnavale Abacaxi (Samba Pineapple), Ginga Mandioca & Craque Guaraná',
        flag: '🌴',
        envStyle: 'brazil',
        worldLabelX: 325,
        worldLabelY: 325,
        worldPath: 'M 268,268 L 325,265 L 372,292 L 365,342 L 332,388 L 308,382 L 292,338 L 258,308 Z',
        countryOutline:
          'M 195,125 L 335,75 L 485,95 L 665,168 L 685,235 L 595,335 L 515,412 L 435,482 L 375,455 L 365,365 L 255,315 L 145,235 Z',
        geographicFeatures: [
          {
            type: 'river',
            name: 'Amazon River (Rio Amazonas)',
            path: 'M 165,155 Q 325,148 485,112',
          },
          {
            type: 'river',
            name: 'São Francisco River',
            path: 'M 495,325 Q 525,235 635,205',
          },
          {
            type: 'mountain',
            name: 'Chapada Diamantina & Serra do Mar',
            path: 'M 565,245 L 535,345 L 465,415',
          },
        ],
        cities: [
          {
            id: 'br_petrolina',
            name: 'Petrolina (São Francisco)',
            province: 'Pernambuco · 9.4°S, 40.5°W',
            x: 588,
            y: 205,
            mul: 1.35,
            rival: 'Coronel Mendoza',
            record: 420,
            buff: 'Carnavale Abacaxi & Tropical crops pay +20% more',
            desc: 'Irrigated oasis along the São Francisco River—home to samba-dancing Carnavale Abacaxi, capoeira Ginga Mandioca, and soccer star Craque Guaraná!',
            subTheme: 'sertao',
            crops: ['abacaxi', 'mandioca', 'guarana', 'carrot', 'radish', 'golden', 'pumpkin', 'onion'],
          },
          {
            id: 'br_ribeirao',
            name: 'Ribeirão Preto',
            province: 'São Paulo · 21.2°S, 47.8°W',
            x: 492,
            y: 358,
            mul: 1.65,
            rival: 'Dona Helena',
            record: 680,
            buff: '+12% wider scythe arc across all farms',
            desc: 'Fertile purple-red volcanic soil (Terra Roxa) on the Paulista plateau—bursting with Carnavale Abacaxi, Ginga Mandioca, and Craque Guaraná.',
            subTheme: 'terraroxa',
            crops: ['abacaxi', 'guarana', 'mandioca', 'carrot', 'radish', 'golden', 'pumpkin', 'potato'],
          },
          {
            id: 'br_belem',
            name: 'Belém (Amazon Delta)',
            province: 'Pará · 1.5°S, 48.5°W',
            x: 478,
            y: 112,
            mul: 1.9,
            rival: 'Capitão Silva',
            record: 950,
            buff: 'Rain & Fertilizer spawn +35% more crops',
            desc: 'Lush equatorial floodplain at the mouth of the Amazon—homeland of capoeira-kicking Ginga Mandioca and hyper-caffeinated Craque Guaraná.',
            subTheme: 'amazon',
            crops: ['mandioca', 'guarana', 'abacaxi', 'carrot', 'radish', 'berry', 'golden', 'pumpkin'],
          },
          {
            id: 'br_sinop',
            name: 'Sinop (Cerrado)',
            province: 'Mato Grosso · 11.9°S, 55.5°W',
            x: 368,
            y: 248,
            mul: 2.2,
            rival: 'Fazendeiro Braga',
            record: 1350,
            buff: '+15% faster swing rate on all farms',
            desc: 'Endless red-earth savanna plateaus beneath dramatic flat-topped Chapada sandstone mesas.',
            subTheme: 'cerrado',
            crops: ['guarana', 'mandioca', 'abacaxi', 'carrot', 'radish', 'golden', 'pumpkin', 'potato'],
          },
          {
            id: 'br_bento',
            name: 'Bento Gonçalves',
            province: 'Rio Grande do Sul · 29.2°S, 51.5°W',
            x: 445,
            y: 448,
            mul: 2.5,
            rival: 'Barão Garibaldi',
            record: 1850,
            buff: 'Chain multipliers last +0.4s longer',
            desc: 'Steep basalt-canyon highlands in southern Brazil crowned with umbrella-shaped Araucaria pines and terraced valleys.',
            subTheme: 'gaucho',
            crops: ['abacaxi', 'mandioca', 'guarana', 'carrot', 'radish', 'berry', 'cabbage', 'pumpkin'],
          },
        ],
      },
      FR: {
        code: 'FR',
        name: 'France',
        subtitle: 'Monsieur Échalote (Mime Shallot), Chevalier Artichaut & Diva Lavande',
        flag: '⚜️',
        envStyle: 'france',
        worldLabelX: 488,
        worldLabelY: 146,
        worldPath: 'M 472,128 L 505,126 L 512,148 L 498,162 L 474,160 L 465,142 Z',
        countryOutline:
          'M 285,82 L 455,68 L 625,135 L 605,255 L 645,355 L 595,435 L 455,448 L 385,468 L 245,425 L 265,285 L 125,195 L 155,145 L 265,148 Z',
        geographicFeatures: [
          {
            type: 'river',
            name: 'Loire River',
            path: 'M 215,225 Q 355,228 485,295',
          },
          {
            type: 'river',
            name: 'Rhône River',
            path: 'M 545,255 L 525,425',
          },
          {
            type: 'mountain',
            name: 'French Alps & Pyrenees',
            path: 'M 585,285 L 625,385 M 255,432 L 425,455',
          },
        ],
        cities: [
          {
            id: 'fr_avignon',
            name: 'Avignon (Provence)',
            province: 'Vaucluse · 43.9°N, 4.8°E',
            x: 525,
            y: 398,
            mul: 1.5,
            rival: 'Comtesse de Valois',
            record: 550,
            buff: 'Diva Lavande, Échalote & Artichaut pay +25% more',
            desc: 'Sun-baked limestone plateaus framed by Mediterranean cypresses and Roman arches—home to Diva Lavande, Monsieur Échalote, and Chevalier Artichaut!',
            subTheme: 'provence',
            crops: ['lavender', 'echalote', 'artichaut', 'carrot', 'radish', 'onion', 'cabbage', 'pumpkin'],
          },
          {
            id: 'fr_tours',
            name: 'Tours (Loire Valley)',
            province: 'Indre-et-Loire · 47.4°N, 0.7°E',
            x: 342,
            y: 232,
            mul: 1.8,
            rival: 'Marquis de Chenonceau',
            record: 880,
            buff: '+2 max crops on the field on all farms',
            desc: 'The "Garden of France"—ornate white-tuffeau Renaissance château potagers patrolled by fencing Chevalier Artichaut and mime Monsieur Échalote.',
            subTheme: 'loire',
            crops: ['artichaut', 'echalote', 'lavender', 'carrot', 'radish', 'cabbage', 'berry', 'pumpkin'],
          },
          {
            id: 'fr_beaune',
            name: 'Beaune (Burgundy)',
            province: 'Côte-d’Or · 47.0°N, 4.8°E',
            x: 508,
            y: 248,
            mul: 2.15,
            rival: 'Intendant Moreau',
            record: 1280,
            buff: 'Lucky crops appear +2% more often',
            desc: 'Golden limestone slopes enclosed by ancient dry-stone walls (clos) and glazed-tile Burgundian manor roofs.',
            subTheme: 'burgundy',
            crops: ['echalote', 'lavender', 'artichaut', 'carrot', 'radish', 'berry', 'onion', 'potato'],
          },
          {
            id: 'fr_roscoff',
            name: 'Roscoff (Brittany)',
            province: 'Finistère · 48.7°N, 4.0°W',
            x: 158,
            y: 168,
            mul: 2.45,
            rival: 'Capitaine Le Gall',
            record: 1750,
            buff: 'Brittany Artichokes & Shallots have −20% HP',
            desc: 'Wind-swept Armorican granite coast warmed by the Gulf Stream—world-famous home of Brittany Globe Artichokes (Chevalier Artichaut) and Grey Shallots!',
            subTheme: 'brittany',
            crops: ['artichaut', 'echalote', 'lavender', 'carrot', 'radish', 'onion', 'cabbage', 'potato'],
          },
          {
            id: 'fr_agen',
            name: 'Agen (Garonne)',
            province: 'Nouvelle-Aquitaine · 44.2°N, 0.6°E',
            x: 345,
            y: 382,
            mul: 2.8,
            rival: 'Duc de Gascogne',
            record: 2400,
            buff: '+20% Charge Cleave shockwave damage',
            desc: 'Fertile alluvial terraces along the Garonne River—homeland of Musketeer Chevalier Artichaut, Diva Lavande, and Monsieur Échalote.',
            subTheme: 'gascogne',
            crops: ['artichaut', 'lavender', 'echalote', 'carrot', 'radish', 'golden', 'pumpkin', 'potato'],
          },
        ],
      },
      JP: {
        code: 'JP',
        name: 'Japan',
        subtitle: 'Sensei Daikon (Karate Radish), Rikishi Kabocha & Shinobi Wasabi',
        flag: '⛩️',
        envStyle: 'japan',
        worldLabelX: 868,
        worldLabelY: 168,
        worldPath: 'M 858,125 L 878,128 L 872,148 L 855,182 L 835,195 L 828,182 L 848,155 Z',
        countryOutline:
          'M 535,55 L 675,68 L 655,148 L 545,155 Z M 515,175 L 575,185 L 565,285 L 505,355 L 395,382 L 285,388 L 265,352 L 385,315 L 475,245 Z M 315,392 L 378,388 L 372,425 L 312,422 Z M 205,398 L 275,398 L 262,478 L 198,468 Z',
        geographicFeatures: [
          {
            type: 'mountain',
            name: 'Mount Fuji (3,776m)',
            path: 'M 445,335 L 475,295 L 505,335',
          },
          {
            type: 'water',
            name: 'Seto Inland Sea',
            path: 'M 285,375 Q 345,372 385,385',
          },
        ],
        cities: [
          {
            id: 'jp_shizuoka',
            name: 'Shizuoka (Mt. Fuji)',
            province: 'Chūbu · 35.0°N, 138.4°E',
            x: 478,
            y: 342,
            mul: 1.8,
            rival: 'Master Takahashi',
            record: 820,
            buff: 'Sensei Daikon, Kabocha & Wasabi pay +25% more',
            desc: 'Emerald terraced slopes & cold mountain streams at the foot of Mount Fuji—home to Sensei Daikon, sumo Rikishi Kabocha, and stealthy Shinobi Wasabi!',
            subTheme: 'fuji',
            crops: ['daikon', 'kabocha', 'wasabi', 'carrot', 'radish', 'cabbage', 'pumpkin', 'potato'],
          },
          {
            id: 'jp_kyoto',
            name: 'Kyoto (Kamo Basin)',
            province: 'Kansai · 35.0°N, 135.8°E',
            x: 388,
            y: 348,
            mul: 2.15,
            rival: 'Lady Murasaki',
            record: 1350,
            buff: '+15% Harvest Rush duration on all farms',
            desc: 'Historic misty valley surrounded by towering bamboo groves and vermilion torii gates—famed for Kyo-yasai Sensei Daikon, Shinobi Wasabi, and Rikishi Kabocha.',
            subTheme: 'kyoto',
            crops: ['wasabi', 'daikon', 'kabocha', 'carrot', 'radish', 'onion', 'cabbage', 'pumpkin'],
          },
          {
            id: 'jp_sapporo',
            name: 'Sapporo & Furano',
            province: 'Hokkaido · 43.1°N, 141.4°E',
            x: 592,
            y: 115,
            mul: 2.5,
            rival: 'Director Sato',
            record: 1950,
            buff: 'Rikishi Kabocha, Potatoes & Corn pay +20% more',
            desc: 'Wide northern volcanic plains in Hokkaido—renowned for sumo-sized Rikishi Kabocha winter squash, Sensei Daikon, and Shinobi Wasabi.',
            subTheme: 'hokkaido',
            crops: ['kabocha', 'daikon', 'wasabi', 'carrot', 'radish', 'golden', 'pumpkin', 'potato'],
          },
          {
            id: 'jp_aomori',
            name: 'Aomori (Tsugaru)',
            province: 'Tōhoku · 40.8°N, 140.7°E',
            x: 545,
            y: 196,
            mul: 2.85,
            rival: 'Elder Soma',
            record: 2650,
            buff: 'Frosty crops pay +$4 when cracked',
            desc: 'Crisp northern orchards and mountain-stream valleys where Shinobi Wasabi and Sensei Daikon train in the snow.',
            subTheme: 'tohoku',
            crops: ['daikon', 'wasabi', 'kabocha', 'carrot', 'radish', 'berry', 'cabbage', 'potato'],
          },
          {
            id: 'jp_kagoshima',
            name: 'Kagoshima (Sakurajima)',
            province: 'Kyūshū · 31.6°N, 130.6°E',
            x: 235,
            y: 448,
            mul: 3.25,
            rival: 'Lord Shimazu (Arthur’s Partner)',
            record: 3600,
            buff: '+25% scythe damage across all farms',
            desc: 'Mineral-rich black volcanic ash soil across the bay from smoking Sakurajima—dojo of Grandmaster Sensei Daikon and Rikishi Kabocha!',
            subTheme: 'sakurajima',
            crops: ['daikon', 'kabocha', 'wasabi', 'carrot', 'radish', 'golden', 'pumpkin', 'potato'],
          },
        ],
      },
    },
  };
  window.DBD_GEOGRAPHY = GEOGRAPHY; // CONCATENATED MODULE: ./.ts-build/data/skillTree.js
  // ============================================================================
  // Due by Dusk · v0.5.01 — Spatial Branching Skill Tree (DAG)
  // Every node costs 1 💎 Diamond (separate from Grit).
  // Features true forks, cross-links, and multi-path capstones on a 1000x580 canvas.
  // ============================================================================

  const SKILL_TREE_NODES = [
    // CENTRAL CORE ROOT (Unlocked by default or first 1-Diamond choice)
    {
      id: 'core_awakening',
      branch: 'core',
      name: "Harvester's Awakening",
      x: 500,
      y: 290,
      cost: 1,
      reqs: [],
      icon: '⚔️',
      summary: '+10% Scythe Damage & +1.0s Daylight',
      desc: 'Awakens the ancient Harvester Codex. Grants +10% base scythe damage and +1.0 second of daylight on every farm, and opens the three great branching wings: Reap, Soil, and Fortune.',
    },
    // ========================================================================
    // WING I: WAY OF THE REAP (West / Northwest — Forks into Speed vs. Cleave)
    // ========================================================================
    {
      id: 'reap_root',
      branch: 'reap',
      name: 'Honed Temper',
      x: 350,
      y: 245,
      cost: 1,
      reqs: ['core_awakening'],
      icon: '🗡️',
      summary: '+2 Base Scythe Damage',
      desc: 'Cold-forged high-carbon steel adds +2 flat base damage to every swing on all farms.',
    },
    // Fork A (Upper West): Speed & Dash-Slash Path
    {
      id: 'reap_swift',
      branch: 'reap',
      name: 'Mercurial Wrist',
      x: 215,
      y: 155,
      cost: 1,
      reqs: ['reap_root'],
      icon: '⚡',
      summary: '+18% Faster Swing Rate',
      desc: 'Counter-weighted ash handle increases your automatic swing rate by +18% across every farm.',
    },
    {
      id: 'reap_dash',
      branch: 'reap',
      name: 'Gale Dash-Slash',
      x: 95,
      y: 120,
      cost: 1,
      reqs: ['reap_swift'],
      icon: '🌪️',
      summary: 'Fast Swipes Emit Wind Waves',
      desc: 'Sweeping the sickle rapidly across the field emits a crescent wind wave that slices nearby crops for +50% bonus reach.',
    },
    // Fork B (Lower West): Heavy Charge Cleave Path
    {
      id: 'reap_cleave',
      branch: 'reap',
      name: 'Sundering Cleave',
      x: 215,
      y: 335,
      cost: 1,
      reqs: ['reap_root'],
      icon: '💥',
      summary: 'Charge Cleave +45% Faster & +25% Wider',
      desc: 'Holding click/touch or Spacebar charges your Cleave 45% faster and expands its shockwave radius by +25%.',
    },
    {
      id: 'reap_vortex',
      branch: 'reap',
      name: 'Whirlwind Echo',
      x: 95,
      y: 375,
      cost: 1,
      reqs: ['reap_cleave'],
      icon: '🌀',
      summary: 'Cleave Spawns a 1.8s Spinning Vortex',
      desc: 'Unleashing a Charge Cleave leaves behind a spinning golden blade vortex for 1.8 seconds that continuously chops crops.',
    },
    // Reap Capstone (Converges from either Dash-Slash OR Whirlwind Echo)
    {
      id: 'reap_exec',
      branch: 'reap',
      name: "Reaper's Verdict",
      x: 55,
      y: 248,
      cost: 1,
      reqs: ['reap_dash', 'reap_vortex'],
      reqMode: 'any',
      // Unlockable via EITHER upper or lower Reap sub-branch!
      icon: '👑',
      summary: 'Execute <25% HP Crops & Crit Chain Lightning',
      desc: 'Capstone: Any crop dropped below 25% HP is instantly executed, and critical hits arc golden lightning to 2 nearby crops.',
    },
    // ========================================================================
    // WING II: WAY OF THE SOIL (North / Northeast — Forks into Abundance vs. Seasons)
    // ========================================================================
    {
      id: 'soil_root',
      branch: 'soil',
      name: 'Living Humus',
      x: 545,
      y: 165,
      cost: 1,
      reqs: ['core_awakening'],
      icon: '🌱',
      summary: '+2 Max Field Crops & +12% Sprout Speed',
      desc: 'Mycorrhizal soil enrichment allows +2 additional crops on the field at once and speeds up sprouting by 12%.',
    },
    // Fork A (Upper North): Germination & Twin Crops Path
    {
      id: 'soil_twin',
      branch: 'soil',
      name: 'Twin Germination',
      x: 475,
      y: 72,
      cost: 1,
      reqs: ['soil_root'],
      icon: '🌿',
      summary: '22% Chance Crops Spawn in Pairs',
      desc: 'Whenever a new crop sprouts, there is a 22% chance a second bonus crop sprouts simultaneously beside it.',
    },
    {
      id: 'soil_dew',
      branch: 'soil',
      name: 'Dawn Abundance',
      x: 615,
      y: 48,
      cost: 1,
      reqs: ['soil_twin'],
      icon: '💧',
      summary: 'Start Every Day with +3 Ripe Crops',
      desc: 'Morning dew nourishes the field overnight so every day starts with +3 extra Stage-3 ripe crops ready to cut.',
    },
    // Fork B (East-Northeast): Daylight & Field Props Path
    {
      id: 'soil_sun',
      branch: 'soil',
      name: 'Longer Solstice',
      x: 695,
      y: 152,
      cost: 1,
      reqs: ['soil_root'],
      icon: '☀️',
      summary: '+2.0 Seconds of Daylight Every Day',
      desc: 'Extends the golden hour across every region, granting +2.0 seconds of extra harvesting time each day.',
    },
    {
      id: 'soil_bounty',
      branch: 'soil',
      name: 'Artisan Compost',
      x: 825,
      y: 120,
      cost: 1,
      reqs: ['soil_sun'],
      icon: '🧺',
      summary: 'Fertilizer Bags & Treats Spawn 2× Faster',
      desc: 'Sliceable Fertilizer Bags (+4 instant crops) and Clover Treats appear twice as often during the day.',
    },
    // Soil Capstone (Converges from Dawn Abundance OR Artisan Compost)
    {
      id: 'soil_eden',
      branch: 'soil',
      name: 'Perennial Bloom',
      x: 765,
      y: 45,
      cost: 1,
      reqs: ['soil_dew', 'soil_bounty'],
      reqMode: 'any',
      icon: '🌺',
      summary: '25% Chance Harvested Crops Instantly Regrow',
      desc: 'Capstone: Harvesting any Stage-3 crop has a 25% chance to immediately pop a fresh Stage-2 bud in its place.',
    },
    // ========================================================================
    // WING III: WAY OF FORTUNE (South / Southeast — Forks into Banking vs. Beasts)
    // ========================================================================
    {
      id: 'gold_root',
      branch: 'gold',
      name: "Merchant's Scale",
      x: 615,
      y: 385,
      cost: 1,
      reqs: ['core_awakening'],
      icon: '⚖️',
      summary: '+15% Crop Sell Value on All Farms',
      desc: 'Direct export contracts with regional markets increase the sell price of all harvested crops by +15%.',
    },
    // Fork A (South): Banking & Legal Defense against Arthur Grumble
    {
      id: 'gold_lawyer',
      branch: 'gold',
      name: 'Retained Counsel',
      x: 525,
      y: 492,
      cost: 1,
      reqs: ['gold_root'],
      icon: '📜',
      summary: 'All Bank Bills Cost 12% Less',
      desc: 'Your county lawyer audits Grumble & Sons, permanently reducing the amount required for every bank bill by 12%.',
    },
    {
      id: 'gold_interest',
      branch: 'gold',
      name: 'Compound Reserve',
      x: 685,
      y: 522,
      cost: 1,
      reqs: ['gold_lawyer'],
      icon: '🏦',
      summary: '+12% Overnight Interest on Saved Cash',
      desc: 'Earn +12% overnight interest (up to +$300/night) on unspent cash at the end of each day.',
    },
    // Fork B (Southeast): Pasture Beasts & Friendly Goat Herd
    {
      id: 'gold_treaty',
      branch: 'gold',
      name: 'Pasture Accord',
      x: 765,
      y: 365,
      cost: 1,
      reqs: ['gold_root'],
      icon: '🐐',
      summary: 'Goats Never Headbutt & Tip Cash Instead',
      desc: 'Permanently signs a peace treaty with the White Goat—it never steals daylight and tips you cash when touched.',
    },
    {
      id: 'gold_herd',
      branch: 'gold',
      name: 'Loyal Goat Herd',
      x: 895,
      y: 415,
      cost: 1,
      reqs: ['gold_treaty'],
      icon: '🔔',
      summary: 'Friendly Goats Harvest Crops FOR You',
      desc: 'The White Goat becomes your loyal farmhand, trotting through the field and headbutting crops to harvest them for you!',
    },
    // Fortune Capstone (Converges from Compound Reserve OR Loyal Goat Herd)
    {
      id: 'gold_midas',
      branch: 'gold',
      name: 'Sovereign Mint',
      x: 885,
      y: 518,
      cost: 1,
      reqs: ['gold_interest', 'gold_herd'],
      reqMode: 'any',
      icon: '💎',
      summary: 'Lucky & Regional Specialty Crops Pay +50%',
      desc: 'Capstone: Lucky crops, Golden Corn, and all regional specialty crops (Canola, Pineapple, Lavender, Daikon) pay +50% more.',
    },
  ];
  window.DBD_SKILL_TREE = {
    nodes: SKILL_TREE_NODES,
  }; // CONCATENATED MODULE: ./.ts-build/data/crops.js
  // ============================================================================
  // Due by Dusk · v0.6.10 — Baseline & 12 Cultural Veggie Characters Data
  // Includes 8 baseline vegetables + 12 country-authentic minimal vector
  // veggie characters (3 per playable country: Japan, Canada, Brazil, France)
  // ============================================================================

  const CROPS = {
    // 8 Baseline Crops
    radish: {
      name: 'Runaway Red Radish',
      hp: 3,
      val: 5,
      r: 16,
      top: 38,
      color: '#e11d48',
      light: '#fda4af',
      shade: '#881337',
      flesh: '#fff1f2',
      leaf: '#4ade80',
      leafDark: '#15803d',
      juice: '#fb7185',
      origin: 'All Regions',
    },
    carrot: {
      name: 'Gym-Bro Carrot',
      hp: 1,
      val: 1,
      r: 19,
      top: 42,
      color: '#f97316',
      light: '#fdba74',
      shade: '#9a3412',
      flesh: '#ffedd5',
      leaf: '#4ade80',
      leafDark: '#166534',
      juice: '#fb923c',
      origin: 'All Regions',
    },
    golden: {
      name: 'Bearded Sweet Corn',
      hp: 6,
      val: 18,
      r: 22,
      top: 46,
      color: '#facc15',
      light: '#fef08a',
      shade: '#a16207',
      flesh: '#fef9c3',
      leaf: '#22c55e',
      leafDark: '#15803d',
      juice: '#fde047',
      origin: 'Americas & Hokkaido',
    },
    onion: {
      name: 'Drama-Queen Onion',
      hp: 7,
      val: 7,
      r: 24,
      top: 46,
      color: '#a855f7',
      light: '#e9d5ff',
      shade: '#581c87',
      flesh: '#faf5ff',
      leaf: '#4ade80',
      leafDark: '#15803d',
      juice: '#c084fc',
      origin: 'Roscoff & Holland Marsh',
    },
    berry: {
      name: 'Briar-Berry Twins',
      hp: 9,
      val: 13,
      r: 25,
      top: 46,
      color: '#4f46e5',
      light: '#c7d2fe',
      shade: '#312e81',
      flesh: '#eef2ff',
      leaf: '#22c55e',
      leafDark: '#166534',
      juice: '#818cf8',
      origin: 'Okanagan & Loire',
    },
    cabbage: {
      name: 'Lord Cabbage',
      hp: 4,
      val: 3,
      r: 28,
      top: 44,
      color: '#4ade80',
      light: '#dcfce7',
      shade: '#14532d',
      flesh: '#f0fdf4',
      leaf: '#86efac',
      leafDark: '#166534',
      juice: '#86efac',
      origin: 'Temperate Regions',
    },
    potato: {
      name: 'Couch Potato',
      hp: 32,
      val: 22,
      r: 36,
      top: 58,
      color: '#d99b52',
      light: '#fae1b8',
      shade: '#6e4219',
      flesh: '#fef3c7',
      leaf: '#84cc16',
      leafDark: '#3f6212',
      juice: '#fde047',
      origin: 'Temperate Highlands',
    },
    pumpkin: {
      name: 'Grandma Pumpkin',
      hp: 12,
      val: 9,
      r: 44,
      top: 64,
      color: '#ff7a00',
      light: '#ffbe4f',
      shade: '#c2410c',
      flesh: '#ffedd5',
      leaf: '#65a30d',
      leafDark: '#365314',
      juice: '#fb923c',
      origin: 'North America & Hokkaido',
    },
    // ==========================================================================
    // 🇨🇳 CHINA — 3 Cultural Veggie Characters (Shaolin Bitter Melon, Sifu Bok Choy, Zen Lotus Root)
    // ==========================================================================
    bittermelon: {
      name: 'Shaolin Bitter Melon',
      hp: 10,
      val: 16,
      r: 26,
      top: 56,
      color: '#4ca82b',
      light: '#b6ef5a',
      shade: '#19520c',
      flesh: '#dcfce7',
      leaf: '#65a30d',
      leafDark: '#14532d',
      juice: '#86efac',
      origin: 'China (Warty Jade Bitter Melon · Shaolin Gong Monk)',
      unlockBill: 0,
    },
    bokchoy: {
      name: 'Sifu Bok Choy',
      hp: 9,
      val: 15,
      r: 26,
      top: 58,
      color: '#176d2c',
      light: '#ecfae5',
      shade: '#0a3816',
      flesh: '#f0fdf4',
      leaf: '#176d2c',
      leafDark: '#0a3816',
      juice: '#86efac',
      origin: 'China (Crisp Celadon Bok Choy · Kung-Fu Folding-Fan Master)',
      unlockBill: 0,
    },
    lotusroot: {
      name: 'Zen Lotus Root',
      hp: 11,
      val: 17,
      r: 26,
      top: 56,
      color: '#e3b273',
      light: '#f5d5a7',
      shade: '#8c5828',
      flesh: '#fef3c7',
      leaf: '#b8823c',
      leafDark: '#5c3412',
      juice: '#d97706',
      origin: 'China (7-Hole Pond Lotus Root · Bamboo-Hat Oolong Tea Sage)',
      unlockBill: 0,
    },
    // ==========================================================================
    // 🇲🇦 MOROCCO — 3 Cultural Veggie Characters (Hummus Chickpea, Zaalouk Eggplant, Beldi Green Olive)
    // ==========================================================================
    chickpea: {
      name: 'Hummus Chickpea',
      hp: 9,
      val: 15,
      r: 25,
      top: 56,
      color: '#f4ba3e',
      light: '#fde68a',
      shade: '#b45309',
      flesh: '#fef9c3',
      leaf: '#84cc16',
      leafDark: '#4d7c0f',
      juice: '#fef08a',
      origin: 'Morocco (Golden Garbanzo Bean · Marrakech Mint-Tea Host)',
      unlockBill: 0,
    },
    eggplant: {
      name: 'Zaalouk Eggplant',
      hp: 11,
      val: 17,
      r: 27,
      top: 58,
      color: '#7e22ce',
      light: '#c084fc',
      shade: '#3b0764',
      flesh: '#f3e8ff',
      leaf: '#d97742',
      leafDark: '#7c2d12',
      juice: '#facc15',
      origin: 'Morocco (Royal-Purple Aubergine · Souk Lantern Mystic)',
      unlockBill: 0,
    },
    olive: {
      name: 'Beldi Green Olive',
      hp: 10,
      val: 16,
      r: 25,
      top: 56,
      color: '#8da832',
      light: '#d9f99d',
      shade: '#3f6212',
      flesh: '#ecfccb',
      leaf: '#2563eb',
      leafDark: '#1e3a8a',
      juice: '#dc2626',
      origin: 'Morocco (Pimento-Stuffed Green Olive · Saharan Gnawa Drummer)',
      unlockBill: 0,
    },
    // ==========================================================================
    // 🤠 USA — 3 Cultural Veggie Characters (Sheriff Habanero, Quarterback Sweetcorn, Smokey Brisket-Onion)
    // ==========================================================================
    habanero: {
      name: 'Sheriff Habanero',
      hp: 10,
      val: 16,
      r: 25,
      top: 56,
      color: '#ea4c0f',
      light: '#ff7b24',
      shade: '#9a2204',
      flesh: '#ffedd5',
      leaf: '#22c55e',
      leafDark: '#15803d',
      juice: '#ef4444',
      origin: 'USA (Texas Habanero Pepper · Wild West Cowboy)',
      unlockBill: 0,
    },
    sweetcorn: {
      name: 'Quarterback Sweetcorn',
      hp: 12,
      val: 17,
      r: 26,
      top: 56,
      color: '#eab308',
      light: '#fde047',
      shade: '#854d0e',
      flesh: '#fef9c3',
      leaf: '#22c55e',
      leafDark: '#14532d',
      juice: '#facc15',
      origin: 'USA (Iowa Golden Sweet Corn · Football Linebacker)',
      unlockBill: 0,
    },
    brisket_onion: {
      name: 'Smokey Brisket-Onion',
      hp: 11,
      val: 15,
      r: 25,
      top: 56,
      color: '#ea8a2a',
      light: '#fcd34d',
      shade: '#9a3412',
      flesh: '#fffbeb',
      leaf: '#3ea322',
      leafDark: '#14532d',
      juice: '#38bdf8',
      origin: 'USA (Vidalia Sweet Onion · BBQ Pitmaster)',
      unlockBill: 0,
    },
    // ==========================================================================
    // ⛩️ JAPAN — 3 Cultural Veggie Characters
    // ==========================================================================
    daikon: {
      name: 'Sensei Daikon',
      hp: 9,
      val: 12,
      r: 25,
      top: 56,
      color: '#f8fafc',
      light: '#ffffff',
      shade: '#334155',
      flesh: '#ffffff',
      leaf: '#22c55e',
      leafDark: '#15803d',
      juice: '#e2e8f0',
      origin: 'Japan (Giant White Radish · Karate Master)',
      unlockBill: 0,
    },
    kabocha: {
      name: 'Rikishi Kabocha',
      hp: 15,
      val: 16,
      r: 31,
      top: 54,
      color: '#15803d',
      light: '#4ade80',
      shade: '#052e16',
      flesh: '#facc15',
      leaf: '#166534',
      leafDark: '#052e16',
      juice: '#fbbf24',
      origin: 'Japan (Japanese Winter Squash · Sumo Wrestler)',
      unlockBill: 0,
    },
    wasabi: {
      name: 'Shinobi Wasabi',
      hp: 6,
      val: 14,
      r: 21,
      top: 48,
      color: '#4ade80',
      light: '#bbf7d0',
      shade: '#064e3b',
      flesh: '#dcfce7',
      leaf: '#22c55e',
      leafDark: '#14532d',
      juice: '#4ade80',
      origin: 'Japan (Mountain Wasabi Root · Stealth Ninja)',
      unlockBill: 0,
    },
    // ==========================================================================
    // 🍁 CANADA — 3 Cultural Veggie Characters
    // ==========================================================================
    pei_russet: {
      name: 'Hoser Russet',
      hp: 12,
      val: 14,
      r: 28,
      top: 50,
      color: '#b45309',
      light: '#f59e0b',
      shade: '#451a03',
      flesh: '#fffbeb',
      leaf: '#65a30d',
      leafDark: '#365314',
      juice: '#f59e0b',
      origin: 'Canada (PEI Red-Clay Potato · Pro Hockey Enforcer)',
      unlockBill: 0,
    },
    fiddlehead: {
      name: 'Lumberjack Fiddlehead',
      hp: 7,
      val: 11,
      r: 23,
      top: 52,
      color: '#22c55e',
      light: '#86efac',
      shade: '#052e16',
      flesh: '#dcfce7',
      leaf: '#16a34a',
      leafDark: '#14532d',
      juice: '#4ade80',
      origin: 'Canada (New Brunswick Ostrich Fern · Flannel Bushman)',
      unlockBill: 0,
    },
    saskaberry: {
      name: 'Mountie Saskaberry',
      hp: 8,
      val: 13,
      r: 24,
      top: 52,
      color: '#6d28d9',
      light: '#c4b5fd',
      shade: '#2e1065',
      flesh: '#ede9fe',
      leaf: '#16a34a',
      leafDark: '#14532d',
      juice: '#a78bfa',
      origin: 'Canada (Saskatoon Berry Cluster · Polite Royal Mountie)',
      unlockBill: 0,
    },
    // ==========================================================================
    // 🌴 BRAZIL — 3 Cultural Veggie Characters
    // ==========================================================================
    abacaxi: {
      name: 'Carnavale Abacaxi',
      hp: 12,
      val: 15,
      r: 28,
      top: 60,
      color: '#f59e0b',
      light: '#fef08a',
      shade: '#78350f',
      flesh: '#fef3c7',
      leaf: '#10b981',
      leafDark: '#047857',
      juice: '#fbbf24',
      origin: 'Brazil (Pérola Pineapple · Samba Passista Dancer)',
      unlockBill: 0,
    },
    mandioca: {
      name: 'Ginga Mandioca',
      hp: 9,
      val: 12,
      r: 25,
      top: 52,
      color: '#92400e',
      light: '#d6b37c',
      shade: '#451a03',
      flesh: '#ffffff',
      leaf: '#22c55e',
      leafDark: '#14532d',
      juice: '#fef3c7',
      origin: 'Brazil (Amazonian Cassava Root · Capoeira Fighter)',
      unlockBill: 0,
    },
    guarana: {
      name: 'Craque Guaraná',
      hp: 6,
      val: 13,
      r: 22,
      top: 46,
      color: '#dc2626',
      light: '#fca5a5',
      shade: '#7f1d1d',
      flesh: '#ffffff',
      leaf: '#16a34a',
      leafDark: '#14532d',
      juice: '#ef4444',
      origin: 'Brazil (Amazonian Guaraná Berry · Football Superstar)',
      unlockBill: 0,
    },
    // ==========================================================================
    // ⚜️ FRANCE — 3 Cultural Veggie Characters
    // ==========================================================================
    echalote: {
      name: 'Monsieur Échalote',
      hp: 7,
      val: 12,
      r: 23,
      top: 50,
      color: '#9333ea',
      light: '#f3e8ff',
      shade: '#3b0764',
      flesh: '#faf5ff',
      leaf: '#4ade80',
      leafDark: '#15803d',
      juice: '#c084fc',
      origin: 'France (French Grey Shallot · Snobby Parisian Mime)',
      unlockBill: 0,
    },
    artichaut: {
      name: 'Chevalier Artichaut',
      hp: 13,
      val: 15,
      r: 28,
      top: 56,
      color: '#16a34a',
      light: '#86efac',
      shade: '#052e16',
      flesh: '#dcfce7',
      leaf: '#22c55e',
      leafDark: '#14532d',
      juice: '#4ade80',
      origin: 'France (Brittany Globe Artichoke · Pompous Musketeer)',
      unlockBill: 0,
    },
    lavender: {
      name: 'Diva Lavande',
      hp: 6,
      val: 11,
      r: 23,
      top: 54,
      color: '#8b5cf6',
      light: '#ddd6fe',
      shade: '#4c1d95',
      flesh: '#f5f3ff',
      leaf: '#64748b',
      leafDark: '#334155',
      juice: '#a78bfa',
      origin: 'France (Provence Lavender Bundle · Haute-Couture Perfume Snob)',
      unlockBill: 0,
    },
    // Legacy alias so any existing save referencing `canola` continues to work seamlessly
    canola: {
      name: 'Prairie Canola',
      hp: 5,
      val: 6,
      r: 22,
      top: 52,
      color: '#eab308',
      light: '#fef08a',
      shade: '#854d0e',
      flesh: '#fef9c3',
      leaf: '#16a34a',
      leafDark: '#14532d',
      juice: '#fde047',
      origin: 'Canada (Prairies & Ontario/Quebec)',
      unlockBill: 1,
    },
  };
  const REGIONAL_CHARACTER_ROSTER = [
    // China (CN)
    {
      id: 'bittermelon',
      country: 'CN',
      flag: '🇨🇳',
      countryName: 'China',
      name: 'Shaolin Bitter Melon',
      cropSubtitle: 'Warty Jade Bitter Melon',
      archetype: 'Shaolin Gong Monk',
      look: 'Bumpy jade-green bitter melon wearing a crimson martial-arts headband with fluttering tails, holding a brass temple gong and red padded mallet.',
      idleDesc:
        'Rhythmically taps his brass temple gong with a padded mallet while golden chime rings and musical notes (♪ ♫ ding) float upward.',
      gagTitle: 'AIYA! Gong & Mallet Scatter',
      gagDesc:
        'When hit, his base squashes into a wide warty puddle, his crimson headband pops airborne, and his brass gong (CLANG! CLANG!) and mallet (BAM!) fly off as he shouts AIYA!',
    },
    {
      id: 'bokchoy',
      country: 'CN',
      flag: '🇨🇳',
      countryName: 'China',
      name: 'Sifu Bok Choy',
      cropSubtitle: 'Crisp Celadon Bok Choy',
      archetype: 'Kung-Fu Fan Master',
      look: 'Plump celadon-white layered bulb with glossy dark-green spoon leaves, topped with a traditional black-and-red Mandarin skullcap (guapimo) and waving a crimson folding fan.',
      idleDesc:
        'Breathes serenely with half-lidded sifu eyes, resting one hand on his hip while gracefully waving a crimson paper folding fan.',
      gagTitle: 'AIYA! Fan Tumble & Leaf Splay',
      gagDesc:
        'When hit, his 5 dark-green spoon leaves splay wide in shock, his Mandarin skullcap flies off, and his crimson fan tumbles through the air as he cries AIYA!',
    },
    {
      id: 'lotusroot',
      country: 'CN',
      flag: '🇨🇳',
      countryName: 'China',
      name: 'Zen Lotus Root',
      cropSubtitle: '7-Hole Pond Lotus Root',
      archetype: 'Bamboo-Hat Tea Sage',
      look: 'Warm-tan cylindrical lotus root segment with 7 circular air-canal holes on its flat top cross-section, wearing a woven conical bamboo hat (douli) and sipping from a blue-and-white porcelain teacup.',
      idleDesc:
        'Sips hot oolong tea peacefully beneath his low woven bamboo hat as a fragrant white steam wisp curls into the air.',
      gagTitle: 'WAH! 7-Hole Steam Geyser',
      gagDesc:
        'When hit, his bamboo hat pops high into the air exposing all 7 lotus-root holes, white steam jets erupt straight out of the holes into a cloud, and amber tea splashes from his tipping porcelain cup!',
    },
    // Japan (JP)
    {
      id: 'daikon',
      country: 'JP',
      flag: '⛩️',
      countryName: 'Japan',
      name: 'Sensei Daikon',
      cropSubtitle: 'Giant White Radish',
      archetype: 'Karate Master',
      look: 'Crisp white tapered cylinder body, green topknot leaves, thick black karate belt tied around his waist with dangling ends, and stern \\ / eyebrows.',
      idleDesc: 'Breathes in a slow martial-arts horse stance while his black belt tails sway in the breeze.',
      gagTitle: 'Fights Back',
      gagDesc:
        'When hit, his face turns bright red, he lets out a tiny "KIAI!", and punches/side-kicks back at your scythe—slightly knocking your cursor back if you don\'t slice him fast!',
    },
    {
      id: 'kabocha',
      country: 'JP',
      flag: '⛩️',
      countryName: 'Japan',
      name: 'Rikishi Kabocha',
      cropSubtitle: 'Japanese Winter Squash',
      archetype: 'Sumo Wrestler',
      look: 'Wide, squat, dark-green ribbed squash with a glossy black chonmage (topknot) stem and a thick white-and-red mawashi sumo loincloth belt.',
      idleDesc: 'Rocks side-to-side doing ceremonial sumo leg stomps (shiko) that kick up tiny dirt puffs.',
      gagTitle: 'Belly Bounce',
      gagDesc:
        'When hit, he puffs his cheeks, scowls, and thrusts his belly out (tsuppari palm thrust), bouncing your blade off with a heavy drum DON! sound and taking half knockback.',
    },
    {
      id: 'wasabi',
      country: 'JP',
      flag: '⛩️',
      countryName: 'Japan',
      name: 'Shinobi Wasabi',
      cropSubtitle: 'Mountain Wasabi Root',
      archetype: 'Stealth Ninja',
      look: 'Knobbly bright-green rhizome root wearing a minimal black ninja cowl/headband with only two intense squinting eyes peeking through the slit.',
      idleDesc: 'Glances left and right rapidly, holding a tiny leaf like a kunai dagger.',
      gagTitle: 'Smoke Bomb Teleport',
      gagDesc:
        'When hit, he flashes angry red, throws a spicy green wasabi smoke puff, and teleports a short distance away while sneezing spicy green sparks!',
    },
    // Canada (CA)
    {
      id: 'pei_russet',
      country: 'CA',
      flag: '🍁',
      countryName: 'Canada',
      name: 'Hoser Russet',
      cropSubtitle: 'PEI Red-Clay Potato',
      archetype: 'Pro Hockey Enforcer',
      look: 'Chunky russet oval wearing a red-and-white hockey headband, a famous missing-front-tooth grin, and holding a tiny twig like a hockey stick.',
      idleDesc: "Taps his mini twig hockey stick on the dirt like he's waiting for a face-off.",
      gagTitle: 'Drops the Gloves',
      gagDesc:
        'When hit, he spits out a tooth, his eyebrows slam down, and he slap-shots a tiny dirt clod puck at your cursor while yelling "Sor-ry, eh!"',
    },
    {
      id: 'fiddlehead',
      country: 'CA',
      flag: '🍁',
      countryName: 'Canada',
      name: 'Lumberjack Fiddlehead',
      cropSubtitle: 'New Brunswick Ostrich Fern',
      archetype: 'Flannel Bushman',
      look: 'Tightly coiled bright-green spiral fern wearing a red-and-black buffalo-plaid trapper hat with earflaps and a thick brown pinecone-bristle beard.',
      idleDesc: 'Flexes his coiled stem like a bicep and puffs warm white breath clouds into the cold air.',
      gagTitle: 'Spiral Spring-Back',
      gagDesc:
        'When hit, his trapper-hat earflaps fly straight up, his spiral body uncoils like a spring to smack at the scythe, and snaps back with a loud BOING!',
    },
    {
      id: 'saskaberry',
      country: 'CA',
      flag: '🍁',
      countryName: 'Canada',
      name: 'Mountie Saskaberry',
      cropSubtitle: 'Saskatoon Berry Cluster',
      archetype: 'Polite Royal Mountie',
      look: 'Plump purple berry wearing an iconic wide-brimmed tan Stetson campaign hat with a chin strap and a stiff, upright "by-the-book" posture.',
      idleDesc: 'Tips his Stetson hat politely and whistles a cheerful tune.',
      gagTitle: 'Whistle & Ticket',
      gagDesc:
        'When hit, his hat spins in mid-air, his face turns beet-purple, and he blows a shrill brass whistle while waving a tiny red "UNLAWFUL HARVEST" ticket at you!',
    },
    // Brazil (BR)
    {
      id: 'abacaxi',
      country: 'BR',
      flag: '🌴',
      countryName: 'Brazil',
      name: 'Carnavale Abacaxi',
      cropSubtitle: 'Pérola Pineapple',
      archetype: 'Samba Passista Dancer',
      look: 'Golden diamond-grid oval with an extravagant, colorful feathered Carnival headdress sprouting from its leafy crown and flashy neon sunglasses.',
      idleDesc: 'Grooves rhythmically side-to-side in a non-stop samba hip-shake with floating musical notes.',
      gagTitle: 'Maraca Frenzy',
      gagDesc:
        'When hit, the sunglasses drop down to reveal wide furious eyes, and it shakes its spiky crown like maracas in a high-speed blur while samba-stepping away!',
    },
    {
      id: 'mandioca',
      country: 'BR',
      flag: '🌴',
      countryName: 'Brazil',
      name: 'Ginga Mandioca',
      cropSubtitle: 'Amazonian Cassava Root',
      archetype: 'Capoeira Fighter',
      look: 'Lean, woody-brown tapered root wearing white capoeira cordão rope pants around its base and a bright yellow-and-green headband.',
      idleDesc: 'Rocks back and forth in a smooth, rhythmic ginga martial-arts dance sway.',
      gagTitle: 'Upside-Down Handstand Kick',
      gagDesc:
        'When hit, it flips upside-down onto its leafy hands and spins a 360° capoeira meia-lua kick with its root tip!',
    },
    {
      id: 'guarana',
      country: 'BR',
      flag: '🌴',
      countryName: 'Brazil',
      name: 'Craque Guaraná',
      cropSubtitle: 'Amazonian Guaraná Berry',
      archetype: 'Football (Soccer) Superstar',
      look: 'Bright red split berry whose natural black seed-and-white aril center looks like a giant hyper-caffeinated eyeball, wearing a yellow #10 band.',
      idleDesc: 'Bounces up and down juggling a tiny pebble on its "foot" like a soccer ball.',
      gagTitle: 'Dramatic Flop & Red Card',
      gagDesc:
        'When hit, it gasps, dives dramatically onto its side clutching its "shin", and then pops up furious waving a tiny Red Card at your scythe!',
    },
    // France (FR)
    {
      id: 'echalote',
      country: 'FR',
      flag: '⚜️',
      countryName: 'France',
      name: 'Monsieur Échalote',
      cropSubtitle: 'French Grey Shallot',
      archetype: 'Snobby Parisian Mime / Artist',
      look: 'Sleek coppery-purple teardrop bulb wearing a tilted black beret, a thin pencil-twist mustache, and a red neck kerchief.',
      idleDesc: 'Blinks slowly with half-lidded, unimpressed eyes and puffs a tiny bubble pipe.',
      gagTitle: 'Invisible Glass Box & Baguette',
      gagDesc:
        'When hit, he gasps "Sacré bleu!", slams his hands against an "invisible mime wall" (briefly blocking 1 hit of damage), and swings a tiny baguette back!',
    },
    {
      id: 'artichaut',
      country: 'FR',
      flag: '⚜️',
      countryName: 'France',
      name: 'Chevalier Artichaut',
      cropSubtitle: 'Brittany Globe Artichoke',
      archetype: 'Pompous Musketeer',
      look: 'Layered green-scale globe wearing a feathered cavalier hat and a tiny curled white goatee—built like a round medieval knight in green armor.',
      idleDesc: 'Stands proudly with his chin up, twirling his pointy leaf tip like a fencing rapier.',
      gagTitle: 'En Garde Parry',
      gagDesc:
        'When hit, his armor scales bristle outward, he shouts "En garde!", and lunges forward with a rapid fencing thrust before his outer leaves pop off one by one!',
    },
    {
      id: 'lavender',
      country: 'FR',
      flag: '⚜️',
      countryName: 'France',
      name: 'Diva Lavande',
      cropSubtitle: 'Provence Lavender Bundle',
      archetype: 'Haute-Couture Perfume Snob',
      look: 'Cinched purple flower sheaf wearing oversized cat-eye designer sunglasses and a silk tricolore ribbon bow around its waist.',
      idleDesc: 'Fans itself dainty-style and wafts little purple sparkle clouds into the air.',
      gagTitle: 'Perfume Spritzer Counter',
      gagDesc:
        'When hit, it shrieks in offense and sprays a cloud of purple lavender perfume at your scythe, making the screen briefly sparkle!',
    },
  ];
  window.DBD_CROPS = CROPS;
  window.DBD_REGIONAL_ROSTER = REGIONAL_CHARACTER_ROSTER;
  const GAZETTE_EVENTS = [
    {
      id: 'market',
      title: 'COUNTY MARKET BOOM',
      desc: 'All crops sell for +25% today. Clear skies.',
      weather: 'clear',
      valMul: 1.25,
    },
    {
      id: 'gale',
      title: 'AUTUMN GALE WINDS',
      desc: 'Blowing leaves! Hold click/Space: Charge Cleave 2× faster.',
      weather: 'wind',
      chargeFast: 2.0,
    },
    {
      id: 'rain',
      title: 'WARM HARVEST SHOWERS',
      desc: 'Summer rain! Crops sprout 35% faster.',
      weather: 'rain',
      spawnFast: 1.35,
    },
    {
      id: 'frost',
      title: 'SNAP MORNING FROST',
      desc: 'Frosty morning! Cracking ice on crops pays +$2 bonus.',
      weather: 'frost',
      frost: true,
    },
    {
      id: 'fair',
      title: 'GRANDMA CROCHET FAIR',
      desc: 'Pumpkins & Drama Onions pay +35% today!',
      weather: 'clear',
      pumpkinBonus: 1.35,
    },
    {
      id: 'stampede',
      title: 'PASTURE STAMPEDE',
      desc: 'Restless goat day! Clover Treats & Fertilizer spawn more.',
      weather: 'wind',
      propBoost: 1.8,
    },
  ];
  const BILLS = [
    {
      name: 'Seed loan',
      amt: 20,
      days: 3,
      note: 'For the carrot seeds. We trust you. Mostly.',
    },
    {
      name: 'New fence',
      amt: 60,
      days: 4,
      note: 'Your goat ate the old one. The goat denies this.',
    },
    {
      name: 'Tractor transmission',
      amt: 180,
      days: 4,
      note: 'It only drives in reverse now. Charming, but no.',
    },
    {
      name: 'Pond water rights',
      amt: 500,
      days: 4,
      note: 'The ducks have retained counsel.',
    },
    {
      name: 'Barn roof',
      amt: 1300,
      days: 4,
      note: 'The pigeons have filed a formal complaint.',
    },
    {
      name: "Grandma's pie insurance",
      amt: 3200,
      days: 5,
      note: 'Required by the county fair. Do not ask why.',
    },
    {
      name: 'Property tax',
      amt: 8500,
      days: 5,
      note: 'The county noticed you are doing well.',
    },
    {
      name: "The scarecrow's lawyer",
      amt: 30000,
      days: 6,
      note: 'He is suing for back pay. He has a point.',
    },
    {
      name: 'The deed',
      amt: 90000,
      days: 7,
      note: 'Pay this and the farm is yours. Forever. Probably.',
    },
  ];
  const SHED = [
    {
      id: 'scythe',
      name: 'Sharper scythe',
      base: 8,
      g: 1.86,
      max: 12,
      show: (s) => `${s.dmg} damage`,
    },
    {
      id: 'swing',
      name: 'Wider swing',
      base: 12,
      g: 1.88,
      max: 8,
      show: (s) => `size ${Math.round(s.R)}`,
    },
    {
      id: 'hands',
      name: 'Quicker hands',
      base: 14,
      g: 1.88,
      max: 8,
      show: (s) => `${s.tick.toFixed(1)} swings/s`,
    },
    {
      id: 'days',
      name: 'Longer days',
      base: 18,
      g: 1.9,
      max: 8,
      show: (s) => `${s.day.toFixed(1).replace(/\.0$/, '')} s of light`,
    },
    {
      id: 'soil',
      name: 'Richer soil',
      base: 16,
      g: 1.86,
      max: 8,
      show: (s) => `${s.max} crops at once`,
    },
    {
      id: 'market',
      name: "Farmers' market",
      base: 25,
      g: 1.9,
      max: 10,
      show: (s) => `prices ×${s.vm.toFixed(2)}`,
    },
    {
      id: 'clover',
      name: 'Lucky clover',
      base: 30,
      g: 1.95,
      max: 6,
      show: (s) => `${Math.round(s.cc * 100)}% crit chance`,
    },
  ];
  const ALMANAC = [0, 30, 120, 400, 1200, 3500];
  const HEIRS = [
    {
      id: 'boots',
      name: "Grandpa's boots",
      base: 4,
      g: 2.1,
      max: 8,
      line: () => '+1 s of daylight per level',
    },
    {
      id: 'calloused',
      name: 'Calloused hands',
      base: 5,
      g: 2.1,
      max: 8,
      line: () => '+1 damage per level',
    },
    {
      id: 'hat',
      name: 'Big straw hat',
      base: 4,
      g: 2.2,
      max: 6,
      line: () => 'Swing 8% wider per level',
    },
    {
      id: 'almanac',
      name: "Farmer's almanac",
      base: 3,
      g: 2.4,
      max: 5,
      line: (l) => (l >= 5 ? `Every farm starts with $${ALMANAC[5]}` : `Start each farm with $${ALMANAC[l + 1]}`),
    },
    {
      id: 'horseshoe',
      name: 'Lucky horseshoe',
      base: 6,
      g: 2.2,
      max: 5,
      line: () => '+3% crit and more golden corn',
    },
    {
      id: 'rooster',
      name: 'Loud rooster',
      base: 5,
      g: 2.2,
      max: 6,
      line: () => '+0.5 swings per second',
    },
    {
      id: 'cousin',
      name: "Cousin Dale's discount",
      base: 6,
      g: 2.3,
      max: 5,
      line: () => 'Shed prices 5% lower per level',
    },
  ];
  const PERKS = [
    {
      id: 'spite',
      name: 'Spite-sharpened',
      line: '+2 scythe damage.',
    },
    {
      id: 'coffee',
      name: 'Second coffee',
      line: '+1 swing per second.',
    },
    {
      id: 'elbow',
      name: 'Elbow room',
      line: 'Your swing is 20% wider.',
    },
    {
      id: 'saving',
      name: 'Daylight saving',
      line: '+2 s of daylight.',
    },
    {
      id: 'fever',
      name: 'Market fever',
      line: 'Crop prices +25% per stack.',
    },
    {
      id: 'clover',
      name: 'Four-leaf clover',
      line: '+8% crit chance.',
    },
    {
      id: 'hungry',
      name: 'Hungry soil',
      line: '4 more crops on the field.',
    },
    {
      id: 'combo',
      name: 'Combo farmer',
      line: 'Keep your chain for 3 seconds instead of 2. One per farm.',
      once: true,
    },
    {
      id: 'heavy',
      name: 'Heavy swing',
      line: 'Crits hit 5× instead of 3×. One per farm.',
      once: true,
    },
    {
      id: 'whisper',
      name: 'Radish whisperer',
      line: 'Radishes run half as fast and sell for 50% more.',
      once: true,
      req: (f) => f.billsPaid >= 3,
    },
    {
      id: 'treaty',
      name: 'Goat treaty',
      line: 'The goat stops headbutting you and tips you instead.',
      once: true,
      req: (f) => f.billsPaid >= 2,
    },
    {
      id: 'gold',
      name: 'Gold fever',
      line: '+4% chance of golden corn.',
      req: (f) => f.billsPaid >= 4,
    },
    {
      id: 'storm',
      name: 'Storm scythe',
      line: 'Crits chain golden lightning to 2 nearby crops. One per farm.',
      once: true,
    },
    {
      id: 'cleaver',
      name: 'Cleaver mastery',
      line: 'Hold click/Space: Charge Cleave charges 50% faster and hits wider.',
      once: true,
    },
  ];
  const SHED_IDS = SHED.map((d) => d.id);
  const HEIR_IDS = HEIRS.map((d) => d.id); // CONCATENATED MODULE: ./.ts-build/systems/SaveSystem.js
  // ============================================================================
  // Due by Dusk · v0.6.00 — Versioned Save & Migration System (`src/systems/SaveSystem.ts`)
  //
  // Features:
  // 1. Versioned Save Schema (`schemaVersion: 2`, stored under `due-by-dusk-v2`).
  // 2. Automatic Pre-Migration Backup: Before transforming any legacy `due-by-dusk-v1`
  //    save or user-imported JSON payload, stores an untouched verbatim copy in
  //    `due-by-dusk-v1-backup` (and downloadable backup slot).
  // 3. Idempotent Migration (`migrateToV2`): Safe to run multiple times on the same
  //    save without duplicating Diamonds, double-refunding Grit, or resetting progress.
  // 4. Legacy Grit-Funded Skill Handling (`v0.4.01` `meta.skills`):
  //    - Maps legacy Grit skill IDs (`reap_1..3`, `soil_1..3`, `gold_1..3`) to their
  //      corresponding v0.6.00 spatial skill tree IDs (`reap_swift`, `reap_vortex`,
  //      `reap_exec`, `soil_dew`, `soil_twin`, `soil_bounty`, `gold_lawyer`,
  //      `gold_herd`, `gold_midas`, plus `core_awakening`).
  //    - Refunds 100% of the Grit originally spent on those legacy skills
  //      (`reap_1/soil_1/gold_1` = 3 Grit, `*_2` = 6 Grit, `*_3` = 12 Grit) back into
  //      `meta.grit` so Grit is never lost when moving to the 1-Diamond skill tree!
  // 5. Export Save / Import Save Route: Allows transferring saves across `file://`
  //    and `http://localhost` origins via JSON file download/upload or clipboard paste.
  // ============================================================================

  // The app keeps the farm run under its own keys; the shell mirrors every write to native storage.
  const SAVE_KEY_V2 = 'dbd-farm-v3';
  const SAVE_KEY_V1 = 'dbd-farm-v3-mirror';
  const BACKUP_KEY_V1 = 'dbd-farm-v3-backup';

  // Legacy v0.4.01 Grit skill mapping & original Grit costs for full refund
  const LEGACY_SKILL_MAP = {
    reap_1: {
      newId: 'reap_swift',
      gritCost: 3,
    },
    reap_2: {
      newId: 'reap_vortex',
      gritCost: 6,
    },
    reap_3: {
      newId: 'reap_exec',
      gritCost: 12,
    },
    soil_1: {
      newId: 'soil_dew',
      gritCost: 3,
    },
    soil_2: {
      newId: 'soil_twin',
      gritCost: 6,
    },
    soil_3: {
      newId: 'soil_bounty',
      gritCost: 12,
    },
    gold_1: {
      newId: 'gold_lawyer',
      gritCost: 3,
    },
    gold_2: {
      newId: 'gold_herd',
      gritCost: 6,
    },
    gold_3: {
      newId: 'gold_midas',
      gritCost: 12,
    },
  };

  // Legacy v0.4.01 4-biome index -> v0.6.00 Country & City mapping
  const LEGACY_BIOME_MAP = [
    {
      country: 'CA',
      cityId: 'ca_toronto',
    },
    {
      country: 'BR',
      cityId: 'br_petrolina',
    },
    {
      country: 'FR',
      cityId: 'fr_avignon',
    },
    {
      country: 'JP',
      cityId: 'jp_shizuoka',
    },
  ];
  function num(v, def = 0) {
    return typeof v === 'number' && isFinite(v) ? v : def;
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function blankMap(ids) {
    const o = {};
    ids.forEach((k) => (o[k] = 0));
    return o;
  }
  function createDefaultMeta() {
    return {
      grit: 0,
      diamonds: 2,
      learnedSkills: [],
      heir: blankMap(HEIR_IDS),
      lost: 0,
      owned: 0,
      best: 0,
      sound: true,
      country: 'CN',
      cityId: 'cn_guilin',
      cityRecords: {},
      cityOwned: {},
    };
  }
  function createNewFarm(meta) {
    return {
      no: meta.lost + meta.owned + 1,
      day: 1,
      cash: ALMANAC[meta.heir.almanac] || 0,
      shed: blankMap(SHED_IDS),
      perks: [],
      bill: 0,
      due: BILLS[0].days,
      paidTotal: 0,
      billsPaid: 0,
      lastEarn: 0,
      lastCount: 0,
      played: false,
      earned: 0,
      harvested: 0,
      pendingPerks: null,
      lastBest: 0,
      lastBonus: 0,
      bestChain: 0,
    };
  }
  class SaveSystem {
    static lastMigrationReport = null;
    static memoryStore = {};
    static setItem(key, val) {
      this.memoryStore[key] = val;
      try {
        localStorage.setItem(key, val);
      } catch (_e) {}
      if (window.__dbdPersist) window.__dbdPersist(key, val);
    }
    static getItem(key) {
      try {
        const v = localStorage.getItem(key);
        if (v !== null) return v;
      } catch (_e) {}
      return this.memoryStore[key] ?? null;
    }
    static getLastMigrationReport() {
      return this.lastMigrationReport;
    }

    /**
     * Preserves a verbatim backup of raw save JSON before any migration or import transformation.
     */
    static writeBackup(rawJson) {
      try {
        this.setItem(BACKUP_KEY_V1, rawJson);
      } catch (_e) {
        // Ignore storage quota errors
      }
    }
    static getBackupJson() {
      try {
        return this.getItem(BACKUP_KEY_V1);
      } catch (_e) {
        return null;
      }
    }

    /**
     * Idempotent migration from any v1 (v0.3 / v0.4.01 / v0.5.01) or v2 save object
     * into a validated SavePayloadV2 object.
     * Running migrateToV2(migrateToV2(raw)) produces the exact same state without
     * duplicating Diamonds or re-refunding Grit.
     */
    static migrateToV2(raw) {
      if (!raw || typeof raw !== 'object' || !raw.meta || !raw.farm) {
        return null;
      }
      const alreadyV2 = raw.schemaVersion === 2 && typeof raw.migrationId === 'string';
      const rawMeta = raw.meta;
      const rawFarm = raw.farm;
      let grit = Math.max(0, Math.floor(num(rawMeta.grit, 0)));
      let gritRefunded = 0;
      const legacyConverted = [];
      const notes = [];

      // 1. Collect valid learned skills
      const skillSet = new Set();
      if (Array.isArray(rawMeta.learnedSkills)) {
        for (const id of rawMeta.learnedSkills) {
          if (SKILL_TREE_NODES.some((n) => n.id === id)) {
            skillSet.add(id);
          }
        }
      }

      // 2. If migrating from v1 with legacy Grit-funded `meta.skills`, convert skills AND refund Grit once!
      if (!alreadyV2 && Array.isArray(rawMeta.skills) && rawMeta.skills.length > 0) {
        skillSet.add('core_awakening');
        for (const oldId of rawMeta.skills) {
          const mapped = LEGACY_SKILL_MAP[oldId];
          if (mapped) {
            skillSet.add(mapped.newId);
            gritRefunded += mapped.gritCost;
            legacyConverted.push(`${oldId} -> ${mapped.newId} (+${mapped.gritCost} Grit refunded)`);
          }
        }
        if (gritRefunded > 0) {
          grit += gritRefunded;
          notes.push(
            `Refunded ${gritRefunded} Grit from ${legacyConverted.length} legacy v0.4 skill(s) and mapped them to the v0.6 skill tree.`,
          );
        }
      }

      // 3. Determine Diamonds balance (idempotent: never re-adds milestone diamonds if already present)
      let diamonds = 2;
      let diamondsGranted = 0;
      if (typeof rawMeta.diamonds === 'number' && isFinite(rawMeta.diamonds)) {
        diamonds = Math.max(0, Math.floor(rawMeta.diamonds));
      } else {
        const billsPaid = clamp(Math.floor(num(rawFarm.billsPaid, 0)), 0, BILLS.length);
        const ownedCount = Math.max(0, Math.floor(num(rawMeta.owned, 0)));
        diamondsGranted = 2 + Math.floor(billsPaid / 2) + ownedCount * 2;
        diamonds = diamondsGranted;
        notes.push(
          `Initialized ${diamonds} Diamonds from progression (${billsPaid} bills paid, ${ownedCount} farms owned).`,
        );
      }

      // 4. Preserve & migrate geographical Country, City, Records & Deeds
      let country = 'CN';
      if (rawMeta.country && GEOGRAPHY.countries[rawMeta.country]) {
        country = rawMeta.country;
      } else if (typeof rawMeta.biome === 'number') {
        const bIdx = clamp(Math.floor(rawMeta.biome), 0, 3);
        country = LEGACY_BIOME_MAP[bIdx].country;
      }
      const countryObj = GEOGRAPHY.countries[country];
      let cityId = countryObj.cities[0].id;
      if (rawMeta.cityId && countryObj.cities.some((c) => c.id === rawMeta.cityId)) {
        cityId = rawMeta.cityId;
      }
      const cityRecords =
        rawMeta.cityRecords && typeof rawMeta.cityRecords === 'object'
          ? {
              ...rawMeta.cityRecords,
            }
          : {};
      const cityOwned =
        rawMeta.cityOwned && typeof rawMeta.cityOwned === 'object'
          ? {
              ...rawMeta.cityOwned,
            }
          : {};

      // Map v0.4.01 `ownedWorlds` and `bestDaily` arrays if present
      if (!alreadyV2) {
        if (Array.isArray(rawMeta.ownedWorlds)) {
          rawMeta.ownedWorlds.forEach((owned, idx) => {
            if (owned && LEGACY_BIOME_MAP[idx]) {
              cityOwned[LEGACY_BIOME_MAP[idx].cityId] = true;
            }
          });
        }
        if (Array.isArray(rawMeta.bestDaily)) {
          rawMeta.bestDaily.forEach((rec, idx) => {
            if (rec > 0 && LEGACY_BIOME_MAP[idx]) {
              const cid = LEGACY_BIOME_MAP[idx].cityId;
              cityRecords[cid] = Math.max(cityRecords[cid] || 0, Math.floor(num(rec, 0)));
            }
          });
        }
      }

      // 5. Sanitize Heirlooms
      const heir = blankMap(HEIR_IDS);
      HEIRS.forEach((h) => {
        heir[h.id] = clamp(Math.floor(num(rawMeta.heir && rawMeta.heir[h.id], 0)), 0, h.max);
      });
      const meta = {
        grit,
        diamonds,
        learnedSkills: Array.from(skillSet),
        heir,
        lost: Math.max(0, Math.floor(num(rawMeta.lost, 0))),
        owned: Math.max(0, Math.floor(num(rawMeta.owned, 0))),
        best: Math.max(0, Math.floor(num(rawMeta.best, 0))),
        sound: rawMeta.sound !== false,
        country,
        cityId,
        cityRecords,
        cityOwned,
      };

      // 6. Sanitize Farm state
      const shed = blankMap(SHED_IDS);
      SHED.forEach((s) => {
        shed[s.id] = clamp(Math.floor(num(rawFarm.shed && rawFarm.shed[s.id], 0)), 0, s.max);
      });
      const pendingPerks = Array.isArray(rawFarm.pendingPerks)
        ? rawFarm.pendingPerks.filter((p) => PERKS.some((x) => x.id === p))
        : null;
      const farm = {
        no: Math.max(1, Math.floor(num(rawFarm.no, 1))),
        day: Math.max(1, Math.floor(num(rawFarm.day, 1))),
        cash: Math.max(0, num(rawFarm.cash, 0)),
        shed,
        perks: Array.isArray(rawFarm.perks) ? rawFarm.perks.filter((p) => PERKS.some((x) => x.id === p)) : [],
        bill: clamp(Math.floor(num(rawFarm.bill, 0)), 0, BILLS.length - 1),
        due: num(rawFarm.due, BILLS[0].days),
        paidTotal: Math.max(0, num(rawFarm.paidTotal, 0)),
        billsPaid: clamp(Math.floor(num(rawFarm.billsPaid, 0)), 0, BILLS.length),
        lastEarn: Math.max(0, num(rawFarm.lastEarn, 0)),
        lastCount: Math.max(0, Math.floor(num(rawFarm.lastCount, 0))),
        played: !!rawFarm.played,
        earned: Math.max(0, num(rawFarm.earned, 0)),
        harvested: Math.max(0, Math.floor(num(rawFarm.harvested, 0))),
        pendingPerks: pendingPerks && pendingPerks.length ? pendingPerks : null,
        lastBest: Math.max(0, Math.floor(num(rawFarm.lastBest, 0))),
        lastBonus: Math.max(0, num(rawFarm.lastBonus, 0)),
        bestChain: Math.max(0, Math.floor(num(rawFarm.bestChain, 0))),
      };
      const report =
        alreadyV2 && raw.migrationReport
          ? raw.migrationReport
          : {
              fromVersion: alreadyV2 ? 2 : 1,
              toVersion: 2,
              migratedAt: new Date().toISOString(),
              gritRefundedFromLegacySkills: gritRefunded,
              legacySkillsConverted: legacyConverted,
              diamondsGrantedFromMilestones: diamondsGranted,
              backupKey: BACKUP_KEY_V1,
              notes: notes.length ? notes : ['Migrated save schema to v2 cleanly with all progress preserved.'],
            };
      this.lastMigrationReport = report;
      return {
        schemaVersion: 2,
        migrationId: alreadyV2 ? raw.migrationId : `mig_v2_${Date.now()}`,
        migrationReport: report,
        meta,
        farm,
      };
    }

    /**
     * Loads `due-by-dusk-v2` if available; otherwise backs up and migrates `due-by-dusk-v1`.
     */
    static loadOrMigrate() {
      try {
        const v2Raw = this.getItem(SAVE_KEY_V2);
        if (v2Raw) {
          const parsed = JSON.parse(v2Raw);
          const migrated = this.migrateToV2(parsed);
          if (migrated) return migrated;
        }
        const v1Raw = this.getItem(SAVE_KEY_V1);
        if (v1Raw) {
          // Backup raw v1 payload before transforming
          this.writeBackup(v1Raw);
          const parsedV1 = JSON.parse(v1Raw);
          const migratedV1 = this.migrateToV2(parsedV1);
          if (migratedV1) {
            this.save(migratedV1.meta, migratedV1.farm, migratedV1.migrationId, migratedV1.migrationReport);
            return migratedV1;
          }
        }
      } catch (_e) {
        // Fallback to fresh save
      }
      const meta = createDefaultMeta();
      const farm = createNewFarm(meta);
      return {
        schemaVersion: 2,
        migrationId: `fresh_v2_${Date.now()}`,
        meta,
        farm,
      };
    }

    /**
     * Saves both `due-by-dusk-v2` and a backward-compatible `due-by-dusk-v1` mirror.
     */
    static save(meta, farm, migrationId = 'live_v2', migrationReport) {
      const payload = {
        schemaVersion: 2,
        migrationId,
        migrationReport: migrationReport || this.lastMigrationReport || undefined,
        meta,
        farm,
      };
      try {
        const json = JSON.stringify(payload);
        this.setItem(SAVE_KEY_V2, json);
        this.setItem(SAVE_KEY_V1, json);
      } catch (_e) {
        // Storage unavailable
      }
      return payload;
    }

    /**
     * Exports the current v2 save as a formatted JSON string for file download or clipboard transfer.
     */
    static exportSaveJson(meta, farm) {
      const payload = {
        schemaVersion: 2,
        migrationId: `export_v2_${Date.now()}`,
        migrationReport: this.lastMigrationReport || undefined,
        meta,
        farm,
      };
      return JSON.stringify(payload, null, 2);
    }

    /**
     * Imports a raw JSON string (from v0.3, v0.4.01, v0.5.01, or v0.6.00), backs up both
     * the current save and the raw imported string to `due-by-dusk-v1-backup`, and runs
     * idempotent migration to v2.
     */
    static importSaveJson(rawJsonText, currentMeta, currentFarm) {
      if (!rawJsonText || !rawJsonText.trim()) {
        throw new Error('Save JSON is empty.');
      }
      let parsed;
      try {
        parsed = JSON.parse(rawJsonText);
      } catch (_e) {
        throw new Error('Invalid JSON format. Please paste a valid Due by Dusk save file.');
      }

      // Store pre-transform backup of the raw imported data (plus current state if present)
      const backupBundle = JSON.stringify({
        backedUpAt: new Date().toISOString(),
        previousActiveState:
          currentMeta && currentFarm
            ? {
                meta: currentMeta,
                farm: currentFarm,
              }
            : null,
        rawImportedPayload: parsed,
      });
      this.writeBackup(backupBundle);
      const migrated = this.migrateToV2(parsed);
      if (!migrated) {
        throw new Error('Save JSON is missing required `meta` or `farm` properties.');
      }
      this.save(migrated.meta, migrated.farm, migrated.migrationId, migrated.migrationReport);
      return migrated;
    }
  } // CONCATENATED MODULE: ./.ts-build/scenes/BootScene.js
  // ============================================================================
  // Due by Dusk · v0.6.00 — BootScene (`src/scenes/BootScene.ts`)
  // Initializes the versioned SaveSystem (`due-by-dusk-v2` with automatic backup
  // and idempotent migration from `due-by-dusk-v1`) and launches PreloadScene.
  // ============================================================================

  class BootScene extends phaser_shim.Scene {
    constructor() {
      super({
        key: 'BootScene',
      });
    }
    create() {
      const payload = SaveSystem.loadOrMigrate();
      window.__DBD_INITIAL_SAVE = payload;
      this.scene.start('PreloadScene');
    }
  } // CONCATENATED MODULE: ./.ts-build/scenes/PreloadScene.js
  // ============================================================================
  // Due by Dusk · v0.6.00 — PreloadScene (`src/scenes/PreloadScene.ts`)
  // Loads the authored Arthur Grumble 30-frame Phaser Texture Atlas
  // (`assets/atlases/arthur_atlas.png` + `arthur_atlas.json`) and the 4
  // illustrated regional farm panoramas (`CA`, `BR`, `FR`, `JP`), registers all
  // 5 Phaser animations (`arthur_idle`, `arthur_smug`, `arthur_demand`,
  // `arthur_anger`, `arthur_shock`), and launches `FarmScene`.
  // ============================================================================

  class PreloadScene extends phaser_shim.Scene {
    constructor() {
      super({
        key: 'PreloadScene',
      });
    }
    preload() {
      // Claude's skyline bands (one image per key, registered by the shell). No Arthur, no paintings.
      const bands = window.__DBD_BANDS || {};
      for (const key of Object.keys(bands)) this.load.image(key, bands[key].url);
    }
    create() {
      this.scene.start('FarmScene');
    }
  } // CONCATENATED MODULE: ./.ts-build/scenes/FarmScene.js
  // ============================================================================
  // Due by Dusk · v0.6.00 — FarmScene (`src/scenes/FarmScene.ts`)
  // Core Phaser 3 Gameplay Scene managing the illustrated regional backgrounds,
  // the 30-frame animated Arthur Grumble Sprite, regional crops, camera FX,
  // and SaveSystem integration.
  // ============================================================================
  // @ts-nocheck
  // ============================================================================
  // Due by Dusk · v0.6.10 — 12 Cultural Veggie Characters Vector Renderer
  // Built in the EXACT minimalist, clean, low-part-count 2D vector style of
  // Gym-Bro Carrot and Runaway Red Radish:
  //   - Unstroked layered leaf crowns (`ell` with `leaf` / `leafDark`)
  //   - Smooth organic body silhouettes with radial gradient & `def.shade` stroke (1.8px)
  //   - Body-wrapping headbands/ribbons clipped cleanly (`ctx.clip()`) to the silhouette
  //   - At most 1–2 ultra-simple flat vector accessories (no floating limbs/clutter)
  //   - Unstroked white eyes (`#fff`) + pupils + single-stroke brows/mouths + `> <` hit wince
  // ============================================================================
  // ============================================================================
  // Authored Canada Trio & France Trio Vector Renderers (Hoser Russet, Lumberjack Fiddlehead, Mountie Saskaberry)
  // ============================================================================
  // ============================================================================
  // Due by Dusk — Canada Trio Authored Vector Character Renderer
  // Faithfully implements the 3 approved character sheets in pure Canvas 2D:
  //   1. Hoser Russet (`pei_russet`, r: 28) — Pro Hockey Enforcer Potato
  //   2. Lumberjack Fiddlehead (`fiddlehead`, r: 24) — Coiled Ostrich Fern Bushman
  //   3. Mountie Saskaberry (`saskaberry`, r: 24) — Royal Mountie Saskatoon Berry
  //
  // Each character supports 3 distinct states matching the character sheets:
  //   - State 1 (`idle`):          !cursorNear && !shocked
  //   - State 2 (`near`):          cursorNear && !shocked
  //   - State 3 (`gag`/`shocked`): shocked (on-hit counter / slapstick gag)
  // ============================================================================
  // ============================================================================
  // Due by Dusk — Complete Canada Trio Authored Vector Character Renderer
  // Faithfully implements all 3 Canada Trio characters in pure HTML5 Canvas 2D
  // with continuous 60fps animations AND smooth pose-to-pose interpolation
  // between their 3 poses (`1. IDLE <-> 2. CURSOR-NEAR ALERT <-> 3. ON-HIT GAG`):
  //
  //   1. Hoser Russet (`pei_russet`, r: 28) — PEI Red-Clay Potato (Pro Hockey Enforcer)
  //   2. Lumberjack Fiddlehead (`fiddlehead`, r: 24) — New Brunswick Ostrich Fern (Flannel Bushman)
  //   3. Mountie Saskaberry (`saskaberry`, r: 24) — Saskatoon Berry (Polite Royal Mountie)
  //
  // Supported States:
  //   - State 1 (`idle`):          !cursorNear && !shocked (continuous 60fps idle animation)
  //   - State 2 (`near`):          cursorNear && !shocked  (continuous 60fps cursor-near alert animation)
  //   - State 3 (`gag`/`shocked`): shocked                 (continuous 60fps on-hit slapstick gag animation)
  //   - Smooth Blend Object:       { wIdle, wNear, wGag, alertP, gagP } for continuous pose-to-pose morphing!
  //
  // Also includes `drawContinuousShowcaseCycle(...)` which renders a continuous
  // animated state-machine loop (`IDLE -> ANTICIPATION -> CURSOR-NEAR ALERT -> SCYTHE SWING -> ON-HIT GAG -> RECOVERY`)
  // with an approaching & slicing scythe cursor so you can watch the full in-field
  // reaction sequence continuously!
  // ============================================================================
  const DBD_CANADA_TRIO_RENDERER = (() => {
    'use strict';
    function ell(ctx, x, y, rx, ry, rot = 0) {
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
      ctx.fill();
    }
    function circ(ctx, x, y, r) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
      ctx.fill();
    }
    function lerp(a, b, t) {
      return a + (b - a) * t;
    }
    function clamp01(t) {
      return Math.max(0, Math.min(1, t));
    }
    function smoothstep(a, b, t) {
      const u = clamp01((t - a) / Math.max(1e-5, b - a));
      return u * u * (3 - 2 * u);
    }
    function easeOutBack(t) {
      const u = clamp01(t);
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
    }
    function lerpHex(c1, c2, t) {
      const u = clamp01(t);
      const p1 = parseInt(c1.slice(1), 16);
      const p2 = parseInt(c2.slice(1), 16);
      const r = Math.round(lerp((p1 >> 16) & 255, (p2 >> 16) & 255, u));
      const g = Math.round(lerp((p1 >> 8) & 255, (p2 >> 8) & 255, u));
      const b = Math.round(lerp(p1 & 255, p2 & 255, u));
      return `rgb(${r},${g},${b})`;
    } // Resolves discrete state ('idle' | 'near' | 'gag') OR continuous blend weights
    function resolvePoseWeights(state, tNow = 0) {
      if (state && typeof state === 'object') {
        return {
          wIdle: state.wIdle ?? 0,
          wNear: state.wNear ?? 0,
          wGag: state.wGag ?? 0,
          alertP: state.alertP ?? state.wNear ?? 0,
          gagP: state.gagP ?? state.wGag ?? 0,
        };
      }
      if (state === 'near') {
        return { wIdle: 0, wNear: 1, wGag: 0, alertP: 1, gagP: 0 };
      }
      if (state === 'gag' || state === 'shocked') {
        return { wIdle: 0, wNear: 0, wGag: 1, alertP: 0, gagP: 1 };
      }
      return { wIdle: 1, wNear: 0, wGag: 0, alertP: 0, gagP: 0 };
    } // Sculpted layered dirt mound at (0, 0) matching the reference sheets
    function drawSculptedDirtMound(ctx, r, withLeftSprout = false, tNow = 0) {
      ctx.save(); // Soft oval ground shadow
      ctx.fillStyle = 'rgba(43, 23, 8, 0.10)';
      ell(ctx, 0, 4.6, r * 0.94, r * 0.15); // Optional tiny 2-leaf sprout on the left side of the mound (Hoser Russet detail — sways when tNow > 0!)
      if (withLeftSprout) {
        const sproutSway = tNow > 0 ? Math.sin(tNow * 3.2) * 0.08 : 0;
        ctx.save();
        ctx.translate(-r * 0.65, -1.0);
        ctx.rotate(sproutSway);
        ctx.strokeStyle = '#2b1708';
        ctx.lineWidth = 1.3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(2, 2);
        ctx.quadraticCurveTo(-1.5, -2.5, -3.5, -6.2);
        ctx.stroke();
        for (const [lx, ly, rot, rx, ry] of [
          [-5.0, -6.8, -0.52, 3.0, 1.35],
          [-1.0, -6.5, 0.55, 2.5, 1.25],
        ]) {
          ctx.fillStyle = '#6b8e23';
          ctx.strokeStyle = '#2b1708';
          ctx.lineWidth = 1.15;
          ell(ctx, lx, ly, rx, ry, rot);
          ctx.stroke();
        }
        ctx.restore();
      } // Layered dirt clod mound silhouette
      ctx.fillStyle = '#4a2e16';
      ctx.strokeStyle = '#2b1708';
      ctx.lineWidth = 1.65;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.78, 3.4);
      ctx.quadraticCurveTo(-r * 0.8, -1.0, -r * 0.54, -1.4);
      ctx.quadraticCurveTo(-r * 0.4, -5.0, -r * 0.14, -3.9);
      ctx.quadraticCurveTo(0, -5.4, r * 0.16, -3.9);
      ctx.quadraticCurveTo(r * 0.42, -5.0, r * 0.54, -1.4);
      ctx.quadraticCurveTo(r * 0.8, -1.0, r * 0.78, 3.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // Inner clod texture arcs
      ctx.strokeStyle = '#2b1708';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(-r * 0.24, -0.4, r * 0.15, Math.PI * 1.1, Math.PI * 1.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r * 0.22, -0.2, r * 0.16, Math.PI * 1.15, Math.PI * 1.9);
      ctx.stroke();
      ctx.restore();
    } // Glossy blue cartoon sweat drop — slides & bobbles continuously when tNow > 0!
    function drawSweatDrop(ctx, x, y, scale = 1.0, rot = 0, tNow = 0) {
      if (scale <= 0.02) return;
      const slideY = tNow > 0 ? ((tNow * 1.85) % 1.0) * 2.5 : 0;
      const pulse = tNow > 0 ? 1.0 - ((tNow * 1.85) % 1.0) * 0.12 : 1.0;
      ctx.save();
      ctx.translate(x, y + slideY);
      ctx.rotate(rot);
      ctx.scale(scale * pulse, scale * pulse);
      ctx.fillStyle = '#5bc0eb';
      ctx.strokeStyle = '#231815';
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -6.5);
      ctx.bezierCurveTo(4.0, -1.2, 4.3, 4.0, 0, 4.4);
      ctx.bezierCurveTo(-4.3, 4.0, -4.0, -1.2, 0, -6.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e0f7ff';
      ell(ctx, -1.0, 0.8, 0.9, 1.9, -0.2);
      ctx.restore();
    } // Red 4-vein anime anger cross (`💢`) — throbs continuously when tNow > 0!
    function drawAngerVeinMark(ctx, x, y, scale = 1.0, rot = 0, tNow = 0) {
      if (scale <= 0.02) return;
      const pulse = tNow > 0 ? 1.0 + Math.sin(tNow * 14.0) * 0.15 : 1.0;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(scale * pulse, scale * pulse);
      ctx.strokeStyle = '#231815';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 2);
        ctx.beginPath();
        ctx.moveTo(-4.2, -1.4);
        ctx.quadraticCurveTo(-1.4, -1.4, -1.4, -4.2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 2);
        ctx.beginPath();
        ctx.moveTo(-4.2, -1.4);
        ctx.quadraticCurveTo(-1.4, -1.4, -1.4, -4.2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    } // Crisp > < chevron wince eyes (State 3 On-Hit Gag — pulses with impact energy!)
    function drawChevronWinceEyes(ctx, leftX, rightX, eyeY, w, h, ink = '#231815', lw = 2.0, tNow = 0) {
      const squeeze = tNow > 0 ? 1.0 + Math.sin(tNow * 20.0) * 0.08 : 1.0;
      const hw = w * squeeze;
      const hh = h / squeeze;
      ctx.save();
      ctx.strokeStyle = ink;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round'; // Left '>'
      ctx.beginPath();
      ctx.moveTo(leftX - hw * 0.55, eyeY - hh);
      ctx.lineTo(leftX + hw * 0.45, eyeY);
      ctx.lineTo(leftX - hw * 0.55, eyeY + hh);
      ctx.stroke(); // Right '<'
      ctx.beginPath();
      ctx.moveTo(rightX + hw * 0.55, eyeY - hh);
      ctx.lineTo(rightX - hw * 0.45, eyeY);
      ctx.lineTo(rightX + hw * 0.55, eyeY + hh);
      ctx.stroke();
      ctx.restore();
    } // ==========================================================================
    // 1. HOSER RUSSET (`pei_russet`, base r = 28)
    //    PEI Red-Clay Potato — Pro Hockey Enforcer
    // ==========================================================================
    function drawHoserRusset(ctx, r, state, tNow = 0, px = 0, py = 0, drawMound = true) {
      const INK = '#2b1708';
      const { wIdle, wNear, wGag, alertP, gagP } = resolvePoseWeights(state, tNow);
      const gagEased = easeOutBack(clamp01(gagP)); // Continuous 60fps posture interpolation across all 3 poses
      const breatheY = wIdle * (tNow > 0 ? Math.sin(tNow * 4.2) * 0.016 : 0);
      const squatY = wNear * (1.2 + (tNow > 0 ? Math.sin(tNow * 14.0) * 0.45 : 0));
      const gagJumpY = wGag * (tNow > 0 ? -Math.abs(Math.sin(tNow * 11.0)) * 1.4 : 0);
      const jitterX =
        wNear * (tNow > 0 ? Math.sin(tNow * 30.0) * 0.55 : 0) + wGag * (tNow > 0 ? Math.sin(tNow * 24.0) * 0.5 : 0);
      const bodyRot =
        wIdle * (tNow > 0 ? Math.sin(tNow * 2.1) * 0.015 : 0) +
        wNear * (tNow > 0 ? 0.014 * Math.sin(tNow * 18.0) : 0) +
        wGag * (-0.045 + (tNow > 0 ? Math.sin(tNow * 20.0) * 0.022 : 0));
      ctx.save();
      ctx.translate(jitterX, squatY + gagJumpY); // Tall organic Russet Potato silhouette
      function tracePotatoBody(g) {
        g.beginPath();
        g.moveTo(0, -r * 1.66);
        g.bezierCurveTo(r * 0.44, -r * 1.66, r * 0.62, -r * 1.32, r * 0.66, -r * 0.86);
        g.bezierCurveTo(r * 0.71, -r * 0.36, r * 0.54, r * 0.02, 0, r * 0.02);
        g.bezierCurveTo(-r * 0.56, r * 0.02, -r * 0.72, -r * 0.36, -r * 0.66, -r * 0.86);
        g.bezierCurveTo(-r * 0.62, -r * 1.32, -r * 0.44, -r * 1.66, 0, -r * 1.66);
        g.closePath();
      }
      ctx.save();
      ctx.rotate(bodyRot);
      ctx.scale(1 - breatheY * 0.5 + wNear * 0.02, 1 + breatheY - wNear * 0.02); // 1. Potato Body Fill + Smooth Flush Interpolation + Dimples
      ctx.save();
      tracePotatoBody(ctx);
      ctx.fillStyle = lerpHex('#dfa048', '#e07a38', wGag * 0.45);
      ctx.fill();
      ctx.clip();
      const hiGrad = ctx.createRadialGradient(r * 0.08, -r * 0.9, r * 0.08, 0, -r * 0.82, r * 0.78);
      hiGrad.addColorStop(0, lerpHex('#f0c46d', '#fca5a5', wGag * 0.4));
      hiGrad.addColorStop(0.65, lerpHex('#dfa048', '#d97706', wGag * 0.35));
      hiGrad.addColorStop(1, lerpHex('#b87426', '#9a3412', wGag * 0.35));
      ctx.fillStyle = hiGrad;
      ctx.fillRect(-r, -r * 1.75, r * 2, r * 1.85); // Warm russet crescent shadow along left & bottom edge
      ctx.fillStyle = 'rgba(150, 82, 18, 0.40)';
      ctx.beginPath();
      ctx.moveTo(-r * 0.44, -r * 1.62);
      ctx.bezierCurveTo(-r * 0.6, -r * 0.92, -r * 0.5, -r * 0.18, r * 0.42, -r * 0.04);
      ctx.lineTo(r * 0.65, r * 0.15);
      ctx.lineTo(-r * 0.85, r * 0.15);
      ctx.lineTo(-r * 0.85, -r * 1.62);
      ctx.closePath();
      ctx.fill(); // Subtle potato skin dimples
      ctx.fillStyle = 'rgba(130, 68, 16, 0.42)';
      ell(ctx, -r * 0.45, -r * 0.68, 1.0, 1.9, 0.15);
      ell(ctx, -r * 0.34, -r * 0.18, 1.2, 0.9, -0.2);
      ell(ctx, r * 0.5, -r * 0.48, 1.0, 2.0, -0.15);
      ell(ctx, r * 0.36, -r * 0.22, 0.9, 0.9, 0);
      ctx.restore();
      tracePotatoBody(ctx);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.85;
      ctx.lineJoin = 'round';
      ctx.stroke(); // 2. Curved Red-White-Red Hockey Sweatband (positioned cleanly on upper forehead)
      ctx.save();
      const bandShiftY = wGag * -1.2;
      ctx.translate(0, bandShiftY);
      function traceHeadband(g) {
        g.beginPath();
        g.moveTo(-r * 0.63, -r * 1.18);
        g.quadraticCurveTo(0, -r * 1.35, r * 0.63, -r * 1.18);
        g.lineTo(r * 0.58, -r * 1.42);
        g.quadraticCurveTo(0, -r * 1.58, -r * 0.58, -r * 1.42);
        g.closePath();
      }
      ctx.save();
      traceHeadband(ctx);
      ctx.fillStyle = '#c9302c';
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = '#f8f5ec';
      ctx.lineWidth = r * 0.095;
      ctx.beginPath();
      ctx.moveTo(-r * 0.68, -r * 1.3);
      ctx.quadraticCurveTo(0, -r * 1.465, r * 0.68, -r * 1.3);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-r * 0.68, -r * 1.252);
      ctx.quadraticCurveTo(0, -r * 1.417, r * 0.68, -r * 1.252);
      ctx.moveTo(-r * 0.68, -r * 1.348);
      ctx.quadraticCurveTo(0, -r * 1.513, r * 0.68, -r * 1.348);
      ctx.stroke();
      ctx.restore();
      traceHeadband(ctx);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.75;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore(); // 3. Facial Expressions with Smooth Pose-to-Pose Morphing
      const eyeY = -r * 0.78;
      const eyeX = r * 0.22;
      const pOffX = Math.max(-1.6, Math.min(1.6, px * 0.42));
      const pOffY = Math.max(-1.2, Math.min(1.2, py * 0.38)); // Smoothly morphed Eyebrows across Idle -> Near -> Gag
      const browOuterY = lerp(lerp(eyeY - 6.8, eyeY - 8.2, wNear), eyeY - 8.2, wGag);
      const browCtrlY = lerp(lerp(eyeY - 9.0, eyeY - 9.0, wNear), eyeY - 7.0, wGag);
      const browInnerY = lerp(lerp(eyeY - 7.2, eyeY - 4.8, wNear), eyeY - 5.6, wGag);
      const browInnerX = lerp(lerp(eyeX - 3.4, 2.0, wNear), eyeX - 3.0, wGag);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-eyeX - 4.0, browOuterY);
      ctx.quadraticCurveTo(-eyeX, browCtrlY, -browInnerX, browInnerY);
      ctx.moveTo(eyeX + 4.0, browOuterY);
      ctx.quadraticCurveTo(eyeX, browCtrlY, browInnerX, browInnerY);
      ctx.stroke();
      if (wNear > 0.15) {
        ctx.save();
        ctx.globalAlpha = clamp01(wNear);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(-1.5, eyeY - 8.0);
        ctx.lineTo(-1.0, eyeY - 5.6);
        ctx.moveTo(1.5, eyeY - 8.0);
        ctx.lineTo(1.0, eyeY - 5.6);
        ctx.stroke();
        ctx.restore();
        drawSweatDrop(ctx, -r * 0.46, -r * 0.84, 0.82 * clamp01(wNear * 1.2), 0, tNow);
      } // Eyes: Open/Twitching (Idle & Near) -> Chevron Wince (Gag)
      if (wGag < 0.55) {
        const eyeSquashY = 1.0 - clamp01(wGag / 0.55) * 0.65; // Left eye (with animated lower-lid twitch in Near!)
        ctx.save();
        ctx.translate(-eyeX, eyeY);
        ctx.scale(1, eyeSquashY);
        ctx.beginPath();
        ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.clip();
        ctx.fillStyle = INK;
        circ(ctx, 0.4 * wNear + pOffX, -0.3 * wNear + pOffY, 1.8);
        if (wNear > 0.05) {
          const lidTwitch = tNow > 0 ? Math.sin(tNow * 24.0) * 0.55 : 0;
          ctx.fillStyle = '#dfa048';
          ctx.beginPath();
          ctx.arc(0, 4.5 - wNear * (0.4 + lidTwitch), 4.1, Math.PI * 1.15, Math.PI * 1.85);
          ctx.fill();
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(-eyeX, eyeY, 4.2, 4.2 * eyeSquashY, 0, 0, Math.PI * 2);
        ctx.stroke(); // Right eye
        const rEyeR = lerp(4.2, 4.4, wNear);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ell(ctx, eyeX, eyeY, rEyeR, rEyeR * eyeSquashY);
        ctx.stroke();
        ctx.fillStyle = INK;
        ell(ctx, eyeX + 0.3 * wNear + pOffX, eyeY + pOffY * eyeSquashY, 1.85, 1.85 * eyeSquashY);
      } else {
        drawChevronWinceEyes(ctx, -eyeX, eyeX, eyeY, 8.0, 3.4, INK, 2.1, tNow);
      } // Mouth: Gap-Tooth Grin (Idle) -> Clenched Gritted Grimace (Near) -> Wide Enforcer Holler (Gag)
      const my = -r * 0.48;
      if (wGag >= 0.5) {
        const shoutPulse = tNow > 0 ? Math.sin(tNow * 18.0) * 0.6 : 0;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(-r * 0.24, my + 5.0 + shoutPulse);
        ctx.bezierCurveTo(
          -r * 0.27,
          my - 8.6 - shoutPulse,
          r * 0.27,
          my - 8.6 - shoutPulse,
          r * 0.24,
          my + 5.0 + shoutPulse,
        );
        ctx.quadraticCurveTo(0, my + 2.0, -r * 0.24, my + 5.0 + shoutPulse);
        ctx.closePath();
        ctx.fillStyle = '#3a1810';
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, my - 5.5, r * 0.19, 2.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#c94a38';
        ell(ctx, 1.6, my + 3.4, r * 0.16, 3.2, -0.1);
        ctx.restore();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.7;
        ctx.stroke();
        ctx.restore();
      } else if (wNear >= 0.5) {
        const chatter = tNow > 0 ? Math.sin(tNow * 28.0) * 0.35 : 0;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(-r * 0.24, my + 2.6 + chatter);
        ctx.bezierCurveTo(-r * 0.24, my - 4.8 - chatter, r * 0.24, my - 4.8 - chatter, r * 0.24, my + 2.6 + chatter);
        ctx.quadraticCurveTo(0, my + 0.8, -r * 0.24, my + 2.6 + chatter);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.26, my - 0.7);
        ctx.quadraticCurveTo(0, my - 1.7, r * 0.26, my - 0.7);
        ctx.stroke();
        for (const tx of [-r * 0.13, -r * 0.04, r * 0.05, r * 0.13]) {
          ctx.beginPath();
          ctx.moveTo(tx, my - 5.2);
          ctx.lineTo(tx, my + 3.2);
          ctx.stroke();
        }
        ctx.fillStyle = '#2b1708';
        ctx.fillRect(-r * 0.13, my - 4.8, r * 0.09, 3.8);
        ctx.restore();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(-r * 0.26, my - 2.5);
        ctx.quadraticCurveTo(0, my - 1.2, r * 0.26, my - 2.5);
        ctx.bezierCurveTo(r * 0.28, my + 7.0, -r * 0.28, my + 7.0, -r * 0.26, my - 2.5);
        ctx.closePath();
        ctx.fillStyle = '#3a1810';
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#b84a39';
        ell(ctx, 0, my + 5.0, r * 0.15, 3.2);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(-r * 0.19, my - 3.6, r * 0.11, 4.2, 1.0);
        ctx.roundRect(r * 0.08, my - 3.6, r * 0.11, 4.2, 1.0);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(130, 68, 16, 0.55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, my + 7.5, 3.8, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore(); // End potato body transform
      if (drawMound) {
        drawSculptedDirtMound(ctx, r, true, tNow);
      } // 4. Twig Hockey Stick & Gag Props (Animated Continuously Across All 3 Poses!)
      if (wGag < 0.45 && wNear < 0.5) {
        // POSE 1: IDLE — Rhythmically tapping twig hockey stick on the dirt mound
        const tapAng = tNow > 0 ? Math.abs(Math.sin(tNow * 5.6)) * 0.1 : 0;
        ctx.save();
        ctx.translate(r * 0.54, -r * 0.02);
        ctx.rotate(tapAng);
        ctx.fillStyle = '#6e4726';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.33, -r * 0.62);
        ctx.lineTo(r * 0.38, -r * 0.6);
        ctx.lineTo(r * 0.03, 1.2);
        ctx.quadraticCurveTo(-r * 0.12, 2.8, -r * 0.23, 0.8);
        ctx.quadraticCurveTo(-r * 0.24, -1.8, -r * 0.04, -1.8);
        ctx.lineTo(r * 0.33, -r * 0.62);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.2, -r * 0.34);
        ctx.lineTo(r * 0.25, -r * 0.22);
        ctx.stroke();
        ctx.restore();
      } else if (wGag < 0.5) {
        // POSE 2: CURSOR-NEAR ALERT — Twig stick raised into high defensive check guard (smoothly interpolated by alertP!)
        const liftP = easeOutBack(clamp01(alertP));
        const readyBob = tNow > 0 ? Math.sin(tNow * 11.0) * 1.15 : 0;
        ctx.save();
        ctx.translate(0, (1 - liftP) * 8.0 + readyBob);
        ctx.rotate((1 - liftP) * 0.28);
        ctx.fillStyle = '#6e4726';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.32, -r * 1.7);
        ctx.lineTo(r * 0.56, -r * 1.58);
        ctx.lineTo(r * 0.85, -r * 0.78);
        ctx.lineTo(r * 0.79, -r * 0.76);
        ctx.lineTo(r * 0.51, -r * 1.52);
        ctx.lineTo(r * 0.29, -r * 1.61);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.65, -r * 1.2);
        ctx.lineTo(r * 0.59, -r * 1.12);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.6, -r * 0.8);
        ctx.lineTo(r * 0.65, -r * 0.76);
        ctx.lineTo(r * 0.26, -r * 0.26);
        ctx.lineTo(r * 0.22, -r * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else {
        // POSE 3: ON-HIT GAG — Animated Slap-Shot Stick Swing + Flying Molar Tooth + Rocketing Dirt Puck!
        const swingOsc = tNow > 0 ? Math.sin(tNow * 15.0) * 0.08 : 0;
        const projFly = tNow > 0 ? (tNow * 2.4) % 1.0 : 0;
        const shotT = clamp01(gagP);
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.35;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.84, -r * 0.28);
        ctx.bezierCurveTo(-r * 0.94, -r * 0.16, -r * 0.18, -r * 0.18, r * 0.54, -r * 0.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.16, -r * 0.16);
        ctx.quadraticCurveTo(r * 0.35, -r * 0.24, r * 0.74, -r * 0.46);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(r * 0.44, -r * 0.48, r * 0.46, -0.22 + swingOsc, 0.62 + swingOsc);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(r * 0.54, -r * 0.48, r * 0.5, -0.16 + swingOsc, 0.5 + swingOsc);
        ctx.stroke(); // Swinging Twig Stick
        ctx.save();
        ctx.rotate(swingOsc * 0.65);
        ctx.fillStyle = '#6e4726';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.1, -r * 0.26);
        ctx.lineTo(r * 0.88, -r * 0.59);
        ctx.lineTo(r * 0.85, -r * 0.64);
        ctx.lineTo(-r * 0.13, -r * 0.31);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore(); // Knocked-out White Molar Tooth flying & spinning along an upward trajectory!
        const toothX = lerp(r * 0.18, r * 0.84 + projFly * 2.2, shotT);
        const toothY = lerp(-r * 0.52, -r * 0.94 - Math.sin(projFly * Math.PI) * 2.4, shotT);
        const toothRot = 0.42 + (tNow > 0 ? Math.sin(tNow * 16.0) * 0.22 : 0);
        ctx.save();
        ctx.translate(toothX, toothY);
        ctx.rotate(toothRot);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ctx.beginPath();
        ctx.moveTo(-3.3, -2.8);
        ctx.quadraticCurveTo(0, -4.0, 3.3, -2.8);
        ctx.quadraticCurveTo(3.8, 1.2, 2.0, 3.4);
        ctx.lineTo(0.4, 1.4);
        ctx.lineTo(-1.2, 3.4);
        ctx.quadraticCurveTo(-3.8, 1.2, -3.3, -2.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        ctx.beginPath();
        ctx.moveTo(r * 0.58, -r * 0.9);
        ctx.lineTo(r * 0.68, -r * 0.93);
        ctx.moveTo(r * 0.62, -r * 0.81);
        ctx.lineTo(r * 0.71, -r * 0.84);
        ctx.stroke(); // Slap-shot Dirt Clod Hockey Puck rocketing outward!
        const puckX = lerp(r * 0.35, r * 1.06 + projFly * 3.8, shotT);
        const puckY = lerp(-r * 0.22, -r * 0.72 - projFly * 1.6, shotT);
        ctx.save();
        ctx.translate(puckX, puckY);
        ctx.fillStyle = '#5c3a1e';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = INK;
        circ(ctx, -6.8 - projFly * 1.5, 4.4 + projFly * 0.6, 1.1);
        circ(ctx, -10.0 - projFly * 2.2, 1.8 + projFly * 0.4, 0.95);
        ctx.restore();
        ctx.restore();
      }
      ctx.restore();
    } // ==========================================================================
    // 2. LUMBERJACK FIDDLEHEAD (`fiddlehead`, base r = 24)
    //    New Brunswick Ostrich Fern — Flannel Bushman
    //    True S-curved coiled fiddlehead base + neck + head that smoothly uncoils
    //    into a 4-loop vertical helical spring on hit (`BOING!`)!
    // ==========================================================================
    function drawLumberjackFiddlehead(ctx, r, state, tNow = 0, px = 0, py = 0, drawMound = true) {
      const INK = '#1c2418';
      const { wIdle, wNear, wGag, alertP, gagP } = resolvePoseWeights(state, tNow);
      const isGag = wGag >= 0.45;
      const isNear = !isGag && wNear >= 0.45;
      const isIdle = !isGag && !isNear;
      ctx.save(); // Helper to draw the Buffalo-Plaid Trapper Hat & Head at (hx, hy)
      function drawFiddleheadHead(hx, hy, headRot = 0, drawNeckBridge = false) {
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(headRot);
        const hr = r * 0.6; // 1. Round green fern head dome
        const hGrad = ctx.createRadialGradient(-hr * 0.2, -hr * 0.15, 2, 0, 0, hr * 1.1);
        hGrad.addColorStop(0, '#84d946');
        hGrad.addColorStop(0.7, '#5cb833');
        hGrad.addColorStop(1, '#398f26');
        ctx.fillStyle = hGrad;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.8;
        circ(ctx, 0, 0, hr);
        if (!drawNeckBridge) {
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, hr, -Math.PI * 0.85, Math.PI * 0.42);
          ctx.stroke();
        } // 2. Sculpted Brown Lumberjack Beard wrapping the lower jaw
        ctx.fillStyle = '#6e4427';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.75;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-hr * 0.9, hr * 0.14);
        ctx.bezierCurveTo(-hr * 0.6, hr * 0.68, -hr * 0.22, hr * 0.56, 0, hr * 0.48);
        ctx.bezierCurveTo(hr * 0.22, hr * 0.56, hr * 0.6, hr * 0.68, hr * 0.9, hr * 0.14);
        ctx.bezierCurveTo(hr * 0.98, hr * 0.76, hr * 0.48, hr * 1.04, 0, hr * 1.04);
        ctx.bezierCurveTo(-hr * 0.48, hr * 1.04, -hr * 0.98, hr * 0.76, -hr * 0.9, hr * 0.14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // 3. Facial Expression per State
        const eyeY = -hr * 0.08;
        const eyeX = hr * 0.33;
        const pOffX = Math.max(-1.3, Math.min(1.3, px * 0.38));
        const pOffY = Math.max(-1.0, Math.min(1.0, py * 0.35));
        if (wGag < 0.5) {
          for (const dir of [-1, 1]) {
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.4;
            circ(ctx, dir * eyeX, eyeY, lerp(3.1, 3.0, wNear));
            ctx.stroke();
            ctx.fillStyle = INK;
            circ(ctx, dir * eyeX + lerp(pOffX, 0.9 + pOffX * 0.4, wNear), eyeY + pOffY, 1.3);
          }
          if (wNear < 0.5) {
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.45;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-hr * 0.16, hr * 0.26);
            ctx.quadraticCurveTo(0, hr * 0.34, hr * 0.16, hr * 0.22);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(-hr * 0.19, hr * 0.23, 1.5, -Math.PI * 0.4, Math.PI * 0.5);
            ctx.stroke();
          } else {
            ctx.fillStyle = INK;
            circ(ctx, hr * 0.04, hr * 0.25, 1.55 + (tNow > 0 ? Math.sin(tNow * 18.0) * 0.2 : 0));
            drawSweatDrop(ctx, -hr * 0.72, -hr * 0.08, 0.58 * clamp01(wNear * 1.2), 0, tNow);
          }
        } else {
          drawChevronWinceEyes(ctx, -eyeX, eyeX, eyeY - 0.5, 5.6, 2.3, INK, 1.85, tNow);
          const mouthOpen = tNow > 0 ? Math.sin(tNow * 20.0) * 0.04 : 0;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(-hr * 0.26, hr * 0.34);
          ctx.bezierCurveTo(
            -hr * 0.24,
            hr * (0.08 - mouthOpen),
            hr * 0.24,
            hr * (0.08 - mouthOpen),
            hr * 0.26,
            hr * 0.34,
          );
          ctx.quadraticCurveTo(0, hr * 0.26, -hr * 0.26, hr * 0.34);
          ctx.closePath();
          ctx.fillStyle = '#2b1708';
          ctx.fill();
          ctx.save();
          ctx.clip();
          ctx.fillStyle = '#e06358';
          ell(ctx, -1.0, hr * 0.32, 3.2, 1.8, -0.15);
          ctx.restore();
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.45;
          ctx.stroke();
          ctx.restore();
        } // 4. Red-and-Black Buffalo-Plaid Trapper Hat (with animated earflaps!)
        ctx.save();
        const hatBounce = wGag * (1.5 + (tNow > 0 ? Math.abs(Math.sin(tNow * 22.0)) * 1.4 : 0));
        const hatY = -hr * 0.68 - hatBounce;
        ctx.translate(0, hatY);
        if (wNear < 0.35 && wGag < 0.35) {
          const flapSway = tNow > 0 ? Math.sin(tNow * 3.4) * 0.05 : 0;
          ctx.save();
          ctx.rotate(flapSway);
          ctx.fillStyle = '#d62828';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.65;
          ctx.beginPath();
          ctx.moveTo(-hr * 0.88, 1);
          ctx.bezierCurveTo(-hr * 1.1, 6, -hr * 1.14, 15.5, -hr * 0.86, 16.5);
          ctx.bezierCurveTo(-hr * 0.66, 16.5, -hr * 0.66, 8, -hr * 0.7, 1);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(hr * 0.8, 1.5);
          ctx.quadraticCurveTo(hr * 1.0, 6.0, hr * 0.86, 9.5);
          ctx.lineTo(hr * 0.74, 6.0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        } else {
          // Flared earflaps in Near & Gag — flutter continuously at 60fps!
          const flapFlutter = tNow > 0 ? Math.sin(tNow * 20.0) * 0.08 : 0;
          const wingLift = lerp(-0.04, -0.18, wGag) + flapFlutter;
          for (const dir of [-1, 1]) {
            ctx.save();
            ctx.translate(dir * hr * 0.76, 1.5);
            ctx.rotate(dir * wingLift);
            ctx.fillStyle = '#d62828';
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.65;
            ctx.beginPath();
            ctx.moveTo(0, -2.5);
            ctx.bezierCurveTo(dir * 5.2, 1.0, dir * 10.0, -1.5, dir * 11.0, -7.0);
            ctx.bezierCurveTo(dir * 13.0, -7.0, dir * 13.6, 2.0, dir * 6.8, 4.5);
            ctx.quadraticCurveTo(dir * 2.2, 5.2, -dir * 2.0, 1.0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#f5e8c7';
            ctx.beginPath();
            ctx.moveTo(dir * 3.0, -0.5);
            ctx.quadraticCurveTo(dir * 8.5, -1.2, dir * 10.0, -5.5);
            ctx.lineTo(dir * 8.5, -6.2);
            ctx.quadraticCurveTo(dir * 7.0, -2.0, dir * 2.0, -1.8);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        } // Buffalo-Plaid Hat Dome
        function traceHatDome(g) {
          g.beginPath();
          g.moveTo(-hr * 0.92, 1.5);
          g.bezierCurveTo(-hr * 0.96, -hr * 0.78, hr * 0.96, -hr * 0.78, hr * 0.92, 1.5);
          g.closePath();
        }
        ctx.save();
        traceHatDome(ctx);
        ctx.fillStyle = '#d62828';
        ctx.fill();
        ctx.clip();
        ctx.fillStyle = 'rgba(24, 24, 27, 0.50)';
        ctx.fillRect(-hr * 0.66, -hr * 0.75, hr * 0.26, hr * 0.85);
        ctx.fillRect(hr * 0.12, -hr * 0.75, hr * 0.26, hr * 0.85);
        ctx.fillStyle = 'rgba(127, 20, 26, 0.48)';
        ctx.fillRect(-hr * 1.0, -hr * 0.48, hr * 2.0, hr * 0.18);
        ctx.restore();
        traceHatDome(ctx);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.7;
        ctx.lineJoin = 'round';
        ctx.stroke(); // Cream Sherpa Fleece Front Visor Band
        ctx.fillStyle = '#f5e8c7';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.65;
        ctx.beginPath();
        ctx.roundRect(-hr * 0.74, -hr * 0.16, hr * 1.48, hr * 0.4, 3.0);
        ctx.fill();
        ctx.stroke();
        ctx.restore(); // End hat
        ctx.restore(); // End head
      } // ========================================================================
      // BODY RENDERING: Coiled S-Fern (Idle & Near) vs. Uncoiled Spring (On-Hit Gag)
      // ========================================================================
      if (!isGag) {
        const idleBreathe = wIdle * (tNow > 0 ? Math.sin(tNow * 3.8) * 0.85 : 0);
        const nearCrouch = wNear * (1.2 + (tNow > 0 ? Math.sin(tNow * 16.0) * 0.4 : 0));
        const nearJitterX = wNear * (tNow > 0 ? Math.sin(tNow * 32.0) * 0.55 : 0);
        ctx.save();
        ctx.translate(nearJitterX, nearCrouch); // 1. Flexing Coiled Bicep Arm on Right (Pose 1: IDLE — pumps continuously!)
        if (wIdle > 0.25) {
          const flexBob = tNow > 0 ? Math.sin(tNow * 4.5) * 0.11 : 0;
          ctx.save();
          ctx.globalAlpha = clamp01(wIdle * 1.3);
          ctx.translate(r * 0.34, -r * 0.6);
          ctx.rotate(flexBob);
          ctx.fillStyle = '#5ab532';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.7;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(-2, 4);
          ctx.bezierCurveTo(r * 0.36, 7.2, r * 0.56, -3.5, r * 0.48, -r * 0.34);
          ctx.bezierCurveTo(r * 0.42, -r * 0.52, r * 0.16, -r * 0.48, r * 0.18, -r * 0.26);
          ctx.bezierCurveTo(r * 0.18, -r * 0.15, r * 0.26, -r * 0.11, r * 0.26, -r * 0.09);
          ctx.quadraticCurveTo(r * 0.12, -r * 0.07, -2, -4.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(r * 0.31, -r * 0.29, 3.0, 0.2, Math.PI * 1.65);
          ctx.stroke();
          ctx.restore();
        } // 2. S-Curved Coiled Fern Base + Continuous Left Neck Silhouette
        const baseR = r * 0.56;
        const baseX = -r * 0.04;
        const baseY = -r * 0.46;
        ctx.fillStyle = '#58b331';
        ctx.beginPath();
        ctx.moveTo(baseX - baseR * 0.72, baseY - baseR * 0.55);
        ctx.bezierCurveTo(-r * 0.34, -r * 0.88, -r * 0.36, -r * 1.02, -r * 0.46, -r * 1.18);
        ctx.lineTo(r * 0.2, -r * 1.12);
        ctx.bezierCurveTo(
          r * 0.22,
          -r * 0.88,
          baseX + baseR * 0.42,
          baseY - baseR * 0.72,
          baseX + baseR * 0.52,
          baseY - baseR * 0.48,
        );
        ctx.closePath();
        ctx.fill();
        const bGrad = ctx.createRadialGradient(baseX - 4, baseY - 5, 2, baseX, baseY, baseR * 1.1);
        bGrad.addColorStop(0, '#72c43b');
        bGrad.addColorStop(0.65, '#4ca32b');
        bGrad.addColorStop(1, '#2a721d');
        ctx.fillStyle = bGrad;
        circ(ctx, baseX, baseY, baseR);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(baseX, baseY, baseR, -Math.PI * 0.2, Math.PI * 1.18);
        ctx.bezierCurveTo(-r * 0.34, -r * 0.88, -r * 0.36, -r * 1.02, -r * 0.46, -r * 1.16);
        ctx.stroke();
        ctx.fillStyle = '#2e7d20';
        circ(ctx, baseX + 0.8, baseY + 1.2, baseR * 0.64); // Sculpted Archimedean Spiral Coil (`@` swirl) inside base
        const spiralSpin = tNow > 0 ? Math.sin(tNow * (isNear ? 18.0 : 3.8)) * 0.12 : 0;
        ctx.strokeStyle = '#5ab532';
        ctx.lineWidth = 4.0;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 3.3; a += 0.15) {
          const sr = 1.8 + (a / (Math.PI * 3.3)) * (baseR * 0.56);
          const sx = baseX + 0.8 + Math.cos(a + 0.6 + spiralSpin) * sr;
          const sy = baseY + 1.2 + Math.sin(a + 0.6 + spiralSpin) * sr;
          if (a === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 3.4; a += 0.15) {
          const sr = 1.0 + (a / (Math.PI * 3.4)) * (baseR * 0.62);
          const sx = baseX + 0.8 + Math.cos(a + 0.4 + spiralSpin) * sr;
          const sy = baseY + 1.2 + Math.sin(a + 0.4 + spiralSpin) * sr;
          if (a === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke(); // 3. Draw Head at top of the S-neck
        const headTilt =
          wIdle * (tNow > 0 ? Math.sin(tNow * 3.8) * 0.025 : 0) + wNear * (tNow > 0 ? Math.sin(tNow * 22.0) * 0.02 : 0);
        drawFiddleheadHead(r * 0.04, -r * 1.2 + idleBreathe * 0.5, headTilt, true); // 4. Cold-air Breath Puff Cloud in Idle (chugs & drifts!) OR Shiver Lines in Near
        if (wIdle > 0.3) {
          const chug = tNow > 0 ? (tNow * 2.0) % 1.0 : 0;
          const puffX = r * 0.85 + chug * 3.4;
          const puffY = -r * 1.15 - chug * 1.2;
          const puffSc = 1.0 + Math.sin(chug * Math.PI) * 0.18;
          ctx.save();
          ctx.translate(puffX, puffY);
          ctx.scale(puffSc, puffSc);
          ctx.strokeStyle = '#9bb8c9';
          ctx.lineWidth = 1.3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-8.5, 0.5);
          ctx.lineTo(-5.8, -0.4);
          ctx.moveTo(-8.0, 2.4);
          ctx.lineTo(-5.5, 2.2);
          ctx.stroke();
          ctx.fillStyle = '#eef7fc';
          ctx.strokeStyle = '#9bb8c9';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(-1.2, 0, 3.0, Math.PI * 0.55, Math.PI * 1.65);
          ctx.arc(2.0, -2.0, 3.2, Math.PI * 1.1, Math.PI * 0.15);
          ctx.arc(2.4, 2.0, 3.0, -Math.PI * 0.2, Math.PI * 0.85);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        } else if (wNear > 0.3) {
          const shiv = tNow > 0 ? Math.sin(tNow * 28.0) * 0.05 : 0;
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.35;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(-r * 0.08, -r * 1.05, r * 0.62, Math.PI * 0.78 + shiv, Math.PI * 1.04 + shiv);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, -r * 0.52, r * 0.65, -0.45 - shiv, 0.05 - shiv);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, -r * 0.52, r * 0.72, -0.38 + shiv, 0.02 + shiv);
          ctx.stroke();
        }
        ctx.restore();
      } else {
        // ======================================================================
        // POSE 3: ON-HIT GAG — UNCOILED HELICAL SPRING (`BOING!` DYNAMIC STRETCH)
        // ======================================================================
        const uncoilEase = easeOutBack(clamp01(gagP));
        const springBounce = tNow > 0 ? Math.sin(tNow * 22.0) * 2.2 : 0;
        const tailWhip = tNow > 0 ? Math.sin(tNow * 18.0) * 0.12 : 0; // 1. Curled Spiral Tail extending out to the left from the dirt mound (whips with tNow!)
        ctx.save();
        ctx.rotate(tailWhip);
        ctx.fillStyle = '#5ab532';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.7;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.16, 0);
        ctx.bezierCurveTo(-r * 0.58, -r * 0.05, -r * 0.88, -r * 0.4, -r * 0.78, -r * 0.68);
        ctx.bezierCurveTo(-r * 0.7, -r * 0.88, -r * 0.36, -r * 0.88, -r * 0.34, -r * 0.65);
        ctx.bezierCurveTo(-r * 0.32, -r * 0.48, -r * 0.54, -r * 0.46, -r * 0.54, -r * 0.56);
        ctx.bezierCurveTo(-r * 0.56, -r * 0.32, -r * 0.3, -r * 0.14, 0, -r * 0.04);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-r * 0.55, -r * 0.65, 3.8, 0, Math.PI * 1.65);
        ctx.stroke();
        ctx.restore(); // 2. 4-Loop Vertical Helical Zig-Zag Spring Stack (dynamically stretches & oscillates!)
        const stretchScale = lerp(0.55, 1.0, uncoilEase);
        const baseLoops = [-r * 0.12, -r * 0.36, -r * 0.6, -r * 0.84];
        const hw = r * 0.34 * (1.0 - springBounce * 0.015); // Back connectors
        for (let i = 0; i < baseLoops.length; i++) {
          const y0 = baseLoops[i] * stretchScale + springBounce * ((i + 1) * 0.25);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 6.2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-hw, y0 - r * 0.12 * stretchScale);
          ctx.lineTo(hw, y0 - r * 0.24 * stretchScale);
          ctx.stroke();
          ctx.strokeStyle = '#2e7d20';
          ctx.lineWidth = 3.4;
          ctx.beginPath();
          ctx.moveTo(-hw, y0 - r * 0.12 * stretchScale);
          ctx.lineTo(hw, y0 - r * 0.24 * stretchScale);
          ctx.stroke();
        } // Front spring coils
        for (let i = 0; i < baseLoops.length; i++) {
          const y0 = baseLoops[i] * stretchScale + springBounce * ((i + 1) * 0.25);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 7.2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(hw, y0);
          ctx.lineTo(-hw, y0 - r * 0.12 * stretchScale);
          ctx.stroke();
          ctx.strokeStyle = '#5ab532';
          ctx.lineWidth = 4.2;
          ctx.beginPath();
          ctx.moveTo(hw, y0);
          ctx.lineTo(-hw, y0 - r * 0.12 * stretchScale);
          ctx.stroke();
          ctx.strokeStyle = '#80d64d';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(hw - 2, y0 - 1.0);
          ctx.lineTo(-hw + 2, y0 - r * 0.12 * stretchScale - 1.0);
          ctx.stroke();
        } // 3. Motion / bounce lines along left and right of the uncoiled spring
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.35;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.56, -r * 1.15 + springBounce * 0.5);
        ctx.quadraticCurveTo(-r * 0.48, -r * 0.92, -r * 0.34, -r * 0.8);
        ctx.moveTo(-r * 0.46, -r * 1.18 + springBounce * 0.5);
        ctx.quadraticCurveTo(-r * 0.4, -r * 1.0, -r * 0.28, -r * 0.88);
        ctx.moveTo(r * 0.55, -r * 0.82 - springBounce * 0.4);
        ctx.quadraticCurveTo(r * 0.6, -r * 0.5, r * 0.48, -r * 0.2);
        ctx.moveTo(r * 0.45, -r * 0.44);
        ctx.lineTo(r * 0.41, -r * 0.24);
        ctx.stroke(); // 4. Head launched high at top of the uncoiled spring
        const headY = lerp(-r * 1.2, -r * 1.45, uncoilEase) + springBounce * 1.1;
        const headRot = -0.05 + (tNow > 0 ? Math.sin(tNow * 18.0) * 0.06 : 0);
        drawFiddleheadHead(r * 0.08, headY, headRot, false);
      }
      if (drawMound) {
        drawSculptedDirtMound(ctx, r * 1.06, false, tNow);
      }
      ctx.restore();
    } // ==========================================================================
    // 3. MOUNTIE SASKABERRY (`saskaberry`, base r = 24)
    //    Saskatoon Berry — Polite Royal Mountie
    // ==========================================================================
    function drawMountieSaskaberry(ctx, r, state, tNow = 0, px = 0, py = 0, drawMound = true) {
      const INK = '#1e1424';
      const { wIdle, wNear, wGag, alertP, gagP } = resolvePoseWeights(state, tNow);
      const gagEased = easeOutBack(clamp01(gagP));
      const br = r * 0.72; // Plump berry radius
      const breatheY = wIdle * (tNow > 0 ? Math.sin(tNow * 4.0) * 0.75 : 0);
      const squatY = wNear * (1.0 + (tNow > 0 ? Math.sin(tNow * 18.0) * 0.35 : 0));
      const gagJumpY = wGag * (tNow > 0 ? -Math.abs(Math.sin(tNow * 12.0)) * 1.4 : 0);
      const jitterX =
        wNear * (tNow > 0 ? Math.sin(tNow * 28.0) * 0.45 : 0) + wGag * (tNow > 0 ? Math.sin(tNow * 24.0) * 0.45 : 0);
      const by = -r * 0.68 + breatheY + squatY + gagJumpY;
      ctx.save();
      ctx.translate(jitterX, 0); // 1. In Pose 3 (On-Hit Gag): Stubby Purple Berry Arms (wave & flail continuously!)
      if (wGag > 0.15) {
        const armWave = tNow > 0 ? Math.sin(tNow * 18.0) * 1.8 : 0;
        ctx.save();
        ctx.globalAlpha = clamp01(wGag * 1.4);
        ctx.fillStyle = '#5c2d91';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.85;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-br * 0.85, by + 2);
        ctx.quadraticCurveTo(-br * 1.28, by - 2 + armWave, -br * 1.15, by - 10 + armWave);
        ctx.quadraticCurveTo(-br * 0.95, by - 10 + armWave, -br * 0.82, by - 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(br * 0.82, by + 4);
        ctx.quadraticCurveTo(br * 1.32, by - 3 - armWave, br * 1.28, by - 9 - armWave);
        ctx.quadraticCurveTo(br * 1.15, by - 13 - armWave, br * 0.85, by - 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } // 2. 3-Pointed Saskatoon Berry Calyx Crown at very top of berry (exposed when hat pops off in Gag)
      if (wGag > 0.15) {
        ctx.save();
        ctx.translate(0, by - br * 0.98);
        ctx.fillStyle = '#4c1d95';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.75;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-7.2, 3.0);
        ctx.lineTo(-5.8, -4.0);
        ctx.lineTo(-2.4, -1.2);
        ctx.lineTo(0.0, -5.6);
        ctx.lineTo(2.4, -1.2);
        ctx.lineTo(5.8, -4.0);
        ctx.lineTo(7.2, 3.0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } // 3. Plump Purple Saskatoon Berry Sphere + Crescent Shading + Glossy Highlights
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, by, br, 0, Math.PI * 2);
      ctx.fillStyle = lerpHex('#5c2d91', '#7c2d8a', wGag * 0.45);
      ctx.fill();
      ctx.clip();
      const bGrad = ctx.createRadialGradient(-br * 0.3, by - br * 0.3, 2, 0, by, br * 1.1);
      bGrad.addColorStop(0, lerpHex('#7844b8', '#a8389b', wGag * 0.45));
      bGrad.addColorStop(0.65, lerpHex('#5c2d91', '#7c2d8a', wGag * 0.45));
      bGrad.addColorStop(1, '#3e1a6d');
      ctx.fillStyle = bGrad;
      ctx.fillRect(-br * 1.2, by - br * 1.2, br * 2.4, br * 2.4);
      ctx.fillStyle = 'rgba(42, 14, 74, 0.45)';
      ctx.beginPath();
      ctx.arc(br * 0.18, by + br * 0.22, br * 0.95, 0.05 * Math.PI, 0.95 * Math.PI);
      ctx.lineTo(-br, by + br);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(167, 139, 250, 0.44)';
      ell(ctx, -br * 0.48, by - br * 0.44, 4.0, 2.6, -0.55);
      circ(ctx, -br * 0.62, by - br * 0.16, 1.4);
      ctx.restore();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      ctx.arc(0, by, br, 0, Math.PI * 2);
      ctx.stroke(); // 4. Facial Expressions & Gag Props per State
      const eyeY = by - br * 0.12;
      const eyeX = br * 0.36;
      const pOffX = Math.max(-1.4, Math.min(1.4, px * 0.38));
      const pOffY = Math.max(-1.1, Math.min(1.1, py * 0.35));
      if (wGag < 0.5) {
        // Smoothly morphed Eyebrows between Idle (cheerful arch) and Near (stern V-scowl)
        const bOutY = lerp(eyeY - 7.0, eyeY - 7.6, wNear);
        const bMidY = lerp(eyeY - 9.2, eyeY - 6.2, wNear);
        const bInY = lerp(eyeY - 6.8, eyeY - 4.8, wNear);
        ctx.strokeStyle = INK;
        ctx.lineWidth = lerp(1.85, 2.0, wNear);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-eyeX - 3.8, bOutY);
        ctx.quadraticCurveTo(-eyeX, bMidY, -eyeX + 3.3, bInY);
        ctx.moveTo(eyeX + 3.8, bOutY);
        ctx.quadraticCurveTo(eyeX, bMidY, eyeX - 3.3, bInY);
        ctx.stroke();
        for (const dir of [-1, 1]) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.55;
          circ(ctx, dir * eyeX, eyeY, 4.2);
          ctx.stroke();
          ctx.fillStyle = INK;
          circ(ctx, dir * eyeX + pOffX, eyeY + pOffY, 2.0);
        }
        if (wNear < 0.5) {
          const mx = br * 0.12;
          const my = by + br * 0.22;
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.55;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(mx - 1.4, my, 2.9, -Math.PI * 0.45, Math.PI * 0.45);
          ctx.stroke();
          ctx.fillStyle = INK;
          const whistlePuff = tNow > 0 ? 1.0 + Math.sin(tNow * 6.0) * 0.15 : 1.0;
          ell(ctx, mx + 0.5, my, 1.4 * whistlePuff, 1.9 * whistlePuff);
          const notePhase = tNow > 0 ? (tNow * 1.6) % 1.0 : 0.2;
          const noteBob = tNow > 0 ? Math.sin(tNow * 4.5) * 1.6 : 0;
          const noteFloatY = tNow > 0 ? -notePhase * 3.5 : 0;
          ctx.save();
          ctx.translate(br * 1.3 + notePhase * 1.8, by - br * 0.25 + noteBob + noteFloatY);
          ctx.rotate(tNow > 0 ? Math.sin(tNow * 5.0) * 0.12 : 0);
          ctx.fillStyle = INK;
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.65;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ell(ctx, -2.0, 3.2, 2.7, 2.0, -0.35);
          ctx.beginPath();
          ctx.moveTo(0.2, 2.8);
          ctx.lineTo(0.2, -6.0);
          ctx.bezierCurveTo(3.2, -4.5, 5.0, -2.2, 3.8, 0.5);
          ctx.stroke();
          ctx.restore();
        } else {
          drawSweatDrop(ctx, br * 0.78, by - br * 0.34, 0.76 * clamp01(wNear * 1.2), 0, tNow);
          drawAngerVeinMark(ctx, -br * 0.72, by - br * 0.48, 0.72 * clamp01(wNear * 1.2), 0, tNow);
          const my = by + br * 0.24;
          const gaspPulse = tNow > 0 ? 1.0 + Math.sin(tNow * 16.0) * 0.08 : 1.0;
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(0, my, 3.0 * gaspPulse, 3.8 * gaspPulse, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#240d30';
          ctx.fill();
          ctx.save();
          ctx.clip();
          ctx.fillStyle = '#e05a6d';
          ell(ctx, 0.4, my + 2.5, 2.5, 2.0);
          ctx.restore();
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.55;
          ctx.stroke();
          ctx.restore();
        }
      } else {
        // STATE 3: ON-HIT GAG — > < Wince + Vibrating Brass Pea Whistle + Waving Citation Ticket!
        drawChevronWinceEyes(ctx, -eyeX, eyeX, eyeY, 7.0, 3.0, INK, 2.0, tNow);
        const wy = by + br * 0.16;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.55;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, wy, 2.8, -Math.PI * 0.55, Math.PI * 0.55);
        ctx.stroke(); // Vibrating Brass Pea Whistle
        const whistleJitter = tNow > 0 ? Math.sin(tNow * 34.0) * 0.09 : 0;
        ctx.save();
        ctx.translate(2.2, wy + 0.5);
        ctx.rotate(0.32 + whistleJitter);
        ctx.fillStyle = '#f2b726';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.55;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.roundRect(0, -2.2, 7.0, 4.2, 1.0);
        ctx.fill();
        ctx.stroke();
        circ(ctx, 8.0, 0.6, 3.8);
        ctx.stroke();
        ctx.fillStyle = '#a36a00';
        circ(ctx, 8.3, 0.8, 1.4);
        ctx.restore(); // Pulsing Whistle Sound Rays & "FWEET!" Blast
        const fweetPulse = tNow > 0 ? 1.0 + Math.sin(tNow * 20.0) * 0.09 : 1.0;
        const rayPush = tNow > 0 ? ((tNow * 3.0) % 1.0) * 2.2 : 0;
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.75;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(br * 0.64 + rayPush * 0.5, wy - 1.8 - rayPush * 0.4);
        ctx.lineTo(br * 0.8 + rayPush, wy - 4.0 - rayPush * 0.8);
        ctx.moveTo(br * 0.68 + rayPush * 0.5, wy + 1.4);
        ctx.lineTo(br * 0.84 + rayPush, wy + 1.6);
        ctx.moveTo(br * 0.62 + rayPush * 0.5, wy + 4.4 + rayPush * 0.4);
        ctx.lineTo(br * 0.76 + rayPush, wy + 6.6 + rayPush * 0.8);
        ctx.stroke();
        ctx.translate(br * 1.1, wy - 2.5);
        ctx.rotate(-0.14 + whistleJitter * 0.5);
        ctx.scale(fweetPulse, fweetPulse);
        ctx.fillStyle = INK;
        ctx.font = '900 7.2px "Trebuchet MS", "Arial Narrow", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('FWEET!', 0, 0);
        ctx.restore(); // Waving Red "UNLAWFUL HARVEST!" Citation Ticket
        const ticketWave = tNow > 0 ? Math.sin(tNow * 16.0) * 0.11 : 0;
        ctx.save();
        ctx.translate(-br * 1.16, by - 4.0);
        ctx.rotate(-0.4 + ticketWave);
        ctx.scale(gagEased, gagEased);
        ctx.fillStyle = '#d93829';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.65;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.roundRect(-10.8, -6.8, 21.6, 13.6, 1.5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.font = '900 3.3px "Arial", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('UNLAWFUL', 0, -2.1);
        ctx.fillText('HARVEST!', 0, 2.2);
        ctx.restore();
      } // 5. Iconic Wide-Brimmed Tan Mountie Stetson Campaign Hat (Smooth Trajectory Across All 3 Poses!)
      ctx.save();
      const hatX = -2.0 * wIdle + 0.0 * wNear + (3.5 + (tNow > 0 ? Math.sin(tNow * 14.0) * 1.1 : 0)) * wGag;
      const hatY =
        (by - br * 0.82) * wIdle +
        (by - br * 0.78) * wNear +
        (by - br * (0.82 + 0.8 * gagEased) - (tNow > 0 ? Math.abs(Math.sin(tNow * 16.0)) * 2.0 : 0)) * wGag;
      const hatRot =
        (-0.17 + (tNow > 0 ? Math.sin(tNow * 4.0) * 0.03 : 0)) * wIdle +
        (tNow > 0 ? Math.sin(tNow * 24.0) * 0.02 : 0) * wNear +
        (0.14 + (tNow > 0 ? Math.cos(tNow * 13.0) * 0.065 : 0)) * wGag;
      ctx.translate(hatX, hatY);
      ctx.rotate(hatRot);
      const brimW = br * 1.46;
      const crownW = br * 0.8;
      const crownH = br * 0.86;
      if (wGag > 0.3) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.35;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(-brimW * 0.72, 4.0, 7.0, Math.PI * 0.55, Math.PI * 1.05);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-brimW * 0.76, 6.0, 8.0, Math.PI * 0.58, Math.PI * 1.02);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(brimW * 0.68, 5.0, 7.0, -0.05, Math.PI * 0.45);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(brimW * 0.72, 7.2, 8.0, 0.0, Math.PI * 0.42);
        ctx.stroke();
      }
      function traceStetsonCrown(g) {
        g.beginPath();
        g.moveTo(-crownW, 0);
        g.bezierCurveTo(-crownW * 0.92, -crownH * 0.55, -crownW * 0.68, -crownH * 0.82, -crownW * 0.42, -crownH * 0.8);
        g.quadraticCurveTo(-crownW * 0.18, -crownH * 0.78, 0, -crownH);
        g.quadraticCurveTo(crownW * 0.18, -crownH * 0.78, crownW * 0.42, -crownH * 0.8);
        g.bezierCurveTo(crownW * 0.68, -crownH * 0.82, crownW * 0.92, -crownH * 0.55, crownW, 0);
        g.closePath();
      }
      ctx.save();
      traceStetsonCrown(ctx);
      ctx.fillStyle = '#d4a973';
      ctx.fill();
      ctx.clip();
      ctx.fillStyle = 'rgba(166, 118, 62, 0.32)';
      ctx.fillRect(0, -crownH * 1.1, crownW * 1.1, crownH * 1.2);
      ctx.fillStyle = '#633d1f';
      ctx.fillRect(-crownW * 1.1, -4.4, crownW * 2.2, 5.0);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-crownW * 1.1, -4.4);
      ctx.lineTo(crownW * 1.1, -4.4);
      ctx.stroke();
      ctx.restore();
      traceStetsonCrown(ctx);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.85;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.35;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-crownW * 0.44, -crownH * 0.76);
      ctx.quadraticCurveTo(-crownW * 0.25, -crownH * 0.5, -crownW * 0.14, -crownH * 0.58);
      ctx.moveTo(crownW * 0.44, -crownH * 0.76);
      ctx.quadraticCurveTo(crownW * 0.25, -crownH * 0.5, crownW * 0.14, -crownH * 0.58);
      ctx.stroke();
      ctx.fillStyle = wGag > 0.4 ? '#b88b58' : '#d4a973';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.85;
      ell(ctx, 0, 1.4, brimW, lerp(3.5, 4.8, wGag));
      ctx.stroke();
      if (wGag > 0.3) {
        ctx.fillStyle = '#85582a';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.25;
        ell(ctx, 0, 2.0, brimW * 0.54, 2.0 * wGag);
        ctx.stroke();
      }
      ctx.restore(); // End Stetson hat
      if (drawMound) {
        drawSculptedDirtMound(ctx, r * 1.05, false, tNow);
      }
      ctx.restore();
    } // Unified dispatcher for `FarmScene.ts` (`window.DBD_CROP_RENDERER`)
    function drawCanadaCharacter(ctx, type, r, state, tNow = 0, px = 0, py = 0, drawMound = false) {
      if (type === 'pei_russet') {
        drawHoserRusset(ctx, r, state, tNow, px, py, drawMound);
        return true;
      }
      if (type === 'fiddlehead') {
        drawLumberjackFiddlehead(ctx, r, state, tNow, px, py, drawMound);
        return true;
      }
      if (type === 'saskaberry') {
        drawMountieSaskaberry(ctx, r, state, tNow, px, py, drawMound);
        return true;
      }
      return false;
    } // ==========================================================================
    // Continuous State-Cycling Showcase Renderer (`IDLE -> ALERT -> SLICE -> GAG -> IDLE`)
    // Smoothly interpolates pose blend weights (`wIdle`, `wNear`, `wGag`) and
    // renders an approaching & slicing harvest scythe with spring squash-and-stretch!
    // ==========================================================================
    function drawContinuousShowcaseCycle(ctx, type, r, tNow, scale = 3.0) {
      const cycleDur = 4.5;
      const phase = (((tNow % cycleDur) + cycleDur) % cycleDur) / cycleDur;
      let st = 'idle';
      let stLabel = '▶ 1. IDLE';
      let stColor = '#15803d';
      let scytheX = 68,
        scytheY = -78,
        scytheAng = -0.4,
        showScythe = false,
        slashAlpha = 0;
      let squashX = 1.0,
        squashY = 1.0;
      let blendState = { wIdle: 1, wNear: 0, wGag: 0, alertP: 0, gagP: 0 };
      if (phase < 0.26) {
        st = 'idle';
        stLabel = '▶ 1. IDLE';
        stColor = '#15803d';
        blendState = { wIdle: 1, wNear: 0, wGag: 0, alertP: 0, gagP: 0 };
      } else if (phase < 0.34) {
        // Smooth anticipation transition from IDLE -> ALERT
        const u = smoothstep(0.26, 0.34, phase);
        st = 'near';
        stLabel = '⚡ 1→2 ANTICIPATION';
        stColor = '#d97706';
        blendState = { wIdle: 1 - u, wNear: u, wGag: 0, alertP: u, gagP: 0 };
        showScythe = true;
        scytheX = lerp(64, 48, u);
        scytheY = lerp(-72, -62, u);
        scytheAng = lerp(-0.25, -0.38, u);
        squashY = 1.0 - Math.sin(u * Math.PI) * 0.08;
        squashX = 1.0 / Math.sqrt(squashY);
      } else if (phase < 0.6) {
        // Full Cursor-Near Alert as Scythe stalks closer
        const p = (phase - 0.34) / 0.26;
        st = 'near';
        stLabel = '⚠️ 2. CURSOR-NEAR ALERT!';
        stColor = '#d97706';
        blendState = { wIdle: 0, wNear: 1, wGag: 0, alertP: 1, gagP: 0 };
        showScythe = true;
        scytheX = 48 - p * 26;
        scytheY = -62 + Math.sin(p * Math.PI * 2) * 5;
        scytheAng = -0.38 - p * 0.42;
      } else if (phase < 0.9) {
        // Scythe Swings & Smacks -> On-Hit Gag!
        const p = (phase - 0.6) / 0.3;
        const u = smoothstep(0, 0.16, p);
        st = 'gag';
        stLabel = '💥 3. ON-HIT GAG!';
        stColor = '#dc2626';
        blendState = { wIdle: 0, wNear: 1 - u, wGag: u, alertP: 1 - u, gagP: clamp01(p / 0.25) };
        if (p < 0.35) {
          showScythe = true;
          const sp = p / 0.35;
          scytheX = 22 - sp * 58;
          scytheY = -48 + sp * 22;
          scytheAng = -0.8 + sp * 2.2;
          slashAlpha = 1.0 - sp;
        }
        const damp = Math.exp(-p * 6.2) * Math.cos(p * 23.0);
        squashY = 1.0 - damp * 0.21;
        squashX = 1.0 / Math.sqrt(Math.max(0.55, squashY));
      } else {
        // Smooth Recovery from GAG -> IDLE
        const u = smoothstep(0.9, 1.0, phase);
        st = 'idle';
        stLabel = '🔄 3→1 RECOVERING';
        stColor = '#15803d';
        blendState = { wIdle: u, wNear: 0, wGag: 1 - u, alertP: 0, gagP: 1 - u };
        squashY = 1.0 + Math.sin(u * Math.PI) * 0.06;
        squashX = 1.0 / Math.sqrt(squashY);
      }
      const px = showScythe ? Math.cos(Math.atan2(scytheY + 25, scytheX)) * 1.8 : Math.sin(tNow * 2.2) * 1.1;
      const py = showScythe ? Math.sin(Math.atan2(scytheY + 25, scytheX)) * 1.4 : Math.cos(tNow * 1.7) * 0.6;
      ctx.save();
      ctx.scale(scale * squashX, scale * squashY);
      drawCanadaCharacter(ctx, type, r, blendState, tNow, px, py, true);
      if (slashAlpha > 0.02) {
        ctx.save();
        ctx.strokeStyle = `rgba(254, 240, 138, ${slashAlpha * 0.92})`;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, -r * 0.85, r * 1.35, -0.85, 0.65);
        ctx.stroke();
        ctx.restore();
      }
      if (showScythe) {
        ctx.save();
        ctx.translate(scytheX, scytheY);
        ctx.rotate(scytheAng);
        ctx.strokeStyle = '#1c1008';
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 14);
        ctx.lineTo(0, -10);
        ctx.stroke();
        ctx.strokeStyle = '#9a5b25';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = '#1c1008';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.quadraticCurveTo(-14, -12, -20, -2);
        ctx.quadraticCurveTo(-12, -6, 0, -5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      return { st, stLabel, stColor };
    }
    return {
      drawHoserRusset,
      drawLumberjackFiddlehead,
      drawMountieSaskaberry,
      drawSculptedDirtMound,
      drawCanadaCharacter,
      drawContinuousShowcaseCycle,
    };
  })();
  window.DBD_CANADA_TRIO_RENDERER =
    DBD_CANADA_TRIO_RENDERER; /* removed: window.DBD_CANADA_TRIO_SOURCE_CODE (studio-only) */ // ============================================================================
  // Authored France Trio Vector Renderer (Monsieur Échalote, Chevalier Artichaut, Diva Lavande)
  // ============================================================================
  // ============================================================================
  // Due by Dusk — France Trio Authored Vector Character Renderer
  // Faithfully implements the 3 approved France character sheets in pure Canvas 2D:
  //   1. Monsieur Échalote (`echalote`, r: 24) — French Grey Shallot (Parisian Artist/Mime)
  //   2. Chevalier Artichaut (`artichaut`, r: 28) — Brittany Globe Artichoke (Musketeer)
  //   3. Diva Lavande (`lavender`, r: 24) — Provence Lavender Bundle (Couture Snob)
  //
  // Each character supports 3 distinct states matching the character sheets:
  //   - State 1 (`idle`):          !cursorNear && !shocked
  //   - State 2 (`near`):          cursorNear && !shocked
  //   - State 3 (`gag`/`shocked`): shocked (on-hit counter / slapstick gag)
  // ============================================================================
  // ============================================================================
  // Due by Dusk — Complete France Trio Authored Vector Character Renderer
  // Faithfully implements all 3 France Trio characters in pure HTML5 Canvas 2D
  // with continuous 60fps animations AND smooth pose-to-pose interpolation
  // between their 3 poses (`1. IDLE <-> 2. CURSOR-NEAR ALERT <-> 3. ON-HIT GAG`):
  //
  //   1. Monsieur Échalote (`echalote`, r: 24) — French Grey Shallot (Snobby Parisian Artist / Mime)
  //   2. Chevalier Artichaut (`artichaut`, r: 28) — Brittany Globe Artichoke (Pompous Musketeer)
  //   3. Diva Lavande (`lavender`, r: 24) — Provence Lavender Bundle (Haute-Couture Perfume Snob)
  //
  // Supported States:
  //   - State 1 (`idle`):          !cursorNear && !shocked (continuous 60fps idle animation)
  //   - State 2 (`near`):          cursorNear && !shocked  (continuous 60fps cursor-near alert animation)
  //   - State 3 (`gag`/`shocked`): shocked                 (continuous 60fps on-hit slapstick gag animation)
  //   - Smooth Blend Object:       { wIdle, wNear, wGag, alertP, gagP } for continuous pose-to-pose morphing!
  //
  // Also includes `drawContinuousShowcaseCycle(...)` which renders a continuous
  // animated state-machine loop (`IDLE -> ANTICIPATION -> CURSOR-NEAR ALERT -> SCYTHE SWING -> ON-HIT GAG -> RECOVERY`)
  // with an approaching & slicing scythe cursor so you can watch the full in-field
  // reaction sequence continuously!
  // ============================================================================
  const DBD_FRANCE_TRIO_RENDERER = (() => {
    'use strict';
    function ell(ctx, x, y, rx, ry, rot = 0) {
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
      ctx.fill();
    }
    function circ(ctx, x, y, r) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
      ctx.fill();
    }
    function lerp(a, b, t) {
      return a + (b - a) * t;
    }
    function clamp01(t) {
      return Math.max(0, Math.min(1, t));
    }
    function smoothstep(a, b, t) {
      const u = clamp01((t - a) / Math.max(1e-5, b - a));
      return u * u * (3 - 2 * u);
    }
    function easeOutBack(t) {
      const u = clamp01(t);
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
    }
    function lerpHex(c1, c2, t) {
      const u = clamp01(t);
      const p1 = parseInt(c1.slice(1), 16);
      const p2 = parseInt(c2.slice(1), 16);
      const r = Math.round(lerp((p1 >> 16) & 255, (p2 >> 16) & 255, u));
      const g = Math.round(lerp((p1 >> 8) & 255, (p2 >> 8) & 255, u));
      const b = Math.round(lerp(p1 & 255, p2 & 255, u));
      return `rgb(${r},${g},${b})`;
    }
    function resolvePoseWeights(state, tNow = 0) {
      if (state && typeof state === 'object') {
        return {
          wIdle: state.wIdle ?? 0,
          wNear: state.wNear ?? 0,
          wGag: state.wGag ?? 0,
          alertP: state.alertP ?? state.wNear ?? 0,
          gagP: state.gagP ?? state.wGag ?? 0,
        };
      }
      if (state === 'near') {
        return { wIdle: 0, wNear: 1, wGag: 0, alertP: 1, gagP: 0 };
      }
      if (state === 'gag' || state === 'shocked') {
        return { wIdle: 0, wNear: 0, wGag: 1, alertP: 0, gagP: 1 };
      }
      return { wIdle: 1, wNear: 0, wGag: 0, alertP: 0, gagP: 0 };
    } // Sculpted layered dirt mound at (0, 0) matching the reference sheets
    function drawSculptedDirtMound(ctx, r, withLeftSprout = false, withRightClods = false, tNow = 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(43, 23, 8, 0.11)';
      ell(ctx, 0, 4.6, r * 0.94, r * 0.15);
      if (withLeftSprout) {
        const sproutSway = tNow > 0 ? Math.sin(tNow * 3.2) * 0.08 : 0;
        ctx.save();
        ctx.translate(-r * 0.65, -1.0);
        ctx.rotate(sproutSway);
        ctx.strokeStyle = '#2b1708';
        ctx.lineWidth = 1.3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(2, 2);
        ctx.quadraticCurveTo(-1.5, -2.5, -3.5, -6.2);
        ctx.stroke();
        for (const [lx, ly, rot, rx, ry] of [
          [-5.0, -6.8, -0.52, 3.0, 1.35],
          [-1.0, -6.5, 0.55, 2.5, 1.25],
        ]) {
          ctx.fillStyle = '#6b8e23';
          ctx.strokeStyle = '#2b1708';
          ctx.lineWidth = 1.15;
          ell(ctx, lx, ly, rx, ry, rot);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.fillStyle = '#4a2e16';
      ctx.strokeStyle = '#2b1708';
      ctx.lineWidth = 1.65;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.78, 3.4);
      ctx.quadraticCurveTo(-r * 0.8, -1.0, -r * 0.54, -1.4);
      ctx.quadraticCurveTo(-r * 0.4, -5.0, -r * 0.14, -3.9);
      ctx.quadraticCurveTo(0, -5.4, r * 0.16, -3.9);
      ctx.quadraticCurveTo(r * 0.42, -5.0, r * 0.54, -1.4);
      ctx.quadraticCurveTo(r * 0.8, -1.0, r * 0.78, 3.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#2b1708';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(-r * 0.24, -0.4, r * 0.15, Math.PI * 1.1, Math.PI * 1.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r * 0.22, -0.2, r * 0.16, Math.PI * 1.15, Math.PI * 1.9);
      ctx.stroke();
      if (withRightClods) {
        const clodBob = tNow > 0 ? Math.abs(Math.sin(tNow * 14.0)) * 2.2 : 0;
        ctx.fillStyle = '#4a2e16';
        ctx.strokeStyle = '#2b1708';
        ctx.lineWidth = 1.3;
        ell(ctx, r * 0.66 + clodBob * 0.3, -6.2 - clodBob, 2.5, 1.7, -0.35);
        ctx.stroke();
        ell(ctx, r * 0.12, 3.8, 3.2, 1.8, 0.1);
        ctx.stroke();
      }
      ctx.restore();
    } // Glossy blue cartoon sweat drop — slides & bobbles continuously when tNow > 0!
    function drawSweatDrop(ctx, x, y, scale = 1.0, rot = 0, tNow = 0) {
      if (scale <= 0.02) return;
      const slideY = tNow > 0 ? ((tNow * 1.85) % 1.0) * 2.5 : 0;
      const pulse = tNow > 0 ? 1.0 - ((tNow * 1.85) % 1.0) * 0.12 : 1.0;
      ctx.save();
      ctx.translate(x, y + slideY);
      ctx.rotate(rot);
      ctx.scale(scale * pulse, scale * pulse);
      ctx.fillStyle = '#5bc0eb';
      ctx.strokeStyle = '#231815';
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -6.5);
      ctx.bezierCurveTo(4.0, -1.2, 4.3, 4.0, 0, 4.4);
      ctx.bezierCurveTo(-4.3, 4.0, -4.0, -1.2, 0, -6.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e0f7ff';
      ell(ctx, -1.0, 0.8, 0.9, 1.9, -0.2);
      ctx.restore();
    } // Red 4-vein anime anger cross (`💢`) — throbs continuously when tNow > 0!
    function drawAngerVeinMark(ctx, x, y, scale = 1.0, rot = 0, tNow = 0) {
      if (scale <= 0.02) return;
      const pulse = tNow > 0 ? 1.0 + Math.sin(tNow * 14.0) * 0.15 : 1.0;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(scale * pulse, scale * pulse);
      ctx.strokeStyle = '#d62828';
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 2);
        ctx.beginPath();
        ctx.moveTo(-4.2, -1.4);
        ctx.quadraticCurveTo(-1.4, -1.4, -1.4, -4.2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    } // Crisp > < chevron wince eyes (State 3 On-Hit Gag — pulses with impact energy!)
    function drawChevronWinceEyes(ctx, leftX, rightX, eyeY, w, h, ink = '#231815', lw = 2.0, tNow = 0) {
      const squeeze = tNow > 0 ? 1.0 + Math.sin(tNow * 20.0) * 0.08 : 1.0;
      const hw = w * squeeze;
      const hh = h / squeeze;
      ctx.save();
      ctx.strokeStyle = ink;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(leftX - hw * 0.55, eyeY - hh);
      ctx.lineTo(leftX + hw * 0.45, eyeY);
      ctx.lineTo(leftX - hw * 0.55, eyeY + hh);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rightX + hw * 0.55, eyeY - hh);
      ctx.lineTo(rightX - hw * 0.45, eyeY);
      ctx.lineTo(rightX + hw * 0.55, eyeY + hh);
      ctx.stroke();
      ctx.restore();
    } // Clean Jagged Spiky Comic Explosion Speech Bubble for MERDE! and PUTAIN! — pulses when tNow > 0!
    function drawSpikyExplosionBubble(
      ctx,
      cx,
      cy,
      rx,
      ry,
      tailTipX,
      tailTipY,
      text,
      fontSize = 5.5,
      tNow = 0,
      popScale = 1.0,
    ) {
      if (popScale <= 0.05) return;
      const pulse = (tNow > 0 ? 1.0 + Math.sin(tNow * 16.0) * 0.045 : 1.0) * popScale;
      ctx.save();
      const spikes = 14;
      const total = spikes * 2;
      const targetAng = Math.atan2(tailTipY - cy, tailTipX - cx);
      let bestOuterIdx = 0;
      let bestDiff = 999;
      for (let i = 0; i < total; i += 2) {
        const ang = (i * Math.PI) / spikes;
        const diff = Math.abs(Math.atan2(Math.sin(ang - targetAng), Math.cos(ang - targetAng)));
        if (diff < bestDiff) {
          bestDiff = diff;
          bestOuterIdx = i;
        }
      }
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 1.6;
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 6;
      ctx.beginPath();
      for (let i = 0; i < total; i++) {
        if (i === bestOuterIdx) {
          ctx.lineTo(tailTipX, tailTipY);
          continue;
        }
        const ang = (i * Math.PI) / spikes;
        const isOuter = i % 2 === 0;
        const radX = (isOuter ? rx * (i % 4 === 0 ? 1.2 : 1.1) : rx * 0.88) * pulse;
        const radY = (isOuter ? ry * (i % 4 === 0 ? 1.22 : 1.12) : ry * 0.86) * pulse;
        const px = cx + Math.cos(ang) * radX;
        const py = cy + Math.sin(ang) * radY;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.translate(cx, cy + 0.4);
      ctx.rotate(tNow > 0 ? Math.sin(tNow * 18.0) * 0.025 : 0);
      ctx.scale(popScale, popScale);
      ctx.fillStyle = '#1c1917';
      ctx.font = `italic 900 ${fontSize}px "Arial Black", "Impact", "Trebuchet MS", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 0);
      ctx.restore();
      ctx.restore();
    } // ==========================================================================
    // 1. MONSIEUR ÉCHALOTE (`echalote`, base r = 24)
    //    French Grey Shallot — Snobby Parisian Artist / Mime
    // ==========================================================================
    function drawMonsieurEchalote(ctx, r, state, tNow = 0, px = 0, py = 0, drawMound = true) {
      const INK = '#211116';
      const { wIdle, wNear, wGag, alertP, gagP } = resolvePoseWeights(state, tNow);
      const gagEased = easeOutBack(clamp01(gagP));
      const breatheY = wIdle * (tNow > 0 ? Math.sin(tNow * 3.8) * 0.016 : 0);
      const squatY = wNear * (1.1 + (tNow > 0 ? Math.sin(tNow * 16.0) * 0.35 : 0));
      const gagJumpY = wGag * (tNow > 0 ? -Math.abs(Math.sin(tNow * 12.0)) * 1.4 : 0);
      const jitterX =
        wNear * (tNow > 0 ? Math.sin(tNow * 28.0) * 0.45 : 0) + wGag * (tNow > 0 ? Math.sin(tNow * 24.0) * 0.45 : 0);
      const bodyRot =
        wIdle * (tNow > 0 ? Math.sin(tNow * 2.0) * 0.018 : 0) +
        wNear * (tNow > 0 ? 0.014 * Math.sin(tNow * 18.0) : 0) +
        wGag * (0.02 + (tNow > 0 ? Math.sin(tNow * 16.0) * 0.025 : 0));
      ctx.save();
      ctx.translate(jitterX, squatY + gagJumpY); // 1. In Pose 3 (On-Hit Gag): Stubby Shallot Arms & Swinging Golden French Baguette!
      if (wGag > 0.15) {
        const bagSwing = tNow > 0 ? Math.sin(tNow * 16.0) * 0.18 : 0;
        const armScale = clamp01(gagEased);
        ctx.save();
        ctx.globalAlpha = clamp01(wGag * 1.3);
        ctx.scale(armScale, armScale); // Left arm swinging baguette
        ctx.fillStyle = '#b84c5e';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.75;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.64, -r * 0.38);
        ctx.quadraticCurveTo(-r * 0.96, -r * 0.42 + bagSwing * 8, -r * 1.0, -r * 0.6 + bagSwing * 10);
        ctx.quadraticCurveTo(-r * 0.88, -r * 0.68 + bagSwing * 10, -r * 0.66, -r * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Right arm flung out in shock
        ctx.beginPath();
        ctx.moveTo(r * 0.64, -r * 0.4);
        ctx.quadraticCurveTo(r * 0.96, -r * 0.46 - bagSwing * 8, r * 0.98, -r * 0.66 - bagSwing * 10);
        ctx.quadraticCurveTo(r * 0.86, -r * 0.7 - bagSwing * 10, r * 0.66, -r * 0.52);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Golden French Baguette held in left hand (swings continuously!)
        ctx.save();
        ctx.translate(-r * 0.95, -r * 0.84 + bagSwing * 8);
        ctx.rotate(0.24 + bagSwing);
        ctx.fillStyle = '#e8ad4a';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.16, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f7cf7c';
        ell(ctx, -0.8, 0, r * 0.08, r * 0.4);
        ctx.strokeStyle = '#9c5718';
        ctx.lineWidth = 1.35;
        for (const sy of [-r * 0.22, 0, r * 0.22]) {
          ctx.beginPath();
          ctx.moveTo(-2.0, sy - 2.0);
          ctx.lineTo(2.0, sy + 1.6);
          ctx.stroke();
        }
        ctx.restore(); // Motion lines next to the swinging baguette
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(-r * 0.94, -r * 0.86 + bagSwing * 6, r * 0.34, Math.PI * 0.82, Math.PI * 1.18);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-r * 1.0, -r * 0.86 + bagSwing * 6, r * 0.4, Math.PI * 0.86, Math.PI * 1.14);
        ctx.stroke();
        ctx.restore();
      } // 2. Plump Teardrop Shallot Bulb Silhouette with Tall Cut Fibrous Stem Tip
      function traceShallotBody(g) {
        g.beginPath();
        const topY1 = lerp(-r * 1.7, -r * 1.64, wGag);
        const topY2 = lerp(-r * 1.74, -r * 1.58, wGag);
        const topY3 = lerp(-r * 1.78, -r * 1.68, wGag);
        const topY4 = lerp(-r * 1.72, -r * 1.59, wGag);
        const topY5 = lerp(-r * 1.4, -r * 1.65, wGag);
        g.moveTo(-r * 0.14, topY1);
        g.lineTo(-r * 0.06, topY2);
        g.lineTo(0.02, topY3);
        g.lineTo(r * 0.1, topY4);
        g.lineTo(r * 0.14, topY5);
        g.bezierCurveTo(r * 0.24, -r * 1.32, r * 0.8, -r * 1.14, r * 0.8, -r * 0.64);
        g.bezierCurveTo(r * 0.8, -r * 0.16, r * 0.46, r * 0.02, 0, r * 0.02);
        g.bezierCurveTo(-r * 0.46, r * 0.02, -r * 0.8, -r * 0.16, -r * 0.8, -r * 0.64);
        g.bezierCurveTo(-r * 0.8, -r * 1.14, -r * 0.2, -r * 1.34, -r * 0.14, topY1);
        g.closePath();
      }
      ctx.save();
      ctx.rotate(bodyRot);
      ctx.scale(1 - breatheY * 0.5, 1 + breatheY);
      ctx.save();
      traceShallotBody(ctx);
      ctx.fillStyle = lerpHex('#b56c6e', '#e63946', wGag);
      ctx.fill();
      ctx.clip();
      const bGrad = ctx.createRadialGradient(lerp(r * 0.16, 0, wGag), -r * 0.85, r * 0.09, 0, -r * 0.73, r * 0.98);
      bGrad.addColorStop(0, lerpHex('#de9e8e', '#ff4747', wGag));
      bGrad.addColorStop(0.58, lerpHex('#b56c6e', '#e03546', wGag));
      bGrad.addColorStop(1, lerpHex('#6e3844', '#94354a', wGag));
      ctx.fillStyle = bGrad;
      ctx.fillRect(-r, -r * 1.85, r * 2, r * 1.95);
      if (wGag > 0.2) {
        ctx.fillStyle = `rgba(255, 185, 195, ${0.55 * wGag})`;
        ell(ctx, -r * 0.34, -r * 1.0, 3.8, 2.4, -0.55);
        circ(ctx, -r * 0.46, -r * 0.82, 1.4);
      }
      ctx.fillStyle = 'rgba(62, 22, 34, 0.32)';
      ctx.beginPath();
      ctx.moveTo(-r * 0.25, -r * 1.55);
      ctx.bezierCurveTo(-r * 0.75, -r * 0.95, -r * 0.62, -r * 0.16, r * 0.45, -r * 0.02);
      ctx.lineTo(-r * 0.95, r * 0.1);
      ctx.lineTo(-r * 0.95, -r * 1.55);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = wGag > 0.5 ? 'rgba(110, 20, 32, 0.38)' : 'rgba(78, 32, 42, 0.38)';
      ctx.lineWidth = 1.2;
      for (const rxOff of [-0.52, -0.24, 0.24, 0.52]) {
        ctx.beginPath();
        ctx.moveTo(rxOff * r * 0.18, -r * 1.62);
        ctx.bezierCurveTo(rxOff * r * 0.86, -r * 1.05, rxOff * r * 0.86, -r * 0.32, rxOff * r * 0.36, 0);
        ctx.stroke();
      }
      ctx.restore();
      traceShallotBody(ctx);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.85;
      ctx.lineJoin = 'round';
      ctx.stroke(); // 3. Facial Expressions & Twirling Curled Handlebar Mustache per State
      const eyeY = -r * 0.72;
      const eyeX = r * 0.28;
      const pOffX = Math.max(-1.6, Math.min(1.6, px * 0.45));
      const pOffY = Math.max(-1.0, Math.min(1.0, py * 0.35));
      function drawHandlebarMustache(mx, my, scale = 1.0) {
        const twitch = tNow > 0 ? Math.sin(tNow * (wGag > 0.5 ? 20.0 : 8.5)) * 0.04 : 0;
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(twitch);
        ctx.scale(scale, scale);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const dir of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(dir * 0.6, 0.4);
          ctx.bezierCurveTo(dir * 3.0, -2.2, dir * 5.8, 2.2, dir * 8.4, 0.2);
          ctx.bezierCurveTo(dir * 9.8, -0.9, dir * 9.0, -2.8, dir * 7.6, -1.6);
          ctx.stroke();
        }
        ctx.restore();
      }
      if (wGag < 0.5) {
        // Smoothly morphed Eyebrows between Idle and Near
        const bOutY = lerp(eyeY - 6.6, eyeY - 7.0, wNear);
        const bMidY = lerp(eyeY - 8.2, eyeY - 5.5, wNear);
        const bInY = lerp(eyeY - 6.8, eyeY - 4.0, wNear);
        ctx.strokeStyle = INK;
        ctx.lineWidth = lerp(1.85, 1.95, wNear);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-eyeX - 3.8, bOutY);
        ctx.quadraticCurveTo(-eyeX, bMidY, -eyeX + 3.5, bInY);
        ctx.moveTo(eyeX + 3.8, bOutY);
        ctx.quadraticCurveTo(eyeX, bMidY, eyeX - 3.5, bInY);
        ctx.stroke();
        if (wNear < 0.5) {
          for (const dir of [-1, 1]) {
            const ex = dir * eyeX;
            ctx.save();
            ctx.beginPath();
            ctx.arc(ex, eyeY - 0.5, 4.0, 0, Math.PI, false);
            ctx.closePath();
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.clip();
            ctx.fillStyle = INK;
            circ(ctx, ex + 0.8 + pOffX * 0.8, eyeY + 0.8 + pOffY * 0.8, 1.85);
            ctx.restore();
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.65;
            ctx.beginPath();
            ctx.arc(ex, eyeY - 0.5, 4.0, 0, Math.PI, false);
            ctx.closePath();
            ctx.stroke();
          }
          drawHandlebarMustache(0, -r * 0.53, 1.0);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(r * 0.02, -r * 0.42, 1.9, -Math.PI * 0.45, Math.PI * 0.55);
          ctx.stroke(); // Curved brown wooden bubble pipe (bobs gently as he puffs!)
          const pipeBob = tNow > 0 ? Math.sin(tNow * 4.2) * 0.05 : 0;
          ctx.save();
          ctx.translate(r * 0.05, -r * 0.42);
          ctx.rotate(pipeBob);
          ctx.fillStyle = '#a46444';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.55;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(0, -0.7);
          ctx.quadraticCurveTo(r * 0.32, 1.0, r * 0.46, 2.0);
          ctx.lineTo(r * 0.46, -1.2);
          ctx.quadraticCurveTo(r * 0.66, -1.6, r * 0.7, -1.2);
          ctx.bezierCurveTo(r * 0.74, 4.4, r * 0.54, 6.2, r * 0.36, 4.8);
          ctx.quadraticCurveTo(r * 0.2, 3.4, 0, 0.7);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#3d1e12';
          ell(ctx, r * 0.58, -1.2, 2.8, 1.0);
          ctx.stroke();
          ctx.restore(); // Continuous rising & drifting soap bubbles!
          const bShift = tNow > 0 ? Math.sin(tNow * 3.4) * 1.8 : 0;
          const bRise = tNow > 0 ? ((tNow * 1.2) % 1.0) * 3.2 : 0;
          for (const [bx, by0, br2, sgn] of [
            [r * 0.84, -r * 0.62, 2.2, 1],
            [r * 1.02, -r * 0.88, 3.4, -1],
            [r * 0.8, -r * 1.12, 2.4, 1],
            [r * 0.98, -r * 1.32, 1.4, -1],
          ]) {
            const curBx = bx + sgn * bShift * 0.45;
            const curBy = by0 - bRise * 0.8;
            ctx.fillStyle = 'rgba(226, 232, 240, 0.78)';
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 1.15;
            circ(ctx, curBx, curBy, br2);
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            circ(ctx, curBx - br2 * 0.32, curBy - br2 * 0.32, br2 * 0.28);
          }
        } else {
          drawAngerVeinMark(ctx, r * 0.28, -r * 1.06, 0.82 * clamp01(wNear * 1.2), 0, tNow);
          drawSweatDrop(ctx, r * 0.6, -r * 0.88, 0.8 * clamp01(wNear * 1.2), 0, tNow);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.15;
          ctx.beginPath();
          ctx.moveTo(-1.4, eyeY - 6.6);
          ctx.lineTo(-1.0, eyeY - 4.2);
          ctx.moveTo(1.4, eyeY - 6.6);
          ctx.lineTo(1.0, eyeY - 4.2);
          ctx.stroke();
          for (const dir of [-1, 1]) {
            const ex = dir * eyeX;
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.55;
            ctx.beginPath();
            ctx.roundRect(ex - 3.8, eyeY - 2.2, 7.6, 4.4, 1.3);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = INK;
            circ(ctx, ex + 0.9 + pOffX, eyeY + pOffY, 1.8);
          }
          drawHandlebarMustache(0, -r * 0.53, 1.0);
          const my = -r * 0.37;
          const snarlPulse = tNow > 0 ? Math.sin(tNow * 18.0) * 0.35 : 0;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(-r * 0.15, my + 2.0);
          ctx.bezierCurveTo(-r * 0.15, my - 3.0 - snarlPulse, r * 0.17, my - 3.0 - snarlPulse, r * 0.15, my + 1.8);
          ctx.quadraticCurveTo(0, my + 0.8, -r * 0.15, my + 2.0);
          ctx.closePath();
          ctx.fillStyle = '#3a141c';
          ctx.fill();
          ctx.save();
          ctx.clip();
          ctx.fillStyle = '#e06377';
          ell(ctx, 1.0, my + 1.6, 3.0, 1.6);
          ctx.restore();
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }
      } else {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.0;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-eyeX - 3.0, eyeY - 7.8);
        ctx.lineTo(-eyeX + 3.0, eyeY - 4.6);
        ctx.moveTo(eyeX + 3.0, eyeY - 7.8);
        ctx.lineTo(eyeX - 3.0, eyeY - 4.6);
        ctx.stroke();
        drawChevronWinceEyes(ctx, -eyeX, eyeX, eyeY - 0.5, 7.0, 2.8, INK, 2.0, tNow);
        drawHandlebarMustache(0, -r * 0.55, 1.0);
        const my = -r * 0.34;
        const shoutPulse = tNow > 0 ? Math.sin(tNow * 18.0) * 0.5 : 0;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(-r * 0.14, my + 3.8 + shoutPulse);
        ctx.bezierCurveTo(
          -r * 0.16,
          my - 5.2 - shoutPulse,
          r * 0.18,
          my - 5.2 - shoutPulse,
          r * 0.16,
          my + 3.8 + shoutPulse,
        );
        ctx.quadraticCurveTo(0, my + 2.2, -r * 0.14, my + 3.8 + shoutPulse);
        ctx.closePath();
        ctx.fillStyle = '#2d0e16';
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#e05a6d';
        ell(ctx, -1.0, my + 2.8, 3.2, 2.0, -0.15);
        ctx.restore();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.65;
        ctx.stroke();
        ctx.restore();
      } // 4. Black French Beret (Smooth Trajectory from Head to Airborne!)
      ctx.save();
      const beretX = lerp(-r * 0.14, r * 0.02, wGag) + wGag * (tNow > 0 ? Math.sin(tNow * 14.0) * 1.0 : 0);
      const beretY = lerp(
        -r * 1.19,
        -r * (1.19 + 0.77 * gagEased) - (tNow > 0 ? Math.abs(Math.sin(tNow * 16.0)) * 1.8 : 0),
        wGag,
      );
      const beretRot =
        -0.38 +
        wIdle * (tNow > 0 ? Math.sin(tNow * 3.8) * 0.025 : 0) +
        wNear * (tNow > 0 ? Math.sin(tNow * 22.0) * 0.025 : 0) +
        wGag * (-0.02 + (tNow > 0 ? Math.cos(tNow * 14.0) * 0.07 : 0));
      ctx.translate(beretX, beretY);
      ctx.rotate(beretRot);
      ctx.fillStyle = '#18181b';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.75;
      ell(ctx, 0, 2.2, r * 0.54, lerp(2.4, 3.5, wGag));
      ctx.stroke();
      ctx.fillStyle = '#2b2b30';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.85;
      ctx.beginPath();
      ctx.moveTo(-r * 0.54, 2.0);
      ctx.bezierCurveTo(-r * 0.8, 2.2, -r * 0.82, -r * 0.3, -r * 0.15, -r * 0.36);
      ctx.bezierCurveTo(r * 0.6, -r * 0.4, r * 0.74, -r * 0.06, r * 0.52, 2.0);
      ctx.quadraticCurveTo(0, 0.2, -r * 0.54, 2.0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
      ell(ctx, r * 0.2, -r * 0.18, r * 0.24, r * 0.1, 0.1);
      ctx.fillStyle = '#2b2b30';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-r * 0.26, -r * 0.32);
      ctx.quadraticCurveTo(-r * 0.34, -r * 0.48, -r * 0.24, -r * 0.5);
      ctx.quadraticCurveTo(-r * 0.16, -r * 0.48, -r * 0.18, -r * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (wGag > 0.3) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.35;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(-r * 0.48, 2.8, 6.2, Math.PI * 0.5, Math.PI * 1.0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-r * 0.53, 4.8, 7.2, Math.PI * 0.55, Math.PI * 0.98);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(r * 0.46, -r * 0.2, 6.4, -Math.PI * 0.35, Math.PI * 0.15);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(r * 0.52, -r * 0.22, 7.4, -Math.PI * 0.32, Math.PI * 0.12);
        ctx.stroke();
      }
      ctx.restore(); // End beret
      ctx.restore(); // End body transform
      // 5. Round "SACRÉ BLEU!" Comic Speech Bubble in Pose 3 (On-Hit Gag — pulses & pops!)
      if (wGag > 0.2) {
        const bubblePulse = (tNow > 0 ? 1.0 + Math.sin(tNow * 16.0) * 0.045 : 1.0) * clamp01(gagEased);
        ctx.save();
        const bx = r * 1.04;
        const by0 = -r * 1.3;
        const br0 = r * 0.46;
        ctx.translate(bx, by0);
        ctx.scale(bubblePulse, bubblePulse);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.65;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, br0, 0.72 * Math.PI, 0.52 * Math.PI, false);
        ctx.lineTo(-br0 * 0.58, br0 * 1.18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.font = '900 5.4px "Trebuchet MS", "Arial Narrow", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SACRÉ', 0, -2.8);
        ctx.fillText('BLEU!', 0, 3.2);
        ctx.restore();
      }
      if (drawMound) {
        drawSculptedDirtMound(ctx, r * 1.02, false, false, tNow);
      }
      ctx.restore();
    } // ==========================================================================
    // 2. CHEVALIER ARTICHAUT (`artichaut`, base r = 28)
    //    Brittany Globe Artichoke — Pompous Musketeer
    // ==========================================================================
    function drawChevalierArtichaut(ctx, r, state, tNow = 0, px = 0, py = 0, drawMound = true) {
      const INK = '#192412';
      const { wIdle, wNear, wGag, alertP, gagP } = resolvePoseWeights(state, tNow);
      const gagEased = easeOutBack(clamp01(gagP));
      const breatheY = wIdle * (tNow > 0 ? Math.sin(tNow * 3.8) * 0.016 : 0);
      const squatY = wNear * (1.1 + (tNow > 0 ? Math.sin(tNow * 18.0) * 0.35 : 0));
      const gagJumpY = wGag * (tNow > 0 ? -Math.abs(Math.sin(tNow * 12.0)) * 1.3 : 0);
      const bodyRot =
        wIdle * (tNow > 0 ? Math.sin(tNow * 2.2) * 0.014 : 0) +
        wNear * (tNow > 0 ? 0.016 * Math.sin(tNow * 22.0) : 0) +
        wGag * (tNow > 0 ? 0.02 * Math.sin(tNow * 18.0) : 0);
      ctx.save();
      ctx.translate(0, squatY + gagJumpY);
      ctx.rotate(bodyRot);
      ctx.scale(1 - breatheY * 0.4, 1 + breatheY); // 1. Sturdy Green Artichoke Stalk (Idle & Near) smoothly splitting into Wide Fencing Stance Legs (Gag)
      if (wGag < 0.35) {
        ctx.fillStyle = '#5ca828';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.75;
        ctx.beginPath();
        ctx.moveTo(-r * 0.16, 1.0);
        ctx.lineTo(-r * 0.18, -r * 0.34);
        ctx.lineTo(r * 0.18, -r * 0.34);
        ctx.lineTo(r * 0.16, 1.0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(25, 36, 18, 0.35)';
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.moveTo(-r * 0.04, 0);
        ctx.lineTo(-r * 0.04, -r * 0.3);
        ctx.stroke();
      } else {
        const stanceSpread = clamp01(gagEased);
        ctx.fillStyle = '#5ca828';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.75;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.36 * stanceSpread, 1.5);
        ctx.quadraticCurveTo(-r * 0.3 * stanceSpread, -r * 0.22, -r * 0.12, -r * 0.32);
        ctx.lineTo(-r * 0.02, -r * 0.2);
        ctx.quadraticCurveTo(-r * 0.18 * stanceSpread, -r * 0.12, -r * 0.22 * stanceSpread, 1.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.38 * stanceSpread, 1.5);
        ctx.quadraticCurveTo(r * 0.44 * stanceSpread, -r * 0.18, r * 0.14, -r * 0.32);
        ctx.lineTo(r * 0.04, -r * 0.2);
        ctx.quadraticCurveTo(r * 0.24 * stanceSpread, -r * 0.12, r * 0.24 * stanceSpread, 1.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } // 2. Arms & Fencing Rapier Sword (with rapid fencing lunge thrust in Gag!)
      if (wGag < 0.35 && wNear < 0.5) {
        const armBreath = tNow > 0 ? Math.sin(tNow * 3.8) * 0.03 : 0;
        ctx.fillStyle = '#5ca828';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.75;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.46, -r * 0.82);
        ctx.bezierCurveTo(-r * (0.78 + armBreath), -r * 0.74, -r * (0.8 + armBreath), -r * 0.44, -r * 0.48, -r * 0.44);
        ctx.quadraticCurveTo(-r * 0.38, -r * 0.46, -r * 0.4, -r * 0.56);
        ctx.bezierCurveTo(-r * 0.58, -r * 0.56, -r * 0.58, -r * 0.68, -r * 0.42, -r * 0.72);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.46, -r * 0.82);
        ctx.bezierCurveTo(r * (0.76 + armBreath), -r * 0.74, r * (0.76 + armBreath), -r * 0.46, r * 0.48, -r * 0.46);
        ctx.quadraticCurveTo(r * 0.4, -r * 0.48, r * 0.42, -r * 0.56);
        ctx.bezierCurveTo(r * 0.56, -r * 0.56, r * 0.56, -r * 0.68, r * 0.42, -r * 0.72);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (wGag >= 0.35) {
        const thrustOsc = tNow > 0 ? Math.sin(tNow * 18.0) * 2.2 : 0;
        const swordRot = -0.78 + (tNow > 0 ? Math.sin(tNow * 18.0) * 0.09 : 0);
        ctx.fillStyle = '#5ca828';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.75;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.46, -r * 0.68);
        ctx.bezierCurveTo(-r * 0.74, -r * 0.68, -r * 0.8, -r * 0.46, -r * 0.68, -r * 0.42);
        ctx.quadraticCurveTo(-r * 0.58, -r * 0.4, -r * 0.58, -r * 0.52);
        ctx.lineTo(-r * 0.42, -r * 0.56);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.44, -r * 0.58);
        ctx.quadraticCurveTo(r * 0.66, -r * 0.56, r * 0.72 + thrustOsc * 0.4, -r * 0.48 - thrustOsc * 0.3);
        ctx.quadraticCurveTo(r * 0.68, -r * 0.38, r * 0.42, -r * 0.44);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Animated Fencing Rapier Sword
        ctx.save();
        ctx.translate(r * 0.68 + thrustOsc * 0.5, -r * 0.48 - thrustOsc * 0.5);
        ctx.rotate(swordRot);
        ctx.fillStyle = '#784421';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ctx.beginPath();
        ctx.roundRect(-5.5, -1.6, 5.5, 3.2, 1.0);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(2.0, -1.5);
        ctx.lineTo(r * 0.82, 0);
        ctx.lineTo(2.0, 1.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#eab308';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(1.5, 0, 2.2, 4.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } // 3. Tall Upper Artichoke Crown Head (smoothly flushes crimson by wGag!)
      function traceCrownHead(g) {
        g.beginPath();
        if (wGag < 0.5) {
          g.moveTo(0, -r * 1.56);
          g.bezierCurveTo(r * 0.44, -r * 1.56, r * 0.52, -r * 1.12, r * 0.46, -r * 0.62);
          g.lineTo(-r * 0.46, -r * 0.62);
          g.bezierCurveTo(-r * 0.52, -r * 1.12, -r * 0.44, -r * 1.56, 0, -r * 1.56);
        } else {
          g.moveTo(-r * 0.16, -r * 1.42);
          g.quadraticCurveTo(-r * 0.08, -r * 1.52, -r * 0.02, -r * 1.46);
          g.quadraticCurveTo(0.02, -r * 1.54, r * 0.08, -r * 1.5);
          g.quadraticCurveTo(r * 0.16, -r * 1.46, r * 0.22, -r * 1.38);
          g.bezierCurveTo(r * 0.46, -r * 1.22, r * 0.52, -r * 0.94, r * 0.46, -r * 0.58);
          g.lineTo(-r * 0.46, -r * 0.58);
          g.bezierCurveTo(-r * 0.52, -r * 0.94, -r * 0.44, -r * 1.24, -r * 0.16, -r * 1.42);
        }
        g.closePath();
      }
      ctx.save();
      traceCrownHead(ctx);
      ctx.fillStyle = lerpHex('#7ac734', '#ef3333', wGag);
      ctx.fill();
      ctx.clip();
      const cGrad = ctx.createRadialGradient(r * 0.08, -r * 1.15, r * 0.06, 0, -r * 1.05, r * 0.62);
      cGrad.addColorStop(0, lerpHex('#9be34b', '#ff5252', wGag));
      cGrad.addColorStop(0.65, lerpHex('#63b324', '#d92626', wGag));
      cGrad.addColorStop(1, lerpHex('#3d7a14', '#8f1515', wGag));
      ctx.fillStyle = cGrad;
      ctx.fillRect(-r, -r * 1.65, r * 2, r * 1.2);
      ctx.strokeStyle = wGag > 0.5 ? 'rgba(90, 10, 10, 0.35)' : 'rgba(30, 68, 12, 0.35)';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.arc(-r * 0.18, -r * 1.34, r * 0.18, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r * 0.18, -r * 1.34, r * 0.18, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.restore();
      traceCrownHead(ctx);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.stroke(); // 4. Tiered Overlapping Pointed Artichoke Bract Leaves (with 60fps bristle flutter!)
      const bractFlutter =
        wIdle * (tNow > 0 ? Math.sin(tNow * 3.8) * 0.02 : 0) +
        wNear * (tNow > 0 ? Math.sin(tNow * 24.0) * 0.05 : 0) +
        wGag * (tNow > 0 ? Math.sin(tNow * 20.0) * 0.06 : 0);
      function drawArtichokeBract(bx, by0, bw, bh, rot = 0, shadeSide = -1) {
        ctx.save();
        ctx.translate(bx, by0);
        ctx.rotate(rot + (bx < 0 ? -bractFlutter : bx > 0 ? bractFlutter : 0));
        function traceBract(g) {
          g.beginPath();
          g.moveTo(0, -bh);
          g.bezierCurveTo(bw * 0.96, -bh * 0.3, bw * 0.9, bh * 0.56, 0, bh * 0.62);
          g.bezierCurveTo(-bw * 0.9, bh * 0.56, -bw * 0.96, -bh * 0.3, 0, -bh);
          g.closePath();
        }
        ctx.save();
        traceBract(ctx);
        const lGrad = ctx.createLinearGradient(0, -bh, 0, bh * 0.65);
        lGrad.addColorStop(0, '#8ce03f');
        lGrad.addColorStop(0.55, '#59ab22');
        lGrad.addColorStop(1, '#316b10');
        ctx.fillStyle = lGrad;
        ctx.fill();
        ctx.clip();
        ctx.fillStyle = 'rgba(22, 50, 8, 0.24)';
        if (shadeSide < 0) {
          ctx.fillRect(-bw, -bh, bw, bh * 1.8);
        } else {
          ctx.fillRect(0, -bh, bw, bh * 1.8);
        }
        ctx.restore();
        traceBract(ctx);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.65;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.strokeStyle = 'rgba(25, 36, 18, 0.32)';
        ctx.lineWidth = 1.05;
        ctx.beginPath();
        ctx.moveTo(0, -bh * 0.72);
        ctx.lineTo(0, bh * 0.38);
        ctx.stroke();
        ctx.restore();
      }
      drawArtichokeBract(-r * 0.46, -r * 0.82, r * 0.18, r * 0.27, -0.32, -1);
      drawArtichokeBract(r * 0.46, -r * 0.82, r * 0.18, r * 0.27, 0.32, 1);
      drawArtichokeBract(-r * 0.44, -r * 0.54, r * 0.21, r * 0.28, -0.38, -1);
      drawArtichokeBract(r * 0.44, -r * 0.54, r * 0.21, r * 0.28, 0.38, 1);
      drawArtichokeBract(-r * 0.2, -r * 0.54, r * 0.21, r * 0.27, -0.14, -1);
      drawArtichokeBract(r * 0.2, -r * 0.54, r * 0.21, r * 0.27, 0.14, 1);
      drawArtichokeBract(-r * 0.3, -r * 0.32, r * 0.19, r * 0.23, -0.42, -1);
      drawArtichokeBract(r * 0.3, -r * 0.32, r * 0.19, r * 0.23, 0.42, 1);
      drawArtichokeBract(0, -r * 0.34, r * 0.22, r * 0.25, 0.0, 1); // 5. Facial Expressions & Thick White Handlebar Mustache
      function drawWhiteMustache(mx, my, scale = 1.0) {
        const twitch = tNow > 0 ? Math.sin(tNow * (wGag > 0.5 ? 20.0 : 8.0)) * 0.035 : 0;
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(twitch);
        ctx.scale(scale, scale);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.65;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -1.4);
        ctx.bezierCurveTo(3.5, -3.2, 8.0, -0.4, 11.6, -3.0);
        ctx.bezierCurveTo(12.0, 1.6, 7.0, 3.5, 0, 1.0);
        ctx.bezierCurveTo(-7.0, 3.5, -12.0, 1.6, -11.6, -3.0);
        ctx.bezierCurveTo(-8.0, -0.4, -3.5, -3.2, 0, -1.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      const pOffX = Math.max(-1.5, Math.min(1.5, px * 0.48));
      const pOffY = Math.max(-1.2, Math.min(1.2, py * 0.42));
      if (wGag < 0.5 && wNear < 0.5) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.4;
        ell(ctx, -r * 0.15, -r * 1.25, 3.0, 1.3, -0.22);
        ctx.stroke();
        ell(ctx, r * 0.21, -r * 1.25, 3.0, 1.3, 0.22);
        ctx.stroke();
        for (const ex of [-r * 0.14, r * 0.2]) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.5;
          circ(ctx, ex, -r * 1.09, 3.2);
          ctx.stroke();
          ctx.fillStyle = INK;
          circ(ctx, ex + 0.3 + pOffX, -r * 1.09 + pOffY, 1.5);
        }
        drawWhiteMustache(r * 0.04, -r * 0.94, 1.04);
      } else if (wGag < 0.5) {
        drawAngerVeinMark(ctx, -r * 0.25, -r * 1.17, 0.82 * clamp01(wNear * 1.2), 0, tNow);
        drawSweatDrop(ctx, r * 0.52, -r * 1.12, 0.76 * clamp01(wNear * 1.2), 0, tNow);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.95;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.16, -r * 1.2);
        ctx.lineTo(r * 0.02, -r * 1.1);
        ctx.moveTo(r * 0.34, -r * 1.2);
        ctx.lineTo(r * 0.14, -r * 1.1);
        ctx.stroke();
        for (const ex of [-r * 0.05, r * 0.23]) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.5;
          circ(ctx, ex, -r * 1.04, 3.4);
          ctx.stroke();
          ctx.fillStyle = INK;
          circ(ctx, ex + 0.5 + pOffX, -r * 1.04 + pOffY, 1.55);
        }
        const chatter = tNow > 0 ? Math.sin(tNow * 28.0) * 0.3 : 0;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ctx.beginPath();
        ctx.roundRect(-r * 0.04, -r * 0.89 - chatter, r * 0.25, 4.4 + chatter * 2, 1.2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.04, -r * 0.89 + 2.2);
        ctx.lineTo(r * 0.21, -r * 0.89 + 2.2);
        ctx.stroke();
        drawWhiteMustache(r * 0.08, -r * 0.91, 1.0);
        const bristleShift = tNow > 0 ? Math.sin(tNow * 26.0) * 0.04 : 0;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.35;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, -r * 0.72, r * 0.68, Math.PI * 0.84 + bristleShift, Math.PI * 1.14 + bristleShift);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -r * 0.72, r * 0.75, Math.PI * 0.86 - bristleShift, Math.PI * 1.12 - bristleShift);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -r * 0.72, r * 0.68, -Math.PI * 0.14 - bristleShift, Math.PI * 0.16 - bristleShift);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -r * 0.72, r * 0.75, -Math.PI * 0.12 + bristleShift, Math.PI * 0.14 + bristleShift);
        ctx.stroke();
      } else {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.0;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.26, -r * 1.2);
        ctx.lineTo(-r * 0.04, -r * 1.08);
        ctx.moveTo(r * 0.3, -r * 1.2);
        ctx.lineTo(r * 0.08, -r * 1.08);
        ctx.stroke();
        for (const ex of [-r * 0.14, r * 0.2]) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.55;
          circ(ctx, ex, -r * 1.04, 3.6);
          ctx.stroke();
          ctx.fillStyle = INK;
          circ(ctx, ex + 0.3 + pOffX, -r * 1.04 + pOffY, 1.55);
        }
        const my = -r * 0.8;
        const shoutPulse = tNow > 0 ? Math.sin(tNow * 18.0) * 0.45 : 0;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(-r * 0.06, my - 3.4 - shoutPulse, r * 0.25, 6.8 + shoutPulse * 2, 2.0);
        ctx.fillStyle = '#3b1216';
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#e06377';
        ell(ctx, r * 0.08, my + 2.4, 3.6, 2.0);
        ctx.restore();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
        drawWhiteMustache(r * 0.05, -r * 0.89, 1.02); // 3 Detached Artichoke Bracts flying & spinning outward!
        const flyOff = tNow > 0 ? ((tNow * 2.2) % 1.0) * 2.8 : 0;
        const flySpin = tNow > 0 ? Math.sin(tNow * 15.0) * 0.18 : 0;
        for (const [lx, ly, lrot, s, dx, dy] of [
          [-r * 0.88, -r * 1.02, -0.85, 0.85, -1, -0.6],
          [-r * 0.76, -r * 0.3, -1.35, 0.72, -1, 0.4],
          [r * 0.82, -r * 1.0, 0.75, 0.78, 1, -0.5],
        ]) {
          drawArtichokeBract(lx + dx * flyOff, ly + dy * flyOff, r * 0.18 * s, r * 0.26 * s, lrot + flySpin, 1);
        }
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(-r * 0.42, -r * 0.72, r * 0.52, Math.PI * 0.86, Math.PI * 1.12);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-r * 0.48, -r * 0.72, r * 0.58, Math.PI * 0.9, Math.PI * 1.08);
        ctx.stroke();
      } // 6. Royal-Blue Musketeer Cavalier Hat with Fluffy White Plume Feather (Smooth Trajectory!)
      ctx.save();
      const hatX = lerp(-r * 0.02, -r * 0.14, wGag);
      const hatY = lerp(
        -r * 1.48,
        -r * (1.48 + 0.36 * gagEased) - (tNow > 0 ? Math.abs(Math.sin(tNow * 16.0)) * 1.8 : 0),
        wGag,
      );
      const hatRot =
        lerp(-0.05, -0.34, wGag) +
        (tNow > 0 ? Math.sin(tNow * (wGag > 0.5 ? 14.0 : 3.5)) * (wGag > 0.5 ? 0.065 : 0.025) : 0);
      ctx.translate(hatX, hatY);
      ctx.rotate(hatRot); // Sweeping White Ostrich Plume Feather (waves in the breeze!)
      const plumeWave = tNow > 0 ? Math.sin(tNow * 5.0) * 0.06 : 0;
      ctx.save();
      ctx.translate(-r * 0.24, -r * 0.1);
      ctx.rotate(-0.22 + plumeWave);
      ctx.fillStyle = '#f1f5f9';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.65;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(2, 2);
      ctx.bezierCurveTo(-r * 0.18, -r * 0.34, -r * 0.62, -r * 0.34, -r * 0.68, -r * 0.08);
      ctx.bezierCurveTo(-r * 0.68, r * 0.08, -r * 0.42, r * 0.08, -r * 0.34, r * 0.02);
      ctx.lineTo(-r * 0.28, r * 0.08);
      ctx.lineTo(-r * 0.18, r * 0.03);
      ctx.quadraticCurveTo(-r * 0.06, r * 0.08, 2, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.quadraticCurveTo(-r * 0.3, -r * 0.16, -r * 0.56, -r * 0.08);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#2962b8';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      ctx.moveTo(-r * 0.34, 2);
      ctx.bezierCurveTo(-r * 0.34, -r * 0.36, r * 0.34, -r * 0.36, r * 0.34, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#143261';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-r * 0.34, -2.5, r * 0.68, 4.5, 1.0);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#3874cc';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-r * 0.64, 3.2);
      ctx.bezierCurveTo(-r * 0.72, -r * 0.06, -r * 0.36, -r * 0.08, 0, -r * 0.04);
      ctx.bezierCurveTo(r * 0.38, 0.0, r * 0.56, -r * 0.24, r * 0.66, -r * 0.14);
      ctx.bezierCurveTo(r * 0.74, 0.04, r * 0.42, r * 0.2, 0, r * 0.16);
      ctx.bezierCurveTo(-r * 0.4, r * 0.14, -r * 0.58, r * 0.12, -r * 0.64, 3.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (wGag > 0.3) {
        ctx.fillStyle = '#17386e';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        ell(ctx, 0, 2.2, r * 0.28, 2.6 * wGag);
        ctx.stroke();
      }
      ctx.restore(); // End hat
      ctx.restore(); // End body transform
      // 7. Spiky Jagged "MERDE!" Explosion Speech Bubble in Pose 3 (On-Hit Gag)
      if (wGag > 0.2) {
        drawSpikyExplosionBubble(
          ctx,
          r * 0.98,
          -r * 1.54,
          r * 0.55,
          r * 0.32,
          r * 0.44,
          -r * 1.18,
          'ZUT!',
          5.6,
          tNow,
          clamp01(gagEased),
        );
      }
      if (drawMound) {
        drawSculptedDirtMound(ctx, r * 1.04, false, false, tNow);
      }
      ctx.restore();
    } // ==========================================================================
    // 3. DIVA LAVANDE (`lavender`, base r = 24)
    //    Provence Lavender Bundle — Haute-Couture Perfume Snob
    // ==========================================================================
    function drawDivaLavande(ctx, r, state, tNow = 0, px = 0, py = 0, drawMound = true) {
      const INK = '#231429';
      const { wIdle, wNear, wGag, alertP, gagP } = resolvePoseWeights(state, tNow);
      const gagEased = easeOutBack(clamp01(gagP));
      const breatheY = wIdle * (tNow > 0 ? Math.sin(tNow * 3.6) * 0.015 : 0);
      const squatY = wNear * (1.0 + (tNow > 0 ? Math.sin(tNow * 16.0) * 0.3 : 0));
      const gagJumpY = wGag * (tNow > 0 ? -Math.abs(Math.sin(tNow * 12.0)) * 1.3 : 0);
      const bodyRot =
        wIdle * (tNow > 0 ? Math.sin(tNow * 2.4) * 0.018 : 0) +
        wNear * (tNow > 0 ? 0.012 * Math.sin(tNow * 18.0) : 0) +
        wGag * (-0.045 + (tNow > 0 ? Math.sin(tNow * 20.0) * 0.025 : 0));
      ctx.save();
      ctx.translate(0, squatY + gagJumpY);
      ctx.rotate(bodyRot);
      ctx.scale(1 - breatheY * 0.4, 1 + breatheY); // 1. Minimalist Scalloped Floret Spike Helper (sways with phase-shifted breeze!)
      function drawCleanFloretSpike(sx, sy, len, w, ang, fillCol, shadeCol) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ang);
        function traceSpikeClosed(g) {
          g.beginPath();
          g.moveTo(-w * 0.58, 3.5);
          g.bezierCurveTo(-w * 1.15, -len * 0.08, -w * 1.1, -len * 0.3, -w * 0.6, -len * 0.34);
          g.bezierCurveTo(-w * 1.12, -len * 0.42, -w * 1.04, -len * 0.64, -w * 0.52, -len * 0.68);
          g.bezierCurveTo(-w * 0.94, -len * 0.76, -w * 0.84, -len * 0.92, -w * 0.35, -len * 0.94);
          g.bezierCurveTo(-w * 0.3, -len * 1.1, w * 0.3, -len * 1.1, w * 0.35, -len * 0.94);
          g.bezierCurveTo(w * 0.84, -len * 0.92, w * 0.94, -len * 0.76, w * 0.52, -len * 0.68);
          g.bezierCurveTo(w * 1.04, -len * 0.64, w * 1.12, -len * 0.42, w * 0.6, -len * 0.34);
          g.bezierCurveTo(w * 1.1, -len * 0.3, w * 1.15, -len * 0.08, w * 0.58, 3.5);
          g.closePath();
        }
        ctx.save();
        traceSpikeClosed(ctx);
        ctx.fillStyle = fillCol;
        ctx.fill();
        ctx.clip();
        ctx.fillStyle = shadeCol;
        ctx.fillRect(-w * 1.3, -len * 1.2, w * 1.1, len * 1.35);
        ctx.restore();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.65;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-w * 0.56, 1.2);
        ctx.bezierCurveTo(-w * 1.15, -len * 0.08, -w * 1.1, -len * 0.3, -w * 0.6, -len * 0.34);
        ctx.bezierCurveTo(-w * 1.12, -len * 0.42, -w * 1.04, -len * 0.64, -w * 0.52, -len * 0.68);
        ctx.bezierCurveTo(-w * 0.94, -len * 0.76, -w * 0.84, -len * 0.92, -w * 0.35, -len * 0.94);
        ctx.bezierCurveTo(-w * 0.3, -len * 1.1, w * 0.3, -len * 1.1, w * 0.35, -len * 0.94);
        ctx.bezierCurveTo(w * 0.84, -len * 0.92, w * 0.94, -len * 0.76, w * 0.52, -len * 0.68);
        ctx.bezierCurveTo(w * 1.04, -len * 0.64, w * 1.12, -len * 0.42, w * 0.6, -len * 0.34);
        ctx.bezierCurveTo(w * 1.1, -len * 0.3, w * 1.15, -len * 0.08, w * 0.56, 1.2);
        ctx.stroke();
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, 0.5);
        ctx.lineTo(0, -len * 0.28);
        ctx.stroke();
        ctx.restore();
      }
      const spikeFill = lerpHex('#9b74de', '#c42b6e', wGag);
      const spikeShade = wGag > 0.5 ? 'rgba(120, 18, 66, 0.28)' : 'rgba(108, 68, 178, 0.26)';
      const sw = (idx) =>
        tNow > 0 ? Math.sin(tNow * (wGag > 0.5 ? 18.0 : 3.6) + idx * 0.7) * (wGag > 0.5 ? 0.055 : 0.032) : 0;
      drawCleanFloretSpike(
        lerp(-r * 0.38, -r * 0.44, wGag),
        lerp(-r * 1.22, -r * 1.16, wGag),
        r * 0.44,
        3.4,
        lerp(-0.28, -0.56, wGag) + sw(0),
        spikeFill,
        spikeShade,
      );
      drawCleanFloretSpike(
        r * 0.38,
        lerp(-r * 1.22, -r * 1.18, wGag),
        r * 0.44,
        3.4,
        lerp(0.26, 0.34, wGag) + sw(1),
        spikeFill,
        spikeShade,
      );
      drawCleanFloretSpike(-r * 0.19, -r * 1.26, r * 0.5, 3.5, lerp(-0.12, -0.2, wGag) + sw(2), spikeFill, spikeShade);
      drawCleanFloretSpike(r * 0.19, -r * 1.26, r * 0.5, 3.5, lerp(0.12, 0.16, wGag) + sw(3), spikeFill, spikeShade);
      drawCleanFloretSpike(0, -r * 1.3, r * 0.56, 3.7, lerp(0.0, -0.04, wGag) + sw(4), spikeFill, spikeShade); // 2. Slender Hourglass Lavender Sheaf Body
      function traceSheafBodyClosed(g) {
        g.beginPath();
        g.moveTo(-r * 0.43, -r * 1.24);
        g.quadraticCurveTo(0, -r * 1.34, r * 0.43, -r * 1.24);
        g.bezierCurveTo(r * 0.44, -r * 0.92, r * 0.27, -r * 0.64, r * 0.26, -r * 0.44);
        g.bezierCurveTo(r * 0.26, -r * 0.26, r * 0.37, -r * 0.14, r * 0.37, -r * 0.04);
        g.quadraticCurveTo(r * 0.28, r * 0.04, r * 0.18, -r * 0.03);
        g.quadraticCurveTo(r * 0.09, r * 0.05, 0, -r * 0.02);
        g.quadraticCurveTo(-r * 0.09, r * 0.05, -r * 0.18, -r * 0.03);
        g.quadraticCurveTo(-r * 0.28, r * 0.04, -r * 0.37, -r * 0.04);
        g.bezierCurveTo(-r * 0.37, -r * 0.14, -r * 0.26, -r * 0.26, -r * 0.26, -r * 0.44);
        g.bezierCurveTo(-r * 0.27, -r * 0.64, -r * 0.44, -r * 0.92, -r * 0.43, -r * 1.24);
        g.closePath();
      }
      ctx.save();
      traceSheafBodyClosed(ctx);
      ctx.fillStyle = lerpHex('#9f7ae0', '#d92662', wGag);
      ctx.fill();
      ctx.clip();
      const sGrad = ctx.createRadialGradient(r * 0.06, -r * 0.89, r * 0.07, 0, -r * 0.78, r * 0.8);
      sGrad.addColorStop(0, lerpHex('#b594f0', '#ff2e55', wGag));
      sGrad.addColorStop(0.62, lerpHex('#9b74de', '#de2460', wGag));
      sGrad.addColorStop(1, lerpHex('#7c52c4', '#983288', wGag));
      ctx.fillStyle = sGrad;
      ctx.fillRect(-r, -r * 1.6, r * 2, r * 1.75);
      ctx.fillStyle = wGag > 0.5 ? 'rgba(88, 16, 68, 0.26)' : 'rgba(92, 52, 158, 0.32)';
      ctx.beginPath();
      ctx.moveTo(-r * 0.46, -r * 1.35);
      ctx.lineTo(-r * 0.15, -r * 1.35);
      ctx.bezierCurveTo(-r * 0.21, -r * 0.92, -r * 0.13, -r * 0.62, -r * 0.13, -r * 0.44);
      ctx.bezierCurveTo(-r * 0.13, -r * 0.26, -r * 0.19, -r * 0.1, -r * 0.19, r * 0.06);
      ctx.lineTo(-r * 0.46, r * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(35, 20, 41, 0.26)';
      ctx.lineWidth = 1.15;
      for (const sx of [-0.15, 0.0, 0.15]) {
        ctx.beginPath();
        ctx.moveTo(sx * r, -r * 0.4);
        ctx.lineTo(sx * r * 1.08, -r * 0.03);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(r * 0.43, -r * 1.23);
      ctx.bezierCurveTo(r * 0.44, -r * 0.92, r * 0.27, -r * 0.64, r * 0.26, -r * 0.44);
      ctx.bezierCurveTo(r * 0.26, -r * 0.26, r * 0.37, -r * 0.14, r * 0.37, -r * 0.04);
      ctx.quadraticCurveTo(r * 0.28, r * 0.04, r * 0.18, -r * 0.03);
      ctx.quadraticCurveTo(r * 0.09, r * 0.05, 0, -r * 0.02);
      ctx.quadraticCurveTo(-r * 0.09, r * 0.05, -r * 0.18, -r * 0.03);
      ctx.quadraticCurveTo(-r * 0.28, r * 0.04, -r * 0.37, -r * 0.04);
      ctx.bezierCurveTo(-r * 0.37, -r * 0.14, -r * 0.26, -r * 0.26, -r * 0.26, -r * 0.44);
      ctx.bezierCurveTo(-r * 0.27, -r * 0.64, -r * 0.44, -r * 0.92, -r * 0.43, -r * 1.23);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.45;
      for (const [cx0, cy0, cx1, cy1] of [
        [-r * 0.28, -r * 1.26, -r * 0.26, -r * 1.18],
        [-r * 0.09, -r * 1.3, -r * 0.08, -r * 1.21],
        [r * 0.09, -r * 1.3, r * 0.08, -r * 1.21],
        [r * 0.28, -r * 1.26, r * 0.26, -r * 1.18],
      ]) {
        ctx.beginPath();
        ctx.moveTo(cx0, cy0);
        ctx.lineTo(cx1, cy1);
        ctx.stroke();
      } // 3. Sleek French Tricolore Silk Waist Ribbon & Bow (`y = -r * 0.43`)
      ctx.save();
      const wy = -r * 0.43;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-r * 0.27, wy - 1.8, r * 0.54, 3.6, 1.4);
      ctx.clip();
      ctx.fillStyle = '#0055a4';
      ctx.fillRect(-r * 0.3, wy - 2.2, r * 0.21, 4.4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-r * 0.09, wy - 2.2, r * 0.18, 4.4);
      ctx.fillStyle = '#ef4135';
      ctx.fillRect(r * 0.09, wy - 2.2, r * 0.21, 4.4);
      ctx.restore();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      ctx.roundRect(-r * 0.27, wy - 1.8, r * 0.54, 3.6, 1.4);
      ctx.stroke();
      const bx = r * 0.07;
      const ribbonFlutter = tNow > 0 ? Math.sin(tNow * 5.2) * 0.06 : 0;
      for (const [tx, ty, trot, tailCol] of [
        [-1.5, 3.2, 0.34 + ribbonFlutter, '#0055a4'],
        [2.1, 3.2, -0.34 - ribbonFlutter, '#ef4135'],
      ]) {
        ctx.save();
        ctx.translate(bx + tx, wy + ty);
        ctx.rotate(trot);
        ctx.beginPath();
        ctx.moveTo(-1.5, -3.0);
        ctx.lineTo(1.5, -3.0);
        ctx.lineTo(1.8, 3.8);
        ctx.lineTo(0, 2.4);
        ctx.lineTo(-1.8, 3.8);
        ctx.closePath();
        ctx.fillStyle = tailCol;
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.25;
        ctx.stroke();
        ctx.restore();
      }
      for (const dir of [-1, 1]) {
        ctx.save();
        ctx.translate(bx + dir * 3.2, wy);
        ctx.beginPath();
        ctx.moveTo(-dir * 2.6, 0);
        ctx.bezierCurveTo(dir * 1.4, -3.4, dir * 2.7, -2.6, dir * 2.5, 0);
        ctx.bezierCurveTo(dir * 2.7, 2.6, dir * 1.4, 3.4, -dir * 2.6, 0);
        ctx.closePath();
        ctx.fillStyle = dir < 0 ? '#0055a4' : '#ef4135';
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.roundRect(bx - 1.4, wy - 1.6, 2.8, 3.2, 0.9);
      ctx.fill();
      ctx.stroke();
      ctx.restore(); // 4. Crisp Minimalist White Cat-Eye Designer Sunglasses Helper
      function drawCatEyeSunglasses(gx, gy, grot = 0, showRightArm = false) {
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(grot);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.46, -1.0);
        ctx.quadraticCurveTo(-r * 0.62, -0.3, -r * 0.63, 3.0);
        ctx.lineTo(-r * 0.55, 3.3);
        ctx.quadraticCurveTo(-r * 0.54, 0.6, -r * 0.42, 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (showRightArm) {
          ctx.beginPath();
          ctx.moveTo(r * 0.14, -2.6);
          ctx.quadraticCurveTo(r * 0.22, -6.2, r * 0.44, -5.2);
          ctx.lineTo(r * 0.42, -4.0);
          ctx.quadraticCurveTo(r * 0.26, -4.6, r * 0.22, -2.4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.65;
        ctx.beginPath();
        ctx.moveTo(0, -1.1);
        ctx.bezierCurveTo(-r * 0.15, -1.4, -r * 0.35, -2.4, -r * 0.52, -3.9);
        ctx.bezierCurveTo(-r * 0.5, 2.0, -r * 0.32, 4.5, -r * 0.18, 4.0);
        ctx.quadraticCurveTo(-r * 0.05, 3.5, 0, 0.5);
        ctx.quadraticCurveTo(r * 0.05, 3.5, r * 0.18, 4.0);
        ctx.bezierCurveTo(r * 0.32, 4.5, r * 0.5, 2.0, r * 0.52, -3.9);
        ctx.bezierCurveTo(r * 0.35, -2.4, r * 0.15, -1.4, 0, -1.1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        for (const dir of [-1, 1]) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(dir * 1.9, -0.2);
          ctx.bezierCurveTo(dir * r * 0.15, -0.8, dir * r * 0.31, -1.5, dir * r * 0.4, -2.3);
          ctx.bezierCurveTo(dir * r * 0.39, 1.3, dir * r * 0.27, 3.0, dir * r * 0.16, 2.7);
          ctx.quadraticCurveTo(dir * 2.4, 2.1, dir * 1.9, -0.2);
          ctx.closePath();
          ctx.fillStyle = '#3b254b';
          ctx.fill();
          ctx.clip();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(dir * 4.2 - 1.8, -3.2);
          ctx.lineTo(dir * 4.2 - 4.8, 4.2);
          ctx.stroke();
          ctx.lineWidth = 0.85;
          ctx.beginPath();
          ctx.moveTo(dir * 4.2 + 0.6, -3.2);
          ctx.lineTo(dir * 4.2 - 2.2, 4.2);
          ctx.stroke();
          ctx.restore();
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.moveTo(dir * 1.9, -0.2);
          ctx.bezierCurveTo(dir * r * 0.15, -0.8, dir * r * 0.31, -1.5, dir * r * 0.4, -2.3);
          ctx.bezierCurveTo(dir * r * 0.39, 1.3, dir * r * 0.27, 3.0, dir * r * 0.16, 2.7);
          ctx.quadraticCurveTo(dir * 2.4, 2.1, dir * 1.9, -0.2);
          ctx.closePath();
          ctx.stroke();
        }
        ctx.restore();
      } // 5. Facial Expressions, Sunglasses Trajectory & Props per State
      const pOffX = Math.max(-1.45, Math.min(1.45, px * 0.48));
      const pOffY = Math.max(-1.1, Math.min(1.1, py * 0.42)); // Continuous Cat-Eye Sunglasses Position & Angle across Idle -> Near (slipped down nose) -> Gag (airborne!)
      const glassesX =
        (r * 0.03 + pOffX * 0.45) * wIdle +
        r * 0.04 * wNear +
        (-r * 0.04 + (tNow > 0 ? Math.sin(tNow * 14.0) * 1.1 : 0)) * wGag;
      const glassesY =
        (-r * 0.9 + pOffY * 0.35) * wIdle +
        (-r * 0.82 + (tNow > 0 ? Math.sin(tNow * 16.0) * 0.25 : 0)) * wNear +
        (-r * (0.85 + 1.25 * gagEased) - (tNow > 0 ? Math.abs(Math.sin(tNow * 16.0)) * 1.6 : 0)) * wGag;
      const glassesRot =
        -0.04 * wIdle +
        (0.03 + (tNow > 0 ? Math.sin(tNow * 18.0) * 0.02 : 0)) * wNear +
        (-0.28 + (tNow > 0 ? Math.cos(tNow * 13.0) * 0.075 : 0)) * wGag;
      if (wGag < 0.5 && wNear < 0.35) {
        // POSE 1: IDLE (SNOOTY & FABULOUS)
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.65;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.21 + pOffX * 0.35, -r * 1.07 + pOffY * 0.25);
        ctx.quadraticCurveTo(
          -r * 0.14 + pOffX * 0.35,
          -r * 1.12 + pOffY * 0.25,
          -r * 0.08 + pOffX * 0.35,
          -r * 1.08 + pOffY * 0.25,
        );
        ctx.moveTo(r * 0.12 + pOffX * 0.35, -r * 1.08 + pOffY * 0.25);
        ctx.quadraticCurveTo(
          r * 0.18 + pOffX * 0.35,
          -r * 1.12 + pOffY * 0.25,
          r * 0.25 + pOffX * 0.35,
          -r * 1.07 + pOffY * 0.25,
        );
        ctx.stroke();
        drawCatEyeSunglasses(glassesX, glassesY, glassesRot, false);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.65;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.05, -r * 0.67);
        ctx.quadraticCurveTo(r * 0.06, -r * 0.63, r * 0.15, -r * 0.71);
        ctx.stroke(); // 4 twinkling 4-point lavender star sparkles
        for (const [idx, sx, sy, baseSr] of [
          [0, -r * 0.76, -r * 0.98, 3.8],
          [1, r * 0.42, -r * 1.84, 3.2],
          [2, r * 0.72, -r * 1.24, 3.8],
          [3, r * 0.64, -r * 0.82, 2.8],
        ]) {
          const spPulse = tNow > 0 ? 1.0 + Math.sin(tNow * 4.5 + idx * 1.4) * 0.22 : 1.0;
          const sr = baseSr * spPulse;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.fillStyle = '#b78df2';
          ctx.beginPath();
          ctx.moveTo(0, -sr);
          ctx.quadraticCurveTo(0, 0, sr, 0);
          ctx.quadraticCurveTo(0, 0, 0, sr);
          ctx.quadraticCurveTo(0, 0, -sr, 0);
          ctx.quadraticCurveTo(0, 0, 0, -sr);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      } else if (wGag < 0.5) {
        // POSE 2: CURSOR-NEAR ALERT (OFFENDED GASP — sunglasses slide down nose bridge!)
        drawSweatDrop(ctx, r * 0.62, -r * 1.16, 0.82 * clamp01(wNear * 1.2), 0, tNow);
        const eyeY = -r * 1.0;
        const eyeX = r * 0.15;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.55;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-eyeX - 2.4, eyeY - 5.6);
        ctx.quadraticCurveTo(-eyeX, eyeY - 7.0, -eyeX + 2.2, eyeY - 5.4);
        ctx.moveTo(eyeX - 2.0, eyeY - 5.4);
        ctx.quadraticCurveTo(eyeX + 0.4, eyeY - 7.0, eyeX + 2.6, eyeY - 5.6);
        ctx.stroke();
        for (const dir of [-1, 1]) {
          const ex = dir * eyeX + 0.8;
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.5;
          circ(ctx, ex, eyeY, 3.25);
          ctx.stroke();
          ctx.fillStyle = INK;
          circ(ctx, ex + 0.25 + pOffX, eyeY - 0.15 + pOffY, 1.35);
        }
        drawCatEyeSunglasses(glassesX, glassesY, glassesRot, false);
        const mx = r * 0.04;
        const my = -r * 0.63;
        const gaspPulse = tNow > 0 ? 1.0 + Math.sin(tNow * 16.0) * 0.08 : 1.0;
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(mx, my, 2.2 * gaspPulse, 2.6 * gaspPulse, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#3a0e18';
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#f472b6';
        ell(ctx, mx, my + 1.8, 1.9, 1.3);
        ctx.restore();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ctx.stroke();
        ctx.restore();
      } else {
        // POSE 3: ON-HIT GAG (PERFUME SPRITZ!)
        const eyeY = -r * 0.99;
        const eyeX = r * 0.16;
        drawChevronWinceEyes(ctx, -eyeX + 0.8, eyeX + 0.8, eyeY, 5.6, 2.3, INK, 1.9, tNow);
        const mx = r * 0.02;
        const my = -r * 0.72;
        const mw = r * 0.19;
        const mh = r * (0.14 + (tNow > 0 ? Math.sin(tNow * 18.0) * 0.015 : 0));
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(mx - mw, my + mh * 0.8);
        ctx.bezierCurveTo(mx - mw * 1.05, my - mh * 1.15, mx + mw * 1.05, my - mh * 1.15, mx + mw, my + mh * 0.8);
        ctx.quadraticCurveTo(mx, my + mh * 0.45, mx - mw, my + mh * 0.8);
        ctx.closePath();
        ctx.fillStyle = '#3a0e18';
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#ffffff';
        ell(ctx, mx, my - mh * 0.72, mw * 0.78, mh * 0.42);
        ctx.fillStyle = '#f472b6';
        ell(ctx, mx, my + mh * 0.65, mw * 0.68, mh * 0.5);
        ctx.restore();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.55;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore(); // Airborne White Cat-Eye Sunglasses launched high above the flower spikes
        drawCatEyeSunglasses(glassesX, glassesY, glassesRot, true); // Animated Purple Perfume Spritz Cone + Billowing Cloud Puff + Flying Droplets!
        const spritzChug = tNow > 0 ? (tNow * 2.6) % 1.0 : 0;
        const spritzSc = (1.0 + Math.sin(spritzChug * Math.PI) * 0.16) * clamp01(gagEased);
        ctx.save();
        ctx.translate(r * 0.27, -r * 0.76);
        ctx.scale(spritzSc, spritzSc);
        ctx.fillStyle = '#c490fc';
        ctx.strokeStyle = '#5b218a';
        ctx.lineWidth = 1.35;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(r * 0.42, -2.5);
        ctx.arc(r * 0.54, -3.0, 3.5, Math.PI * 0.95, Math.PI * 1.95);
        ctx.arc(r * 0.7, -0.2, 3.8, -Math.PI * 0.42, Math.PI * 0.48);
        ctx.arc(r * 0.52, 2.6, 3.3, 0.08, Math.PI * 0.95);
        ctx.lineTo(0, 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        const dropPush = spritzChug * 3.8;
        ctx.fillStyle = '#c490fc';
        ell(ctx, r * 0.94 + dropPush, -2.0 - dropPush * 0.3, 1.5, 0.9, -0.25);
        ctx.stroke();
        ell(ctx, r * 0.9 + dropPush * 0.8, 2.2 + dropPush * 0.25, 1.3, 0.8, 0.25);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore(); // End body transform
      // 6. Spiky Jagged "PUTAIN!" Explosion Speech Bubble in Pose 3 (On-Hit Gag)
      if (wGag > 0.2) {
        drawSpikyExplosionBubble(
          ctx,
          r * 1.12,
          -r * 1.48,
          r * 0.58,
          r * 0.33,
          r * 0.5,
          -r * 1.12,
          'OLALA!',
          5.3,
          tNow,
          clamp01(gagEased),
        );
      }
      if (drawMound) {
        drawSculptedDirtMound(ctx, r * 1.0, true, wGag > 0.4, tNow);
      }
      ctx.restore();
    } // Unified dispatcher for `FarmScene.ts` (`window.DBD_CROP_RENDERER`)
    function drawFranceCharacter(ctx, type, r, state, tNow = 0, px = 0, py = 0, drawMound = false) {
      if (type === 'echalote') {
        drawMonsieurEchalote(ctx, r, state, tNow, px, py, drawMound);
        return true;
      }
      if (type === 'artichaut') {
        drawChevalierArtichaut(ctx, r, state, tNow, px, py, drawMound);
        return true;
      }
      if (type === 'lavender' || type === 'lavande') {
        drawDivaLavande(ctx, r, state, tNow, px, py, drawMound);
        return true;
      }
      return false;
    } // ==========================================================================
    // Continuous State-Cycling Showcase Renderer (`IDLE -> ALERT -> SLICE -> GAG -> IDLE`)
    // ==========================================================================
    function drawContinuousShowcaseCycle(ctx, type, r, tNow, scale = 2.8) {
      const cycleDur = 4.5;
      const phase = (((tNow % cycleDur) + cycleDur) % cycleDur) / cycleDur;
      let st = 'idle';
      let stLabel = '▶ 1. IDLE';
      let stColor = '#15803d';
      let scytheX = 68,
        scytheY = -78,
        scytheAng = -0.4,
        showScythe = false,
        slashAlpha = 0;
      let squashX = 1.0,
        squashY = 1.0;
      let blendState = { wIdle: 1, wNear: 0, wGag: 0, alertP: 0, gagP: 0 };
      if (phase < 0.26) {
        st = 'idle';
        stLabel = '▶ 1. IDLE';
        stColor = '#15803d';
        blendState = { wIdle: 1, wNear: 0, wGag: 0, alertP: 0, gagP: 0 };
      } else if (phase < 0.34) {
        const u = smoothstep(0.26, 0.34, phase);
        st = 'near';
        stLabel = '⚡ 1→2 ANTICIPATION';
        stColor = '#d97706';
        blendState = { wIdle: 1 - u, wNear: u, wGag: 0, alertP: u, gagP: 0 };
        showScythe = true;
        scytheX = lerp(64, 48, u);
        scytheY = lerp(-72, -62, u);
        scytheAng = lerp(-0.25, -0.38, u);
        squashY = 1.0 - Math.sin(u * Math.PI) * 0.08;
        squashX = 1.0 / Math.sqrt(squashY);
      } else if (phase < 0.6) {
        const p = (phase - 0.34) / 0.26;
        st = 'near';
        stLabel = '⚠️ 2. CURSOR-NEAR ALERT!';
        stColor = '#d97706';
        blendState = { wIdle: 0, wNear: 1, wGag: 0, alertP: 1, gagP: 0 };
        showScythe = true;
        scytheX = 48 - p * 26;
        scytheY = -62 + Math.sin(p * Math.PI * 2) * 5;
        scytheAng = -0.38 - p * 0.42;
      } else if (phase < 0.9) {
        const p = (phase - 0.6) / 0.3;
        const u = smoothstep(0, 0.16, p);
        st = 'gag';
        stLabel = '💥 3. ON-HIT GAG!';
        stColor = '#dc2626';
        blendState = { wIdle: 0, wNear: 1 - u, wGag: u, alertP: 1 - u, gagP: clamp01(p / 0.25) };
        if (p < 0.35) {
          showScythe = true;
          const sp = p / 0.35;
          scytheX = 22 - sp * 58;
          scytheY = -48 + sp * 22;
          scytheAng = -0.8 + sp * 2.2;
          slashAlpha = 1.0 - sp;
        }
        const damp = Math.exp(-p * 6.2) * Math.cos(p * 23.0);
        squashY = 1.0 - damp * 0.21;
        squashX = 1.0 / Math.sqrt(Math.max(0.55, squashY));
      } else {
        const u = smoothstep(0.9, 1.0, phase);
        st = 'idle';
        stLabel = '🔄 3→1 RECOVERING';
        stColor = '#15803d';
        blendState = { wIdle: u, wNear: 0, wGag: 1 - u, alertP: 0, gagP: 1 - u };
        squashY = 1.0 + Math.sin(u * Math.PI) * 0.06;
        squashX = 1.0 / Math.sqrt(squashY);
      }
      const px = showScythe ? Math.cos(Math.atan2(scytheY + 25, scytheX)) * 1.8 : Math.sin(tNow * 2.2) * 1.1;
      const py = showScythe ? Math.sin(Math.atan2(scytheY + 25, scytheX)) * 1.4 : Math.cos(tNow * 1.7) * 0.6;
      ctx.save();
      ctx.scale(scale * squashX, scale * squashY);
      drawFranceCharacter(ctx, type, r, blendState, tNow, px, py, true);
      if (slashAlpha > 0.02) {
        ctx.save();
        ctx.strokeStyle = `rgba(254, 240, 138, ${slashAlpha * 0.92})`;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, -r * 0.85, r * 1.35, -0.85, 0.65);
        ctx.stroke();
        ctx.restore();
      }
      if (showScythe) {
        ctx.save();
        ctx.translate(scytheX, scytheY);
        ctx.rotate(scytheAng);
        ctx.strokeStyle = '#1c1008';
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 14);
        ctx.lineTo(0, -10);
        ctx.stroke();
        ctx.strokeStyle = '#9a5b25';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = '#1c1008';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.quadraticCurveTo(-14, -12, -20, -2);
        ctx.quadraticCurveTo(-12, -6, 0, -5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      return { st, stLabel, stColor };
    }
    return {
      drawMonsieurEchalote,
      drawChevalierArtichaut,
      drawDivaLavande,
      drawSculptedDirtMound,
      drawFranceCharacter,
      drawContinuousShowcaseCycle,
    };
  })();
  window.DBD_FRANCE_TRIO_RENDERER =
    DBD_FRANCE_TRIO_RENDERER; /* removed: window.DBD_FRANCE_TRIO_SOURCE_CODE (studio-only) */ // ============================================================================
  // Authored Japan Trio Vector Renderer (Sensei Daikon, Rikishi Kabocha, Shinobi Wasabi)
  // ============================================================================
  // ============================================================================
  // Due by Dusk — Standalone Japan Trio Vector Character Renderer Module
  // Drop-in Canvas 2D implementation for Claude / Phaser 3 (`src/scenes/FarmScene.ts`)
  // Characters:
  //   1. Sensei Daikon (`daikon`, r: 25) — Giant White Radish (Karate Master)
  //   2. Rikishi Kabocha (`kabocha`, r: 30) — Japanese Winter Squash (Sumo Wrestler)
  //   3. Shinobi Wasabi (`wasabi`, r: 22) — Mountain Wasabi Root (Stealth Ninja)
  //
  // Each character supports 3 distinct states matching the 3-pose character sheets:
  //   - State 1 (`idle`):          !cursorNear && !shocked
  //   - State 2 (`near`):          cursorNear && !shocked
  //   - State 3 (`gag`/`shocked`): shocked (on-hit counter / slapstick gag)
  // ============================================================================
  // ============================================================================
  // Due by Dusk — Complete Japan Trio Authored Vector Character Renderer
  // Faithfully implements all 3 Japan Trio characters in pure HTML5 Canvas 2D
  // with continuous 60fps animations AND smooth pose-to-pose interpolation
  // between their 3 poses (`1. IDLE <-> 2. CURSOR-NEAR ALERT <-> 3. ON-HIT GAG`):
  //
  //   1. Sensei Daikon (`daikon`, r: 25) — Giant White Radish (Karate Master)
  //   2. Rikishi Kabocha (`kabocha`, r: 30) — Japanese Winter Squash (Sumo Wrestler)
  //   3. Shinobi Wasabi (`wasabi`, r: 22) — Mountain Wasabi Root (Stealth Ninja)
  //
  // Supported States:
  //   - State 1 (`idle`):          !cursorNear && !shocked (continuous 60fps idle animation)
  //   - State 2 (`near`):          cursorNear && !shocked  (continuous 60fps cursor-near alert animation)
  //   - State 3 (`gag`/`shocked`): shocked                 (continuous 60fps on-hit slapstick gag animation)
  //   - Smooth Blend Object:       { wIdle, wNear, wGag, alertP, gagP } for continuous pose-to-pose morphing!
  //
  // Also includes `drawContinuousShowcaseCycle(...)` which renders a continuous
  // animated state-machine loop (`IDLE -> ANTICIPATION -> CURSOR-NEAR ALERT -> SCYTHE SWING -> ON-HIT GAG -> RECOVERY`)
  // with an approaching & slicing scythe cursor so you can watch the full in-field
  // reaction sequence continuously!
  // ============================================================================
  const DBD_JAPAN_TRIO_RENDERER = (() => {
    'use strict';
    function ell(ctx, x, y, rx, ry, rot = 0) {
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
      ctx.fill();
    }
    function circ(ctx, x, y, r) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
      ctx.fill();
    }
    function lerp(a, b, t) {
      return a + (b - a) * t;
    }
    function clamp01(t) {
      return Math.max(0, Math.min(1, t));
    }
    function smoothstep(a, b, t) {
      const u = clamp01((t - a) / Math.max(1e-5, b - a));
      return u * u * (3 - 2 * u);
    }
    function easeOutBack(t) {
      const u = clamp01(t);
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
    }
    function lerpHex(c1, c2, t) {
      const u = clamp01(t);
      const p1 = parseInt(c1.slice(1), 16);
      const p2 = parseInt(c2.slice(1), 16);
      const r = Math.round(lerp((p1 >> 16) & 255, (p2 >> 16) & 255, u));
      const g = Math.round(lerp((p1 >> 8) & 255, (p2 >> 8) & 255, u));
      const b = Math.round(lerp(p1 & 255, p2 & 255, u));
      return `rgb(${r},${g},${b})`;
    }
    function resolvePoseWeights(state, tNow = 0) {
      if (state && typeof state === 'object') {
        return {
          wIdle: state.wIdle ?? 0,
          wNear: state.wNear ?? 0,
          wGag: state.wGag ?? 0,
          alertP: state.alertP ?? state.wNear ?? 0,
          gagP: state.gagP ?? state.wGag ?? 0,
        };
      }
      if (state === 'near') {
        return { wIdle: 0, wNear: 1, wGag: 0, alertP: 1, gagP: 0 };
      }
      if (state === 'gag' || state === 'shocked') {
        return { wIdle: 0, wNear: 0, wGag: 1, alertP: 0, gagP: 1 };
      }
      return { wIdle: 1, wNear: 0, wGag: 0, alertP: 0, gagP: 0 };
    } // Sculpted layered dirt mound at (0, 0) matching the France & Canada Trio sheets
    function drawSculptedDirtMound(ctx, r, withLeftSprout = false, withRightClods = false, tNow = 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(43, 23, 8, 0.11)';
      ell(ctx, 0, 4.6, r * 0.94, r * 0.15);
      if (withLeftSprout) {
        const sproutSway = tNow > 0 ? Math.sin(tNow * 3.2) * 0.08 : 0;
        ctx.save();
        ctx.translate(-r * 0.66, -1.0);
        ctx.rotate(sproutSway);
        ctx.strokeStyle = '#2b1708';
        ctx.lineWidth = 1.3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(2, 2);
        ctx.quadraticCurveTo(-1.5, -2.5, -3.5, -6.2);
        ctx.stroke();
        for (const [lx, ly, rot, rx, ry] of [
          [-5.0, -6.8, -0.52, 3.0, 1.35],
          [-1.0, -6.5, 0.55, 2.5, 1.25],
        ]) {
          ctx.fillStyle = '#6b8e23';
          ctx.strokeStyle = '#2b1708';
          ctx.lineWidth = 1.15;
          ell(ctx, lx, ly, rx, ry, rot);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.fillStyle = '#4a2e16';
      ctx.strokeStyle = '#2b1708';
      ctx.lineWidth = 1.65;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.78, 3.4);
      ctx.quadraticCurveTo(-r * 0.8, -1.0, -r * 0.54, -1.4);
      ctx.quadraticCurveTo(-r * 0.4, -5.0, -r * 0.14, -3.9);
      ctx.quadraticCurveTo(0, -5.4, r * 0.16, -3.9);
      ctx.quadraticCurveTo(r * 0.42, -5.0, r * 0.54, -1.4);
      ctx.quadraticCurveTo(r * 0.8, -1.0, r * 0.78, 3.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#2b1708';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(-r * 0.24, -0.4, r * 0.15, Math.PI * 1.1, Math.PI * 1.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r * 0.22, -0.2, r * 0.16, Math.PI * 1.15, Math.PI * 1.9);
      ctx.stroke();
      if (withRightClods) {
        const clodHop = tNow > 0 ? Math.abs(Math.sin(tNow * 14.0)) * 2.2 : 0;
        ctx.fillStyle = '#4a2e16';
        ctx.strokeStyle = '#2b1708';
        ctx.lineWidth = 1.3;
        ell(ctx, -r * 0.74 - clodHop * 0.2, -5.4 - clodHop, 2.6, 1.7, 0.35);
        ctx.stroke();
        ell(ctx, r * 0.76 + clodHop * 0.2, -6.2 - clodHop, 2.7, 1.8, -0.35);
        ctx.stroke();
      }
      ctx.restore();
    } // Glossy blue cartoon sweat drop — slides & bobbles continuously when tNow > 0!
    function drawSweatDrop(ctx, x, y, scale = 1.0, rot = 0, tNow = 0) {
      if (scale <= 0.02) return;
      const slideY = tNow > 0 ? ((tNow * 1.85) % 1.0) * 2.5 : 0;
      const pulse = tNow > 0 ? 1.0 - ((tNow * 1.85) % 1.0) * 0.12 : 1.0;
      ctx.save();
      ctx.translate(x, y + slideY);
      ctx.rotate(rot);
      ctx.scale(scale * pulse, scale * pulse);
      ctx.fillStyle = '#5bc0eb';
      ctx.strokeStyle = '#231815';
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -6.5);
      ctx.bezierCurveTo(4.0, -1.2, 4.3, 4.0, 0, 4.4);
      ctx.bezierCurveTo(-4.3, 4.0, -4.0, -1.2, 0, -6.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e0f7ff';
      ell(ctx, -1.0, 0.8, 0.9, 1.9, -0.2);
      ctx.restore();
    } // Red 4-vein anime anger cross (`💢`) — throbs continuously when tNow > 0!
    function drawAngerVeinMark(ctx, x, y, scale = 1.0, rot = 0, tNow = 0) {
      if (scale <= 0.02) return;
      const pulse = tNow > 0 ? 1.0 + Math.sin(tNow * 14.0) * 0.15 : 1.0;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(scale * pulse, scale * pulse);
      ctx.strokeStyle = '#d62828';
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 2);
        ctx.beginPath();
        ctx.moveTo(-4.2, -1.4);
        ctx.quadraticCurveTo(-1.4, -1.4, -1.4, -4.2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    } // Crisp > < chevron wince eyes (State 3 On-Hit Gag — pulses with impact energy!)
    function drawChevronWinceEyes(ctx, leftX, rightX, eyeY, w, h, ink = '#231815', lw = 2.0, tNow = 0) {
      const squeeze = tNow > 0 ? 1.0 + Math.sin(tNow * 20.0) * 0.08 : 1.0;
      const hw = w * squeeze;
      const hh = h / squeeze;
      ctx.save();
      ctx.strokeStyle = ink;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(leftX - hw * 0.55, eyeY - hh);
      ctx.lineTo(leftX + hw * 0.45, eyeY);
      ctx.lineTo(leftX - hw * 0.55, eyeY + hh);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rightX + hw * 0.55, eyeY - hh);
      ctx.lineTo(rightX - hw * 0.45, eyeY);
      ctx.lineTo(rightX + hw * 0.55, eyeY + hh);
      ctx.stroke();
      ctx.restore();
    } // Clean Jagged Spiky Comic Explosion Speech Bubble for KIAI!, DON!, and WASABI!
    function drawSpikyExplosionBubble(
      ctx,
      cx,
      cy,
      rx,
      ry,
      tailTipX,
      tailTipY,
      text,
      fontSize = 5.5,
      tNow = 0,
      popScale = 1.0,
    ) {
      if (popScale <= 0.05) return;
      const pulse = (tNow > 0 ? 1.0 + Math.sin(tNow * 16.0) * 0.045 : 1.0) * popScale;
      ctx.save();
      const spikes = 14;
      const total = spikes * 2;
      const targetAng = Math.atan2(tailTipY - cy, tailTipX - cx);
      let bestOuterIdx = 0;
      let bestDiff = 999;
      for (let i = 0; i < total; i += 2) {
        const ang = (i * Math.PI) / spikes;
        const diff = Math.abs(Math.atan2(Math.sin(ang - targetAng), Math.cos(ang - targetAng)));
        if (diff < bestDiff) {
          bestDiff = diff;
          bestOuterIdx = i;
        }
      }
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 1.6;
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 6;
      ctx.beginPath();
      for (let i = 0; i < total; i++) {
        if (i === bestOuterIdx) {
          ctx.lineTo(tailTipX, tailTipY);
          continue;
        }
        const ang = (i * Math.PI) / spikes;
        const isOuter = i % 2 === 0;
        const radX = (isOuter ? rx * (i % 4 === 0 ? 1.2 : 1.1) : rx * 0.88) * pulse;
        const radY = (isOuter ? ry * (i % 4 === 0 ? 1.22 : 1.12) : ry * 0.86) * pulse;
        const px = cx + Math.cos(ang) * radX;
        const py = cy + Math.sin(ang) * radY;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.translate(cx, cy + 0.4);
      ctx.rotate(tNow > 0 ? Math.sin(tNow * 18.0) * 0.025 : 0);
      ctx.scale(popScale, popScale);
      ctx.fillStyle = '#1c1917';
      ctx.font = `italic 900 ${fontSize}px "Arial Black", "Impact", "Trebuchet MS", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 0);
      ctx.restore();
      ctx.restore();
    } // ==========================================================================
    // 1. SENSEI DAIKON (`daikon`, base r = 25)
    //    Giant White Radish — Karate Master
    // ==========================================================================
    function drawSenseiDaikon(ctx, r, state, tNow = 0, px = 0, py = 0, drawMound = true) {
      const INK = '#1e2022';
      const { wIdle, wNear, wGag, alertP, gagP } = resolvePoseWeights(state, tNow);
      const gagEased = easeOutBack(clamp01(gagP));
      const breatheY = wIdle * (tNow > 0 ? Math.sin(tNow * 3.4) * 0.018 : 0);
      const squatY = wNear * (1.3 + (tNow > 0 ? Math.sin(tNow * 14.0) * 0.4 : 0));
      const gagJumpY = wGag * (tNow > 0 ? -Math.abs(Math.sin(tNow * 12.0)) * 1.3 : 0);
      const bodyRot =
        wIdle * (tNow > 0 ? Math.sin(tNow * 2.2) * 0.014 : 0) +
        wNear * (tNow > 0 ? 0.015 * Math.sin(tNow * 20.0) : 0) +
        wGag * (-0.14 * gagEased + (tNow > 0 ? Math.sin(tNow * 18.0) * 0.028 : 0));
      ctx.save();
      ctx.translate(0, squatY + gagJumpY);
      ctx.save();
      ctx.rotate(bodyRot);
      ctx.scale(1 - breatheY * 0.45, 1 + breatheY); // 1. Lush 5-Bladed Radish Leaf Topknot Crown (`y = -r * 1.44`)
      function drawRadishLeaf(lx, ly, rx, ry, rot, fillCol, shadeCol) {
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.moveTo(0, 2);
        ctx.bezierCurveTo(-rx * 1.15, -ry * 0.45, -rx * 1.2, -ry * 1.55, 0, -ry * 1.85);
        ctx.bezierCurveTo(rx * 1.2, -ry * 1.55, rx * 1.15, -ry * 0.45, 0, 2);
        ctx.closePath();
        ctx.fillStyle = fillCol;
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = shadeCol;
        ctx.fillRect(-rx * 1.4, -ry * 2.0, rx * 1.25, ry * 2.2);
        ctx.restore();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.65;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.strokeStyle = 'rgba(20, 60, 28, 0.45)';
        ctx.lineWidth = 1.15;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -1);
        ctx.lineTo(0, -ry * 1.38);
        ctx.stroke();
        ctx.restore();
      }
      const leafSway =
        wIdle * (tNow > 0 ? Math.sin(tNow * 2.8) * 0.055 : 0) +
        wNear * (tNow > 0 ? Math.sin(tNow * 20.0) * 0.035 : 0) +
        wGag * (0.14 + (tNow > 0 ? Math.sin(tNow * 18.0) * 0.07 : 0));
      const crownY = -r * 1.42;
      drawRadishLeaf(-r * 0.22, crownY + 2.5, 4.2, 8.8, -0.58 + leafSway, '#22c55e', 'rgba(21, 128, 61, 0.35)');
      drawRadishLeaf(r * 0.22, crownY + 2.5, 4.2, 8.8, 0.58 + leafSway, '#22c55e', 'rgba(21, 128, 61, 0.35)');
      drawRadishLeaf(-r * 0.11, crownY + 1.0, 4.5, 10.2, -0.26 + leafSway, '#4ade80', 'rgba(22, 163, 74, 0.28)');
      drawRadishLeaf(r * 0.11, crownY + 1.0, 4.5, 10.2, 0.26 + leafSway, '#4ade80', 'rgba(22, 163, 74, 0.28)');
      drawRadishLeaf(0, crownY, 4.8, 11.2, 0.0 + leafSway, '#65e879', 'rgba(22, 163, 74, 0.25)'); // 2. Sculpted Tapered White Daikon Radish Body (smoothly flushes fiery karate red on top by wGag!)
      function traceDaikonBody(g) {
        g.beginPath();
        g.moveTo(0, -r * 1.46);
        g.bezierCurveTo(r * 0.52, -r * 1.46, r * 0.66, -r * 1.2, r * 0.62, -r * 0.8);
        g.bezierCurveTo(r * 0.58, -r * 0.42, r * 0.46, -r * 0.1, r * 0.34, r * 0.04);
        g.quadraticCurveTo(0, r * 0.1, -r * 0.34, r * 0.04);
        g.bezierCurveTo(-r * 0.46, -r * 0.1, -r * 0.58, -r * 0.42, -r * 0.62, -r * 0.8);
        g.bezierCurveTo(-r * 0.66, -r * 1.2, -r * 0.52, -r * 1.46, 0, -r * 1.46);
        g.closePath();
      }
      ctx.save();
      traceDaikonBody(ctx);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.clip();
      const dGrad = ctx.createLinearGradient(0, -r * 1.48, 0, r * 0.05);
      dGrad.addColorStop(0, lerpHex('#bef264', '#ff2e4c', wGag));
      dGrad.addColorStop(0.22, lerpHex('#dcfce7', '#ff5c72', wGag));
      dGrad.addColorStop(0.5, lerpHex('#ffffff', '#ffe4e6', wGag));
      dGrad.addColorStop(1, '#e2e8f0');
      ctx.fillStyle = dGrad;
      ctx.fillRect(-r, -r * 1.55, r * 2, r * 1.7);
      ctx.fillStyle = wGag > 0.5 ? 'rgba(136, 19, 55, 0.18)' : 'rgba(100, 116, 139, 0.16)';
      ctx.beginPath();
      ctx.moveTo(-r * 0.68, -r * 1.48);
      ctx.lineTo(-r * 0.24, -r * 1.48);
      ctx.bezierCurveTo(-r * 0.42, -r * 0.95, -r * 0.36, -r * 0.35, -r * 0.12, r * 0.08);
      ctx.lineTo(-r * 0.68, r * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)';
      ctx.lineWidth = 1.15;
      ctx.lineCap = 'round';
      for (const [wx, wy, wlen] of [
        [-r * 0.46, -r * 0.64, 4.2],
        [r * 0.44, -r * 0.72, -4.0],
        [-r * 0.38, -r * 0.22, 3.8],
        [r * 0.36, -r * 0.26, -3.6],
      ]) {
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + wlen, wy);
        ctx.stroke();
      }
      ctx.restore();
      traceDaikonBody(ctx);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.85;
      ctx.lineJoin = 'round';
      ctx.stroke(); // 3. Thick Black Karate Master Belt (`obi`) & Swaying Belt Tails (`y = -r * 0.50`)
      const beltY = -r * 0.5;
      ctx.save();
      ctx.fillStyle = '#27272a';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.65;
      ctx.beginPath();
      ctx.moveTo(-r * 0.58, beltY - 2.5);
      ctx.quadraticCurveTo(0, beltY - 0.8, r * 0.58, beltY - 2.5);
      ctx.lineTo(r * 0.55, beltY + 3.0);
      ctx.quadraticCurveTo(0, beltY + 4.7, -r * 0.55, beltY + 3.0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, beltY - 1.1);
      ctx.quadraticCurveTo(0, beltY + 0.3, r * 0.5, beltY - 1.1);
      ctx.stroke(); // Smoothly interpolated karate belt tail angles across Idle -> Near -> Gag!
      for (const [dir, len, baseAng] of [
        [-1, 9.2, 0.32],
        [1, 9.8, -0.36],
      ]) {
        const tailRot =
          baseAng +
          wIdle * (tNow > 0 ? Math.sin(tNow * 3.5) * 0.14 : 0) +
          wNear * (dir * 0.18 + (tNow > 0 ? Math.sin(tNow * 16.0) * 0.08 : 0)) +
          wGag * (-0.52 + (tNow > 0 ? Math.sin(tNow * 20.0) * 0.18 : 0));
        ctx.save();
        ctx.translate(dir * 2.4, beltY + 2.0);
        ctx.rotate(tailRot);
        ctx.fillStyle = '#3f3f46';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-2.1, 0);
        ctx.lineTo(2.1, 0);
        ctx.lineTo(2.5, len);
        ctx.lineTo(-2.3, len - 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-1.9, len - 2.8, 3.9, 1.3);
        ctx.restore();
      }
      ctx.fillStyle = '#3f3f46';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.55;
      ctx.beginPath();
      ctx.roundRect(-3.6, beltY - 1.7, 7.2, 5.2, 1.9);
      ctx.fill();
      ctx.stroke();
      ctx.restore(); // 4. Facial Expressions & Martial Arts Actions per State
      const eyeY = -r * 0.96;
      const eyeX = r * 0.22;
      const pOffX = Math.max(-1.5, Math.min(1.5, px * 0.48));
      const pOffY = Math.max(-1.1, Math.min(1.1, py * 0.42)); // Smoothly morphed Karate Sensei Eyebrows (`\ /`) across all 3 poses!
      const browAng = lerp(lerp(-0.34, -0.48, wNear), -0.52, wGag);
      const browY = lerp(lerp(eyeY - 4.4, eyeY - 4.2, wNear), eyeY - 5.0, wGag);
      if (wGag < 0.5) {
        for (const dir of [-1, 1]) {
          const ex = dir * eyeX;
          const er = lerp(3.5, 3.7, wNear);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.55;
          circ(ctx, ex, eyeY, er);
          ctx.stroke();
          ctx.fillStyle = INK;
          circ(ctx, ex + pOffX, eyeY + pOffY, lerp(1.65, 1.75, wNear));
          ctx.fillStyle = '#ffffff';
          circ(ctx, ex - 0.9 + pOffX * 0.4, eyeY - 1.0 + pOffY * 0.4, 0.7);
        }
        ctx.fillStyle = '#18181b';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.35;
        for (const dir of [-1, 1]) {
          ctx.save();
          ctx.translate(dir * (eyeX + 0.3), browY);
          ctx.rotate(dir * browAng);
          ctx.beginPath();
          ctx.roundRect(-4.7, -1.5, 9.4, 3.0, 1.2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        if (wNear < 0.5) {
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.75;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-4.0, -r * 0.68);
          ctx.quadraticCurveTo(0, -r * 0.73, 4.0, -r * 0.68);
          ctx.stroke();
        } else {
          drawAngerVeinMark(ctx, r * 0.34, -r * 1.24, 0.82 * clamp01(wNear * 1.2), 0, tNow);
          drawSweatDrop(ctx, -r * 0.56, -r * 1.04, 0.8 * clamp01(wNear * 1.2), 0, tNow);
          const my = -r * 0.69;
          const chatter = tNow > 0 ? Math.sin(tNow * 26.0) * 0.3 : 0;
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(-5.0, my - 2.3 - chatter, 10.0, 4.6 + chatter * 2, 1.6);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-4.8, my);
          ctx.lineTo(4.8, my);
          ctx.moveTo(-1.6, my - 2.2);
          ctx.lineTo(-1.6, my + 2.2);
          ctx.moveTo(1.6, my - 2.2);
          ctx.lineTo(1.6, my + 2.2);
          ctx.stroke(); // Twin raised white radish karate guard fists at sides (bobbing in combat rhythm!)
          const fScale = clamp01(easeOutBack(alertP));
          for (const [fx, fy, dir] of [
            [-r * 0.62, -r * 0.62, -1],
            [r * 0.62, -r * 0.68, 1],
          ]) {
            const fistBob = tNow > 0 ? Math.sin(tNow * 12.0 + dir * 1.2) * 1.2 : 0;
            ctx.fillStyle = '#f8fafc';
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.65;
            circ(ctx, fx, fy + fistBob, 3.6 * fScale);
            ctx.stroke();
          }
        }
      } else {
        // POSE 3: ON-HIT GAG (KARATE COUNTER-KICK & "KIAI!")
        drawChevronWinceEyes(ctx, -eyeX, eyeX, eyeY, 6.6, 2.7, INK, 2.0, tNow);
        ctx.fillStyle = '#18181b';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        for (const dir of [-1, 1]) {
          ctx.save();
          ctx.translate(dir * (eyeX + 0.2), browY);
          ctx.rotate(dir * browAng);
          ctx.beginPath();
          ctx.roundRect(-4.6, -1.4, 9.2, 2.8, 1.1);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        const my = -r * 0.68;
        const shoutPulse = tNow > 0 ? Math.sin(tNow * 18.0) * 0.5 : 0;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(-5.4, my - 3.6 - shoutPulse, 10.8, 7.2 + shoutPulse * 2, 2.6);
        ctx.fillStyle = '#4c0519';
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-5.4, my - 3.8 - shoutPulse, 10.8, 2.3);
        ctx.fillStyle = '#fb7185';
        ell(ctx, 0, my + 3.2, 4.4, 2.4);
        ctx.restore();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore(); // Left balance fist
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.65;
        circ(ctx, -r * 0.64, -r * 0.68, 3.5);
        ctx.stroke(); // Snapping Right Karate Side-Kick (`Yoko-Geri`) extending outward & oscillating!
        const kickSnap = clamp01(gagEased) * (1.0 + (tNow > 0 ? Math.sin(tNow * 20.0) * 0.12 : 0));
        const kickRot = -0.36 + (tNow > 0 ? Math.sin(tNow * 20.0) * 0.08 : 0);
        ctx.save();
        ctx.translate(r * 0.48, -r * 0.6);
        ctx.rotate(kickRot);
        ctx.scale(kickSnap, 1.0);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.75;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-2.5, -3.0);
        ctx.lineTo(r * 0.36, -3.2);
        ctx.bezierCurveTo(r * 0.42, -6.2, r * 0.58, -5.6, r * 0.58, -1.2);
        ctx.bezierCurveTo(r * 0.58, 2.8, r * 0.46, 4.2, r * 0.34, 3.2);
        ctx.lineTo(-2.5, 2.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore(); // Crisp double karate strike swoosh arcs
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(r * 0.68, -r * 0.72, r * 0.48 * kickSnap, -0.75, 0.55);
        ctx.stroke();
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(r * 0.76, -r * 0.72, r * 0.56 * kickSnap, -0.62, 0.44);
        ctx.stroke();
      }
      ctx.restore(); // End body transform
      // 5. Spiky "KIAI!" Explosion Bubble in Pose 3 (On-Hit Gag)
      if (wGag > 0.2) {
        drawSpikyExplosionBubble(
          ctx,
          r * 1.14,
          -r * 1.54,
          r * 0.52,
          r * 0.3,
          r * 0.54,
          -r * 1.14,
          'KIAI!',
          5.6,
          tNow,
          clamp01(gagEased),
        );
      }
      if (drawMound) {
        drawSculptedDirtMound(ctx, r * 1.0, false, wGag > 0.4, tNow);
      }
      ctx.restore();
    } // ==========================================================================
    // 2. RIKISHI KABOCHA (`kabocha`, base r = 30)
    //    Japanese Winter Squash — Sumo Wrestler
    // ==========================================================================
    function drawRikishiKabocha(ctx, r, state, tNow = 0, px = 0, py = 0, drawMound = true) {
      const INK = '#142615';
      const { wIdle, wNear, wGag, alertP, gagP } = resolvePoseWeights(state, tNow);
      const gagEased = easeOutBack(clamp01(gagP));
      const rockRot =
        wIdle * (tNow > 0 ? Math.sin(tNow * 3.0) * 0.048 : 0) +
        wNear * (tNow > 0 ? 0.015 * Math.sin(tNow * 22.0) : 0) +
        wGag * (tNow > 0 ? 0.025 * Math.sin(tNow * 20.0) : 0);
      const gagPulse = wGag * (tNow > 0 ? Math.sin(tNow * 18.0) * 0.025 : 0);
      const scaleX = 1.0 + wNear * 0.035 + wGag * (0.08 * gagEased + gagPulse);
      const scaleY = 1.0 - wNear * 0.035 - wGag * (0.05 * gagEased + gagPulse);
      const squatY = wIdle * (tNow > 0 ? Math.abs(Math.sin(tNow * 3.0)) * 0.8 : 0) + wNear * 1.2;
      ctx.save();
      ctx.translate(0, squatY);
      ctx.rotate(rockRot);
      ctx.scale(scaleX, scaleY); // 1. Glossy Black Sumo `Chonmage` Topknot Stem (`y = -r * 1.18` — bounces high in Gag!)
      ctx.save();
      const knotLift = wGag * (-4.4 * gagEased - (tNow > 0 ? Math.abs(Math.sin(tNow * 16.0)) * 1.6 : 0));
      const knotRot =
        wIdle * (tNow > 0 ? Math.sin(tNow * 3.0) * 0.04 : 0) +
        wGag * (-0.14 + (tNow > 0 ? Math.cos(tNow * 14.0) * 0.06 : 0));
      ctx.translate(0, -r * 1.18 + knotLift);
      ctx.rotate(knotRot);
      ctx.fillStyle = '#18181b';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.roundRect(-3.8, -5.5, 7.6, 8.5, 2.2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.roundRect(-4.1, -3.2, 8.2, 2.4, 0.8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#27272a';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.ellipse(0.5, -6.8, 6.8, 3.3, -0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ell(ctx, -1.2, -7.6, 3.4, 1.1, -0.12);
      if (wGag > 0.3) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(-7.5, -5.5, 4.5, Math.PI * 0.65, Math.PI * 1.15);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(8.2, -5.5, 4.5, -Math.PI * 0.15, Math.PI * 0.35);
        ctx.stroke();
      }
      ctx.restore(); // 2. Sculpted Multi-Lobed Dark-Green Kabocha Squash Body
      function traceKabochaBody(g) {
        g.beginPath();
        g.moveTo(-r * 0.36, -r * 1.14);
        g.quadraticCurveTo(-r * 0.18, -r * 1.22, -r * 0.08, -r * 1.16);
        g.quadraticCurveTo(0, -r * 1.22, r * 0.08, -r * 1.16);
        g.quadraticCurveTo(r * 0.18, -r * 1.22, r * 0.36, -r * 1.14);
        g.bezierCurveTo(r * 0.82, -r * 1.08, r * 0.96, -r * 0.66, r * 0.86, -r * 0.24);
        g.bezierCurveTo(r * 0.78, -r * 0.02, r * 0.52, r * 0.04, r * 0.24, r * 0.02);
        g.quadraticCurveTo(0, r * 0.06, -r * 0.24, r * 0.02);
        g.bezierCurveTo(-r * 0.52, r * 0.04, -r * 0.78, -r * 0.02, -r * 0.86, -r * 0.24);
        g.bezierCurveTo(-r * 0.96, -r * 0.66, -r * 0.82, -r * 1.08, -r * 0.36, -r * 1.14);
        g.closePath();
      }
      ctx.save();
      traceKabochaBody(ctx);
      ctx.fillStyle = '#2d7a22';
      ctx.fill();
      ctx.clip();
      const kGrad = ctx.createRadialGradient(lerp(r * 0.06, 0, wGag), -r * 0.74, r * 0.08, 0, -r * 0.6, r * 0.95);
      kGrad.addColorStop(0, lerpHex('#65c446', '#ff4757', wGag));
      kGrad.addColorStop(0.54, lerpHex('#2f8524', '#e03140', wGag));
      kGrad.addColorStop(0.84, '#2d7a22');
      kGrad.addColorStop(1, '#164a12');
      ctx.fillStyle = kGrad;
      ctx.fillRect(-r * 1.1, -r * 1.35, r * 2.2, r * 1.5);
      for (const rxFactor of [-0.52, -0.26, 0.26, 0.52]) {
        ctx.strokeStyle = 'rgba(187, 247, 208, 0.22)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(rxFactor * r * 0.45, -r * 1.2);
        ctx.bezierCurveTo(rxFactor * r * 1.25, -r * 0.85, rxFactor * r * 1.25, -r * 0.3, rxFactor * r * 0.55, r * 0.04);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(10, 38, 12, 0.36)';
        ctx.lineWidth = 1.35;
        ctx.beginPath();
        ctx.moveTo(rxFactor * r * 0.45, -r * 1.2);
        ctx.bezierCurveTo(rxFactor * r * 1.25, -r * 0.85, rxFactor * r * 1.25, -r * 0.3, rxFactor * r * 0.55, r * 0.04);
        ctx.stroke();
      } // 3. Ceremonial White-and-Red Sumo `Mawashi` Loincloth Belt
      const mawY = -r * 0.36;
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.65;
      ctx.beginPath();
      ctx.moveTo(-r * 0.95, mawY - 4.2);
      ctx.quadraticCurveTo(0, mawY - 1.2, r * 0.95, mawY - 4.2);
      ctx.lineTo(r * 0.95, mawY + 4.8);
      ctx.quadraticCurveTo(0, mawY + 7.8, -r * 0.95, mawY + 4.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(-r * 0.95, mawY - 1.4);
      ctx.quadraticCurveTo(0, mawY + 1.6, r * 0.95, mawY - 1.4);
      ctx.lineTo(r * 0.95, mawY + 2.0);
      ctx.quadraticCurveTo(0, mawY + 5.0, -r * 0.95, mawY + 2.0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.55;
      ctx.beginPath();
      ctx.roundRect(-5.2, mawY - 2.6, 10.4, 8.6, 2.2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-3.6, mawY + 0.2, 7.2, 3.0);
      ctx.restore(); // End body clip
      traceKabochaBody(ctx);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.9;
      ctx.lineJoin = 'round';
      ctx.stroke(); // 4. Facial Expressions, Sumo Cheeks & Tsuppari Palm Thrusts per State
      const eyeY = -r * 0.74;
      const eyeX = r * 0.25;
      const pOffX = Math.max(-1.5, Math.min(1.5, px * 0.48));
      const pOffY = Math.max(-1.1, Math.min(1.1, py * 0.42));
      if (wGag < 0.5) {
        ctx.fillStyle = `rgba(251, 113, 133, ${lerp(0.48, 0.58, wNear)})`;
        ell(ctx, -r * 0.44, -r * 0.56, lerp(4.6, 4.8, wNear), lerp(2.8, 3.0, wNear));
        ell(ctx, r * 0.44, -r * 0.56, lerp(4.6, 4.8, wNear), lerp(2.8, 3.0, wNear));
        for (const dir of [-1, 1]) {
          const ex = dir * eyeX;
          const er = lerp(3.7, 3.9, wNear);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.6;
          circ(ctx, ex, eyeY, er);
          ctx.stroke();
          ctx.fillStyle = INK;
          circ(ctx, ex + pOffX, eyeY + pOffY, lerp(1.75, 1.85, wNear));
          ctx.fillStyle = '#ffffff';
          circ(ctx, ex - 0.9 + pOffX * 0.4, eyeY - 1.0 + pOffY * 0.4, 0.75);
        } // Smoothly morphed Sumo Eyebrows
        const bAng = lerp(-0.22, -0.44, wNear);
        ctx.fillStyle = '#18181b';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        for (const dir of [-1, 1]) {
          ctx.save();
          ctx.translate(dir * (eyeX + lerp(0.5, 0.2, wNear)), eyeY - 4.7);
          ctx.rotate(dir * bAng);
          ctx.beginPath();
          ctx.roundRect(-4.9, -1.6, 9.8, 3.2, 1.3);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        if (wNear < 0.5) {
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(0, -r * 0.57, 4.2, 0.15 * Math.PI, 0.85 * Math.PI);
          ctx.stroke();
        } else {
          drawAngerVeinMark(ctx, -r * 0.42, -r * 0.98, 0.84 * clamp01(wNear * 1.2), 0, tNow);
          drawSweatDrop(ctx, r * 0.64, -r * 0.9, 0.82 * clamp01(wNear * 1.2), 0, tNow);
          const my = -r * 0.53;
          const chatter = tNow > 0 ? Math.sin(tNow * 28.0) * 0.3 : 0;
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.55;
          ctx.beginPath();
          ctx.roundRect(-5.8, my - 2.4 - chatter, 11.6, 4.8 + chatter * 2, 1.6);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-5.6, my);
          ctx.lineTo(5.6, my);
          ctx.moveTo(-2.0, my - 2.3);
          ctx.lineTo(-2.0, my + 2.3);
          ctx.moveTo(2.0, my - 2.3);
          ctx.lineTo(2.0, my + 2.3);
          ctx.stroke();
          const trem = tNow > 0 ? Math.sin(tNow * 28.0) * 0.04 : 0;
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.35;
          ctx.lineCap = 'round';
          for (const dir of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(
              0,
              -r * 0.56,
              r * 0.96,
              (dir < 0 ? Math.PI * 0.86 : -Math.PI * 0.14) + trem,
              (dir < 0 ? Math.PI * 1.14 : Math.PI * 0.14) + trem,
            );
            ctx.stroke();
          }
        }
      } else {
        // POSE 3: ON-HIT GAG (BELLY BOUNCE, TSUPPARI PALM THRUSTS & "DON!" DRUM IMPACT)
        drawChevronWinceEyes(ctx, -eyeX, eyeX, eyeY, 7.2, 3.0, INK, 2.1, tNow);
        const cheekPulse = tNow > 0 ? 5.2 + Math.sin(tNow * 18.0) * 0.45 : 5.2;
        for (const dir of [-1, 1]) {
          ctx.fillStyle = '#ff6b81';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.55;
          ctx.beginPath();
          ctx.arc(dir * r * 0.44, -r * 0.54, cheekPulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.85;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, -r * 0.47, 4.4, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke(); // Stubby green squash arms pumping in rapid alternating `tsuppari` palm thrusts!
        for (const dir of [-1, 1]) {
          const thrustPush = tNow > 0 ? Math.sin(tNow * 22.0 + (dir > 0 ? Math.PI : 0)) * 2.2 : 0;
          ctx.save();
          ctx.translate(dir * (r * 0.84 + thrustPush) * clamp01(gagEased), -r * 0.52 - thrustPush * 0.3);
          ctx.rotate(dir * (0.25 + thrustPush * 0.04));
          ctx.fillStyle = '#2f8524';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.75;
          ell(ctx, 0, 0, 5.2, 3.8);
          ctx.stroke();
          ctx.restore();
        } // Belly-bounce double shockwave rings radiating outward on left & right!
        const ringPush = tNow > 0 ? ((tNow * 2.6) % 1.0) * 2.8 : 0;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, -r * 0.52, r * 1.04 + ringPush, -0.35, 0.35);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -r * 0.52, r * 1.12 + ringPush, -0.26, 0.26);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -r * 0.52, r * 1.04 + ringPush, Math.PI - 0.35, Math.PI + 0.35);
        ctx.stroke();
      }
      ctx.restore(); // End body transform
      // 5. Spiky "DON!" Sumo Drum Impact Bubble in Pose 3 (On-Hit Gag)
      if (wGag > 0.2) {
        drawSpikyExplosionBubble(
          ctx,
          r * 1.08,
          -r * 1.38,
          r * 0.5,
          r * 0.29,
          r * 0.56,
          -r * 1.02,
          'DON!',
          5.6,
          tNow,
          clamp01(gagEased),
        );
      }
      if (drawMound) {
        drawSculptedDirtMound(ctx, r * 1.02, false, wGag > 0.4, tNow);
      }
      ctx.restore();
    } // ==========================================================================
    // 3. SHINOBI WASABI (`wasabi`, base r = 22)
    //    Mountain Wasabi Root — Stealth Ninja
    // ==========================================================================
    function drawShinobiWasabi(ctx, r, state, tNow = 0, px = 0, py = 0, drawMound = true) {
      const INK = '#112214';
      const { wIdle, wNear, wGag, alertP, gagP } = resolvePoseWeights(state, tNow);
      const gagEased = easeOutBack(clamp01(gagP));
      const crouchY = wNear * (1.5 + (tNow > 0 ? Math.sin(tNow * 16.0) * 0.35 : 0));
      const gagJumpY = wGag * (tNow > 0 ? -Math.abs(Math.sin(tNow * 13.0)) * 1.5 : 0);
      const bodyRot =
        wIdle * (tNow > 0 ? Math.sin(tNow * 3.6) * 0.024 : 0) +
        wNear * (-0.03 + (tNow > 0 ? Math.sin(tNow * 24.0) * 0.015 : 0)) +
        wGag * (0.08 * gagEased + (tNow > 0 ? Math.sin(tNow * 20.0) * 0.03 : 0));
      ctx.save();
      ctx.translate(0, crouchY + gagJumpY);
      ctx.save();
      ctx.rotate(bodyRot); // 1. Trio of Crisp Heart-Shaped Wasabi Crown Leaves (`y = -r * 1.44`)
      function drawWasabiCrownLeaf(lx, ly, rx, ry, rot, col) {
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(rot);
        ctx.fillStyle = col;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 2);
        ctx.bezierCurveTo(-rx * 1.3, -ry * 0.3, -rx * 1.25, -ry * 1.5, 0, -ry * 1.75);
        ctx.bezierCurveTo(rx * 1.25, -ry * 1.5, rx * 1.3, -ry * 0.3, 0, 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(17, 34, 20, 0.38)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -ry * 1.3);
        ctx.stroke();
        ctx.restore();
      }
      const lWave =
        wIdle * (tNow > 0 ? Math.sin(tNow * 3.4) * 0.065 : 0) +
        wNear * (tNow > 0 ? Math.sin(tNow * 20.0) * 0.04 : 0) +
        wGag * (0.18 + (tNow > 0 ? Math.sin(tNow * 18.0) * 0.08 : 0));
      drawWasabiCrownLeaf(-r * 0.15, -r * 1.4, 3.8, 7.2, -0.42 + lWave, '#22c55e');
      drawWasabiCrownLeaf(r * 0.15, -r * 1.4, 3.8, 7.2, 0.42 + lWave, '#22c55e');
      drawWasabiCrownLeaf(0, -r * 1.44, 4.2, 8.4, 0.0 + lWave, '#4ade80'); // 2. Fluttering Black Ninja Headband Tails on Right (`y = -r * 1.16`)
      ctx.save();
      const tailWave =
        wIdle * (tNow > 0 ? Math.sin(tNow * 6.0) * 1.8 : 0) +
        wNear * (1.5 + (tNow > 0 ? Math.sin(tNow * 18.0) * 1.2 : 0)) +
        wGag * (-5.0 + (tNow > 0 ? Math.sin(tNow * 22.0) * 2.2 : 0));
      ctx.translate(r * 0.48, -r * 1.16);
      for (const [ty, rot, len] of [
        [-1.5, -0.18, r * 0.62],
        [2.0, 0.16, r * 0.54],
      ]) {
        ctx.save();
        ctx.translate(0, ty);
        ctx.rotate(rot + tailWave * 0.04);
        ctx.fillStyle = '#18181b';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -2.0);
        ctx.quadraticCurveTo(len * 0.55, -3.2, len, -1.2);
        ctx.lineTo(len * 0.88, 0.6);
        ctx.lineTo(len, 2.4);
        ctx.quadraticCurveTo(len * 0.5, 1.8, 0, 2.0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore(); // 3. Sculpted Knobbly Wasabi Rhizome Body + Black Shinobi Cowl Wrap
      function traceWasabiBody(g) {
        g.beginPath();
        g.moveTo(0, -r * 1.44);
        g.bezierCurveTo(r * 0.48, -r * 1.44, r * 0.62, -r * 1.16, r * 0.56, -r * 0.84);
        g.quadraticCurveTo(r * 0.68, -r * 0.72, r * 0.54, -r * 0.56);
        g.quadraticCurveTo(r * 0.6, -r * 0.38, r * 0.44, -r * 0.22);
        g.quadraticCurveTo(r * 0.38, -r * 0.04, r * 0.28, r * 0.04);
        g.quadraticCurveTo(0, r * 0.1, -r * 0.28, r * 0.04);
        g.quadraticCurveTo(-r * 0.38, -r * 0.04, -r * 0.44, -r * 0.22);
        g.quadraticCurveTo(-r * 0.62, -r * 0.38, -r * 0.54, -r * 0.56);
        g.quadraticCurveTo(-r * 0.68, -r * 0.72, -r * 0.56, -r * 0.84);
        g.bezierCurveTo(-r * 0.62, -r * 1.16, -r * 0.48, -r * 1.44, 0, -r * 1.44);
        g.closePath();
      }
      ctx.save();
      traceWasabiBody(ctx);
      ctx.fillStyle = '#4ade80';
      ctx.fill();
      ctx.clip(); // Smoothly flushes fiery spicy-red inside the eye slit by wGag!
      const wGrad = ctx.createRadialGradient(r * 0.06, -r * 0.92, 2, 0, -r * 0.8, r * 0.95);
      wGrad.addColorStop(0, lerpHex('#bef264', '#ff3b5c', wGag));
      wGrad.addColorStop(0.55, lerpHex('#4ade80', '#e11d48', wGag));
      wGrad.addColorStop(1, lerpHex('#15803d', '#881337', wGag));
      ctx.fillStyle = wGrad;
      ctx.fillRect(-r, -r * 1.55, r * 2, r * 1.7);
      const slitTop = -r * 1.04;
      const slitBot = -r * 0.66;
      ctx.fillStyle = '#1e242b';
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, -r * 1.55);
      ctx.lineTo(r * 0.8, -r * 1.55);
      ctx.lineTo(r * 0.8, slitTop);
      ctx.quadraticCurveTo(0, slitTop + 2.2, -r * 0.8, slitTop);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1e242b';
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, slitBot);
      ctx.quadraticCurveTo(0, slitBot - 2.4, r * 0.8, slitBot);
      ctx.lineTo(r * 0.8, -r * 0.24);
      ctx.quadraticCurveTo(0, -r * 0.14, -r * 0.8, -r * 0.24);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(-r * 0.34, slitBot + 3.2);
      ctx.quadraticCurveTo(0, slitBot + 1.2, r * 0.34, slitBot + 3.2);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.65;
      ctx.beginPath();
      ctx.moveTo(-r * 0.65, slitTop);
      ctx.quadraticCurveTo(0, slitTop + 2.2, r * 0.65, slitTop);
      ctx.moveTo(-r * 0.65, slitBot);
      ctx.quadraticCurveTo(0, slitBot - 2.4, r * 0.65, slitBot);
      ctx.moveTo(-r * 0.56, -r * 0.24);
      ctx.quadraticCurveTo(0, -r * 0.14, r * 0.56, -r * 0.24);
      ctx.stroke();
      ctx.fillStyle = '#cbd5e1';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      ctx.roundRect(-r * 0.3, -r * 1.26, r * 0.6, 4.8, 1.4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      circ(ctx, -r * 0.22, -r * 1.26 + 2.4, 0.8);
      circ(ctx, r * 0.22, -r * 1.26 + 2.4, 0.8);
      ctx.restore(); // End body clip
      traceWasabiBody(ctx);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.85;
      ctx.lineJoin = 'round';
      ctx.stroke(); // 4. Eyes inside the Ninja Slit & Continuous Leaf-Kunai Dagger Trajectory across All 3 Poses!
      const eyeY = -r * 0.85;
      const eyeX = r * 0.2;
      const dartX =
        wIdle > 0.5
          ? px
            ? Math.max(-1.6, Math.min(1.6, px * 0.55))
            : tNow > 0
              ? Math.sin(tNow * 4.5) * 1.3
              : 0
          : Math.max(-1.6, Math.min(1.6, px * 0.5));
      const dartY = Math.max(-0.9, Math.min(0.9, py * 0.35));
      function drawLeafKunai(kx, ky, krot) {
        ctx.save();
        ctx.translate(kx, ky);
        ctx.rotate(krot);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(0, 4.8, 2.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.roundRect(-1.2, 0, 2.4, 3.2, 0.6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.55;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -11.5);
        ctx.lineTo(3.6, -2.5);
        ctx.lineTo(0, 0.4);
        ctx.lineTo(-3.6, -2.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(17, 34, 20, 0.45)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(0, -10.0);
        ctx.lineTo(0, -0.2);
        ctx.stroke();
        ctx.restore();
      } // Continuous Kunai Position & Angle across Idle (reverse grip) -> Near (parry guard) -> Gag (flung!)
      const kunaiX = -r * 0.64 * wIdle + -r * 0.54 * wNear + -r * 0.78 * wGag;
      const kunaiY =
        -r * 0.48 * wIdle +
        (-r * 0.64 + (tNow > 0 ? Math.sin(tNow * 14.0) * 0.8 : 0)) * wNear +
        (-r * 0.78 + (tNow > 0 ? Math.sin(tNow * 18.0) * 1.4 : 0)) * wGag;
      const kunaiRot =
        (-0.78 + (tNow > 0 ? Math.sin(tNow * 3.8) * 0.09 : 0)) * wIdle +
        (-0.32 + (tNow > 0 ? Math.sin(tNow * 16.0) * 0.08 : 0)) * wNear +
        (-1.18 + (tNow > 0 ? Math.sin(tNow * 22.0) * 0.22 : 0)) * wGag;
      if (wGag < 0.5) {
        for (const dir of [-1, 1]) {
          const ex = dir * eyeX;
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.5;
          ell(ctx, ex, eyeY, lerp(3.3, 3.4, wNear), lerp(2.9, 3.4, wNear));
          ctx.stroke();
          ctx.fillStyle = INK;
          circ(ctx, ex + dartX, eyeY + dartY, lerp(1.5, 1.6, wNear));
        } // Smoothly morphed Ninja Brows
        const bOutY = lerp(eyeY - 2.8, eyeY - 3.4, wNear);
        const bInY = lerp(eyeY - 1.8, eyeY - 1.4, wNear);
        ctx.strokeStyle = INK;
        ctx.lineWidth = lerp(1.75, 1.9, wNear);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-eyeX - 3.4, bOutY);
        ctx.lineTo(-eyeX + 3.0, bInY);
        ctx.moveTo(eyeX + 3.4, bOutY);
        ctx.lineTo(eyeX - 3.0, bInY);
        ctx.stroke();
        drawLeafKunai(kunaiX, kunaiY, kunaiRot);
        if (wNear > 0.25) {
          drawAngerVeinMark(ctx, -r * 0.36, -r * 1.18, 0.78 * clamp01(wNear * 1.2), 0, tNow);
          drawSweatDrop(ctx, r * 0.58, -r * 0.94, 0.78 * clamp01(wNear * 1.2), 0, tNow);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.25;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(-r * 0.56, -r * 0.66, 9.5, Math.PI * 0.85, Math.PI * 1.25);
          ctx.stroke();
        }
      } else {
        // POSE 3: ON-HIT GAG (SMOKE BOMB TELEPORT & SPICY SNEEZE!)
        drawChevronWinceEyes(ctx, -eyeX, eyeX, eyeY, 5.8, 2.4, INK, 1.95, tNow);
        drawLeafKunai(kunaiX, kunaiY, kunaiRot); // Billowing Multi-Lobe Green Wasabi Smoke Bomb Cloud at Base (churns & expands at 60fps!)
        const smokeScale = clamp01(gagEased);
        ctx.save();
        ctx.scale(smokeScale, smokeScale);
        ctx.fillStyle = '#86efac';
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 1.55;
        ctx.lineJoin = 'round';
        const puffs = [
          [-r * 0.52, -r * 0.16, 6.2, 0],
          [-r * 0.24, -r * 0.26, 7.4, 1],
          [r * 0.08, -r * 0.24, 7.8, 2],
          [r * 0.42, -r * 0.18, 6.6, 3],
          [r * 0.68, -r * 0.36, 5.4, 4],
          [-r * 0.68, -r * 0.38, 4.8, 5],
        ];
        for (const [px0, py0, pr0, idx] of puffs) {
          const pPulse = tNow > 0 ? 1.0 + Math.sin(tNow * 14.0 + idx * 1.1) * 0.13 : 1.0;
          circ(ctx, px0, py0, pr0 * pPulse);
          ctx.stroke();
        }
        ctx.fillStyle = '#bbf7d0';
        for (const [px0, py0, pr0, idx] of puffs) {
          const pPulse = tNow > 0 ? 1.0 + Math.sin(tNow * 14.0 + idx * 1.1) * 0.13 : 1.0;
          circ(ctx, px0, py0 - 0.6, pr0 * 0.76 * pPulse);
        } // Spicy lime-green 4-point star sparks sneezing & spinning outward!
        const sparkPush = tNow > 0 ? ((tNow * 2.5) % 1.0) * 2.5 : 0;
        const sparkRot = tNow > 0 ? Math.sin(tNow * 12.0) * 0.35 : 0;
        for (const [sx, sy, sr, dx, dy] of [
          [-r * 0.82, -r * 1.18, 3.6, -1, -0.5],
          [r * 0.76, -r * 0.72, 3.8, 1, -0.3],
          [r * 0.92, -r * 0.42, 3.0, 1, 0.3],
        ]) {
          ctx.save();
          ctx.translate(sx + dx * sparkPush, sy + dy * sparkPush);
          ctx.rotate(sparkRot);
          ctx.fillStyle = '#a3e635';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(0, -sr);
          ctx.quadraticCurveTo(0, 0, sr, 0);
          ctx.quadraticCurveTo(0, 0, 0, sr);
          ctx.quadraticCurveTo(0, 0, -sr, 0);
          ctx.quadraticCurveTo(0, 0, 0, -sr);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
      }
      ctx.restore(); // End body transform
      // 5. Spiky "WASABI!" Explosion Bubble in Pose 3 (On-Hit Gag)
      if (wGag > 0.2) {
        drawSpikyExplosionBubble(
          ctx,
          r * 1.22,
          -r * 1.58,
          r * 0.72,
          r * 0.35,
          r * 0.54,
          -r * 1.14,
          'WASABI!',
          4.8,
          tNow,
          clamp01(gagEased),
        );
      }
      if (drawMound) {
        drawSculptedDirtMound(ctx, r * 0.98, false, wGag > 0.4, tNow);
      }
      ctx.restore();
    } // Unified dispatcher for `FarmScene.ts` (`window.DBD_CROP_RENDERER`)
    function drawJapanCharacter(ctx, type, r, state, tNow = 0, px = 0, py = 0, drawMound = false) {
      if (type === 'daikon') {
        drawSenseiDaikon(ctx, r, state, tNow, px, py, drawMound);
        return true;
      }
      if (type === 'kabocha') {
        drawRikishiKabocha(ctx, r, state, tNow, px, py, drawMound);
        return true;
      }
      if (type === 'wasabi') {
        drawShinobiWasabi(ctx, r, state, tNow, px, py, drawMound);
        return true;
      }
      return false;
    } // ==========================================================================
    // Continuous State-Cycling Showcase Renderer (`IDLE -> ALERT -> SLICE -> GAG -> IDLE`)
    // ==========================================================================
    function drawContinuousShowcaseCycle(ctx, type, r, tNow, scale = 2.85) {
      const cycleDur = 4.5;
      const phase = (((tNow % cycleDur) + cycleDur) % cycleDur) / cycleDur;
      let st = 'idle';
      let stLabel = '▶ 1. IDLE';
      let stColor = '#15803d';
      let scytheX = 68,
        scytheY = -78,
        scytheAng = -0.4,
        showScythe = false,
        slashAlpha = 0;
      let squashX = 1.0,
        squashY = 1.0;
      let blendState = { wIdle: 1, wNear: 0, wGag: 0, alertP: 0, gagP: 0 };
      if (phase < 0.26) {
        st = 'idle';
        stLabel = '▶ 1. IDLE';
        stColor = '#15803d';
        blendState = { wIdle: 1, wNear: 0, wGag: 0, alertP: 0, gagP: 0 };
      } else if (phase < 0.34) {
        const u = smoothstep(0.26, 0.34, phase);
        st = 'near';
        stLabel = '⚡ 1→2 ANTICIPATION';
        stColor = '#d97706';
        blendState = { wIdle: 1 - u, wNear: u, wGag: 0, alertP: u, gagP: 0 };
        showScythe = true;
        scytheX = lerp(64, 48, u);
        scytheY = lerp(-72, -62, u);
        scytheAng = lerp(-0.25, -0.38, u);
        squashY = 1.0 - Math.sin(u * Math.PI) * 0.08;
        squashX = 1.0 / Math.sqrt(squashY);
      } else if (phase < 0.6) {
        const p = (phase - 0.34) / 0.26;
        st = 'near';
        stLabel = '⚠️ 2. CURSOR-NEAR ALERT!';
        stColor = '#d97706';
        blendState = { wIdle: 0, wNear: 1, wGag: 0, alertP: 1, gagP: 0 };
        showScythe = true;
        scytheX = 48 - p * 26;
        scytheY = -62 + Math.sin(p * Math.PI * 2) * 5;
        scytheAng = -0.38 - p * 0.42;
      } else if (phase < 0.9) {
        const p = (phase - 0.6) / 0.3;
        const u = smoothstep(0, 0.16, p);
        st = 'gag';
        stLabel = '💥 3. ON-HIT GAG!';
        stColor = '#dc2626';
        blendState = { wIdle: 0, wNear: 1 - u, wGag: u, alertP: 1 - u, gagP: clamp01(p / 0.25) };
        if (p < 0.35) {
          showScythe = true;
          const sp = p / 0.35;
          scytheX = 22 - sp * 58;
          scytheY = -48 + sp * 22;
          scytheAng = -0.8 + sp * 2.2;
          slashAlpha = 1.0 - sp;
        }
        const damp = Math.exp(-p * 6.2) * Math.cos(p * 23.0);
        squashY = 1.0 - damp * 0.21;
        squashX = 1.0 / Math.sqrt(Math.max(0.55, squashY));
      } else {
        const u = smoothstep(0.9, 1.0, phase);
        st = 'idle';
        stLabel = '🔄 3→1 RECOVERING';
        stColor = '#15803d';
        blendState = { wIdle: u, wNear: 0, wGag: 1 - u, alertP: 0, gagP: 1 - u };
        squashY = 1.0 + Math.sin(u * Math.PI) * 0.06;
        squashX = 1.0 / Math.sqrt(squashY);
      }
      const px = showScythe ? Math.cos(Math.atan2(scytheY + 25, scytheX)) * 1.8 : Math.sin(tNow * 2.2) * 1.1;
      const py = showScythe ? Math.sin(Math.atan2(scytheY + 25, scytheX)) * 1.4 : Math.cos(tNow * 1.7) * 0.6;
      ctx.save();
      ctx.scale(scale * squashX, scale * squashY);
      drawJapanCharacter(ctx, type, r, blendState, tNow, px, py, true);
      if (slashAlpha > 0.02) {
        ctx.save();
        ctx.strokeStyle = `rgba(254, 240, 138, ${slashAlpha * 0.92})`;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, -r * 0.85, r * 1.35, -0.85, 0.65);
        ctx.stroke();
        ctx.restore();
      }
      if (showScythe) {
        ctx.save();
        ctx.translate(scytheX, scytheY);
        ctx.rotate(scytheAng);
        ctx.strokeStyle = '#1c1008';
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 14);
        ctx.lineTo(0, -10);
        ctx.stroke();
        ctx.strokeStyle = '#9a5b25';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = '#1c1008';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.quadraticCurveTo(-14, -12, -20, -2);
        ctx.quadraticCurveTo(-12, -6, 0, -5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      return { st, stLabel, stColor };
    }
    return {
      drawSenseiDaikon,
      drawRikishiKabocha,
      drawShinobiWasabi,
      drawSculptedDirtMound,
      drawJapanCharacter,
      drawContinuousShowcaseCycle,
    };
  })();
  window.DBD_JAPAN_TRIO_RENDERER =
    DBD_JAPAN_TRIO_RENDERER; /* removed: window.DBD_JAPAN_TRIO_SOURCE_CODE (studio-only) */ // ============================================================================
  // Authored USA Trio Vector Renderer (Sheriff Habanero, Quarterback Sweetcorn, Smokey Brisket-Onion)
  // ============================================================================
  // ============================================================================
  // Due by Dusk — Complete USA Trio Authored Vector Character Renderer
  // Faithfully implements all 3 USA Trio characters from `image_7e465b.jpg`
  // in pure HTML5 Canvas 2D with continuous 60fps animations across all states:
  //
  //   1. Sheriff Habanero (`habanero`, r: 25) — Texas Habanero Pepper (Wild West Cowboy)
  //   2. Quarterback Sweetcorn (`sweetcorn`, r: 26) — Iowa Golden Sweet Corn (Football Linebacker)
  //   3. Smokey Brisket-Onion (`brisket_onion`, r: 25) — Vidalia Sweet Onion (BBQ Pitmaster)
  //
  // Supported States:
  //   - State 1 (`idle`):          !cursorNear && !shocked (continuous 60fps idle animation)
  //   - State 2 (`near`):          cursorNear && !shocked  (continuous 60fps cursor-near alert animation)
  //   - State 3 (`gag`/`shocked`): shocked                 (continuous 60fps on-hit slapstick gag animation)
  //
  // Also includes `drawContinuousShowcaseCard(...)` which renders a continuous
  // animated state-machine loop (`IDLE -> CURSOR-NEAR ALERT -> SCYTHE SWING -> ON-HIT GAG`)
  // with an approaching & slicing scythe cursor so you can watch the full in-field
  // reaction sequence continuously!
  // ============================================================================
  const DBD_USA_TRIO_RENDERER = (() => {
    'use strict';
    const INK = '#1c1008';
    function ell(ctx, x, y, rx, ry, rot = 0) {
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
      ctx.fill();
    }
    function circ(ctx, x, y, r) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
      ctx.fill();
    } // ==========================================================================
    // Multi-Clod Sculpted Western Dirt Mound
    // Organic clustered soil clods banking up on the left & right flanks while
    // dipping low in the center so the character base is framed cleanly!
    // ==========================================================================
    function drawCowboyDirtMoundBack(ctx, r) {
      ctx.save(); // Soft ground shadow
      ctx.fillStyle = 'rgba(28, 16, 8, 0.14)';
      ell(ctx, 0, r * 0.24, r * 1.24, r * 0.15); // Back flanking clod clusters banking up on the left & right sides
      ctx.fillStyle = '#5c3818';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.25;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 1.06, r * 0.06);
      ctx.bezierCurveTo(-r * 1.12, -r * 0.18, -r * 0.88, -r * 0.36, -r * 0.64, -r * 0.24);
      ctx.bezierCurveTo(-r * 0.52, -r * 0.4, -r * 0.28, -r * 0.34, -r * 0.18, -r * 0.12);
      ctx.lineTo(r * 0.18, -r * 0.12);
      ctx.bezierCurveTo(r * 0.28, -r * 0.34, r * 0.52, -r * 0.38, r * 0.64, -r * 0.22);
      ctx.bezierCurveTo(r * 0.86, -r * 0.34, r * 1.08, -r * 0.16, r * 1.02, r * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // Warm brown clod highlights on upper side mounds
      ctx.fillStyle = '#7c4d25';
      ell(ctx, -r * 0.78, -r * 0.16, r * 0.15, r * 0.07, -0.2);
      ell(ctx, -r * 0.44, -r * 0.22, r * 0.13, r * 0.06, 0.1);
      ell(ctx, r * 0.46, -r * 0.2, r * 0.13, r * 0.06, -0.1);
      ell(ctx, r * 0.76, -r * 0.15, r * 0.15, r * 0.07, 0.2);
      ctx.restore();
    }
    function drawCowboyDirtMoundFront(ctx, r) {
      ctx.save(); // Organic multi-scalloped front soil clods (scalloped on BOTH top and bottom!)
      ctx.fillStyle = '#6b4220';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.3;
      ctx.lineJoin = 'round';
      ctx.beginPath(); // Leftmost low clod
      ctx.moveTo(-r * 1.18, r * 0.12);
      ctx.bezierCurveTo(-r * 1.24, -r * 0.02, -r * 1.0, -r * 0.12, -r * 0.82, -r * 0.02); // Left-mid clod
      ctx.bezierCurveTo(-r * 0.68, -r * 0.16, -r * 0.4, -r * 0.12, -r * 0.26, r * 0.04); // Deep center V-cradle right under the base of the character (y = +r*0.16)
      ctx.bezierCurveTo(-r * 0.16, r * 0.0, -r * 0.05, r * 0.15, 0, r * 0.16);
      ctx.bezierCurveTo(r * 0.05, r * 0.15, r * 0.16, r * 0.0, r * 0.26, r * 0.04); // Right-mid clod
      ctx.bezierCurveTo(r * 0.4, -r * 0.12, r * 0.66, -r * 0.15, r * 0.8, -r * 0.02); // Rightmost clod
      ctx.bezierCurveTo(r * 0.98, -r * 0.1, r * 1.18, 0.0, r * 1.14, r * 0.12); // Scalloped organic bottom edge (not a flat line!)
      ctx.bezierCurveTo(r * 1.02, r * 0.22, r * 0.8, r * 0.2, r * 0.66, r * 0.16);
      ctx.bezierCurveTo(r * 0.52, r * 0.25, r * 0.26, r * 0.24, r * 0.12, r * 0.2);
      ctx.bezierCurveTo(r * 0.04, r * 0.26, -r * 0.06, r * 0.26, -r * 0.14, r * 0.2);
      ctx.bezierCurveTo(-r * 0.3, r * 0.25, -r * 0.56, r * 0.25, -r * 0.7, r * 0.16);
      ctx.bezierCurveTo(-r * 0.86, r * 0.22, -r * 1.08, r * 0.22, -r * 1.18, r * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // Warm soil top highlights on individual clods
      ctx.fillStyle = '#8c582c';
      ell(ctx, -r * 0.94, r * 0.04, r * 0.14, r * 0.05, -0.1);
      ell(ctx, -r * 0.52, -r * 0.02, r * 0.15, r * 0.06, 0.08);
      ell(ctx, r * 0.52, -r * 0.02, r * 0.15, r * 0.06, -0.08);
      ell(ctx, r * 0.92, r * 0.04, r * 0.13, r * 0.05, 0.1); // Internal clod separation arcs
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.95;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.82, -r * 0.02);
      ctx.quadraticCurveTo(-r * 0.74, r * 0.08, -r * 0.62, r * 0.08);
      ctx.moveTo(-r * 0.36, r * 0.06);
      ctx.quadraticCurveTo(-r * 0.24, r * 0.14, -r * 0.12, r * 0.12);
      ctx.moveTo(r * 0.12, r * 0.12);
      ctx.quadraticCurveTo(r * 0.24, r * 0.14, r * 0.36, r * 0.06);
      ctx.moveTo(r * 0.62, r * 0.08);
      ctx.quadraticCurveTo(r * 0.74, r * 0.08, r * 0.8, -r * 0.02);
      ctx.stroke(); // Scattered tiny pebbles around the base (matching reference sheet)
      ctx.fillStyle = '#5c3818';
      ctx.lineWidth = 0.9;
      for (const [px, py, prx, pry] of [
        [-r * 0.94, r * 0.25, 1.8, 1.0],
        [r * 0.66, r * 0.27, 2.1, 1.1],
        [r * 0.88, r * 0.24, 1.4, 0.9],
        [r * 0.48, r * 0.3, 1.2, 0.8],
      ]) {
        ell(ctx, px, py, prx, pry);
        ctx.stroke();
      }
      ctx.restore();
    } // ==========================================================================
    // Comic 4-Vein Red Anger Cross (`💢`) — Throbs continuously when tNow > 0!
    // ==========================================================================
    function drawAngerCross(ctx, x, y, sc = 1.0, tNow = 0) {
      const pulse = tNow > 0 ? 1.0 + Math.sin(tNow * 14.0) * 0.15 : 1.0;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(sc * pulse, sc * pulse);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const drawTick = (rot) => {
        ctx.save();
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.moveTo(-1.9, -6.2);
        ctx.quadraticCurveTo(-1.7, -1.7, -6.2, -1.9);
        ctx.stroke();
        ctx.restore();
      };
      for (let i = 0; i < 4; i++) drawTick(i * Math.PI * 0.5 + 0.12);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.3;
      for (let i = 0; i < 4; i++) drawTick(i * Math.PI * 0.5 + 0.12);
      ctx.restore();
    } // ==========================================================================
    // Blue Teardrop Sweat Drop — Slides & bobbles continuously when tNow > 0!
    // ==========================================================================
    function drawSweatDrop(ctx, x, y, sc = 1.0, rot = 0.06, tNow = 0) {
      const slideY = tNow > 0 ? ((tNow * 1.8) % 1.0) * 2.6 : 0;
      const pulse = tNow > 0 ? 1.0 - ((tNow * 1.8) % 1.0) * 0.12 : 1.0;
      ctx.save();
      ctx.translate(x, y + slideY);
      ctx.rotate(rot);
      ctx.scale(sc * pulse, sc * pulse);
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.15;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -5.0);
      ctx.bezierCurveTo(2.9, -0.8, 3.2, 3.0, 0, 3.8);
      ctx.bezierCurveTo(-3.2, 3.0, -2.9, -0.8, 0, -5.0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e0f2fe';
      ell(ctx, -0.7, 0.7, 0.75, 1.4, -0.15);
      ctx.restore();
    } // ==========================================================================
    // Side Steam Cloud Puff (for Pose 2 Cursor-Near Alert) — Chugs out when tNow > 0!
    // ==========================================================================
    function drawSideSteamPuff(ctx, x, y, dir = 1, tNow = 0) {
      const chug = tNow > 0 ? (tNow * 2.6 + (dir > 0 ? 0.35 : 0)) % 1.0 : 0;
      const pushX = dir * chug * 4.2;
      const puffSc = 1.0 + Math.sin(chug * Math.PI) * 0.18;
      ctx.save();
      ctx.translate(x + pushX, y - chug * 1.0);
      ctx.scale(dir * puffSc, puffSc); // Two crisp jet lines shooting into the steam cloud
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.0;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-8.2, -1.3);
      ctx.lineTo(-2.6, -1.8);
      ctx.moveTo(-8.2, 1.3);
      ctx.lineTo(-2.6, 1.8);
      ctx.stroke(); // Billowing 3-lobe white steam puff
      ctx.fillStyle = '#f5f2eb';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.15;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-2.6, -1.9);
      ctx.bezierCurveTo(-2.0, -5.5, 2.6, -5.8, 3.6, -2.6);
      ctx.bezierCurveTo(7.0, -3.4, 7.8, 1.5, 4.4, 2.8);
      ctx.bezierCurveTo(3.2, 5.5, -1.6, 5.1, -2.6, 1.9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // Soft inner curl
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(1.7, 0.7, 1.9, 0.2, Math.PI * 1.1);
      ctx.stroke();
      ctx.restore();
    } // ==========================================================================
    // General Spiky Comic Burst Speech Bubble ("YEE-HAW!", "HUT! HUT!", "DAGNABBIT!")
    // Supports 1 or 2 lines of bold comic text + continuous pulse when tNow > 0!
    // ==========================================================================
    function drawSpikyComicBurst(ctx, cx, cy, rx, ry, tailTipX, tailTipY, lines, fontSize = 7.0, tNow = 0) {
      const pulse = tNow > 0 ? 1.0 + Math.sin(tNow * 16.0) * 0.045 : 1.0;
      ctx.save();
      const spikes = 14;
      const pts = [];
      for (let i = 0; i < spikes * 2; i++) {
        const ang = (i * Math.PI) / spikes - Math.PI * 0.5;
        const isOuter = i % 2 === 0;
        const jitter = (((i * 7) % 5) - 2) * 0.03;
        const radScale = (isOuter ? 1.18 + jitter : 0.88 - jitter * 0.3) * pulse;
        pts.push([cx + Math.cos(ang) * rx * radScale, cy + Math.sin(ang) * ry * radScale]);
      }
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.25;
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 6;
      ctx.beginPath(); // Make outer vertex i=18 (bottom-left 7:30 o'clock) the long comic speech pointer!
      pts[18] = [tailTipX, tailTipY];
      pts[17][0] -= 2.0;
      pts[19][1] -= 2.0;
      for (let i = 0; i < pts.length; i++) {
        const [px, py] = pts[i];
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // Bold comic typography sized cleanly inside the burst
      ctx.save();
      ctx.translate(cx, cy + 0.5);
      ctx.rotate(0.05 + (tNow > 0 ? Math.sin(tNow * 18.0) * 0.025 : 0));
      ctx.fillStyle = INK;
      ctx.font = `italic 900 ${fontSize}px "Arial Black", "Impact", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (Array.isArray(lines) && lines.length === 2) {
        ctx.fillText(lines[0], 0, -fontSize * 0.58);
        ctx.fillText(lines[1], 0, fontSize * 0.58);
      } else {
        const txt = Array.isArray(lines) ? lines[0] : String(lines);
        ctx.fillText(txt, 0, 0);
      }
      ctx.restore();
      ctx.restore();
    } // ==========================================================================
    // Cattleman Cowboy Stetson Hat with 6-Point Gold Sheriff Star Badge
    // ==========================================================================
    function drawSheriffStetsonHat(ctx, r, showUnderside = false) {
      ctx.save();
      if (showUnderside) {
        // Airborne hat in Pose 3 (tilted steeply up-right, showing dark underside)
        ctx.fillStyle = '#f5efe6';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        ctx.lineJoin = 'round'; // Upper cattleman crown (3-ridge western crease)
        ctx.beginPath();
        ctx.moveTo(-r * 0.56, 0);
        ctx.bezierCurveTo(-r * 0.54, -r * 0.46, -r * 0.4, -r * 0.72, -r * 0.22, -r * 0.68);
        ctx.quadraticCurveTo(0, -r * 0.54, r * 0.22, -r * 0.7);
        ctx.bezierCurveTo(r * 0.42, -r * 0.72, r * 0.54, -r * 0.44, r * 0.56, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Crown side crease shadows
        ctx.fillStyle = '#dfd6c7';
        ctx.beginPath();
        ctx.moveTo(-r * 0.34, -r * 0.56);
        ctx.quadraticCurveTo(-r * 0.16, -r * 0.24, -r * 0.28, -r * 0.06);
        ctx.quadraticCurveTo(-r * 0.44, -r * 0.2, -r * 0.34, -r * 0.56);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(r * 0.32, -r * 0.56);
        ctx.quadraticCurveTo(r * 0.16, -r * 0.24, r * 0.28, -r * 0.06);
        ctx.quadraticCurveTo(r * 0.44, -r * 0.2, r * 0.32, -r * 0.56);
        ctx.fill(); // Crown crease lines
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.95;
        ctx.beginPath();
        ctx.moveTo(-r * 0.22, -r * 0.66);
        ctx.quadraticCurveTo(-r * 0.12, -r * 0.44, -r * 0.18, -r * 0.22);
        ctx.moveTo(r * 0.22, -r * 0.68);
        ctx.quadraticCurveTo(r * 0.12, -r * 0.44, r * 0.18, -r * 0.22);
        ctx.stroke(); // Brown leather hatband
        ctx.fillStyle = '#78350f';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.56, -r * 0.13);
        ctx.quadraticCurveTo(0, -r * 0.19, r * 0.56, -r * 0.13);
        ctx.lineTo(r * 0.57, 0.4);
        ctx.quadraticCurveTo(0, -r * 0.02, -r * 0.57, 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Sweeping upturned Stetson brim (with visible underside oval)
        ctx.fillStyle = '#e5dccf';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-r * 0.56, -r * 0.02);
        ctx.bezierCurveTo(-r * 1.02, -r * 0.1, -r * 1.22, 2.2, -r * 0.94, r * 0.28);
        ctx.bezierCurveTo(-r * 0.52, r * 0.44, r * 0.48, r * 0.38, r * 0.94, r * 0.16);
        ctx.bezierCurveTo(r * 1.22, -r * 0.04, r * 1.12, -r * 0.54, r * 0.8, -r * 0.42);
        ctx.bezierCurveTo(r * 0.66, -r * 0.34, r * 0.62, -r * 0.08, r * 0.56, -r * 0.02);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Shaded inner crown opening on underside of airborne hat
        ctx.fillStyle = '#8c7a6b';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.1;
        ell(ctx, -r * 0.02, r * 0.12, r * 0.52, r * 0.12, -0.05);
        ctx.stroke();
        ctx.fillStyle = '#4a3b32';
        ell(ctx, -r * 0.02, r * 0.11, r * 0.32, r * 0.06, -0.05);
      } else {
        // Standard worn Stetson Hat (Pose 1 & Pose 2)
        ctx.fillStyle = '#d8cfc0';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.52, -r * 0.16);
        ctx.bezierCurveTo(-r * 1.14, -r * 0.3, -r * 1.26, r * 0.22, -r * 0.66, r * 0.38);
        ctx.lineTo(-r * 0.48, r * 0.08);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Tall sculpted 3-ridge Cattleman Crown
        ctx.fillStyle = '#f5efe6';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-r * 0.56, 0.2);
        ctx.bezierCurveTo(-r * 0.54, -r * 0.48, -r * 0.4, -r * 0.76, -r * 0.2, -r * 0.7);
        ctx.quadraticCurveTo(0, -r * 0.54, r * 0.22, -r * 0.7);
        ctx.bezierCurveTo(r * 0.42, -r * 0.76, r * 0.54, -r * 0.46, r * 0.56, 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Subtle cattleman crown side dimples
        ctx.fillStyle = '#e2d9c8';
        ctx.beginPath();
        ctx.moveTo(-r * 0.35, -r * 0.56);
        ctx.quadraticCurveTo(-r * 0.16, -r * 0.24, -r * 0.28, -r * 0.08);
        ctx.quadraticCurveTo(-r * 0.46, -r * 0.22, -r * 0.35, -r * 0.56);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(r * 0.33, -r * 0.56);
        ctx.quadraticCurveTo(r * 0.16, -r * 0.24, r * 0.28, -r * 0.08);
        ctx.quadraticCurveTo(r * 0.46, -r * 0.22, r * 0.33, -r * 0.56);
        ctx.fill(); // Crown crease outline accents
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.95;
        ctx.beginPath();
        ctx.moveTo(-r * 0.21, -r * 0.69);
        ctx.quadraticCurveTo(-r * 0.1, -r * 0.44, -r * 0.18, -r * 0.24);
        ctx.moveTo(r * 0.22, -r * 0.69);
        ctx.quadraticCurveTo(r * 0.12, -r * 0.44, r * 0.18, -r * 0.24);
        ctx.stroke(); // Brown leather hatband at base of crown
        ctx.fillStyle = '#78350f';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.56, -r * 0.11);
        ctx.quadraticCurveTo(0, -r * 0.04, r * 0.56, -r * 0.11);
        ctx.lineTo(r * 0.57, r * 0.05);
        ctx.quadraticCurveTo(0, r * 0.12, -r * 0.57, r * 0.05);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Continuous front-to-right upturned Stetson cowboy brim
        ctx.fillStyle = '#f5efe6';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-r * 0.56, -r * 0.02);
        ctx.bezierCurveTo(-r * 0.96, -r * 0.2, -r * 1.06, r * 0.06, -r * 0.68, r * 0.14);
        ctx.bezierCurveTo(-r * 0.22, r * 0.24, r * 0.44, r * 0.24, r * 0.86, r * 0.1);
        ctx.bezierCurveTo(r * 1.16, -r * 0.02, r * 1.04, -r * 0.38, r * 0.78, -r * 0.26);
        ctx.bezierCurveTo(r * 0.66, -r * 0.18, r * 0.6, -r * 0.02, r * 0.54, 0.0);
        ctx.quadraticCurveTo(0, r * 0.1, -r * 0.56, -r * 0.02);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } // 6-Point Gold Sheriff Star Badge on the front center of the hat
      const starY = showUnderside ? -r * 0.32 : -r * 0.29;
      const starX = showUnderside ? r * 0.02 : r * 0.05;
      const outerR = r * 0.205;
      const innerR = r * 0.108;
      ctx.save();
      ctx.translate(starX, starY);
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#3b1d0a';
      ctx.lineWidth = 0.9;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 6;
        const rad = i % 2 === 0 ? outerR : innerR;
        const px = Math.cos(ang) * rad;
        const py = Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.lineWidth = 0.75;
      for (let i = 0; i < 6; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 3;
        const bx = Math.cos(ang) * (outerR + 0.6);
        const by = Math.sin(ang) * (outerR + 0.6);
        circ(ctx, bx, by, 0.8);
        ctx.stroke();
      }
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 3;
        const px = Math.cos(ang) * (innerR * 0.82);
        const py = Math.sin(ang) * (innerR * 0.82);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    } // ==========================================================================
    // Red Paisley Cowboy Bandana (Tied around neck with knot & fine woven print)
    // ==========================================================================
    function drawPaisleyBandana(ctx, r, tNow = 0) {
      ctx.save(); // Knot & two fluttering bandana tails on the left shoulder (-r * 0.66, -r * 0.66)
      const tailFlutter = tNow > 0 ? Math.sin(tNow * 6.5) * 0.14 : 0;
      ctx.save();
      ctx.translate(-r * 0.66, -r * 0.66);
      ctx.rotate(tailFlutter); // Upper tail
      ctx.fillStyle = '#a81c1c';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -1.2);
      ctx.bezierCurveTo(-5.0, -6.0, -9.6, -6.2, -10.8, -2.0);
      ctx.bezierCurveTo(-7.8, -0.4, -3.8, -0.2, 0, 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // Lower tail
      ctx.fillStyle = '#881414';
      ctx.beginPath();
      ctx.moveTo(-0.8, 0.4);
      ctx.bezierCurveTo(-5.8, 0.2, -10.2, 2.0, -9.5, 4.8);
      ctx.bezierCurveTo(-6.0, 4.6, -2.8, 2.6, 0.4, 1.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // Subtle stitch dots on tails
      ctx.fillStyle = 'rgba(255, 225, 215, 0.65)';
      circ(ctx, -6.0, -2.8, 0.5);
      circ(ctx, -7.8, -2.4, 0.4);
      circ(ctx, -5.6, 2.6, 0.5); // Knot bulb
      ctx.fillStyle = '#b91c1c';
      ell(ctx, -1.0, 0.2, 2.5, 2.1, -0.2);
      ctx.stroke();
      ctx.restore(); // Main triangular bandana bib draped asymmetrically across the chest
      ctx.fillStyle = '#b91c1c';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.25;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.66, -r * 0.66);
      ctx.quadraticCurveTo(r * 0.02, -r * 0.46, r * 0.64, -r * 0.58);
      ctx.bezierCurveTo(r * 0.58, -r * 0.34, r * 0.38, -r * 0.14, r * 0.14, -r * 0.02);
      ctx.quadraticCurveTo(r * 0.08, r * 0.01, r * 0.02, -r * 0.03);
      ctx.bezierCurveTo(-r * 0.28, -r * 0.2, -r * 0.54, -r * 0.42, -r * 0.66, -r * 0.66);
      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // Subtle fabric fold shadow along top neck roll
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 1.05;
      ctx.beginPath();
      ctx.moveTo(-r * 0.48, -r * 0.55);
      ctx.quadraticCurveTo(r * 0.02, -r * 0.4, r * 0.48, -r * 0.49);
      ctx.stroke(); // Fine woven Western bandana border & delicate stippled filigree
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 220, 210, 0.58)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.53);
      ctx.lineTo(r * 0.08, -r * 0.09);
      ctx.lineTo(r * 0.5, -r * 0.49);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.42, -r * 0.5);
      ctx.lineTo(r * 0.08, -r * 0.15);
      ctx.lineTo(r * 0.42, -r * 0.46);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 220, 210, 0.58)';
      for (const [dx, dy] of [
        [r * 0.08, -r * 0.23],
        [-r * 0.06, -r * 0.32],
        [r * 0.2, -r * 0.31],
        [-r * 0.2, -r * 0.41],
        [r * 0.3, -r * 0.39],
        [r * 0.04, -r * 0.37],
        [-r * 0.1, -r * 0.44],
        [r * 0.16, -r * 0.42],
      ]) {
        circ(ctx, dx, dy, 0.55);
      }
      for (let t = 0.2; t <= 0.8; t += 0.15) {
        const lx = -r * 0.46 * (1 - t) + r * 0.08 * t;
        const ly = -r * 0.51 * (1 - t) + -r * 0.12 * t;
        circ(ctx, lx, ly, 0.38);
        const rx0 = r * 0.46 * (1 - t) + r * 0.08 * t;
        const ry0 = -r * 0.47 * (1 - t) + -r * 0.12 * t;
        circ(ctx, rx0, ry0, 0.38);
      }
      ctx.restore();
      ctx.restore();
    } // ==========================================================================
    // Bushy Sculpted Cowboy Handlebar Mustache
    // ==========================================================================
    function drawCowboyMustache(ctx, r, yOff = 0, archUp = false, tNow = 0) {
      const twitch = tNow > 0 ? Math.sin(tNow * 9.0) * 0.035 : 0;
      ctx.save();
      ctx.translate(r * 0.04, yOff);
      ctx.rotate(twitch);
      ctx.fillStyle = '#7c3f16';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.25;
      ctx.lineJoin = 'round';
      const topCleft = archUp ? -4.2 : -2.8;
      const bottomArch = archUp ? -2.2 : 0.0; // Left handlebar wing
      ctx.beginPath();
      ctx.moveTo(0, topCleft);
      ctx.bezierCurveTo(-r * 0.16, -5.4, -r * 0.38, -1.8, -r * 0.5, 2.4);
      ctx.bezierCurveTo(-r * 0.58, 4.8, -r * 0.68, 4.4, -r * 0.7, 3.0);
      ctx.bezierCurveTo(-r * 0.62, 6.8, -r * 0.34, 6.4, -r * 0.16, archUp ? 1.6 : 2.4);
      ctx.quadraticCurveTo(-r * 0.06, bottomArch + 0.2, 0, bottomArch);
      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // Right handlebar wing
      ctx.beginPath();
      ctx.moveTo(0, topCleft);
      ctx.bezierCurveTo(r * 0.16, -5.4, r * 0.38, -1.8, r * 0.5, 2.4);
      ctx.bezierCurveTo(r * 0.58, 4.8, r * 0.68, 4.4, r * 0.7, 3.0);
      ctx.bezierCurveTo(r * 0.62, 6.8, r * 0.34, 6.4, r * 0.16, archUp ? 1.6 : 2.4);
      ctx.quadraticCurveTo(r * 0.06, bottomArch + 0.2, 0, bottomArch);
      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // Warm golden-brown highlight along top arch of mustache
      ctx.fillStyle = '#a15822';
      ell(ctx, -r * 0.2, -1.2, r * 0.11, 1.0, -0.45);
      ell(ctx, r * 0.2, -1.2, r * 0.11, 1.0, 0.45); // Sculpted hair texture striations inside mustache
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.1, -0.8);
      ctx.quadraticCurveTo(-r * 0.24, 1.0, -r * 0.4, 3.4);
      ctx.moveTo(-r * 0.2, -1.8);
      ctx.quadraticCurveTo(-r * 0.34, 0.4, -r * 0.5, 3.2);
      ctx.moveTo(r * 0.1, -0.8);
      ctx.quadraticCurveTo(r * 0.24, 1.0, r * 0.4, 3.4);
      ctx.moveTo(r * 0.2, -1.8);
      ctx.quadraticCurveTo(r * 0.34, 0.4, r * 0.5, 3.2);
      ctx.stroke();
      ctx.restore();
    } // ==========================================================================
    // 1. SHERIFF HABANERO (`habanero`) — Texas Habanero Pepper (Wild West Cowboy)
    // ==========================================================================
    function drawSheriffHabanero(ctx, r = 25, state = 'idle', tNow = 0, px = 0, py = 0, drawMound = false) {
      const isIdle = state === 'idle';
      const isNear = state === 'near';
      const isGag = state === 'gag' || state === 'shocked';
      ctx.save(); // Continuous 60fps breathing / tremor / recoil
      const breatheY = isIdle ? Math.sin(tNow * 3.6) * 0.85 : 0;
      const jitterX = isNear ? Math.sin(tNow * 32.0) * 0.65 : isGag && tNow > 0 ? Math.sin(tNow * 24.0) * 0.55 : 0;
      const gagBounceY = isGag && tNow > 0 ? -Math.abs(Math.sin(tNow * 10.0)) * 1.4 : 0;
      ctx.translate(jitterX, breatheY + gagBounceY);
      if (drawMound) {
        drawCowboyDirtMoundBack(ctx, r * 1.02);
      } // POSE 3 BACK LAYER: Blazing Head-Top Flame Eruption & Rising Smoke Puffs
      if (isGag) {
        ctx.save();
        const flameFlicker = tNow > 0 ? Math.sin(tNow * 22.0) * 1.6 : 0;
        const flameStretch = tNow > 0 ? 1.0 + Math.sin(tNow * 18.0) * 0.06 : 1.0; // Rising cream smoke puffs flanking the fire column
        const smokeRise = tNow > 0 ? ((tNow * 1.9) % 1.0) * 4.5 : 0;
        ctx.fillStyle = '#f5efe6';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.05;
        circ(ctx, -r * 0.54 - smokeRise * 0.2, -r * 1.84 - smokeRise, 2.7);
        ctx.stroke();
        circ(ctx, -r * 0.46, -r * 1.72 - smokeRise * 0.6, 1.9);
        ctx.stroke();
        circ(ctx, r * 0.62 + smokeRise * 0.2, -r * 1.92 - smokeRise, 3.2);
        ctx.stroke();
        circ(ctx, r * 0.54, -r * 1.78 - smokeRise * 0.6, 2.1);
        ctx.stroke(); // Outer red-orange flame column erupting from the pepper crown up to the airborne hat
        const flameGrad = ctx.createLinearGradient(0, -r * 1.32, -r * 0.18, -r * 2.48);
        flameGrad.addColorStop(0.0, '#ef4444');
        flameGrad.addColorStop(0.45, '#f97316');
        flameGrad.addColorStop(1.0, '#facc15');
        ctx.fillStyle = flameGrad;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.48, -r * 1.34);
        ctx.bezierCurveTo(-r * 0.64, -r * 1.54, -r * 0.56 + flameFlicker * 0.4, -r * 1.76, -r * 0.36, -r * 1.64);
        ctx.bezierCurveTo(
          -r * 0.48,
          -r * 1.92,
          -r * 0.38 - flameFlicker * 0.5,
          -r * 2.2 * flameStretch,
          -r * 0.26,
          -r * 2.42 * flameStretch,
        );
        ctx.lineTo(r * 0.14, -r * 2.46 * flameStretch);
        ctx.bezierCurveTo(
          r * 0.28 + flameFlicker * 0.5,
          -r * 2.16 * flameStretch,
          r * 0.44,
          -r * 1.88,
          r * 0.32,
          -r * 1.64,
        );
        ctx.bezierCurveTo(r * 0.52, -r * 1.78, r * 0.6 - flameFlicker * 0.4, -r * 1.52, r * 0.44, -r * 1.32);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Inner bright yellow-white fire core tongues
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(-r * 0.26, -r * 1.36);
        ctx.quadraticCurveTo(-r * 0.3 + flameFlicker * 0.3, -r * 1.82, -r * 0.16, -r * 2.26 * flameStretch);
        ctx.quadraticCurveTo(-r * 0.02, -r * 1.9, r * 0.06, -r * 2.28 * flameStretch);
        ctx.quadraticCurveTo(r * 0.26 - flameFlicker * 0.3, -r * 1.8, r * 0.22, -r * 1.35);
        ctx.closePath();
        ctx.fill(); // Tiny flying flame tongues on left and right
        ctx.fillStyle = '#f97316';
        ctx.lineWidth = 1.0;
        for (const [fx, fy, rot] of [
          [-r * 0.48, -r * 2.02 - Math.abs(flameFlicker), -0.3],
          [r * 0.44, -r * 1.78 - Math.abs(flameFlicker) * 0.7, 0.35],
        ]) {
          ctx.save();
          ctx.translate(fx, fy);
          ctx.rotate(rot);
          ctx.beginPath();
          ctx.moveTo(0, -3.6);
          ctx.quadraticCurveTo(2.0, 0, 0, 2.0);
          ctx.quadraticCurveTo(-2.0, 0, 0, -3.6);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
      } // POSE 2 BACK LAYER: Curved Green Habanero Stem poking behind top-left of hat
      if (isNear) {
        ctx.save();
        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.25;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.24, -r * 1.6);
        ctx.bezierCurveTo(-r * 0.32, -r * 1.98, -r * 0.52, -r * 2.18, -r * 0.74, -r * 2.12);
        ctx.bezierCurveTo(-r * 0.8, -r * 2.08, -r * 0.78, -r * 1.98, -r * 0.66, -r * 2.0);
        ctx.bezierCurveTo(-r * 0.5, -r * 2.02, -r * 0.38, -r * 1.82, -r * 0.34, -r * 1.56);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } // ARMS (Back / Side layer)
      const armColor = isGag ? '#dc2626' : '#ea580c';
      if (isIdle) {
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.56, -r * 0.56);
        ctx.lineTo(-r * 0.84, -r * 0.4);
        ctx.lineTo(-r * 0.56, -r * 0.22);
        ctx.stroke();
        ctx.strokeStyle = armColor;
        ctx.lineWidth = 2.0;
        ctx.stroke();
        ctx.fillStyle = '#6b3410';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ell(ctx, -r * 0.54, -r * 0.2, 3.2, 2.6, 0.2);
        ctx.stroke();
        ctx.restore();
      } else if (isNear) {
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.95;
        ctx.lineCap = 'round';
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(side * r * 0.82, -r * 0.42, 5.0, side > 0 ? -0.5 : Math.PI - 0.5, side > 0 ? 0.5 : Math.PI + 0.5);
          ctx.stroke();
        }
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.56, -r * 0.54);
        ctx.lineTo(r * 0.82, -r * 0.38);
        ctx.lineTo(r * 0.54, -r * 0.22);
        ctx.stroke();
        ctx.strokeStyle = armColor;
        ctx.lineWidth = 2.0;
        ctx.stroke();
        ctx.fillStyle = '#6b3410';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ell(ctx, r * 0.52, -r * 0.2, 3.0, 2.4, -0.2);
        ctx.stroke();
        ctx.restore();
      } // SCULPTED TEXAS HABANERO PEPPER BODY
      ctx.save();
      const bodyGrad = ctx.createLinearGradient(-r * 0.55, -r * 1.38, r * 0.6, r * 0.14);
      if (isGag) {
        bodyGrad.addColorStop(0.0, '#ff3b2f');
        bodyGrad.addColorStop(0.55, '#dc1414');
        bodyGrad.addColorStop(1.0, '#990b0b');
      } else {
        bodyGrad.addColorStop(0.0, '#ff7b24');
        bodyGrad.addColorStop(0.55, '#ea4c0f');
        bodyGrad.addColorStop(1.0, '#b42905');
      }
      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.38);
      ctx.bezierCurveTo(r * 0.22, -r * 1.46, r * 0.62, -r * 1.42, r * 0.68, -r * 1.06);
      ctx.bezierCurveTo(r * 0.74, -r * 0.68, r * 0.48, -r * 0.12, r * 0.08, r * 0.12);
      ctx.quadraticCurveTo(0, r * 0.18, -r * 0.08, r * 0.12);
      ctx.bezierCurveTo(-r * 0.5, -r * 0.12, -r * 0.74, -r * 0.68, -r * 0.68, -r * 1.06);
      ctx.bezierCurveTo(-r * 0.62, -r * 1.42, -r * 0.22, -r * 1.46, 0, -r * 1.38);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = isGag ? 'rgba(255, 180, 160, 0.42)' : 'rgba(255, 220, 140, 0.48)';
      ctx.beginPath();
      ctx.moveTo(-r * 0.48, -r * 1.24);
      ctx.bezierCurveTo(-r * 0.6, -r * 0.96, -r * 0.56, -r * 0.56, -r * 0.34, -r * 0.22);
      ctx.bezierCurveTo(-r * 0.44, -r * 0.56, -r * 0.46, -r * 0.94, -r * 0.36, -r * 1.22);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = isGag ? '#7f1d1d' : '#9a2204';
      ctx.lineWidth = 0.95;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.36, -r * 1.34);
      ctx.bezierCurveTo(-r * 0.48, -r * 1.0, -r * 0.42, -r * 0.56, -r * 0.16, r * 0.02);
      ctx.moveTo(r * 0.38, -r * 1.32);
      ctx.bezierCurveTo(r * 0.48, -r * 1.0, r * 0.42, -r * 0.56, r * 0.18, -r * 0.02);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.38);
      ctx.bezierCurveTo(r * 0.22, -r * 1.46, r * 0.62, -r * 1.42, r * 0.68, -r * 1.06);
      ctx.bezierCurveTo(r * 0.74, -r * 0.68, r * 0.48, -r * 0.12, r * 0.08, r * 0.12);
      ctx.quadraticCurveTo(0, r * 0.18, -r * 0.08, r * 0.12);
      ctx.bezierCurveTo(-r * 0.5, -r * 0.12, -r * 0.74, -r * 0.68, -r * 0.68, -r * 1.06);
      ctx.bezierCurveTo(-r * 0.62, -r * 1.42, -r * 0.22, -r * 1.46, 0, -r * 1.38);
      ctx.closePath();
      ctx.stroke();
      ctx.restore(); // POSE 3 CROWN CALYX & GREEN PEPPER STEM
      if (isGag) {
        ctx.save();
        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.25;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.26, -r * 1.36);
        ctx.quadraticCurveTo(-r * 0.12, -r * 1.42, -r * 0.08, -r * 1.52);
        ctx.bezierCurveTo(-r * 0.1, -r * 1.68, -r * 0.18, -r * 1.78, -r * 0.26, -r * 1.82);
        ctx.bezierCurveTo(-r * 0.22, -r * 1.9, -r * 0.08, -r * 1.88, r * 0.02, -r * 1.74);
        ctx.bezierCurveTo(r * 0.08, -r * 1.62, r * 0.08, -r * 1.48, r * 0.26, -r * 1.36);
        ctx.quadraticCurveTo(r * 0.1, -r * 1.28, 0, -r * 1.32);
        ctx.quadraticCurveTo(-r * 0.12, -r * 1.28, -r * 0.26, -r * 1.36);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } // RED PAISLEY COWBOY BANDANA
      drawPaisleyBandana(ctx, r, tNow); // FACIAL EXPRESSION & BUSHY COWBOY MUSTACHE
      const eyeY = -r * 1.04;
      const eyeSep = r * 0.23;
      if (isIdle) {
        for (const [side, ex] of [
          [-1, -eyeSep + 1.5],
          [1, eyeSep + 2.0],
        ]) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.05;
          ell(ctx, ex, eyeY + 1.2, 3.3, 1.7);
          ctx.stroke();
          ctx.fillStyle = INK;
          circ(ctx, ex + 0.6 + px * 0.25, eyeY + 1.4 + py * 0.15, 1.3);
          ctx.fillStyle = '#d9530f';
          ctx.beginPath();
          ctx.arc(ex, eyeY + 1.0, 3.4, Math.PI * 1.02, Math.PI * 1.98);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.moveTo(ex - 3.6, eyeY + 1.0);
          ctx.quadraticCurveTo(ex, eyeY + 0.6, ex + 3.6, eyeY + 1.0);
          ctx.stroke();
          ctx.lineWidth = 0.85;
          ctx.beginPath();
          ctx.moveTo(ex - 2.3, eyeY + 3.1);
          ctx.quadraticCurveTo(ex, eyeY + 3.7, ex + 2.3, eyeY + 2.9);
          ctx.stroke();
        }
        ctx.fillStyle = '#451a03';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(-eyeSep - 2.5, eyeY - 1.8);
        ctx.quadraticCurveTo(-eyeSep + 1.5, eyeY - 3.9, -eyeSep + 5.0, eyeY - 2.0);
        ctx.quadraticCurveTo(-eyeSep + 1.5, eyeY - 2.2, -eyeSep - 2.5, eyeY - 1.8);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(eyeSep - 1.6, eyeY - 2.2);
        ctx.quadraticCurveTo(eyeSep + 2.0, eyeY - 4.1, eyeSep + 5.4, eyeY - 1.8);
        ctx.quadraticCurveTo(eyeSep + 1.8, eyeY - 2.2, eyeSep - 1.6, eyeY - 2.2);
        ctx.fill();
        ctx.stroke(); // Golden Wheat Straw bobbing gently as he chews it in Idle!
        const wheatBob = tNow > 0 ? Math.sin(tNow * 5.2) * 0.09 : 0;
        ctx.save();
        ctx.translate(r * 0.22, -r * 0.73);
        ctx.rotate(wheatBob);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(r * 0.46, r * 0.11, r * 0.96, r * 0.39);
        ctx.stroke();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1.05;
        ctx.stroke();
        ctx.translate(r * 0.72, r * 0.24);
        ctx.rotate(0.48);
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.85;
        for (const [kx, ky, rot] of [
          [0, -1.35, -0.35],
          [0, 1.35, 0.35],
          [2.8, -1.25, -0.35],
          [2.8, 1.25, 0.35],
          [5.4, -1.05, -0.25],
          [5.4, 1.05, 0.25],
          [7.6, 0, 0],
        ]) {
          ell(ctx, kx, ky, 1.8, 0.9, rot);
          ctx.stroke();
        }
        ctx.restore();
        drawCowboyMustache(ctx, r, -r * 0.74, false, tNow);
      } else if (isNear) {
        for (const [side, ex] of [
          [-1, -eyeSep + 1.0],
          [1, eyeSep + 2.5],
        ]) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.15;
          ctx.beginPath();
          ctx.arc(ex, eyeY + 0.8, 3.5, 0.05 * Math.PI, 0.95 * Math.PI, false);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = INK;
          circ(ctx, ex + 0.4 + px * 0.3, eyeY + 1.9 + py * 0.2, 1.4);
          ctx.fillStyle = '#ffffff';
          circ(ctx, ex - 0.1, eyeY + 1.4, 0.48);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 0.85;
          ctx.beginPath();
          ctx.arc(ex, eyeY + 1.3, 4.1, 0.2 * Math.PI, 0.8 * Math.PI);
          ctx.stroke();
        }
        ctx.fillStyle = '#451a03';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.1;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-eyeSep - 3.2, eyeY - 2.3);
        ctx.lineTo(-eyeSep + 4.6, eyeY + 0.6);
        ctx.lineTo(-eyeSep + 4.0, eyeY + 1.9);
        ctx.lineTo(-eyeSep - 3.8, eyeY - 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(eyeSep + 6.0, eyeY - 2.3);
        ctx.lineTo(eyeSep - 1.5, eyeY + 0.6);
        ctx.lineTo(eyeSep - 0.8, eyeY + 1.9);
        ctx.lineTo(eyeSep + 6.6, eyeY - 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(0.8, eyeY - 1.9);
        ctx.lineTo(0.8, eyeY + 0.5);
        ctx.moveTo(2.2, eyeY - 1.7);
        ctx.lineTo(2.2, eyeY + 0.5);
        ctx.stroke();
        drawSweatDrop(ctx, -r * 0.46, -r * 0.98, 0.86, 0.05, tNow);
        drawCowboyMustache(ctx, r, -r * 0.73, false, tNow);
        drawSideSteamPuff(ctx, -r * 1.12, -r * 0.98, -1, tNow);
        drawSideSteamPuff(ctx, r * 1.12, -r * 0.98, 1, tNow);
        drawAngerCross(ctx, r * 0.92, -r * 1.72, 0.88, tNow);
      } else {
        // POSE 3 (ON-HIT GAG)
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.55;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-eyeSep - 2.6, eyeY - 3.5);
        ctx.lineTo(-eyeSep + 2.6, eyeY - 1.0);
        ctx.moveTo(eyeSep + 3.2, eyeY - 3.5);
        ctx.lineTo(eyeSep - 2.0, eyeY - 1.0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-eyeSep - 2.8, eyeY + 0.2);
        ctx.lineTo(-eyeSep + 2.0, eyeY + 2.1);
        ctx.lineTo(-eyeSep - 2.8, eyeY + 4.0);
        ctx.moveTo(eyeSep + 3.4, eyeY + 0.2);
        ctx.lineTo(eyeSep - 1.4, eyeY + 2.1);
        ctx.lineTo(eyeSep + 3.4, eyeY + 4.0);
        ctx.stroke();
        const mouthY = -r * 0.68;
        ctx.fillStyle = '#3b0808';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.moveTo(-3.6, mouthY + 2.2);
        ctx.quadraticCurveTo(r * 0.04, mouthY - 3.2, 4.4, mouthY + 2.2);
        ctx.quadraticCurveTo(r * 0.04, mouthY + 3.4, -3.6, mouthY + 2.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fb7185';
        ell(ctx, r * 0.04, mouthY + 1.8, 2.1, 0.9);
        drawCowboyMustache(ctx, r, -r * 0.78, true, tNow);
      } // FOREGROUND ARMS, PROPS & STETSON HAT PER POSE
      if (isIdle) {
        const tipRock = tNow > 0 ? Math.sin(tNow * 3.6) * 0.035 : 0;
        ctx.save();
        ctx.translate(-r * 0.02, -r * 1.45);
        ctx.rotate(-0.07 + tipRock);
        drawSheriffStetsonHat(ctx, r, false);
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.56, -r * 0.66);
        ctx.lineTo(r * 0.88, -r * 0.8);
        ctx.lineTo(r * 0.78, -r * 1.26 + tipRock * 8);
        ctx.stroke();
        ctx.strokeStyle = armColor;
        ctx.lineWidth = 2.0;
        ctx.stroke();
        ctx.fillStyle = '#6b3410';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.25;
        ell(ctx, r * 0.76, -r * 1.3 + tipRock * 8, 3.4, 2.7, -0.35);
        ctx.stroke();
        ctx.fillStyle = '#854d0e';
        circ(ctx, r * 0.68, -r * 1.34 + tipRock * 8, 1.45);
        ctx.stroke();
        ctx.restore();
      } else if (isNear) {
        ctx.save();
        ctx.translate(r * 0.01, -r * 1.45);
        ctx.rotate(-0.05);
        drawSheriffStetsonHat(ctx, r, false);
        ctx.restore();
        const gunTwitch = tNow > 0 ? Math.sin(tNow * 14.0) * 0.8 : 0;
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.56, -r * 0.56);
        ctx.lineTo(-r * 0.84, -r * 0.4);
        ctx.lineTo(-r * 0.48, -r * 0.24 + gunTwitch);
        ctx.stroke();
        ctx.strokeStyle = armColor;
        ctx.lineWidth = 2.0;
        ctx.stroke();
        ctx.fillStyle = '#6b3410';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ell(ctx, -r * 0.48, -r * 0.24 + gunTwitch, 3.0, 2.3, 0.3);
        ctx.stroke();
        ctx.restore();
      } else {
        // POSE 3 (ON-HIT GAG): Airborne Stetson Hat + Spinning Lasso + "YEE-HAW!"
        const hatHover = tNow > 0 ? Math.sin(tNow * 15.0) * 2.2 : 0;
        const hatWobble = tNow > 0 ? Math.cos(tNow * 12.0) * 0.06 : 0;
        ctx.save();
        ctx.translate(-r * 0.18, -r * 2.4 + hatHover);
        ctx.rotate(-0.36 + hatWobble);
        drawSheriffStetsonHat(ctx, r * 0.94, true);
        ctx.restore();
        const lassoWave = tNow > 0 ? Math.sin(tNow * 18.0) * 1.5 : 0;
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.56, -r * 0.52);
        ctx.lineTo(-r * 0.88, -r * 0.52);
        ctx.lineTo(-r * 1.02, -r * 0.78 + lassoWave * 0.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.56, -r * 0.46);
        ctx.lineTo(r * 0.82, -r * 0.5);
        ctx.lineTo(r * 0.94, -r * 0.72 - lassoWave * 0.4);
        ctx.stroke();
        ctx.strokeStyle = armColor;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(-r * 0.56, -r * 0.52);
        ctx.lineTo(-r * 0.88, -r * 0.52);
        ctx.lineTo(-r * 1.02, -r * 0.78 + lassoWave * 0.4);
        ctx.moveTo(r * 0.56, -r * 0.46);
        ctx.lineTo(r * 0.82, -r * 0.5);
        ctx.lineTo(r * 0.94, -r * 0.72 - lassoWave * 0.4);
        ctx.stroke();
        ctx.restore();
        const drawRopePath = (fn) => {
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 3.0;
          ctx.beginPath();
          fn();
          ctx.stroke();
          ctx.strokeStyle = '#d6b37c';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          fn();
          ctx.stroke();
          ctx.restore();
        };
        const spinTilt = tNow > 0 ? Math.sin(tNow * 20.0) * 0.08 : 0;
        drawRopePath(() => {
          ctx.ellipse(-r * 1.46, -r * 1.22 + lassoWave * 0.5, r * 0.66, r * 0.19, -0.06 + spinTilt, 0, Math.PI * 2);
        });
        drawRopePath(() => {
          ctx.moveTo(-r * 1.02, -r * 0.78 + lassoWave * 0.4);
          ctx.quadraticCurveTo(-r * 0.94, -r * 1.0, -r * 1.06, -r * 1.15 + lassoWave * 0.5);
        });
        ctx.save();
        ctx.fillStyle = '#c29b61';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.1;
        ell(ctx, -r * 1.06, -r * 1.15 + lassoWave * 0.5, 2.2, 1.5, 0.3);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(-r * 0.74, -r * 1.2 + lassoWave * 0.5, 6.0, -0.55, 0.55);
        ctx.moveTo(-r * 2.14, -r * 1.06 + lassoWave * 0.5);
        ctx.quadraticCurveTo(-r * 1.98, -r * 0.94 + lassoWave * 0.5, -r * 1.8, -r * 0.96 + lassoWave * 0.5);
        ctx.stroke();
        ctx.restore();
        drawRopePath(() => {
          ctx.moveTo(-r * 1.02, -r * 0.78 + lassoWave * 0.4);
          ctx.bezierCurveTo(-r * 1.12, -r * 0.08, -r * 0.36, -r * 0.04, r * 0.28, -r * 0.22);
          ctx.bezierCurveTo(r * 0.64, -r * 0.32, r * 0.8, -r * 0.54, r * 0.94, -r * 0.72 - lassoWave * 0.4);
          ctx.bezierCurveTo(r * 1.08, -r * 0.4, r * 0.92, -r * 0.06, r * 0.7, -r * 0.14);
          ctx.bezierCurveTo(r * 0.52, -r * 0.22, r * 0.72, -r * 0.7, r * 1.04, -r * 0.74 - lassoWave * 0.4);
          ctx.bezierCurveTo(
            r * 1.44,
            -r * 0.78,
            r * 1.82,
            -r * 0.54 + lassoWave * 0.6,
            r * 2.06,
            -r * 0.78 - lassoWave * 0.5,
          );
          ctx.bezierCurveTo(r * 2.18, -r * 0.9, r * 1.96, -r * 1.12 - lassoWave * 0.5, r * 1.58, -r * 1.14);
        });
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(r * 1.98, -r * 0.94 - lassoWave * 0.4, 5.5, -0.6, 0.5);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.fillStyle = '#6b3410';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ell(ctx, -r * 1.02, -r * 0.78 + lassoWave * 0.4, 3.3, 2.7, -0.2);
        ctx.stroke();
        ell(ctx, r * 0.94, -r * 0.72 - lassoWave * 0.4, 3.3, 2.7, 0.2);
        ctx.stroke();
        ctx.restore();
        drawSpikyComicBurst(ctx, r * 1.66, -r * 1.66, r * 0.84, r * 0.46, r * 0.82, -r * 1.12, 'YEE-HAW!', 7.1, tNow);
      }
      if (drawMound) {
        drawCowboyDirtMoundFront(ctx, r * 1.02);
      }
      if (isNear) {
        const gunTwitch = tNow > 0 ? Math.sin(tNow * 14.0) * 0.08 : 0;
        ctx.save();
        ctx.translate(-r * 0.38, -r * 0.14);
        ctx.rotate(0.24 + gunTwitch);
        ctx.fillStyle = '#78350f';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.roundRect(-3.4, -2.8, 3.6, 4.6, 1.0);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.roundRect(-1.0, -1.3, 4.6, 4.0, 0.8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.roundRect(1.0, 1.5, 2.6, 5.8, 0.7);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = INK;
        circ(ctx, 2.3, 6.4, 0.75);
        ctx.restore();
      }
      ctx.restore();
    } // ==========================================================================
    // 2. QUARTERBACK SWEETCORN (`sweetcorn`) — Iowa Golden Sweet Corn
    //    (Football Linebacker — Row 2 of `image_7e465b.jpg`)
    // ==========================================================================
    function drawQuarterbackSweetcorn(ctx, r = 26, state = 'idle', tNow = 0, px = 0, py = 0, drawMound = false) {
      const isIdle = state === 'idle';
      const isNear = state === 'near';
      const isGag = state === 'gag' || state === 'shocked';
      ctx.save(); // Continuous linebacker crouch / tense blitz tremor / explosive popcorn burst
      const squatY = isIdle ? Math.sin(tNow * 4.2) * 0.9 : isNear ? 0.8 + Math.sin(tNow * 24.0) * 0.45 : 0;
      const jitterX = isNear ? Math.sin(tNow * 34.0) * 0.55 : isGag && tNow > 0 ? Math.sin(tNow * 28.0) * 0.65 : 0;
      const gagJumpY = isGag && tNow > 0 ? -Math.abs(Math.sin(tNow * 11.0)) * 1.3 : 0;
      ctx.translate(jitterX, squatY + gagJumpY);
      if (drawMound) {
        drawCowboyDirtMoundBack(ctx, r * 1.02);
      } // ------------------------------------------------------------------------
      // 1. YELLOW CORN LEGS (Planted wide on dirt mound in Idle & Near)
      // ------------------------------------------------------------------------
      if (!isGag) {
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round'; // Left leg stepping onto left dirt mound
        ctx.beginPath();
        ctx.moveTo(-r * 0.34, -r * 0.22);
        ctx.lineTo(-r * 0.54, -r * 0.14);
        ctx.lineTo(-r * 0.62, r * 0.04);
        ctx.stroke(); // Right leg stepping onto right dirt mound
        ctx.beginPath();
        ctx.moveTo(r * 0.34, -r * 0.22);
        ctx.lineTo(r * 0.48, -r * 0.14);
        ctx.lineTo(r * 0.52, r * 0.04);
        ctx.stroke();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(-r * 0.34, -r * 0.22);
        ctx.lineTo(-r * 0.54, -r * 0.14);
        ctx.lineTo(-r * 0.62, r * 0.04);
        ctx.moveTo(r * 0.34, -r * 0.22);
        ctx.lineTo(r * 0.48, -r * 0.14);
        ctx.lineTo(r * 0.52, r * 0.04);
        ctx.stroke();
        ctx.restore();
      } // ------------------------------------------------------------------------
      // 2. PEELED-BACK GREEN CORN HUSK SHOULDER PADS (Back Layer)
      // ------------------------------------------------------------------------
      const huskFlap = tNow > 0 ? Math.sin(tNow * (isGag ? 20.0 : 4.2)) * (isGag ? 0.08 : 0.03) : 0;
      ctx.save(); // Left peeled-back green husk wing
      ctx.save();
      ctx.rotate(-huskFlap);
      const lHuskGrad = ctx.createLinearGradient(-r * 1.15, -r * 0.85, -r * 0.1, r * 0.1);
      lHuskGrad.addColorStop(0, '#65c438');
      lHuskGrad.addColorStop(0.6, '#3ea322');
      lHuskGrad.addColorStop(1, '#1e6b12');
      ctx.fillStyle = lHuskGrad;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.35;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (!isGag) {
        ctx.moveTo(-r * 0.06, r * 0.12);
        ctx.bezierCurveTo(-r * 0.44, -r * 0.04, -r * 0.66, -r * 0.58, -r * 0.72, -r * 0.88);
        ctx.bezierCurveTo(-r * 0.94, -r * 0.86, -r * 1.12, -r * 0.72, -r * 1.16, -r * 0.48);
        ctx.bezierCurveTo(-r * 0.94, -r * 0.62, -r * 0.74, -r * 0.56, -r * 0.52, -r * 0.32);
        ctx.bezierCurveTo(-r * 0.38, -r * 0.16, -r * 0.24, r * 0.04, -r * 0.06, r * 0.12);
      } else {
        // Flared wider out to the left in Pose 3
        ctx.moveTo(-r * 0.06, r * 0.12);
        ctx.bezierCurveTo(-r * 0.44, -r * 0.06, -r * 0.7, -r * 0.56, -r * 0.98, -r * 0.6);
        ctx.bezierCurveTo(-r * 1.16, -r * 0.62, -r * 1.16, -r * 0.44, -r * 0.82, -r * 0.36);
        ctx.bezierCurveTo(-r * 0.56, -r * 0.3, -r * 0.34, -r * 0.04, -r * 0.06, r * 0.12);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // Husk leaf vein crease
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      if (!isGag) {
        ctx.moveTo(-r * 0.18, -r * 0.04);
        ctx.quadraticCurveTo(-r * 0.58, -r * 0.52, -r * 0.92, -r * 0.68);
      } else {
        ctx.moveTo(-r * 0.18, -r * 0.04);
        ctx.quadraticCurveTo(-r * 0.56, -r * 0.38, -r * 0.92, -r * 0.48);
      }
      ctx.stroke();
      ctx.restore(); // Right peeled-back green husk wing
      ctx.save();
      ctx.rotate(huskFlap);
      const rHuskGrad = ctx.createLinearGradient(r * 0.1, r * 0.1, r * 1.0, -r * 0.95);
      rHuskGrad.addColorStop(0, '#1e6b12');
      rHuskGrad.addColorStop(0.5, '#3ea322');
      rHuskGrad.addColorStop(1, '#65c438');
      ctx.fillStyle = rHuskGrad;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.35;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (!isGag) {
        ctx.moveTo(r * 0.02, r * 0.12);
        ctx.bezierCurveTo(r * 0.46, -r * 0.04, r * 0.72, -r * 0.48, r * 0.86, -r * 0.76);
        ctx.bezierCurveTo(r * 0.98, -r * 0.62, r * 0.96, -r * 0.4, r * 0.84, -r * 0.28);
        ctx.bezierCurveTo(r * 0.58, -r * 0.08, r * 0.3, r * 0.08, r * 0.02, r * 0.12);
      } else {
        // Tall pointed husk tip curling up on right in Pose 3
        ctx.moveTo(r * 0.02, r * 0.12);
        ctx.bezierCurveTo(r * 0.42, -r * 0.04, r * 0.66, -r * 0.58, r * 0.74, -r * 1.04);
        ctx.bezierCurveTo(r * 0.6, -r * 0.88, r * 0.48, -r * 0.54, r * 0.44, -r * 0.28);
        ctx.bezierCurveTo(r * 0.32, -r * 0.06, r * 0.18, r * 0.08, r * 0.02, r * 0.12);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.restore(); // ------------------------------------------------------------------------
      // 3. GOLDEN SWEETCORN COB BODY (With Sculpted Grid of Plump Corn Kernels!)
      // ------------------------------------------------------------------------
      ctx.save();
      function traceCobBody(g) {
        g.beginPath();
        g.moveTo(0, -r * 1.48);
        g.bezierCurveTo(r * 0.44, -r * 1.48, r * 0.52, -r * 1.05, r * 0.46, -r * 0.45);
        g.bezierCurveTo(r * 0.4, -r * 0.1, r * 0.22, r * 0.08, 0, r * 0.1);
        g.bezierCurveTo(-r * 0.22, r * 0.08, -r * 0.4, -r * 0.1, -r * 0.46, -r * 0.45);
        g.bezierCurveTo(-r * 0.52, -r * 1.05, -r * 0.44, -r * 1.48, 0, -r * 1.48);
        g.closePath();
      }
      traceCobBody(ctx);
      const cobGrad = ctx.createLinearGradient(-r * 0.45, -r * 1.4, r * 0.45, r * 0.05);
      cobGrad.addColorStop(0.0, '#fef08a');
      cobGrad.addColorStop(0.5, '#facc15');
      cobGrad.addColorStop(1.0, '#ca8a04');
      ctx.fillStyle = cobGrad;
      ctx.fill(); // Clip inside the cob to draw the authentic grid of golden corn kernels!
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = '#9a5b06';
      ctx.lineWidth = 0.85; // Vertical kernel column lines
      for (const kx of [-r * 0.3, -r * 0.15, 0, r * 0.15, r * 0.3]) {
        ctx.beginPath();
        ctx.moveTo(kx * 0.85, -r * 1.45);
        ctx.quadraticCurveTo(kx * 1.08, -r * 0.65, kx * 0.78, r * 0.1);
        ctx.stroke();
      } // Horizontal kernel row arcs across the lower cob belly
      for (let ky = -r * 0.72; ky <= r * 0.04; ky += r * 0.125) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, ky);
        ctx.quadraticCurveTo(0, ky + 1.8, r * 0.5, ky);
        ctx.stroke();
      } // Individual glossy kernel highlights on the belly
      ctx.fillStyle = 'rgba(255, 253, 220, 0.55)';
      for (let ky = -r * 0.64; ky <= -r * 0.12; ky += r * 0.125) {
        for (const kx of [-r * 0.22, -r * 0.07, r * 0.08, r * 0.22]) {
          ell(ctx, kx, ky - 1.2, 1.4, 0.85);
        }
      }
      ctx.restore();
      traceCobBody(ctx);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.35;
      ctx.stroke();
      ctx.restore(); // ------------------------------------------------------------------------
      // 4. FRONT V-OVERLAP OF GREEN CORN HUSKS AT BASE OF COB
      // ------------------------------------------------------------------------
      ctx.save();
      ctx.fillStyle = '#3ea322';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.3;
      ctx.lineJoin = 'round'; // Left front husk lapel wrapping down to center base
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, -r * 0.56);
      ctx.quadraticCurveTo(-r * 0.22, -r * 0.26, 0, r * 0.12);
      ctx.quadraticCurveTo(-r * 0.28, r * 0.06, -r * 0.46, -r * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // Right front husk lapel wrapping over center base
      ctx.fillStyle = '#4cb528';
      ctx.beginPath();
      ctx.moveTo(r * 0.45, -r * 0.56);
      ctx.quadraticCurveTo(r * 0.22, -r * 0.24, -r * 0.06, r * 0.12);
      ctx.quadraticCurveTo(r * 0.26, r * 0.08, r * 0.46, -r * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore(); // ------------------------------------------------------------------------
      // 5. GOLDEN-YELLOW FOOTBALL HELMET WITH RED-WHITE-RED CENTER STRIPE
      // ------------------------------------------------------------------------
      ctx.save();
      const helmShake = isGag && tNow > 0 ? Math.sin(tNow * 26.0) * 0.03 : 0;
      ctx.rotate(helmShake);
      function traceHelmetDome(g) {
        g.beginPath();
        g.moveTo(-r * 0.56, -r * 0.8);
        g.bezierCurveTo(-r * 0.66, -r * 1.34, -r * 0.42, -r * 1.72, 0, -r * 1.72);
        g.bezierCurveTo(r * 0.44, -r * 1.72, r * 0.66, -r * 1.34, r * 0.56, -r * 0.8); // Ear guard cutouts & front brow opening
        g.lineTo(r * 0.46, -r * 0.74);
        g.lineTo(r * 0.42, -r * 1.12);
        g.quadraticCurveTo(0, -r * 1.18, -r * 0.4, -r * 1.12);
        g.lineTo(-r * 0.44, -r * 0.74);
        g.closePath();
      }
      ctx.save();
      traceHelmetDome(ctx);
      const hGrad = ctx.createRadialGradient(-r * 0.18, -r * 1.42, 2, 0, -r * 1.25, r * 0.75);
      hGrad.addColorStop(0.0, '#fde047');
      hGrad.addColorStop(0.6, '#eab308');
      hGrad.addColorStop(1.0, '#b45309');
      ctx.fillStyle = hGrad;
      ctx.fill();
      ctx.clip(); // Center Red-White-Red Racing Stripe over the top of the helmet
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 5.4;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.75);
      ctx.quadraticCurveTo(r * 0.03, -r * 1.45, r * 0.02, -r * 1.12);
      ctx.stroke();
      ctx.strokeStyle = '#fffbeb';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.75);
      ctx.quadraticCurveTo(r * 0.03, -r * 1.45, r * 0.02, -r * 1.12);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.moveTo(-2.7, -r * 1.75);
      ctx.quadraticCurveTo(r * 0.03 - 2.7, -r * 1.45, r * 0.02 - 2.7, -r * 1.12);
      ctx.moveTo(2.7, -r * 1.75);
      ctx.quadraticCurveTo(r * 0.03 + 2.7, -r * 1.45, r * 0.02 + 2.7, -r * 1.12);
      ctx.stroke(); // Glossy white oval shine on left temple of helmet
      ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
      ell(ctx, -r * 0.3, -r * 1.42, 3.8, 1.8, -0.5);
      ctx.restore();
      traceHelmetDome(ctx);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.35;
      ctx.lineJoin = 'round';
      ctx.stroke(); // Earhole circle on left side of helmet
      ctx.fillStyle = '#451a03';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.0;
      circ(ctx, -r * 0.48, -r * 0.9, 2.0);
      ctx.stroke(); // White Nose-Bumper Plate on front brow of helmet (`-r * 1.15`)
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.05;
      ctx.beginPath();
      ctx.roundRect(-r * 0.14, -r * 1.19, r * 0.3, 3.0, 1.0);
      ctx.fill();
      ctx.stroke(); // ------------------------------------------------------------------------
      // 6. FACIAL EXPRESSION & BLACK EYE-BLACK STRIPES (Framed cleanly inside cage!)
      // ------------------------------------------------------------------------
      const eyeY = -r * 1.0;
      const eyeSep = r * 0.18;
      if (isIdle) {
        // Confident grinning quarterback eyes + bold eyebrows
        for (const [side, ex] of [
          [-1, -eyeSep + 0.3],
          [1, eyeSep + 1.1],
        ]) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.05;
          ell(ctx, ex, eyeY, 2.8, 2.1);
          ctx.stroke();
          ctx.fillStyle = INK;
          circ(ctx, ex + 0.5 + px * 0.25, eyeY + py * 0.2, 1.2);
          ctx.fillStyle = '#ffffff';
          circ(ctx, ex + 0.1, eyeY - 0.5, 0.42); // Black football eye-black grease paint stripe under each eye!
          ctx.fillStyle = '#18181b';
          ell(ctx, ex, eyeY + 2.8, 2.5, 0.8, side * -0.08);
        } // Confident angled eyebrows
        ctx.fillStyle = '#18181b';
        ctx.beginPath();
        ctx.moveTo(-eyeSep - 2.6, eyeY - 3.2);
        ctx.lineTo(-eyeSep + 2.6, eyeY - 2.0);
        ctx.lineTo(-eyeSep + 2.3, eyeY - 0.9);
        ctx.lineTo(-eyeSep - 2.8, eyeY - 2.0);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(eyeSep + 3.6, eyeY - 3.2);
        ctx.lineTo(eyeSep - 1.4, eyeY - 2.0);
        ctx.lineTo(eyeSep - 1.1, eyeY - 0.9);
        ctx.lineTo(eyeSep + 3.8, eyeY - 2.0);
        ctx.fill(); // Big confident white-toothed quarterback smile!
        const my = -r * 0.77;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(-r * 0.22, my - 1.6);
        ctx.quadraticCurveTo(r * 0.02, my - 0.9, r * 0.24, my - 1.8);
        ctx.bezierCurveTo(r * 0.22, my + 4.2, -r * 0.2, my + 4.2, -r * 0.22, my - 1.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (isNear) {
        // Furious blitzing linebacker glare + wide clenched teeth!
        for (const [side, ex] of [
          [-1, -eyeSep + 0.3],
          [1, eyeSep + 1.1],
        ]) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.1;
          ell(ctx, ex, eyeY, 2.9, 2.2);
          ctx.stroke();
          ctx.fillStyle = INK;
          circ(ctx, ex + 0.5 + px * 0.3, eyeY + 0.2 + py * 0.2, 1.25);
          ctx.fillStyle = '#ffffff';
          circ(ctx, ex + 0.1, eyeY - 0.4, 0.45); // Black football eye-black stripe
          ctx.fillStyle = '#18181b';
          ell(ctx, ex, eyeY + 2.9, 2.6, 0.85, side * -0.08);
        } // Steep angry V-scowl eyebrows
        ctx.fillStyle = '#18181b';
        ctx.beginPath();
        ctx.moveTo(-eyeSep - 2.8, eyeY - 3.5);
        ctx.lineTo(-eyeSep + 3.0, eyeY - 0.9);
        ctx.lineTo(-eyeSep + 2.4, eyeY + 0.2);
        ctx.lineTo(-eyeSep - 3.2, eyeY - 2.2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(eyeSep + 3.8, eyeY - 3.5);
        ctx.lineTo(eyeSep - 1.6, eyeY - 0.9);
        ctx.lineTo(eyeSep - 1.0, eyeY + 0.2);
        ctx.lineTo(eyeSep + 4.2, eyeY - 2.2);
        ctx.fill(); // Wide clenched gritted-teeth mouth with vertical tooth lines
        const my = -r * 0.76;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.roundRect(-r * 0.24, my - 2.4, r * 0.5, 5.2, 1.8);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-r * 0.23, my + 0.2);
        ctx.lineTo(r * 0.25, my + 0.2);
        for (const tx of [-r * 0.12, 0, r * 0.12]) {
          ctx.moveTo(tx, my - 2.3);
          ctx.lineTo(tx, my + 2.7);
        }
        ctx.stroke(); // Blue sweat drop on left of helmet + Red Anger Cross at top-right!
        drawSweatDrop(ctx, -r * 0.46, -r * 1.22, 0.82, 0.05, tNow);
        drawAngerCross(ctx, r * 0.78, -r * 1.54, 0.88, tNow);
      } else {
        // POSE 3 (ON-HIT GAG): Tight `> <` wince eyes + eye-black + downturned grimace!
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round'; // Left `>` and Right `<`
        ctx.beginPath();
        ctx.moveTo(-eyeSep - 2.2, eyeY - 1.5);
        ctx.lineTo(-eyeSep + 1.8, eyeY + 0.2);
        ctx.lineTo(-eyeSep - 2.2, eyeY + 1.9);
        ctx.moveTo(eyeSep + 3.0, eyeY - 1.5);
        ctx.lineTo(eyeSep - 1.0, eyeY + 0.2);
        ctx.lineTo(eyeSep + 3.0, eyeY + 1.9);
        ctx.stroke(); // Black eye-black stripes under `> <` eyes
        ctx.fillStyle = '#18181b';
        ell(ctx, -eyeSep + 0.1, eyeY + 2.9, 2.4, 0.8, -0.08);
        ell(ctx, eyeSep + 1.1, eyeY + 2.9, 2.4, 0.8, 0.08); // Bracing grimace mouth
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.35;
        ctx.beginPath();
        ctx.moveTo(-r * 0.16, -r * 0.74);
        ctx.quadraticCurveTo(r * 0.02, -r * 0.82, r * 0.2, -r * 0.74);
        ctx.stroke();
      } // ------------------------------------------------------------------------
      // 7. SLEEK METALLIC SILVER FOOTBALL FACEMASK CAGE BARS (Frames eyes & mouth!)
      // ------------------------------------------------------------------------
      function strokeCageBar(fn) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.05;
        ctx.beginPath();
        fn();
        ctx.stroke();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 0.95;
        ctx.beginPath();
        fn();
        ctx.stroke();
        ctx.restore();
      } // Outer U-frame of the facemask + horizontal bars + center vertical bar
      strokeCageBar(() => {
        // Top brow bar across forehead
        ctx.moveTo(-r * 0.44, -r * 1.11);
        ctx.quadraticCurveTo(0, -r * 1.16, r * 0.46, -r * 1.11); // Left & right side vertical cheek posts + bottom chin bar
        ctx.moveTo(-r * 0.42, -r * 1.11);
        ctx.lineTo(-r * 0.36, -r * 0.7);
        ctx.quadraticCurveTo(0, -r * 0.6, r * 0.38, -r * 0.7);
        ctx.lineTo(r * 0.44, -r * 1.11);
      });
      strokeCageBar(() => {
        // Middle horizontal bar right between the eye-black and top of mouth
        ctx.moveTo(-r * 0.4, -r * 0.86);
        ctx.quadraticCurveTo(0, -r * 0.82, r * 0.42, -r * 0.86); // Lower horizontal bar framing the chin
        ctx.moveTo(-r * 0.38, -r * 0.75);
        ctx.quadraticCurveTo(0, -r * 0.7, r * 0.4, -r * 0.75); // Center vertical guard post from middle bar down to bottom chin bar
        ctx.moveTo(r * 0.02, -r * 0.85);
        ctx.lineTo(r * 0.02, -r * 0.65);
      });
      ctx.restore(); // End helmet & facemask
      // ------------------------------------------------------------------------
      // 8. ARMS, LEATHER PIGSKIN FOOTBALL (Idle & Near) OR POPCORN EXPLOSION (Pose 3)
      // ------------------------------------------------------------------------
      if (!isGag) {
        const armPump = tNow > 0 ? Math.sin(tNow * (isNear ? 16.0 : 4.2)) * 1.2 : 0; // Viewer's Left Arm (Yellow corn arm bent akimbo on left hip)
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.48, -r * 0.56);
        ctx.lineTo(-r * 0.76, -r * 0.44 + armPump * 0.4);
        ctx.lineTo(-r * 0.54, -r * 0.24);
        ctx.stroke();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.1;
        ctx.stroke();
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.15;
        circ(ctx, -r * 0.54, -r * 0.24, 2.4);
        ctx.stroke();
        ctx.restore(); // Leather Pigskin Football tucked under Viewer's Right Arm!
        ctx.save();
        ctx.translate(r * 0.54, -r * 0.46 + armPump * 0.5);
        ctx.rotate(-0.42);
        const fbGrad = ctx.createRadialGradient(-2, -2, 1, 0, 0, r * 0.32);
        fbGrad.addColorStop(0, '#b45309');
        fbGrad.addColorStop(0.6, '#78350f');
        fbGrad.addColorStop(1, '#451a03');
        ctx.fillStyle = fbGrad;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.25;
        ell(ctx, 0, 0, r * 0.28, r * 0.18);
        ctx.stroke(); // White football end stripes & white stitching laces
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(-r * 0.16, 0, r * 0.11, -0.8, 0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(r * 0.16, 0, r * 0.11, Math.PI - 0.8, Math.PI + 0.8);
        ctx.stroke(); // White laces across top of football
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(-3.2, -1.2);
        ctx.lineTo(3.2, -1.2);
        for (const lx of [-2.0, -0.7, 0.7, 2.0]) {
          ctx.moveTo(lx, -2.4);
          ctx.lineTo(lx, 0.0);
        }
        ctx.stroke();
        ctx.restore(); // Viewer's Right Arm wrapping around the tucked football
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.46, -r * 0.62);
        ctx.lineTo(r * 0.74, -r * 0.52 + armPump * 0.5);
        ctx.lineTo(r * 0.58, -r * 0.36 + armPump * 0.5);
        ctx.stroke();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.0;
        ctx.stroke();
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.15;
        circ(ctx, r * 0.56, -r * 0.36 + armPump * 0.5, 2.3);
        ctx.stroke();
        ctx.restore();
      } else {
        // ======================================================================
        // POSE 3 (ON-HIT GAG): EXPLODING WHITE POPCORN PUFFS + FLYING GOLDEN
        // KERNELS + "HUT! HUT!" SPIKY SPEECH BURST!
        // ======================================================================
        const popPulse = tNow > 0 ? (tNow * 2.4) % 1.0 : 0;
        const radialPush = 1.0 + Math.sin(popPulse * Math.PI) * 0.16; // Helper to draw a fluffy 3-lobed white-and-butter popped popcorn puff
        const drawPopcornPuff = (px0, py0, sc = 1.0, rot = 0) => {
          ctx.save();
          ctx.translate(px0 * radialPush, py0);
          ctx.rotate(rot + (tNow > 0 ? Math.sin(tNow * 10 + px0) * 0.15 : 0));
          ctx.scale(sc, sc);
          ctx.fillStyle = '#fffbeb';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.15;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.arc(-2.2, -1.2, 3.2, Math.PI * 0.55, Math.PI * 1.85);
          ctx.arc(2.0, -1.8, 3.0, Math.PI * 1.15, Math.PI * 0.25);
          ctx.arc(1.2, 2.0, 2.8, -Math.PI * 0.15, Math.PI * 0.85);
          ctx.closePath();
          ctx.fill();
          ctx.stroke(); // Warm golden-butter center kernel core
          ctx.fillStyle = '#fde047';
          circ(ctx, -0.2, 0.2, 1.5);
          ctx.restore();
        }; // 5 Fluffy Popped Popcorn Puffs around left & right of Quarterback Sweetcorn
        drawPopcornPuff(-r * 1.04, -r * 1.22, 1.12, -0.2);
        drawPopcornPuff(-r * 1.08, -r * 0.42, 1.05, 0.3);
        drawPopcornPuff(r * 0.88, -r * 1.38, 1.08, 0.2);
        drawPopcornPuff(r * 0.9, -r * 0.88, 0.82, -0.3);
        drawPopcornPuff(r * 1.16, -r * 0.4, 0.96, 0.15); // Flying Golden Unpopped Corn Kernels & Action Dash Lines
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.05;
        for (const [kx, ky, rot] of [
          [-r * 0.82, -r * 1.46, -0.4],
          [-r * 1.16, -r * 0.84, 0.3],
          [-r * 0.78, -r * 0.92, -0.2],
          [-r * 0.76, -r * 0.62, 0.5],
          [-r * 0.74, -r * 0.22, -0.3],
          [r * 0.86, -r * 0.66, 0.4],
          [r * 1.2, -r * 0.78, -0.25],
        ]) {
          ell(ctx, kx * radialPush, ky, 2.2, 1.6, rot);
          ctx.stroke();
        } // Spiky Comic "HUT! HUT!" Speech Burst at upper right
        drawSpikyComicBurst(
          ctx,
          r * 1.64,
          -r * 1.34,
          r * 0.74,
          r * 0.52,
          r * 0.82,
          -r * 0.98,
          ['HUT!', 'HUT!'],
          6.8,
          tNow,
        );
      }
      if (drawMound) {
        drawCowboyDirtMoundFront(ctx, r * 1.02);
      }
      ctx.restore();
    } // ==========================================================================
    // 3. SMOKEY BRISKET-ONION (`brisket_onion`) — Vidalia Sweet Onion
    //    (BBQ Pitmaster — Row 3 of `image_7e465b.jpg`)
    // ==========================================================================
    function drawSmokeyBrisketOnion(ctx, r = 25, state = 'idle', tNow = 0, px = 0, py = 0, drawMound = false) {
      const isIdle = state === 'idle';
      const isNear = state === 'near';
      const isGag = state === 'gag' || state === 'shocked';
      ctx.save(); // Continuous pitmaster chuckle / nervous sniffle / bawling hot-sauce recoil
      const breatheY = isIdle ? Math.sin(tNow * 3.5) * 0.8 : isNear ? Math.sin(tNow * 10.0) * 0.5 : 0;
      const jitterX = isGag && tNow > 0 ? Math.sin(tNow * 28.0) * 0.7 : isNear ? Math.sin(tNow * 22.0) * 0.35 : 0;
      ctx.translate(jitterX, breatheY);
      if (drawMound) {
        drawCowboyDirtMoundBack(ctx, r * 1.02);
      } // ------------------------------------------------------------------------
      // 1. TOP CROWN: White Pitmaster Chef Hat (Idle & Near) OR Green Onion Shoots (Gag)
      // ------------------------------------------------------------------------
      if (!isGag) {
        const hatBob = tNow > 0 ? Math.sin(tNow * 3.8) * 0.03 : 0;
        ctx.save();
        ctx.translate(-r * 0.04, -r * 1.34);
        ctx.rotate(-0.08 + hatBob); // Puffy 3-lobed white toque chef hat crown
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.34, 0);
        ctx.bezierCurveTo(-r * 0.56, -r * 0.1, -r * 0.62, -r * 0.52, -r * 0.28, -r * 0.54);
        ctx.bezierCurveTo(-r * 0.2, -r * 0.74, r * 0.24, -r * 0.74, r * 0.3, -r * 0.52);
        ctx.bezierCurveTo(r * 0.62, -r * 0.48, r * 0.54, -r * 0.08, r * 0.34, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Soft grey toque fold shadows
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 0.95;
        ctx.beginPath();
        ctx.moveTo(-r * 0.16, -r * 0.46);
        ctx.quadraticCurveTo(-r * 0.12, -r * 0.26, -r * 0.14, -r * 0.12);
        ctx.moveTo(r * 0.16, -r * 0.46);
        ctx.quadraticCurveTo(r * 0.12, -r * 0.26, r * 0.14, -r * 0.12);
        ctx.stroke(); // Fitted white chef hat headband at base
        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(-r * 0.34, -r * 0.14);
        ctx.quadraticCurveTo(0, -r * 0.2, r * 0.34, -r * 0.14);
        ctx.lineTo(r * 0.36, 0.06 * r);
        ctx.quadraticCurveTo(0, 0.0, -r * 0.36, 0.06 * r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else {
        // Pose 3: Tall Green Vidalia Onion Sprout Shoots at Top Crown!
        const shootSway = tNow > 0 ? Math.sin(tNow * 22.0) * 0.08 : 0;
        ctx.save();
        ctx.translate(0, -r * 1.44);
        ctx.rotate(shootSway);
        ctx.fillStyle = '#3ea322';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        ctx.lineJoin = 'round'; // Left shoot blade
        ctx.beginPath();
        ctx.moveTo(-r * 0.08, 2);
        ctx.bezierCurveTo(-r * 0.22, -r * 0.26, -r * 0.28, -r * 0.56, -r * 0.22, -r * 0.78);
        ctx.bezierCurveTo(-r * 0.1, -r * 0.58, -r * 0.04, -r * 0.3, 0, 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Right shoot blade
        ctx.fillStyle = '#2e8518';
        ctx.beginPath();
        ctx.moveTo(0, 2);
        ctx.bezierCurveTo(r * 0.06, -r * 0.28, r * 0.14, -r * 0.54, r * 0.12, -r * 0.72);
        ctx.bezierCurveTo(r * 0.22, -r * 0.48, r * 0.18, -r * 0.22, r * 0.08, 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Center tall shoot blade
        ctx.fillStyle = '#52c430';
        ctx.beginPath();
        ctx.moveTo(-r * 0.05, 2);
        ctx.bezierCurveTo(-r * 0.12, -r * 0.34, -r * 0.08, -r * 0.68, -r * 0.04, -r * 0.9);
        ctx.bezierCurveTo(r * 0.06, -r * 0.66, r * 0.08, -r * 0.32, r * 0.05, 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } // ------------------------------------------------------------------------
      // 2. PLUMP GOLDEN VIDALIA SWEET ONION BULB BODY (With Onion Skin Ribs!)
      // ------------------------------------------------------------------------
      ctx.save();
      function traceOnionBulb(g) {
        g.beginPath();
        if (!isGag) {
          g.moveTo(-r * 0.32, -r * 1.28);
          g.quadraticCurveTo(0, -r * 1.36, r * 0.32, -r * 1.28);
        } else {
          // Pointed onion neck tapering up to the green shoots in Pose 3
          g.moveTo(-r * 0.12, -r * 1.46);
          g.quadraticCurveTo(0, -r * 1.5, r * 0.12, -r * 1.46);
          g.bezierCurveTo(r * 0.18, -r * 1.28, r * 0.42, -r * 1.18, r * 0.58, -r * 1.04);
        }
        g.bezierCurveTo(r * 0.84, -r * 0.94, r * 0.92, -r * 0.42, r * 0.62, -r * 0.06);
        g.quadraticCurveTo(0, r * 0.16, -r * 0.62, -r * 0.06);
        if (!isGag) {
          g.bezierCurveTo(-r * 0.92, -r * 0.42, -r * 0.84, -r * 0.94, -r * 0.32, -r * 1.28);
        } else {
          g.bezierCurveTo(-r * 0.92, -r * 0.42, -r * 0.84, -r * 0.94, -r * 0.58, -r * 1.04);
          g.bezierCurveTo(-r * 0.42, -r * 1.18, -r * 0.18, -r * 1.28, -r * 0.12, -r * 1.46);
        }
        g.closePath();
      }
      traceOnionBulb(ctx);
      const onGrad = ctx.createRadialGradient(-r * 0.18, -r * 0.82, 2, 0, -r * 0.64, r * 0.96);
      if (!isGag) {
        onGrad.addColorStop(0.0, '#fcd34d');
        onGrad.addColorStop(0.55, '#ea8a2a');
        onGrad.addColorStop(1.0, '#b45309');
      } else {
        // Flushed red-orange crying face in Pose 3!
        onGrad.addColorStop(0.0, '#fb7185');
        onGrad.addColorStop(0.48, '#ef4444');
        onGrad.addColorStop(0.82, '#d97706');
        onGrad.addColorStop(1.0, '#9a3412');
      }
      ctx.fillStyle = onGrad;
      ctx.fill(); // Natural curved vertical Vidalia onion skin striations clipped inside bulb
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = isGag ? 'rgba(136, 19, 55, 0.28)' : 'rgba(146, 64, 14, 0.34)';
      ctx.lineWidth = 0.95;
      for (const rxFactor of [-0.62, -0.34, 0.34, 0.62]) {
        ctx.beginPath();
        ctx.moveTo(rxFactor * r * 0.32, -r * 1.38);
        ctx.bezierCurveTo(rxFactor * r * 1.05, -r * 0.9, rxFactor * r * 1.05, -r * 0.35, rxFactor * r * 0.45, r * 0.12);
        ctx.stroke();
      }
      ctx.restore();
      traceOnionBulb(ctx);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.35;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore(); // ------------------------------------------------------------------------
      // 3. RED-AND-WHITE GINGHAM CHECKERED "KISS THE COOK" PITMASTER APRON
      // ------------------------------------------------------------------------
      ctx.save(); // Apron neck strap & waist tie strings wrapping around the onion sides
      ctx.fillStyle = '#fca5a5';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.1; // Left & right upper apron straps
      ctx.beginPath();
      ctx.moveTo(-r * 0.76, -r * 0.66);
      ctx.quadraticCurveTo(-r * 0.5, -r * 0.64, -r * 0.34, -r * 0.56);
      ctx.lineTo(-r * 0.34, -r * 0.48);
      ctx.quadraticCurveTo(-r * 0.52, -r * 0.56, -r * 0.78, -r * 0.58);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.76, -r * 0.66);
      ctx.quadraticCurveTo(r * 0.5, -r * 0.64, r * 0.34, -r * 0.56);
      ctx.lineTo(r * 0.34, -r * 0.48);
      ctx.quadraticCurveTo(r * 0.52, -r * 0.56, r * 0.78, -r * 0.58);
      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // Lower waist tie strings + left side bow loop
      ctx.beginPath();
      ctx.moveTo(-r * 0.74, -r * 0.28);
      ctx.quadraticCurveTo(-r * 0.52, -r * 0.22, -r * 0.36, -r * 0.22);
      ctx.lineTo(-r * 0.36, -r * 0.15);
      ctx.quadraticCurveTo(-r * 0.54, -r * 0.15, -r * 0.74, -r * 0.21);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.72, -r * 0.28);
      ctx.quadraticCurveTo(r * 0.52, -r * 0.22, r * 0.36, -r * 0.22);
      ctx.lineTo(r * 0.36, -r * 0.15);
      ctx.quadraticCurveTo(r * 0.54, -r * 0.15, r * 0.72, -r * 0.21);
      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // Main front apron bib with red-and-white gingham borders & white text center
      function traceApronBib(g) {
        g.beginPath();
        g.moveTo(-r * 0.35, -r * 0.56);
        g.quadraticCurveTo(0, -r * 0.53, r * 0.37, -r * 0.56);
        g.lineTo(r * 0.42, r * 0.06);
        g.quadraticCurveTo(0, r * 0.14, -r * 0.4, r * 0.06);
        g.closePath();
      }
      ctx.save();
      traceApronBib(ctx);
      ctx.fillStyle = '#fffbeb';
      ctx.fill();
      ctx.clip(); // Red-and-white gingham checkered pattern along top, bottom, and side edges
      ctx.fillStyle = 'rgba(220, 38, 38, 0.45)';
      for (let gx = -r * 0.44; gx <= r * 0.44; gx += 4.4) {
        ctx.fillRect(gx, -r * 0.6, 2.2, r * 0.75);
      }
      for (let gy = -r * 0.58; gy <= r * 0.12; gy += 4.4) {
        ctx.fillRect(-r * 0.45, gy, r * 0.9, 2.2);
      } // Clean cream-white center patch for "KISS THE COOK" typography
      ctx.fillStyle = 'rgba(255, 251, 235, 0.92)';
      ctx.beginPath();
      ctx.roundRect(-r * 0.31, -r * 0.44, r * 0.64, r * 0.36, 2.0);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.font = '900 4.3px "Arial Narrow", "Impact", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('KISS THE', r * 0.01, -r * 0.33);
      ctx.fillText('COOK', r * 0.01, -r * 0.18);
      ctx.restore();
      traceApronBib(ctx);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.25;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore(); // ------------------------------------------------------------------------
      // 4. PITMASTER COOL SUNGLASSES, FACIAL EXPRESSION & BBQ PROPS PER POSE
      // ------------------------------------------------------------------------
      function drawPitmasterShades(gx, gy, grot = 0) {
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(grot); // Left temple arm extending back to left side of onion
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.46, -1.2);
        ctx.quadraticCurveTo(-r * 0.64, -0.5, -r * 0.74, 2.0);
        ctx.stroke(); // Bridge bar
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(-3.0, -1.4);
        ctx.lineTo(3.0, -1.4);
        ctx.stroke(); // Left & right dark wayfarer lenses with diagonal white reflection slash
        for (const [side, lx] of [
          [-1, -r * 0.22],
          [1, r * 0.24],
        ]) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(lx - 5.2, -3.4, 10.4, 6.8, [1.5, 1.5, 3.2, 3.2]);
          ctx.fillStyle = '#1e293b';
          ctx.fill();
          ctx.clip();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.58)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(lx - 1.5, -4.0);
          ctx.lineTo(lx - 4.2, 4.0);
          ctx.stroke();
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(lx + 1.0, -4.0);
          ctx.lineTo(lx - 1.8, 4.0);
          ctx.stroke();
          ctx.restore();
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.35;
          ctx.beginPath();
          ctx.roundRect(lx - 5.2, -3.4, 10.4, 6.8, [1.5, 1.5, 3.2, 3.2]);
          ctx.stroke();
        }
        ctx.restore();
      }
      if (isIdle) {
        // POSE 1: IDLE (CHILL BBQ PITMASTER WITH SUNGLASSES, TONGS & SMOKE CURLS)
        // Relaxed eyebrows above sunglasses
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.35;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.34, -r * 1.04);
        ctx.quadraticCurveTo(-r * 0.2, -r * 1.11, -r * 0.08, -r * 1.05);
        ctx.moveTo(r * 0.12, -r * 1.05);
        ctx.quadraticCurveTo(r * 0.24, -r * 1.11, r * 0.38, -r * 1.04);
        ctx.stroke(); // Cool dark Pitmaster Sunglasses
        drawPitmasterShades(r * 0.02 + px * 0.3, -r * 0.88 + py * 0.2, -0.04); // Warm confident pitmaster smile
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.16, -r * 0.67);
        ctx.quadraticCurveTo(r * 0.04, -r * 0.6, r * 0.22, -r * 0.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(r * 0.23, -r * 0.71, 1.4, -0.4, 1.2);
        ctx.stroke(); // Viewer's Left Arm bent on hip
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.68, -r * 0.54);
        ctx.lineTo(-r * 0.88, -r * 0.38);
        ctx.lineTo(-r * 0.56, -r * 0.22);
        ctx.stroke();
        ctx.strokeStyle = '#ea8a2a';
        ctx.lineWidth = 2.0;
        ctx.stroke();
        ctx.fillStyle = '#ea8a2a';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.15;
        circ(ctx, -r * 0.54, -r * 0.22, 2.3);
        ctx.stroke();
        ctx.restore(); // Silver BBQ Tongs held in Viewer's Right Hand (clicking rhythmically in live mode!)
        const tongClick = tNow > 0 ? Math.abs(Math.sin(tNow * 6.5)) * 0.09 : 0;
        ctx.save();
        ctx.translate(r * 0.82, -r * 0.44);
        ctx.rotate(0.18); // Left & right stainless-steel tong blades with scalloped gripper tips
        for (const [dir, ang] of [
          [-1, -0.09 + tongClick],
          [1, 0.09 - tongClick],
        ]) {
          ctx.save();
          ctx.rotate(ang);
          ctx.fillStyle = '#cbd5e1';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.15;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(dir * 0.6, 4.0);
          ctx.lineTo(dir * 2.4, -r * 0.64);
          ctx.quadraticCurveTo(dir * 4.2, -r * 0.72, dir * 2.2, -r * 0.8);
          ctx.quadraticCurveTo(dir * 0.6, -r * 0.72, dir * 0.8, -r * 0.6);
          ctx.lineTo(0, 4.0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        } // Bottom hinge ring of tongs
        ctx.fillStyle = '#94a3b8';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.15;
        circ(ctx, 0, 4.2, 2.0);
        ctx.stroke();
        ctx.restore(); // Viewer's Right Arm holding the BBQ Tongs
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.66, -r * 0.52);
        ctx.lineTo(r * 0.82, -r * 0.44);
        ctx.stroke();
        ctx.strokeStyle = '#ea8a2a';
        ctx.lineWidth = 2.0;
        ctx.stroke();
        ctx.fillStyle = '#ea8a2a';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.15;
        ell(ctx, r * 0.84, -r * 0.44, 2.8, 2.3, 0.2);
        ctx.stroke();
        ctx.restore(); // Two Wispy Savory BBQ Smoke Curls rising above the tongs!
        const smokeShift = tNow > 0 ? ((tNow * 1.4) % 1.0) * 5.0 : 0;
        ctx.save();
        ctx.strokeStyle = 'rgba(120, 102, 85, 0.48)';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.68, -r * 1.02 - smokeShift * 0.3);
        ctx.bezierCurveTo(
          r * 0.54,
          -r * 1.18 - smokeShift * 0.5,
          r * 0.84,
          -r * 1.32 - smokeShift * 0.7,
          r * 0.66,
          -r * 1.48 - smokeShift,
        );
        ctx.moveTo(r * 1.04, -r * 1.14 - smokeShift * 0.3);
        ctx.bezierCurveTo(
          r * 0.88,
          -r * 1.32 - smokeShift * 0.5,
          r * 1.22,
          -r * 1.48 - smokeShift * 0.7,
          r * 1.02,
          -r * 1.66 - smokeShift,
        );
        ctx.stroke();
        ctx.restore();
      } else if (isNear) {
        // POSE 2: CURSOR-NEAR ALERT (WORRIED BROWS, TEARDROPS UNDER SHADES, HAND ADJUSTING FRAMES)
        // Worried upturned eyebrows (`/ \`)
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.32, -r * 1.02);
        ctx.quadraticCurveTo(-r * 0.18, -r * 1.12, -r * 0.06, -r * 1.1);
        ctx.moveTo(r * 0.1, -r * 1.1);
        ctx.quadraticCurveTo(r * 0.22, -r * 1.12, r * 0.36, -r * 1.02);
        ctx.stroke(); // Sunglasses slightly lowered while right hand holds the frame
        drawPitmasterShades(r * 0.02, -r * 0.86, -0.02); // Two blue onion teardrops welling up right under the sunglasses lenses!
        drawSweatDrop(ctx, -r * 0.2, -r * 0.69, 0.58, 0.12, tNow);
        drawSweatDrop(ctx, r * 0.26, -r * 0.69, 0.58, -0.12, tNow); // Quivering downturned worried frown
        const frownQuiver = tNow > 0 ? Math.sin(tNow * 24.0) * 0.6 : 0;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.14, -r * 0.61 + frownQuiver);
        ctx.quadraticCurveTo(r * 0.02, -r * 0.69 - frownQuiver, r * 0.18, -r * 0.61 + frownQuiver);
        ctx.stroke(); // Viewer's Left Arm on hip
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.68, -r * 0.54);
        ctx.lineTo(-r * 0.88, -r * 0.38);
        ctx.lineTo(-r * 0.56, -r * 0.22);
        ctx.stroke();
        ctx.strokeStyle = '#ea8a2a';
        ctx.lineWidth = 2.0;
        ctx.stroke();
        ctx.fillStyle = '#ea8a2a';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.15;
        circ(ctx, -r * 0.54, -r * 0.22, 2.3);
        ctx.stroke();
        ctx.restore(); // Viewer's Right Arm raised up holding the right corner of his sunglasses!
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.66, -r * 0.52);
        ctx.lineTo(r * 0.88, -r * 0.64);
        ctx.lineTo(r * 0.52, -r * 0.88);
        ctx.stroke();
        ctx.strokeStyle = '#ea8a2a';
        ctx.lineWidth = 2.0;
        ctx.stroke();
        ctx.fillStyle = '#ea8a2a';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.15;
        circ(ctx, r * 0.5, -r * 0.89, 2.4);
        ctx.stroke();
        ctx.restore(); // Red Anger Cross + Blue Sweat Drop at upper right
        drawAngerCross(ctx, r * 0.72, -r * 1.24, 0.84, tNow);
        drawSweatDrop(ctx, r * 0.9, -r * 1.02, 0.82, -0.05, tNow);
      } else {
        // ======================================================================
        // POSE 3 (ON-HIT GAG): GUSHING WATERFALL FOUNTAINS OF BLUE ONION TEARS +
        // BAWLING MOUTH + SQUIRTING RED BBQ HOT-SAUCE BOTTLE + "DAGNABBIT!"
        // ======================================================================
        const eyeY = -r * 0.92;
        const eyeSep = r * 0.22; // Furrowed crying eyebrows + Tight `> <` wince eyes
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-eyeSep - 2.8, eyeY - 3.2);
        ctx.lineTo(-eyeSep + 2.4, eyeY - 1.2);
        ctx.moveTo(eyeSep + 3.2, eyeY - 3.2);
        ctx.lineTo(eyeSep - 2.0, eyeY - 1.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-eyeSep - 2.6, eyeY + 0.2);
        ctx.lineTo(-eyeSep + 2.0, eyeY + 2.0);
        ctx.lineTo(-eyeSep - 2.6, eyeY + 3.8);
        ctx.moveTo(eyeSep + 3.0, eyeY + 0.2);
        ctx.lineTo(eyeSep - 1.6, eyeY + 2.0);
        ctx.lineTo(eyeSep + 3.0, eyeY + 3.8);
        ctx.stroke(); // Twin Gushing Cyan-Blue Waterfall Fountains of Onion Tears!
        const tearWave = tNow > 0 ? Math.sin(tNow * 22.0) * 1.4 : 0;
        for (const dir of [-1, 1]) {
          ctx.save();
          ctx.fillStyle = '#bae6fd';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.15;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          const startX = dir * (eyeSep + 1.8);
          const startY = eyeY + 2.2;
          ctx.moveTo(startX, startY);
          ctx.bezierCurveTo(
            dir * r * 0.65,
            startY - 3.5 + tearWave * dir,
            dir * r * 1.05,
            startY + 2.0,
            dir * r * 1.12,
            startY + 9.5 + tearWave,
          );
          ctx.bezierCurveTo(
            dir * r * 1.02,
            startY + 12.2 + tearWave,
            dir * r * 0.82,
            startY + 9.5,
            dir * r * 0.76,
            startY + 5.5,
          );
          ctx.bezierCurveTo(dir * r * 0.6, startY + 3.2, dir * r * 0.42, startY + 3.8, startX, startY + 2.2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke(); // Flying tear droplets at the outer tips of the fountain
          const dropPush = tNow > 0 ? ((tNow * 3.0) % 1.0) * 3.5 : 0;
          ell(ctx, dir * (r * 1.24 + dropPush), startY + 6.5 + dropPush, 2.0, 1.2, dir * 0.4);
          ctx.stroke();
          circ(ctx, dir * (r * 1.18 + dropPush * 0.7), startY + 12.0 + dropPush, 1.3);
          ctx.stroke();
          ctx.restore();
        } // Wide Wailing Bawling Mouth with Upper White Teeth & Pink Tongue!
        const my = -r * 0.68;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(-r * 0.24, my + 3.6);
        ctx.bezierCurveTo(-r * 0.26, my - 5.2, r * 0.28, my - 5.2, r * 0.26, my + 3.6);
        ctx.quadraticCurveTo(0, my + 2.2, -r * 0.24, my + 3.6);
        ctx.closePath();
        ctx.fillStyle = '#450a0a';
        ctx.fill();
        ctx.save();
        ctx.clip(); // White upper teeth bar
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.roundRect(-r * 0.18, my - 4.8, r * 0.38, 3.0, 1.0);
        ctx.fill();
        ctx.stroke(); // Pink wailing tongue
        ctx.fillStyle = '#fb7185';
        ell(ctx, r * 0.04, my + 2.8, r * 0.16, 2.2);
        ctx.restore();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.restore(); // Viewer's Left Arm flung down-left in dramatic despair (resting above dirt mound)
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.68, -r * 0.48);
        ctx.lineTo(-r * 0.98, -r * 0.38);
        ctx.lineTo(-r * 0.96, -r * 0.18);
        ctx.stroke();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.0;
        ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.15;
        circ(ctx, -r * 0.96, -r * 0.18, 2.3);
        ctx.stroke();
        ctx.restore(); // Viewer's Right Arm Squirting a Red BBQ Hot-Sauce Bottle!
        const squeezeShake = tNow > 0 ? Math.sin(tNow * 24.0) * 0.08 : 0;
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.0;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.66, -r * 0.46);
        ctx.lineTo(r * 0.96, -r * 0.42);
        ctx.stroke();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.0;
        ctx.stroke(); // Red BBQ Hot-Sauce Bottle with White Label & Pointed Nozzle
        ctx.translate(r * 1.04, -r * 0.44);
        ctx.rotate(0.32 + squeezeShake);
        ctx.fillStyle = '#b91c1c';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(-3.6, -4.5, 7.2, 11.5, 1.8);
        ctx.fill();
        ctx.stroke(); // White bottle label band
        ctx.fillStyle = '#fef2f2';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.95;
        ctx.fillRect(-3.4, -1.5, 6.8, 4.2);
        ctx.strokeRect(-3.4, -1.5, 6.8, 4.2); // White screw cap & red squirt nozzle cone
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.roundRect(-2.4, -6.5, 4.8, 2.2, 0.6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(-1.5, -6.5);
        ctx.lineTo(0, -10.2);
        ctx.lineTo(1.5, -6.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Squirting Red BBQ / Hot-Sauce Droplets shooting out of the nozzle!
        const squirtPush = tNow > 0 ? ((tNow * 3.4) % 1.0) * 4.0 : 0;
        ctx.fillStyle = '#b91c1c';
        ell(ctx, 2.2 + squirtPush * 0.6, -12.2 - squirtPush * 0.4, 1.8, 1.0, 0.5);
        ctx.stroke();
        ell(ctx, 4.8 + squirtPush * 0.9, -9.8 - squirtPush * 0.2, 1.5, 0.9, 0.8);
        ctx.stroke(); // Right hand gripping the bottle
        ctx.fillStyle = '#ef4444';
        ell(ctx, -2.2, 0.8, 2.5, 2.0, -0.2);
        ctx.stroke();
        ctx.restore(); // Spiky Comic "DAGNABBIT!" Speech Burst at upper right
        drawSpikyComicBurst(ctx, r * 1.5, -r * 1.52, r * 0.92, r * 0.46, r * 0.64, -r * 1.06, 'DAGNABBIT!', 6.2, tNow);
      }
      if (drawMound) {
        drawCowboyDirtMoundFront(ctx, r * 1.02);
      }
      ctx.restore();
    } // ==========================================================================
    // Unified Dispatcher for `FarmScene.ts` (`window.DBD_CROP_RENDERER`)
    // ==========================================================================
    function drawUsaCharacter(ctx, type, r, state, tNow = 0, px = 0, py = 0, drawMound = false) {
      if (type === 'habanero' || type === 'sheriff_habanero') {
        drawSheriffHabanero(ctx, r, state, tNow, px, py, drawMound);
        return true;
      }
      if (type === 'sweetcorn' || type === 'quarterback_sweetcorn') {
        drawQuarterbackSweetcorn(ctx, r, state, tNow, px, py, drawMound);
        return true;
      }
      if (type === 'brisket_onion' || type === 'smokey_onion') {
        drawSmokeyBrisketOnion(ctx, r, state, tNow, px, py, drawMound);
        return true;
      }
      return false;
    } // ==========================================================================
    // Continuous State-Cycling Showcase Renderer (`IDLE -> ALERT -> SLICE -> GAG`)
    // Renders a live 4th column or standalone preview where an animated Scythe
    // approaches the character (triggering `2. CURSOR-NEAR ALERT`), slices across
    // (triggering squash-and-stretch + `3. ON-HIT GAG`), and settles back to `1. IDLE`!
    // ==========================================================================
    function drawContinuousShowcaseCycle(ctx, type, r, tNow, scale = 2.35) {
      const cycleDur = 4.5; // 4.5-second continuous loop
      const phase = (tNow % cycleDur) / cycleDur; // 0.0 -> 1.0
      let st = 'idle';
      let stLabel = '1. IDLE (BREATHING)';
      let stColor = '#15803d';
      let scytheX = 68,
        scytheY = -78,
        scytheAng = -0.4,
        showScythe = false,
        slashAlpha = 0;
      let squashX = 1.0,
        squashY = 1.0;
      if (phase < 0.3) {
        // Phase 1: Peaceful Idle
        st = 'idle';
        stLabel = '▶ 1. IDLE';
        stColor = '#15803d';
      } else if (phase < 0.62) {
        // Phase 2: Scythe Approaches -> Cursor-Near Alert!
        st = 'near';
        stLabel = '⚠️ 2. CURSOR-NEAR ALERT!';
        stColor = '#d97706';
        const p = (phase - 0.3) / 0.32;
        showScythe = true;
        scytheX = 52 - p * 30;
        scytheY = -62 + Math.sin(p * Math.PI * 2) * 6;
        scytheAng = -0.35 - p * 0.45;
      } else {
        // Phase 3: Scythe Swings & Smacks -> On-Hit Gag!
        st = 'gag';
        stLabel = '💥 3. ON-HIT GAG!';
        stColor = '#dc2626';
        const p = (phase - 0.62) / 0.38;
        if (p < 0.35) {
          showScythe = true;
          const sp = p / 0.35;
          scytheX = 22 - sp * 58;
          scytheY = -48 + sp * 22;
          scytheAng = -0.8 + sp * 2.2;
          slashAlpha = 1.0 - sp;
        } // Damped spring squash-and-stretch on impact!
        const damp = Math.exp(-p * 6.5) * Math.cos(p * 24.0);
        squashY = 1.0 - damp * 0.22;
        squashX = 1.0 / Math.sqrt(Math.max(0.5, squashY));
      }
      const px = showScythe ? Math.cos(Math.atan2(scytheY + 25, scytheX)) * 1.8 : Math.sin(tNow * 2.2) * 1.1;
      const py = showScythe ? Math.sin(Math.atan2(scytheY + 25, scytheX)) * 1.4 : Math.cos(tNow * 1.7) * 0.6;
      ctx.save();
      ctx.scale(scale * squashX, scale * squashY);
      drawUsaCharacter(ctx, type, r, st, tNow, px, py, true); // Draw slash arc & approaching harvest scythe in the live cycle preview
      if (slashAlpha > 0.02) {
        ctx.save();
        ctx.strokeStyle = `rgba(254, 240, 138, ${slashAlpha * 0.9})`;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, -r * 0.85, r * 1.35, -0.85, 0.65);
        ctx.stroke();
        ctx.restore();
      }
      if (showScythe) {
        ctx.save();
        ctx.translate(scytheX, scytheY);
        ctx.rotate(scytheAng); // Wooden scythe handle
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 14);
        ctx.lineTo(0, -10);
        ctx.stroke();
        ctx.strokeStyle = '#9a5b25';
        ctx.lineWidth = 1.6;
        ctx.stroke(); // Gleaming curved silver scythe blade
        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.quadraticCurveTo(-14, -12, -20, -2);
        ctx.quadraticCurveTo(-12, -6, 0, -5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      return { st, stLabel, stColor };
    }
    return {
      drawSheriffHabanero,
      drawQuarterbackSweetcorn,
      drawSmokeyBrisketOnion,
      drawCowboyDirtMoundBack,
      drawCowboyDirtMoundFront,
      drawUsaCharacter,
      drawContinuousShowcaseCycle,
    };
  })();
  window.DBD_USA_TRIO_RENDERER =
    DBD_USA_TRIO_RENDERER; /* removed: window.DBD_USA_TRIO_SOURCE_CODE (studio-only) */ /* removed: window.__USA_TRIO_REF_URI (studio-only) */ // ============================================================================
  // Authored Morocco Trio Vector Renderer (Hummus Chickpea, Zaalouk Eggplant, Beldi Green Olive)
  // ============================================================================
  // ============================================================================
  // Due by Dusk — Complete Morocco Trio Authored Vector Character Renderer
  // Faithfully implements all 3 Morocco Trio characters from the 3-pose reference sheets
  // in pure HTML5 Canvas 2D with continuous 60fps animations AND smooth pose-to-pose
  // interpolation (`1. IDLE <-> 2. CURSOR-NEAR ALERT <-> 3. ON-HIT GAG`):
  //
  //   1. Hummus Chickpea (`chickpea`, r: 25) — Golden Garbanzo Bean (Marrakech Mint-Tea Host)
  //   2. Zaalouk Eggplant (`eggplant`, r: 27) — Royal-Purple Aubergine (Souk Lantern Mystic)
  //   3. Beldi Green Olive (`olive`, r: 25) — Pimento-Stuffed Green Olive (Saharan Gnawa Drummer)
  //
  // Supported States:
  //   - State 1 (`idle`):          !cursorNear && !shocked (continuous 60fps idle animation)
  //   - State 2 (`near`):          cursorNear && !shocked  (continuous 60fps cursor-near alert animation)
  //   - State 3 (`gag`/`shocked`): shocked                 (continuous 60fps on-hit slapstick gag animation)
  //   - Smooth Blend Object:       { wIdle, wNear, wGag, alertP, gagP } for continuous pose-to-pose morphing!
  //
  // Also includes `drawContinuousShowcaseCycle(...)` which renders a continuous
  // animated state-machine loop (`IDLE -> ANTICIPATION -> CURSOR-NEAR ALERT -> SCYTHE SWING -> ON-HIT GAG -> RECOVERY`)
  // with an approaching & slicing scythe cursor so you can watch the full in-field
  // reaction sequence continuously!
  // ============================================================================
  const DBD_MOROCCO_TRIO_RENDERER = (() => {
    'use strict';
    const INK = '#2b1708';
    function ell(ctx, x, y, rx, ry, rot = 0) {
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
      ctx.fill();
    }
    function circ(ctx, x, y, r) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
      ctx.fill();
    }
    function lerp(a, b, t) {
      return a + (b - a) * t;
    }
    function clamp01(t) {
      return Math.max(0, Math.min(1, t));
    }
    function smoothstep(a, b, t) {
      const u = clamp01((t - a) / Math.max(1e-5, b - a));
      return u * u * (3 - 2 * u);
    }
    function easeOutBack(t) {
      const u = clamp01(t);
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
    }
    function lerpHex(c1, c2, t) {
      const u = clamp01(t);
      const p1 = parseInt(c1.slice(1), 16);
      const p2 = parseInt(c2.slice(1), 16);
      const r = Math.round(lerp((p1 >> 16) & 255, (p2 >> 16) & 255, u));
      const g = Math.round(lerp((p1 >> 8) & 255, (p2 >> 8) & 255, u));
      const b = Math.round(lerp(p1 & 255, p2 & 255, u));
      return `rgb(${r},${g},${b})`;
    } // Resolves discrete state ('idle' | 'near' | 'gag') OR continuous blend weights
    function resolvePoseWeights(state, tNow = 0) {
      if (state && typeof state === 'object') {
        return {
          wIdle: state.wIdle ?? 0,
          wNear: state.wNear ?? 0,
          wGag: state.wGag ?? 0,
          alertP: state.alertP ?? state.wNear ?? 0,
          gagP: state.gagP ?? state.wGag ?? 0,
        };
      }
      if (state === 'near') {
        return { wIdle: 0, wNear: 1, wGag: 0, alertP: 1, gagP: 0 };
      }
      if (state === 'gag' || state === 'shocked') {
        return { wIdle: 0, wNear: 0, wGag: 1, alertP: 0, gagP: 1 };
      }
      return { wIdle: 1, wNear: 0, wGag: 0, alertP: 0, gagP: 0 };
    } // ==========================================================================
    // Sculpted Moroccan Terracotta-Earth Dirt Mound with Left Sprout & Front Clod
    // Faithfully matches the exact dirt mound in all 3 Morocco reference sheets!
    // ==========================================================================
    function drawSculptedDirtMound(ctx, r, withLeftSprout = true, tNow = 0, withFrontClod = false) {
      ctx.save(); // Soft oval ground shadow
      ctx.fillStyle = 'rgba(43, 23, 8, 0.14)';
      ell(ctx, 0, 5.2, r * 1.06, r * 0.17); // Tiny 2-leaf green sprout on the left side of the mound (sways gently at 60fps!)
      if (withLeftSprout) {
        const sproutSway = tNow > 0 ? Math.sin(tNow * 3.4) * 0.08 : 0;
        ctx.save();
        ctx.translate(-r * 0.72, -1.8);
        ctx.rotate(sproutSway);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(2.2, 2.5);
        ctx.quadraticCurveTo(-1.2, -2.5, -3.4, -6.8);
        ctx.stroke();
        for (const [lx, ly, rot, rx, ry, col] of [
          [-5.6, -6.6, -0.45, 3.6, 1.7, '#7cb342'],
          [-1.0, -7.8, 0.55, 3.1, 1.5, '#8bc34a'],
        ]) {
          ctx.fillStyle = col;
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.25;
          ell(ctx, lx, ly, rx, ry, rot);
          ctx.stroke(); // Central leaf vein
          ctx.beginPath();
          ctx.moveTo(lx - Math.cos(rot) * rx * 0.6, ly - Math.sin(rot) * rx * 0.6);
          ctx.lineTo(lx + Math.cos(rot) * rx * 0.5, ly + Math.sin(rot) * rx * 0.5);
          ctx.stroke();
        }
        ctx.restore();
      } // Layered scalloped dirt mound silhouette
      function traceMound(g) {
        g.beginPath();
        g.moveTo(-r * 0.96, 3.2);
        g.bezierCurveTo(-r * 1.02, -0.8, -r * 0.76, -4.6, -r * 0.46, -4.4);
        g.bezierCurveTo(-r * 0.34, -6.4, -r * 0.1, -5.8, 0, -4.0);
        g.bezierCurveTo(r * 0.12, -5.8, r * 0.36, -6.4, r * 0.48, -4.4);
        g.bezierCurveTo(r * 0.78, -4.6, r * 1.02, -0.8, r * 0.96, 3.2);
        g.bezierCurveTo(r * 0.52, 6.2, -r * 0.52, 6.2, -r * 0.96, 3.2);
        g.closePath();
      }
      ctx.save();
      traceMound(ctx);
      const mGrad = ctx.createLinearGradient(0, -6.5, 0, 6.2);
      mGrad.addColorStop(0.0, '#966338');
      mGrad.addColorStop(0.55, '#7c4d28');
      mGrad.addColorStop(1.0, '#543218');
      ctx.fillStyle = mGrad;
      ctx.fill();
      ctx.clip(); // Darker bottom rim shadow crescent inside mound
      ctx.fillStyle = 'rgba(43, 23, 8, 0.34)';
      ctx.beginPath();
      ctx.moveTo(-r * 1.05, 1.2);
      ctx.quadraticCurveTo(0, 4.4, r * 1.05, 1.2);
      ctx.lineTo(r * 1.05, 7.5);
      ctx.lineTo(-r * 1.05, 7.5);
      ctx.closePath();
      ctx.fill(); // Warm soil top clod highlights & pebbles
      ctx.fillStyle = 'rgba(184, 134, 85, 0.38)';
      ell(ctx, -r * 0.54, -2.2, r * 0.18, 1.4, -0.15);
      ell(ctx, r * 0.52, -2.0, r * 0.17, 1.3, 0.15);
      ctx.fillStyle = '#543218';
      for (const [px, py, prx, pry] of [
        [-r * 0.48, 0.2, 1.5, 0.9],
        [-r * 0.36, 1.5, 1.0, 0.7],
        [r * 0.04, 1.4, 1.2, 0.8],
        [r * 0.44, 0.4, 1.5, 1.0],
        [r * 0.58, 1.6, 0.9, 0.6],
      ]) {
        ell(ctx, px, py, prx, pry);
      }
      ctx.restore();
      traceMound(ctx);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.65;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(); // Upper soil cradle scallop line where the vegetable sits
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.52, -3.4);
      ctx.quadraticCurveTo(-r * 0.26, -5.4, -r * 0.06, -3.5);
      ctx.quadraticCurveTo(r * 0.16, -5.6, r * 0.38, -3.5);
      ctx.stroke(); // Optional front-right small pebble clod (matching Hummus Chickpea sheet!)
      if (withFrontClod) {
        ctx.fillStyle = '#7c4d28';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(r * 0.24, 5.4);
        ctx.bezierCurveTo(r * 0.22, 2.2, r * 0.46, 2.0, r * 0.46, 5.2);
        ctx.quadraticCurveTo(r * 0.35, 6.0, r * 0.24, 5.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    } // Glossy blue cartoon sweat drop — slides & bobbles continuously when tNow > 0!
    function drawSweatDrop(ctx, x, y, scale = 1.0, rot = 0, tNow = 0) {
      if (scale <= 0.02) return;
      const slideY = tNow > 0 ? ((tNow * 1.85) % 1.0) * 2.5 : 0;
      const pulse = tNow > 0 ? 1.0 - ((tNow * 1.85) % 1.0) * 0.12 : 1.0;
      ctx.save();
      ctx.translate(x, y + slideY);
      ctx.rotate(rot);
      ctx.scale(scale * pulse, scale * pulse);
      ctx.fillStyle = '#5bc0eb';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.45;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -6.2);
      ctx.bezierCurveTo(3.8, -1.0, 4.1, 3.8, 0, 4.3);
      ctx.bezierCurveTo(-4.1, 3.8, -3.8, -1.0, 0, -6.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e0f7ff';
      ell(ctx, -1.0, 0.8, 0.9, 1.8, -0.2);
      ctx.restore();
    } // Crisp > < chevron wince eyes (State 3 On-Hit Gag — pulses with impact energy!)
    function drawChevronWinceEyes(ctx, leftX, rightX, eyeY, w, h, ink = INK, lw = 2.1, tNow = 0) {
      const squeeze = tNow > 0 ? 1.0 + Math.sin(tNow * 20.0) * 0.08 : 1.0;
      const hw = w * squeeze;
      const hh = h / squeeze;
      ctx.save();
      ctx.strokeStyle = ink;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round'; // Left '>'
      ctx.beginPath();
      ctx.moveTo(leftX - hw * 0.55, eyeY - hh);
      ctx.lineTo(leftX + hw * 0.45, eyeY);
      ctx.lineTo(leftX - hw * 0.55, eyeY + hh);
      ctx.stroke(); // Right '<'
      ctx.beginPath();
      ctx.moveTo(rightX + hw * 0.55, eyeY - hh);
      ctx.lineTo(rightX - hw * 0.45, eyeY);
      ctx.lineTo(rightX + hw * 0.55, eyeY + hh);
      ctx.stroke();
      ctx.restore();
    } // Spiky comic explosion speech bubble ("AYWA!", "WAILI!", "YALLAH!")
    function drawSpikyExplosionBubble(ctx, cx, cy, rx, ry, tailX, tailY, text, fontSize = 6.2, tNow = 0, scaleP = 1.0) {
      if (scaleP <= 0.02) return;
      const pulse = (tNow > 0 ? 1.0 + Math.sin(tNow * 16.0) * 0.045 : 1.0) * scaleP;
      ctx.save();
      const spikes = 14;
      const pts = [];
      for (let i = 0; i < spikes * 2; i++) {
        const ang = (i * Math.PI) / spikes - Math.PI * 0.5;
        const isOuter = i % 2 === 0;
        const jitter = (((i * 7) % 5) - 2) * 0.03;
        const radScale = (isOuter ? 1.18 + jitter : 0.86 - jitter * 0.3) * pulse;
        pts.push([cx + Math.cos(ang) * rx * radScale, cy + Math.sin(ang) * ry * radScale]);
      }
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.35;
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 6;
      ctx.beginPath();
      pts[18] = [lerp(cx, tailX, scaleP), lerp(cy, tailY, scaleP)];
      pts[17][0] -= 2.2 * scaleP;
      pts[19][1] -= 2.0 * scaleP;
      for (let i = 0; i < pts.length; i++) {
        const [px, py] = pts[i];
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.translate(cx, cy + 0.4);
      ctx.scale(pulse, pulse);
      ctx.rotate(-0.04 + (tNow > 0 ? Math.sin(tNow * 18.0) * 0.025 : 0));
      ctx.fillStyle = INK;
      ctx.font = `900 ${fontSize}px "Arial Black", "Impact", "Trebuchet MS", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 0);
      ctx.restore();
      ctx.restore();
    } // ==========================================================================
    // 1. HUMMUS CHICKPEA (`chickpea`, base r = 25)
    //    Golden Garbanzo Bean — Marrakech Mint-Tea Host
    // ==========================================================================
    function drawHummusChickpea(ctx, r = 25, state = 'idle', tNow = 0, px = 0, py = 0, drawMound = true) {
      const { wIdle, wNear, wGag, alertP, gagP } = resolvePoseWeights(state, tNow);
      const isNear = wNear >= 0.5 && wGag < 0.5;
      const isGag = wGag >= 0.5;
      const gagEased = easeOutBack(clamp01(gagP));
      ctx.save(); // 1. Draw Back/Main Dirt Mound first so the creamy hummus mash in Pose 3 can drape over its top rim!
      if (drawMound) {
        drawSculptedDirtMound(ctx, r * 1.0, true, tNow, true);
      } // Continuous 60fps posture interpolation across Idle -> Near -> Gag
      const breatheY = wIdle * (tNow > 0 ? Math.sin(tNow * 3.8) * 0.85 : 0);
      const squatY = wNear * (1.5 + (tNow > 0 ? Math.sin(tNow * 18.0) * 0.45 : 0));
      const jitterX =
        wNear * (tNow > 0 ? Math.sin(tNow * 32.0) * 0.58 : 0) + wGag * (tNow > 0 ? Math.sin(tNow * 24.0) * 0.45 : 0);
      ctx.save();
      ctx.translate(jitterX, breatheY + squatY); // Helper: Draw Crimson-Red Moroccan Fez with Black Tassel
      function drawMoroccanFez(fx, fy, frot, showUnderside = false) {
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(frot); // Swaying Black Silk Tassel hanging from top-center of Fez crown down the left side
        const tasselSwing =
          tNow > 0 ? Math.sin(tNow * (showUnderside ? 18.0 : 4.5)) * (showUnderside ? 0.18 : 0.08) : 0;
        ctx.save();
        ctx.translate(0, -r * 0.62);
        ctx.rotate(tasselSwing);
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (!showUnderside) {
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(-r * 0.38, -r * 0.04, -r * 0.48, r * 0.12, -r * 0.52, r * 0.28);
          ctx.stroke(); // Tassel bead knot
          ctx.fillStyle = '#18181b';
          circ(ctx, -r * 0.52, r * 0.28, 1.8); // 4 flared tassel fringe strands
          ctx.beginPath();
          ctx.moveTo(-r * 0.52, r * 0.28);
          ctx.lineTo(-r * 0.64, r * 0.54);
          ctx.moveTo(-r * 0.52, r * 0.28);
          ctx.lineTo(-r * 0.56, r * 0.58);
          ctx.moveTo(-r * 0.52, r * 0.28);
          ctx.lineTo(-r * 0.48, r * 0.56);
          ctx.stroke();
        } else {
          // Airborne tassel whipping out to the upper-left in Pose 3
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(-r * 0.24, -r * 0.14, -r * 0.44, -r * 0.08, -r * 0.56, -r * 0.02);
          ctx.stroke();
          ctx.fillStyle = '#18181b';
          circ(ctx, -r * 0.56, -r * 0.02, 1.8);
          ctx.beginPath();
          ctx.moveTo(-r * 0.56, -r * 0.02);
          ctx.lineTo(-r * 0.8, -r * 0.1);
          ctx.moveTo(-r * 0.56, -r * 0.02);
          ctx.lineTo(-r * 0.78, r * 0.02);
          ctx.moveTo(-r * 0.56, -r * 0.02);
          ctx.lineTo(-r * 0.72, r * 0.12);
          ctx.stroke();
        }
        ctx.restore(); // Truncated Conical Crimson Fez Frustum
        function traceFezBody(g) {
          g.beginPath();
          g.moveTo(-r * 0.34, -r * 0.6);
          g.quadraticCurveTo(0, -r * 0.68, r * 0.34, -r * 0.6);
          g.lineTo(r * 0.44, 0);
          g.quadraticCurveTo(0, r * 0.1, -r * 0.44, 0);
          g.closePath();
        }
        ctx.save();
        traceFezBody(ctx);
        const fezGrad = ctx.createLinearGradient(-r * 0.42, -r * 0.3, r * 0.42, -r * 0.3);
        fezGrad.addColorStop(0.0, '#991b1b');
        fezGrad.addColorStop(0.35, '#dc2626');
        fezGrad.addColorStop(0.75, '#b91c1c');
        fezGrad.addColorStop(1.0, '#7f1d1d');
        ctx.fillStyle = fezGrad;
        ctx.fill();
        ctx.clip(); // Right-side warm crimson highlight stripe
        ctx.fillStyle = 'rgba(254, 202, 202, 0.24)';
        ctx.beginPath();
        ctx.moveTo(r * 0.12, -r * 0.62);
        ctx.lineTo(r * 0.24, -r * 0.6);
        ctx.lineTo(r * 0.31, 0.05 * r);
        ctx.lineTo(r * 0.16, 0.05 * r);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        traceFezBody(ctx);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.55;
        ctx.lineJoin = 'round';
        ctx.stroke(); // Top elliptical crown crease
        ctx.fillStyle = '#b91c1c';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        ell(ctx, 0, -r * 0.6, r * 0.33, r * 0.07);
        ctx.stroke(); // Dark hollow underside opening when launched into the air in Pose 3!
        if (showUnderside) {
          ctx.fillStyle = '#450a0a';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.45;
          ell(ctx, 0, 0.5, r * 0.43, r * 0.13);
          ctx.stroke();
          ctx.fillStyle = '#7f1d1d';
          ell(ctx, 0, 0.2, r * 0.34, r * 0.08);
        }
        ctx.restore();
      } // Helper: Draw Ornate Pear-Shaped Gold Moroccan Berrad Teapot
      function drawBerradTeapot(tx, ty, trot, scale = 1.0) {
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(trot);
        ctx.scale(scale, scale); // Curved C-Handle on Left (-r * 0.26)
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.16, -r * 0.24);
        ctx.bezierCurveTo(-r * 0.4, -r * 0.34, -r * 0.42, r * 0.04, -r * 0.18, r * 0.08);
        ctx.stroke();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1.7;
        ctx.stroke(); // Long Curved S-Spout on Right (+r * 0.20 -> +r * 0.48)
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.18, -r * 0.06);
        ctx.bezierCurveTo(r * 0.34, -r * 0.08, r * 0.38, -r * 0.28, r * 0.48, -r * 0.3);
        ctx.lineTo(r * 0.45, -r * 0.21);
        ctx.bezierCurveTo(r * 0.38, -r * 0.16, r * 0.34, r * 0.08, r * 0.16, r * 0.12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Pedestal foot base
        ctx.fillStyle = '#d97706';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.35;
        ell(ctx, 0, r * 0.24, r * 0.18, r * 0.06);
        ctx.stroke(); // Pear-Shaped Berrad Body Belly
        function tracePotBelly(g) {
          g.beginPath();
          g.moveTo(-r * 0.16, -r * 0.26);
          g.quadraticCurveTo(0, -r * 0.3, r * 0.16, -r * 0.26);
          g.bezierCurveTo(r * 0.22, -r * 0.14, r * 0.3, r * 0.02, r * 0.24, r * 0.16);
          g.quadraticCurveTo(0, r * 0.26, -r * 0.24, r * 0.16);
          g.bezierCurveTo(-r * 0.3, r * 0.02, -r * 0.22, -r * 0.14, -r * 0.16, -r * 0.26);
          g.closePath();
        }
        ctx.save();
        tracePotBelly(ctx);
        const potGrad = ctx.createRadialGradient(-r * 0.06, -r * 0.04, 1, 0, 0, r * 0.3);
        potGrad.addColorStop(0.0, '#fef08a');
        potGrad.addColorStop(0.55, '#facc15');
        potGrad.addColorStop(1.0, '#b45309');
        ctx.fillStyle = potGrad;
        ctx.fill();
        ctx.clip(); // Glossy gold belly highlight crescent
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ell(ctx, -r * 0.09, 0.02 * r, r * 0.05, r * 0.12, 0.2);
        ctx.restore();
        tracePotBelly(ctx);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ctx.stroke(); // Conical Domed Lid & Top Finial Knob
        ctx.fillStyle = '#eab308';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.35;
        ctx.beginPath();
        ctx.moveTo(-r * 0.19, -r * 0.26);
        ctx.quadraticCurveTo(0, -r * 0.31, r * 0.19, -r * 0.26);
        ctx.quadraticCurveTo(r * 0.1, -r * 0.42, 0, -r * 0.46);
        ctx.quadraticCurveTo(-r * 0.1, -r * 0.42, -r * 0.19, -r * 0.26);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Top finial ball
        ctx.fillStyle = '#fef08a';
        circ(ctx, 0, -r * 0.5, 2.0);
        ctx.stroke();
        ctx.restore();
      }
      if (!isGag) {
        // ======================================================================
        // POSE 1 (IDLE) & POSE 2 (CURSOR-NEAR ALERT):
        // Plump Golden Garbanzo Bean with Beaked Crown, Crimson Fez & Gold Berrad
        // ======================================================================
        // 1. Plump Golden Chickpea Body with Signature Garbanzo Beak Peak & Crease
        function traceChickpeaBody(g) {
          g.beginPath(); // Top-right garbanzo beak tip
          g.moveTo(0, -r * 1.36);
          g.bezierCurveTo(r * 0.48, -r * 1.18, r * 0.72, -r * 0.78, r * 0.68, -r * 0.34);
          g.bezierCurveTo(r * 0.64, 0.0, r * 0.38, r * 0.1, 0, r * 0.08);
          g.bezierCurveTo(-r * 0.42, r * 0.1, -r * 0.72, -r * 0.04, -r * 0.72, -r * 0.46);
          g.bezierCurveTo(-r * 0.72, -r * 0.9, -r * 0.42, -r * 1.24, 0, -r * 1.36);
          g.closePath();
        }
        ctx.save();
        traceChickpeaBody(ctx);
        const cpGrad = ctx.createRadialGradient(r * 0.1, -r * 0.78, 2, 0, -r * 0.58, r * 0.92);
        cpGrad.addColorStop(0.0, '#fde68a');
        cpGrad.addColorStop(0.55, '#f4ba3e');
        cpGrad.addColorStop(1.0, '#c87d1a');
        ctx.fillStyle = cpGrad;
        ctx.fill();
        ctx.clip(); // Warm golden-amber shadow crescent along left & bottom edge
        ctx.fillStyle = 'rgba(180, 95, 12, 0.28)';
        ctx.beginPath();
        ctx.moveTo(-r * 0.52, -r * 1.22);
        ctx.bezierCurveTo(-r * 0.62, -r * 0.65, -r * 0.46, -r * 0.1, r * 0.45, -r * 0.05);
        ctx.lineTo(r * 0.45, r * 0.25);
        ctx.lineTo(-r * 0.85, r * 0.25);
        ctx.lineTo(-r * 0.85, -r * 1.25);
        ctx.closePath();
        ctx.fill(); // Signature Garbanzo Bean Crease Line below the crown
        ctx.strokeStyle = 'rgba(180, 95, 12, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.02, -r * 1.26);
        ctx.quadraticCurveTo(r * 0.12, -r * 1.08, r * 0.08, -r * 0.96);
        ctx.stroke(); // Soft cream highlight on upper-right cheek
        ctx.fillStyle = 'rgba(255, 251, 235, 0.55)';
        ell(ctx, r * 0.28, -r * 0.96, 3.2, 1.8, 0.45);
        ctx.restore();
        traceChickpeaBody(ctx);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.65;
        ctx.lineJoin = 'round';
        ctx.stroke(); // 2. Crimson Moroccan Fez Hat tilted jauntily on upper-left of head
        const fezTilt = lerp(-0.28, -0.32, wNear) + (tNow > 0 ? Math.sin(tNow * 3.8) * 0.03 : 0);
        drawMoroccanFez(-r * 0.18, -r * 1.06, fezTilt, false); // 3. Facial Expression (Cute Glossy `:3` Host in Idle vs. Wide Shocked Eyes in Near)
        const eyeY = -r * 0.72;
        if (!isNear) {
          // Pose 1: Cute dark-brown glossy oval eyes with dual white specular glints
          for (const [ex, ey] of [
            [-r * 0.16, eyeY + 0.6],
            [r * 0.26, eyeY - 0.8],
          ]) {
            ctx.fillStyle = INK;
            ell(ctx, ex + px * 0.25, ey + py * 0.2, 3.3, 3.6);
            ctx.fillStyle = '#ffffff';
            circ(ctx, ex - 1.0 + px * 0.15, ey - 1.1 + py * 0.1, 1.25);
            circ(ctx, ex + 1.1 + px * 0.15, ey + 1.1 + py * 0.1, 0.55); // Cheeky lower eyelid smile line
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(ex - 3.6, ey + 3.2);
            ctx.quadraticCurveTo(ex, ey + 2.4, ex + 3.6, ey + 3.2);
            ctx.stroke();
          } // Cute `:3` cat-smile mouth
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.55;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(-r * 0.04, eyeY + 4.4);
          ctx.quadraticCurveTo(r * 0.01, eyeY + 7.2, r * 0.06, eyeY + 4.4);
          ctx.quadraticCurveTo(r * 0.11, eyeY + 7.2, r * 0.16, eyeY + 4.2);
          ctx.stroke();
        } else {
          // Pose 2: Huge round white shocked eyes + tiny darting pupils + open gasping mouth + sweat drop!
          for (const [ex, ey, er] of [
            [-r * 0.1, eyeY + 0.5, 5.8],
            [r * 0.34, eyeY - 0.5, 5.4],
          ]) {
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.55;
            circ(ctx, ex, ey, er);
            ctx.stroke();
            ctx.fillStyle = INK;
            circ(ctx, ex + 0.8 + px * 0.45, ey + py * 0.35, 1.45);
          } // Under-eye panic wrinkle lines
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.15;
          ctx.beginPath();
          ctx.arc(-r * 0.1, eyeY + 0.5, 6.9, 0.25 * Math.PI, 0.78 * Math.PI);
          ctx.stroke(); // High arched worried eyebrows
          ctx.lineWidth = 1.7;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-r * 0.24, eyeY - 6.8);
          ctx.quadraticCurveTo(-r * 0.12, eyeY - 9.4, -r * 0.02, eyeY - 7.4);
          ctx.moveTo(r * 0.24, eyeY - 8.2);
          ctx.quadraticCurveTo(r * 0.36, eyeY - 9.8, r * 0.46, eyeY - 6.8);
          ctx.stroke(); // Small open gasping D-mouth with pink tongue
          const my = eyeY + 5.6;
          ctx.fillStyle = '#3b0808';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.35;
          ctx.beginPath();
          ctx.moveTo(r * 0.04, my + 2.2);
          ctx.bezierCurveTo(r * 0.02, my - 3.0, r * 0.24, my - 3.0, r * 0.22, my + 2.2);
          ctx.closePath();
          ctx.fill();
          ctx.save();
          ctx.clip();
          ctx.fillStyle = '#f87171';
          ell(ctx, r * 0.14, my + 2.0, 2.8, 1.6);
          ctx.restore();
          ctx.stroke(); // Glossy blue sweat drop on upper-left temple
          drawSweatDrop(ctx, -r * 0.56, -r * 0.78, 0.92, 0.08, tNow);
        } // 4. Pouring Green Mint-Tea Arc in Pose 1 (IDLE) + Gold Berrad Teapot & Arms
        if (!isNear) {
          const potBob = tNow > 0 ? Math.sin(tNow * 4.5) * 0.8 : 0; // High Parabolic Green Mint-Tea Stream Arc pouring from spout (r*0.78, -r*0.42) to right ground (r*1.28, -r*0.10)!
          ctx.save(); // Outer dark-olive & inner bright-mint tea stream ribbon
          ctx.fillStyle = '#84cc16';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.35;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(r * 0.73, -r * 0.46 + potBob * 0.5);
          ctx.bezierCurveTo(r * 0.8, -r * 1.64, r * 1.24, -r * 1.64, r * 1.28, -r * 0.14); // Bottom splash crown at right of mound
          ctx.lineTo(r * 1.38, -r * 0.28);
          ctx.quadraticCurveTo(r * 1.44, -r * 0.18, r * 1.3, -r * 0.06);
          ctx.quadraticCurveTo(r * 1.24, r * 0.04, r * 1.18, -r * 0.06);
          ctx.quadraticCurveTo(r * 1.06, -r * 0.16, r * 1.12, -r * 0.26);
          ctx.lineTo(r * 1.2, -r * 0.14);
          ctx.bezierCurveTo(r * 1.14, -r * 1.42, r * 0.84, -r * 1.42, r * 0.77, -r * 0.44 + potBob * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke(); // Inner pale-lime highlight along the tea arc
          ctx.strokeStyle = '#d9f99d';
          ctx.lineWidth = 1.2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(r * 0.82, -r * 0.62);
          ctx.bezierCurveTo(r * 0.86, -r * 1.44, r * 1.16, -r * 1.44, r * 1.22, -r * 0.34);
          ctx.stroke(); // Animated splashing green tea droplets near spout & splash crown
          const dropPhase = tNow > 0 ? (tNow * 2.8) % 1.0 : 0.3;
          ctx.fillStyle = '#84cc16';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.15;
          ell(ctx, r * 0.74, -r * 0.64 - dropPhase * 3.0, 1.3, 2.6, -0.15);
          ctx.stroke();
          ell(ctx, r * 1.12 - dropPhase * 2.0, -r * 0.34 - dropPhase * 2.5, 2.2, 1.2, 0.4);
          ctx.stroke();
          ell(ctx, r * 1.38 + dropPhase * 2.0, -r * 0.36 - dropPhase * 2.5, 2.2, 1.2, -0.4);
          ctx.stroke();
          ctx.restore(); // Gold Berrad Teapot held in front-right
          drawBerradTeapot(r * 0.32, -r * 0.22 + potBob, -0.06, 1.0); // Left & Right Golden Chickpea Arms holding the Berrad handle & spout base
          ctx.save();
          ctx.strokeStyle = INK;
          ctx.lineWidth = 4.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-r * 0.26, -r * 0.22);
          ctx.quadraticCurveTo(-r * 0.08, -r * 0.14, r * 0.08, -r * 0.24 + potBob);
          ctx.stroke();
          ctx.strokeStyle = '#f4ba3e';
          ctx.lineWidth = 2.4;
          ctx.stroke(); // Upper-left thumb/grip curl
          ctx.strokeStyle = INK;
          ctx.lineWidth = 4.2;
          ctx.beginPath();
          ctx.moveTo(-r * 0.18, -r * 0.38);
          ctx.quadraticCurveTo(-r * 0.04, -r * 0.34, r * 0.06, -r * 0.4 + potBob);
          ctx.stroke();
          ctx.strokeStyle = '#f4ba3e';
          ctx.lineWidth = 2.1;
          ctx.stroke(); // Right hand supporting teapot belly
          ctx.fillStyle = '#f4ba3e';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.45;
          ell(ctx, r * 0.58, -r * 0.14 + potBob, 3.2, 2.4, -0.2);
          ctx.stroke();
          ctx.restore();
        } else {
          // Pose 2 (Alert): Clutching the Gold Berrad Teapot tightly against its chest!
          const clutchJitter = tNow > 0 ? Math.sin(tNow * 24.0) * 0.5 : 0;
          drawBerradTeapot(r * 0.24, -r * 0.16 + clutchJitter, 0.08, 0.96);
          ctx.save();
          ctx.strokeStyle = INK;
          ctx.lineWidth = 4.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-r * 0.26, -r * 0.18);
          ctx.quadraticCurveTo(-r * 0.08, -r * 0.1, r * 0.02, -r * 0.2 + clutchJitter);
          ctx.stroke();
          ctx.strokeStyle = '#f4ba3e';
          ctx.lineWidth = 2.4;
          ctx.stroke();
          ctx.strokeStyle = INK;
          ctx.lineWidth = 4.2;
          ctx.beginPath();
          ctx.moveTo(-r * 0.16, -r * 0.34);
          ctx.quadraticCurveTo(-r * 0.02, -r * 0.3, r * 0.04, -r * 0.36 + clutchJitter);
          ctx.stroke();
          ctx.strokeStyle = '#f4ba3e';
          ctx.lineWidth = 2.1;
          ctx.stroke();
          ctx.fillStyle = '#f4ba3e';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.45;
          ell(ctx, r * 0.62, -r * 0.14 + clutchJitter, 3.0, 3.4, 0.1);
          ctx.stroke();
          ctx.restore();
        }
      } else {
        // ======================================================================
        // POSE 3: ON-HIT GAG!
        // Squashes into a Creamy Multi-Lobed Hummus Mash Pile with Waving Mash
        // Arms, `> <` Wince Face, Airborne Fez, Airborne Berrad Teapot + Mint Tea
        // Splashes, and Spiky "AYWA!" Burst!
        // ======================================================================
        const mashPulse = tNow > 0 ? Math.sin(tNow * 18.0) * 0.03 : 0;
        ctx.save();
        ctx.scale(1.0 + mashPulse, 1.0 - mashPulse * 0.7); // 1. Waving Stubby Hummus Mash Arms on Left & Right + Action Lines
        const armWave = tNow > 0 ? Math.sin(tNow * 22.0) * 0.15 : 0;
        for (const [dir, ax, ay, arot] of [
          [-1, -r * 0.66, -r * 0.38, -0.45 - armWave],
          [1, r * 0.66, -r * 0.48, 0.45 + armWave],
        ]) {
          ctx.save();
          ctx.translate(ax, ay);
          ctx.rotate(arot);
          ctx.fillStyle = '#f5c249';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.55;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(-dir * 3.0, 3.5);
          ctx.quadraticCurveTo(dir * 6.5, -4.5, dir * 8.5, -2.0);
          ctx.quadraticCurveTo(dir * 9.5, 1.5, 0, 5.2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke(); // Double motion vibration ticks beside waving arms
          ctx.lineWidth = 1.25;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(dir * 10.5, -2.5);
          ctx.lineTo(dir * 11.2, 2.2);
          ctx.moveTo(dir * 13.0, -1.0);
          ctx.lineTo(dir * 13.5, 2.5);
          ctx.stroke();
          ctx.restore();
        } // 2. Sculpted Multi-Lobed Creamy Hummus Mash Pile blanketing the top of the dirt mound!
        function traceHummusMash(g) {
          g.beginPath(); // Top whipped hummus peak
          g.moveTo(-r * 0.06, -r * 0.94);
          g.bezierCurveTo(r * 0.12, -r * 0.92, r * 0.24, -r * 0.76, r * 0.36, -r * 0.74);
          g.bezierCurveTo(r * 0.56, -r * 0.72, r * 0.68, -r * 0.52, r * 0.64, -r * 0.34); // Right ruffled hummus mash base blanketing the soil
          g.bezierCurveTo(r * 0.8, -r * 0.28, r * 0.84, -r * 0.06, r * 0.66, r * 0.02);
          g.bezierCurveTo(r * 0.52, r * 0.08, r * 0.34, r * 0.02, r * 0.18, r * 0.08);
          g.bezierCurveTo(0, r * 0.18, -r * 0.22, r * 0.16, -r * 0.38, r * 0.04);
          g.bezierCurveTo(-r * 0.58, r * 0.08, -r * 0.82, -r * 0.02, -r * 0.76, -r * 0.2);
          g.bezierCurveTo(-r * 0.74, -r * 0.32, -r * 0.64, -r * 0.34, -r * 0.6, -r * 0.44);
          g.bezierCurveTo(-r * 0.58, -r * 0.66, -r * 0.38, -r * 0.76, -r * 0.22, -r * 0.78);
          g.bezierCurveTo(-r * 0.14, -r * 0.86, -r * 0.12, -r * 0.96, -r * 0.06, -r * 0.94);
          g.closePath();
        }
        ctx.save();
        traceHummusMash(ctx);
        const hmGrad = ctx.createLinearGradient(0, -r * 0.94, 0, r * 0.16);
        hmGrad.addColorStop(0.0, '#fde68a');
        hmGrad.addColorStop(0.55, '#f6c445');
        hmGrad.addColorStop(1.0, '#eab308');
        ctx.fillStyle = hmGrad;
        ctx.fill();
        ctx.clip(); // Lighter creamy whipped hummus collar fold along the lower rim
        ctx.fillStyle = '#fef9c3';
        ctx.beginPath();
        ctx.moveTo(-r * 0.78, -r * 0.22);
        ctx.quadraticCurveTo(-r * 0.46, -r * 0.32, -r * 0.24, -r * 0.18);
        ctx.quadraticCurveTo(0, -r * 0.08, r * 0.26, -r * 0.2);
        ctx.quadraticCurveTo(r * 0.54, -r * 0.3, r * 0.82, -r * 0.18);
        ctx.lineTo(r * 0.85, r * 0.2);
        ctx.lineTo(-r * 0.85, r * 0.2);
        ctx.closePath();
        ctx.fill(); // Whipped hummus swirl crease near top peak
        ctx.strokeStyle = 'rgba(180, 95, 12, 0.48)';
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.04, -r * 0.88);
        ctx.quadraticCurveTo(r * 0.12, -r * 0.74, r * 0.1, -r * 0.62);
        ctx.stroke();
        ctx.restore();
        traceHummusMash(ctx);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.65;
        ctx.lineJoin = 'round';
        ctx.stroke(); // Extra small hummus splatters on the right side of the dirt mound
        ctx.fillStyle = '#fef08a';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.25;
        ell(ctx, r * 0.48, r * 0.11, 3.2, 1.7, 0.1);
        ctx.stroke();
        circ(ctx, r * 0.68, r * 0.06, 1.5);
        ctx.stroke(); // 3. Tight `> <` Wince Eyes & Downturned Frown on the Hummus Mash!
        const mashEyeY = -r * 0.46;
        drawChevronWinceEyes(ctx, -r * 0.16, r * 0.24, mashEyeY, 5.2, 2.2, INK, 2.0, tNow);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.85;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.04, mashEyeY + 5.8);
        ctx.quadraticCurveTo(r * 0.04, mashEyeY + 0.5, r * 0.12, mashEyeY + 5.8);
        ctx.stroke();
        ctx.restore(); // End mash scale
        // 4. Airborne Crimson Moroccan Fez + Vertical Launch Motion Arcs
        const fezBounce = tNow > 0 ? Math.sin(tNow * 16.0) * 2.2 : 0;
        drawMoroccanFez(-r * 0.26, -r * 1.46 + fezBounce, -0.52, true);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.25;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.04, -r * 1.32);
        ctx.quadraticCurveTo(r * 0.08, -r * 1.15, r * 0.12, -r * 1.0);
        ctx.moveTo(r * 0.06, -r * 1.28);
        ctx.quadraticCurveTo(r * 0.16, -r * 1.16, r * 0.18, -r * 1.06);
        ctx.stroke(); // 5. Airborne Gold Berrad Teapot Flung to Upper-Left + 3 Green Mint-Tea Splashes!
        const potSpin = tNow > 0 ? Math.sin(tNow * 14.0) * 0.12 : 0;
        drawBerradTeapot(-r * 0.84, -r * 0.78 - fezBounce * 0.6, -0.58 + potSpin, 0.92); // Motion curve under airborne teapot
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(-r * 0.68, -r * 0.62, 7.5, 0.2 * Math.PI, 0.65 * Math.PI);
        ctx.stroke(); // 3 Green Mint-Tea Splash Droplets flying out of the airborne teapot!
        const splashShift = tNow > 0 ? ((tNow * 2.5) % 1.0) * 2.2 : 0;
        ctx.fillStyle = '#84cc16';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.25; // Large teardrop splash
        ctx.save();
        ctx.translate(-r * 0.36 + splashShift * 0.3, -r * 0.78 - splashShift);
        ctx.rotate(0.25);
        ctx.beginPath();
        ctx.moveTo(0, 5.5);
        ctx.bezierCurveTo(-3.4, 1.0, -3.2, -4.2, 0, -4.5);
        ctx.bezierCurveTo(3.2, -4.2, 3.4, 1.0, 0, 5.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore(); // Upper-right & left tea droplets
        ell(ctx, -r * 0.24 + splashShift * 0.5, -r * 1.04 - splashShift, 3.6, 1.8, -0.55);
        ctx.stroke();
        ell(ctx, -r * 0.56 - splashShift * 0.4, -r * 1.12 - splashShift, 2.4, 1.5, 0.65);
        ctx.stroke();
        circ(ctx, -r * 0.18, -r * 0.84, 1.4);
        ctx.stroke(); // 6. Spiky Comic "AYWA!" Explosion Bubble at Upper-Right
        drawSpikyExplosionBubble(
          ctx,
          r * 1.02,
          -r * 1.24,
          r * 0.56,
          r * 0.3,
          r * 0.54,
          -r * 0.82,
          'AYWA!',
          6.0,
          tNow,
          clamp01(gagEased),
        );
      }
      ctx.restore();
      ctx.restore();
    } // ==========================================================================
    // 2. ZAALOUK EGGPLANT (`eggplant`, base r = 27)
    //    Royal-Purple Aubergine — Souk Lantern Mystic
    // ==========================================================================
    function drawZaaloukEggplant(ctx, r = 27, state = 'idle', tNow = 0, px = 0, py = 0, drawMound = true) {
      const { wIdle, wNear, wGag, alertP, gagP } = resolvePoseWeights(state, tNow);
      const isNear = wNear >= 0.5 && wGag < 0.5;
      const isGag = wGag >= 0.5;
      const gagEased = easeOutBack(clamp01(gagP));
      ctx.save(); // Continuous 60fps breathing / alert crouch / dizzy recoil
      const breatheY = wIdle * (tNow > 0 ? Math.sin(tNow * 3.5) * 0.85 : 0);
      const squatY = wNear * (2.6 + (tNow > 0 ? Math.sin(tNow * 18.0) * 0.45 : 0));
      const jitterX =
        wNear * (tNow > 0 ? Math.sin(tNow * 32.0) * 0.55 : 0) + wGag * (tNow > 0 ? Math.sin(tNow * 24.0) * 0.6 : 0);
      ctx.save();
      ctx.translate(jitterX, breatheY + squatY); // Helper: Conical Terracotta Clay Tagine Lid Hat
      function drawTagineHat(hx, hy, hrot, showUnderside = false) {
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(hrot); // Flared dark-terracotta underside rim (visible at bottom of hat)
        ctx.fillStyle = '#7c2d12';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ell(ctx, 0, 1.5, r * 0.64, showUnderside ? r * 0.18 : r * 0.12);
        ctx.stroke();
        if (showUnderside) {
          // Inner recessed terracotta ring when launched in Pose 3
          ctx.fillStyle = '#5c1f0b';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.25;
          ell(ctx, 0, 2.0, r * 0.5, r * 0.12);
          ctx.stroke();
        } // Conical Tagine Chimney Dome + Flared Base Rim Collar
        function traceTagineCone(g) {
          g.beginPath(); // Top-left of chimney neck
          g.moveTo(-r * 0.11, -r * 0.58);
          g.quadraticCurveTo(0, -r * 0.61, r * 0.11, -r * 0.58); // Sloping conical walls out to wide base rim
          g.lineTo(r * 0.56, -r * 0.08);
          g.quadraticCurveTo(r * 0.68, -r * 0.04, r * 0.64, r * 0.06);
          g.quadraticCurveTo(0, -r * 0.1, -r * 0.64, r * 0.06);
          g.quadraticCurveTo(-r * 0.68, -r * 0.04, -r * 0.56, -r * 0.08);
          g.closePath();
        }
        ctx.save();
        traceTagineCone(ctx);
        const tgGrad = ctx.createLinearGradient(-r * 0.55, -r * 0.3, r * 0.55, -r * 0.3);
        tgGrad.addColorStop(0.0, '#b4532a');
        tgGrad.addColorStop(0.45, '#e07a47');
        tgGrad.addColorStop(0.8, '#ea8c5d');
        tgGrad.addColorStop(1.0, '#9a3e1c');
        ctx.fillStyle = tgGrad;
        ctx.fill();
        ctx.clip(); // Right-side terracotta specular highlight triangle
        ctx.fillStyle = 'rgba(255, 237, 213, 0.38)';
        ctx.beginPath();
        ctx.moveTo(r * 0.04, -r * 0.56);
        ctx.lineTo(r * 0.1, -r * 0.56);
        ctx.lineTo(r * 0.44, -r * 0.1);
        ctx.lineTo(r * 0.26, -r * 0.12);
        ctx.closePath();
        ctx.fill(); // Base rim separation band
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.35;
        ctx.beginPath();
        ctx.moveTo(-r * 0.62, -r * 0.06);
        ctx.quadraticCurveTo(0, -r * 0.2, r * 0.62, -r * 0.06);
        ctx.stroke();
        ctx.restore();
        traceTagineCone(ctx);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.55;
        ctx.lineJoin = 'round';
        ctx.stroke(); // Cupped Top Steam-Knob Finial of the Tagine Lid
        ctx.fillStyle = '#d96b38';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.11, -r * 0.57);
        ctx.lineTo(-r * 0.16, -r * 0.74);
        ctx.quadraticCurveTo(0, -r * 0.8, r * 0.16, -r * 0.74);
        ctx.lineTo(r * 0.11, -r * 0.57);
        ctx.quadraticCurveTo(0, -r * 0.54, -r * 0.11, -r * 0.57);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } // Helper: Faceted Diamond-Hexagonal Gold Moroccan Fanous Lantern
      function drawFanousLantern(lx, ly, lrot, glowAlpha = 0.55) {
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(lrot); // Soft warm radial golden lantern glow halo
        if (glowAlpha > 0.02) {
          const pulseR = r * 0.68 * (1.0 + (tNow > 0 ? Math.sin(tNow * 6.5) * 0.08 : 0));
          const glow = ctx.createRadialGradient(0, r * 0.34, 2, 0, r * 0.34, pulseR);
          glow.addColorStop(0.0, `rgba(254, 240, 138, ${glowAlpha})`);
          glow.addColorStop(0.55, `rgba(250, 204, 21, ${glowAlpha * 0.45})`);
          glow.addColorStop(1.0, 'rgba(250, 204, 21, 0)');
          ctx.fillStyle = glow;
          circ(ctx, 0, r * 0.34, pulseR);
        } // Top circular hanging ring at (0, 0)
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1.4;
        ctx.stroke(); // Faceted Hexagonal-Diamond Brass & Amber-Glass Lantern Body hanging from y=3.2 to y=r*0.76
        const topY = 3.4;
        const shY = r * 0.22;
        const botS = r * 0.52;
        const tipY = r * 0.76;
        const hw = r * 0.21;
        const mw = r * 0.09;
        function traceLantern(g) {
          g.beginPath();
          g.moveTo(0, topY);
          g.lineTo(hw, shY);
          g.lineTo(hw, botS);
          g.lineTo(0, tipY);
          g.lineTo(-hw, botS);
          g.lineTo(-hw, shY);
          g.closePath();
        }
        ctx.save();
        traceLantern(ctx);
        const lanGrad = ctx.createRadialGradient(0, (shY + botS) * 0.5, 1, 0, (shY + botS) * 0.5, r * 0.36);
        lanGrad.addColorStop(0.0, '#fef9c3');
        lanGrad.addColorStop(0.45, '#fde047');
        lanGrad.addColorStop(0.8, '#eab308');
        lanGrad.addColorStop(1.0, '#b45309');
        ctx.fillStyle = lanGrad;
        ctx.fill();
        ctx.restore();
        traceLantern(ctx);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ctx.lineJoin = 'round';
        ctx.stroke(); // Internal geometric brass ribs (top horizontal, bottom horizontal, & 2 vertical facet ribs)
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.15;
        ctx.beginPath(); // Upper shoulder horizontal bar
        ctx.moveTo(-hw, shY);
        ctx.lineTo(hw, shY); // Lower hip horizontal bar
        ctx.moveTo(-hw, botS);
        ctx.lineTo(hw, botS); // Left inner vertical facet rib from top peak to bottom tip
        ctx.moveTo(0, topY);
        ctx.lineTo(-mw, shY);
        ctx.lineTo(-mw, botS);
        ctx.lineTo(0, tipY); // Right inner vertical facet rib from top peak to bottom tip
        ctx.moveTo(0, topY);
        ctx.lineTo(mw, shY);
        ctx.lineTo(mw, botS);
        ctx.lineTo(0, tipY);
        ctx.stroke();
        ctx.restore();
      } // Helper: Lush Black Moroccan Handlebar Mustache
      function drawEggplantMustache(mx, my, mrot, style = 'idle') {
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(mrot);
        ctx.fillStyle = '#18181b';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.25;
        ctx.lineJoin = 'round';
        if (style === 'near') {
          // Bristling spiky ends in Pose 2 Alert
          ctx.beginPath();
          ctx.moveTo(0, -1.8);
          ctx.bezierCurveTo(-r * 0.14, -4.8, -r * 0.34, -2.5, -r * 0.5, -0.5);
          ctx.lineTo(-r * 0.42, 0.8);
          ctx.lineTo(-r * 0.52, 2.2);
          ctx.lineTo(-r * 0.38, 2.8);
          ctx.lineTo(-r * 0.44, 4.2);
          ctx.bezierCurveTo(-r * 0.26, 4.5, -r * 0.12, 2.2, 0, 0.5);
          ctx.bezierCurveTo(r * 0.12, 2.2, r * 0.26, 4.5, r * 0.44, 3.8);
          ctx.lineTo(r * 0.38, 2.2);
          ctx.lineTo(r * 0.54, 1.4);
          ctx.lineTo(r * 0.42, 0.2);
          ctx.lineTo(r * 0.52, -1.4);
          ctx.bezierCurveTo(r * 0.34, -2.8, r * 0.14, -4.8, 0, -1.8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (style === 'gag') {
          // Wavy frazzled asymmetric handlebar in Pose 3 Hit
          ctx.beginPath();
          ctx.moveTo(0, -1.2);
          ctx.bezierCurveTo(-r * 0.14, -4.2, -r * 0.3, 3.2, -r * 0.44, 2.2);
          ctx.bezierCurveTo(-r * 0.52, 1.4, -r * 0.54, -0.8, -r * 0.62, 0.4);
          ctx.bezierCurveTo(-r * 0.5, 4.8, -r * 0.26, 5.2, -r * 0.14, 1.8);
          ctx.quadraticCurveTo(0, 0.0, r * 0.14, 1.5);
          ctx.bezierCurveTo(r * 0.28, 3.8, r * 0.48, 2.8, r * 0.58, -1.8);
          ctx.bezierCurveTo(r * 0.5, -2.4, r * 0.44, 0.2, r * 0.34, -0.6);
          ctx.bezierCurveTo(r * 0.22, -2.8, r * 0.1, -3.8, 0, -1.2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          // Classic debonair curled-tip handlebar mustache in Pose 1 Idle
          ctx.beginPath();
          ctx.moveTo(0, -1.8);
          ctx.bezierCurveTo(-r * 0.14, -4.6, -r * 0.34, -0.8, -r * 0.46, 0.4);
          ctx.bezierCurveTo(-r * 0.56, 1.2, -r * 0.58, -2.2, -r * 0.48, -2.4);
          ctx.bezierCurveTo(-r * 0.64, -1.8, -r * 0.62, 3.6, -r * 0.38, 3.8);
          ctx.bezierCurveTo(-r * 0.22, 4.0, -r * 0.1, 2.2, 0, 0.6);
          ctx.bezierCurveTo(r * 0.1, 2.2, r * 0.22, 4.0, r * 0.38, 3.8);
          ctx.bezierCurveTo(r * 0.62, 3.6, r * 0.64, -1.8, r * 0.48, -2.4);
          ctx.bezierCurveTo(r * 0.58, -2.2, r * 0.56, 1.2, r * 0.46, 0.4);
          ctx.bezierCurveTo(r * 0.34, -0.8, r * 0.14, -4.6, 0, -1.8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      } // 1. Tall Pear-Shaped Royal-Purple Aubergine Body
      function traceEggplantBody(g) {
        g.beginPath();
        g.moveTo(0, -r * 1.44);
        g.bezierCurveTo(r * 0.34, -r * 1.44, r * 0.38, -r * 1.04, r * 0.44, -r * 0.72);
        g.bezierCurveTo(r * 0.54, -r * 0.36, r * 0.58, -r * 0.04, r * 0.36, r * 0.08);
        g.quadraticCurveTo(0, r * 0.14, -r * 0.38, r * 0.08);
        g.bezierCurveTo(-r * 0.6, -r * 0.06, -r * 0.58, -r * 0.48, -r * 0.52, -r * 0.88);
        g.bezierCurveTo(-r * 0.46, -r * 1.24, -r * 0.28, -r * 1.44, 0, -r * 1.44);
        g.closePath();
      } // Exposed purple/green eggplant stem stub at crown in Pose 3 when Tagine hat flies off!
      if (isGag) {
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.02, -r * 1.42);
        ctx.quadraticCurveTo(r * 0.04, -r * 1.56, r * 0.09, -r * 1.62);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      traceEggplantBody(ctx);
      const epGrad = ctx.createRadialGradient(r * 0.08, -r * 0.68, 2, 0, -r * 0.62, r * 0.96);
      epGrad.addColorStop(0.0, isGag ? '#a855f7' : '#9333ea');
      epGrad.addColorStop(0.6, '#6b21a8');
      epGrad.addColorStop(1.0, '#3b0764');
      ctx.fillStyle = epGrad;
      ctx.fill();
      ctx.clip(); // Deep plum shadow crescent along left flank & base
      ctx.fillStyle = 'rgba(28, 7, 50, 0.38)';
      ctx.beginPath();
      ctx.moveTo(-r * 0.34, -r * 1.42);
      ctx.bezierCurveTo(-r * 0.44, -r * 0.78, -r * 0.36, -r * 0.12, r * 0.42, -r * 0.02);
      ctx.lineTo(r * 0.45, r * 0.2);
      ctx.lineTo(-r * 0.68, r * 0.2);
      ctx.lineTo(-r * 0.68, -r * 1.44);
      ctx.closePath();
      ctx.fill(); // Signature Glossy Lavender Specular Highlights on Right Flank (dot + curved pill strip)
      ctx.fillStyle = 'rgba(233, 213, 255, 0.48)';
      if (isGag) {
        ell(ctx, r * 0.2, -r * 1.24, 2.2, 4.0, -0.35);
      }
      circ(ctx, r * 0.3, -r * 0.56, 2.1);
      ctx.strokeStyle = 'rgba(233, 213, 255, 0.48)';
      ctx.lineWidth = 3.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(r * 0.36, -r * 0.42);
      ctx.quadraticCurveTo(r * 0.44, -r * 0.24, r * 0.38, -r * 0.12);
      ctx.stroke();
      ctx.restore();
      traceEggplantBody(ctx);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.65;
      ctx.lineJoin = 'round';
      ctx.stroke(); // 2. Facial Expression, Mustache, Arms & Fanous Lantern per Pose
      const eyeY = -r * 0.96;
      if (!isNear && !isGag) {
        // ======================================================================
        // POSE 1: IDLE (DEBONAIR HALF-LIDDED EYES, MUSTACHE TWIRL, GLOWING LANTERN)
        // ======================================================================
        // Conical Terracotta Tagine Hat resting on crown
        const hatRock = tNow > 0 ? Math.sin(tNow * 3.5) * 0.025 : 0;
        drawTagineHat(-r * 0.02, -r * 1.3, -0.05 + hatRock, false); // Half-lidded debonair eyes looking right
        for (const [ex, ey] of [
          [-r * 0.1, eyeY],
          [r * 0.22, eyeY - 0.6],
        ]) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.arc(ex, ey, 3.3, 0, Math.PI, false);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = INK;
          circ(ctx, ex + 0.8 + px * 0.25, ey + 1.4 + py * 0.15, 1.35);
          ctx.fillStyle = '#ffffff';
          circ(ctx, ex + 0.3, ey + 1.0, 0.48); // Heavy upper eyelid bar
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.65;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(ex - 3.8, ey);
          ctx.lineTo(ex + 3.8, ey);
          ctx.stroke();
        } // Cocked eyebrows (left flat, right arched)
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.75;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.24, eyeY - 4.2);
        ctx.quadraticCurveTo(-r * 0.1, eyeY - 3.6, 0, eyeY - 4.4);
        ctx.moveTo(r * 0.14, eyeY - 5.2);
        ctx.quadraticCurveTo(r * 0.24, eyeY - 6.8, r * 0.34, eyeY - 4.8);
        ctx.stroke(); // Debonair smirk & chin dimple under mustache
        ctx.lineWidth = 1.35;
        ctx.beginPath();
        ctx.moveTo(-r * 0.04, eyeY + 11.2);
        ctx.quadraticCurveTo(r * 0.06, eyeY + 12.6, r * 0.16, eyeY + 10.6);
        ctx.moveTo(r * 0.02, eyeY + 14.0);
        ctx.quadraticCurveTo(r * 0.06, eyeY + 14.6, r * 0.1, eyeY + 14.0);
        ctx.stroke(); // Lush Black Handlebar Mustache
        const twirlTwitch = tNow > 0 ? Math.sin(tNow * 5.2) * 0.03 : 0;
        drawEggplantMustache(r * 0.06, eyeY + 6.4, twirlTwitch, 'idle'); // Left Arm bent upward with 2 fingers daintily twirling the left mustache tip!
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.48, -r * 0.56);
        ctx.bezierCurveTo(-r * 0.44, -r * 0.4, -r * 0.3, -r * 0.42, -r * 0.34, -r * 0.68);
        ctx.stroke(); // Dainty pinched fingers at (-r*0.36, -r*0.72)
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(-r * 0.38, -r * 0.72, 2.8, 0, Math.PI * 1.7);
        ctx.moveTo(-r * 0.42, -r * 0.76);
        ctx.lineTo(-r * 0.48, -r * 0.8);
        ctx.moveTo(-r * 0.36, -r * 0.78);
        ctx.lineTo(-r * 0.4, -r * 0.84);
        ctx.stroke();
        ctx.restore(); // Right Arm extended out holding the glowing Fanous Lantern!
        const lanSwing = tNow > 0 ? Math.sin(tNow * 3.2) * 0.06 : 0;
        const handX = r * 0.8;
        const handY = -r * 0.86;
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.36, -r * 0.68);
        ctx.quadraticCurveTo(r * 0.58, -r * 0.68, handX, handY);
        ctx.stroke(); // Hand gripping lantern ring
        ctx.fillStyle = INK;
        circ(ctx, handX, handY, 2.6);
        ctx.restore();
        drawFanousLantern(handX, handY + 2.5, lanSwing, 0.65);
      } else if (isNear) {
        // ======================================================================
        // POSE 2: CURSOR-NEAR ALERT (WIDE SHOCKED EYES, SWEAT DROP, CLUTCHED LANTERN)
        // ======================================================================
        // Conical Tagine Hat pulled slightly lower on brow
        drawTagineHat(-r * 0.01, -r * 1.24, -0.02, false); // Wide round white shocked eyes + tiny pupils
        for (const [ex, ey, er] of [
          [-r * 0.08, eyeY + 1.0, 5.2],
          [r * 0.24, eyeY + 0.8, 4.8],
        ]) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.5;
          circ(ctx, ex, ey, er);
          ctx.stroke();
          ctx.fillStyle = INK;
          circ(ctx, ex + 0.6 + px * 0.4, ey + py * 0.3, 1.35);
        } // Under-eye panic crease
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(-r * 0.08, eyeY + 1.0, 6.2, 0.25 * Math.PI, 0.75 * Math.PI);
        ctx.stroke(); // Worried furrowed eyebrows (`/ \`)
        ctx.lineWidth = 1.9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.22, eyeY - 5.2);
        ctx.quadraticCurveTo(-r * 0.12, eyeY - 7.8, -r * 0.02, eyeY - 6.8);
        ctx.moveTo(r * 0.16, eyeY - 7.2);
        ctx.quadraticCurveTo(r * 0.26, eyeY - 7.8, r * 0.34, eyeY - 5.0);
        ctx.stroke(); // Open gasping mouth with pink tongue visible under mustache!
        const my = eyeY + 11.4;
        ctx.fillStyle = '#3b0808';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.35;
        ctx.beginPath();
        ctx.moveTo(-r * 0.02, my + 1.8);
        ctx.bezierCurveTo(-r * 0.04, my - 3.6, r * 0.22, my - 3.6, r * 0.2, my + 1.8);
        ctx.closePath();
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#f87171';
        ell(ctx, r * 0.06, my + 1.4, 3.2, 1.8, -0.2);
        ctx.restore();
        ctx.stroke(); // Bristling handlebar mustache
        drawEggplantMustache(r * 0.06, eyeY + 6.8, 0, 'near'); // Blue sweat drop on left temple
        drawSweatDrop(ctx, -r * 0.46, -r * 0.88, 0.9, 0.1, tNow); // Fanous Lantern pulled tightly against right side of belly!
        const lanTremor = tNow > 0 ? Math.sin(tNow * 26.0) * 0.06 : 0;
        drawFanousLantern(r * 0.46, -r * 0.62, 0.32 + lanTremor, 0.45); // Left & Right Arms clutching the lantern body defensively
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.22, -r * 0.48);
        ctx.quadraticCurveTo(-r * 0.12, -r * 0.3, r * 0.16, -r * 0.34);
        ctx.stroke();
        ctx.fillStyle = INK;
        circ(ctx, r * 0.18, -r * 0.34, 2.5);
        circ(ctx, r * 0.5, -r * 0.28, 2.5);
        ctx.restore();
      } else {
        // ======================================================================
        // POSE 3: ON-HIT GAG!
        // Airborne Conical Tagine Hat + 2 Billowing Steam Clouds + `@ @` Dizzy
        // Spiral Eyes + Wavy Mustache + Swinging Lantern with Gold Sparks + "WAILI!"
        // ======================================================================
        const hatFloat = tNow > 0 ? Math.sin(tNow * 15.0) * 2.2 : 0; // 1. Airborne Conical Tagine Lid Hat launched high to upper-left!
        drawTagineHat(-r * 0.26, -r * 1.62 + hatFloat, -0.62, true); // Launch motion lines between head crown and airborne Tagine lid
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.14, -r * 1.48);
        ctx.lineTo(-r * 0.2, -r * 1.6);
        ctx.moveTo(-r * 0.08, -r * 1.46);
        ctx.lineTo(-r * 0.16, -r * 1.66);
        ctx.moveTo(-r * 0.02, -r * 1.48);
        ctx.lineTo(-r * 0.06, -r * 1.56);
        ctx.stroke(); // 2. Two Billowing White Steam Puffs chugging from the hot Zaalouk Eggplant!
        const steamDrift = tNow > 0 ? ((tNow * 2.2) % 1.0) * 2.5 : 0;
        const drawSteamCloud = (sx, sy, srot, sc) => {
          ctx.save();
          ctx.translate(sx, sy - steamDrift);
          ctx.rotate(srot);
          ctx.scale(sc, sc);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 1.35;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(-2.2, 4.5);
          ctx.lineTo(-3.2, 0.5);
          ctx.arc(-3.5, -2.5, 3.2, Math.PI * 0.75, Math.PI * 1.85);
          ctx.arc(0.5, -4.5, 3.6, Math.PI * 1.15, Math.PI * 0.15);
          ctx.arc(3.8, -1.5, 3.0, -Math.PI * 0.25, Math.PI * 0.65);
          ctx.lineTo(2.0, 4.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke(); // Steam jet lines inside neck
          ctx.beginPath();
          ctx.moveTo(-0.8, 5.2);
          ctx.lineTo(-0.4, 0.8);
          ctx.moveTo(0.8, 5.2);
          ctx.lineTo(1.0, 1.5);
          ctx.stroke();
          ctx.restore();
        };
        drawSteamCloud(-r * 0.56, -r * 1.18, -1.15, 0.86);
        drawSteamCloud(r * 0.28, -r * 1.48, 0.48, 1.05); // 3. Concentric `@ @` Dizzy Spiral Eyes (spinning continuously at 60fps!)
        const spiralSpin = tNow > 0 ? tNow * 10.0 : 0;
        for (const [dir, ex, ey] of [
          [-1, -r * 0.1, eyeY],
          [1, r * 0.2, eyeY],
        ]) {
          ctx.save();
          ctx.translate(ex, ey);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.45;
          ctx.lineCap = 'round';
          ctx.beginPath();
          for (let a = 0; a <= Math.PI * 4.4; a += 0.22) {
            const sr = (a / (Math.PI * 4.4)) * 5.2;
            const sx = Math.cos(a * dir + spiralSpin * dir) * sr;
            const sy = Math.sin(a * dir + spiralSpin * dir) * sr;
            if (a === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          ctx.stroke();
          ctx.restore();
        } // Open dazed wailing mouth with tongue
        const my = eyeY + 11.4;
        ctx.fillStyle = '#3b0808';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.35;
        ctx.beginPath();
        ctx.moveTo(-r * 0.04, my + 2.0);
        ctx.bezierCurveTo(-r * 0.04, my - 3.6, r * 0.22, my - 3.6, r * 0.2, my + 2.0);
        ctx.closePath();
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#f87171';
        ell(ctx, r * 0.06, my + 1.6, 3.0, 1.6);
        ctx.restore();
        ctx.stroke(); // Frazzled wavy handlebar mustache
        drawEggplantMustache(r * 0.06, eyeY + 6.6, 0, 'gag'); // 4. Left Arm flung out to the left + Right Arm swinging the Fanous Lantern wildly!
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r * 0.58);
        ctx.quadraticCurveTo(-r * 0.68, -r * 0.62, -r * 0.78, -r * 0.44);
        ctx.stroke();
        ctx.fillStyle = INK;
        circ(ctx, -r * 0.78, -r * 0.44, 2.5); // Motion arc above left arm
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.arc(-r * 0.66, -r * 0.54, 5.5, Math.PI * 1.15, Math.PI * 1.75);
        ctx.stroke();
        ctx.restore();
        const wildSwing = -0.32 + (tNow > 0 ? Math.sin(tNow * 20.0) * 0.14 : 0);
        const rHandX = r * 0.66;
        const rHandY = -r * 0.68;
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.4, -r * 0.58);
        ctx.quadraticCurveTo(r * 0.54, -r * 0.56, rHandX, rHandY);
        ctx.stroke();
        ctx.fillStyle = INK;
        circ(ctx, rHandX, rHandY, 2.6);
        ctx.restore();
        drawFanousLantern(rHandX, rHandY + 2.0, wildSwing, 0.55); // Motion lines & 2 Golden 4-Point Spark Stars bursting around the swinging lantern!
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.arc(r * 0.92, -r * 0.24, 14.0, -0.35, 0.25);
        ctx.moveTo(r * 0.72, r * 0.04);
        ctx.quadraticCurveTo(r * 0.8, r * 0.1, r * 0.88, r * 0.1);
        ctx.stroke();
        for (const [sx, sy, sr] of [
          [r * 0.54, -r * 0.5, 2.6],
          [r * 0.98, -r * 0.62, 3.8],
        ]) {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(tNow > 0 ? tNow * 6.0 : 0.2);
          ctx.fillStyle = '#facc15';
          ctx.strokeStyle = '#b45309';
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4;
            const rad = i % 2 === 0 ? sr : sr * 0.38;
            ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        } // 5. Spiky Comic "WAILI!" Explosion Bubble at Upper-Right
        drawSpikyExplosionBubble(
          ctx,
          r * 1.0,
          -r * 1.24,
          r * 0.56,
          r * 0.3,
          r * 0.48,
          -r * 0.86,
          'WAILI!',
          5.8,
          tNow,
          clamp01(gagEased),
        );
      }
      ctx.restore();
      if (drawMound) {
        drawSculptedDirtMound(ctx, r * 0.96, true, tNow, false);
      }
      ctx.restore();
    } // ==========================================================================
    // 3. BELDI GREEN OLIVE (`olive`, base r = 25)
    //    Pimento-Stuffed Moroccan Green Olive — Saharan Gnawa Drummer
    // ==========================================================================
    function drawBeldiOlive(ctx, r = 25, state = 'idle', tNow = 0, px = 0, py = 0, drawMound = true) {
      const { wIdle, wNear, wGag, alertP, gagP } = resolvePoseWeights(state, tNow);
      const isNear = wNear >= 0.5 && wGag < 0.5;
      const isGag = wGag >= 0.5;
      const gagEased = easeOutBack(clamp01(gagP));
      ctx.save(); // Continuous 60fps groove bounce / alert crouch / hit recoil
      const breatheY = wIdle * (tNow > 0 ? Math.sin(tNow * 4.4) * 0.9 : 0);
      const squatY = wNear * (1.8 + (tNow > 0 ? Math.sin(tNow * 18.0) * 0.45 : 0));
      const jitterX =
        wNear * (tNow > 0 ? Math.sin(tNow * 32.0) * 0.55 : 0) + wGag * (tNow > 0 ? Math.sin(tNow * 26.0) * 0.65 : 0);
      ctx.save();
      ctx.translate(jitterX, breatheY + squatY); // Helper: Multi-Fold Royal-Blue Saharan Tuareg Turban (`Tagelmust`)
      function drawSaharanTurban(tx, ty, trot, showUnderside = false) {
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(trot);
        function traceTurban(g) {
          g.beginPath();
          g.moveTo(-r * 0.64, r * 0.14);
          g.bezierCurveTo(-r * 0.74, -r * 0.08, -r * 0.56, -r * 0.44, -r * 0.08, -r * 0.48);
          g.bezierCurveTo(r * 0.44, -r * 0.5, r * 0.7, -r * 0.22, r * 0.66, r * 0.08);
          g.bezierCurveTo(r * 0.62, r * 0.22, r * 0.48, r * 0.1, r * 0.12, -r * 0.06);
          g.bezierCurveTo(-r * 0.22, r * 0.04, -r * 0.48, r * 0.22, -r * 0.64, r * 0.14);
          g.closePath();
        }
        if (showUnderside) {
          // Dark indigo underside cavity when turban is launched in Pose 3!
          ctx.fillStyle = '#1e3a8a';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.5;
          ell(ctx, 0, r * 0.06, r * 0.58, r * 0.18, -0.08);
          ctx.stroke();
        }
        ctx.save();
        traceTurban(ctx);
        const tbGrad = ctx.createLinearGradient(-r * 0.65, -r * 0.45, r * 0.65, r * 0.15);
        tbGrad.addColorStop(0.0, '#3b82f6');
        tbGrad.addColorStop(0.55, '#2563eb');
        tbGrad.addColorStop(1.0, '#1d4ed8');
        ctx.fillStyle = tbGrad;
        ctx.fill();
        ctx.clip(); // Overlapping Saharan cloth fold lines inside turban
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ctx.lineCap = 'round';
        ctx.beginPath(); // Upper diagonal cloth wrap
        ctx.moveTo(-r * 0.58, -r * 0.08);
        ctx.quadraticCurveTo(-r * 0.08, -r * 0.36, r * 0.52, -r * 0.24); // Middle diagonal cloth wrap
        ctx.moveTo(-r * 0.64, r * 0.06);
        ctx.quadraticCurveTo(0, -r * 0.22, r * 0.64, -r * 0.06); // Right overlapping V-tuck fold
        ctx.moveTo(0, -r * 0.12);
        ctx.quadraticCurveTo(r * 0.36, -r * 0.02, r * 0.62, r * 0.1);
        ctx.stroke();
        ctx.restore();
        traceTurban(ctx);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      } // Helper: Round Gold-Rimmed Moroccan Sunglasses
      function drawGoldRoundShades(gx, gy, grot, openTop = false) {
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(grot); // Left & Right gold temple arms
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 1.85;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.35, -0.5);
        ctx.quadraticCurveTo(-r * 0.5, -0.8, -r * 0.58, 1.8);
        if (openTop) {
          ctx.moveTo(r * 0.43, -0.5);
          ctx.lineTo(r * 0.56, -4.2);
        }
        ctx.stroke(); // Gold nose bridge
        ctx.beginPath();
        ctx.moveTo(-2.4, -0.5);
        ctx.quadraticCurveTo(r * 0.04, -2.2, 4.2, -0.5);
        ctx.stroke(); // Left & Right Lenses
        for (const [lx, ly] of [
          [-r * 0.16, 0],
          [r * 0.24, -0.4],
        ]) {
          ctx.save();
          ctx.beginPath();
          if (openTop) {
            // Lowered half-frame in Pose 2 Alert so wide eyes peek over the top!
            ctx.arc(lx, ly, 4.6, -0.05 * Math.PI, 1.05 * Math.PI, false);
            ctx.closePath();
          } else {
            ctx.arc(lx, ly, 4.8, 0, Math.PI * 2);
          }
          ctx.fillStyle = '#2b1708';
          ctx.fill();
          ctx.save();
          ctx.clip(); // Diagonal white lens reflection slash
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(lx - 1.5, ly - 5.0);
          ctx.lineTo(lx - 3.8, ly + 5.0);
          ctx.stroke();
          ctx.restore(); // Re-trace the exact lens boundary for the gold rim so ctx.stroke() never re-strokes the reflection slash!
          ctx.beginPath();
          if (openTop) {
            ctx.arc(lx, ly, 4.6, -0.05 * Math.PI, 1.05 * Math.PI, false);
            ctx.closePath();
          } else {
            ctx.arc(lx, ly, 4.8, 0, Math.PI * 2);
          }
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 1.75;
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
      } // Helper: Round Wooden Moroccan Bendir Frame Drum with Brass Zils
      function drawBendirDrum(dx, dy, drot, rx, ry, rimOffset = 4.2) {
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(drot); // Brass jingle zils around the wooden frame rim
        ctx.fillStyle = '#eab308';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        for (const ang of [-1.1, -0.35, 0.45, 1.15, 2.4]) {
          const zx = Math.cos(ang) * (rx + rimOffset * 0.65);
          const zy = Math.sin(ang) * (ry * 1.02);
          ell(ctx, zx, zy, 3.0, 2.2, ang);
          ctx.stroke();
        } // Deep wooden frame rim (offset to the right/bottom)
        ctx.fillStyle = '#854d0e';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.55;
        ell(ctx, rimOffset, 1.2, rx, ry);
        ctx.stroke(); // Stretched warm tan goatskin drumhead
        const headGrad = ctx.createRadialGradient(-2, -3, 1, 0, 0, Math.max(rx, ry));
        headGrad.addColorStop(0.0, '#f5d7b0');
        headGrad.addColorStop(0.7, '#e2b887');
        headGrad.addColorStop(1.0, '#c6935b');
        ctx.fillStyle = headGrad;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.55;
        ell(ctx, 0, 0, rx, ry);
        ctx.stroke();
        ctx.restore();
      } // 1. Plump Oval Beldi Green Olive Body
      function traceOliveBody(g) {
        g.beginPath();
        g.ellipse(0, -r * 0.68, r * 0.68, r * 0.76, 0, 0, Math.PI * 2);
      }
      ctx.save();
      traceOliveBody(ctx);
      const olGrad = ctx.createRadialGradient(r * 0.12, -r * 0.82, 2, 0, -r * 0.68, r * 0.84);
      olGrad.addColorStop(0.0, '#b5cc4e');
      olGrad.addColorStop(0.58, '#8da832');
      olGrad.addColorStop(1.0, '#5a6e18');
      ctx.fillStyle = olGrad;
      ctx.fill();
      ctx.clip(); // Dark-olive shadow crescent along left & bottom edge
      ctx.fillStyle = 'rgba(54, 68, 12, 0.34)';
      ctx.beginPath();
      ctx.moveTo(-r * 0.46, -r * 1.38);
      ctx.bezierCurveTo(-r * 0.56, -r * 0.72, -r * 0.38, -r * 0.08, r * 0.48, -r * 0.02);
      ctx.lineTo(r * 0.55, r * 0.2);
      ctx.lineTo(-r * 0.78, r * 0.2);
      ctx.lineTo(-r * 0.78, -r * 1.44);
      ctx.closePath();
      ctx.fill(); // Glossy pale-green highlight on upper-left shoulder
      ctx.fillStyle = 'rgba(236, 252, 203, 0.52)';
      ell(ctx, -r * 0.42, -r * 1.02, 2.0, 4.2, 0.35);
      circ(ctx, -r * 0.5, -r * 0.8, 1.3);
      ctx.restore();
      traceOliveBody(ctx);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.65;
      ctx.stroke(); // 2. Top Pimento Cavity & Stuffing + Turban / Sunglasses / Bendir Drum per Pose
      const eyeY = -r * 0.78;
      if (!isNear && !isGag) {
        // ======================================================================
        // POSE 1: IDLE (COOL TURBAN, GOLD SUNGLASSES, TAPPING BENDIR DRUM)
        // ======================================================================
        // Red Pimento Crown peeking out under the front of the blue turban
        ctx.fillStyle = '#dc2626';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.35;
        ell(ctx, r * 0.02, -r * 1.18, r * 0.22, r * 0.09, -0.05);
        ctx.stroke(); // Royal-Blue Saharan Turban resting on head
        const turbBob = tNow > 0 ? Math.sin(tNow * 4.4) * 0.025 : 0;
        drawSaharanTurban(-r * 0.04, -r * 1.24, -0.1 + turbBob, false); // Arched eyebrow above right lens
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.75;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.14, eyeY - 6.6);
        ctx.quadraticCurveTo(r * 0.26, eyeY - 8.2, r * 0.38, eyeY - 5.8);
        ctx.stroke(); // Cool Round Gold-Rimmed Sunglasses
        drawGoldRoundShades(r * 0.02 + px * 0.2, eyeY + py * 0.15, -0.03, false); // Confident smirk & chin dimple
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.55;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.06, eyeY + 6.4);
        ctx.quadraticCurveTo(r * 0.08, eyeY + 9.2, r * 0.24, eyeY + 5.6);
        ctx.stroke();
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(r * 0.04, eyeY + 10.2);
        ctx.quadraticCurveTo(r * 0.1, eyeY + 11.0, r * 0.16, eyeY + 10.0);
        ctx.stroke(); // Round Bendir Frame Drum held on the right side (`x = r*0.54, y = -r*0.44`)
        const drumBeat = tNow > 0 ? Math.abs(Math.sin(tNow * 7.5)) * 1.2 : 0;
        drawBendirDrum(r * 0.54, -r * 0.44 + drumBeat * 0.4, 0.22, r * 0.26, r * 0.36, 4.4); // Right hand fingers wrapping around outer edge of Bendir drum
        ctx.fillStyle = '#8da832';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ell(ctx, r * 0.84, -r * 0.36, 3.2, 2.2, 0.2);
        ctx.stroke();
        ell(ctx, r * 0.82, -r * 0.26, 3.0, 2.0, 0.2);
        ctx.stroke(); // Left Olive Arm rhythmically tapping the center of the Bendir drumhead!
        const tapOffset = tNow > 0 ? Math.sin(tNow * 7.5) * 2.2 : 0;
        ctx.save();
        ctx.fillStyle = '#8da832';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.22, -r * 0.46);
        ctx.bezierCurveTo(-r * 0.12, -r * 0.22, r * 0.16, -r * 0.24, r * 0.32 + tapOffset * 0.4, -r * 0.4);
        ctx.bezierCurveTo(
          r * 0.42 + tapOffset * 0.4,
          -r * 0.44,
          r * 0.4 + tapOffset * 0.4,
          -r * 0.56,
          r * 0.26 + tapOffset * 0.4,
          -r * 0.52,
        );
        ctx.bezierCurveTo(r * 0.1, -r * 0.34, -r * 0.08, -r * 0.34, -r * 0.14, -r * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Acoustic rhythm vibration arcs around the tapping hand & drumhead
        ctx.lineWidth = 1.15;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(r * 0.2, -r * 0.54, 3.8, -Math.PI * 0.7, -Math.PI * 0.15);
        ctx.arc(r * 0.44, -r * 0.38, 4.2, -0.35, 0.45);
        ctx.stroke();
        ctx.restore();
      } else if (isNear) {
        // ======================================================================
        // POSE 2: CURSOR-NEAR ALERT!
        // Lowered Gold Sunglasses with Wide Panicked Eyes Peeking Over Top,
        // Twin Sweat Drops, and Both Hands Gripping the Bendir Drum as a Shield!
        // ======================================================================
        // Red Pimento Crown peeking under turban
        ctx.fillStyle = '#dc2626';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.35;
        ell(ctx, r * 0.02, -r * 1.1, r * 0.22, r * 0.09, -0.05);
        ctx.stroke(); // Royal-Blue Saharan Turban
        drawSaharanTurban(-r * 0.04, -r * 1.16, -0.08, false); // Wide White Panicked Eyes peeking ABOVE the slipped sunglasses!
        for (const [ex, ey, er] of [
          [-r * 0.12, eyeY + 2.0, 4.8],
          [r * 0.26, eyeY + 1.4, 4.6],
        ]) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.45;
          circ(ctx, ex, ey, er);
          ctx.stroke();
          ctx.fillStyle = INK;
          circ(ctx, ex + 0.6 + px * 0.35, ey - 0.6 + py * 0.25, 1.3);
        } // Worried eyebrows (`/ \`)
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.75;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.24, eyeY - 4.0);
        ctx.quadraticCurveTo(-r * 0.14, eyeY - 6.2, -r * 0.06, eyeY - 5.2);
        ctx.moveTo(r * 0.18, eyeY - 5.6);
        ctx.quadraticCurveTo(r * 0.28, eyeY - 6.4, r * 0.36, eyeY - 4.0);
        ctx.stroke(); // Open gasping mouth between the lenses
        ctx.fillStyle = '#2b1708';
        ell(ctx, r * 0.1, eyeY + 6.4, 2.8, 2.2); // Gold-Rimmed Sunglasses slipped low down the nose bridge!
        drawGoldRoundShades(r * 0.02, eyeY + 4.8, -0.06, true); // Twin glossy blue sweat drops flying off the right temple!
        drawSweatDrop(ctx, r * 0.66, -r * 0.96, 0.72, 1.05, tNow);
        drawSweatDrop(ctx, r * 0.68, -r * 0.74, 0.58, 1.35, tNow); // Bendir Frame Drum held front-and-center like a defensive buckler shield!
        const shieldShake = tNow > 0 ? Math.sin(tNow * 28.0) * 0.5 : 0;
        drawBendirDrum(r * 0.28, -r * 0.28 + shieldShake, 0.05, r * 0.34, r * 0.34, -3.2); // Left & Right Olive Arms gripping both sides of the Bendir shield
        ctx.save();
        ctx.fillStyle = '#8da832';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.34, -r * 0.42);
        ctx.bezierCurveTo(-r * 0.32, -r * 0.18, -r * 0.12, -r * 0.18, -r * 0.02, -r * 0.24);
        ctx.lineTo(-r * 0.02, -r * 0.34);
        ctx.bezierCurveTo(-r * 0.14, -r * 0.28, -r * 0.22, -r * 0.3, -r * 0.24, -r * 0.44);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        for (const fy of [-r * 0.34, -r * 0.28, -r * 0.22]) {
          ell(ctx, -r * 0.01, fy + shieldShake, 3.0, 1.6, -0.1);
          ctx.stroke();
        }
        for (const fy of [-r * 0.32, -r * 0.25]) {
          ell(ctx, r * 0.64, fy + shieldShake, 3.0, 1.6, 0.1);
          ctx.stroke();
        }
        ctx.restore();
      } else {
        // ======================================================================
        // POSE 3: ON-HIT GAG!
        // Exposed Olive Cavity + Popping Red Pimento Cork + Airborne Blue Turban
        // + Flying Gold Sunglasses + Bouncing Bendir Drum + `> <` Wince + "YALLAH!"
        // ======================================================================
        const popBounce = tNow > 0 ? Math.sin(tNow * 16.0) * 2.0 : 0; // 1. Exposed Red-Rimmed Olive Crown Cavity at `(0, -r * 1.24)`
        ctx.fillStyle = '#dc2626';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ell(ctx, 0, -r * 1.24, r * 0.24, r * 0.1);
        ctx.stroke();
        ctx.fillStyle = '#991b1b';
        ell(ctx, 0, -r * 1.23, r * 0.14, r * 0.05); // Vertical pop lines shooting out of the olive crown cavity!
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.24);
        ctx.quadraticCurveTo(r * 0.02, -r * 1.42, r * 0.06, -r * 1.54);
        ctx.moveTo(-r * 0.05, -r * 1.44);
        ctx.lineTo(-r * 0.04, -r * 1.52);
        ctx.moveTo(r * 0.1, -r * 1.42);
        ctx.lineTo(r * 0.12, -r * 1.5);
        ctx.stroke(); // 2. Popping Cylindrical Red Pimento Stuffing Cork at `(r * 0.12, -r * 1.68)`!
        ctx.save();
        ctx.translate(r * 0.12, -r * 1.68 + popBounce * 0.8);
        ctx.rotate(0.28);
        ctx.fillStyle = '#dc2626';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.13, -r * 0.12);
        ctx.quadraticCurveTo(0, -r * 0.17, r * 0.13, -r * 0.12);
        ctx.lineTo(r * 0.1, r * 0.12);
        ctx.quadraticCurveTo(0, r * 0.16, -r * 0.1, r * 0.12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Top surface of red pimento cylinder
        ctx.fillStyle = '#ef4444';
        ell(ctx, 0, -r * 0.12, r * 0.12, r * 0.04);
        ctx.stroke();
        ctx.restore(); // 3. Airborne Royal-Blue Saharan Turban flung high to Upper-Left!
        drawSaharanTurban(-r * 0.56, -r * 1.72 + popBounce, -0.78, true); // Launch motion arcs under airborne turban
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(-r * 0.24, -r * 1.38);
        ctx.quadraticCurveTo(-r * 0.34, -r * 1.5, -r * 0.44, -r * 1.58);
        ctx.moveTo(-r * 0.18, -r * 1.42);
        ctx.quadraticCurveTo(-r * 0.24, -r * 1.56, -r * 0.3, -r * 1.64);
        ctx.stroke(); // 4. Airborne Gold-Rimmed Sunglasses flying to Upper-Right!
        drawGoldRoundShades(r * 0.58, -r * 1.92 - popBounce * 0.7, 0.48, false);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(r * 0.24, -r * 1.46);
        ctx.quadraticCurveTo(r * 0.3, -r * 1.62, r * 0.38, -r * 1.74);
        ctx.moveTo(r * 0.32, -r * 1.52);
        ctx.quadraticCurveTo(r * 0.36, -r * 1.62, r * 0.42, -r * 1.68);
        ctx.stroke(); // 5. Tight `> <` Wince Eyes & Shouting Mouth with Pink Tongue on the Olive Body!
        drawChevronWinceEyes(ctx, -r * 0.14, r * 0.24, -r * 0.76, 5.2, 2.2, INK, 2.0, tNow);
        const my = -r * 0.56;
        ctx.fillStyle = '#3b0808';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-r * 0.08, my + 2.4);
        ctx.bezierCurveTo(-r * 0.1, my - 4.2, r * 0.2, my - 4.2, r * 0.18, my + 2.4);
        ctx.quadraticCurveTo(r * 0.05, my + 1.2, -r * 0.08, my + 2.4);
        ctx.closePath();
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#f87171';
        ell(ctx, 0, my + 1.8, 3.2, 1.8, -0.2);
        ctx.restore();
        ctx.stroke(); // Body shudder lines on left and right flanks
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(-r * 0.74, -r * 0.96);
        ctx.quadraticCurveTo(-r * 0.8, -r * 0.76, -r * 0.78, -r * 0.56);
        ctx.moveTo(-r * 0.84, -r * 0.84);
        ctx.quadraticCurveTo(-r * 0.88, -r * 0.72, -r * 0.86, -r * 0.62);
        ctx.moveTo(r * 0.76, -r * 0.68);
        ctx.quadraticCurveTo(r * 0.8, -r * 0.52, r * 0.76, -r * 0.36);
        ctx.stroke(); // 6. Yellow/Orange Impact Spikes & Flying Dirt Clods at Base + Bouncing Bendir Drum on Right!
        // Left impact burst + dirt clod
        ctx.fillStyle = '#fde047';
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.moveTo(-r * 0.72, -r * 0.14);
        ctx.lineTo(-r * 0.94, -r * 0.36);
        ctx.lineTo(-r * 0.82, -r * 0.24);
        ctx.lineTo(-r * 1.04, -r * 0.22);
        ctx.lineTo(-r * 0.84, -r * 0.12);
        ctx.lineTo(-r * 0.96, -r * 0.04);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Right impact spike
        ctx.beginPath();
        ctx.moveTo(r * 0.72, -r * 0.2);
        ctx.lineTo(r * 0.84, -r * 0.34);
        ctx.lineTo(r * 0.82, -r * 0.22);
        ctx.lineTo(r * 0.96, -r * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Flying brown dirt clods on left and right
        ctx.fillStyle = '#7c4d28';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.25;
        ell(ctx, -r * 1.06, -r * 0.36, 3.0, 2.2, -0.2);
        ctx.stroke();
        ell(ctx, r * 0.9, -r * 0.58, 2.8, 2.0, 0.3);
        ctx.stroke(); // Bendir Drum bouncing away to the right (`r * 1.22, -r * 0.40`)!
        drawBendirDrum(r * 1.22, -r * 0.4 + popBounce * 0.6, 0.38, r * 0.28, r * 0.36, 4.4);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(r * 0.88, -r * 0.14);
        ctx.lineTo(r * 1.04, -r * 0.22);
        ctx.moveTo(r * 0.92, -r * 0.06);
        ctx.lineTo(r * 1.08, -r * 0.16);
        ctx.stroke(); // 7. Spiky Comic "YALLAH!" Explosion Bubble at Upper-Right
        drawSpikyExplosionBubble(
          ctx,
          r * 1.04,
          -r * 1.28,
          r * 0.58,
          r * 0.3,
          r * 0.52,
          -r * 0.9,
          'YALLAH!',
          5.5,
          tNow,
          clamp01(gagEased),
        );
      }
      ctx.restore();
      if (drawMound) {
        drawSculptedDirtMound(ctx, r * 0.98, true, tNow, false);
      }
      ctx.restore();
    } // Unified dispatcher for `FarmScene.ts` (`window.DBD_CROP_RENDERER`)
    function drawMoroccoCharacter(ctx, type, r, state, tNow = 0, px = 0, py = 0, drawMound = false) {
      if (type === 'chickpea' || type === 'hummus_chickpea') {
        drawHummusChickpea(ctx, r, state, tNow, px, py, drawMound);
        return true;
      }
      if (type === 'eggplant' || type === 'zaalouk_eggplant') {
        drawZaaloukEggplant(ctx, r, state, tNow, px, py, drawMound);
        return true;
      }
      if (type === 'olive' || type === 'beldi_olive') {
        drawBeldiOlive(ctx, r, state, tNow, px, py, drawMound);
        return true;
      }
      return false;
    } // ==========================================================================
    // Continuous State-Cycling Showcase Renderer (`IDLE -> ALERT -> SLICE -> GAG -> IDLE`)
    // ==========================================================================
    function drawContinuousShowcaseCycle(ctx, type, r, tNow, scale = 2.8) {
      const cycleDur = 4.5;
      const phase = (((tNow % cycleDur) + cycleDur) % cycleDur) / cycleDur;
      let st = 'idle';
      let stLabel = '▶ 1. IDLE';
      let stColor = '#15803d';
      let scytheX = 68,
        scytheY = -78,
        scytheAng = -0.4,
        showScythe = false,
        slashAlpha = 0;
      let squashX = 1.0,
        squashY = 1.0;
      let blendState = { wIdle: 1, wNear: 0, wGag: 0, alertP: 0, gagP: 0 };
      if (phase < 0.26) {
        st = 'idle';
        stLabel = '▶ 1. IDLE';
        stColor = '#15803d';
        blendState = { wIdle: 1, wNear: 0, wGag: 0, alertP: 0, gagP: 0 };
      } else if (phase < 0.34) {
        const u = smoothstep(0.26, 0.34, phase);
        st = 'near';
        stLabel = '⚡ 1→2 ANTICIPATION';
        stColor = '#d97706';
        blendState = { wIdle: 1 - u, wNear: u, wGag: 0, alertP: u, gagP: 0 };
        showScythe = true;
        scytheX = lerp(64, 48, u);
        scytheY = lerp(-72, -62, u);
        scytheAng = lerp(-0.25, -0.38, u);
        squashY = 1.0 - Math.sin(u * Math.PI) * 0.08;
        squashX = 1.0 / Math.sqrt(squashY);
      } else if (phase < 0.6) {
        const p = (phase - 0.34) / 0.26;
        st = 'near';
        stLabel = '⚠️ 2. CURSOR-NEAR ALERT!';
        stColor = '#d97706';
        blendState = { wIdle: 0, wNear: 1, wGag: 0, alertP: 1, gagP: 0 };
        showScythe = true;
        scytheX = 48 - p * 26;
        scytheY = -62 + Math.sin(p * Math.PI * 2) * 5;
        scytheAng = -0.38 - p * 0.42;
      } else if (phase < 0.9) {
        const p = (phase - 0.6) / 0.3;
        const u = smoothstep(0, 0.16, p);
        st = 'gag';
        stLabel = '💥 3. ON-HIT GAG!';
        stColor = '#dc2626';
        blendState = { wIdle: 0, wNear: 1 - u, wGag: u, alertP: 1 - u, gagP: clamp01(p / 0.25) };
        if (p < 0.35) {
          showScythe = true;
          const sp = p / 0.35;
          scytheX = 22 - sp * 58;
          scytheY = -48 + sp * 22;
          scytheAng = -0.8 + sp * 2.2;
          slashAlpha = 1.0 - sp;
        }
        const damp = Math.exp(-p * 6.2) * Math.cos(p * 23.0);
        squashY = 1.0 - damp * 0.21;
        squashX = 1.0 / Math.sqrt(Math.max(0.55, squashY));
      } else {
        const u = smoothstep(0.9, 1.0, phase);
        st = 'idle';
        stLabel = '🔄 3→1 RECOVERING';
        stColor = '#15803d';
        blendState = { wIdle: u, wNear: 0, wGag: 1 - u, alertP: 0, gagP: 1 - u };
        squashY = 1.0 + Math.sin(u * Math.PI) * 0.06;
        squashX = 1.0 / Math.sqrt(squashY);
      }
      const px = showScythe ? Math.cos(Math.atan2(scytheY + 25, scytheX)) * 1.8 : Math.sin(tNow * 2.2) * 1.1;
      const py = showScythe ? Math.sin(Math.atan2(scytheY + 25, scytheX)) * 1.4 : Math.cos(tNow * 1.7) * 0.6;
      ctx.save();
      ctx.scale(scale * squashX, scale * squashY);
      drawMoroccoCharacter(ctx, type, r, blendState, tNow, px, py, true);
      if (slashAlpha > 0.02) {
        ctx.save();
        ctx.strokeStyle = `rgba(254, 240, 138, ${slashAlpha * 0.92})`;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, -r * 0.85, r * 1.35, -0.85, 0.65);
        ctx.stroke();
        ctx.restore();
      }
      if (showScythe) {
        ctx.save();
        ctx.translate(scytheX, scytheY);
        ctx.rotate(scytheAng);
        ctx.strokeStyle = '#1c1008';
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 14);
        ctx.lineTo(0, -10);
        ctx.stroke();
        ctx.strokeStyle = '#9a5b25';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = '#1c1008';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.quadraticCurveTo(-14, -12, -20, -2);
        ctx.quadraticCurveTo(-12, -6, 0, -5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      return { st, stLabel, stColor };
    }
    return {
      drawHummusChickpea,
      drawZaaloukEggplant,
      drawBeldiOlive,
      drawSculptedDirtMound,
      drawMoroccoCharacter,
      drawContinuousShowcaseCycle,
    };
  })();
  window.DBD_MOROCCO_TRIO_RENDERER =
    DBD_MOROCCO_TRIO_RENDERER; /* removed: window.DBD_MOROCCO_TRIO_SOURCE_CODE (studio-only) */ /* removed: window.__MOROCCO_TRIO_REF_URIS (studio-only) */ // ============================================================================
  // Due by Dusk — Complete China Trio Authored Vector Character Renderer
  // Faithfully implements all 3 China Trio characters from the 3-pose reference sheets
  // in pure HTML5 Canvas 2D with continuous 60fps animations AND smooth pose-to-pose
  // interpolation (`1. IDLE <-> 2. CURSOR-NEAR ALERT <-> 3. ON-HIT GAG`):
  //
  //   1. Shaolin Bitter Melon (`bittermelon`, r: 26) — Warty Jade Bitter Melon (Kung-Fu Gong Monk)
  //   2. Sifu Bok Choy (`bokchoy`, r: 26) — Crisp Celadon Bok Choy (Folding-Fan Tai-Chi Master)
  //   3. Zen Lotus Root (`lotusroot`, r: 26) — Jiangnan Lotus Root (Oolong Tea Scholar)
  //
  // Supported States:
  //   - State 1 (`idle`):          !cursorNear && !shocked (continuous 60fps idle animation)
  //   - State 2 (`near`):          cursorNear && !shocked  (continuous 60fps cursor-near alert animation)
  //   - State 3 (`gag`/`shocked`): shocked                 (continuous 60fps on-hit slapstick gag animation)
  //   - Smooth Blend Object:       { wIdle, wNear, wGag, alertP, gagP } for continuous pose-to-pose morphing!
  //
  // Also includes `drawContinuousShowcaseCycle(...)` which renders a continuous
  // animated state-machine loop (`IDLE -> ANTICIPATION -> CURSOR-NEAR ALERT -> SCYTHE SWING -> ON-HIT GAG -> RECOVERY`)
  // with an approaching & slicing scythe cursor so you can watch the full in-field
  // reaction sequence continuously!
  // ============================================================================
  const DBD_CHINA_TRIO_RENDERER = (() => {
    'use strict';
    const INK = '#23170d';
    function ell(ctx, x, y, rx, ry, rot = 0) {
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
      ctx.fill();
    }
    function circ(ctx, x, y, r) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
      ctx.fill();
    }
    function lerp(a, b, t) {
      return a + (b - a) * t;
    }
    function clamp01(t) {
      return Math.max(0, Math.min(1, t));
    }
    function smoothstep(a, b, t) {
      const u = clamp01((t - a) / Math.max(1e-5, b - a));
      return u * u * (3 - 2 * u);
    }
    function easeOutBack(t) {
      const u = clamp01(t);
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
    }
    function lerpHex(c1, c2, t) {
      const u = clamp01(t);
      const p1 = parseInt(c1.slice(1), 16);
      const p2 = parseInt(c2.slice(1), 16);
      const r = Math.round(lerp((p1 >> 16) & 255, (p2 >> 16) & 255, u));
      const g = Math.round(lerp((p1 >> 8) & 255, (p2 >> 8) & 255, u));
      const b = Math.round(lerp(p1 & 255, p2 & 255, u));
      return `rgb(${r},${g},${b})`;
    } // Resolves discrete state ('idle' | 'near' | 'gag') OR continuous blend weights
    function resolvePoseWeights(state, tNow = 0) {
      if (state && typeof state === 'object') {
        return {
          wIdle: state.wIdle ?? 0,
          wNear: state.wNear ?? 0,
          wGag: state.wGag ?? 0,
          alertP: state.alertP ?? state.wNear ?? 0,
          gagP: state.gagP ?? state.wGag ?? 0,
        };
      }
      if (state === 'near') {
        return { wIdle: 0, wNear: 1, wGag: 0, alertP: 1, gagP: 0 };
      }
      if (state === 'gag' || state === 'shocked') {
        return { wIdle: 0, wNear: 0, wGag: 1, alertP: 0, gagP: 1 };
      }
      return { wIdle: 1, wNear: 0, wGag: 0, alertP: 0, gagP: 0 };
    } // ==========================================================================
    // Sculpted Rich Soil Dirt Mound with Left Sprout & Optional Front Clods
    // Faithfully matches the exact dirt mound in all 3 China reference sheets!
    // ==========================================================================
    function drawSculptedDirtMound(ctx, r, withLeftSprout = true, tNow = 0, withFrontClod = false) {
      ctx.save(); // Soft oval ground shadow
      ctx.fillStyle = 'rgba(35, 23, 13, 0.14)';
      ell(ctx, 0, 5.2, r * 1.06, r * 0.17); // Tiny 2-leaf green sprout on the left side of the mound (sways gently at 60fps!)
      if (withLeftSprout) {
        const sproutSway = tNow > 0 ? Math.sin(tNow * 3.4) * 0.08 : 0;
        ctx.save();
        ctx.translate(-r * 0.74, -1.8);
        ctx.rotate(sproutSway);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(2.4, 2.5);
        ctx.quadraticCurveTo(-1.2, -2.5, -3.4, -6.8);
        ctx.stroke();
        for (const [lx, ly, rot, rx, ry, col] of [
          [-5.6, -6.6, -0.45, 3.6, 1.7, '#65a30d'],
          [-1.0, -7.8, 0.55, 3.1, 1.5, '#84cc16'],
        ]) {
          ctx.fillStyle = col;
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.25;
          ell(ctx, lx, ly, rx, ry, rot);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(lx - Math.cos(rot) * rx * 0.6, ly - Math.sin(rot) * rx * 0.6);
          ctx.lineTo(lx + Math.cos(rot) * rx * 0.5, ly + Math.sin(rot) * rx * 0.5);
          ctx.stroke();
        }
        ctx.restore();
      } // Layered scalloped dirt mound silhouette
      function traceMound(g) {
        g.beginPath();
        g.moveTo(-r * 0.96, 3.2);
        g.bezierCurveTo(-r * 1.02, -0.8, -r * 0.76, -4.6, -r * 0.46, -4.4);
        g.bezierCurveTo(-r * 0.34, -6.4, -r * 0.1, -5.8, 0, -4.0);
        g.bezierCurveTo(r * 0.12, -5.8, r * 0.36, -6.4, r * 0.48, -4.4);
        g.bezierCurveTo(r * 0.78, -4.6, r * 1.02, -0.8, r * 0.96, 3.2);
        g.bezierCurveTo(r * 0.52, 6.2, -r * 0.52, 6.2, -r * 0.96, 3.2);
        g.closePath();
      }
      ctx.save();
      traceMound(ctx);
      const mGrad = ctx.createLinearGradient(0, -6.5, 0, 6.2);
      mGrad.addColorStop(0.0, '#8d5b34');
      mGrad.addColorStop(0.55, '#734827');
      mGrad.addColorStop(1.0, '#4d2e16');
      ctx.fillStyle = mGrad;
      ctx.fill();
      ctx.clip(); // Darker bottom rim shadow crescent inside mound
      ctx.fillStyle = 'rgba(35, 23, 13, 0.34)';
      ctx.beginPath();
      ctx.moveTo(-r * 1.05, 1.2);
      ctx.quadraticCurveTo(0, 4.4, r * 1.05, 1.2);
      ctx.lineTo(r * 1.05, 7.5);
      ctx.lineTo(-r * 1.05, 7.5);
      ctx.closePath();
      ctx.fill(); // Warm soil top clod highlights & pebbles
      ctx.fillStyle = 'rgba(184, 134, 85, 0.36)';
      ell(ctx, -r * 0.54, -2.2, r * 0.18, 1.4, -0.15);
      ell(ctx, r * 0.52, -2.0, r * 0.17, 1.3, 0.15);
      ctx.fillStyle = '#4d2e16';
      for (const [px, py, prx, pry] of [
        [-r * 0.48, 0.2, 1.5, 0.9],
        [-r * 0.36, 1.5, 1.0, 0.7],
        [r * 0.04, 1.4, 1.2, 0.8],
        [r * 0.44, 0.4, 1.5, 1.0],
        [r * 0.58, 1.6, 0.9, 0.6],
      ]) {
        ell(ctx, px, py, prx, pry);
      }
      ctx.restore();
      traceMound(ctx);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.65;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(); // Upper soil cradle scallop line where the vegetable sits
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.52, -3.4);
      ctx.quadraticCurveTo(-r * 0.26, -5.4, -r * 0.06, -3.5);
      ctx.quadraticCurveTo(r * 0.16, -5.6, r * 0.38, -3.5);
      ctx.stroke(); // Optional front-right small pebble clod (matching Bok Choy & Lotus Root sheets!)
      if (withFrontClod) {
        ctx.fillStyle = '#734827';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.35;
        ell(ctx, r * 0.52, 6.2, 3.2, 1.6, 0.08);
        ctx.stroke();
      }
      ctx.restore();
    } // Glossy blue cartoon sweat drop — slides & bobbles continuously when tNow > 0!
    function drawSweatDrop(ctx, x, y, scale = 1.0, rot = 0, tNow = 0) {
      if (scale <= 0.02) return;
      const slideY = tNow > 0 ? ((tNow * 1.85) % 1.0) * 2.5 : 0;
      const pulse = tNow > 0 ? 1.0 - ((tNow * 1.85) % 1.0) * 0.12 : 1.0;
      ctx.save();
      ctx.translate(x, y + slideY);
      ctx.rotate(rot);
      ctx.scale(scale * pulse, scale * pulse);
      ctx.fillStyle = '#5bc0eb';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.45;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -6.2);
      ctx.bezierCurveTo(3.8, -1.0, 4.1, 3.8, 0, 4.3);
      ctx.bezierCurveTo(-4.1, 3.8, -3.8, -1.0, 0, -6.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e0f7ff';
      ell(ctx, -1.0, 0.8, 0.9, 1.8, -0.2);
      ctx.restore();
    } // Classic 4-curve red comic anger vein cross mark (`💢`)
    function drawAngerVeinMark(ctx, x, y, scale = 1.0, rot = 0, tNow = 0) {
      if (scale <= 0.02) return;
      const pulse = tNow > 0 ? 1.0 + Math.sin(tNow * 14.0) * 0.15 : 1.0;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(scale * pulse, scale * pulse);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 2);
        ctx.beginPath();
        ctx.moveTo(-4.2, -1.4);
        ctx.quadraticCurveTo(-1.4, -1.4, -1.4, -4.2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    } // Crisp > < chevron wince eyes (State 3 On-Hit Gag — pulses with impact energy!)
    function drawChevronWinceEyes(ctx, leftX, rightX, eyeY, w, h, ink = INK, lw = 2.1, tNow = 0) {
      const squeeze = tNow > 0 ? 1.0 + Math.sin(tNow * 20.0) * 0.08 : 1.0;
      const hw = w * squeeze;
      const hh = h / squeeze;
      ctx.save();
      ctx.strokeStyle = ink;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round'; // Left '>'
      ctx.beginPath();
      ctx.moveTo(leftX - hw * 0.55, eyeY - hh);
      ctx.lineTo(leftX + hw * 0.45, eyeY);
      ctx.lineTo(leftX - hw * 0.55, eyeY + hh);
      ctx.stroke(); // Right '<'
      ctx.beginPath();
      ctx.moveTo(rightX + hw * 0.55, eyeY - hh);
      ctx.lineTo(rightX - hw * 0.45, eyeY);
      ctx.lineTo(rightX + hw * 0.55, eyeY + hh);
      ctx.stroke();
      ctx.restore();
    } // Spiky comic explosion speech bubble ("AIYA!", "WAH!")
    function drawSpikyExplosionBubble(ctx, cx, cy, rx, ry, tailX, tailY, text, fontSize = 6.2, tNow = 0, scaleP = 1.0) {
      if (scaleP <= 0.02) return;
      const pulse = (tNow > 0 ? 1.0 + Math.sin(tNow * 16.0) * 0.045 : 1.0) * scaleP;
      ctx.save();
      const spikes = 14;
      const pts = [];
      for (let i = 0; i < spikes * 2; i++) {
        const ang = (i * Math.PI) / spikes - Math.PI * 0.5;
        const isOuter = i % 2 === 0;
        const jitter = (((i * 7) % 5) - 2) * 0.03;
        const radScale = (isOuter ? 1.18 + jitter : 0.86 - jitter * 0.3) * pulse;
        pts.push([cx + Math.cos(ang) * rx * radScale, cy + Math.sin(ang) * ry * radScale]);
      }
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.35;
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 6;
      ctx.beginPath();
      pts[18] = [lerp(cx, tailX, scaleP), lerp(cy, tailY, scaleP)];
      pts[17][0] -= 2.2 * scaleP;
      pts[19][1] -= 2.0 * scaleP;
      for (let i = 0; i < pts.length; i++) {
        const [px, py] = pts[i];
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.translate(cx, cy + 0.4);
      ctx.scale(pulse, pulse);
      ctx.rotate(-0.03 + (tNow > 0 ? Math.sin(tNow * 18.0) * 0.025 : 0));
      ctx.fillStyle = INK;
      ctx.font = `900 ${fontSize}px "Arial Black", "Impact", "Trebuchet MS", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 0);
      ctx.restore();
      ctx.restore();
    } // ==========================================================================
    // 1. SHAOLIN BITTER MELON (`bittermelon`, base r = 26)
    //    Warty Jade Bitter Melon — Kung-Fu Gong Monk
    // ==========================================================================
    function drawShaolinBitterMelon(ctx, r = 26, state = 'idle', tNow = 0, px = 0, py = 0, drawMound = true) {
      const { wIdle, wNear, wGag, alertP, gagP } = resolvePoseWeights(state, tNow);
      const isNear = wNear >= 0.5 && wGag < 0.5;
      const isGag = wGag >= 0.5;
      const gagEased = easeOutBack(clamp01(gagP));
      ctx.save();
      if (drawMound) {
        drawSculptedDirtMound(ctx, r * 0.98, true, tNow, false);
      }
      const breatheY = wIdle * (tNow > 0 ? Math.sin(tNow * 3.8) * 0.85 : 0);
      const squatY = wNear * (1.8 + (tNow > 0 ? Math.sin(tNow * 18.0) * 0.45 : 0));
      const jitterX =
        wNear * (tNow > 0 ? Math.sin(tNow * 32.0) * 0.55 : 0) + wGag * (tNow > 0 ? Math.sin(tNow * 24.0) * 0.55 : 0);
      ctx.save();
      ctx.translate(jitterX, breatheY + squatY); // Helper: Draw Crimson Martial-Arts Headband (`Hachimaki` / Kung-Fu Ribbon)
      function drawKungFuHeadband(hx, hy, hrot, showLoop = false) {
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(hrot);
        const tailWave = tNow > 0 ? Math.sin(tNow * (showLoop ? 18.0 : 5.5)) * (showLoop ? 0.16 : 0.09) : 0; // Left Knot & Two Fluttering Notched Red Ribbon Tails
        ctx.save();
        ctx.translate(-r * 0.52, 0);
        ctx.rotate(tailWave); // Upper ribbon tail
        ctx.fillStyle = '#dc2626';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -1.5);
        ctx.bezierCurveTo(-r * 0.26, -r * 0.14, -r * 0.44, r * 0.04, -r * 0.62, -r * 0.04);
        ctx.lineTo(-r * 0.54, r * 0.06);
        ctx.lineTo(-r * 0.58, r * 0.14);
        ctx.bezierCurveTo(-r * 0.36, r * 0.18, -r * 0.2, r * 0.02, 0, 2.0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Lower ribbon tail
        ctx.fillStyle = '#b91c1c';
        ctx.beginPath();
        ctx.moveTo(0, 1.0);
        ctx.bezierCurveTo(-r * 0.22, r * 0.08, -r * 0.34, r * 0.32, -r * 0.52, r * 0.38);
        ctx.lineTo(-r * 0.42, r * 0.46);
        ctx.bezierCurveTo(-r * 0.2, r * 0.36, -r * 0.1, r * 0.16, 2.0, 3.0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Tie knot bulb
        ctx.fillStyle = '#dc2626';
        ell(ctx, -1.5, 0.6, 3.6, 3.0, -0.2);
        ctx.stroke();
        ctx.restore();
        if (!showLoop) {
          // Snug headband strap wrapped across the bumpy bitter melon forehead
          ctx.fillStyle = '#dc2626';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.55;
          ctx.beginPath();
          ctx.moveTo(-r * 0.52, -3.6);
          ctx.quadraticCurveTo(0, -5.8, r * 0.52, -2.6);
          ctx.lineTo(r * 0.55, 3.6);
          ctx.quadraticCurveTo(0, 0.8, -r * 0.52, 2.8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke(); // Top crimson highlight stripe
          ctx.strokeStyle = 'rgba(254, 202, 202, 0.45)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(-r * 0.42, -2.2);
          ctx.quadraticCurveTo(0, -4.0, r * 0.44, -1.2);
          ctx.stroke();
        } else {
          // 3D Airborne Hollow Headband Ring Loop when knocked off in Pose 3!
          ctx.fillStyle = '#991b1b';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.5;
          ell(ctx, 0, 0, r * 0.5, r * 0.18);
          ctx.stroke();
          ctx.fillStyle = '#f4efe1';
          ell(ctx, 0, 1.2, r * 0.38, r * 0.1);
          ctx.stroke(); // Front red band thickness
          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.moveTo(-r * 0.5, 0);
          ctx.bezierCurveTo(-r * 0.48, -r * 0.22, r * 0.48, -r * 0.22, r * 0.5, 0);
          ctx.bezierCurveTo(r * 0.42, -r * 0.1, -r * 0.42, -r * 0.1, -r * 0.5, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      } // Helper: Draw Polished Brass Shaolin Gong
      function drawBrassGong(gx, gy, grot, rx, ry, withCord = false) {
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(grot);
        if (withCord) {
          // Triangular dark hanging cord above the gong
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.6;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(-rx * 0.48, -ry * 0.82);
          ctx.lineTo(0, -ry * 1.42);
          ctx.lineTo(rx * 0.48, -ry * 0.82);
          ctx.stroke();
        } // Outer bronze-gold rim of the gong
        const gGrad = ctx.createLinearGradient(-rx, -ry, rx, ry);
        gGrad.addColorStop(0.0, '#fde047');
        gGrad.addColorStop(0.45, '#eab308');
        gGrad.addColorStop(0.8, '#ca8a04');
        gGrad.addColorStop(1.0, '#a16207');
        ctx.fillStyle = gGrad;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.55;
        ell(ctx, 0, 0, rx, ry);
        ctx.stroke(); // Inner recessed gold plate
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 1.15;
        ell(ctx, 0, 0, rx * 0.78, ry * 0.78);
        ctx.stroke(); // Diagonal metallic sheen highlight across gong face
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * 0.76, ry * 0.76, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = 'rgba(254, 249, 195, 0.50)';
        ctx.beginPath();
        ctx.moveTo(-rx * 0.25, -ry);
        ctx.lineTo(rx * 0.15, -ry);
        ctx.lineTo(-rx * 0.15, ry);
        ctx.lineTo(-rx * 0.55, ry);
        ctx.closePath();
        ctx.fill();
        ctx.restore(); // Central raised bronze boss dome
        ctx.fillStyle = '#b45309';
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.2;
        ell(ctx, 0, 0, rx * 0.25, ry * 0.25);
        ctx.stroke();
        ctx.fillStyle = '#fde047';
        ell(ctx, -rx * 0.06, -ry * 0.06, rx * 0.08, ry * 0.08);
        ctx.restore();
      } // Helper: Draw Padded Gong Mallet
      function drawGongMallet(mx, my, mrot, scale = 1.0) {
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(mrot);
        ctx.scale(scale, scale); // Wooden handle stick
        ctx.fillStyle = '#92400e';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(-1.8, 0, 3.6, 13.5, 1.6);
        ctx.fill();
        ctx.stroke(); // Red collar wrap under mallet head
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.roundRect(-2.6, -1.6, 5.2, 2.6, 1.0);
        ctx.fill();
        ctx.stroke(); // Padded cream-tan mallet ball head
        ctx.fillStyle = '#fde68a';
        circ(ctx, 0, -4.8, 4.0);
        ctx.stroke();
        ctx.fillStyle = '#fffbeb';
        circ(ctx, -1.2, -6.0, 1.3);
        ctx.restore();
      }
      if (!isGag) {
        // ======================================================================
        // POSE 1 (IDLE) & POSE 2 (CURSOR-NEAR ALERT):
        // Tall Bumpy/Warty Jade-Green Bitter Melon Body with Top Stem
        // ======================================================================
        // 1. Curved Green Stem at Crown (`(0, -r * 1.48)`)
        ctx.save();
        ctx.fillStyle = '#4d7c0f';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-2.2, -r * 1.42);
        ctx.quadraticCurveTo(-2.8, -r * 1.56, -5.8, -r * 1.64);
        ctx.quadraticCurveTo(-3.2, -r * 1.7, -0.5, -r * 1.62);
        ctx.quadraticCurveTo(2.2, -r * 1.54, 2.4, -r * 1.42);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore(); // 2. Bumpy/Scalloped Warty Jade-Green Bitter Melon Silhouette
        function traceBitterMelonBody(g) {
          g.beginPath();
          g.moveTo(0, -r * 1.46); // Right bumpy flank (5 organic warty scallops down to soil)
          g.bezierCurveTo(r * 0.26, -r * 1.46, r * 0.44, -r * 1.32, r * 0.46, -r * 1.18);
          g.bezierCurveTo(r * 0.56, -r * 1.08, r * 0.56, -r * 0.9, r * 0.52, -r * 0.78);
          g.bezierCurveTo(r * 0.6, -r * 0.66, r * 0.6, -r * 0.48, r * 0.54, -r * 0.36);
          g.bezierCurveTo(r * 0.6, -r * 0.24, r * 0.56, -r * 0.08, r * 0.48, 0.02 * r); // Base tucked into dirt mound
          g.quadraticCurveTo(0, r * 0.1, -r * 0.48, 0.02 * r); // Left bumpy flank (5 organic warty scallops up to crown)
          g.bezierCurveTo(-r * 0.58, -r * 0.08, -r * 0.62, -r * 0.24, -r * 0.54, -r * 0.36);
          g.bezierCurveTo(-r * 0.62, -r * 0.48, -r * 0.62, -r * 0.66, -r * 0.52, -r * 0.78);
          g.bezierCurveTo(-r * 0.58, -r * 0.9, -r * 0.58, -r * 1.08, -r * 0.46, -r * 1.18);
          g.bezierCurveTo(-r * 0.44, -r * 1.32, -r * 0.26, -r * 1.46, 0, -r * 1.46);
          g.closePath();
        }
        ctx.save();
        traceBitterMelonBody(ctx);
        const bmGrad = ctx.createRadialGradient(-r * 0.1, -r * 0.82, 2, 0, -r * 0.68, r * 0.96);
        bmGrad.addColorStop(0.0, '#6ee7b7');
        bmGrad.addColorStop(0.55, '#34d399');
        bmGrad.addColorStop(1.0, '#10b981');
        ctx.fillStyle = bmGrad;
        ctx.fill();
        ctx.clip(); // Warty longitudinal bitter-melon ridges & bumps inside body clip
        ctx.strokeStyle = 'rgba(6, 95, 70, 0.35)';
        ctx.lineWidth = 1.35;
        ctx.lineCap = 'round';
        for (const rxOff of [-0.34, -0.14, 0.14, 0.34]) {
          ctx.beginPath();
          ctx.moveTo(rxOff * r * 0.75, -r * 1.4);
          for (let seg = 0; seg < 5; seg++) {
            const y0 = -r * 1.36 + seg * (r * 0.27);
            const y1 = y0 + r * 0.27;
            const bulge = (rxOff < 0 ? -1 : 1) * r * 0.07;
            ctx.quadraticCurveTo(rxOff * r + bulge, (y0 + y1) * 0.5, rxOff * r * 0.92, y1);
          }
          ctx.stroke();
        } // Small warty bitter-melon pebble bumps
        ctx.fillStyle = 'rgba(167, 243, 208, 0.55)';
        for (const [bx, by] of [
          [-r * 0.26, -r * 1.24],
          [r * 0.22, -r * 1.22],
          [-r * 0.42, -r * 0.62],
          [-r * 0.38, -r * 0.26],
          [r * 0.38, -r * 0.82],
        ]) {
          circ(ctx, bx, by, 1.5);
        }
        ctx.restore();
        traceBitterMelonBody(ctx);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.65;
        ctx.lineJoin = 'round';
        ctx.stroke(); // 3. Crimson Martial-Arts Headband wrapped around upper forehead
        drawKungFuHeadband(0, -r * 1.08, isNear ? 0.04 : -0.04, false); // 4. Facial Expression & Gong / Mallet Props per Pose
        const eyeY = -r * 0.8;
        if (!isNear) {
          // ====================================================================
          // POSE 1: IDLE (STERN KUNG-FU FOCUS, GENTLE GONG TAP + "ding" & NOTES)
          // ====================================================================
          for (const [ex, ey] of [
            [-r * 0.14, eyeY],
            [r * 0.22, eyeY - 0.5],
          ]) {
            ctx.fillStyle = INK;
            ell(ctx, ex + px * 0.2, ey + py * 0.15, 2.7, 3.0);
            ctx.fillStyle = '#ffffff';
            circ(ctx, ex - 0.7 + px * 0.1, ey - 0.9 + py * 0.1, 1.0);
          } // Determined furrowed martial-arts eyebrows (`\ /`)
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.85;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-r * 0.28, eyeY - 4.8);
          ctx.lineTo(-r * 0.04, eyeY - 3.2);
          ctx.moveTo(r * 0.34, eyeY - 5.2);
          ctx.lineTo(r * 0.1, eyeY - 3.4);
          ctx.stroke(); // Serious pursed kung-fu mouth (`)-`)
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-r * 0.02, eyeY + 5.5);
          ctx.quadraticCurveTo(r * 0.08, eyeY + 4.5, r * 0.16, eyeY + 5.8);
          ctx.moveTo(-r * 0.02, eyeY + 3.8);
          ctx.quadraticCurveTo(-r * 0.06, eyeY + 5.5, -r * 0.02, eyeY + 7.2);
          ctx.stroke(); // Right Arm (`+x` side) raised holding the hanging cord of the Brass Gong!
          const gongSway = tNow > 0 ? Math.sin(tNow * 4.2) * 0.04 : 0;
          const gongX = r * 0.68;
          const gongY = -r * 0.38;
          ctx.save();
          ctx.fillStyle = '#34d399';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(r * 0.48, -r * 0.64);
          ctx.quadraticCurveTo(r * 0.58, -r * 0.84, gongX, -r * 0.86);
          ctx.arc(gongX, -r * 0.82, 3.2, -Math.PI * 0.5, Math.PI * 0.8);
          ctx.quadraticCurveTo(r * 0.56, -r * 0.7, r * 0.48, -r * 0.54);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore(); // Brass Gong hanging on the right
          drawBrassGong(gongX, gongY, gongSway, r * 0.36, r * 0.38, true); // Left Arm reaching across belly to tap the gong with the padded mallet
          const tapCycle = tNow > 0 ? Math.sin(tNow * 6.5) : 0.4;
          const malletRot = 0.78 + tapCycle * 0.16;
          drawGongMallet(r * 0.24, -r * 0.28, malletRot, 0.95);
          ctx.save();
          ctx.strokeStyle = INK;
          ctx.lineWidth = 4.2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-r * 0.22, -r * 0.46);
          ctx.quadraticCurveTo(-r * 0.06, -r * 0.26, r * 0.2, -r * 0.28);
          ctx.stroke();
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 2.2;
          ctx.stroke();
          ctx.restore(); // Floating musical notes (`♪ ♫`), `"ding"` text, sparkles & gong acoustic rings!
          const noteBob = tNow > 0 ? Math.sin(tNow * 5.0) * 1.5 : 0;
          ctx.save();
          ctx.fillStyle = INK;
          ctx.font = '900 7.5px "Trebuchet MS", sans-serif';
          ctx.fillText('♪', r * 0.54, -r * 0.98 + noteBob);
          ctx.font = '900 8.5px "Trebuchet MS", sans-serif';
          ctx.fillText('♫', r * 0.72, -r * 1.12 - noteBob * 0.7);
          ctx.font = '900 6.2px "Arial Black", "Trebuchet MS", sans-serif';
          ctx.save();
          ctx.translate(r * 1.02, -r * 0.88);
          ctx.rotate(0.22);
          ctx.fillText('ding', 0, 0);
          ctx.restore(); // Two 4-point golden sparkles (`✦`) on the right of the gong
          for (const [sx, sy, sr] of [
            [r * 1.0, -r * 0.72, 2.6],
            [r * 1.16, -r * 0.66, 4.2],
          ]) {
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(tNow > 0 ? Math.sin(tNow * 8.0) * 0.15 : 0);
            ctx.fillStyle = '#fde047';
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
              const a = (i * Math.PI) / 4;
              const rad = i % 2 === 0 ? sr : sr * 0.35;
              ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          } // Subtle acoustic vibration arcs around gong rim
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.1;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(gongX, gongY, r * 0.43, -0.35, 0.25);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(gongX, gongY, r * 0.43, 0.65, 1.15);
          ctx.stroke();
          ctx.restore();
        } else {
          // ====================================================================
          // POSE 2: CURSOR-NEAR ALERT!
          // Red Anger Vein Cross + `!` + 2 Sweat Drops + Wide Eyes + Gong Shield!
          // ====================================================================
          // Red 4-point anger vein mark on upper-left forehead
          drawAngerVeinMark(ctx, -r * 0.28, -r * 0.9, 0.82, -0.1, tNow); // Bold Exclamation Mark `!` at upper-right + 2 flying blue sweat drops
          ctx.save();
          ctx.translate(r * 0.44, -r * 1.34);
          ctx.rotate(0.22);
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.moveTo(-1.8, -9.5);
          ctx.lineTo(1.8, -9.5);
          ctx.lineTo(1.0, -1.5);
          ctx.lineTo(-1.0, -1.5);
          ctx.closePath();
          ctx.fill();
          circ(ctx, 0, 1.8, 1.5);
          ctx.restore();
          drawSweatDrop(ctx, r * 0.6, -r * 1.04, 0.68, 1.05, tNow);
          drawSweatDrop(ctx, r * 0.64, -r * 0.86, 0.56, 1.35, tNow); // Wide round white startled eyes (`O O`)
          for (const [ex, ey, er] of [
            [-r * 0.08, eyeY + 2.0, 4.8],
            [r * 0.28, eyeY + 2.4, 4.6],
          ]) {
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.5;
            circ(ctx, ex, ey, er);
            ctx.stroke();
            ctx.fillStyle = INK;
            circ(ctx, ex + 0.5 + px * 0.35, ey + py * 0.25, 1.25);
          } // Open dark gasping mouth just above the gong shield
          ctx.fillStyle = INK;
          ell(ctx, r * 0.1, eyeY + 8.5, 3.2, 3.8); // Brass Gong held front-and-center as a defensive buckler shield!
          const shieldShake = tNow > 0 ? Math.sin(tNow * 28.0) * 0.5 : 0;
          drawBrassGong(r * 0.14, -r * 0.32 + shieldShake, 0.04, r * 0.42, r * 0.42, false); // Right hand gripping right edge of gong shield
          ctx.fillStyle = '#34d399';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.45;
          ell(ctx, r * 0.55, -r * 0.36 + shieldShake, 3.2, 2.5, 0.15);
          ctx.stroke(); // Left arm clutching the padded mallet tightly in front of the gong shield
          drawGongMallet(-r * 0.08, -r * 0.24 + shieldShake, 0.52, 0.95);
          ctx.save();
          ctx.strokeStyle = INK;
          ctx.lineWidth = 4.2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-r * 0.38, -r * 0.42);
          ctx.quadraticCurveTo(-r * 0.32, -r * 0.18, -r * 0.1, -r * 0.24 + shieldShake);
          ctx.stroke();
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 2.2;
          ctx.stroke();
          ctx.restore();
        }
      } else {
        // ======================================================================
        // POSE 3: ON-HIT GAG!
        // Squashed/Melted Warty Jade Base Puddle + `> <` Wince + Wavy Mouth +
        // Airborne Headband + Flying Gong ("CLANG! CLANG!") + Flying Mallet ("BAM!") + "AIYA!"
        // ======================================================================
        const squashPulse = tNow > 0 ? Math.sin(tNow * 18.0) * 0.03 : 0;
        ctx.save();
        ctx.scale(1.0 + squashPulse, 1.0 - squashPulse * 0.7); // 0. Flung-Upward Thin Arms on Left and Right (matching the reference sheet!)
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.54, -r * 0.36);
        ctx.quadraticCurveTo(-r * 0.62, -r * 0.52, -r * 0.76, -r * 0.62);
        ctx.moveTo(r * 0.54, -r * 0.42);
        ctx.quadraticCurveTo(r * 0.62, -r * 0.58, r * 0.72, -r * 0.68);
        ctx.stroke();
        ctx.restore(); // 1. Curved Green Stem at Crown of Squashed Body
        ctx.save();
        ctx.fillStyle = '#4d7c0f';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-1.0, -r * 1.06);
        ctx.quadraticCurveTo(r * 0.08, -r * 1.24, r * 0.2, -r * 1.26);
        ctx.quadraticCurveTo(r * 0.26, -r * 1.18, r * 0.06, -r * 1.04);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore(); // 2. Squashed/Melted Warty Jade-Green Bitter Melon Body Draping Over Mound
        function traceSquashedMelon(g) {
          g.beginPath();
          g.moveTo(0, -r * 1.08);
          g.bezierCurveTo(r * 0.32, -r * 1.06, r * 0.54, -r * 0.82, r * 0.56, -r * 0.56);
          g.bezierCurveTo(r * 0.66, -r * 0.42, r * 0.68, -r * 0.22, r * 0.78, -r * 0.1);
          g.bezierCurveTo(r * 0.86, 0.02 * r, r * 0.68, 0.1 * r, r * 0.36, 0.08 * r);
          g.bezierCurveTo(r * 0.12, 0.14 * r, -r * 0.16, 0.16 * r, -r * 0.42, 0.08 * r);
          g.bezierCurveTo(-r * 0.74, 0.12 * r, -r * 0.88, 0.0, -r * 0.76, -r * 0.14);
          g.bezierCurveTo(-r * 0.68, -r * 0.26, -r * 0.66, -r * 0.46, -r * 0.56, -r * 0.6);
          g.bezierCurveTo(-r * 0.52, -r * 0.84, -r * 0.3, -r * 1.06, 0, -r * 1.08);
          g.closePath();
        }
        ctx.save();
        traceSquashedMelon(ctx);
        const smGrad = ctx.createRadialGradient(0, -r * 0.56, 2, 0, -r * 0.46, r * 0.88);
        smGrad.addColorStop(0.0, '#6ee7b7');
        smGrad.addColorStop(0.55, '#34d399');
        smGrad.addColorStop(1.0, '#10b981');
        ctx.fillStyle = smGrad;
        ctx.fill();
        ctx.clip(); // Warty ridges & horizontal squash fold creases
        ctx.strokeStyle = 'rgba(6, 95, 70, 0.38)';
        ctx.lineWidth = 1.35;
        for (const rxOff of [-0.32, 0, 0.32]) {
          ctx.beginPath();
          ctx.moveTo(rxOff * r * 0.5, -r * 1.02);
          ctx.quadraticCurveTo(rxOff * r * 1.1, -r * 0.55, rxOff * r * 0.9, -r * 0.12);
          ctx.stroke();
        }
        ctx.restore();
        traceSquashedMelon(ctx);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.65;
        ctx.lineJoin = 'round';
        ctx.stroke(); // Horizontal squash fold lines at base
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.35;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.48, -r * 0.14);
        ctx.quadraticCurveTo(-r * 0.16, -r * 0.22, r * 0.18, -r * 0.12);
        ctx.moveTo(r * 0.38, -r * 0.14);
        ctx.quadraticCurveTo(r * 0.5, -r * 0.18, r * 0.58, -r * 0.12);
        ctx.stroke(); // 3. Tight `> <` Chevron Wince Eyes & Wavy Grimace Mouth (`~~~`)
        const gagEyeY = -r * 0.46;
        drawChevronWinceEyes(ctx, -r * 0.2, r * 0.24, gagEyeY, 5.4, 2.3, INK, 2.0, tNow);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.75;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.18, gagEyeY + 7.5);
        ctx.quadraticCurveTo(-r * 0.11, gagEyeY + 4.8, -r * 0.04, gagEyeY + 7.5);
        ctx.quadraticCurveTo(r * 0.03, gagEyeY + 9.8, r * 0.1, gagEyeY + 7.2);
        ctx.quadraticCurveTo(r * 0.16, gagEyeY + 4.8, r * 0.22, gagEyeY + 7.5);
        ctx.stroke();
        ctx.restore(); // End squash pulse
        // 4. Airborne Crimson Headband Ring + Launch Motion Lines
        const hbFloat = tNow > 0 ? Math.sin(tNow * 16.0) * 2.0 : 0;
        drawKungFuHeadband(r * 0.04, -r * 1.74 + hbFloat, -0.2, true);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.06, -r * 1.16);
        ctx.lineTo(-r * 0.12, -r * 1.48);
        ctx.moveTo(r * 0.04, -r * 1.18);
        ctx.lineTo(-r * 0.02, -r * 1.46);
        ctx.stroke(); // 5. Brass Gong Flying Off to the Left (`-r * 1.06, -r * 0.66`) + "CLANG! CLANG!"
        const gongSpin = tNow > 0 ? Math.sin(tNow * 15.0) * 0.1 : 0;
        drawBrassGong(-r * 1.06, -r * 0.66 - hbFloat * 0.5, 0.25 + gongSpin, r * 0.28, r * 0.38, false); // Motion lines & "CLANG!" text above and below flying gong (well clear of headband & rim!)
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.arc(-r * 1.06, -r * 0.66, r * 0.43, -0.6, 0.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-r * 1.06, -r * 0.66, r * 0.43, 2.3, 3.2);
        ctx.stroke();
        ctx.save();
        ctx.fillStyle = INK;
        ctx.font = '900 5.5px "Arial Black", "Impact", sans-serif';
        ctx.textAlign = 'center';
        ctx.save();
        ctx.translate(-r * 1.18, -r * 1.14);
        ctx.rotate(-0.34);
        ctx.fillText('CLANG!', 0, 0);
        ctx.restore();
        ctx.save();
        ctx.translate(-r * 1.14, -r * 0.14);
        ctx.rotate(-0.28);
        ctx.fillText('CLANG!', 0, 0);
        ctx.restore();
        ctx.restore(); // 6. Padded Mallet Flying Off to the Right (`r * 0.84, -r * 0.78`) + "BAM!"
        drawGongMallet(r * 0.84, -r * 0.78 + hbFloat * 0.4, -0.45, 0.95);
        ctx.save();
        ctx.translate(r * 0.96, -r * 1.12);
        ctx.rotate(0.32);
        ctx.fillStyle = INK;
        ctx.font = '900 6.2px "Arial Black", "Impact", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('BAM!', 0, 0);
        ctx.restore(); // 7. Spiky Comic "AIYA!" Explosion Bubble at Lower-Right
        drawSpikyExplosionBubble(
          ctx,
          r * 1.12,
          -r * 0.32,
          r * 0.48,
          r * 0.26,
          r * 0.72,
          -r * 0.3,
          'AIYA!',
          5.5,
          tNow,
          clamp01(gagEased),
        );
      }
      ctx.restore();
      ctx.restore();
    } // ==========================================================================
    // 2. SIFU BOK CHOY (`bokchoy`, base r = 26)
    //    Crisp Celadon Bok Choy — Folding-Fan Tai-Chi Master
    // ==========================================================================
    function drawSifuBokChoy(ctx, r = 26, state = 'idle', tNow = 0, px = 0, py = 0, drawMound = true) {
      const { wIdle, wNear, wGag, alertP, gagP } = resolvePoseWeights(state, tNow);
      const isNear = wNear >= 0.5 && wGag < 0.5;
      const isGag = wGag >= 0.5;
      const gagEased = easeOutBack(clamp01(gagP));
      ctx.save();
      if (drawMound) {
        drawSculptedDirtMound(ctx, r * 0.98, true, tNow, true);
      }
      const breatheY = wIdle * (tNow > 0 ? Math.sin(tNow * 3.6) * 0.85 : 0);
      const squatY = wNear * (1.8 + (tNow > 0 ? Math.sin(tNow * 18.0) * 0.45 : 0));
      const jitterX =
        wNear * (tNow > 0 ? Math.sin(tNow * 32.0) * 0.55 : 0) + wGag * (tNow > 0 ? Math.sin(tNow * 24.0) * 0.55 : 0);
      ctx.save();
      ctx.translate(jitterX, breatheY + squatY); // Helper: Draw Black-and-Red Traditional Mandarin Skullcap (`瓜皮帽` Guapimo)
      function drawMandarinSkullcap(mx, my, mrot) {
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(mrot); // Top red silk button knot (`红顶子`)
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.4;
        circ(ctx, 0, -r * 0.36, 2.8);
        ctx.stroke(); // Dome of the Mandarin cap
        function traceCapDome(g) {
          g.beginPath();
          g.moveTo(-r * 0.4, 0);
          g.bezierCurveTo(-r * 0.38, -r * 0.4, r * 0.38, -r * 0.4, r * 0.4, 0);
          g.closePath();
        }
        ctx.save();
        traceCapDome(ctx);
        ctx.fillStyle = '#27272a';
        ctx.fill();
        ctx.clip(); // Center crimson-red silk panel wedge
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.35;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.36);
        ctx.quadraticCurveTo(r * 0.2, -r * 0.18, r * 0.18, 2);
        ctx.lineTo(-r * 0.18, 2);
        ctx.quadraticCurveTo(-r * 0.2, -r * 0.18, 0, -r * 0.36);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        traceCapDome(ctx);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.55;
        ctx.lineJoin = 'round';
        ctx.stroke(); // Dark charcoal upturned brim band at base of skullcap
        ctx.fillStyle = '#18181b';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.42, -2.2);
        ctx.quadraticCurveTo(0, -4.5, r * 0.42, -2.2);
        ctx.lineTo(r * 0.43, 2.2);
        ctx.quadraticCurveTo(0, 0.0, -r * 0.43, 2.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } // Helper: Draw Open Crimson Bamboo-Ribbed Folding Fan (`折扇`)
      function drawCrimsonFoldingFan(fx, fy, frot, scale = 1.0) {
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(frot);
        ctx.scale(scale, scale);
        const fanR = r * 0.48;
        const startA = -Math.PI * 0.82;
        const endA = -Math.PI * 0.18; // Crimson silk fan sector
        ctx.fillStyle = '#dc2626';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, fanR, startA, endA);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Darker red outer border band along top arc of fan
        ctx.strokeStyle = '#991b1b';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, fanR - 1.8, startA + 0.03, endA - 0.03);
        ctx.stroke(); // Radial bamboo fan ribs & inner handle sticks
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.1;
        for (let i = 1; i <= 5; i++) {
          const a = lerp(startA, endA, i / 6);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * fanR, Math.sin(a) * fanR);
          ctx.stroke();
        } // Small red wooden pivot base at `(0, 0)`
        ctx.fillStyle = '#fde68a';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.25;
        ell(ctx, 0, 0.8, 3.0, 1.8);
        ctx.stroke();
        ctx.restore();
      } // Helper: Draw a Single Spoon-Shaped Dark-Green Bok Choy Leaf with Pale Celadon Veins
      function drawBokChoyLeaf(lx, ly, lrot, lw, lh, col = '#228b22') {
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(lrot);
        ctx.fillStyle = col;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.55;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-lw * 0.32, 0);
        ctx.bezierCurveTo(-lw * 0.95, -lh * 0.35, -lw * 1.05, -lh * 0.92, 0, -lh);
        ctx.bezierCurveTo(lw * 1.05, -lh * 0.92, lw * 0.95, -lh * 0.35, lw * 0.32, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Pale celadon central midrib & branching lateral leaf veins
        ctx.strokeStyle = '#d9f99d';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 2);
        ctx.lineTo(0, -lh * 0.78);
        ctx.stroke();
        ctx.lineWidth = 1.35;
        for (const [vy, vx, vty] of [
          [-lh * 0.3, lw * 0.45, -lh * 0.52],
          [-lh * 0.52, lw * 0.38, -lh * 0.74],
        ]) {
          ctx.beginPath();
          ctx.moveTo(0, vy);
          ctx.lineTo(-vx, vty);
          ctx.moveTo(0, vy);
          ctx.lineTo(vx, vty);
          ctx.stroke();
        }
        ctx.restore();
      } // 1. Crown of Dark-Green Bok Choy Leaves (3 Cohesive Leaves in Idle/Near vs. 5 Splayed Leaves in Hit!)
      const leafSway = tNow > 0 ? Math.sin(tNow * 3.4) * 0.03 : 0;
      if (!isGag) {
        // Back-left & Back-right outer spoon leaves
        drawBokChoyLeaf(-r * 0.22, -r * 0.72, -0.26 + leafSway, r * 0.38, r * 0.8, '#166534');
        drawBokChoyLeaf(r * 0.22, -r * 0.72, 0.24 + leafSway, r * 0.36, r * 0.78, '#166534'); // Central prominent spoon leaf
        drawBokChoyLeaf(0, -r * 0.68, leafSway * 0.6, r * 0.44, r * 0.84, '#228b22');
      } else {
        // Pose 3 (On-Hit Gag): Splayed 5-leaf fan crown!
        const splayShake = tNow > 0 ? Math.sin(tNow * 22.0) * 0.04 : 0;
        drawBokChoyLeaf(-r * 0.34, -r * 0.62, -0.78 - splayShake, r * 0.28, r * 0.68, '#166534');
        drawBokChoyLeaf(r * 0.34, -r * 0.62, 0.76 + splayShake, r * 0.28, r * 0.68, '#166534');
        drawBokChoyLeaf(-r * 0.2, -r * 0.68, -0.42 - splayShake * 0.5, r * 0.34, r * 0.78, '#228b22');
        drawBokChoyLeaf(r * 0.2, -r * 0.68, 0.44 + splayShake * 0.5, r * 0.34, r * 0.78, '#228b22');
        drawBokChoyLeaf(-r * 0.02, -r * 0.72, 0.04 + splayShake, r * 0.36, r * 0.84, '#15803d');
      } // 2. Plump Crisp Pale-Celadon Bok Choy Bulb Base (`(0, 0)` up to `-r * 0.82`)
      function traceBokChoyBulb(g) {
        g.beginPath();
        g.moveTo(-r * 0.32, -r * 0.84);
        g.quadraticCurveTo(0, -r * 0.96, r * 0.32, -r * 0.84);
        g.bezierCurveTo(r * 0.42, -r * 0.62, r * 0.6, -r * 0.42, r * 0.56, -r * 0.16);
        g.bezierCurveTo(r * 0.52, 0.04 * r, r * 0.28, 0.1 * r, 0, 0.08 * r);
        g.bezierCurveTo(-r * 0.28, 0.1 * r, -r * 0.52, 0.04 * r, -r * 0.56, -r * 0.16);
        g.bezierCurveTo(-r * 0.6, -r * 0.42, -r * 0.42, -r * 0.62, -r * 0.32, -r * 0.84);
        g.closePath();
      }
      ctx.save();
      traceBokChoyBulb(ctx);
      const bcGrad = ctx.createRadialGradient(-r * 0.08, -r * 0.44, 2, 0, -r * 0.42, r * 0.68);
      bcGrad.addColorStop(0.0, '#f7fee7');
      bcGrad.addColorStop(0.6, '#d9f99d');
      bcGrad.addColorStop(1.0, '#a3e635');
      ctx.fillStyle = bcGrad;
      ctx.fill();
      ctx.clip(); // Outer celadon petiole stalk rib curves along left and right sides of the bulb
      ctx.strokeStyle = 'rgba(101, 163, 13, 0.45)';
      ctx.lineWidth = 1.45;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.32, -r * 0.36);
      ctx.quadraticCurveTo(-r * 0.44, -r * 0.12, -r * 0.2, 0.04 * r);
      ctx.moveTo(r * 0.32, -r * 0.36);
      ctx.quadraticCurveTo(r * 0.44, -r * 0.12, r * 0.2, 0.04 * r);
      ctx.stroke();
      ctx.restore(); // Stroke only the outer left, bottom, and right of the bulb so the top blends smoothly into the leaf stalks!
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.65;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.33, -r * 0.82);
      ctx.bezierCurveTo(-r * 0.42, -r * 0.62, -r * 0.6, -r * 0.42, -r * 0.56, -r * 0.16);
      ctx.bezierCurveTo(-r * 0.52, 0.04 * r, -r * 0.28, 0.1 * r, 0, 0.08 * r);
      ctx.bezierCurveTo(r * 0.28, 0.1 * r, r * 0.52, 0.04 * r, r * 0.56, -r * 0.16);
      ctx.bezierCurveTo(r * 0.6, -r * 0.42, r * 0.42, -r * 0.62, r * 0.33, -r * 0.82);
      ctx.stroke(); // 3. Mandarin Skullcap, Face, Arms & Crimson Folding Fan per Pose
      const eyeY = -r * 0.56;
      if (!isNear && !isGag) {
        // ======================================================================
        // POSE 1: IDLE (SERENE HALF-LIDDED SIFU EYES, CAP ON CROWN, WAVING FAN)
        // ======================================================================
        drawMandarinSkullcap(-r * 0.02, -r * 1.34, -0.03); // Half-lidded serene Sifu eyes
        for (const [ex, ey] of [
          [-r * 0.15, eyeY],
          [r * 0.19, eyeY],
        ]) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.45;
          circ(ctx, ex, ey, 3.6);
          ctx.stroke(); // Dark pupil in lower half
          ctx.fillStyle = INK;
          circ(ctx, ex + 0.5 + px * 0.2, ey + 0.8 + py * 0.15, 1.3); // Pale celadon upper eyelid drooped halfway down
          ctx.fillStyle = '#bef264';
          ctx.beginPath();
          ctx.arc(ex, ey, 3.6, Math.PI, 0, false);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } // Calm arched eyebrows
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.65;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.26, eyeY - 5.4);
        ctx.quadraticCurveTo(-r * 0.15, eyeY - 6.8, -r * 0.05, eyeY - 5.4);
        ctx.moveTo(r * 0.09, eyeY - 5.4);
        ctx.quadraticCurveTo(r * 0.19, eyeY - 6.8, r * 0.29, eyeY - 5.4);
        ctx.stroke(); // Subtle smug sifu smirk (`)-`)
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.04, eyeY + 5.6);
        ctx.quadraticCurveTo(r * 0.04, eyeY + 7.2, r * 0.14, eyeY + 5.8);
        ctx.moveTo(-r * 0.04, eyeY + 4.4);
        ctx.quadraticCurveTo(-r * 0.08, eyeY + 5.6, -r * 0.04, eyeY + 6.8);
        ctx.stroke(); // Left green arm resting on hip (`-r * 0.52, -r * 0.36`)
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.44, -r * 0.4);
        ctx.quadraticCurveTo(-r * 0.66, -r * 0.34, -r * 0.52, -r * 0.2);
        ctx.stroke();
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.restore(); // Right green arm extended out waving the open Crimson Folding Fan!
        const fanWave = tNow > 0 ? Math.sin(tNow * 4.5) * 0.1 : 0;
        const handX = r * 0.74;
        const handY = -r * 0.42;
        drawCrimsonFoldingFan(handX, handY, 0.22 + fanWave, 0.95);
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.48, -r * 0.3);
        ctx.quadraticCurveTo(r * 0.68, -r * 0.28, handX, handY);
        ctx.stroke();
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.restore();
      } else if (isNear) {
        // ======================================================================
        // POSE 2: CURSOR-NEAR ALERT!
        // Tilted Mandarin Cap + Sweat Drop + Wide Eyes + Fan Held Over Mouth!
        // ======================================================================
        drawMandarinSkullcap(r * 0.18, -r * 1.24, 0.38); // Glossy blue sweat drop on upper-left temple
        drawSweatDrop(ctx, -r * 0.34, -r * 0.74, 0.86, 0.05, tNow); // Wide round white startled eyes (`O O`)
        for (const [ex, ey, er] of [
          [-r * 0.12, eyeY, 4.3],
          [r * 0.2, eyeY, 4.1],
        ]) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.5;
          circ(ctx, ex, ey, er);
          ctx.stroke();
          ctx.fillStyle = INK;
          circ(ctx, ex + 0.4 + px * 0.3, ey + py * 0.2, 1.15);
        } // Worried eyebrows (`/ \`)
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.65;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.22, eyeY - 5.2);
        ctx.quadraticCurveTo(-r * 0.12, eyeY - 7.2, -r * 0.04, eyeY - 6.2);
        ctx.moveTo(r * 0.12, eyeY - 6.2);
        ctx.quadraticCurveTo(r * 0.2, eyeY - 7.2, r * 0.28, eyeY - 5.0);
        ctx.stroke(); // Small open gasping mouth peeking above the fan
        ctx.fillStyle = INK;
        circ(ctx, r * 0.04, eyeY + 5.8, 2.5); // Crimson Folding Fan held up in front of chest/mouth as a panic shield!
        const fanTremor = tNow > 0 ? Math.sin(tNow * 26.0) * 0.04 : 0;
        drawCrimsonFoldingFan(r * 0.04, -r * 0.14, 0.02 + fanTremor, 0.96); // Both green stalk arms curved inward clutching the fan
        for (const [sx, sy, cx1, cy1, hx, hy] of [
          [-r * 0.42, -r * 0.24, -r * 0.32, -r * 0.06, -r * 0.04, -r * 0.16],
          [r * 0.46, -r * 0.28, r * 0.56, -r * 0.16, r * 0.22, -r * 0.24],
        ]) {
          ctx.save();
          ctx.strokeStyle = INK;
          ctx.lineWidth = 4.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(cx1, cy1, hx, hy);
          ctx.stroke();
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();
        }
      } else {
        // ======================================================================
        // POSE 3: ON-HIT GAG!
        // Airborne Mandarin Cap + Splayed 5-Leaf Crown + `> <` Wince + Shouting
        // Mouth + Outstretched Arms + Left Steam Puff + Tumbling Fan + "AIYA!"
        // ======================================================================
        const capBounce = tNow > 0 ? Math.sin(tNow * 16.0) * 2.2 : 0; // 1. Airborne Mandarin Skullcap + 3 Vertical Launch Speed Lines
        drawMandarinSkullcap(r * 0.28, -r * 1.76 + capBounce, 0.28);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.25;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.16, -r * 1.44);
        ctx.lineTo(r * 0.22, -r * 1.66);
        ctx.moveTo(r * 0.22, -r * 1.38);
        ctx.lineTo(r * 0.28, -r * 1.62);
        ctx.moveTo(r * 0.3, -r * 1.48);
        ctx.lineTo(r * 0.34, -r * 1.6);
        ctx.stroke(); // 2. Tight `> <` Chevron Wince Eyes, Furrowed Brows & Shouting Mouth with Tongue
        const gagEyeY = -r * 0.46;
        drawChevronWinceEyes(ctx, -r * 0.14, r * 0.2, gagEyeY, 5.2, 2.2, INK, 2.0, tNow); // Furrowed brows above wince eyes
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.55;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.22, gagEyeY - 5.2);
        ctx.lineTo(-r * 0.08, gagEyeY - 3.6);
        ctx.moveTo(r * 0.26, gagEyeY - 5.2);
        ctx.lineTo(r * 0.12, gagEyeY - 3.6);
        ctx.stroke(); // Wide open shouting mouth with pink tongue
        const my = gagEyeY + 7.2;
        ctx.fillStyle = '#18181b';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ctx.beginPath();
        ctx.moveTo(-r * 0.08, my + 2.5);
        ctx.bezierCurveTo(-r * 0.1, my - 4.2, r * 0.18, my - 4.2, r * 0.16, my + 2.5);
        ctx.closePath();
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#fb7185';
        ell(ctx, 0, my + 2.2, 3.2, 1.8, -0.15);
        ctx.restore();
        ctx.stroke(); // 3. Both Green Stalk Arms Flung Outward in Shock
        const armFlail = tNow > 0 ? Math.sin(tNow * 22.0) * 1.5 : 0;
        for (const [sx, sy, ex, ey] of [
          [-r * 0.44, -r * 0.32, -r * 0.72, -r * 0.46 + armFlail],
          [r * 0.44, -r * 0.36, r * 0.68, -r * 0.56 - armFlail],
        ]) {
          ctx.save();
          ctx.strokeStyle = INK;
          ctx.lineWidth = 4.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo((sx + ex) * 0.5, sy - 3, ex, ey);
          ctx.stroke();
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();
        } // 4. White Steam Puff Cloud on Bottom-Left (`-r * 0.86, -r * 0.28`)
        ctx.save();
        ctx.translate(-r * 0.86, -r * 0.28);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.35;
        ctx.beginPath();
        ctx.moveTo(5.5, 2.5);
        ctx.lineTo(1.0, 1.8);
        ctx.arc(-2.5, 2.2, 3.2, 0.2 * Math.PI, 1.2 * Math.PI);
        ctx.arc(-4.2, -1.5, 3.5, 0.7 * Math.PI, 1.7 * Math.PI);
        ctx.arc(-0.2, -3.2, 3.2, 1.2 * Math.PI, 0.2 * Math.PI);
        ctx.lineTo(5.5, 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore(); // 5. Crimson Folding Fan Tumbling Away on Bottom-Right (`r * 0.88, -r * 0.14`)
        drawCrimsonFoldingFan(r * 0.88, -r * 0.14, 0.92 + (tNow > 0 ? Math.sin(tNow * 16.0) * 0.12 : 0), 0.9);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(r * 0.62, -r * 0.22);
        ctx.lineTo(r * 0.76, -r * 0.26);
        ctx.moveTo(r * 0.64, -r * 0.16);
        ctx.lineTo(r * 0.74, -r * 0.2);
        ctx.stroke(); // 6. Spiky Comic "AIYA!" Explosion Bubble on Right
        drawSpikyExplosionBubble(
          ctx,
          r * 1.14,
          -r * 0.72,
          r * 0.5,
          r * 0.27,
          r * 0.7,
          -r * 0.58,
          'AIYA!',
          5.6,
          tNow,
          clamp01(gagEased),
        );
      }
      ctx.restore();
      ctx.restore();
    } // ==========================================================================
    // 3. ZEN LOTUS ROOT (`lotusroot`, base r = 26)
    //    Cylindrical Jiangnan Lotus Root — Oolong Tea Scholar
    // ==========================================================================
    function drawZenLotusRoot(ctx, r = 26, state = 'idle', tNow = 0, px = 0, py = 0, drawMound = true) {
      const { wIdle, wNear, wGag, alertP, gagP } = resolvePoseWeights(state, tNow);
      const isNear = wNear >= 0.5 && wGag < 0.5;
      const isGag = wGag >= 0.5;
      const gagEased = easeOutBack(clamp01(gagP));
      ctx.save();
      if (drawMound) {
        drawSculptedDirtMound(ctx, r * 0.98, true, tNow, true);
      }
      const breatheY = wIdle * (tNow > 0 ? Math.sin(tNow * 3.5) * 0.85 : 0);
      const squatY = wNear * (1.8 + (tNow > 0 ? Math.sin(tNow * 18.0) * 0.45 : 0));
      const jitterX =
        wNear * (tNow > 0 ? Math.sin(tNow * 32.0) * 0.55 : 0) + wGag * (tNow > 0 ? Math.sin(tNow * 25.0) * 0.65 : 0);
      ctx.save();
      ctx.translate(jitterX, breatheY + squatY); // Helper: Draw Woven Conical Bamboo Hat (`斗笠` Douli)
      function drawBambooDouliHat(hx, hy, hrot, showUnderside = false) {
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(hrot); // Darker woven underside brim ellipse
        ctx.fillStyle = '#925e28';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.55;
        ell(ctx, 0, 2.0, r * 0.88, showUnderside ? r * 0.22 : r * 0.16);
        ctx.stroke(); // Conical bamboo hat upper cone
        function traceCone(g) {
          g.beginPath();
          g.moveTo(0, -r * 0.5);
          g.quadraticCurveTo(r * 0.46, -r * 0.26, r * 0.88, 1.5);
          g.quadraticCurveTo(0, -r * 0.14, -r * 0.88, 1.5);
          g.quadraticCurveTo(-r * 0.46, -r * 0.26, 0, -r * 0.5);
          g.closePath();
        }
        ctx.save();
        traceCone(ctx);
        const hatGrad = ctx.createLinearGradient(-r * 0.85, -r * 0.25, r * 0.85, -r * 0.25);
        hatGrad.addColorStop(0.0, '#b8823c');
        hatGrad.addColorStop(0.45, '#e2b168');
        hatGrad.addColorStop(1.0, '#a46e2a');
        ctx.fillStyle = hatGrad;
        ctx.fill();
        ctx.clip(); // Radial bamboo rib lines from apex `(0, -r * 0.50)` to brim
        ctx.strokeStyle = 'rgba(92, 52, 16, 0.52)';
        ctx.lineWidth = 1.05;
        for (const rxFrac of [-0.72, -0.48, -0.24, 0, 0.24, 0.48, 0.72]) {
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.5);
          ctx.lineTo(rxFrac * r, 4.0);
          ctx.stroke();
        } // Concentric woven bamboo rings
        for (const ryFrac of [0.16, 0.3, 0.42]) {
          ctx.beginPath();
          ctx.moveTo(-r * 0.88, -r * (0.5 - ryFrac * 1.1));
          ctx.quadraticCurveTo(0, -r * (0.56 - ryFrac * 1.1), r * 0.88, -r * (0.5 - ryFrac * 1.1));
          ctx.stroke();
        }
        ctx.restore();
        traceCone(ctx);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      } // Helper: Draw Blue-and-White Jingdezhen Porcelain Teacup (`青花瓷` Qinghuaci)
      function drawPorcelainTeacup(tx, ty, trot, scale = 1.0) {
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(trot);
        ctx.scale(scale, scale);
        const cw = r * 0.26;
        const ch = r * 0.26; // Left C-Handle (`-cw` — counterclockwise `true` so it bows outward to the LEFT!)
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(-cw * 0.9, -ch * 0.48, 2.6, Math.PI * 0.45, Math.PI * 1.55, true);
        ctx.stroke();
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 1.4;
        ctx.stroke(); // Porcelain foot ring at bottom
        ctx.fillStyle = '#dbeafe';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3;
        ell(ctx, 0, 1.5, cw * 0.56, 2.2);
        ctx.stroke(); // Cup bowl body
        function traceCup(g) {
          g.beginPath();
          g.moveTo(-cw, -ch * 0.88);
          g.lineTo(cw, -ch * 0.88);
          g.bezierCurveTo(cw * 0.96, -ch * 0.15, cw * 0.62, 1.2, cw * 0.48, 1.2);
          g.lineTo(-cw * 0.48, 1.2);
          g.bezierCurveTo(-cw * 0.62, 1.2, -cw * 0.96, -ch * 0.15, -cw, -ch * 0.88);
          g.closePath();
        }
        ctx.save();
        traceCup(ctx);
        ctx.fillStyle = '#f8fafc';
        ctx.fill();
        ctx.clip(); // Cobalt-blue porcelain decorative bands & wave scrolls (`#2563eb`)
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(-cw, -ch * 0.64);
        ctx.quadraticCurveTo(0, -ch * 0.54, cw, -ch * 0.64);
        ctx.moveTo(-cw, -ch * 0.18);
        ctx.quadraticCurveTo(0, -ch * 0.08, cw, -ch * 0.18);
        ctx.stroke(); // Blue wave scroll arcs in middle band (separate subpaths so no diagonal connector line!)
        for (const wx of [-cw * 0.35, cw * 0.05, cw * 0.45]) {
          ctx.beginPath();
          ctx.arc(wx, -ch * 0.36, 2.2, Math.PI, 0);
          ctx.stroke();
        }
        ctx.restore();
        traceCup(ctx);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ctx.stroke(); // Top elliptical teacup rim & warm amber-orange oolong tea liquid
        ctx.fillStyle = '#e0f2fe';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.4;
        ell(ctx, 0, -ch * 0.88, cw, 2.8);
        ctx.stroke();
        ctx.fillStyle = '#d97706';
        ell(ctx, 0, -ch * 0.86, cw * 0.82, 1.9);
        ctx.restore();
      } // 1. Cylindrical Warm-Tan Lotus Root Body with Root Node Waist & Flat Top Cross-Section
      function traceLotusRootBody(g) {
        g.beginPath();
        g.moveTo(-r * 0.6, -r * 1.18);
        g.lineTo(r * 0.6, -r * 1.18);
        g.bezierCurveTo(r * 0.66, -r * 0.72, r * 0.68, -r * 0.24, r * 0.44, -r * 0.04); // Narrower lotus root node waist tucked into soil mound
        g.quadraticCurveTo(r * 0.36, 0.04 * r, r * 0.4, 0.08 * r);
        g.quadraticCurveTo(0, 0.14 * r, -r * 0.4, 0.08 * r);
        g.quadraticCurveTo(-r * 0.36, 0.04 * r, -r * 0.44, -r * 0.04);
        g.bezierCurveTo(-r * 0.68, -r * 0.24, -r * 0.66, -r * 0.72, -r * 0.6, -r * 1.18);
        g.closePath();
      }
      ctx.save();
      traceLotusRootBody(ctx);
      const lrGrad = ctx.createRadialGradient(r * 0.08, -r * 0.68, 2, 0, -r * 0.6, r * 0.88);
      lrGrad.addColorStop(0.0, '#f5d5a7');
      lrGrad.addColorStop(0.6, '#e3b273');
      lrGrad.addColorStop(1.0, '#c28848');
      ctx.fillStyle = lrGrad;
      ctx.fill();
      ctx.clip(); // Warm brown shadow along left edge and root waist
      ctx.fillStyle = 'rgba(138, 82, 28, 0.26)';
      ctx.beginPath();
      ctx.moveTo(-r * 0.46, -r * 1.18);
      ctx.bezierCurveTo(-r * 0.52, -r * 0.56, -r * 0.42, -r * 0.08, r * 0.44, -r * 0.04);
      ctx.lineTo(r * 0.48, 0.16 * r);
      ctx.lineTo(-r * 0.7, 0.16 * r);
      ctx.lineTo(-r * 0.7, -r * 1.2);
      ctx.closePath();
      ctx.fill(); // Characteristic oval lotus-root skin dimples/lenticels along flanks
      ctx.fillStyle = 'rgba(161, 98, 38, 0.38)';
      ell(ctx, -r * 0.46, -r * 0.88, 2.0, 5.2, 0.08);
      ell(ctx, -r * 0.48, -r * 0.58, 1.5, 2.5, 0.05);
      ell(ctx, -r * 0.36, -r * 0.24, 1.6, 2.8, -0.35);
      ell(ctx, r * 0.42, -r * 0.24, 1.5, 2.8, 0.35);
      ctx.restore();
      traceLotusRootBody(ctx);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.65;
      ctx.lineJoin = 'round';
      ctx.stroke(); // Lotus root node crease at bottom waist
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-r * 0.42, -r * 0.03);
      ctx.quadraticCurveTo(-r * 0.26, 0.04 * r, -r * 0.16, 0.01 * r);
      ctx.moveTo(r * 0.42, -r * 0.03);
      ctx.quadraticCurveTo(r * 0.26, 0.04 * r, r * 0.16, 0.01 * r);
      ctx.stroke(); // 2. Flat Top Cross-Section of Lotus Root with Iconic Circular Air-Canal Holes!
      ctx.save();
      ctx.fillStyle = '#e7bc86';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.55;
      ell(ctx, 0, -r * 1.18, r * 0.6, r * 0.17);
      ctx.stroke(); // 7 Circular Air-Canal Holes on the Flat Top Cross-Section
      ctx.fillStyle = '#8c5828';
      ctx.strokeStyle = '#5c3412';
      ctx.lineWidth = 1.0;
      for (const [hx, hy, rx, ry] of [
        [0, -r * 1.18, 3.0, 1.3],
        [-r * 0.34, -r * 1.19, 3.2, 1.4],
        [-r * 0.2, -r * 1.26, 2.8, 1.2],
        [r * 0.16, -r * 1.26, 3.0, 1.2],
        [r * 0.36, -r * 1.19, 3.2, 1.4],
        [-r * 0.22, -r * 1.1, 3.2, 1.3],
        [r * 0.2, -r * 1.1, 3.2, 1.3],
      ]) {
        ell(ctx, hx, hy, rx, ry);
        ctx.stroke();
      }
      ctx.restore(); // 3. Woven Bamboo Hat, Facial Expression, Porcelain Teacup & Steam per Pose
      const eyeY = -r * 0.8;
      if (!isNear && !isGag) {
        // ======================================================================
        // POSE 1: IDLE (RELAXED ZEN EYES, LOW BAMBOO HAT, SIPPING HOT OOLONG TEA)
        // ======================================================================
        const hatBob = tNow > 0 ? Math.sin(tNow * 3.5) * 0.025 : 0;
        drawBambooDouliHat(0, -r * 1.18, -0.05 + hatBob, false); // Relaxed half-lidded zen eyes with horizontal flat upper lids
        for (const [ex, ey] of [
          [-r * 0.14, eyeY],
          [r * 0.26, eyeY],
        ]) {
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.arc(ex + px * 0.15, ey, 2.8, 0, Math.PI, false);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          circ(ctx, ex - 0.8 + px * 0.1, ey + 1.0, 0.85); // Flat horizontal upper brow/lid bar
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.85;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(ex - 4.5, ey - 0.4);
          ctx.lineTo(ex + 4.5, ey - 0.4);
          ctx.stroke();
        } // Contented sipping cheek & mouth (`)-`)
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.55;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.02, eyeY + 5.8);
        ctx.quadraticCurveTo(r * 0.08, eyeY + 7.5, r * 0.16, eyeY + 5.6);
        ctx.moveTo(-r * 0.02, eyeY + 4.2);
        ctx.quadraticCurveTo(-r * 0.06, eyeY + 5.8, -r * 0.02, eyeY + 7.4);
        ctx.stroke(); // Rising Curling Wisp of White Tea Steam above the teacup (`60fps` drift!)
        const steamPhase = tNow > 0 ? Math.sin(tNow * 4.0) * 1.6 : 0;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.26, -r * 0.62);
        ctx.bezierCurveTo(
          r * 0.34 + steamPhase * 0.4,
          -r * 0.74,
          r * 0.56 - steamPhase * 0.4,
          -r * 0.76,
          r * 0.46 + steamPhase * 0.5,
          -r * 0.94,
        );
        ctx.stroke();
        ctx.restore(); // Blue-and-White Porcelain Teacup held at `(r * 0.22, -r * 0.38)`
        const cupBob = tNow > 0 ? Math.sin(tNow * 3.5) * 0.6 : 0;
        drawPorcelainTeacup(r * 0.22, -r * 0.38 + cupBob, 0.0, 1.0); // Left & Right Lotus-Root Arms holding the teacup
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.34, -r * 0.52);
        ctx.bezierCurveTo(-r * 0.32, -r * 0.28, -r * 0.08, -r * 0.32, -r * 0.02, -r * 0.48 + cupBob);
        ctx.stroke();
        ctx.strokeStyle = '#e3b273';
        ctx.lineWidth = 2.4;
        ctx.stroke(); // Right hand fingers wrapping around right side of teacup
        ctx.fillStyle = '#e3b273';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ell(ctx, r * 0.48, -r * 0.46 + cupBob, 3.2, 2.4, 0.2);
        ctx.stroke();
        ctx.restore();
      } else if (isNear) {
        // ======================================================================
        // POSE 2: CURSOR-NEAR ALERT!
        // Tilted Bamboo Hat + Sweat Drop + Wide Eyes + Clutched Teacup!
        // ======================================================================
        drawBambooDouliHat(0, -r * 1.12, -0.1, false); // Glossy blue sweat drop on upper-left forehead
        drawSweatDrop(ctx, -r * 0.42, -r * 0.84, 0.88, 0.05, tNow); // Wide round white startled eyes (`O O`)
        for (const [ex, ey, er] of [
          [-r * 0.06, eyeY + 2.0, 5.2],
          [r * 0.32, eyeY + 2.2, 4.8],
        ]) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.5;
          circ(ctx, ex, ey, er);
          ctx.stroke();
          ctx.fillStyle = INK;
          circ(ctx, ex + 0.5 + px * 0.35, ey + py * 0.25, 1.3);
        } // Under-eye panic wrinkle lines
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.arc(-r * 0.06, eyeY + 2.0, 6.2, 0.25 * Math.PI, 0.75 * Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(r * 0.32, eyeY + 2.2, 5.8, 0.25 * Math.PI, 0.75 * Math.PI);
        ctx.stroke(); // Worried eyebrows (`/ \`)
        ctx.lineWidth = 1.75;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.2, eyeY - 4.8);
        ctx.quadraticCurveTo(-r * 0.08, eyeY - 7.0, 0, eyeY - 6.0);
        ctx.moveTo(r * 0.22, eyeY - 5.8);
        ctx.quadraticCurveTo(r * 0.32, eyeY - 7.0, r * 0.42, eyeY - 4.4);
        ctx.stroke(); // Small open gasping mouth with pink tongue
        const my = eyeY + 9.2;
        ctx.fillStyle = '#3b0808';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.35;
        ctx.beginPath();
        ctx.moveTo(r * 0.04, my + 1.8);
        ctx.bezierCurveTo(r * 0.02, my - 3.2, r * 0.24, my - 3.2, r * 0.22, my + 1.8);
        ctx.closePath();
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#f87171';
        ell(ctx, r * 0.14, my + 1.5, 2.8, 1.5);
        ctx.restore();
        ctx.stroke(); // Porcelain Teacup clutched tightly down against stomach (`r * 0.22, -r * 0.24`)
        const clutchShake = tNow > 0 ? Math.sin(tNow * 26.0) * 0.5 : 0;
        drawPorcelainTeacup(r * 0.22, -r * 0.24 + clutchShake, 0.02, 0.96);
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.34, -r * 0.36);
        ctx.bezierCurveTo(-r * 0.28, -r * 0.16, -r * 0.08, -r * 0.18, -r * 0.02, -r * 0.32 + clutchShake);
        ctx.stroke();
        ctx.strokeStyle = '#e3b273';
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.fillStyle = '#e3b273';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ell(ctx, r * 0.48, -r * 0.3 + clutchShake, 3.2, 2.5, 0.15);
        ctx.stroke();
        ctx.restore();
      } else {
        // ======================================================================
        // POSE 3: ON-HIT GAG!
        // Airborne Bamboo Douli Hat + Steam Erupting Out of Exposed Lotus Root
        // Holes + `@ @` Dizzy Spiral Eyes + Spilling Teacup & Tea Drops + "WAH!"
        // ======================================================================
        const hatBlast = tNow > 0 ? Math.sin(tNow * 16.0) * 2.2 : 0; // 1. Two White Steam Jets Erupting Straight Out of the Top Lotus-Root Holes!
        ctx.save(); // Left steam jet shooting from hole `(-r*0.20, -r*1.24)` toward airborne hat
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-r * 0.18, -r * 1.24);
        ctx.lineTo(-r * 0.34, -r * 1.62);
        ctx.lineTo(-r * 0.24, -r * 1.66);
        ctx.lineTo(-r * 0.12, -r * 1.24);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Right steam jet erupting from hole `(r*0.20, -r*1.18)` into a Big Billowing Steam Cloud!
        const cloudFloat = tNow > 0 ? Math.sin(tNow * 14.0) * 1.5 : 0;
        ctx.beginPath();
        ctx.moveTo(r * 0.18, -r * 1.18);
        ctx.lineTo(r * 0.28, -r * 1.56 + cloudFloat);
        ctx.arc(r * 0.18, -r * 1.72 + cloudFloat, 6.2, Math.PI * 0.7, Math.PI * 1.65);
        ctx.arc(r * 0.38, -r * 1.84 + cloudFloat, 7.8, Math.PI * 1.1, Math.PI * 0.05);
        ctx.arc(r * 0.56, -r * 1.66 + cloudFloat, 6.0, -Math.PI * 0.25, Math.PI * 0.65);
        ctx.lineTo(r * 0.36, -r * 1.54 + cloudFloat);
        ctx.lineTo(r * 0.24, -r * 1.18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore(); // 2. Airborne Woven Conical Bamboo Hat Blasted to Upper-Left (`-r * 0.42, -r * 1.60`)
        drawBambooDouliHat(-r * 0.42, -r * 1.6 + hatBlast, -0.62, true); // 3. Spinning `@ @` Dizzy Spiral Eyes + Shocked Oval `"O"` Mouth with Tongue
        const spiralSpin = tNow > 0 ? tNow * 10.0 : 0;
        for (const [dir, ex, ey] of [
          [-1, -r * 0.08, eyeY + 1.0],
          [1, r * 0.32, eyeY + 1.0],
        ]) {
          ctx.save();
          ctx.translate(ex, ey);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          for (let a = 0; a <= Math.PI * 4.4; a += 0.22) {
            const sr = (a / (Math.PI * 4.4)) * 5.2;
            const sx = Math.cos(a * dir + spiralSpin * dir) * sr;
            const sy = Math.sin(a * dir + spiralSpin * dir) * sr;
            if (a === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          ctx.stroke();
          ctx.restore();
        } // Oval shocked `"O"` mouth with pink tongue
        const my = eyeY + 10.5;
        ctx.fillStyle = '#3b0808';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.45;
        ell(ctx, r * 0.12, my, 3.2, 4.4);
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#f87171';
        ell(ctx, r * 0.1, my + 2.6, 2.8, 2.0);
        ctx.restore();
        ctx.stroke(); // Body shudder lines on left and right flanks
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.25;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.72, -r * 0.68);
        ctx.quadraticCurveTo(-r * 0.78, -r * 0.48, -r * 0.72, -r * 0.28);
        ctx.moveTo(-r * 0.8, -r * 0.6);
        ctx.quadraticCurveTo(-r * 0.84, -r * 0.48, -r * 0.8, -r * 0.36);
        ctx.moveTo(r * 0.76, -r * 0.44);
        ctx.quadraticCurveTo(r * 0.8, -r * 0.32, r * 0.74, -r * 0.18);
        ctx.stroke(); // 4. Tipping Blue-and-White Porcelain Teacup (`r * 0.44, -r * 0.24`) + Amber Tea Splash & Drops!
        const tipAngle = 0.34 + (tNow > 0 ? Math.sin(tNow * 20.0) * 0.08 : 0);
        drawPorcelainTeacup(r * 0.44, -r * 0.24, tipAngle, 0.98); // Sloshing Amber-Orange Oolong Tea Splash Crown & Flying Droplets!
        const dropShift = tNow > 0 ? ((tNow * 2.6) % 1.0) * 2.2 : 0;
        ctx.save();
        ctx.fillStyle = '#d97706';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.25;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.32, -r * 0.5);
        ctx.quadraticCurveTo(r * 0.52, -r * 0.58, r * 0.64, -r * 0.66);
        ctx.quadraticCurveTo(r * 0.7, -r * 0.56, r * 0.62, -r * 0.48);
        ctx.quadraticCurveTo(r * 0.76, -r * 0.52, r * 0.78, -r * 0.44);
        ctx.quadraticCurveTo(r * 0.66, -r * 0.38, r * 0.58, -r * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // 3 flying amber tea droplets above the spilling teacup
        ell(ctx, r * 0.64 + dropShift * 0.3, -r * 0.76 - dropShift, 1.6, 2.8, 0.45);
        ctx.stroke();
        ell(ctx, r * 0.84 + dropShift * 0.5, -r * 0.7 - dropShift * 0.8, 2.8, 1.5, -0.35);
        ctx.stroke();
        ell(ctx, r * 0.86 + dropShift * 0.4, -r * 0.54 - dropShift * 0.5, 2.4, 1.4, 0.25);
        ctx.stroke();
        ctx.restore(); // Arms reaching out to the tipping teacup
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 0.16, -r * 0.36);
        ctx.bezierCurveTo(-r * 0.1, -r * 0.18, r * 0.14, -r * 0.2, r * 0.22, -r * 0.36);
        ctx.stroke();
        ctx.strokeStyle = '#e3b273';
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.restore(); // 5. Spiky Comic "WAH!" Explosion Bubble at Upper-Right
        drawSpikyExplosionBubble(
          ctx,
          r * 1.12,
          -r * 1.04,
          r * 0.48,
          r * 0.27,
          r * 0.7,
          -r * 0.82,
          'WAH!',
          5.8,
          tNow,
          clamp01(gagEased),
        );
      }
      ctx.restore();
      ctx.restore();
    } // Unified dispatcher for `FarmScene.ts` (`window.DBD_CROP_RENDERER`)
    function drawChinaCharacter(ctx, type, r, state, tNow = 0, px = 0, py = 0, drawMound = false) {
      if (type === 'bittermelon' || type === 'bitter_melon' || type === 'shaolin_bittermelon') {
        drawShaolinBitterMelon(ctx, r, state, tNow, px, py, drawMound);
        return true;
      }
      if (type === 'bokchoy' || type === 'bok_choy' || type === 'sifu_bokchoy') {
        drawSifuBokChoy(ctx, r, state, tNow, px, py, drawMound);
        return true;
      }
      if (type === 'lotusroot' || type === 'lotus_root' || type === 'zen_lotusroot') {
        drawZenLotusRoot(ctx, r, state, tNow, px, py, drawMound);
        return true;
      }
      return false;
    } // ==========================================================================
    // Continuous State-Cycling Showcase Renderer (`IDLE -> ALERT -> SLICE -> GAG -> IDLE`)
    // ==========================================================================
    function drawContinuousShowcaseCycle(ctx, type, r, tNow, scale = 2.45) {
      const cycleDur = 4.5;
      const phase = (((tNow % cycleDur) + cycleDur) % cycleDur) / cycleDur;
      let st = 'idle';
      let stLabel = '▶ 1. IDLE';
      let stColor = '#15803d';
      let scytheX = 68,
        scytheY = -78,
        scytheAng = -0.4,
        showScythe = false,
        slashAlpha = 0;
      let squashX = 1.0,
        squashY = 1.0;
      let blendState = { wIdle: 1, wNear: 0, wGag: 0, alertP: 0, gagP: 0 };
      if (phase < 0.26) {
        st = 'idle';
        stLabel = '▶ 1. IDLE';
        stColor = '#15803d';
        blendState = { wIdle: 1, wNear: 0, wGag: 0, alertP: 0, gagP: 0 };
      } else if (phase < 0.34) {
        const u = smoothstep(0.26, 0.34, phase);
        st = 'near';
        stLabel = '⚡ 1→2 ANTICIPATION';
        stColor = '#d97706';
        blendState = { wIdle: 1 - u, wNear: u, wGag: 0, alertP: u, gagP: 0 };
        showScythe = true;
        scytheX = lerp(64, 48, u);
        scytheY = lerp(-72, -62, u);
        scytheAng = lerp(-0.25, -0.38, u);
        squashY = 1.0 - Math.sin(u * Math.PI) * 0.08;
        squashX = 1.0 / Math.sqrt(squashY);
      } else if (phase < 0.6) {
        const p = (phase - 0.34) / 0.26;
        st = 'near';
        stLabel = '⚠️ 2. CURSOR-NEAR ALERT!';
        stColor = '#d97706';
        blendState = { wIdle: 0, wNear: 1, wGag: 0, alertP: 1, gagP: 0 };
        showScythe = true;
        scytheX = 48 - p * 26;
        scytheY = -62 + Math.sin(p * Math.PI * 2) * 5;
        scytheAng = -0.38 - p * 0.42;
      } else if (phase < 0.9) {
        const p = (phase - 0.6) / 0.3;
        const u = smoothstep(0, 0.16, p);
        st = 'gag';
        stLabel = '💥 3. ON-HIT GAG!';
        stColor = '#dc2626';
        blendState = { wIdle: 0, wNear: 1 - u, wGag: u, alertP: 1 - u, gagP: clamp01(p / 0.25) };
        if (p < 0.35) {
          showScythe = true;
          const sp = p / 0.35;
          scytheX = 22 - sp * 58;
          scytheY = -48 + sp * 22;
          scytheAng = -0.8 + sp * 2.2;
          slashAlpha = 1.0 - sp;
        }
        const damp = Math.exp(-p * 6.2) * Math.cos(p * 23.0);
        squashY = 1.0 - damp * 0.21;
        squashX = 1.0 / Math.sqrt(Math.max(0.55, squashY));
      } else {
        const u = smoothstep(0.9, 1.0, phase);
        st = 'idle';
        stLabel = '🔄 3→1 RECOVERING';
        stColor = '#15803d';
        blendState = { wIdle: u, wNear: 0, wGag: 1 - u, alertP: 0, gagP: 1 - u };
        squashY = 1.0 + Math.sin(u * Math.PI) * 0.06;
        squashX = 1.0 / Math.sqrt(squashY);
      }
      const px = showScythe ? Math.cos(Math.atan2(scytheY + 25, scytheX)) * 1.8 : Math.sin(tNow * 2.2) * 1.1;
      const py = showScythe ? Math.sin(Math.atan2(scytheY + 25, scytheX)) * 1.4 : Math.cos(tNow * 1.7) * 0.6;
      ctx.save();
      ctx.scale(scale * squashX, scale * squashY);
      drawChinaCharacter(ctx, type, r, blendState, tNow, px, py, true);
      if (slashAlpha > 0.02) {
        ctx.save();
        ctx.strokeStyle = `rgba(254, 240, 138, ${slashAlpha * 0.92})`;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, -r * 0.85, r * 1.35, -0.85, 0.65);
        ctx.stroke();
        ctx.restore();
      }
      if (showScythe) {
        ctx.save();
        ctx.translate(scytheX, scytheY);
        ctx.rotate(scytheAng);
        ctx.strokeStyle = '#1c1008';
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 14);
        ctx.lineTo(0, -10);
        ctx.stroke();
        ctx.strokeStyle = '#9a5b25';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = '#1c1008';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.quadraticCurveTo(-14, -12, -20, -2);
        ctx.quadraticCurveTo(-12, -6, 0, -5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      return { st, stLabel, stColor };
    }
    return {
      drawShaolinBitterMelon,
      drawSifuBokChoy,
      drawZenLotusRoot,
      drawSculptedDirtMound,
      drawChinaCharacter,
      drawContinuousShowcaseCycle,
    };
  })();
  window.DBD_CHINA_TRIO_RENDERER = DBD_CHINA_TRIO_RENDERER;
  /* removed: window.DBD_CHINA_TRIO_SOURCE_CODE (studio-only) */ /* removed: window.__CHINA_TRIO_REF_URIS (studio-only) */ window.DBD_CROP_RENDERER =
    (() => {
      'use strict';
      function ell(g, x, y, rx, ry, rot) {
        g.beginPath();
        g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2);
        g.fill();
      }
      function circ(g, x, y, r) {
        g.beginPath();
        g.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
        g.fill();
      }
      function radial(g, x0, y0, r0, x1, y1, r1, a, b) {
        const gr = g.createRadialGradient(x0, y0, r0, x1, y1, r1);
        gr.addColorStop(0, a);
        gr.addColorStop(1, b);
        return gr;
      } // Standard Carrot-style `> <` wince eyes when hit (`shocked`)
      function drawWinceEyes(ctx, y, span, halfH, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-span, y - halfH);
        ctx.lineTo(-span * 0.36, y);
        ctx.lineTo(-span, y + halfH);
        ctx.moveTo(span, y - halfH);
        ctx.lineTo(span * 0.36, y);
        ctx.lineTo(span, y + halfH);
        ctx.stroke();
      } // Standard Carrot-style unstroked white eyes + tracking pupils
      function drawCleanEyes(ctx, ex, ey, eyeR, pupilR, px, py, pupilCol = '#1c1917') {
        for (const x of [-ex, ex]) {
          ctx.fillStyle = '#ffffff';
          circ(ctx, x, ey, eyeR);
          ctx.fillStyle = pupilCol;
          circ(ctx, x + px * 0.55, ey + py * 0.55, pupilR);
        }
      } // Fill + clip + stroke helper: builds path for fill & clip, then rebuilds path for outer stroke!
      function fillClipAndStrokeBody(ctx, buildPathFn, fillStyle, strokeStyle, lineWidth, drawInsideClip) {
        buildPathFn();
        ctx.fillStyle = fillStyle;
        ctx.fill();
        if (drawInsideClip) {
          ctx.save();
          ctx.clip();
          drawInsideClip();
          ctx.restore();
        }
        buildPathFn();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
      function drawRegionalCrop(ctx, c, def, breeze, tNow, shocked, cursorNear, px, py, gpLeaf) {
        const r = c.r;
        const type = c.type;
        const leafLag = breeze * 0.85;
        const wob = c.wob || 0;
        const t = tNow + wob * 0.35; // Smooth continuous pose-to-pose blend tracking on each field crop instance `c`
        const dtEst = Math.min(0.05, Math.max(0.008, tNow - (c._lastAnimT || tNow)));
        c._lastAnimT = tNow;
        const targetNear = !shocked && cursorNear ? 1.0 : 0.0;
        const targetGag = shocked ? 1.0 : 0.0;
        c._nearBlend = (c._nearBlend || 0) + (targetNear - (c._nearBlend || 0)) * Math.min(1, dtEst * 10.0);
        c._gagBlend = (c._gagBlend || 0) + (targetGag - (c._gagBlend || 0)) * Math.min(1, dtEst * 14.0);
        if (shocked) c._gagElapsed = Math.min(1.0, (c._gagElapsed || 0) + dtEst * 4.5);
        else c._gagElapsed = Math.max(0.0, (c._gagElapsed || 0) - dtEst * 6.0);
        const wGag = Math.max(0, Math.min(1, c._gagBlend));
        const wNear = Math.max(0, Math.min(1 - wGag, c._nearBlend));
        const wIdle = Math.max(0, 1 - wGag - wNear);
        const fieldBlendState = { wIdle, wNear, wGag, alertP: c._nearBlend, gagP: Math.max(wGag, c._gagElapsed || 0) };
        if (
          type === 'bittermelon' ||
          type === 'shaolin_bittermelon' ||
          type === 'bitter_melon' ||
          type === 'bokchoy' ||
          type === 'sifu_bokchoy' ||
          type === 'bok_choy' ||
          type === 'lotusroot' ||
          type === 'zen_lotusroot' ||
          type === 'lotus_root'
        ) {
          return DBD_CHINA_TRIO_RENDERER.drawChinaCharacter(ctx, type, r, fieldBlendState, t, px, py, false);
        }
        if (
          type === 'chickpea' ||
          type === 'hummus_chickpea' ||
          type === 'eggplant' ||
          type === 'zaalouk_eggplant' ||
          type === 'olive' ||
          type === 'beldi_olive'
        ) {
          return DBD_MOROCCO_TRIO_RENDERER.drawMoroccoCharacter(ctx, type, r, fieldBlendState, t, px, py, false);
        }
        if (type === 'pei_russet' || type === 'fiddlehead' || type === 'saskaberry') {
          return DBD_CANADA_TRIO_RENDERER.drawCanadaCharacter(ctx, type, r, fieldBlendState, t, px, py, false);
        }
        if (type === 'echalote' || type === 'artichaut' || type === 'lavender' || type === 'lavande') {
          return DBD_FRANCE_TRIO_RENDERER.drawFranceCharacter(ctx, type, r, fieldBlendState, t, px, py, false);
        }
        if (type === 'daikon' || type === 'kabocha' || type === 'wasabi') {
          return DBD_JAPAN_TRIO_RENDERER.drawJapanCharacter(ctx, type, r, fieldBlendState, t, px, py, false);
        }
        if (
          type === 'habanero' ||
          type === 'sheriff_habanero' ||
          type === 'sweetcorn' ||
          type === 'quarterback_sweetcorn' ||
          type === 'brisket_onion' ||
          type === 'smokey_onion'
        ) {
          const st = shocked ? 'gag' : cursorNear ? 'near' : 'idle';
          return DBD_USA_TRIO_RENDERER.drawUsaCharacter(ctx, type, r, st, t, px, py, false);
        } // ========================================================================
        // ⛩️ JAPAN 1: SENSEI DAIKON (`daikon`, r: 25) — Giant White Radish
        // Minimalist Carrot-style build:
        //   - 5 unstroked green topknot leaves (exact Carrot leaf fan)
        //   - Smooth tapered white daikon cylinder (pale green neck -> white body, `#475569` 1.8px stroke)
        //   - 1 Extra Thing: Clean black karate belt at waist with 2 swaying tails
        //   - Face: Unstroked white eyes, stern `\ /` brows, simple mouth (blushes red & kicks on hit)
        // ========================================================================
        if (type === 'daikon') {
          const breathe = shocked ? 0 : Math.sin(t * 2.8) * 0.9;
          const squat = cursorNear ? 1.8 : 0;
          const kickTilt = shocked ? -0.16 : 0;
          ctx.save();
          ctx.translate(0, squat);
          ctx.rotate(kickTilt); // 1. Clean unstroked green leaf crown (exact Carrot leaf pattern)
          for (let i = -2; i <= 2; i++) {
            ctx.save();
            ctx.translate(i * 1.9, -r * 1.38 + breathe * 0.4);
            ctx.rotate(i * 0.25 + leafLag);
            ctx.fillStyle = i % 2 === 0 ? '#4ade80' : '#16a34a';
            ell(ctx, 0, -11.5, 4.0, 12.5);
            ctx.restore();
          } // 2. Smooth tapered daikon cylinder silhouette (blushes warm red when hit)
          const dGrad = ctx.createLinearGradient(0, -r * 1.45, 0, 3);
          if (shocked) {
            dGrad.addColorStop(0, '#fecdd3');
            dGrad.addColorStop(0.3, '#fb7185');
            dGrad.addColorStop(1, '#e11d48');
          } else {
            dGrad.addColorStop(0, '#bbf7d0');
            dGrad.addColorStop(0.26, '#ffffff');
            dGrad.addColorStop(1, '#e2e8f0');
          }
          const beltY = -r * 0.48;
          fillClipAndStrokeBody(
            ctx,
            () => {
              ctx.beginPath();
              ctx.moveTo(-r * 0.68, -r * 1.15 + breathe * 0.3);
              ctx.bezierCurveTo(-r * 0.72, -r * 1.5, r * 0.72, -r * 1.5, r * 0.68, -r * 1.15 + breathe * 0.3);
              ctx.quadraticCurveTo(r * 0.6, -r * 0.3, r * 0.28, 2);
              ctx.lineTo(-r * 0.28, 2);
              ctx.quadraticCurveTo(-r * 0.6, -r * 0.3, -r * 0.68, -r * 1.15 + breathe * 0.3);
              ctx.closePath();
            },
            dGrad,
            shocked ? '#881337' : '#475569',
            1.8,
            () => {
              // Clipped black karate waist belt so ends hug the cylinder cleanly
              ctx.fillStyle = '#1e293b';
              ctx.fillRect(-r, beltY, r * 2, 5.2);
            },
          ); // 3. Swaying black belt tails + center knot
          const tailSway = breeze * 2.8 + Math.sin(t * 3.5) * 0.16 + (shocked ? -0.55 : 0);
          for (const dir of [-1, 1]) {
            ctx.save();
            ctx.translate(dir * 2.2, beltY + 3.8);
            ctx.rotate(dir * 0.26 + tailSway);
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.roundRect(-2.1, 0, 4.2, 10.5, 1.5);
            ctx.fill();
            ctx.restore();
          }
          ctx.fillStyle = '#0f172a';
          circ(ctx, 0, beltY + 2.6, 3.2); // 4. Minimal Carrot-style Face
          const eyeY = -r * 0.96 + breathe * 0.2;
          if (shocked) {
            drawWinceEyes(ctx, eyeY, 7.5, 3.2, '#4c0519');
            ctx.fillStyle = '#4c0519';
            ell(ctx, 0, -r * 0.68, 4.0, 3.2); // Clean minimal karate kick swoosh arc on the right
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.lineWidth = 2.2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(r * 0.55, -r * 0.65, 10, -0.7, 0.7);
            ctx.stroke();
          } else {
            drawCleanEyes(ctx, 5.2, eyeY, 3.3, 1.6, px, py, '#0f172a');
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1.9;
            ctx.lineCap = 'round';
            const slant = cursorNear ? 2.2 : 1.4;
            ctx.beginPath();
            ctx.moveTo(-9.0, eyeY - 4.8 - slant * 0.3);
            ctx.lineTo(-2.2, eyeY - 3.2 + slant * 0.4);
            ctx.moveTo(9.0, eyeY - 4.8 - slant * 0.3);
            ctx.lineTo(2.2, eyeY - 3.2 + slant * 0.4);
            ctx.stroke();
            ctx.beginPath();
            if (cursorNear) {
              ctx.arc(0, -r * 0.68, 2.2, 0, Math.PI * 2);
            } else {
              ctx.moveTo(-3.6, -r * 0.68);
              ctx.lineTo(3.6, -r * 0.68);
            }
            ctx.stroke();
          }
          ctx.restore();
          return true;
        } // ========================================================================
        // ⛩️ JAPAN 2: RIKISHI KABOCHA (`kabocha`, r: 30) — Japanese Winter Squash
        // Minimalist Carrot-style build:
        //   - Wide, squat dark-green squash body with 2 subtle rib curves (`#052e16` 1.8px stroke)
        //   - 1st Extra Thing: Simple dark chonmage topknot stem on top
        //   - 2nd Extra Thing: Clean minimal white-and-red sumo belt band clipped to lower belly
        //   - Face: Unstroked white eyes, bold brows, puffed cheeks on hit
        // ========================================================================
        if (type === 'kabocha') {
          const rock = shocked ? 0 : Math.sin(t * 3.0) * 0.08;
          const puffX = shocked ? 1.13 : cursorNear ? 1.04 : 1.0;
          const puffY = shocked ? 0.91 : 1.0;
          ctx.save();
          ctx.rotate(rock);
          ctx.scale(puffX, puffY); // 1. Clean Chonmage topknot stem on crown
          const stemJump = shocked ? 3.5 : 0;
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.roundRect(-3.5, -r * 1.3 - stemJump, 7.0, 10, 3);
          ctx.fill();
          ell(ctx, 0, -r * 1.34 - stemJump, 6.5, 3.4);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(-3.5, -r * 1.22 - stemJump, 7.0, 1.8); // 2. Squat, plump dark-green kabocha squash body + clipped mawashi belt & ribs
          const kGrad = radial(ctx, -7, -r * 0.82, 3, 0, -r * 0.56, r * 1.1, '#4ade80', '#15803d');
          fillClipAndStrokeBody(
            ctx,
            () => {
              ctx.beginPath();
              ctx.ellipse(0, -r * 0.58, r * 0.9, r * 0.64, 0, 0, Math.PI * 2);
            },
            kGrad,
            '#052e16',
            1.8,
            () => {
              // Subtle squash rib lines inside clip
              ctx.strokeStyle = 'rgba(5, 46, 22, 0.32)';
              ctx.lineWidth = 1.4;
              for (const side of [-1, 1]) {
                ctx.beginPath();
                ctx.moveTo(side * r * 0.3, -r * 1.22);
                ctx.quadraticCurveTo(side * r * 0.68, -r * 0.58, side * r * 0.34, 4);
                ctx.stroke();
              } // Minimal white-and-red sumo mawashi belt band cleanly clipped to lower belly
              const beltY = -r * 0.28;
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(-r, beltY, r * 2, 6.5);
              ctx.fillStyle = '#dc2626';
              ctx.fillRect(-r, beltY + 2.0, r * 2, 2.5);
            },
          ); // 3. Minimal Carrot-style Face
          const eyeY = -r * 0.72;
          if (shocked) {
            drawWinceEyes(ctx, eyeY, 8.5, 3.2, '#052e16'); // Puffed pink sumo cheeks on hit
            ctx.fillStyle = 'rgba(251, 113, 133, 0.80)';
            ell(ctx, -12.5, -r * 0.52, 4.8, 3.4);
            ell(ctx, 12.5, -r * 0.52, 4.8, 3.4);
            ctx.strokeStyle = '#052e16';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(0, -r * 0.46, 3.6, Math.PI * 1.15, Math.PI * 1.85);
            ctx.stroke();
          } else {
            drawCleanEyes(ctx, 6.8, eyeY, 3.5, 1.7, px, py, '#052e16');
            ctx.fillStyle = 'rgba(251, 113, 133, 0.32)';
            ell(ctx, -12, -r * 0.54, 4.0, 2.2);
            ell(ctx, 12, -r * 0.54, 4.0, 2.2);
            ctx.strokeStyle = '#052e16';
            ctx.lineWidth = 2.0;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-11, eyeY - 4.8);
            ctx.lineTo(-3, eyeY - 3.2);
            ctx.moveTo(11, eyeY - 4.8);
            ctx.lineTo(3, eyeY - 3.2);
            ctx.stroke();
            ctx.lineWidth = 1.7;
            ctx.beginPath();
            if (cursorNear) {
              ctx.arc(0, -r * 0.48, 2.5, 0, Math.PI * 2);
            } else {
              ctx.arc(0, -r * 0.5, 3.6, 0.15 * Math.PI, 0.85 * Math.PI);
            }
            ctx.stroke();
          }
          ctx.restore();
          return true;
        } // ========================================================================
        // ⛩️ JAPAN 3: SHINOBI WASABI (`wasabi`, r: 21) — Mountain Wasabi Root
        // Minimalist Carrot-style build:
        //   - 3 unstroked green top leaves (exact Radish leaf trio)
        //   - Tapered bright-green rhizome body (clipped ninja cowl headband + lower mask)
        //   - 1 tiny unstroked leaf blade held at side; soft green smoke puffs when hit
        // ========================================================================
        if (type === 'wasabi') {
          const dart = shocked ? 0 : cursorNear ? px * 1.2 : Math.sign(Math.sin(t * 4.8)) * 1.8;
          const crouch = cursorNear ? 1.8 : 0;
          ctx.save();
          ctx.translate(0, crouch); // 1. Clean unstroked 3-leaf crown (exact Radish leaf pattern)
          for (let i = -1; i <= 1; i++) {
            ctx.save();
            ctx.translate(0, -r * 1.4);
            ctx.rotate(i * 0.44 + leafLag);
            ctx.fillStyle = i === 0 ? '#4ade80' : '#16a34a';
            ell(ctx, 0, -8.5, 4.2, 9.5);
            ctx.restore();
          } // 2. Minimal ninja headband tail fluttering on right
          const tailWave = Math.sin(t * 7.5) * 2.2 + breeze * 12;
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 3.0;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(r * 0.52, -r * 1.18);
          ctx.quadraticCurveTo(r * 1.02, -r * 1.26 + tailWave, r * 1.24, -r * 1.06 + tailWave);
          ctx.stroke(); // 3. Tapered wasabi root body (turns spicy red on hit) with clipped ninja cowl bands
          const wGrad = radial(
            ctx,
            -4,
            -r * 0.95,
            2,
            0,
            -r * 0.68,
            r * 1.15,
            shocked ? '#fda4af' : '#bbf7d0',
            shocked ? '#e11d48' : '#22c55e',
          );
          fillClipAndStrokeBody(
            ctx,
            () => {
              ctx.beginPath();
              ctx.moveTo(-r * 0.68, -r * 1.12);
              ctx.bezierCurveTo(-r * 0.72, -r * 1.48, r * 0.72, -r * 1.48, r * 0.68, -r * 1.12);
              ctx.quadraticCurveTo(r * 0.56, -r * 0.3, r * 0.24, 2);
              ctx.lineTo(-r * 0.24, 2);
              ctx.quadraticCurveTo(-r * 0.56, -r * 0.3, -r * 0.68, -r * 1.12);
              ctx.closePath();
            },
            wGrad,
            shocked ? '#881337' : '#14532d',
            1.8,
            () => {
              // Upper ninja headband + lower ninja face wrap cleanly clipped to body contour
              ctx.fillStyle = '#1e293b';
              ctx.fillRect(-r, -r * 1.3, r * 2, 5.2);
              ctx.fillRect(-r, -r * 0.64, r * 2, r * 0.75);
            },
          ); // 4. Tiny unstroked leaf kunai tilted at left side
          ctx.save();
          ctx.translate(-r * 0.66, -r * 0.54);
          ctx.rotate(shocked ? -1.2 : cursorNear ? -0.45 : -0.75 + Math.sin(t * 4) * 0.12);
          ctx.fillStyle = '#15803d';
          ell(ctx, 0, -4.5, 2.4, 6.0);
          ctx.restore(); // 5. Eyes peeking through the slit between headband and mask
          const eyeY = -r * 0.88;
          if (shocked) {
            drawWinceEyes(ctx, eyeY, 6.8, 2.8, '#4c0519'); // 3 minimal translucent green wasabi smoke puffs at base
            ctx.fillStyle = 'rgba(134, 239, 172, 0.72)';
            circ(ctx, -8, -2, 5.5);
            circ(ctx, 8, -3, 5.0);
            circ(ctx, 0, 0, 6.2);
          } else {
            drawCleanEyes(ctx, 4.6, eyeY, 3.1, 1.5, dart, py, '#0f172a');
            ctx.strokeStyle = '#064e3b';
            ctx.lineWidth = 1.8;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-8.2, eyeY - 3.8);
            ctx.lineTo(-2.0, eyeY - 2.6);
            ctx.moveTo(8.2, eyeY - 3.8);
            ctx.lineTo(2.0, eyeY - 2.6);
            ctx.stroke();
          }
          ctx.restore();
          return true;
        } // ========================================================================
        // 🍁 CANADA 1: HOSER RUSSET (`pei_russet`, r: 28) — PEI Red-Clay Potato
        // Minimalist Carrot-style build:
        //   - Plump russet potato body (`#451a03` 1.8px stroke) with clipped red-and-white headband
        //   - Simple curved twig hockey stick at right side
        //   - Face: Unstroked white eyes + small grin showing 1 missing front tooth gap
        // ========================================================================
        if (type === 'pei_russet') {
          ctx.save(); // 1. Plump russet potato body with clipped red-and-white hockey headband
          const pGrad = radial(ctx, -7, -r * 0.88, 3, 0, -r * 0.56, r * 1.1, '#fbbf24', '#b45309');
          fillClipAndStrokeBody(
            ctx,
            () => {
              ctx.beginPath();
              ctx.moveTo(-r * 0.78, -r * 0.34);
              ctx.bezierCurveTo(-r * 0.86, -r * 0.94, -r * 0.52, -r * 1.24, 0, -r * 1.24);
              ctx.bezierCurveTo(r * 0.52, -r * 1.24, r * 0.86, -r * 0.94, r * 0.78, -r * 0.34);
              ctx.bezierCurveTo(r * 0.7, r * 0.06, -r * 0.7, r * 0.06, -r * 0.78, -r * 0.34);
              ctx.closePath();
            },
            pGrad,
            '#451a03',
            1.8,
            () => {
              // Subtle potato freckles
              ctx.fillStyle = 'rgba(120, 53, 15, 0.26)';
              circ(ctx, -12, -10, 1.8);
              circ(ctx, 13, -12, 1.7);
              circ(ctx, -10, -21, 1.5); // Clipped Carrot-style Red & White Hockey Sweatband (never sticks out past forehead!)
              const hbY = -r * 1.04;
              ctx.fillStyle = '#dc2626';
              ctx.fillRect(-r, hbY, r * 2, 5.2);
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(-r, hbY + 1.7, r * 2, 1.8);
            },
          ); // 2. Minimal Face with iconic gap-tooth smile
          const eyeY = -r * 0.68;
          if (shocked) {
            drawWinceEyes(ctx, eyeY, 8.0, 3.2, '#451a03');
          } else {
            drawCleanEyes(ctx, 6.0, eyeY, 3.4, 1.6, px, py, '#1c1917');
            ctx.strokeStyle = '#451a03';
            ctx.lineWidth = 1.8;
            ctx.lineCap = 'round';
            const slant = cursorNear ? 1.8 : 0.6;
            ctx.beginPath();
            ctx.moveTo(-10.0, eyeY - 4.6);
            ctx.lineTo(-2.8, eyeY - 3.8 + slant);
            ctx.moveTo(10.0, eyeY - 4.6);
            ctx.lineTo(2.8, eyeY - 3.8 + slant);
            ctx.stroke();
          } // Small Radish-style dark mouth oval with two white side teeth (missing center tooth!)
          const my = -r * 0.38;
          ctx.fillStyle = '#451a03';
          ell(ctx, 0, my, shocked ? 5.2 : 4.5, shocked ? 3.6 : 2.6);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-3.6, my - 2.2, 2.2, 1.8);
          ctx.fillRect(1.4, my - 2.2, 2.2, 1.8); // 3. Minimal single-stroke twig hockey stick tapping dirt at right side
          ctx.save();
          const tapRot = shocked ? -0.95 : cursorNear ? 0.35 : Math.abs(Math.sin(t * 6.5)) * 0.16;
          ctx.translate(r * 0.66, -r * 0.42);
          ctx.rotate(tapRot);
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 2.6;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(-2, -7);
          ctx.lineTo(6, 11);
          ctx.lineTo(13, 9.5);
          ctx.stroke();
          ctx.restore();
          ctx.restore();
          return true;
        } // ========================================================================
        // 🍁 CANADA 2: LUMBERJACK FIDDLEHEAD (`fiddlehead`, r: 23) — Ostrich Fern
        // Minimalist Carrot-style build:
        //   - Coiled green spiral fern body with a cute curled spiral tail on the right
        //   - 1st Extra Thing: Compact red-and-black plaid trapper hat with earflaps
        //   - 2nd Extra Thing: Clean brown lumberjack chin beard framing lower jaw
        // ========================================================================
        if (type === 'fiddlehead') {
          const springStretch = shocked ? 1.18 : 1.0 + Math.sin(t * 3.6) * 0.03;
          ctx.save();
          ctx.scale(1 / Math.sqrt(springStretch), springStretch); // 1. Coiled fern spiral tail peeking out on the right side (flexes like a little coiled stem!)
          ctx.save();
          ctx.translate(r * 0.62, -r * 0.46);
          ctx.rotate(shocked ? -0.55 : -0.15 - Math.abs(Math.sin(t * 3.6)) * 0.25);
          ctx.fillStyle = '#16a34a';
          ctx.strokeStyle = '#052e16';
          ctx.lineWidth = 1.6;
          circ(ctx, 4, -3, 5.2);
          ctx.stroke();
          ctx.strokeStyle = '#86efac';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(4, -3, 2.6, 0, Math.PI * 1.3);
          ctx.stroke();
          ctx.restore(); // 2. Plump green fern bulb with clipped chin-beard & inner spiral curl
          const fGrad = radial(ctx, -5, -r * 0.85, 2, 0, -r * 0.62, r * 1.05, '#86efac', '#15803d');
          fillClipAndStrokeBody(
            ctx,
            () => {
              ctx.beginPath();
              ctx.ellipse(0, -r * 0.66, r * 0.76, r * 0.72, 0, 0, Math.PI * 2);
            },
            fGrad,
            '#052e16',
            1.8,
            () => {
              // Clean brown lumberjack chin-beard clipped to the lower jaw
              ctx.fillStyle = '#78350f';
              ctx.beginPath();
              ctx.moveTo(-r, -r * 0.44);
              ctx.quadraticCurveTo(0, -r * 0.28, r, -r * 0.44);
              ctx.lineTo(r, 4);
              ctx.lineTo(-r, 4);
              ctx.closePath();
              ctx.fill();
              ctx.strokeStyle = '#451a03';
              ctx.lineWidth = 1.5;
              ctx.stroke();
            },
          ); // Tiny warm breath puff in cold air during idle
          if (!shocked) {
            const bp = (t * 0.7) % 1;
            ctx.fillStyle = `rgba(255, 255, 255, ${(1 - bp) * 0.55})`;
            circ(ctx, -10 - bp * 7, -r * 0.52 - bp * 6, 2.2 + bp * 1.8);
          } // 3. Minimal Face above the beard
          const eyeY = -r * 0.74;
          if (shocked) {
            drawWinceEyes(ctx, eyeY, 6.8, 2.8, '#052e16');
          } else {
            drawCleanEyes(ctx, 5.2, eyeY, 3.2, 1.5, px, py, '#052e16');
          }
          ctx.strokeStyle = '#fef3c7';
          ctx.lineWidth = 1.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          if (shocked || cursorNear) {
            ctx.arc(0, -r * 0.4, 2.0, 0, Math.PI * 2);
          } else {
            ctx.arc(0, -r * 0.43, 2.8, 0.15 * Math.PI, 0.85 * Math.PI);
          }
          ctx.stroke(); // 4. Compact Canadian Plaid Trapper Hat (from original `canola` design)
          const flapLift = shocked ? -0.85 : cursorNear ? -0.3 : 0.1;
          const hatJump = shocked ? 5.5 : 0;
          ctx.save();
          ctx.translate(0, -r * 1.16 - hatJump);
          for (const dir of [-1, 1]) {
            ctx.save();
            ctx.translate(dir * 12.5, 2);
            ctx.rotate(dir * flapLift);
            ctx.fillStyle = '#dc2626';
            ctx.strokeStyle = '#450a0a';
            ctx.lineWidth = 1.3;
            ell(ctx, 0, 5.5, 3.5, 6.0);
            ctx.stroke();
            ctx.restore();
          }
          ctx.fillStyle = '#dc2626';
          ctx.strokeStyle = '#450a0a';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 2, 13.5, Math.PI, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = 'rgba(17, 24, 39, 0.48)';
          ctx.fillRect(-8.5, -7.5, 3.8, 8.5);
          ctx.fillRect(3.0, -7.5, 3.8, 8.5);
          ctx.fillStyle = '#fef3c7';
          ctx.beginPath();
          ctx.roundRect(-11.5, -3.0, 23, 5.8, 2.8);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          ctx.restore();
          return true;
        } // ========================================================================
        // 🍁 CANADA 3: MOUNTIE SASKABERRY (`saskaberry`, r: 24) — Saskatoon Berry
        // Minimalist Carrot-style build:
        //   - Clean plump purple berry body (`#ddd6fe` -> `#5b21b6`, `#2e1065` 1.8px stroke)
        //   - 1 Extra Thing: Iconic wide-brimmed tan Stetson campaign hat on top
        //   - Face: Unstroked white eyes + polite whistling `o` mouth (blushes crimson & hat pops up on hit)
        // ========================================================================
        if (type === 'saskaberry') {
          const bob = shocked ? 0 : Math.sin(t * 3.8) * 0.8;
          ctx.save();
          ctx.translate(0, bob); // 1. Plump purple berry body (blushes beet-crimson when hit)
          ctx.fillStyle = radial(
            ctx,
            -5,
            -r * 0.88,
            2,
            0,
            -r * 0.65,
            r * 1.05,
            shocked ? '#fda4af' : '#ddd6fe',
            shocked ? '#be123c' : '#5b21b6',
          );
          ctx.strokeStyle = shocked ? '#881337' : '#2e1065';
          ctx.lineWidth = 1.8;
          circ(ctx, 0, -r * 0.68, r * 0.78);
          ctx.stroke(); // 2. Minimal Face
          const eyeY = -r * 0.72;
          if (shocked) {
            drawWinceEyes(ctx, eyeY, 7.2, 3.0, '#4c0519');
            ctx.fillStyle = '#4c0519';
            ell(ctx, 0, -r * 0.44, 3.6, 3.0); // Tiny minimal red ticket peeking at left side on hit
            ctx.save();
            ctx.translate(-r * 0.82, -r * 0.58);
            ctx.rotate(-0.25);
            ctx.fillStyle = '#ef4444';
            ctx.strokeStyle = '#7f1d1d';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.roundRect(-4.5, -6.5, 9.0, 13.0, 1.5);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          } else {
            drawCleanEyes(ctx, 5.2, eyeY, 3.3, 1.5, px, py, '#1e1b4b');
            ctx.strokeStyle = '#2e1065';
            ctx.lineWidth = 1.7;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-8.5, eyeY - 4.5);
            ctx.lineTo(-2.5, eyeY - 3.8);
            ctx.moveTo(8.5, eyeY - 4.5);
            ctx.lineTo(2.5, eyeY - 3.8);
            ctx.stroke(); // Cheerful whistling O-mouth
            ctx.fillStyle = '#2e1065';
            circ(ctx, cursorNear ? 0 : 1.5, -r * 0.45, 2.1);
          } // 3. ONE Extra Thing: Clean Tan Mountie Stetson Hat on top
          const hatPop = shocked ? 8.5 : 0;
          const hatTilt = shocked ? -0.18 : Math.sin(t * 3.2) * 0.07;
          ctx.save();
          ctx.translate(0, -r * 1.18 - hatPop);
          ctx.rotate(hatTilt);
          ctx.fillStyle = '#d6b37c';
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 1.5;
          ell(ctx, 0, 2, 19.5, 4.0);
          ctx.stroke();
          ctx.fillStyle = '#c29b61';
          ctx.beginPath();
          ctx.moveTo(-10, 1.5);
          ctx.quadraticCurveTo(-8.5, -12.5, -3.0, -11.5);
          ctx.quadraticCurveTo(0, -14.0, 3.0, -11.5);
          ctx.quadraticCurveTo(8.5, -12.5, 10, 1.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#78350f';
          ctx.fillRect(-9.5, -1.8, 19.0, 2.6);
          ctx.restore();
          ctx.restore();
          return true;
        } // ========================================================================
        // 🌴 BRAZIL 1: CARNAVALE ABACAXI (`abacaxi`, r: 28) — Pérola Pineapple
        // Minimalist Carrot-style build:
        //   - Vibrant unstroked Carnival feather plumes fanning visibly behind green pineapple crown
        //   - Golden oval pineapple body with clipped soft diamond cross-hatch (`#78350f` 1.8px stroke)
        //   - Clean neon sunglasses (in idle over eyes; when hit, drop slightly below eyes to reveal
        //     wide furious eyes & `\ /` brows while crown shakes like maracas!)
        // ========================================================================
        if (type === 'abacaxi') {
          const samba = Math.sin(t * (shocked ? 28 : 8.5)) * (shocked ? 3.2 : 1.8);
          const tilt = Math.cos(t * (shocked ? 28 : 8.5)) * (shocked ? 0.12 : 0.06);
          ctx.save();
          ctx.translate(samba, 0);
          ctx.rotate(tilt); // 1. Vibrant unstroked Carnival feathers + green pineapple leaf crown (zero outlines!)
          const crownJump = shocked ? 4.0 : 0;
          const crownShake = shocked ? Math.sin(tNow * 45) * 0.18 : 0;
          ctx.save();
          ctx.translate(0, -r * 1.24 - crownJump);
          ctx.rotate(leafLag + crownShake); // 5 tall, vibrant unstroked Carnival plumes fanning behind the green leaves
          for (const [ang, col, rx, ry] of [
            [-0.68, '#ec4899', 4.2, 13.5],
            [-0.34, '#06b6d4', 4.4, 15.5],
            [0.0, '#facc15', 4.6, 17.0],
            [0.34, '#4ade80', 4.4, 15.5],
            [0.68, '#ec4899', 4.2, 13.5],
          ]) {
            ctx.save();
            ctx.rotate(ang);
            ctx.fillStyle = col;
            ell(ctx, 0, -ry * 0.95, rx, ry);
            ctx.restore();
          } // 5 shorter unstroked tropical green pineapple leaves in front
          for (let i = -2; i <= 2; i++) {
            ctx.save();
            ctx.rotate(i * 0.24);
            ctx.fillStyle = i % 2 === 0 ? '#10b981' : '#047857';
            ell(ctx, 0, -8.5, 3.5, 9.5);
            ctx.restore();
          }
          ctx.restore(); // 2. Golden pineapple oval body with clipped soft diamond grid
          const aGrad = radial(ctx, -6, -r * 0.85, 2, 0, -r * 0.65, r * 1.1, '#fef08a', '#d97706');
          fillClipAndStrokeBody(
            ctx,
            () => {
              ctx.beginPath();
              ctx.ellipse(0, -r * 0.68, r * 0.74, r * 0.78, 0, 0, Math.PI * 2);
            },
            aGrad,
            '#78350f',
            1.8,
            () => {
              ctx.strokeStyle = 'rgba(146, 64, 14, 0.24)';
              ctx.lineWidth = 1.2;
              for (let d = -12; d <= 12; d += 8) {
                ctx.beginPath();
                ctx.moveTo(d - 10, -r * 1.35);
                ctx.lineTo(d + 10, -r * 0.05);
                ctx.moveTo(d + 10, -r * 1.35);
                ctx.lineTo(d - 10, -r * 0.05);
                ctx.stroke();
              }
            },
          ); // 3. Eyes at `-r * 0.90` (revealed when sunglasses drop down on hit/cursorNear!)
          const eyeY = -r * 0.9;
          const shadeDrop = shocked ? 6.2 : cursorNear ? 4.2 : 0;
          if (shadeDrop > 0) {
            drawCleanEyes(ctx, 5.4, eyeY, shocked ? 3.5 : 3.1, 1.6, px, py, '#451a03');
            if (shocked) {
              // Furious `\ /` eyebrows above wide eyes!
              ctx.strokeStyle = '#451a03';
              ctx.lineWidth = 2.0;
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.moveTo(-9.5, eyeY - 4.8);
              ctx.lineTo(-2.2, eyeY - 2.6);
              ctx.moveTo(9.5, eyeY - 4.8);
              ctx.lineTo(2.2, eyeY - 2.6);
              ctx.stroke();
            }
          } // 4. Clean Tropical Sunglasses (cover eyes at `-r * 0.84` in idle; drop to `-r * 0.62` when hit!)
          ctx.save();
          ctx.translate(0, -r * 0.84 + shadeDrop);
          ctx.rotate(shocked ? 0.1 : 0);
          ctx.strokeStyle = '#be185d';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-11, -1);
          ctx.lineTo(11, -1);
          ctx.stroke();
          for (const lx of [-5.8, 5.8]) {
            ctx.fillStyle = '#ec4899';
            ctx.strokeStyle = '#9d174d';
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.roundRect(lx - 5.0, -3.2, 10.0, 6.2, 2.5);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#1e1b4b';
            ctx.beginPath();
            ctx.roundRect(lx - 3.6, -2.0, 7.2, 3.8, 1.5);
            ctx.fill();
          }
          ctx.restore(); // 5. Simple joyful smile or surprised O-mouth at `-r * 0.34` (well below dropped shades!)
          ctx.strokeStyle = '#451a03';
          ctx.fillStyle = '#451a03';
          ctx.lineWidth = 1.7;
          ctx.lineCap = 'round';
          if (shocked) {
            circ(ctx, 0, -r * 0.34, 3.0);
          } else {
            ctx.beginPath();
            ctx.arc(0, -r * 0.42, 4.2, 0.12 * Math.PI, 0.88 * Math.PI);
            ctx.stroke();
          }
          ctx.restore();
          return true;
        } // ========================================================================
        // 🌴 BRAZIL 2: GINGA MANDIOCA (`mandioca`, r: 25) — Amazonian Cassava Root
        // Minimalist Carrot-style build:
        //   - 5 unstroked palmate green leaves on top (exact Carrot leaf fan)
        //   - Tapered woody-brown cassava root silhouette (exact Carrot body geometry!)
        //   - Clipped yellow-and-green Brazilian headband + minimal white cordão waist cord
        // ========================================================================
        if (type === 'mandioca') {
          const gingaX = shocked ? 0 : Math.sin(t * 4.5) * 3.5;
          const gingaRot = shocked ? Math.sin(tNow * 28) * 0.48 : cursorNear ? -0.14 : Math.sin(t * 4.5) * 0.12;
          ctx.save();
          ctx.translate(gingaX, 0);
          ctx.rotate(gingaRot); // 1. Clean unstroked 5-leaf palmate crown (exact Carrot leaf fan)
          for (let i = -2; i <= 2; i++) {
            ctx.save();
            ctx.translate(i * 1.8, -r * 1.38);
            ctx.rotate(i * 0.28 + leafLag);
            ctx.fillStyle = i % 2 === 0 ? '#4ade80' : '#15803d';
            ell(ctx, 0, -11.5, 3.8, 12.5);
            ctx.restore();
          } // 2. Tapered woody-brown cassava root silhouette (exact Carrot bezier cone!)
          const mGrad = radial(ctx, -4, -r, 2, 0, -r * 0.7, r * 1.2, '#e7cba9', '#78350f');
          fillClipAndStrokeBody(
            ctx,
            () => {
              ctx.beginPath();
              ctx.moveTo(-r * 0.68, -r * 1.15);
              ctx.bezierCurveTo(-r * 0.72, -r * 1.48, r * 0.72, -r * 1.48, r * 0.68, -r * 1.15);
              ctx.quadraticCurveTo(r * 0.5, -r * 0.28, r * 0.2, 2);
              ctx.lineTo(-r * 0.2, 2);
              ctx.quadraticCurveTo(-r * 0.5, -r * 0.28, -r * 0.68, -r * 1.15);
              ctx.closePath();
            },
            mGrad,
            '#451a03',
            1.8,
            () => {
              // Clipped Yellow & Green Brazilian Sweatband at forehead
              ctx.fillStyle = '#facc15';
              ctx.fillRect(-r, -r * 1.26, r * 2, 5.0);
              ctx.fillStyle = '#16a34a';
              ctx.fillRect(-r, -r * 1.26 + 1.6, r * 2, 1.8); // Clipped minimal white capoeira cordão rope belt near base
              ctx.fillStyle = '#f8fafc';
              ctx.fillRect(-r, -r * 0.3, r * 2, 3.2);
            },
          ); // 3. Minimal Carrot-style Face
          const eyeY = -r * 0.86;
          if (shocked) {
            drawWinceEyes(ctx, eyeY, 7.0, 3.0, '#fffbeb');
            ctx.fillStyle = '#fffbeb';
            circ(ctx, 0, -r * 0.55, 2.8);
          } else {
            drawCleanEyes(ctx, 4.8, eyeY, 3.2, 1.5, px, py, '#1c1917');
            ctx.strokeStyle = '#291502';
            ctx.lineWidth = 1.8;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-8.0, -r * 1.0);
            ctx.lineTo(-2.0, -r * 0.95);
            ctx.moveTo(8.0, -r * 1.0);
            ctx.lineTo(2.0, -r * 0.95);
            ctx.stroke();
            ctx.strokeStyle = '#fffbeb';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            if (cursorNear) {
              ctx.arc(0, -r * 0.54, 2.2, 0, Math.PI * 2);
            } else {
              ctx.arc(0, -r * 0.58, 3.6, 0.12 * Math.PI, 0.88 * Math.PI);
            }
            ctx.stroke();
          }
          ctx.restore();
          return true;
        } // ========================================================================
        // 🌴 BRAZIL 3: CRAQUE GUARANÁ (`guarana`, r: 22) — Amazonian Guaraná Berry
        // Minimalist Radish-style build:
        //   - 3 unstroked green leaves on top (exact Radish leaf trio)
        //   - Crisp round red berry body (`#fda4af` -> `#e11d48`, `#881337` 1.7px stroke)
        //   - Clipped yellow-and-green waist stripe + giant unstroked white guaraná seed-eye
        //   - Bounces a tiny white pebble ball in idle; flops & shows tiny red card on hit!
        // ========================================================================
        if (type === 'guarana') {
          const juggle = Math.abs(Math.sin(t * 6.8));
          const bounce = shocked ? 0 : juggle * 2.5;
          const flopTilt = shocked ? 0.32 * Math.sin(tNow * 25) : 0;
          ctx.save();
          ctx.translate(0, -bounce);
          ctx.rotate(flopTilt); // 1. Clean unstroked 3-leaf crown (exact Radish leaf trio)
          for (let i = -1; i <= 1; i++) {
            ctx.save();
            ctx.translate(0, -r * 1.44);
            ctx.rotate(i * 0.46 + leafLag);
            ctx.fillStyle = i === 0 ? '#4ade80' : '#15803d';
            ell(ctx, 0, -8.5, 4.2, 9.5);
            ctx.restore();
          } // 2. Round crimson guaraná berry body with clipped yellow-and-green band
          const gGrad = radial(ctx, -4, -r * 0.95, 1.5, 0, -r * 0.75, r, '#fda4af', '#e11d48');
          fillClipAndStrokeBody(
            ctx,
            () => {
              ctx.beginPath();
              ctx.arc(0, -r * 0.78, r * 0.82, 0, Math.PI * 2);
            },
            gGrad,
            '#881337',
            1.7,
            () => {
              const bandY = -r * 0.36;
              ctx.fillStyle = '#facc15';
              ctx.fillRect(-r, bandY, r * 2, 4.4);
              ctx.fillStyle = '#16a34a';
              ctx.fillRect(-r, bandY + 2.8, r * 2, 1.6);
            },
          ); // Tiny bouncing white pebble soccer ball at right side in idle
          if (!shocked) {
            ctx.fillStyle = '#f8fafc';
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1.2;
            circ(ctx, r * 0.92, -3 - juggle * 9, 3.0);
            ctx.stroke();
          } else {
            // Tiny clean Red Card held up on hit!
            ctx.save();
            ctx.translate(-r * 0.85, -r * 1.05);
            ctx.rotate(-0.22);
            ctx.fillStyle = '#ef4444';
            ctx.strokeStyle = '#7f1d1d';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.roundRect(-4.2, -6.0, 8.4, 12.0, 1.5);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          } // 3. Giant unstroked white Guaraná Aril Eye + glossy black seed pupil
          const eyeY = -r * 0.84;
          ctx.fillStyle = '#ffffff';
          ell(ctx, 0, eyeY, r * 0.46, r * 0.4);
          if (shocked) {
            drawWinceEyes(ctx, eyeY, 6.2, 2.8, '#4c0519');
          } else {
            ctx.fillStyle = '#111827';
            circ(ctx, px * 0.75, eyeY + py * 0.65, cursorNear ? 4.4 : 4.0);
            ctx.fillStyle = '#ffffff';
            circ(ctx, px * 0.75 - 1.4, eyeY + py * 0.65 - 1.4, 1.3);
            ctx.strokeStyle = '#4c0519';
            ctx.lineWidth = 1.9;
            ctx.lineCap = 'round';
            ctx.beginPath();
            if (cursorNear) {
              ctx.moveTo(-7.5, eyeY - 7.5);
              ctx.lineTo(0, eyeY - 5.5);
              ctx.lineTo(7.5, eyeY - 7.5);
            } else {
              ctx.arc(0, eyeY - 2.0, r * 0.48, Math.PI * 1.2, Math.PI * 1.8);
            }
            ctx.stroke();
          }
          ctx.restore();
          return true;
        } // ========================================================================
        // ⚜️ FRANCE 1: MONSIEUR ÉCHALOTE (`echalote`, r: 23) — French Grey Shallot
        // Minimalist Drama-Onion / Carrot-style build:
        //   - 3 unstroked green shoot tips on top
        //   - Smooth coppery-purple teardrop bulb (`#f3e8ff` -> `#9333ea`, `#581c87` 1.8px stroke)
        //     with a clean clipped red neck kerchief stripe at base
        //   - Tilted black beret on top + thin curled pencil mustache under eyes
        // ========================================================================
        if (type === 'echalote') {
          const sway = shocked ? 0 : Math.sin(t * 2.5) * 0.04;
          ctx.save();
          ctx.rotate(sway); // 1. Unstroked green shoot tips
          for (let i = -1; i <= 1; i++) {
            ctx.save();
            ctx.translate(i * 2.0, -r * 1.3);
            ctx.rotate(i * 0.22 + leafLag);
            ctx.fillStyle = i === 0 ? '#4ade80' : '#16a34a';
            ell(ctx, 0, -7.5, 2.8, 8.5);
            ctx.restore();
          } // 2. Smooth teardrop shallot bulb (exact Drama-Queen Onion silhouette)
          const eGrad = radial(ctx, -5, -r * 0.85, 2, 0, -r * 0.58, r * 1.05, '#f3e8ff', '#9333ea');
          fillClipAndStrokeBody(
            ctx,
            () => {
              ctx.beginPath();
              ctx.moveTo(0, -r * 1.32);
              ctx.bezierCurveTo(r * 0.44, -r * 1.05, r * 0.88, -r * 0.8, r * 0.84, -r * 0.34);
              ctx.bezierCurveTo(r * 0.78, r * 0.05, -r * 0.78, r * 0.05, -r * 0.84, -r * 0.34);
              ctx.bezierCurveTo(-r * 0.88, -r * 0.8, -r * 0.44, -r * 1.05, 0, -r * 1.32);
              ctx.closePath();
            },
            eGrad,
            '#581c87',
            1.8,
            () => {
              // Minimal red Parisian neck kerchief band clipped cleanly at base
              ctx.fillStyle = '#dc2626';
              ctx.fillRect(-r, -r * 0.2, r * 2, 4.2);
            },
          ); // 3. Clean tilted black French beret perched on top (pops up when hit!)
          const beretPop = shocked ? 6.5 : 0;
          ctx.save();
          ctx.translate(2.0, -r * 1.2 - beretPop);
          ctx.rotate(shocked ? -0.18 : 0.16);
          ctx.fillStyle = '#1e293b';
          ell(ctx, 0, 0, 14.0, 4.4);
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, -3.5);
          ctx.lineTo(1.5, -7.0);
          ctx.stroke();
          ctx.restore(); // 4. Minimal Face + Thin Curled Mustache
          const eyeY = -r * 0.66;
          if (shocked) {
            drawWinceEyes(ctx, eyeY, 7.2, 2.8, '#3b0764');
            ctx.fillStyle = '#3b0764';
            circ(ctx, 0, -r * 0.32, 2.6);
          } else {
            drawCleanEyes(ctx, 5.2, eyeY, 3.1, 1.4, px, py, '#1e1b4b');
            ctx.strokeStyle = '#3b0764';
            ctx.lineWidth = 1.8;
            ctx.lineCap = 'round';
            ctx.beginPath();
            if (cursorNear) {
              ctx.moveTo(-8.5, eyeY - 4.8);
              ctx.lineTo(-2.5, eyeY - 3.8);
              ctx.moveTo(8.5, eyeY - 5.8);
              ctx.lineTo(2.5, eyeY - 4.0);
            } else {
              ctx.moveTo(-8.5, eyeY - 3.6);
              ctx.lineTo(-2.0, eyeY - 3.6);
              ctx.moveTo(8.5, eyeY - 4.4);
              ctx.lineTo(2.0, eyeY - 3.4);
            }
            ctx.stroke();
          } // Clean thin pencil-twist mustache
          const musY = -r * 0.44;
          ctx.strokeStyle = '#1e1b4b';
          ctx.lineWidth = 1.6;
          ctx.lineCap = 'round';
          for (const dir of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(0, musY);
            ctx.quadraticCurveTo(dir * 5.0, musY + 1.8, dir * 9.5, musY - 1.5);
            ctx.stroke();
          }
          ctx.restore();
          return true;
        } // ========================================================================
        // ⚜️ FRANCE 2: CHEVALIER ARTICHAUT (`artichaut`, r: 28) — Globe Artichoke
        // Minimalist Golden-Corn / Lord-Cabbage-style build:
        //   - Outer green artichoke bract leaves cradling the LEFT & RIGHT sides and base
        //     of the artichoke bud (like Golden Corn's outer husk leaves!), forming an
        //     unmistakable layered artichoke silhouette while keeping the central face 100% smooth!
        //   - Clean blue cavalier hat with a sweeping white feather plume across the front brim
        //   - Clean white handlebar mustache & tiny goatee dot
        // ========================================================================
        if (type === 'artichaut') {
          const flare = shocked ? 0.22 : cursorNear ? 0.08 : 0;
          ctx.save(); // 1. Outer layered artichoke bract leaves cradling the sides (BEHIND the central heart)
          // Upper-side bracts
          for (const dir of [-1, 1]) {
            ctx.save();
            ctx.translate(dir * r * 0.48, -r * 0.55);
            ctx.rotate(dir * (0.42 + flare) + leafLag * 0.5);
            ctx.fillStyle = '#15803d';
            ctx.strokeStyle = '#14532d';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(-5, 6);
            ctx.quadraticCurveTo(-6, -10, 0, -17);
            ctx.quadraticCurveTo(6, -10, 5, 6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          } // Lower-side cradling artichoke bract leaves (drawn BEHIND the central heart!)
          for (const dir of [-1, 1]) {
            ctx.save();
            ctx.translate(dir * r * 0.56, -r * 0.24);
            ctx.rotate(dir * (0.58 + flare * 0.8) + leafLag * 0.4);
            ctx.fillStyle = '#16a34a';
            ctx.strokeStyle = '#14532d';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(-5, 4);
            ctx.quadraticCurveTo(-5, -9, 0, -15);
            ctx.quadraticCurveTo(5, -9, 5, 4);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          } // 2. Smooth central artichoke heart body in front (`#ecfccb` -> `#4ade80`, `#14532d` 1.8px stroke)
          ctx.fillStyle = radial(ctx, -6, -r * 0.9, 3, 0, -r * 0.64, r, '#ecfccb', '#22c55e');
          ctx.strokeStyle = '#14532d';
          ctx.lineWidth = 1.8;
          ell(ctx, 0, -r * 0.66, r * 0.72, r * 0.72);
          ctx.stroke(); // 3. Clean Face + White Musketeer Mustache & Goatee on the smooth central heart
          const eyeY = -r * 0.7;
          if (shocked) {
            drawWinceEyes(ctx, eyeY, 7.5, 3.0, '#14532d');
          } else {
            drawCleanEyes(ctx, 5.8, eyeY, 3.4, 1.6, px, py, '#14532d');
            ctx.strokeStyle = '#14532d';
            ctx.lineWidth = 1.9;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-10, eyeY - 4.8);
            ctx.lineTo(-2.5, eyeY - 3.6);
            ctx.moveTo(10, eyeY - 4.8);
            ctx.lineTo(2.5, eyeY - 3.6);
            ctx.stroke();
          } // Clean unstroked white mustache + tiny pointed goatee dot
          const musY = -r * 0.46;
          ctx.fillStyle = '#ffffff';
          ell(ctx, -4.5, musY, 5.2, 2.2, -0.22);
          ell(ctx, 4.5, musY, 5.2, 2.2, 0.22);
          ell(ctx, 0, musY + 4.0, 1.8, 2.8); // 4. Minimal Cavalier Hat with a visible White Feather Plume sweeping across the hat!
          const hatPop = shocked ? 6.5 : 0;
          ctx.save();
          ctx.translate(0, -r * 1.24 - hatPop);
          ctx.rotate(shocked ? -0.14 : 0.06); // Blue cavalier crown & wide brim
          ctx.fillStyle = '#1d4ed8';
          ctx.strokeStyle = '#1e3a8a';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 1, 10.5, Math.PI, 0);
          ctx.fill();
          ctx.stroke();
          ell(ctx, 0, 2, 18.5, 3.6, -0.06);
          ctx.stroke(); // Sweeping white feather plume drawn IN FRONT of crown edge so it's 100% visible!
          ctx.fillStyle = '#ffffff';
          ell(ctx, 7, -4.5, 9.5, 3.2, -0.28);
          ctx.restore();
          ctx.restore();
          return true;
        } // ========================================================================
        // ⚜️ FRANCE 3: DIVA LAVANDE (`lavender`, r: 23) — Provence Lavender Bundle
        // Minimalist Carrot-style build:
        //   - 5 clean unstroked purple lavender spikes on top (exact Carrot 5-leaf fan!)
        //   - Smooth lavender-sheaf body with clipped French tricolore ribbon stripe at waist
        //   - Clean cat-eye sunglasses (in idle over eyes; drop slightly when hit to reveal
        //     scandalized `> <` eyes above them + soft purple perfume puffs!)
        // ========================================================================
        if (type === 'lavender') {
          const sway = Math.sin(t * (shocked ? 26 : 3.2)) * (shocked ? 2.2 : 1.0);
          ctx.save();
          ctx.translate(sway, 0); // 1. Clean 5-spike unstroked purple lavender crown (exact Carrot 5-leaf fan geometry!)
          for (let i = -2; i <= 2; i++) {
            ctx.save();
            ctx.translate(i * 2.0, -r * 1.32);
            ctx.rotate(i * 0.25 + leafLag);
            ctx.fillStyle = i % 2 === 0 ? '#a855f7' : '#7e22ce';
            ell(ctx, 0, -11.0, 3.8, 12.0);
            ctx.fillStyle = '#e9d5ff';
            circ(ctx, 0, -19.5, 1.8);
            ctx.restore();
          } // 2. Smooth lavender sheaf body with clipped tricolore waist ribbon
          const lGrad = radial(ctx, -4, -r * 0.9, 2, 0, -r * 0.65, r * 1.1, '#f3e8ff', '#7c3aed');
          fillClipAndStrokeBody(
            ctx,
            () => {
              ctx.beginPath();
              ctx.ellipse(0, -r * 0.68, r * 0.72, r * 0.74, 0, 0, Math.PI * 2);
            },
            lGrad,
            '#4c1d95',
            1.8,
            () => {
              const ribY = -r * 0.28;
              ctx.fillStyle = '#ef4444';
              ctx.fillRect(-r, ribY, r * 2, 4.2);
              ctx.fillStyle = '#2563eb';
              ctx.fillRect(-r * 0.72, ribY, r * 0.48, 4.2);
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(-r * 0.24, ribY, r * 0.48, 4.2);
            },
          ); // 3. Eyes at `-r * 0.90` (revealed when cat-eye shades drop slightly on hit/cursorNear!)
          const eyeY = -r * 0.9;
          const shadeDrop = shocked ? 5.5 : cursorNear ? 3.8 : 0;
          if (shocked) {
            drawWinceEyes(ctx, eyeY, 6.5, 2.6, '#2e1065'); // 2 soft translucent lavender perfume mist puffs on the right
            ctx.fillStyle = 'rgba(216, 180, 254, 0.70)';
            circ(ctx, r * 0.88, -r * 0.65, 5.2);
            circ(ctx, r * 1.15, -r * 0.82, 6.8);
          } else if (cursorNear) {
            drawCleanEyes(ctx, 4.8, eyeY, 3.0, 1.4, px, py, '#2e1065');
          } // 4. Minimal Cat-Eye Sunglasses (sit at `-r * 0.82` in idle; dip to `-r * 0.58` when hit)
          ctx.save();
          ctx.translate(0, -r * 0.82 + shadeDrop);
          ctx.rotate(shocked ? 0.08 : 0);
          for (const dir of [-1, 1]) {
            ctx.fillStyle = '#faf5ff';
            ctx.strokeStyle = '#4c1d95';
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(dir * 1.0, -0.5);
            ctx.quadraticCurveTo(dir * 6.5, -5.2, dir * 11.8, -5.8);
            ctx.quadraticCurveTo(dir * 10.8, 2.8, dir * 5.5, 3.0);
            ctx.quadraticCurveTo(dir * 1.5, 2.6, dir * 1.0, -0.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#2e1065';
            ell(ctx, dir * 6.0, -1.0, 3.5, 2.0, dir * -0.22);
          }
          ctx.restore(); // 5. Simple mouth at `-r * 0.42`
          ctx.strokeStyle = '#2e1065';
          ctx.fillStyle = '#2e1065';
          ctx.lineWidth = 1.6;
          ctx.lineCap = 'round';
          if (shocked) {
            circ(ctx, 0, -r * 0.4, 2.5);
          } else {
            ctx.beginPath();
            ctx.arc(0, -r * 0.48, 2.8, 0.15 * Math.PI, 0.85 * Math.PI);
            ctx.stroke();
          }
          ctx.restore();
          return true;
        } // Legacy fallback for `canola`
        if (type === 'canola') {
          ctx.fillStyle = radial(ctx, -4, -r * 0.85, 2, 0, -r * 0.65, r, '#fef08a', '#eab308');
          ctx.strokeStyle = '#854d0e';
          ctx.lineWidth = 1.8;
          ell(ctx, 0, -r * 0.68, r * 0.78, r * 0.7);
          ctx.stroke();
          drawCleanEyes(ctx, 5.2, -r * 0.7, 3.3, 1.5, px, py, '#1e293b');
          return true;
        }
        return false;
      } // Helper to render any of the 12 regional characters (plus Carrot & Radish) on a
      // preview canvas for the interactive "12 Veggies Studio & Showcase" modal!
      function drawPreviewCharacter(ctx, type, stateMode, tNow, scale = 1.0) {
        const CROP = window.DBD_CROPS || {};
        const def = CROP[type] || CROP.daikon;
        if (!def) return;
        let shocked = false;
        let cursorNear = false;
        let eyeVal = 0;
        if (stateMode === 'gag') {
          shocked = true;
          eyeVal = Math.floor(tNow * 1.4) % 2 === 0 ? 0.85 : 0.45;
        } else if (stateMode === 'near') {
          cursorNear = true;
        } else if (stateMode === 'cycle') {
          const phase = tNow % 4.5;
          if (phase >= 3.0) {
            shocked = true;
            eyeVal = phase < 3.7 ? 0.85 : 0.45;
          } else if (phase >= 1.8) {
            cursorNear = true;
          }
        }
        const r = def.r;
        const breeze = Math.sin(tNow * 2.4) * 0.06;
        const px = cursorNear ? 1.6 : Math.sin(tNow * 1.8) * 1.1;
        const py = cursorNear ? -0.8 : 0;
        ctx.save();
        ctx.scale(scale, scale); // Draw cozy soil mound beneath character
        ctx.fillStyle = '#3e2718';
        ell(ctx, 0, 2.5, r * 0.82, r * 0.24); // Slight squash-and-stretch in Gag state
        if (shocked) {
          const sq = 1 + Math.sin(tNow * 28) * 0.08;
          ctx.scale(1 / Math.sqrt(sq), sq);
        }
        const mockCrop = {
          type,
          r,
          ds: 1,
          wob: 0.5,
          eye: eyeVal,
          panic: shocked || cursorNear ? 1 : 0,
          vx: shocked || cursorNear ? 40 : 0,
          vy: 0,
        };
        if (drawRegionalCrop(ctx, mockCrop, def, breeze, tNow, shocked, cursorNear, px, py, null)) {
          ctx.restore();
          return;
        } // Also support baseline `carrot` and `radish` for style comparison in the Studio!
        if (type === 'radish') {
          const fast = cursorNear || shocked;
          if (fast) {
            const kick = Math.sin(tNow * 30) * 4;
            ctx.strokeStyle = '#9f1239';
            ctx.lineWidth = 2.4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-4, -1);
            ctx.lineTo(-5.5 + kick, 7);
            ctx.moveTo(4, -1);
            ctx.lineTo(5.5 - kick, 7);
            ctx.stroke();
          }
          for (let i = -1; i <= 1; i++) {
            ctx.save();
            ctx.translate(0, -r * 1.45);
            ctx.rotate(i * 0.48 + breeze);
            ctx.fillStyle = i === 0 ? def.leaf : def.leafDark;
            ell(ctx, 0, -8.5, 4.5, 10);
            ctx.restore();
          }
          ctx.fillStyle = radial(ctx, -4, -r * 0.95, 1.5, 0, -r * 0.75, r, def.light, def.color);
          ctx.strokeStyle = def.shade;
          ctx.lineWidth = 1.8;
          circ(ctx, 0, -r * 0.8, r * 0.82);
          ctx.stroke();
          ctx.fillStyle = '#fff';
          circ(ctx, -4.4, -r * 0.9, 4.1);
          circ(ctx, 4.4, -r * 0.9, 3.3);
          ctx.fillStyle = '#111827';
          circ(ctx, -4.4 + px * 0.7, -r * 0.9 + py * 0.7, 1.6);
          circ(ctx, 4.4 + px * 0.7, -r * 0.9 + py * 0.7, 1.3);
          if (shocked || cursorNear) {
            ctx.fillStyle = '#4c0519';
            ell(ctx, 0, -r * 0.45, 3.8, 3.0);
            ctx.fillStyle = '#7dd3fc';
            circ(ctx, 11, -r * 1.1, 2.6);
          } else {
            ctx.strokeStyle = '#4c0519';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(0, -r * 0.5, 2.4, 0.15 * Math.PI, 0.85 * Math.PI);
            ctx.stroke();
          }
        } else if (type === 'carrot') {
          for (let i = -2; i <= 2; i++) {
            ctx.save();
            ctx.translate(i * 1.8, -r * 1.38);
            ctx.rotate(i * 0.27 + breeze);
            ctx.fillStyle = i % 2 === 0 ? def.leaf : def.leafDark;
            ell(ctx, 0, -12, 4, 13);
            ctx.restore();
          }
          ctx.fillStyle = radial(ctx, -4, -r, 2, 0, -r * 0.7, r * 1.2, def.light, def.color);
          ctx.strokeStyle = def.shade;
          ctx.lineWidth = 1.9;
          ctx.beginPath();
          ctx.moveTo(-r * 0.7, -r * 1.15);
          ctx.bezierCurveTo(-r * 0.74, -r * 1.5, r * 0.74, -r * 1.5, r * 0.7, -r * 1.15);
          ctx.quadraticCurveTo(r * 0.5, -r * 0.28, r * 0.2, 2);
          ctx.lineTo(-r * 0.2, 2);
          ctx.quadraticCurveTo(-r * 0.5, -r * 0.28, -r * 0.7, -r * 1.15);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(-r * 0.69, -r * 1.28, r * 1.38, 5);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-r * 0.69, -r * 1.28 + 1.6, r * 1.38, 1.7);
          if (shocked) {
            ctx.strokeStyle = '#431407';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-7, -r * 1.0);
            ctx.lineTo(-2.5, -r * 0.88);
            ctx.lineTo(-7, -r * 0.76);
            ctx.moveTo(7, -r * 1.0);
            ctx.lineTo(2.5, -r * 0.88);
            ctx.lineTo(7, -r * 0.76);
            ctx.stroke();
          } else {
            for (const ex of [-4.8, 4.8]) {
              ctx.fillStyle = '#fff';
              circ(ctx, ex, -r * 0.88, 3.2);
              ctx.fillStyle = '#292524';
              circ(ctx, ex + px * 0.55, -r * 0.88 + py * 0.55, 1.6);
            }
            ctx.strokeStyle = '#431407';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(-8, -r * 1.03);
            ctx.lineTo(-2, -r * 0.98);
            ctx.moveTo(8, -r * 1.03);
            ctx.lineTo(2, -r * 0.98);
            ctx.stroke();
            ctx.beginPath();
            if (cursorNear) ctx.arc(0, -r * 0.55, 2.2, 0, Math.PI * 2);
            else ctx.arc(0, -r * 0.6, 3.8, 0.1 * Math.PI, 0.85 * Math.PI);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
      return { drawRegionalCrop, drawPreviewCharacter };
    })(); // ============================================================================
  // Due by Dusk · v0.5.01 — Multi-Plane Regional Environment Renderer
  // (`art/environmentRenderer.js`)
  // Builds 4 unmistakably distinct regional environments (recognizable even in
  // 100% grayscale with all text hidden):
  //   1. 'canada' — Jagged Rockies/Shield, Tall Prairie Grain Elevator & Twin Silos,
  //                 Gambrel Sugar-Shack Barn, Boreal Spruces & Split-Rail Fence.
  //   2. 'brazil' — Steep Flat-Topped Chapada Mesas & Sugar-Loaf Domes, Diagonal
  //                 River Delta, Arched Colonial Fazenda, Coconut Palms & Bamboo.
  //   3. 'france' — Multi-Arch Roman Stone Aqueduct Bridge, Turreted Loire Château,
  //                 Pencil-Thin Cypress Spires & Dry-Stone Limestone Wall.
  //   4. 'japan'  — Symmetrical Snow-Crowned Mount Fuji Cone, Curved-Roof Minka
  //                 Farmhouse & Kura, Vermilion Torii Gate, Tall Bamboo Stalks &
  //                 Woven Kenninji-gaki Bamboo Fence.
  // ============================================================================
  window.DBD_ENV_RENDERER = (() => {
    'use strict';
    function ell(g, x, y, rx, ry, rot) {
      g.beginPath();
      g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
      g.fill();
    }
    function circ(g, x, y, r) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    function mulberry(seed) {
      return () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    } // Paint the background + midground scenery canvas for the active Country & City
    function paintSceneryCanvas(worldW, FIELD_TOP, scale, dpr, countryCode, subTheme, billsPaid, paintBarn) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(worldW * scale * dpr));
      c.height = Math.round(FIELD_TOP * scale * dpr);
      const g = c.getContext('2d');
      g.scale(scale * dpr, scale * dpr);
      const rng = mulberry(4099 + (countryCode ? countryCode.charCodeAt(0) * 137 : 0)); // ========================================================================
      // REGION 1: CANADA (`CA`)
      // Distinct Silhouette: Jagged Peaks/Shield + Gambrel Barn (Left) + Towering
      // Vertical Wooden Grain Elevator ("POOL") & Twin Silos (Right) + Boreal Pines
      // ========================================================================
      if (countryCode === 'CA') {
        // Far Jagged Peaks / Boreal Shield Ridge
        g.fillStyle = '#94a3b8';
        g.beginPath();
        g.moveTo(-10, FIELD_TOP);
        const peaks = [
          [0, 138],
          [0.14, 88],
          [0.26, 128],
          [0.42, 82],
          [0.58, 126],
          [0.76, 94],
          [0.9, 122],
          [1, 98],
        ];
        for (const [px, py] of peaks) g.lineTo(px * worldW, py);
        g.lineTo(worldW + 10, FIELD_TOP);
        g.closePath();
        g.fill(); // Snow-caps on peaks
        g.fillStyle = '#f8fafc';
        for (const [px, py] of [
          [0.14, 88],
          [0.42, 82],
          [0.76, 94],
        ]) {
          g.beginPath();
          g.moveTo(px * worldW, py);
          g.lineTo(px * worldW - 28, py + 20);
          g.lineTo(px * worldW - 8, py + 15);
          g.lineTo(px * worldW + 8, py + 22);
          g.lineTo(px * worldW + 28, py + 18);
          g.closePath();
          g.fill();
        } // Midground rolling boreal forest hills
        g.fillStyle = '#5b8266';
        g.beginPath();
        g.moveTo(-10, FIELD_TOP);
        g.lineTo(-10, 162);
        g.quadraticCurveTo(worldW * 0.25, 138, worldW * 0.52, 164);
        g.quadraticCurveTo(worldW * 0.78, 142, worldW + 10, 158);
        g.lineTo(worldW + 10, FIELD_TOP);
        g.closePath();
        g.fill(); // Pasture strip
        const pas = g.createLinearGradient(0, 175, 0, FIELD_TOP);
        pas.addColorStop(0, subTheme === 'prairie' ? '#d4b459' : '#7ba05b');
        pas.addColorStop(1, '#4d7c43');
        g.fillStyle = pas;
        g.fillRect(0, 184, worldW, FIELD_TOP - 184); // Boreal Spruce Pines & Red Sugar Maples along horizon
        for (let i = 0; i < 28; i++) {
          const tx = rng() * worldW,
            ty = 166 + rng() * 20,
            s = 12 + rng() * 12;
          if (i % 4 === 0) {
            // Red Sugar Maple
            g.fillStyle = '#5c4033';
            g.fillRect(tx - 1.5, ty, 3, 10);
            g.fillStyle = '#dc2626';
            circ(g, tx, ty - 4, s * 0.45);
            g.fillStyle = '#f97316';
            circ(g, tx - 3, ty - 6, s * 0.32);
          } else {
            // Coniferous Spruce Triangle Silhouette
            g.fillStyle = '#1e3f35';
            for (let t = 0; t < 3; t++) {
              const w = s * (0.48 - t * 0.11),
                yTop = ty - t * s * 0.28;
              g.beginPath();
              g.moveTo(tx - w, yTop + 6);
              g.lineTo(tx, yTop - s * 0.38);
              g.lineTo(tx + w, yTop + 6);
              g.closePath();
              g.fill();
            }
          }
        } // Left Landmark: Classic Canadian Gambrel Barn & Silo
        const bs = worldW < 430 ? 0.83 : 1.05;
        paintBarn(g, Math.max(75, worldW * 0.2), 211, bs, billsPaid); // Right Landmark: Towering Iconic Canadian Wooden Grain Elevator ("POOL")!
        if (worldW > 400) {
          const gx = worldW * 0.74,
            gy = 209;
          g.save();
          g.translate(gx, gy); // Main tall sloped-shoulder elevator tower
          g.fillStyle = '#991b1b';
          g.strokeStyle = '#f8fafc';
          g.lineWidth = 1.4;
          g.beginPath();
          g.moveTo(-22, 0);
          g.lineTo(-20, -58);
          g.lineTo(-13, -72);
          g.lineTo(-13, -94); // Tall cupola headhouse!
          g.lineTo(13, -94);
          g.lineTo(13, -72);
          g.lineTo(20, -58);
          g.lineTo(22, 0);
          g.closePath();
          g.fill();
          g.stroke(); // Gable roof on cupola
          g.fillStyle = '#334155';
          g.beginPath();
          g.moveTo(-15, -94);
          g.lineTo(0, -105);
          g.lineTo(15, -94);
          g.closePath();
          g.fill(); // White banner "WHEAT POOL"
          g.fillStyle = '#fef3c7';
          g.fillRect(-16, -52, 32, 9);
          g.fillStyle = '#1e293b';
          g.font = 'bold 6px monospace';
          g.textAlign = 'center';
          g.fillText('CANADA POOL', 0, -45.5);
          g.restore();
        } // Split-rail cedar log fence
        const fy = FIELD_TOP - 13;
        g.strokeStyle = '#785638';
        g.lineWidth = 3.2;
        for (let x = -10; x < worldW; x += 46) {
          g.beginPath();
          g.moveTo(x, fy - 14);
          g.lineTo(x + 46, fy - 11);
          g.moveTo(x, fy - 6);
          g.lineTo(x + 46, fy - 8);
          g.stroke();
          g.fillStyle = '#5c4028';
          g.fillRect(x - 2, fy - 20, 4, 22);
        }
        return c;
      } // ========================================================================
      // REGION 2: BRAZIL (`BR`)
      // Distinct Silhouette: Flat-Topped Chapada Mesas & Sugar-Loaf Domes +
      // Wide Winding River Delta + Arched Colonial Fazenda + Curving Coconut Palms
      // ========================================================================
      if (countryCode === 'BR') {
        // Flat-topped Chapada Tafelberg Mesas & Sugar-Loaf Domes (unmistakable silhouette!)
        g.fillStyle = '#9a6b56';
        g.beginPath();
        g.moveTo(-10, FIELD_TOP);
        g.lineTo(-10, 145); // Mesa 1 (left flat-top plateau)
        g.lineTo(worldW * 0.06, 142);
        g.lineTo(worldW * 0.1, 88);
        g.lineTo(worldW * 0.28, 88);
        g.lineTo(worldW * 0.33, 142); // Sugar-loaf dome (center)
        g.quadraticCurveTo(worldW * 0.46, 55, worldW * 0.56, 145); // Mesa 2 (right flat-top plateau)
        g.lineTo(worldW * 0.68, 96);
        g.lineTo(worldW * 0.88, 96);
        g.lineTo(worldW * 0.93, 145);
        g.lineTo(worldW + 10, 142);
        g.lineTo(worldW + 10, FIELD_TOP);
        g.closePath();
        g.fill(); // Horizontal sandstone strata lines on the Chapada mesas
        g.strokeStyle = 'rgba(254, 215, 170, 0.38)';
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(worldW * 0.09, 104);
        g.lineTo(worldW * 0.29, 104);
        g.moveTo(worldW * 0.08, 120);
        g.lineTo(worldW * 0.31, 120);
        g.moveTo(worldW * 0.67, 112);
        g.lineTo(worldW * 0.89, 112);
        g.stroke(); // Lush Tropical Valley Midground
        const pas = g.createLinearGradient(0, 148, 0, FIELD_TOP);
        pas.addColorStop(0, '#4d9058');
        pas.addColorStop(1, '#266339');
        g.fillStyle = pas;
        g.fillRect(0, 152, worldW, FIELD_TOP - 152); // Wide Winding River (Rio São Francisco / Amazon) with wooden riverboat!
        g.fillStyle = '#38bdf8';
        g.beginPath();
        g.moveTo(worldW * 0.42, 152);
        g.bezierCurveTo(worldW * 0.35, 175, worldW * 0.62, 195, worldW * 0.52, FIELD_TOP);
        g.lineTo(worldW * 0.68, FIELD_TOP);
        g.bezierCurveTo(worldW * 0.76, 192, worldW * 0.45, 172, worldW * 0.5, 152);
        g.closePath();
        g.fill(); // Curving Coconut Palms & Umbrella Araucaria Pines across horizon!
        const drawPalm = (px, py, sc, lean) => {
          g.save();
          g.translate(px, py);
          g.scale(sc, sc);
          g.strokeStyle = '#785338';
          g.lineWidth = 4.2;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(0, 0);
          g.quadraticCurveTo(lean * 14, -22, lean * 22, -46);
          g.stroke(); // 6 radiating arched palm fronds at crown
          g.translate(lean * 22, -46);
          g.strokeStyle = '#15803d';
          g.fillStyle = '#22c55e';
          g.lineWidth = 2.2;
          for (const a of [-2.4, -1.7, -0.9, -0.2, 0.4, 1.1]) {
            g.beginPath();
            g.moveTo(0, 0);
            g.quadraticCurveTo(Math.cos(a) * 14, Math.sin(a) * 10 - 6, Math.cos(a) * 24, Math.sin(a) * 16 + 6);
            g.stroke();
          } // Coconuts under crown
          g.fillStyle = '#451a03';
          circ(g, -2, 3, 2.5);
          circ(g, 2, 3, 2.5);
          g.restore();
        };
        drawPalm(worldW * 0.07, 208, 1.15, 1);
        drawPalm(worldW * 0.36, 202, 0.95, -1);
        drawPalm(worldW * 0.64, 204, 1.05, 1);
        drawPalm(worldW * 0.92, 208, 1.2, -1); // Left Landmark: Whitewashed Colonial Fazenda with Arched Veranda & Terracotta Roof!
        const fx = Math.max(85, worldW * 0.21),
          fyB = 210;
        g.save();
        g.translate(fx, fyB);
        g.fillStyle = '#fffbeb';
        g.strokeStyle = '#78350f';
        g.lineWidth = 1.5;
        g.fillRect(-52, -44, 104, 44);
        g.strokeRect(-52, -44, 104, 44); // 5 Colonial Veranda Arches along the facade!
        g.fillStyle = '#451a03';
        for (let i = -2; i <= 2; i++) {
          const ax = i * 19;
          g.beginPath();
          g.roundRect(ax - 6.5, -28, 13, 28, [8, 8, 0, 0]);
          g.fill();
        } // Terracotta barrel-tile hipped roof + bell gable
        g.fillStyle = '#c2410c';
        g.beginPath();
        g.moveTo(-60, -44);
        g.lineTo(-42, -68);
        g.lineTo(42, -68);
        g.lineTo(60, -44);
        g.closePath();
        g.fill();
        g.stroke();
        g.restore(); // Bamboo & Rope Fence
        const fy = FIELD_TOP - 13;
        g.strokeStyle = '#a16207';
        g.lineWidth = 3.5;
        g.beginPath();
        g.moveTo(0, fy - 13);
        g.lineTo(worldW, fy - 13);
        g.moveTo(0, fy - 5);
        g.lineTo(worldW, fy - 5);
        g.stroke();
        for (let x = 10; x < worldW; x += 34) {
          g.fillStyle = '#ca8a04';
          g.fillRect(x - 2.5, fy - 22, 5, 24);
          g.fillStyle = '#78350f';
          g.fillRect(x - 3, fy - 14, 6, 2.5);
        }
        return c;
      } // ========================================================================
      // REGION 3: FRANCE (`FR`)
      // Distinct Silhouette: Multi-Arch Roman Stone Aqueduct (Left/Center) +
      // Turreted Loire Renaissance Château (Right) + Tall Pencil Cypress Spires
      // ========================================================================
      if (countryCode === 'FR') {
        // Soft rolling Provençal / Loire limestone hills
        g.fillStyle = '#a78bfa';
        g.beginPath();
        g.moveTo(-10, FIELD_TOP);
        g.lineTo(-10, 128);
        g.quadraticCurveTo(worldW * 0.25, 95, worldW * 0.52, 125);
        g.quadraticCurveTo(worldW * 0.78, 92, worldW + 10, 122);
        g.lineTo(worldW + 10, FIELD_TOP);
        g.closePath();
        g.fill(); // Left-Center Landmark: Multi-Arch Roman Stone Aqueduct Bridge (Pont du Gard silhouette!)
        const aqW = Math.min(340, worldW * 0.44);
        g.save();
        g.translate(worldW * 0.06, 196);
        g.fillStyle = '#e2d5b5';
        g.strokeStyle = '#78684c';
        g.lineWidth = 1.4; // Lower tier with 5 semicircular arches
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(0, -48);
        g.lineTo(aqW, -48);
        g.lineTo(aqW, 0);
        const archSpan = aqW / 5;
        for (let i = 4; i >= 0; i--) {
          const cx = (i + 0.5) * archSpan;
          g.lineTo(cx + archSpan * 0.34, 0);
          g.arc(cx, -18, archSpan * 0.34, 0, Math.PI, true);
          g.lineTo(cx - archSpan * 0.34, 0);
        }
        g.closePath();
        g.fill();
        g.stroke(); // Upper tier with 10 smaller arches
        g.fillRect(0, -66, aqW, 18);
        g.strokeRect(0, -66, aqW, 18);
        g.fillStyle = '#a78bfa';
        for (let i = 0; i < 10; i++) {
          const sx = (i + 0.5) * (aqW / 10);
          g.beginPath();
          g.roundRect(sx - 6, -62, 12, 12, [6, 6, 0, 0]);
          g.fill();
        }
        g.restore(); // Midground Lavender & Vineyard Pasture
        const pas = g.createLinearGradient(0, 168, 0, FIELD_TOP);
        pas.addColorStop(0, '#7c9a6d');
        pas.addColorStop(1, '#557548');
        g.fillStyle = pas;
        g.fillRect(0, 178, worldW, FIELD_TOP - 178); // Tall Pencil-Thin Mediterranean Cypress Spires (`| | |` unmistakable vertical silhouettes!)
        for (let i = 0; i < 18; i++) {
          const cx = (i + 0.5) * (worldW / 18) + (rng() - 0.5) * 12;
          const cy = 188 + (i % 3) * 6;
          const ch = 36 + (i % 4) * 9;
          g.fillStyle = i % 2 === 0 ? '#1e3a2f' : '#2d5240';
          g.beginPath();
          g.moveTo(cx - 4.5, cy);
          g.quadraticCurveTo(cx - 5.5, cy - ch * 0.5, cx, cy - ch);
          g.quadraticCurveTo(cx + 5.5, cy - ch * 0.5, cx + 4.5, cy);
          g.closePath();
          g.fill();
        } // Right Landmark: Turreted Loire Renaissance Stone Château!
        if (worldW > 420) {
          const chX = worldW * 0.76,
            chY = 208;
          g.save();
          g.translate(chX, chY); // Main white-tuffeau stone corps de logis
          g.fillStyle = '#fef9eb';
          g.strokeStyle = '#64748b';
          g.lineWidth = 1.4;
          g.fillRect(-38, -46, 76, 46);
          g.strokeRect(-38, -46, 76, 46); // Steep slate mansard roof
          g.fillStyle = '#334155';
          g.beginPath();
          g.moveTo(-40, -46);
          g.lineTo(-28, -74);
          g.lineTo(28, -74);
          g.lineTo(40, -46);
          g.closePath();
          g.fill();
          g.stroke(); // Twin cylindrical corner turrets with tall conical slate spires!
          for (const tx of [-42, 42]) {
            g.fillStyle = '#f8f0dc';
            g.fillRect(tx - 10, -58, 20, 58);
            g.strokeRect(tx - 10, -58, 20, 58);
            g.fillStyle = '#1e293b';
            g.beginPath();
            g.moveTo(tx - 13, -58);
            g.lineTo(tx, -98); // Tall pointed spire!
            g.lineTo(tx + 13, -58);
            g.closePath();
            g.fill();
            g.stroke(); // Gold finial
            g.strokeStyle = '#eab308';
            g.beginPath();
            g.moveTo(tx, -98);
            g.lineTo(tx, -106);
            g.stroke();
          } // Tall arched French windows
          g.fillStyle = '#fde68a';
          for (const wx of [-22, 0, 22]) {
            g.beginPath();
            g.roundRect(wx - 5, -36, 10, 22, [5, 5, 0, 0]);
            g.fill();
          }
          g.restore();
        } // Provençal Dry-Stone Limestone Wall (`Clos`)
        const fy = FIELD_TOP - 13;
        g.fillStyle = '#d6cfc2';
        g.strokeStyle = '#78716c';
        g.lineWidth = 1.5;
        g.fillRect(0, fy - 15, worldW, 16);
        g.strokeRect(0, fy - 15, worldW, 16);
        for (let x = 8; x < worldW; x += 22) {
          g.fillStyle = '#a8a29e';
          ell(g, x, fy - 7, 8, 4);
        }
        return c;
      } // ========================================================================
      // REGION 4: JAPAN (`JP`)
      // Distinct Silhouette: Symmetrical Snow-Crowned Mount Fuji Cone +
      // Curved-Roof Minka Farmhouse (Left) + Vermilion Torii Gate & Tall
      // Vertical Bamboo Stalk Grove (Right) + Woven Bamboo Fence
      // ========================================================================
      if (countryCode === 'JP') {
        // Iconic Symmetrical Snow-Crowned Cone of Mount Fuji dominating center horizon!
        const fujiX = worldW * 0.5;
        g.fillStyle = '#475569';
        g.beginPath();
        g.moveTo(fujiX - 240, FIELD_TOP);
        g.quadraticCurveTo(fujiX - 95, 145, fujiX - 28, 54); // Sweeping concave volcanic slope!
        g.lineTo(fujiX + 28, 54); // Flat crater rim
        g.quadraticCurveTo(fujiX + 95, 145, fujiX + 240, FIELD_TOP);
        g.closePath();
        g.fill(); // Jagged white snow mantle crowning Mount Fuji
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.moveTo(fujiX - 28, 54);
        g.lineTo(fujiX + 28, 54);
        g.quadraticCurveTo(fujiX + 54, 92, fujiX + 68, 112);
        g.lineTo(fujiX + 36, 98);
        g.lineTo(fujiX + 18, 118);
        g.lineTo(fujiX, 96);
        g.lineTo(fujiX - 18, 116);
        g.lineTo(fujiX - 38, 98);
        g.lineTo(fujiX - 68, 112);
        g.quadraticCurveTo(fujiX - 54, 92, fujiX - 28, 54);
        g.closePath();
        g.fill(); // Stepped green tea foothills
        g.fillStyle = '#4d7c5d';
        g.beginPath();
        g.moveTo(-10, FIELD_TOP);
        g.lineTo(-10, 165);
        g.quadraticCurveTo(worldW * 0.3, 148, worldW * 0.65, 168);
        g.quadraticCurveTo(worldW * 0.85, 152, worldW + 10, 162);
        g.lineTo(worldW + 10, FIELD_TOP);
        g.closePath();
        g.fill(); // Left Landmark: Traditional Japanese Minka Farmhouse with Curved Irimoya Roof & Shoji Doors!
        const mx = Math.max(85, worldW * 0.2),
          my = 210;
        g.save();
        g.translate(mx, my); // White plaster & dark timber walls
        g.fillStyle = '#fffbeb';
        g.strokeStyle = '#1e293b';
        g.lineWidth = 1.8;
        g.fillRect(-46, -42, 92, 42);
        g.strokeRect(-46, -42, 92, 42); // Glowing warm Shoji sliding lattice screens
        g.fillStyle = '#fde68a';
        g.fillRect(-34, -30, 28, 28);
        g.fillRect(6, -30, 28, 28);
        g.strokeRect(-34, -30, 28, 28);
        g.strokeRect(6, -30, 28, 28); // Sweeping curved Kawara tiled roof with upturned eaves!
        g.fillStyle = '#1e293b';
        g.beginPath();
        g.moveTo(-64, -38);
        g.quadraticCurveTo(-45, -44, -28, -72);
        g.lineTo(28, -72);
        g.quadraticCurveTo(45, -44, 64, -38);
        g.quadraticCurveTo(35, -34, 0, -36);
        g.quadraticCurveTo(-35, -34, -64, -38);
        g.closePath();
        g.fill();
        g.strokeStyle = '#94a3b8';
        g.lineWidth = 1.4;
        g.stroke();
        g.restore(); // Right Landmark: Vermilion Shinto Torii Gate & Tall Vertical Bamboo Grove!
        if (worldW > 400) {
          // Bamboo stalks grove (`takebayashi`)
          for (let b = 0; b < 14; b++) {
            const bx = worldW * 0.78 + (b - 6) * 9;
            g.strokeStyle = b % 2 === 0 ? '#15803d' : '#22c55e';
            g.lineWidth = 3.2;
            g.beginPath();
            g.moveTo(bx, 210);
            g.lineTo(bx + ((b % 3) - 1) * 3, 132 - (b % 4) * 8);
            g.stroke();
          } // Vermilion Torii Gate
          const tx = worldW * 0.72,
            ty = 210;
          g.save();
          g.translate(tx, ty);
          g.fillStyle = '#dc2626';
          g.strokeStyle = '#7f1d1d';
          g.lineWidth = 1.3; // Two pillars
          g.fillRect(-20, -56, 5.5, 56);
          g.fillRect(14.5, -56, 5.5, 56); // Lower tie beam (Nuki)
          g.fillRect(-26, -42, 52, 4.5); // Sweeping top lintel (Kasagi) with upturned ends!
          g.beginPath();
          g.moveTo(-34, -58);
          g.quadraticCurveTo(0, -52, 34, -58);
          g.lineTo(31, -51);
          g.quadraticCurveTo(0, -47, -31, -51);
          g.closePath();
          g.fill();
          g.stroke();
          g.restore();
        } // Woven Bamboo Fence (Kenninji-gaki)
        const fy = FIELD_TOP - 13;
        g.fillStyle = '#ca8a04';
        g.fillRect(0, fy - 15, worldW, 15);
        g.strokeStyle = '#713f12';
        g.lineWidth = 1.4;
        for (let x = 0; x < worldW; x += 28) {
          g.beginPath();
          g.moveTo(x, fy);
          g.lineTo(x, fy - 16);
          g.stroke();
        }
        return c;
      } // ========================================================================
      // REGION 5: MOROCCO (`MA`)
      // Distinct Silhouette: Snow-Crowned High Atlas Peaks + Terracotta Kasbah
      // Fortress (Left) + Marrakech Koutoubia Minaret & Date Palms (Right)
      // ========================================================================
      if (countryCode === 'MA') {
        // Far High Atlas Mountains with warm rose-ochre slopes & snow-capped ridges
        g.fillStyle = '#9a5b42';
        g.beginPath();
        g.moveTo(-10, FIELD_TOP);
        const peaks = [
          [0, 142],
          [0.16, 86],
          [0.3, 126],
          [0.48, 74],
          [0.64, 122],
          [0.8, 88],
          [0.94, 128],
          [1, 104],
        ];
        for (const [px, py] of peaks) g.lineTo(px * worldW, py);
        g.lineTo(worldW + 10, FIELD_TOP);
        g.closePath();
        g.fill(); // High Atlas snow caps
        g.fillStyle = '#fff7ed';
        for (const [px, py] of [
          [0.16, 86],
          [0.48, 74],
          [0.8, 88],
        ]) {
          g.beginPath();
          g.moveTo(px * worldW, py);
          g.lineTo(px * worldW - 26, py + 19);
          g.lineTo(px * worldW - 6, py + 14);
          g.lineTo(px * worldW + 8, py + 21);
          g.lineTo(px * worldW + 26, py + 17);
          g.closePath();
          g.fill();
        } // Warm terracotta & olive-grove foothills
        const pas = g.createLinearGradient(0, 158, 0, FIELD_TOP);
        pas.addColorStop(0, '#c27846');
        pas.addColorStop(0.55, '#849646');
        pas.addColorStop(1, '#586e2e');
        g.fillStyle = pas;
        g.fillRect(0, 165, worldW, FIELD_TOP - 165); // Left Landmark: Terracotta Rammed-Earth Kasbah Fortress with Crenellated Towers & Keyhole Arches
        const kx = Math.max(85, worldW * 0.2),
          ky = 210;
        g.save();
        g.translate(kx, ky);
        g.fillStyle = '#c86446';
        g.strokeStyle = '#5c2414';
        g.lineWidth = 1.5;
        g.fillRect(-48, -46, 96, 46);
        g.strokeRect(-48, -46, 96, 46); // Twin tapered corner Kasbah towers
        for (const tx of [-52, 34]) {
          g.fillStyle = '#b85438';
          g.fillRect(tx, -64, 18, 64);
          g.strokeRect(tx, -64, 18, 64); // Stepped merlons on tower top
          for (let m = 0; m < 3; m++) {
            g.fillRect(tx + m * 6.5, -70, 4.5, 6);
          }
        } // Moroccan horseshoe keyhole arches
        g.fillStyle = '#fde68a';
        for (const ax of [-20, 0, 20]) {
          g.beginPath();
          g.arc(ax, -22, 6, Math.PI * 0.8, Math.PI * 2.2);
          g.lineTo(ax + 5, 0);
          g.lineTo(ax - 5, 0);
          g.closePath();
          g.fill();
          g.stroke();
        }
        g.restore(); // Right Landmark: Marrakech Koutoubia Minaret Tower with Turquoise Zellige Band & 3 Golden Finial Orbs!
        if (worldW > 400) {
          const mx = worldW * 0.76,
            my = 210;
          g.save();
          g.translate(mx, my);
          g.fillStyle = '#d47252';
          g.strokeStyle = '#5c2414';
          g.lineWidth = 1.5;
          g.fillRect(-16, -82, 32, 82);
          g.strokeRect(-16, -82, 32, 82); // Turquoise zellige tile band near top of minaret
          g.fillStyle = '#0d9488';
          g.fillRect(-16, -74, 32, 7); // Lantern cupola & domed crown
          g.fillStyle = '#c86446';
          g.fillRect(-9, -98, 18, 16);
          g.strokeRect(-9, -98, 18, 16);
          g.fillStyle = '#eab308';
          g.beginPath();
          g.arc(0, -98, 9, Math.PI, 0);
          g.fill();
          g.stroke(); // 3 stacked golden Jamur finial orbs
          circ(g, 0, -110, 2.5);
          circ(g, 0, -115, 1.8);
          circ(g, 0, -119, 1.2);
          g.restore();
        } // Terracotta Low Medina Garden Wall along field top
        const fy = FIELD_TOP - 13;
        g.fillStyle = '#c26a4a';
        g.strokeStyle = '#6b2e18';
        g.lineWidth = 1.4;
        g.fillRect(0, fy - 14, worldW, 15);
        g.strokeRect(0, fy - 14, worldW, 15);
        return c;
      } // ========================================================================
      // REGION 6: CHINA (`CN`)
      // Distinct Silhouette: Misty Guilin Karst Limestone Peaks + Curved-Eave
      // Crimson Temple Pagoda (Left) + Bamboo Grove & Moon Gate Pavilion (Right)
      // ========================================================================
      if (countryCode === 'CN') {
        // Far Misty Guilin Karst Limestone Towers
        g.fillStyle = '#4a6b5d';
        g.beginPath();
        g.moveTo(-10, FIELD_TOP);
        const karst = [
          [0, 148],
          [0.09, 88],
          [0.16, 138],
          [0.26, 72],
          [0.35, 134],
          [0.48, 66],
          [0.58, 132],
          [0.7, 78],
          [0.8, 136],
          [0.9, 84],
          [1, 126],
        ];
        for (const [kx, ky] of karst) {
          g.quadraticCurveTo((kx - 0.03) * worldW, ky - 8, kx * worldW, ky);
        }
        g.lineTo(worldW + 10, FIELD_TOP);
        g.closePath();
        g.fill(); // Soft valley mist band across karst bases
        const mist = g.createLinearGradient(0, 120, 0, 175);
        mist.addColorStop(0, 'rgba(236, 253, 245, 0.0)');
        mist.addColorStop(0.6, 'rgba(236, 253, 245, 0.45)');
        mist.addColorStop(1, 'rgba(236, 253, 245, 0.0)');
        g.fillStyle = mist;
        g.fillRect(0, 120, worldW, 55); // Emerald rice & lotus terrace foothills
        const pas = g.createLinearGradient(0, 158, 0, FIELD_TOP);
        pas.addColorStop(0, '#65a30d');
        pas.addColorStop(0.55, '#4d7c0f');
        pas.addColorStop(1, '#365314');
        g.fillStyle = pas;
        g.fillRect(0, 165, worldW, FIELD_TOP - 165); // Left Landmark: 3-Tier Curved-Eave Crimson Shaolin Temple Pagoda
        const px0 = Math.max(88, worldW * 0.2),
          py0 = 212;
        g.save();
        g.translate(px0, py0);
        g.strokeStyle = '#1c1917';
        g.lineWidth = 1.5;
        for (const [tier, w, yTop, yBot] of [
          [0, 64, -26, 0],
          [1, 50, -52, -26],
          [2, 36, -76, -52],
        ]) {
          g.fillStyle = '#b91c1c';
          g.fillRect(-w * 0.5, yTop, w, yBot - yTop);
          g.strokeRect(-w * 0.5, yTop, w, yBot - yTop); // Sweeping upturned dark-slate pagoda roof eaves
          g.fillStyle = '#1e293b';
          g.beginPath();
          g.moveTo(-w * 0.72, yTop + 3);
          g.quadraticCurveTo(0, yTop - 9, w * 0.72, yTop + 3);
          g.quadraticCurveTo(w * 0.55, yTop - 6, 0, yTop - 12);
          g.quadraticCurveTo(-w * 0.55, yTop - 6, -w * 0.72, yTop + 3);
          g.closePath();
          g.fill();
          g.stroke();
        } // Golden pagoda spire finial
        g.fillStyle = '#facc15';
        g.beginPath();
        g.moveTo(-3, -84);
        g.lineTo(0, -98);
        g.lineTo(3, -84);
        g.closePath();
        g.fill();
        g.stroke();
        g.restore(); // Right Landmark: Jade Bamboo Grove & Crimson Lantern Pavilion
        if (worldW > 400) {
          const bx = worldW * 0.78,
            by = 212;
          g.save();
          g.translate(bx, by);
          g.strokeStyle = '#14532d';
          g.lineWidth = 3.2;
          for (const [sx, h, lean] of [
            [-26, 78, -0.06],
            [-14, 92, 0.03],
            [-2, 84, -0.02],
            [12, 96, 0.05],
            [24, 74, 0.08],
          ]) {
            g.beginPath();
            g.moveTo(sx, 0);
            g.lineTo(sx + lean * h, -h);
            g.stroke();
          }
          g.restore();
        } // Woven Golden Bamboo Garden Fence along field top
        const fy = FIELD_TOP - 13;
        g.fillStyle = '#ca8a04';
        g.strokeStyle = '#422006';
        g.lineWidth = 1.4;
        g.fillRect(0, fy - 12, worldW, 13);
        g.strokeRect(0, fy - 12, worldW, 13);
        return c;
      }
      return c;
    } // Draw Foreground Framing Elements (bottom corners of the stage) for 3-plane depth!
    function drawForegroundFraming(ctx, worldW, HW, countryCode, tNow) {
      const sway = Math.sin(tNow * 1.8) * 3;
      ctx.save();
      if (countryCode === 'CA') {
        // Foreground Pine Boughs & Red Maple Leaves in bottom corners
        ctx.fillStyle = '#143328';
        for (const side of [0, 1]) {
          const x = side === 0 ? 0 : worldW;
          const dir = side === 0 ? 1 : -1;
          for (let i = 0; i < 4; i++) {
            ell(ctx, x + dir * (18 + i * 14), HW - 8 + (i % 2) * 5, 24, 9, dir * -0.25);
          }
        }
      } else if (countryCode === 'BR') {
        // Foreground Lush Tropical Monstera & Palm Fronds framing bottom corners
        ctx.fillStyle = '#064e3b';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.6;
        for (const side of [0, 1]) {
          const x = side === 0 ? -10 : worldW + 10;
          const dir = side === 0 ? 1 : -1;
          for (let f = 0; f < 4; f++) {
            ctx.beginPath();
            ctx.moveTo(x, HW + 5);
            ctx.quadraticCurveTo(
              x + dir * (35 + f * 18),
              HW - 45 + f * 8 + sway,
              x + dir * (65 + f * 22),
              HW - 18 + f * 6,
            );
            ctx.stroke();
            ell(ctx, x + dir * (38 + f * 14), HW - 18 + f * 4, 18, 7, dir * -0.35);
          }
        }
      } else if (countryCode === 'FR') {
        // Foreground Lavender Hedge Clusters & Stone Corner Pillars
        for (const side of [0, 1]) {
          const x = side === 0 ? 18 : worldW - 18;
          ctx.fillStyle = '#4c1d95';
          ell(ctx, x, HW - 4, 28, 12);
          ctx.fillStyle = '#8b5cf6';
          for (let s = -2; s <= 2; s++) {
            ell(ctx, x + s * 7 + sway * 0.3, HW - 16, 3.2, 9, s * 0.15);
          }
        }
      } else if (countryCode === 'JP') {
        // Foreground Stone Lantern Base & Overhanging Bamboo Leaves
        ctx.fillStyle = '#0f291e';
        for (const side of [0, 1]) {
          const x = side === 0 ? 0 : worldW;
          const dir = side === 0 ? 1 : -1;
          for (let b = 0; b < 5; b++) {
            ell(ctx, x + dir * (16 + b * 11) + sway * 0.4, HW - 14 + (b % 2) * 6, 16, 4.5, dir * -0.4);
          }
        }
      }
      ctx.restore();
    }
    return { paintSceneryCanvas, drawForegroundFraming };
  })();
  /* ================= data ================= */ const HW = 640,
    HORIZON = 114,
    FIELD_TOP = 140,
    PAD = 30; // True-to-life relative scale hierarchy: Radish (16) < Carrot (19) < Golden Corn (22) < Cabbage (28) < Couch Potato (36) < King Pumpkin (44)
  const CROP = window.DBD_CROPS;
  const GEO = window.DBD_GEOGRAPHY;
  const SKILL_NODES = window.DBD_SKILL_TREE.nodes;
  const FarmScene_GAZETTE_EVENTS = [
    {
      id: 'market',
      title: 'COUNTY MARKET BOOM',
      desc: 'All crops sell for +25% today. Clear skies.',
      weather: 'clear',
      valMul: 1.25,
    },
    {
      id: 'gale',
      title: 'AUTUMN GALE WINDS',
      desc: 'Blowing leaves! Hold click/Space: Charge Cleave 2× faster.',
      weather: 'wind',
      chargeFast: 2.0,
    },
    {
      id: 'rain',
      title: 'WARM HARVEST SHOWERS',
      desc: 'Summer rain! Crops sprout 35% faster.',
      weather: 'rain',
      spawnFast: 1.35,
    },
    {
      id: 'frost',
      title: 'SNAP MORNING FROST',
      desc: 'Frosty morning! Cracking ice on crops pays +$2 bonus.',
      weather: 'frost',
      frost: true,
    },
    {
      id: 'fair',
      title: 'GRANDMA CROCHET FAIR',
      desc: 'Pumpkins & Drama Onions pay +35% today!',
      weather: 'clear',
      pumpkinBonus: 1.35,
    },
    {
      id: 'stampede',
      title: 'PASTURE STAMPEDE',
      desc: 'Restless goat day! Clover Treats & Fertilizer spawn more.',
      weather: 'wind',
      propBoost: 1.8,
    },
  ];
  const FarmScene_BILLS = [
    { name: 'Seed loan', amt: 20, days: 3, note: 'For the carrot seeds. We trust you. Mostly.' },
    { name: 'New fence', amt: 60, days: 4, note: 'Your goat ate the old one. The goat denies this.' },
    { name: 'Tractor transmission', amt: 180, days: 4, note: 'It only drives in reverse now. Charming, but no.' },
    { name: 'Pond water rights', amt: 500, days: 4, note: 'The ducks have retained counsel.' },
    { name: 'Barn roof', amt: 1300, days: 4, note: 'The pigeons have filed a formal complaint.' },
    { name: "Grandma's pie insurance", amt: 3200, days: 5, note: 'Required by the county fair. Do not ask why.' },
    { name: 'Property tax', amt: 8500, days: 5, note: 'The county noticed you are doing well.' },
    { name: "The scarecrow's lawyer", amt: 30000, days: 6, note: 'He is suing for back pay. He has a point.' },
    { name: 'The deed', amt: 90000, days: 7, note: 'Pay this and the farm is yours. Forever. Probably.' },
  ];
  const UNLOCKS = {
    1: 'Cabbages ($3) and Drama-Queen Onions ($7) that cry big tear splashes.',
    2: 'Grandma Pumpkins ($9, crocheting hats & scarves) + the White Goat.',
    3: 'Runaway Radishes ($5) and Briar-Berry Twins ($13).',
    4: 'VIP Golden Corn ($18) + swooping Crow Pests you can shoo for bonus coins.',
    5: 'Couch Potatoes ($22). Heavy sleepers in nightcaps—use Charge Cleave (hold click/Space)!',
  };
  const FarmScene_SHED = [
    { id: 'scythe', name: 'Sharper scythe', base: 8, g: 1.86, max: 12, show: (s) => `${s.dmg} damage` },
    { id: 'swing', name: 'Wider swing', base: 12, g: 1.88, max: 8, show: (s) => `size ${Math.round(s.R)}` },
    { id: 'hands', name: 'Quicker hands', base: 14, g: 1.88, max: 8, show: (s) => `${s.tick.toFixed(1)} swings/s` },
    { id: 'days', name: 'Longer days', base: 18, g: 1.9, max: 8, show: (s) => `${trim1(s.day)} s of light` },
    { id: 'soil', name: 'Richer soil', base: 16, g: 1.86, max: 8, show: (s) => `${s.max} crops at once` },
    { id: 'market', name: "Farmers' market", base: 25, g: 1.9, max: 10, show: (s) => `prices ×${s.vm.toFixed(2)}` },
    {
      id: 'clover',
      name: 'Lucky clover',
      base: 30,
      g: 1.95,
      max: 6,
      show: (s) => `${Math.round(s.cc * 100)}% crit chance`,
    },
  ];
  const FarmScene_ALMANAC = [0, 30, 120, 400, 1200, 3500];
  const FarmScene_HEIRS = [
    { id: 'boots', name: "Grandpa's boots", base: 4, g: 2.1, max: 8, line: () => '+1 s of daylight per level' },
    { id: 'calloused', name: 'Calloused hands', base: 5, g: 2.1, max: 8, line: () => '+1 damage per level' },
    { id: 'hat', name: 'Big straw hat', base: 4, g: 2.2, max: 6, line: () => 'Swing 8% wider per level' },
    {
      id: 'almanac',
      name: "Farmer's almanac",
      base: 3,
      g: 2.4,
      max: 5,
      line: (l) =>
        l >= 5
          ? `Every farm starts with ${fmt$(FarmScene_ALMANAC[5])}`
          : `Start each farm with ${fmt$(FarmScene_ALMANAC[l + 1])}`,
    },
    { id: 'horseshoe', name: 'Lucky horseshoe', base: 6, g: 2.2, max: 5, line: () => '+3% crit and more golden corn' },
    { id: 'rooster', name: 'Loud rooster', base: 5, g: 2.2, max: 6, line: () => '+0.5 swings per second' },
    {
      id: 'cousin',
      name: "Cousin Dale's discount",
      base: 6,
      g: 2.3,
      max: 5,
      line: () => 'Shed prices 5% lower per level',
    },
  ];
  const FarmScene_PERKS = [
    { id: 'spite', name: 'Spite-sharpened', line: '+2 scythe damage.' },
    { id: 'coffee', name: 'Second coffee', line: '+1 swing per second.' },
    { id: 'elbow', name: 'Elbow room', line: 'Your swing is 20% wider.' },
    { id: 'saving', name: 'Daylight saving', line: '+2 s of daylight.' },
    { id: 'fever', name: 'Market fever', line: 'Crop prices +25% per stack.' },
    { id: 'clover', name: 'Four-leaf clover', line: '+8% crit chance.' },
    { id: 'hungry', name: 'Hungry soil', line: '4 more crops on the field.' },
    {
      id: 'combo',
      name: 'Combo farmer',
      line: 'Keep your chain for 3 seconds instead of 2. One per farm.',
      once: true,
    },
    { id: 'heavy', name: 'Heavy swing', line: 'Crits hit 5× instead of 3×. One per farm.', once: true },
    {
      id: 'whisper',
      name: 'Radish whisperer',
      line: 'Radishes run half as fast and sell for 50% more.',
      once: true,
      req: (f) => f.billsPaid >= 3,
    },
    {
      id: 'treaty',
      name: 'Goat treaty',
      line: 'The goat stops headbutting you and tips you instead.',
      once: true,
      req: (f) => f.billsPaid >= 2,
    },
    { id: 'gold', name: 'Gold fever', line: '+4% chance of golden corn.', req: (f) => f.billsPaid >= 4 },
    {
      id: 'storm',
      name: 'Storm scythe',
      line: 'Crits chain golden lightning to 2 nearby crops. One per farm.',
      once: true,
    },
    {
      id: 'cleaver',
      name: 'Cleaver mastery',
      line: 'Hold click/Space: Charge Cleave charges 50% faster and hits wider.',
      once: true,
    },
  ];
  /* ================= helpers ================= */ const $ = (s) => document.querySelector(s);
  const FarmScene_clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = FarmScene_clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const easeBack = (t) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  };
  function trim1(x) {
    return x.toFixed(1).replace(/\.0$/, '');
  }
  function fmt$(v) {
    return '$' + Math.floor(Math.max(0, v)).toLocaleString('en-US');
  }
  function fmtGain(v) {
    return v < 10
      ? '+$' + (Math.floor(v * 10) / 10).toFixed(1).replace(/\.0$/, '')
      : '+$' + Math.floor(v).toLocaleString('en-US');
  }
  function lc(s) {
    return s.charAt(0).toLowerCase() + s.slice(1);
  }
  function count(arr, id) {
    let n = 0;
    for (const x of arr) if (x === id) n++;
    return n;
  }
  function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixc(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }
  function rgba(c, a = 1) {
    return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  }
  function mul(c, m) {
    return [(c[0] * m[0]) / 255, (c[1] * m[1]) / 255, (c[2] * m[2]) / 255];
  }
  function setText(el, s) {
    if (el.textContent !== s) el.textContent = s;
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function mulberry(seed) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* ================= state ================= */ const FarmScene_SHED_IDS = FarmScene_SHED.map((d) => d.id),
    FarmScene_HEIR_IDS = FarmScene_HEIRS.map((d) => d.id);
  const blank = (ids) => {
    const o = {};
    ids.forEach((k) => (o[k] = 0));
    return o;
  };
  let meta = {
    grit: 0,
    diamonds: 2, // Start with 2 Diamonds so players can immediately explore the branching skill tree!
    learnedSkills: [],
    heir: blank(FarmScene_HEIR_IDS),
    lost: 0,
    owned: 0,
    best: 0,
    sound: true,
    country: 'CN',
    cityId: 'cn_guilin',
    cityRecords: {},
    cityOwned: {},
  };
  let farm = null;
  let dayCheckpoint = null;
  function newFarm() {
    return {
      no: meta.lost + meta.owned + 1,
      day: 1,
      cash: FarmScene_ALMANAC[meta.heir.almanac] || 0,
      shed: blank(FarmScene_SHED_IDS),
      perks: [],
      bill: 0,
      due: FarmScene_BILLS[0].days,
      paidTotal: 0,
      billsPaid: 0,
      lastEarn: 0,
      lastCount: 0,
      played: false,
      earned: 0,
      harvested: 0,
      pendingPerks: null,
      lastBest: 0,
      lastBonus: 0,
      bestChain: 0,
    };
  }
  function hasSkill(id) {
    return Array.isArray(meta.learnedSkills) && meta.learnedSkills.includes(id);
  }
  function skillPrereqsMet(node) {
    if (!node.reqs || !node.reqs.length) return true;
    if (node.reqMode === 'any') return node.reqs.some((r) => hasSkill(r));
    return node.reqs.every((r) => hasSkill(r));
  }
  function curCountry() {
    return GEO.countries[meta.country] || GEO.countries.CA;
  }
  function curCity() {
    const c = curCountry();
    return c.cities.find((ct) => ct.id === meta.cityId) || c.cities[0];
  }
  function curBiome() {
    const c = curCountry(),
      ct = curCity();
    return {
      id: c.code,
      countryCode: c.code,
      countryName: c.name,
      city: ct.name,
      name: ct.province,
      short: `${c.flag} ${ct.name}`,
      mul: ct.mul,
      rival: ct.rival,
      record: ct.record,
      buff: ct.buff,
      subTheme: ct.subTheme,
      crops: ct.crops,
      soilA:
        c.code === 'CN'
          ? '#7c5230'
          : c.code === 'MA'
            ? '#8c4f30'
            : c.code === 'BR'
              ? '#7c3f2c'
              : c.code === 'FR'
                ? '#85684e'
                : c.code === 'JP'
                  ? '#524742'
                  : '#78553a',
      soilB:
        c.code === 'CN'
          ? '#633e22'
          : c.code === 'MA'
            ? '#703b22'
            : c.code === 'BR'
              ? '#632f20'
              : c.code === 'FR'
                ? '#6e543d'
                : c.code === 'JP'
                  ? '#3f3632'
                  : '#63432b',
      soilC:
        c.code === 'CN'
          ? '#462a15'
          : c.code === 'MA'
            ? '#4f2714'
            : c.code === 'BR'
              ? '#421d13'
              : c.code === 'FR'
                ? '#4a3728'
                : c.code === 'JP'
                  ? '#292320'
                  : '#452d1c',
    };
  }
  function ownsCity(cityId) {
    return !!(meta.cityOwned && meta.cityOwned[cityId]);
  }
  function ownedCityCount() {
    return meta.cityOwned ? Object.values(meta.cityOwned).filter(Boolean).length : 0;
  }
  function stats(shed) {
    shed = shed || farm.shed;
    const H = meta.heir,
      P = farm.perks;
    const ownedBonus = 1 + 0.04 * ownedCityCount();
    const baseDmg =
      (1 + shed.scythe + H.calloused + 2 * count(P, 'spite') + (hasSkill('reap_root') ? 2 : 0)) *
      (hasSkill('core_awakening') ? 1.1 : 1.0);
    const tickRate =
      (3.2 + 0.55 * shed.hands + 0.45 * H.rooster + 0.85 * count(P, 'coffee')) * (hasSkill('reap_swift') ? 1.18 : 1.0);
    const swingRad =
      42 *
      (1 + 0.13 * shed.swing) *
      (1 + 0.08 * H.hat) *
      (1 + 0.18 * count(P, 'elbow')) *
      (hasSkill('reap_dash') ? 1.12 : 1.0);
    const daySecs =
      14 +
      1.5 * shed.days +
      H.boots +
      2 * count(P, 'saving') +
      (hasSkill('core_awakening') ? 1.0 : 0) +
      (hasSkill('soil_sun') ? 2.0 : 0);
    const maxCrops = 7 + 2 * shed.soil + 3 * count(P, 'hungry') + (hasSkill('soil_root') ? 2 : 0);
    const spawnRate = 0.82 / (1 + 0.24 * shed.soil + 0.08 * count(P, 'hungry')) / (hasSkill('soil_root') ? 1.12 : 1.0);
    const valMul =
      (1 + 0.16 * shed.market) * (1 + 0.22 * count(P, 'fever')) * (hasSkill('gold_root') ? 1.15 : 1.0) * ownedBonus;
    const dens = worldW ? FarmScene_clamp(((worldW * (HW - FIELD_TOP)) / (900 * 412)) * 0.62, 0.8, 1.3) : 1;
    return {
      dmg: Math.round(baseDmg * 10) / 10,
      tick: tickRate,
      R: swingRad,
      day: daySecs,
      max: Math.round(maxCrops * dens),
      spawn: spawnRate / dens,
      vm: valMul,
      cc: Math.min(0.65, 0.04 + 0.04 * shed.clover + 0.03 * H.horseshoe + 0.07 * count(P, 'clover')),
      cm: count(P, 'heavy') ? 4.5 : 2.8,
      gold: 0.015 + 0.01 * shed.clover + 0.012 * H.horseshoe + 0.035 * count(P, 'gold'),
      comboCap: 2,
      chainGrace: count(P, 'combo') ? 1.45 : 0.9,
      radishSlow: count(P, 'whisper') ? 0.5 : 1,
      radishBonus: count(P, 'whisper') ? 1.5 : 1,
      treaty: count(P, 'treaty') > 0 || hasSkill('gold_treaty') || hasSkill('gold_herd'),
      storm: count(P, 'storm') > 0 || hasSkill('reap_exec'),
      cleaver: count(P, 'cleaver') > 0 || hasSkill('reap_cleave'),
    };
  }
  function statsWith(id) {
    const sh = Object.assign({}, farm.shed);
    sh[id] += 1;
    return stats(sh);
  }
  function shedCost(def, lvl) {
    return lvl >= def.max ? null : Math.round(def.base * Math.pow(def.g, lvl) * (1 - 0.05 * meta.heir.cousin));
  }
  function heirCost(def, lvl) {
    return lvl >= def.max ? null : Math.round(def.base * Math.pow(def.g, lvl));
  }
  function hpMul() {
    return (1 + 0.13 * (farm.day - 1)) * Math.pow(1.24, farm.billsPaid);
  }
  function billObj(idx) {
    const raw = FarmScene_BILLS[FarmScene_clamp(idx, 0, FarmScene_BILLS.length - 1)];
    const m = curBiome().mul * (hasSkill('gold_lawyer') ? 0.88 : 1.0);
    return { name: raw.name, days: raw.days, note: raw.note, amt: Math.max(10, Math.round(raw.amt * m)) };
  }
  function billStatus() {
    const left = farm.due - (farm.day - 1);
    return { left, tonight: left <= 0, b: billObj(farm.bill) };
  }
  function gritFor(f) {
    const a = Math.floor(2 * Math.sqrt(Math.max(0, f.paidTotal) / 25));
    const b = 3 * Math.max(0, f.billsPaid);
    const c = Math.max(f.played ? 1 : 0, f.day - 1);
    const d = Math.floor(Math.sqrt(Math.max(0, f.cash) / 50));
    return { a, b, c, d, total: a + b + c + d };
  }
  /* save */ function save() {
    const savedFarm = dayCheckpoint && mode === 'day' ? dayCheckpoint : farm;
    SaveSystem.save(meta, savedFarm);
  }
  function loadSavedState() {
    return SaveSystem.loadOrMigrate();
  }
  function openSaveTransferModal(statusMsg = '') {
    if (mode === 'day') setPaused(true);
    const exportedJson = SaveSystem.exportSaveJson(meta, farm);
    const report = SaveSystem.getLastMigrationReport();
    const hasBackup = !!SaveSystem.getBackupJson();
    const reportHtml = report
      ? `<div class="migration-box">
        <strong>✓ Save Schema v${report.toVersion} Active</strong> (Migrated from v${report.fromVersion} · Backup Key: <code>${report.backupKey}</code>)<br>
        ${report.notes.join(' · ')}
      </div>`
      : '';
    const statusBanner = statusMsg
      ? `<div class="migration-box" style="background:#fef9c3;border-color:#facc15;color:#854d0e;margin-bottom:10px"><strong>${statusMsg}</strong></div>`
      : '';
    lastFocus = document.activeElement;
    el.modal.innerHTML = `<div class="sheet atlas-sheet" role="dialog" aria-modal="true" aria-labelledby="mTitle">
    <div class="mtop">
      <div>
        <p class="eyebrow">SAVE TRANSFER &amp; VERSIONED MIGRATION (SCHEMA v2)</p>
        <h3 class="mtitle" id="mTitle" style="margin:2px 0 6px">Export / Import Save &amp; Pre-Migration Backup</h3>
      </div>
      <button class="chipbtn" type="button" data-close>Close</button>
    </div>
    ${statusBanner}
    <p style="margin:0 0 8px;font-size:12.5px;color:#475569">
      Moving between a local HTML file and a hosted Vite dev server (<code>http://localhost:5173</code>) uses separate browser storage origins. Export your save JSON below or paste/upload any <code>v0.3</code>, <code>v0.4.01</code>, <code>v0.6.00</code>, or <code>v0.6.00</code> save to migrate it safely (legacy Grit-purchased skills are automatically mapped and their Grit cost refunded).
    </p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:10px">
      <div>
        <label style="display:block;font-family:var(--font-type);font-size:11px;font-weight:700;margin-bottom:4px">CURRENT SAVE JSON (SCHEMA v2)</label>
        <textarea id="exportSaveBox" class="save-textarea" readonly>${exportedJson}</textarea>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
          <button class="btn" type="button" data-save-act="download" style="font-size:16px;padding:8px 14px">⬇ Download Save (.json)</button>
          <button class="chipbtn" type="button" data-save-act="copy">📋 Copy JSON</button>
          ${hasBackup ? `<button class="chipbtn" type="button" data-save-act="backup">🛡 Download Pre-Migration Backup</button>` : ''}
        </div>
      </div>
      <div>
        <label style="display:block;font-family:var(--font-type);font-size:11px;font-weight:700;margin-bottom:4px">IMPORT SAVE JSON (PASTE OR UPLOAD FILE)</label>
        <textarea id="importSaveBox" class="save-textarea" placeholder='Paste {"meta": ..., "farm": ...} JSON here...'></textarea>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center">
          <button class="btn money" type="button" data-save-act="import" style="font-size:16px;padding:8px 14px">⬆ Import &amp; Migrate Save</button>
          <label class="chipbtn" style="cursor:pointer;display:inline-flex;align-items:center">
            📂 Choose .json File
            <input type="file" id="importSaveFile" accept=".json,application/json" style="display:none">
          </label>
        </div>
      </div>
    </div>
    ${reportHtml}
  </div>`;
    el.modal.hidden = false;
    renderCard();
    const fileInput = document.getElementById('importSaveFile');
    if (fileInput) {
      fileInput.onchange = () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const box = document.getElementById('importSaveBox');
          if (box && typeof reader.result === 'string') {
            box.value = reader.result;
          }
        };
        reader.readAsText(file);
      };
    }
  }
  /* ================= sound ================= */ const Sound = {
    ctx: null,
    out: null,
    on: true,
    lastHit: 0,
    init() {
      if (this.ctx || !this.on) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.out = this.ctx.createGain();
        this.out.gain.value = 0.32;
        this.out.connect(this.ctx.destination);
      } catch (e) {
        this.ctx = null;
      }
    },
    ok() {
      if (!this.on) return false;
      if (!this.ctx) this.init();
      if (!this.ctx) return false;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    },
    tone(f, d, o = {}) {
      const c = this.ctx,
        t = c.currentTime + (o.at || 0),
        osc = c.createOscillator(),
        g = c.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + d);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.v || 0.2, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      osc.connect(g);
      g.connect(this.out);
      osc.start(t);
      osc.stop(t + d + 0.03);
    },
    noise(d, o = {}) {
      const c = this.ctx,
        t = c.currentTime + (o.at || 0),
        len = Math.max(1, Math.floor(c.sampleRate * d)),
        buf = c.createBuffer(1, len, c.sampleRate),
        data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = c.createBufferSource(),
        fl = c.createBiquadFilter(),
        g = c.createGain();
      s.buffer = buf;
      fl.type = o.type || 'bandpass';
      fl.frequency.value = o.f || 1500;
      fl.Q.value = o.q || 0.8;
      g.gain.value = o.v || 0.2;
      s.connect(fl);
      fl.connect(g);
      g.connect(this.out);
      s.start(t);
    },
    hit(crit) {
      if (!this.ok()) return;
      const n = performance.now();
      if (n - this.lastHit < 55) return;
      this.lastHit = n;
      this.noise(0.05, { v: crit ? 0.4 : 0.15, f: crit ? 900 : 2600, q: 1.1 });
      if (crit) this.tone(150, 0.13, { type: 'triangle', v: 0.25, to: 70 });
    },
    pop(n) {
      if (!this.ok()) return;
      const f = 380 * Math.pow(1.03, Math.min(n, 30));
      this.tone(f, 0.09, { v: 0.2, to: f * 1.7 });
    },
    coin() {
      if (!this.ok()) return;
      this.tone(1568, 0.1, { type: 'square', v: 0.05 });
      this.tone(2093, 0.24, { type: 'square', v: 0.045, at: 0.07 });
    },
    baah(v = 1) {
      if (!this.ok()) return;
      const c = this.ctx,
        t = c.currentTime,
        o = c.createOscillator(),
        g = c.createGain(),
        l = c.createOscillator(),
        lg = c.createGain(),
        fl = c.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(340, t);
      o.frequency.linearRampToValueAtTime(285, t + 0.5);
      l.frequency.value = 23;
      lg.gain.value = 30;
      l.connect(lg);
      lg.connect(o.frequency);
      fl.type = 'bandpass';
      fl.frequency.value = 1150;
      fl.Q.value = 2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.24 * v, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      o.connect(fl);
      fl.connect(g);
      g.connect(this.out);
      o.start(t);
      l.start(t);
      o.stop(t + 0.6);
      l.stop(t + 0.6);
    },
    tick() {
      if (!this.ok()) return;
      this.tone(1200, 0.04, { type: 'square', v: 0.035 });
    },
    dawn() {
      if (!this.ok()) return;
      [392, 523, 659].forEach((f, i) => this.tone(f, 0.32, { type: 'triangle', v: 0.09, at: i * 0.08 }));
    },
    sunset() {
      if (!this.ok()) return;
      [784, 659, 523, 392].forEach((f, i) => this.tone(f, 0.5, { type: 'triangle', v: 0.1, at: i * 0.12 }));
    },
    stamp() {
      if (!this.ok()) return;
      this.noise(0.12, { v: 0.5, f: 320, q: 0.7, type: 'lowpass' });
      this.tone(95, 0.16, { v: 0.35, to: 50 });
      this.tone(1318, 0.1, { type: 'square', v: 0.045, at: 0.13 });
      this.tone(1760, 0.26, { type: 'square', v: 0.045, at: 0.21 });
    },
    sad() {
      if (!this.ok()) return;
      [392, 370, 349, 330].forEach((f, i) =>
        this.tone(f, i === 3 ? 0.95 : 0.34, { type: 'sawtooth', v: 0.07, at: i * 0.38, to: i === 3 ? 290 : null }),
      );
    },
    fanfare() {
      if (!this.ok()) return;
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', v: 0.13, at: i * 0.12 }));
      this.tone(1047, 0.9, { type: 'triangle', v: 0.11, at: 0.5 });
    },
    click() {
      if (!this.ok()) return;
      this.tone(660, 0.05, { type: 'square', v: 0.035 });
    },
  };
  /* ================= canvas & scene ================= */ const canvas = $('#field'),
    ctx = canvas.getContext('2d'),
    stage = $('#stage');
  const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let worldW = 0,
    scale = 1,
    dpr = 1,
    cssW = 0,
    cssH = 0;
  let fieldLayer = null,
    hills = null;
  const stars = Array.from({ length: 80 }, () => ({
    x: Math.random(),
    y: Math.random() * 0.85,
    r: Math.random() * 1.3 + 0.4,
    tw: Math.random() * 6.3,
  }));
  const SKY = [
    [0.0, '#8ebbd0', '#ffe2af'],
    [0.3, '#66aaca', '#d9f0dc'],
    [0.7, '#7e9abf', '#ffe1ab'],
    [0.9, '#716f9f', '#f9b27e'],
    [1.0, '#505d8a', '#d28c91'],
    [1.3, '#182c4c', '#52628c'],
  ].map((s) => [s[0], hex(s[1]), hex(s[2])]);
  function skyAt(p) {
    if (p <= SKY[0][0]) return [SKY[0][1], SKY[0][2]];
    for (let i = 1; i < SKY.length; i++) {
      if (p <= SKY[i][0]) {
        const a = SKY[i - 1],
          b = SKY[i],
          t = (p - a[0]) / (b[0] - a[0]);
        return [mixc(a[1], b[1], t), mixc(a[2], b[2], t)];
      }
    }
    const l = SKY[SKY.length - 1];
    return [l[1], l[2]];
  }
  const WHITE = [255, 255, 255],
    WARM = hex('#ffe4bf'),
    NIGHT = hex('#b8c7e6');
  function lightMul(p) {
    const warm = smooth(0.6, 1.0, p) * 0.75,
      night = smooth(1.0, 1.3, p);
    return mixc(mixc(WHITE, WARM, warm), NIGHT, night);
  }
  function ell(g, x, y, rx, ry, rot) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    g.fill();
  }
  function circ(g, x, y, r) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  function radial(g, x0, y0, r0, x1, y1, r1, a, b) {
    const gr = g.createRadialGradient(x0, y0, r0, x1, y1, r1);
    gr.addColorStop(0, a);
    gr.addColorStop(1, b);
    return gr;
  }
  const SPRITES = { carrot: true };
  function buildSprites() {
    SPRITES.carrot = true;
  }
  let sceneryLayer = null,
    sceneryKey = '';
  function buildHills() {
    hills = {
      far: [
        [0, 154],
        [0.18, 112],
        [0.39, 144],
        [0.62, 105],
        [0.84, 136],
        [1, 112],
      ],
      near: [
        [0, 192],
        [0.2, 165],
        [0.43, 182],
        [0.66, 151],
        [0.86, 176],
        [1, 159],
      ],
    };
    sceneryKey = '';
  }
  function canopy(g, x, y, s, col, bright) {
    g.fillStyle = '#69533b';
    g.fillRect(x - s * 0.075, y - s * 0.1, s * 0.15, s * 0.72);
    g.strokeStyle = '#69533b';
    g.lineWidth = s * 0.065;
    g.beginPath();
    g.moveTo(x, y + s * 0.3);
    g.lineTo(x - s * 0.3, y - s * 0.12);
    g.moveTo(x, y + s * 0.21);
    g.lineTo(x + s * 0.32, y - s * 0.2);
    g.stroke();
    [
      [-0.39, 0.02, 0.38],
      [-0.2, -0.3, 0.43],
      [0.2, -0.37, 0.42],
      [0.44, -0.05, 0.35],
      [0, 0.03, 0.48],
    ].forEach(([dx, dy, r]) => {
      g.fillStyle = radial(g, x + (dx - 0.15) * s, y + (dy - 0.2) * s, 1, x + dx * s, y + dy * s, r * s, bright, col);
      circ(g, x + dx * s, y + dy * s, r * s);
    });
    g.fillStyle = 'rgba(229,238,149,.18)';
    ell(g, x - s * 0.2, y - s * 0.34, s * 0.18, s * 0.08, -0.3);
  }
  function paintBarn(g, x, y, s, repair) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.fillStyle = 'rgba(43,65,39,.22)';
    ell(g, 12, 3, 75, 11);
    const silo = g.createLinearGradient(38, 0, 69, 0);
    silo.addColorStop(0, '#8b9e9a');
    silo.addColorStop(0.4, '#d4d7c0');
    silo.addColorStop(1, '#778e8d');
    g.fillStyle = silo;
    g.fillRect(39, -76, 28, 76);
    ell(g, 53, -75, 14, 8);
    g.strokeStyle = '#778e87';
    g.lineWidth = 1;
    for (let yy = -66; yy < -3; yy += 11) {
      g.beginPath();
      g.moveTo(40, yy);
      g.quadraticCurveTo(53, yy + 4, 67, yy);
      g.stroke();
    }
    g.strokeStyle = '#e6e1c5';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(60, -67);
    g.lineTo(60, -2);
    g.moveTo(64, -67);
    g.lineTo(64, -2);
    g.stroke();
    for (let yy = -64; yy < 0; yy += 6) {
      g.beginPath();
      g.moveTo(60, yy);
      g.lineTo(64, yy);
      g.stroke();
    }
    g.fillStyle = '#883c32';
    g.beginPath();
    g.moveTo(-43, -48);
    g.lineTo(20, -48);
    g.lineTo(38, -34);
    g.lineTo(38, 0);
    g.lineTo(-43, 0);
    g.closePath();
    g.fill();
    g.fillStyle = '#b44e3a';
    g.fillRect(-43, -45, 64, 45);
    g.fillStyle = '#cb6548';
    g.beginPath();
    g.moveTo(-43, -45);
    g.lineTo(-43, -54);
    g.lineTo(-31, -73);
    g.lineTo(-11, -85);
    g.lineTo(9, -73);
    g.lineTo(21, -54);
    g.lineTo(21, -45);
    g.fill();
    g.strokeStyle = 'rgba(100,41,30,.45)';
    g.lineWidth = 1;
    for (let xx = -39; xx < 22; xx += 6) {
      g.beginPath();
      g.moveTo(xx, -45);
      g.lineTo(xx, 0);
      g.stroke();
    }
    g.fillStyle = repair >= 5 ? '#4b5550' : '#575248';
    g.beginPath();
    g.moveTo(-47, -54);
    g.lineTo(-33, -77);
    g.lineTo(-11, -90);
    g.lineTo(14, -76);
    g.lineTo(41, -54);
    g.lineTo(23, -50);
    g.lineTo(8, -70);
    g.lineTo(-11, -81);
    g.lineTo(-29, -70);
    g.lineTo(-41, -50);
    g.closePath();
    g.fill();
    g.strokeStyle = '#ebdabb';
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(-45, -52);
    g.lineTo(-31, -74);
    g.lineTo(-11, -86);
    g.lineTo(11, -74);
    g.lineTo(24, -52);
    g.stroke();
    g.strokeRect(-41, -47, 60, 46);
    g.fillStyle = '#67382f';
    g.fillRect(-31, -37, 39, 37);
    g.strokeStyle = '#f0dfbd';
    g.lineWidth = 2.5;
    g.strokeRect(-31, -37, 39, 37);
    g.beginPath();
    g.moveTo(-11, -37);
    g.lineTo(-11, 0);
    g.moveTo(-31, -36);
    g.lineTo(7, -1);
    g.moveTo(7, -36);
    g.lineTo(-31, -1);
    g.stroke();
    g.fillStyle = '#f6d389';
    g.fillRect(-17, -66, 12, 10);
    g.strokeStyle = '#efe3c1';
    g.lineWidth = 1.5;
    g.strokeRect(-17, -66, 12, 10);
    g.beginPath();
    g.moveTo(-11, -66);
    g.lineTo(-11, -56);
    g.stroke();
    g.fillStyle = '#ecd2a0';
    g.fillRect(-27, -45, 31, 6);
    g.fillStyle = '#755b3d';
    g.font = 'bold 4.5px Georgia';
    g.textAlign = 'center';
    g.fillText('DUSK ACRES', -11.5, -40.4);
    if (repair < 5) {
      g.fillStyle = '#8b765b';
      g.beginPath();
      g.moveTo(7, -73);
      g.lineTo(12, -68);
      g.lineTo(17, -71);
      g.lineTo(14, -76);
      g.fill();
    }
    if (repair >= 1) {
      g.fillStyle = '#d4aa59';
      g.fillRect(27, -14, 24, 14);
      ell(g, 39, -14, 12, 4);
      g.strokeStyle = '#9e7940';
      g.lineWidth = 1;
      for (let yy = -11; yy < -1; yy += 3) {
        g.beginPath();
        g.moveTo(28, yy);
        g.lineTo(50, yy);
        g.stroke();
      }
    }
    g.restore();
  }
  function ensureScenery() {
    const bm = curBiome();
    const phaserScene = window.__PHASER_FARM_SCENE;
    const fgTex = phaserScene && phaserScene.textures ? phaserScene.textures.get(`env_${bm.countryCode}_fg`) : null;
    const fullTex = phaserScene && phaserScene.textures ? phaserScene.textures.get(`env_${bm.countryCode}`) : null;
    const hasTex = !!(fgTex && fgTex.source && fgTex.source.width > 0);
    const key = [
      Math.round(worldW),
      Math.round(scale * dpr * 100),
      farm.billsPaid,
      bm.countryCode,
      bm.subTheme,
      hasTex ? 'tex' : 'proc',
    ].join(':');
    if (sceneryKey === key && sceneryLayer) return;
    sceneryKey = key;
    if (hasTex) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(worldW * scale * dpr));
      c.height = Math.round(FIELD_TOP * scale * dpr);
      const g = c.getContext('2d');
      g.scale(scale * dpr, scale * dpr); // Draw subtle sky-blended base from full panorama at 35% opacity so mountain ridges blend seamlessly with dynamic sky, then 100% opaque sky-keyed midground illustration on top!
      {
        const iw = fgTex.source.width,
          ih = fgTex.source.height;
        const dh = FIELD_TOP;
        let dw = (dh * iw) / ih;
        if (dw < worldW) dw = worldW;
        const x0 = (worldW - dw) / 2;
        window.__bandX0 = x0;
        window.__bandW = dw;
        g.drawImage(fgTex.source, x0, 0, dw, dh);
      }
      sceneryLayer = c;
      return;
    }
    sceneryLayer = window.DBD_ENV_RENDERER.paintSceneryCanvas(
      worldW,
      FIELD_TOP,
      scale,
      dpr,
      bm.countryCode,
      bm.subTheme,
      farm.billsPaid,
      paintBarn,
    );
  }
  function buildFieldLayer() {
    const top = FIELD_TOP - 14,
      h = HW - top,
      c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(worldW * scale * dpr));
    c.height = Math.max(1, Math.round(h * scale * dpr));
    const g = c.getContext('2d');
    g.scale(scale * dpr, scale * dpr);
    g.translate(0, -top);
    const bm = curBiome();
    const ground = g.createLinearGradient(0, top, 0, HW);
    ground.addColorStop(0, bm.soilA);
    ground.addColorStop(0.35, bm.soilB);
    ground.addColorStop(1, bm.soilC);
    g.fillStyle = ground;
    g.fillRect(0, top, worldW, h);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = i / n,
        y = FIELD_TOP + 10 + (HW - FIELD_TOP) * Math.pow(t, 1.3),
        th = 5 + 18 * t,
        sag = 3 + t * 8;
      const ridge = g.createLinearGradient(0, y - th * 0.5, 0, y + th * 1.3);
      if (bm.countryCode === 'BR') {
        // World 2: Shimmering Cranberry Bog water channels between peat rows!
        ridge.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
        ridge.addColorStop(0.45, 'rgba(20, 184, 166, 0.22)');
        ridge.addColorStop(1, 'rgba(15, 23, 42, 0.42)');
      } else if (bm.countryCode === 'CA') {
        // World 3: Frosted Snow-Rim Alpine Terraces!
        ridge.addColorStop(0, 'rgba(241, 245, 249, 0.38)');
        ridge.addColorStop(0.4, 'rgba(148, 163, 184, 0.18)');
        ridge.addColorStop(1, 'rgba(30, 41, 59, 0.38)');
      } else if (bm.countryCode === 'FR') {
        // World 4: Grumble's Manor Manicured Velvet & Gold-Trimmed Rows!
        ridge.addColorStop(0, 'rgba(250, 204, 21, 0.22)');
        ridge.addColorStop(0.4, 'rgba(168, 85, 247, 0.14)');
        ridge.addColorStop(1, 'rgba(30, 27, 75, 0.40)');
      } else {
        ridge.addColorStop(0, 'rgba(237,184,115,.29)');
        ridge.addColorStop(0.35, 'rgba(206,146,88,.13)');
        ridge.addColorStop(0.55, 'rgba(74,39,21,.1)');
        ridge.addColorStop(1, 'rgba(40,24,18,.38)');
      }
      g.fillStyle = ridge;
      g.beginPath();
      g.moveTo(0, y - th * 0.6);
      g.bezierCurveTo(worldW * 0.3, y - th * 0.5 + sag, worldW * 0.7, y - th * 0.6 + sag, worldW, y - th * 0.6);
      g.lineTo(worldW, y + th * 1.2);
      g.bezierCurveTo(worldW * 0.7, y + th * 1.2 + sag, worldW * 0.3, y + th * 1.1 + sag, 0, y + th * 1.2);
      g.closePath();
      g.fill();
      g.strokeStyle =
        bm.countryCode === 'CA'
          ? 'rgba(255,255,255,.28)'
          : bm.countryCode === 'BR'
            ? 'rgba(125,211,252,.22)'
            : 'rgba(237,188,127,.14)';
      g.lineWidth = 0.8 + t * 0.5;
      g.beginPath();
      g.moveTo(0, y - th * 0.6);
      g.quadraticCurveTo(worldW / 2, y - th * 0.6 + sag * 1.7, worldW, y - th * 0.6);
      g.stroke();
    }
    const r = mulberry(701);
    for (let i = 0; i < Math.min(2400, worldW * 2.4); i++) {
      const x = r() * worldW,
        y = top + r() * h,
        d = (y - top) / h,
        z = 0.35 + r() * 1.8 * (0.5 + d);
      g.fillStyle = i % 3 === 0 ? 'rgba(243,200,139,.14)' : 'rgba(48,26,16,.15)';
      ell(g, x, y, z, z * 0.45, r() * 0.5);
    }
    for (let i = 0; i < Math.min(70, worldW / 10); i++) {
      const x = r() * worldW,
        y = top + 12 + r() * (h - 25),
        z = 0.6 + r() * 1.4;
      g.fillStyle = '#73593e';
      ell(g, x, y, z * 1.6, z);
      g.fillStyle = 'rgba(213,176,119,.35)';
      ell(g, x - 0.3, y - 0.4, z * 0.8, z * 0.4);
    }
    const grass = (x, y, sz) => {
      g.strokeStyle = r() < 0.5 ? '#688b42' : '#9aaa58';
      g.lineWidth = 1.2;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + (k - 1) * sz * 0.6, y - sz * 0.55, x + (k - 1) * sz, y - sz);
        g.stroke();
      }
    };
    for (let x = 0; x < worldW; x += 4 + r() * 7) grass(x, top + 5 + r() * 4, 4 + r() * 7);
    for (let y = top + 12; y < HW; y += 12 + r() * 20) {
      grass(3 + r() * 5, y, 5 + r() * 8);
      grass(worldW - 3 - r() * 5, y, 5 + r() * 8);
    }
    for (let x = 0; x < worldW; x += 7 + r() * 10) {
      grass(x, HW + 2 + r() * 5, 5 + r() * 10);
      if (r() < 0.18) {
        g.fillStyle = r() < 0.5 ? '#f6d68e' : '#e9d8b4';
        circ(g, x, HW - 5 - r() * 5, 1.6);
      }
    }
    const vig = g.createLinearGradient(0, 0, worldW, 0);
    vig.addColorStop(0, 'rgba(36,39,22,.25)');
    vig.addColorStop(0.1, 'rgba(36,39,22,0)');
    vig.addColorStop(0.9, 'rgba(36,39,22,0)');
    vig.addColorStop(1, 'rgba(36,39,22,.25)');
    g.fillStyle = vig;
    g.fillRect(0, top, worldW, h);
    fieldLayer = c;
  }
  function resize() {
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const oldW = worldW;
    cssW = rect.width;
    cssH = rect.height;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    scale = cssH / HW;
    worldW = cssW / scale;
    if (oldW && Math.abs(oldW - worldW) > 0.5) {
      const f = worldW / oldW;
      crops.forEach((c) => (c.x *= f));
      if (goat) goat.x *= f;
      pointer.x *= f;
    }
    buildHills();
    buildFieldLayer();
    coinTarget = null;
    if (!oldW && mode === 'idle' && cur && SPRITES.carrot) fillIdle();
  }
  /* ================= runtime ================= */ let mode = 'idle'; // idle | day | dusk
  let cur = null,
    time = 0,
    dayLen = 16,
    tNow = 0;
  let paused = false,
    rushTimer = 0,
    rushCharge = 0;
  const RUSH_GOAL = 22,
    RUSH_DURATION = 4;
  const CHAIN_TIERS = [
    { count: 0, mul: 1 },
    { count: 8, mul: 1.25 },
    { count: 18, mul: 1.5 },
    { count: 30, mul: 2 },
  ];
  let crops = [],
    parts = [],
    texts = [],
    goat = null,
    goatTimer = Infinity;
  let tickAcc = 0,
    spawnAcc = 0,
    sweepT = 0,
    sweepA = 0,
    shakeA = 0,
    duskT = 0,
    dawnFade = 0,
    lastSec = 99,
    hitStopTimer = 0;
  let smokePuffs = [],
    weatherParts = [],
    fieldProps = [],
    crows = [],
    bolts = [];
  let propTimer = 4.5,
    crowTimer = 7.0,
    chargeT = 0,
    chargeReady = false,
    arthurAngerTimer = 0,
    vortexes = /* unused pure expression or super */ null && [];
  let dailyEvent = FarmScene_GAZETTE_EVENTS[0];
  function rollDailyEvent() {
    dailyEvent =
      FarmScene_GAZETTE_EVENTS[(farm.day * 7 + farm.no * 3 + (meta.biome || 0)) % FarmScene_GAZETTE_EVENTS.length];
  }
  let combo = 0,
    comboTimer = 0,
    today = { earned: 0, count: 0, best: 0, bonus: 0, rushes: 0, lucky: 0 },
    coinTarget = null,
    lastBump = 0;
  const pointer = {
    x: 0,
    y: 0,
    lastX: 0,
    lastY: 0,
    vx: 0,
    vy: 0,
    active: false,
    down: false,
    placed: false,
    kind: 'mouse',
  };
  const keys = new Set(); // 3-Stage Crop Growth Timings (snappy so gameplay stays fast and responsive!)
  const STAGE2_AGE = 0.16;
  const STAGE3_AGE = 0.36;
  function depth(y) {
    return 1.2 * (0.8 + 0.45 * FarmScene_clamp((y - FIELD_TOP) / (HW - FIELD_TOP), 0, 1));
  }
  function pickType() {
    const paid = farm.billsPaid;
    if (Math.random() < cur.gold) return 'golden';
    const T = [
      ['lavender', 30, 0],
      ['echalote', 24, 0],
      ['artichaut', 24, 0],
      ['carrot', 18, 0],
      ['radish', 16, 0],
      ['cabbage', 12, 1],
      ['onion', 12, 1],
      ['berry', 12, 2],
      ['pumpkin', 6, 2],
      ['potato', 5, 2],
    ];
    const w = T.filter((t) => paid >= t[2] && CROP[t[0]]);
    let r = Math.random() * w.reduce((a, b) => a + b[1], 0);
    for (const t of w) {
      r -= t[1];
      if (r <= 0) return t[0];
    }
    return w[0][0];
  }
  function makeMoundClumps(r) {
    const clumps = [];
    const cnt = Math.max(6, Math.round(r * 0.22));
    for (let i = 0; i < cnt; i++) {
      const t = (i / (cnt - 1)) * Math.PI - Math.PI;
      clumps.push({
        ox: Math.cos(t) * (r * (0.55 + Math.random() * 0.28)),
        oy: Math.sin(t) * -(r * 0.09) + (Math.random() - 0.5) * 2.5,
        r: r * 0.14 + Math.random() * (r * 0.09),
        shade: i % 2 === 0 ? '#4a3222' : '#5e402b',
      });
    }
    return clumps;
  }
  function spawnCrop(delay) {
    const type = pickType(),
      def = CROP[type];
    let x = 0,
      y = 0,
      ok = false;
    for (let i = 0; i < 14 && !ok; i++) {
      x = PAD + Math.random() * (worldW - PAD * 2);
      y = FIELD_TOP + 32 + Math.random() * (HW - FIELD_TOP - 54);
      const rr = def.r * depth(y);
      ok = crops.every((c) => {
        const dx = c.x - x,
          dy = c.y - y,
          m = (c.r * c.ds + rr) * 0.85;
        return dx * dx + dy * dy > m * m;
      });
    }
    if (!ok) return false;
    const hp = def.hp * hpMul();
    const ds = depth(y);
    crops.push({
      type,
      x,
      y,
      ds,
      r: def.r,
      hp,
      maxHp: hp,
      age: -(delay || 0),
      stage: 1, // Hooke's Law spring state for squash-and-stretch
      stretch: -0.52,
      stretchVel: 7.2,
      wobbleAngle: 0,
      wobbleVel: 0,
      moundClumps: makeMoundClumps(def.r),
      sq: 0,
      flash: 0,
      wob: Math.random() * 6.28,
      vx: 0,
      vy: 0,
      hpShow: 0,
      panic: 0,
      stam: 1,
      zt: Math.random() * 2,
      eye: 0,
      monoclePop: 0,
      capBounce: 0,
      crownPop: 0,
      hatProgress: 0,
      scarfProgress: 0,
      frosted: !!(dailyEvent && dailyEvent.frost && Math.random() < 0.55),
      dead: false,
      lucky: Math.random() < 0.03 + 0.008 * (meta.heir.horseshoe || 0),
    });
    return true;
  }
  function fillIdle() {
    crops = [];
    for (let i = 0; i < cur.max; i++) spawnCrop(0);
    const sig = (curCity().crops || []).slice(0, 5);
    crops.forEach((c, idx) => {
      if (sig.length && idx < sig.length && CROP[sig[idx]]) {
        c.type = sig[idx];
        c.r = CROP[sig[idx]].r;
        c.hp = CROP[sig[idx]].hp * hpMul();
        c.maxHp = c.hp;
      }
      c.age = 1;
      c.stage = 3;
      c.stretch = 0;
      c.stretchVel = 0;
      c.hatProgress = 0.65;
      c.scarfProgress = 0;
    });
  }
  function startDay() {
    if (mode !== 'idle' || farm.pendingPerks || !el.modal.hidden || billStatus().tonight) return;
    dayCheckpoint = JSON.parse(JSON.stringify(farm));
    Sound.init();
    cur = stats();
    dayLen = cur.day;
    time = dayLen;
    lastSec = 99;
    rollDailyEvent();
    crops = [];
    parts = [];
    texts = [];
    fieldProps = [];
    crows = [];
    bolts = [];
    spawnAcc = 0;
    tickAcc = 0;
    combo = 0;
    comboTimer = 0;
    propTimer = 3.8;
    crowTimer = farm.billsPaid >= 2 ? 5.5 : 999;
    chargeT = 0;
    chargeReady = false;
    rushTimer = 0;
    rushCharge = 0;
    paused = false;
    today = { earned: 0, count: 0, best: 0, bonus: 0, rushes: 0, lucky: 0 };
    goatTimer = farm.billsPaid >= 2 ? 3 + Math.random() * 5 : Infinity;
    goat = null;
    const initCount = Math.min(cur.max, 4 + Math.floor(cur.max * 0.35) + (hasSkill('soil_dew') ? 3 : 0));
    for (let i = 0; i < initCount; i++) spawnCrop(0.08 + i * 0.04);
    mode = 'day';
    last = performance.now();
    dawnFade = reduceMotion ? 0 : 0.65;
    stage.classList.add('playing');
    syncPause();
    if (pointer.kind === 'key') pointer.active = false;
    coinTarget = null;
    if (window.__odDayStart) window.__odDayStart({ id: dailyEvent.id, title: dailyEvent.title, desc: dailyEvent.desc });
    Sound.dawn();
    renderAll();
  }
  function endDay() {
    if (mode !== 'day') return;
    if (window.__odDayEnded) window.__odDayEnded(Object.assign({}, today));
    dayCheckpoint = null;
    mode = 'dusk';
    duskT = 0;
    paused = false;
    syncPause();
    farm.lastEarn = today.earned;
    farm.lastCount = today.count;
    farm.lastBest = today.best;
    farm.lastBonus = today.bonus;
    farm.bestChain = Math.max(farm.bestChain || 0, today.best);
    farm.day += 1;
    farm.played = true;
    rushTimer = 0;
    rushCharge = 0;
    comboTimer = 0;
    combo = 0;
    stage.classList.remove('playing');
    keys.clear();
    pointer.active = false;
    pointer.down = false;
    if (hasSkill('gold_interest') && farm.cash > 0) {
      const interest = Math.min(300, Math.floor(farm.cash * 0.12));
      if (interest > 0) {
        farm.cash += interest;
        farm.earned += interest;
      }
    }
    const ct = curCity();
    if (!meta.cityRecords) meta.cityRecords = {};
    if (!meta.cityOwned) meta.cityOwned = {};
    meta.cityRecords[ct.id] = Math.max(meta.cityRecords[ct.id] || 0, Math.floor(today.earned));
    if (today.earned >= ct.record && !meta.cityOwned[ct.id]) {
      meta.cityOwned[ct.id] = true;
      meta.diamonds = (meta.diamonds || 0) + 1;
      toast(`👑 Dethroned ${ct.rival} in ${ct.name}! Earned +1 💎 Diamond & Regional Tribute!`, 4200);
    }
    Sound.sunset();
    save();
    renderAll();
  }
  function chainMultiplier() {
    let value = 1;
    for (const tier of CHAIN_TIERS) if (combo >= tier.count) value = tier.mul;
    return value;
  }
  function incomeMultiplier() {
    return Math.min(3, Math.round(chainMultiplier() * (rushTimer > 0 ? 1.5 : 1) * 100) / 100);
  }
  function syncPause() {
    const overlay = $('#pauseOverlay'),
      button = $('#btnPause');
    if (overlay) overlay.hidden = !paused;
    if (button) {
      button.hidden = mode !== 'day';
      button.setAttribute('aria-pressed', String(paused));
    }
    stage.classList.toggle('paused', paused);
  }
  function setPaused(value) {
    if (mode !== 'day') return;
    paused = !!value;
    keys.clear();
    pointer.down = false;
    pointer.active = false;
    last = 0;
    syncPause();
    const focus = paused ? $('#btnResume') : $('#btnPause');
    if (focus) focus.focus();
  }
  function triggerRush() {
    rushTimer = RUSH_DURATION;
    const sc = window.__PHASER_FARM_SCENE;
    if (sc && sc.cameras && sc.cameras.main) sc.cameras.main.flash(260, 255, 235, 145);
    rushCharge = 0;
    today.rushes++;
    addText('HARVEST RUSH!', worldW / 2, FIELD_TOP + 65, '#ffe08a', 36, -20, 1.1);
    toast('Harvest Rush! +50% income + faster crops for 4 seconds.', 2600);
    Sound.fanfare();
  }
  function unleashChargeCleave() {
    if (mode !== 'day' || !pointer.active) {
      chargeT = 0;
      chargeReady = false;
      return;
    }
    const cleaveR = cur.R * (cur.cleaver ? 2.5 : 2.15);
    const cleaveDmg = cur.dmg * 2.6;
    chargeT = 0;
    chargeReady = false;
    sweepT = 0.22;
    hitStopTimer = 0.04;
    shake(8);
    Sound.hit(true);
    parts.push({ k: 'ring', x: pointer.x, y: pointer.y, r: cleaveR, life: 0.42, max: 0.42, c: '#38bdf8' });
    parts.push({ k: 'ring', x: pointer.x, y: pointer.y, r: cleaveR * 0.72, life: 0.32, max: 0.32, c: '#fde047' });
    addText('CLEAVE!', pointer.x, pointer.y - cleaveR * 0.6, '#fde047', 28, -45, 0.85);
    let killed = 0;
    for (const c of crops) {
      if (c.dead || c.age < 0.04) continue;
      const cy = c.y - c.r * c.ds * 0.55;
      if (Math.hypot(c.x - pointer.x, cy - pointer.y) > cleaveR + c.r * c.ds * 0.6) continue;
      if (c.frosted) {
        c.frosted = false;
        farm.cash += 2;
        farm.earned += 2;
        today.earned += 2;
        addText('ICE CRACK +$2', c.x, cy - 22, '#bae6fd', 18, -35, 0.8);
      }
      c.hp -= cleaveDmg;
      c.sq = 1;
      c.flash = 1;
      c.hpShow = 1.6;
      c.eye = 1.45;
      c.stretch = -0.45;
      c.stretchVel = -9.0;
      debris(c, 5);
      if (c.hp <= 1e-6 || (hasSkill('reap_exec') && c.hp / c.maxHp <= 0.25)) {
        harvest(c);
        killed++;
      }
    }
    if (killed) crops = crops.filter((c) => !c.dead); // Calm angry goat if caught in Charge Cleave!
    if (goat && goat.bumped && Math.hypot(goat.x - pointer.x, goat.y - pointer.y) <= cleaveR + 35) {
      goat.bumped = false;
      goat.speed = 65;
      goat.hop = 1.0;
      farm.cash += 5;
      farm.earned += 5;
      today.earned += 5;
      addText('GOAT CALMED +$5', goat.x, goat.y - 45, '#86efac', 24, -40, 1.0);
      Sound.coin();
    }
    checkPropsAndCrows(cleaveR);
  }
  function spawnFieldProp() {
    if (fieldProps.length >= 2) return;
    const kind = goat && !cur.treaty && Math.random() < 0.45 ? 'treat' : 'fertilizer';
    const x = PAD + 40 + Math.random() * (worldW - PAD * 2 - 80);
    const y = FIELD_TOP + 45 + Math.random() * (HW - FIELD_TOP - 80);
    fieldProps.push({ kind, x, y, ds: depth(y), age: 0, life: 9.5 });
  }
  function spawnCrow() {
    if (crows.length >= 2 || !crops.length) return;
    const target = crops[Math.floor(Math.random() * crops.length)];
    const fromLeft = Math.random() < 0.5;
    crows.push({
      x: fromLeft ? -30 : worldW + 30,
      y: 45 + Math.random() * 55,
      tx: target.x,
      ty: target.y - 18,
      vx: 0,
      vy: 0,
      t: 0,
      scared: false,
    });
  }
  function checkPropsAndCrows(rad) {
    const R = rad || cur.R;
    for (let i = fieldProps.length - 1; i >= 0; i--) {
      const fp = fieldProps[i];
      if (Math.hypot(fp.x - pointer.x, fp.y - 14 * fp.ds - pointer.y) <= R + 22 * fp.ds) {
        fieldProps.splice(i, 1);
        Sound.coin();
        parts.push({ k: 'ring', x: fp.x, y: fp.y - 10, r: 55, life: 0.4, max: 0.4, c: '#86efac' });
        if (fp.kind === 'fertilizer') {
          addText('FERTILIZER! +4 CROPS', fp.x, fp.y - 32, '#bef264', 24, -42, 1.0);
          for (let k = 0; k < 4; k++) {
            if (spawnCrop(0)) {
              const nc = crops[crops.length - 1];
              nc.age = 0.5;
              nc.stage = 3;
            }
          }
        } else {
          const bonus = 5 + farm.billsPaid * 2;
          farm.cash += bonus;
          farm.earned += bonus;
          today.earned += bonus;
          if (goat) {
            goat.bumped = false;
            goat.speed = 60;
            goat.hop = 1.0;
          }
          addText(`CLOVER TREAT! +$${bonus}`, fp.x, fp.y - 32, '#fde047', 24, -42, 1.0);
        }
      }
    }
    for (const cr of crows) {
      if (!cr.scared && Math.hypot(cr.x - pointer.x, cr.y - pointer.y) <= R + 28) {
        cr.scared = true;
        arthurAngerTimer = 2.4;
        cr.vx = (cr.x < pointer.x ? -1 : 1) * 260;
        cr.vy = -220;
        const tip = 3 + farm.billsPaid * 2;
        farm.cash += tip;
        farm.earned += tip;
        today.earned += tip;
        addText(`SHOO CROW! +$${tip}`, cr.x, cr.y - 20, '#fde047', 22, -38, 0.95);
        Sound.pop(10);
        coin(cr.x, cr.y, 0);
      }
    }
  }
  function swing() {
    if (!pointer.active) return;
    sweepT = 0.13;
    sweepA = (sweepA + 2.3) % (Math.PI * 2);
    const crit = Math.random() < cur.cc,
      dmg = cur.dmg * (crit ? cur.cm : 1);
    let hits = 0,
      killed = 0;
    for (const c of crops) {
      if (c.dead || c.age < 0.04) continue;
      const cy = c.y - c.r * c.ds * 0.55,
        dx = c.x - pointer.x,
        dy = cy - pointer.y,
        rr = cur.R + c.r * c.ds * 0.65;
      if (dx * dx + dy * dy > rr * rr) continue;
      hits++;
      if (c.frosted) {
        c.frosted = false;
        farm.cash += 2;
        farm.earned += 2;
        today.earned += 2;
        addText('FROST +$2', c.x, cy - 24, '#bae6fd', 18, -36, 0.8);
      } // Monsieur Échalote's Invisible Glass Box blocks the first hit of damage!
      if (c.type === 'echalote' && !c.mimeBlocked) {
        c.mimeBlocked = true;
        c.sq = 1;
        c.flash = 1;
        c.hpShow = 1.5;
        c.eye = 1.35;
        c.stretch = -0.22;
        c.stretchVel = -4.5;
        c.wobbleVel = (pointer.vx >= 0 ? 1 : -1) * 6.5;
        parts.push({ k: 'ring', x: c.x, y: cy, r: c.r * c.ds * 1.3, life: 0.32, max: 0.32, c: '#38bdf8' });
        addText('SACRÉ BLEU! (MIME WALL!)', c.x, cy - 26, '#7dd3fc', 17, -34, 0.9);
        if (Sound.ok()) Sound.tone(1480, 0.08, { type: 'triangle', v: 0.14, to: 1920 });
        continue;
      }
      c.hp -= dmg;
      if (c.type === 'onion' && canAdd()) {
        for (const dir of [-1, 1]) {
          parts.push({
            k: 'juice',
            x: c.x + dir * 8,
            y: cy - 4,
            vx: dir * (45 + Math.random() * 40),
            vy: -65,
            g: 520,
            floor: c.y + 4,
            r: 3.2,
            c: '#38bdf8',
            life: 0.55,
            max: 0.55,
          });
        }
      }
      c.sq = 1;
      c.flash = 1;
      c.hpShow = 1.4;
      c.eye = 1.35;
      c.monoclePop = 1.0;
      c.capBounce = 1.0;
      c.crownPop = 1.0; // Rikishi Kabocha takes half knockback due to his heavy sumo stance!
      const kbScale = c.type === 'kabocha' ? 0.48 : c.type === 'fiddlehead' ? 1.45 : 1.0;
      c.stretch = (c.type === 'fiddlehead' ? 0.52 : -0.38) * kbScale;
      c.stretchVel = (c.type === 'fiddlehead' ? 13.5 : -7.5) * kbScale;
      c.wobbleVel = (pointer.vx >= 0 ? 1 : -1) * 9.5 * kbScale; // Trigger country-specific On-Hit Counter / Slapstick Gag Animations!
      triggerRegionalOnHitGag(c, cy);
      debris(c, crit ? 5 : 3);
      if (c.hp <= 1e-6 || (hasSkill('reap_exec') && c.hp / c.maxHp <= 0.25)) {
        harvest(c);
        killed++;
      }
    }
    if (hits) {
      Sound.hit(crit);
      if (crit) {
        shake(5);
        hitStopTimer = 0.035;
        addText('CRIT', pointer.x, pointer.y - cur.R - 8, '#ffd34d', 30, -40, 0.7);
        spark(pointer.x, pointer.y); // Storm Scythe synergy: chain lightning to up to 2 nearby crops!
        if (cur.storm) {
          let chained = 0;
          for (const tCrop of crops) {
            if (tCrop.dead || chained >= 2) continue;
            const d = Math.hypot(tCrop.x - pointer.x, tCrop.y - pointer.y);
            if (d > cur.R && d < cur.R + 170) {
              chained++;
              bolts.push({ x1: pointer.x, y1: pointer.y, x2: tCrop.x, y2: tCrop.y - 18, life: 0.22, max: 0.22 });
              tCrop.hp -= cur.dmg * 1.6;
              tCrop.eye = 0.85;
              tCrop.stretch = -0.35;
              if (tCrop.hp <= 1e-6) {
                harvest(tCrop);
                killed++;
              }
            }
          }
        }
      }
    }
    if (killed) crops = crops.filter((c) => !c.dead);
    if (goat) checkGoat();
    checkPropsAndCrows(cur.R);
  }
  let perfumeSparkleTimer = 0;
  function triggerRegionalOnHitGag(c, cy) {
    if (c.hp <= 1e-6) return; // Only counter-gag while still alive on the field
    const now = performance.now();
    if (c.lastGagAt && now - c.lastGagAt < 260) return;
    c.lastGagAt = now;
    const dx = pointer.x - c.x,
      dy = pointer.y - cy,
      dist = Math.hypot(dx, dy) || 1;
    if (c.type === 'bittermelon') {
      addText('AIYA! CLANG! 🔔', c.x, cy - 28, '#facc15', 20, -42, 0.9);
      parts.push({ k: 'ring', x: c.x, y: cy, r: 32, life: 0.3, max: 0.3, c: '#facc15' });
      if (Sound.ok()) Sound.tone(440, 0.2, { type: 'triangle', v: 0.26, to: 220 });
    } else if (c.type === 'bokchoy') {
      addText('AIYA! 🪭💨', c.x, cy - 28, '#fca5a5', 20, -42, 0.9);
      if (Sound.ok()) Sound.tone(520, 0.15, { type: 'sine', v: 0.22, to: 310 });
    } else if (c.type === 'lotusroot') {
      addText('WAH! 🫖💨', c.x, cy - 28, '#fde68a', 20, -42, 0.9);
      for (const dir of [-1, 1]) {
        if (canAdd())
          parts.push({
            k: 'juice',
            x: c.x + dir * 10,
            y: cy - 4,
            vx: dir * (50 + Math.random() * 40),
            vy: -75,
            g: 500,
            floor: c.y + 4,
            r: 3.2,
            c: '#d97706',
            life: 0.55,
            max: 0.55,
          });
      }
      if (Sound.ok()) Sound.tone(360, 0.16, { type: 'sine', v: 0.2, to: 640 });
    } else if (c.type === 'chickpea') {
      addText('AYWA! 🫖', c.x, cy - 28, '#fde047', 20, -42, 0.9);
    } else if (c.type === 'eggplant') {
      addText('WAILI! 🏮', c.x, cy - 28, '#c084fc', 20, -42, 0.9);
    } else if (c.type === 'olive') {
      addText('YALLAH! 🥁', c.x, cy - 28, '#bef264', 20, -42, 0.9);
    } else if (c.type === 'daikon') {
      // Sensei Daikon: Fights back with a KIAI! karate punch/kick that slightly knocks cursor back!
      addText('KIAI! 🥋', c.x, cy - 26, '#fca5a5', 20, -42, 0.8);
      pointer.x = FarmScene_clamp(pointer.x + (dx / dist) * 18, PAD, worldW - PAD);
      pointer.y = FarmScene_clamp(pointer.y + (dy / dist) * 14, FIELD_TOP, HW - 10);
      parts.push({ k: 'ring', x: c.x + (dx / dist) * 14, y: cy, r: 26, life: 0.25, max: 0.25, c: '#ef4444' });
    } else if (c.type === 'kabocha') {
      // Rikishi Kabocha: Belly Bounce + heavy taiko drum DON! sound & half knockback!
      addText('DON! 🥁', c.x, cy - 28, '#fde047', 22, -36, 0.85);
      pointer.x = FarmScene_clamp(pointer.x + (dx / dist) * 22, PAD, worldW - PAD);
      parts.push({ k: 'ring', x: c.x, y: cy, r: 38, life: 0.32, max: 0.32, c: '#facc15' });
      if (Sound.ok()) Sound.tone(82, 0.18, { type: 'triangle', v: 0.32, to: 42 });
    } else if (c.type === 'habanero') {
      addText('YEE-HAW! 🤠🔥', c.x, cy - 28, '#facc15', 20, -42, 0.9);
      if (Sound.ok()) Sound.tone(340, 0.16, { type: 'sawtooth', v: 0.22, to: 620 });
    } else if (c.type === 'sweetcorn') {
      addText('HUT! HUT! 🏈🍿', c.x, cy - 28, '#fde047', 20, -42, 0.9);
      pointer.x = FarmScene_clamp(pointer.x + (dx / dist) * 16, PAD, worldW - PAD);
      if (Sound.ok()) Sound.tone(180, 0.14, { type: 'square', v: 0.2, to: 95 });
    } else if (c.type === 'brisket_onion') {
      addText('DAGNABBIT! 😭🌶️', c.x, cy - 28, '#bae6fd', 20, -42, 0.9);
      for (const dir of [-1, 1]) {
        if (canAdd())
          parts.push({
            k: 'juice',
            x: c.x + dir * 10,
            y: cy - 4,
            vx: dir * (55 + Math.random() * 40),
            vy: -70,
            g: 520,
            floor: c.y + 4,
            r: 3.4,
            c: '#38bdf8',
            life: 0.6,
            max: 0.6,
          });
      }
      if (Sound.ok()) Sound.tone(520, 0.14, { type: 'triangle', v: 0.18, to: 260 });
    } else if (c.type === 'wasabi') {
      // Shinobi Wasabi: Smoke Bomb Teleport + spicy green sparks!
      addText('WASABI POOF! 💨', c.x, cy - 24, '#86efac', 18, -38, 0.85);
      for (let i = 0; i < 6 && canAdd(); i++) {
        parts.push({
          k: 'dust',
          x: c.x + (Math.random() - 0.5) * 18,
          y: cy + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * 90,
          vy: -30 - Math.random() * 50,
          g: 0,
          s: 6 + Math.random() * 5,
          life: 0.48,
          max: 0.48,
        });
        spark(c.x + (Math.random() - 0.5) * 24, cy + (Math.random() - 0.5) * 18);
      }
      const teleAng = Math.random() * Math.PI * 2,
        teleDist = 48 + Math.random() * 34;
      c.x = FarmScene_clamp(c.x + Math.cos(teleAng) * teleDist, PAD + 20, worldW - PAD - 20);
      c.y = FarmScene_clamp(c.y + Math.sin(teleAng) * teleDist * 0.65, FIELD_TOP + 34, HW - 26);
      c.ds = depth(c.y);
    } else if (c.type === 'pei_russet') {
      // Hoser Russet: Drops the gloves, spits a tooth & slap-shots a dirt clod puck at cursor!
      addText('SOR-RY, EH! 🏒', c.x, cy - 26, '#fde68a', 19, -38, 0.85);
      if (canAdd()) {
        // Slap-shot dirt puck aimed right at cursor
        parts.push({
          k: 'clod',
          x: c.x + 12,
          y: c.y,
          vx: (dx / dist) * 260,
          vy: (dy / dist) * 220 - 40,
          g: 180,
          floor: HW + 20,
          r: 4.5,
          rot: 0,
          vr: 18,
          c: '#1c1917',
          life: 0.55,
          max: 0.55,
        }); // Flying white tooth
        parts.push({
          k: 'clod',
          x: c.x,
          y: cy - 6,
          vx: -65,
          vy: -125,
          g: 480,
          floor: c.y + 4,
          r: 2.8,
          rot: 0,
          vr: -14,
          c: '#ffffff',
          life: 0.6,
          max: 0.6,
        });
      }
    } else if (c.type === 'fiddlehead') {
      // Lumberjack Fiddlehead: Spiral Spring-Back BOING!
      addText('BOING! 🌀', c.x, cy - 26, '#86efac', 21, -44, 0.85);
      if (Sound.ok()) Sound.tone(220, 0.16, { type: 'sine', v: 0.18, to: 540 });
    } else if (c.type === 'saskaberry') {
      // Mountie Saskaberry: Shrill brass whistle & waves red "UNLAWFUL HARVEST" ticket!
      addText('🚨 UNLAWFUL HARVEST!', c.x, cy - 28, '#fda4af', 17, -36, 0.95);
      if (Sound.ok()) {
        Sound.tone(2450, 0.07, { type: 'square', v: 0.06 });
        Sound.tone(2750, 0.09, { type: 'square', v: 0.06, at: 0.08 });
      }
    } else if (c.type === 'abacaxi') {
      // Carnavale Abacaxi: Maraca Frenzy + samba-steps sideways!
      addText('MARACA FRENZY! 🪇', c.x, cy - 28, '#f472b6', 18, -38, 0.85);
      c.x = FarmScene_clamp(c.x + (Math.random() < 0.5 ? -1 : 1) * 32, PAD + 20, worldW - PAD - 20);
    } else if (c.type === 'mandioca') {
      // Ginga Mandioca: Upside-down handstand 360° capoeira meia-lua kick!
      addText('GINGA KICK! 🤸', c.x, cy - 26, '#fde047', 19, -38, 0.85);
      parts.push({ k: 'ring', x: c.x, y: cy, r: 32, life: 0.28, max: 0.28, c: '#22c55e' });
    } else if (c.type === 'guarana') {
      // Craque Guaraná: Dramatic Flop & Red Card!
      addText('FOUL! RED CARD! 🟥', c.x, cy - 26, '#ef4444', 18, -38, 0.95);
      if (Sound.ok()) Sound.tone(2600, 0.08, { type: 'triangle', v: 0.08 });
    } else if (c.type === 'echalote') {
      // Monsieur Échalote: Baguette counter-swing!
      addText('SACRÉ BLEU! 🥖', c.x, cy - 26, '#e9d5ff', 18, -36, 0.85);
    } else if (c.type === 'artichaut') {
      // Chevalier Artichaut: En Garde Parry + outer artichoke leaves pop off!
      addText('EN GARDE! ⚔️', c.x, cy - 28, '#86efac', 20, -40, 0.85);
      if (Sound.ok()) Sound.tone(1850, 0.09, { type: 'triangle', v: 0.12, to: 2400 });
      for (let i = 0; i < 3 && canAdd(); i++) {
        parts.push({
          k: 'leaf',
          x: c.x + (Math.random() - 0.5) * 16,
          y: cy,
          vx: (Math.random() - 0.5) * 150,
          vy: -85 - Math.random() * 60,
          g: 220,
          len: 8,
          wid: 4,
          rot: Math.random() * 6.28,
          vr: 14,
          phase: i,
          c: '#22c55e',
          life: 0.75,
          max: 0.75,
        });
      }
    } else if (c.type === 'lavender') {
      // Diva Lavande: Perfume Spritzer Counter -> screen briefly sparkles with purple lavender stars!
      addText('PERFUME SPRITZ! ✨', c.x, cy - 26, '#e9d5ff', 18, -38, 0.9);
      perfumeSparkleTimer = 1.15;
      for (let i = 0; i < 5 && canAdd(); i++) {
        spark(pointer.x + (Math.random() - 0.5) * 44, pointer.y + (Math.random() - 0.5) * 44);
      }
    }
  }
  function harvest(c) {
    if (c.dead) return;
    c.dead = true;
    const def = CROP[c.type],
      previousTier = chainMultiplier();
    combo = comboTimer > 0 ? combo + 1 : 1;
    comboTimer = cur.chainGrace;
    today.best = Math.max(today.best, combo);
    if (rushTimer <= 0) {
      rushCharge++;
      if (rushCharge >= RUSH_GOAL) triggerRush();
    }
    const midas =
      hasSkill('gold_midas') &&
      (c.lucky ||
        [
          'golden',
          'canola',
          'abacaxi',
          'mandioca',
          'guarana',
          'lavender',
          'echalote',
          'artichaut',
          'daikon',
          'kabocha',
          'wasabi',
          'pei_russet',
          'fiddlehead',
          'saskaberry',
          'habanero',
          'sweetcorn',
          'brisket_onion',
        ].includes(c.type))
        ? 1.5
        : 1;
    const multiplier = incomeMultiplier(),
      lucky = (c.lucky ? 2 : 1) * midas;
    const gazetteMul =
      (dailyEvent && dailyEvent.valMul ? dailyEvent.valMul : 1) *
      (dailyEvent && dailyEvent.pumpkinBonus && (c.type === 'pumpkin' || c.type === 'onion')
        ? dailyEvent.pumpkinBonus
        : 1);
    const baseValue = def.val * cur.vm * gazetteMul * (c.type === 'radish' ? cur.radishBonus : 1);
    const v = baseValue * multiplier * lucky;
    farm.cash += v;
    farm.earned += v;
    farm.harvested += 1;
    today.earned += v;
    today.count += 1;
    today.bonus += v - baseValue;
    if (c.lucky) today.lucky++;
    const top = c.y - def.top * c.ds;
    addText(
      fmtGain(v),
      c.x,
      top - 4,
      c.lucky || c.type === 'golden' ? '#ffe27a' : '#fffaf0',
      c.type === 'golden' ? 32 : Math.min(30, 21 + v / 4),
      -58,
      0.9,
    );
    if (c.lucky) addText('LUCKY ×2', c.x, top - 28, '#ffe08a', 19, -36, 1);
    if (chainMultiplier() > previousTier) {
      addText('CHAIN ×' + chainMultiplier(), c.x, top - 52, '#c8f5a8', 26, -26, 0.95);
      Sound.coin();
    }
    parts.push({
      k: 'ring',
      x: c.x,
      y: c.y - c.r * c.ds * 0.5,
      r: c.r * c.ds * 1.5,
      life: 0.35,
      max: 0.35,
      c: c.lucky ? '#ffe08a' : def.color,
    });
    if (c.type === 'pumpkin' || c.type === 'potato' || c.type === 'golden') {
      hitStopTimer = 0.032;
      spark(c.x, c.y - c.r * c.ds * 0.6);
    } // 4-Part Slice Burst: Clipped Crop Halves, Fluttering Leaves, Dirt Clods, and Juice Droplets!
    sliceBurst(c);
    if (hasSkill('soil_eden') && Math.random() < 0.25 && crops.length < cur.max) {
      spawnCrop(0.05);
    }
    const n = Math.min(5, 1 + Math.floor(v / 3));
    for (let i = 0; i < n; i++) coin(c.x + (Math.random() - 0.5) * 16, c.y - c.r * c.ds * 0.5, i * 0.03);
    Sound.pop(combo);
    if (c.type === 'golden' || c.lucky) Sound.coin();
  }
  /* ================= 4-part slice burst & particles ================= */ function canAdd() {
    return parts.length < (reduceMotion ? 140 : 480);
  }
  function debris(c, n) {
    if (!canAdd()) return;
    const def = CROP[c.type];
    const sz = (c.r / 24) * c.ds;
    for (let i = 0; i < n; i++) {
      // Bouncing soil clods on hit
      parts.push({
        k: 'clod',
        x: c.x + (Math.random() - 0.5) * c.r * c.ds,
        y: c.y + 2,
        vx: (Math.random() - 0.5) * 140 * sz,
        vy: -70 - Math.random() * 110 * sz,
        g: 560,
        floor: c.y + 5 + (Math.random() - 0.5) * 8,
        r: (2.2 + Math.random() * 2.8) * Math.sqrt(sz),
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 13,
        c: Math.random() < 0.5 ? '#4a3222' : '#6b4830',
        life: 0.55 + Math.random() * 0.25,
        max: 0.8,
      });
    } // A couple fluttering leaf clippings on hit
    if (!reduceMotion && canAdd()) {
      parts.push({
        k: 'leaf',
        x: c.x + (Math.random() - 0.5) * 14 * sz,
        y: c.y - c.r * c.ds * 0.8,
        vx: (Math.random() - 0.5) * 120,
        vy: -60 - Math.random() * 60,
        g: 210,
        len: (6 + Math.random() * 5) * Math.sqrt(sz),
        wid: (2.5 + Math.random() * 2) * Math.sqrt(sz),
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 15,
        phase: Math.random() * 6.28,
        c: Math.random() < 0.5 ? def.leaf : def.leafDark,
        life: 0.7,
        max: 0.7,
      });
    }
  }
  function sliceBurst(c) {
    const def = CROP[c.type];
    const sz = (c.r / 24) * c.ds;
    const cutAngle = Math.atan2(pointer.vy || -20, pointer.vx || 80); // 1. Two clean-cut crop halves with inner cross-section flying apart
    for (const side of [-1, 1]) {
      const perp = cutAngle + side * (Math.PI * 0.5);
      parts.push({
        k: 'half',
        type: c.type,
        x: c.x,
        y: c.y - c.r * c.ds * 0.55,
        vx: Math.cos(perp) * (70 + Math.random() * 40) + (pointer.vx || 0) * 0.12,
        vy: Math.sin(perp) * 45 - 135,
        g: 490,
        rot: 0,
        vr: side * (5 + Math.random() * 4),
        side,
        r: c.r * c.ds * 0.74,
        life: 0.58,
        max: 0.58,
      });
    }
    if (reduceMotion) return; // 2. Fluttering leaf clippings with horizontal sine drag
    const leafCount = Math.min(9, Math.round(7 * sz));
    for (let i = 0; i < leafCount && canAdd(); i++) {
      const a = -Math.PI * (0.1 + Math.random() * 0.8);
      const sp = (80 + Math.random() * 145) * Math.sqrt(sz);
      parts.push({
        k: 'leaf',
        x: c.x + (Math.random() - 0.5) * 14 * sz,
        y: c.y - c.r * c.ds * 0.75,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 45,
        g: 210,
        len: (6.5 + Math.random() * 6) * Math.sqrt(sz),
        wid: (2.6 + Math.random() * 2.4) * Math.sqrt(sz),
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 16,
        phase: Math.random() * 6.28,
        c: i % 2 === 0 ? def.leaf : def.leafDark,
        life: 0.85 + Math.random() * 0.3,
        max: 1.0,
      });
    } // 3. Bouncing dirt clods
    debris(c, Math.min(8, Math.round(6 * sz))); // 4. Glossy juice droplets that splat into puddles on the soil
    const juiceCount = Math.min(12, Math.round(9 * sz));
    for (let i = 0; i < juiceCount && canAdd(); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (75 + Math.random() * 170) * Math.sqrt(sz);
      parts.push({
        k: 'juice',
        x: c.x,
        y: c.y - c.r * c.ds * 0.5,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 85,
        g: 560,
        floor: c.y + 6 + (Math.random() - 0.5) * 20 * sz,
        r: (2.2 + Math.random() * 2.8) * Math.sqrt(sz),
        c: def.juice,
        life: 0.65,
        max: 0.65,
      });
    }
  }
  function coin(x, y, delay) {
    if (!canAdd()) return;
    if (!coinTarget) coinTarget = hudPoint();
    const tx = coinTarget[0],
      ty = coinTarget[1];
    parts.push({
      k: 'coin',
      sx: x,
      sy: y,
      cx: lerp(x, tx, 0.3) + (Math.random() - 0.5) * 140,
      cy: Math.min(y, ty) - 60 - Math.random() * 80,
      tx,
      ty,
      t: -delay * 2,
      dur: 0.55 + Math.random() * 0.2,
      life: 3,
    });
  }
  function spark(x, y) {
    if (canAdd()) parts.push({ k: 'spark', x, y, s: 2 + Math.random() * 3, life: 0.5, max: 0.5 });
  }
  function addText(t, x, y, col, size, vy, life) {
    texts.push({ t, x, y, col, size, vy, life, max: life });
  }
  function shake(a) {
    if (reduceMotion) return;
    shakeA = Math.max(shakeA, a);
    const sc = window.__PHASER_FARM_SCENE;
    if (sc && sc.cameras && sc.cameras.main) sc.cameras.main.shake(180, a * 0.0012);
  }
  function hudPoint() {
    const el = $('#dbdJar') || $('#hudEarn'),
      r = el.getBoundingClientRect(),
      cr = canvas.getBoundingClientRect();
    if (!r.width) return [80 / scale, 30 / scale];
    return [(r.left + r.width / 2 - cr.left) / scale, (r.top + r.height / 2 - cr.top) / scale];
  }
  function bumpHud() {
    const now = performance.now();
    if (now - lastBump < 120 || reduceMotion) return;
    lastBump = now;
    const el = $('#hudToday');
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
  /* the goat: peaceful white goat that only gets angry when touched! */ function spawnGoat() {
    const left = Math.random() < 0.5;
    goat = {
      x: left ? -50 : worldW + 50,
      y: FIELD_TOP + 70 + Math.random() * (HW - FIELD_TOP - 120),
      dir: left ? 1 : -1,
      speed: 56 + Math.random() * 22,
      t: 0,
      bumped: false,
      petted: false,
      angerFlash: 0,
      hop: 0,
    };
  }
  function checkGoat() {
    if (!pointer.active || !goat) return;
    const ds = depth(goat.y),
      gy = goat.y - 26 * ds;
    if (Math.hypot(goat.x - pointer.x, gy - pointer.y) > cur.R + 26 * ds) return;
    if (cur.treaty) {
      if (!goat.petted) {
        goat.petted = true;
        goat.hop = 1.0;
        const tip = 2 + 3 * farm.billsPaid;
        farm.cash += tip;
        farm.earned += tip;
        today.earned += tip;
        addText('Good goat +$' + tip, goat.x, gy - 38, '#c6f2ae', 24, -40, 1.1);
        Sound.baah(0.5);
      }
      return;
    }
    if (goat.bumped) return;
    goat.bumped = true;
    goat.angerFlash = 1.0;
    goat.hop = 1.0;
    time = Math.max(0, time - 1.5);
    goat.speed = 295;
    goat.dir = pointer.x < goat.x ? 1 : -1;
    hitStopTimer = 0.04;
    shake(12);
    addText('ANGRY BAAH! −1.5 s', goat.x, gy - 38, '#ff7a5c', 30, -45, 1.2);
    Sound.baah(1);
  }
  /* ================= update ================= */ function moveRadish(c, dt) {
    const dx = c.x - pointer.x,
      dy = c.y - pointer.y,
      d = Math.hypot(dx, dy) || 1;
    if (pointer.active && d < cur.R + 120) {
      c.vx += (dx / d) * 1100 * dt;
      c.vy += (dy / d) * 1100 * dt;
      c.panic = 1;
      c.stam = Math.max(0.35, c.stam - dt * 0.28);
    } else {
      c.panic = Math.max(0, c.panic - dt * 1.5);
      c.stam = Math.min(1, c.stam + dt * 0.2);
    }
    const k = Math.exp(-5 * dt);
    c.vx *= k;
    c.vy *= k;
    const maxV = 190 * cur.radishSlow * c.stam,
      v = Math.hypot(c.vx, c.vy);
    if (v > maxV) {
      c.vx *= maxV / v;
      c.vy *= maxV / v;
    }
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    if (c.x < PAD) {
      c.x = PAD;
      c.vx = Math.abs(c.vx) * 0.3;
    }
    if (c.x > worldW - PAD) {
      c.x = worldW - PAD;
      c.vx = -Math.abs(c.vx) * 0.3;
    }
    if (c.y < FIELD_TOP + 30) {
      c.y = FIELD_TOP + 30;
      c.vy = Math.abs(c.vy) * 0.3;
    }
    if (c.y > HW - 22) {
      c.y = HW - 22;
      c.vy = -Math.abs(c.vy) * 0.3;
    }
    c.ds = depth(c.y);
    if (v > 60 && Math.random() < dt * 14 && canAdd())
      parts.push({
        k: 'dust',
        x: c.x,
        y: c.y + 2,
        vx: -c.vx * 0.1,
        vy: -10,
        g: 0,
        s: 3 + Math.random() * 3,
        life: 0.4,
        max: 0.4,
      });
  }
  function updateCropSpringAndStages(c, dt) {
    const prevAge = c.age;
    c.age += dt;
    if (c.age <= 0) return; // Stage 1 -> Stage 2 (Budding bulb + dirt crumbs)
    if (c.stage === 1 && prevAge < STAGE2_AGE && c.age >= STAGE2_AGE) {
      c.stage = 2;
      c.stretch = -0.28;
      c.stretchVel = 5.8;
      c.wobbleVel = (Math.random() < 0.5 ? -1 : 1) * 4.0;
      debris(c, 2);
    } // Stage 2 -> Stage 3 (Full Ripeness Pop!)
    if (c.stage < 3 && prevAge < STAGE3_AGE && c.age >= STAGE3_AGE) {
      c.stage = 3;
      c.stretch = 0.36;
      c.stretchVel = 8.8;
      c.wobbleVel = (Math.random() < 0.5 ? -1 : 1) * 5.2;
      debris(c, 3);
      if (canAdd()) {
        parts.push({
          k: 'ring',
          x: c.x,
          y: c.y - c.r * c.ds * 0.5,
          r: c.r * c.ds * 1.35,
          life: 0.28,
          max: 0.28,
          c: '#fef08a',
        });
      }
    } // Hooke's Law Damped Harmonic Spring
    const fStretch = -230 * c.stretch - 13.5 * c.stretchVel;
    c.stretchVel += fStretch * dt;
    c.stretch += c.stretchVel * dt;
    const fWob = -175 * c.wobbleAngle - 11.0 * c.wobbleVel;
    c.wobbleVel += fWob * dt;
    c.wobbleAngle += c.wobbleVel * dt;
    c.sq = Math.max(0, c.sq - dt * 6);
    c.flash = Math.max(0, c.flash - dt * 7);
    c.hpShow = Math.max(0, c.hpShow - dt);
    c.eye = Math.max(0, c.eye - dt);
    c.monoclePop = Math.max(0, (c.monoclePop || 0) - dt * 1.9);
    c.capBounce = Math.max(0, (c.capBounce || 0) - dt * 2.1);
    c.crownPop = Math.max(0, (c.crownPop || 0) - dt * 2.0); // Grandma Pumpkin crochets her flat beret hat first, wears it, then crochets her striped scarf!
    if (c.type === 'pumpkin' && c.stage === 3 && c.eye <= 0) {
      if ((c.hatProgress || 0) < 1) {
        c.hatProgress = Math.min(1, (c.hatProgress || 0) + dt * 0.24);
      } else if ((c.scarfProgress || 0) < 1) {
        c.scarfProgress = Math.min(1, (c.scarfProgress || 0) + dt * 0.22);
      }
    } // Blade Wind-Wake: nearby crops lean away when the sickle sweeps past
    if (mode === 'day' && pointer.active && !reduceMotion) {
      const cy = c.y - c.r * c.ds * 0.55;
      const dx = c.x - pointer.x,
        dy = cy - pointer.y;
      const dist = Math.hypot(dx, dy);
      const wakeR = (cur ? cur.R : 48) + c.r * c.ds + 48;
      const pSpeed = Math.hypot(pointer.vx || 0, pointer.vy || 0);
      if (dist < wakeR && dist > 4 && pSpeed > 40) {
        const push = (1 - dist / wakeR) * FarmScene_clamp(pSpeed / 650, 0.1, 0.9);
        c.wobbleVel += (dx > 0 ? 1 : -1) * push * 5.2 * dt * 60;
      }
    }
  }
  function update(dt) {
    if (paused) return;
    if (hitStopTimer > 0) {
      hitStopTimer = Math.max(0, hitStopTimer - dt);
      shakeA = Math.max(0, shakeA - dt * 25);
      return;
    }
    tNow += dt;
    arthurAngerTimer = Math.max(0, arthurAngerTimer - dt); // Farmhouse chimney smoke update
    if (!reduceMotion && worldW > 420) {
      if (Math.random() < dt * 3.8 && smokePuffs.length < 28) {
        smokePuffs.push({
          x: worldW * 0.76 + 17,
          y: 149,
          vx: 7 + Math.random() * 6,
          vy: -14 - Math.random() * 6,
          r: 2.8,
          maxR: 11.5,
          life: 0,
          max: 2.3,
        });
      }
      for (let i = smokePuffs.length - 1; i >= 0; i--) {
        const sp = smokePuffs[i];
        sp.life += dt;
        if (sp.life >= sp.max) {
          smokePuffs.splice(i, 1);
          continue;
        }
        sp.x += (sp.vx + Math.sin(tNow * 2.1 + i) * 4) * dt;
        sp.y += sp.vy * dt;
      }
    }
    if (mode === 'day') {
      time -= dt;
      if (keys.size) {
        let vx = 0,
          vy = 0;
        if (keys.has('arrowleft') || keys.has('a')) vx -= 1;
        if (keys.has('arrowright') || keys.has('d')) vx += 1;
        if (keys.has('arrowup') || keys.has('w')) vy -= 1;
        if (keys.has('arrowdown') || keys.has('s')) vy += 1;
        if (vx || vy) {
          const l = Math.hypot(vx, vy);
          pointer.vx = (vx / l) * 520;
          pointer.vy = (vy / l) * 520;
          pointer.x = FarmScene_clamp(pointer.x + pointer.vx * dt, 0, worldW);
          pointer.y = FarmScene_clamp(pointer.y + pointer.vy * dt, FIELD_TOP - 20, HW);
          pointer.active = true;
        }
      }
      comboTimer = Math.max(0, comboTimer - dt);
      if (comboTimer <= 0 && combo) {
        combo = 0;
      }
      rushTimer = Math.max(0, rushTimer - dt);
      tickAcc += dt;
      const iv = 1 / cur.tick;
      while (tickAcc >= iv) {
        tickAcc -= iv;
        swing();
      }
      spawnAcc += dt; // Charge Cleave charging while holding pointer or Spacebar
      if (
        (pointer.down || keys.has(' ')) &&
        pointer.active &&
        (pointer.kind === 'mouse' || keys.has(' ') || performance.now() - (pointer.mt || 0) > 150)
      ) {
        const cRate = (cur.cleaver ? 1.5 : 1.0) * (dailyEvent && dailyEvent.chargeFast ? dailyEvent.chargeFast : 1.0);
        chargeT = Math.min(1, chargeT + dt * 1.9 * cRate);
        if (chargeT >= 1 && !chargeReady) {
          chargeReady = true;
          Sound.tick();
        }
      } else if (chargeT > 0) {
        if (chargeT >= 0.72) unleashChargeCleave();
        else {
          chargeT = Math.max(0, chargeT - dt * 3.5);
          chargeReady = false;
        }
      } // Field props & Crow pests timers
      propTimer -=
        dt * (dailyEvent && dailyEvent.propBoost ? dailyEvent.propBoost : 1) * (hasSkill('soil_bounty') ? 2.0 : 1.0);
      if (propTimer <= 0) {
        propTimer = 6.5 + Math.random() * 4;
        spawnFieldProp();
      }
      crowTimer -= dt;
      if (crowTimer <= 0 && farm.billsPaid >= 2) {
        crowTimer = 8.5 + Math.random() * 5;
        spawnCrow();
      }
      const spawnInterval =
        cur.spawn / ((rushTimer > 0 ? 1.35 : 1) * (dailyEvent && dailyEvent.spawnFast ? dailyEvent.spawnFast : 1));
      let spawned = 0;
      while (spawnAcc >= spawnInterval && spawned < 4) {
        if (crops.length >= cur.max) {
          spawnAcc = Math.min(spawnAcc, spawnInterval);
          break;
        }
        spawnCrop(0);
        if (hasSkill('soil_twin') && crops.length < cur.max && Math.random() < 0.2) spawnCrop(0.05);
        spawnAcc -= spawnInterval;
        spawned++;
      }
      if (!goat) {
        goatTimer -= dt;
        if (goatTimer <= 0 && farm.billsPaid >= 2) spawnGoat();
      }
      const sec = Math.ceil(time);
      if (time < 3.2 && sec !== lastSec && sec > 0) {
        lastSec = sec;
        Sound.tick();
      }
      if (time <= 0) {
        time = 0;
        endDay();
      }
    } else if (mode === 'dusk') {
      duskT += dt;
      if (duskT >= 1.3) {
        mode = 'idle';
        renderAll();
      }
    }
    if (goat) {
      goat.t += dt;
      goat.hop = Math.max(0, (goat.hop || 0) - dt * 2.8);
      goat.angerFlash = Math.max(0, (goat.angerFlash || 0) - dt * 2.5);
      goat.x += goat.dir * goat.speed * dt;
      if (hasSkill('gold_herd') && mode === 'day') {
        for (const c of crops) {
          if (!c.dead && c.age > 0.2 && Math.hypot(c.x - goat.x, c.y - goat.y) < 34) {
            c.hp -= cur.dmg * 12 * dt;
            if (c.hp <= 0) harvest(c);
          }
        }
        crops = crops.filter((c) => !c.dead);
      }
      if (goat.bumped && !reduceMotion && Math.random() < dt * 22 && canAdd()) {
        parts.push({
          k: 'dust',
          x: goat.x - goat.dir * 16,
          y: goat.y + 2,
          vx: -goat.dir * (30 + Math.random() * 40),
          vy: -15 - Math.random() * 20,
          g: 0,
          s: 4 + Math.random() * 3.5,
          life: 0.45,
          max: 0.45,
        });
      }
      if (goat.x < -90 || goat.x > worldW + 90) {
        goat = null;
        goatTimer = 7 + Math.random() * 7;
      }
    }
    perfumeSparkleTimer = Math.max(0, perfumeSparkleTimer - dt);
    for (const c of crops) {
      updateCropSpringAndStages(c, dt);
      if (c.type === 'kabocha' && c.stage === 3 && !reduceMotion && Math.random() < dt * 2.5 && canAdd()) {
        parts.push({
          k: 'dust',
          x: c.x + (Math.random() < 0.5 ? -14 : 14) * c.ds,
          y: c.y + 2,
          vx: (Math.random() - 0.5) * 24,
          vy: -12,
          g: 0,
          s: 3.5,
          life: 0.38,
          max: 0.38,
        });
      }
      if (c.type === 'radish' && mode === 'day') moveRadish(c, dt);
      else if (c.type === 'radish') {
        c.vx *= 0.9;
        c.vy *= 0.9;
        c.panic = Math.max(0, c.panic - dt);
      }
      if (c.type === 'potato' && c.age > STAGE3_AGE && c.eye <= 0) {
        c.zt -= dt;
        if (c.zt <= 0) {
          c.zt = 1.3 + Math.random();
          addText('z', c.x + 12 * c.ds, c.y - 54 * c.ds, '#efeaff', 16, -16, 1.6);
        }
      }
      if (c.type === 'golden' && c.age > 0 && Math.random() < dt * 3)
        spark(c.x + (Math.random() - 0.5) * 30 * c.ds, c.y - (14 + Math.random() * 30) * c.ds);
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.k === 'coin') {
        p.t += dt / p.dur;
        if (p.t >= 1) {
          p.life = 0;
          bumpHud();
          if (window.__dbdCoin) window.__dbdCoin();
        }
        continue;
      }
      if (p.k === 'leaf') {
        p.vx *= Math.pow(0.28, dt);
        p.vy += (p.g || 200) * dt;
        p.x += (p.vx + Math.sin((p.max - p.life) * 14 + p.phase) * 34) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        continue;
      }
      if (p.vx !== undefined) {
        p.vy += (p.g || 0) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.rot !== undefined) p.rot += (p.vr || 0) * dt;
        if (p.k === 'clod' && p.y > p.floor && p.vy > 0) {
          p.y = p.floor;
          p.vy *= -0.4;
          p.vx *= 0.65;
        } else if (p.k === 'juice' && p.y >= p.floor && p.vy > 0) {
          // Splat into a soil puddle!
          if (canAdd()) {
            parts.push({ k: 'puddle', x: p.x, y: p.floor, rx: p.r * 1.7, ry: p.r * 0.65, c: p.c, life: 0.9, max: 0.9 });
          }
          p.life = 0;
        }
      }
    }
    parts = parts.filter((p) => p.life > 0);
    for (const t of texts) {
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= 1 - 1.6 * dt;
    }
    texts = texts.filter((t) => t.life > 0);
    for (let i = fieldProps.length - 1; i >= 0; i--) {
      fieldProps[i].age += dt;
      fieldProps[i].life -= dt;
      if (fieldProps[i].life <= 0) fieldProps.splice(i, 1);
    }
    for (let i = crows.length - 1; i >= 0; i--) {
      const cr = crows[i];
      cr.t += dt;
      if (!cr.scared) {
        const dx = cr.tx - cr.x,
          dy = cr.ty - cr.y,
          d = Math.hypot(dx, dy) || 1;
        cr.x += (dx / d) * 115 * dt;
        cr.y += (dy / d) * 115 * dt;
        if (d < 12) {
          cr.scared = true;
          cr.vx = (Math.random() < 0.5 ? -1 : 1) * 180;
          cr.vy = -160;
        }
      } else {
        cr.x += cr.vx * dt;
        cr.y += cr.vy * dt;
        if (cr.y < -40 || cr.x < -80 || cr.x > worldW + 80) crows.splice(i, 1);
      }
    }
    for (let i = bolts.length - 1; i >= 0; i--) {
      bolts[i].life -= dt;
      if (bolts[i].life <= 0) bolts.splice(i, 1);
    } // Weather particles (Rain streaks or Blowing Autumn Leaves)
    if (!reduceMotion && worldW > 0 && dailyEvent) {
      if (dailyEvent.weather === 'rain' && weatherParts.length < 48 && Math.random() < dt * 35) {
        weatherParts.push({ w: 'rain', x: Math.random() * (worldW + 80), y: -15, vx: -75, vy: 460, life: 1.4 });
      } else if (dailyEvent.weather === 'wind' && weatherParts.length < 22 && Math.random() < dt * 10) {
        weatherParts.push({
          w: 'leaf',
          x: -15,
          y: 40 + Math.random() * (HW - 80),
          vx: 130 + Math.random() * 70,
          vy: 18 + Math.random() * 20,
          rot: Math.random() * 6.28,
          c: Math.random() < 0.5 ? '#f97316' : '#eab308',
          life: 6.0,
        });
      }
      for (let i = weatherParts.length - 1; i >= 0; i--) {
        const wp = weatherParts[i];
        wp.life -= dt;
        wp.x += wp.vx * dt;
        wp.y += wp.vy * dt;
        if (wp.w === 'leaf') wp.y += Math.sin(tNow * 4 + i) * 18 * dt;
        if (wp.life <= 0 || wp.y > HW + 20 || wp.x > worldW + 40) weatherParts.splice(i, 1);
      }
    }
    sweepT = Math.max(0, sweepT - dt);
    shakeA = Math.max(0, shakeA - dt * 40);
    dawnFade = Math.max(0, dawnFade - dt * 1.8);
  }
  /* ================= 3-stage crop & funny character renderer ================= */ function skyP() {
    if (mode === 'day') return FarmScene_clamp(1 - time / dayLen, 0, 1);
    if (mode === 'dusk') return 1 + 0.3 * smooth(0, 1, duskT / 1.3);
    return farm.played ? 1.3 : 0.08;
  }
  function getCropScales(c) {
    let base = 1.0;
    if (c.stage === 1) {
      base = 0.36 + 0.28 * easeBack(FarmScene_clamp(c.age / STAGE2_AGE, 0, 1));
    } else if (c.stage === 2) {
      base = 0.64 + 0.24 * easeBack(FarmScene_clamp((c.age - STAGE2_AGE) / (STAGE3_AGE - STAGE2_AGE), 0, 1));
    }
    const sy = FarmScene_clamp(1 + (c.stretch || 0), 0.32, 1.75);
    const sx = 1 / Math.sqrt(sy);
    return [c.ds * base * sx, c.ds * base * sy];
  }
  function drawDirtMound(c) {
    const r = c.r * c.ds;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.fillStyle = '#3e2718';
    ell(ctx, 0, 2.5, r * 0.82, r * 0.26);
    if (c.moundClumps) {
      for (const cl of c.moundClumps) {
        ctx.fillStyle = cl.shade;
        circ(ctx, cl.ox * c.ds, (cl.oy + 2) * c.ds, cl.r * c.ds);
      }
    }
    ctx.restore();
  }
  function drawStage1Sprout(c, def) {
    const s = c.r / 24;
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 3 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(2 * s, -11 * s, 0, -19 * s);
    ctx.stroke();
    ctx.fillStyle = def.leaf;
    ctx.strokeStyle = def.leafDark;
    ctx.lineWidth = 1.2 * s;
    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.translate(0, -17 * s);
      ctx.rotate(dir * 0.55);
      ell(ctx, dir * 7 * s, -2 * s, 8 * s, 4 * s, dir * 0.25);
      ctx.stroke();
      ctx.restore();
    }
  }
  function drawStage2Bud(c, def, breeze) {
    const r = c.r * 0.62;
    for (let i = -1; i <= 1; i++) {
      ctx.save();
      ctx.translate(0, -r * 1.05);
      ctx.rotate(i * 0.45 + breeze * 0.6);
      ctx.fillStyle = i === 0 ? def.leaf : def.leafDark;
      ell(ctx, 0, -r * 0.52, r * 0.25, r * 0.58);
      ctx.restore();
    }
    ctx.fillStyle = def.color;
    ctx.strokeStyle = def.shade;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, -r * 0.48, r * 0.72, Math.PI * 0.95, Math.PI * 2.05);
    ctx.closePath();
    ctx.fill();
    ctx.stroke(); // Sleepy baby eyes on Stage 2 bud
    ctx.strokeStyle = 'rgba(30, 15, 10, 0.65)';
    ctx.lineWidth = 1.4;
    for (const ex of [-r * 0.24, r * 0.24]) {
      ctx.beginPath();
      ctx.arc(ex, -r * 0.6, r * 0.12, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }
  function drawStage3RipeCharacter(c, def, breeze) {
    const r = c.r;
    const type = c.type;
    const leafLag = breeze * 0.85;
    const shocked = c.eye > 0;
    const distToCursor = pointer.active ? Math.hypot(pointer.x - c.x, pointer.y - (c.y - r * c.ds * 0.6)) : 9999;
    const cursorNear = mode === 'day' && distToCursor < (cur ? cur.R : 48) + r * c.ds + 45;
    const ang = Math.atan2(pointer.y - (c.y - r * c.ds * 0.6), pointer.x - c.x);
    const px = pointer.active ? Math.cos(ang) * 1.9 : 0;
    const py = pointer.active ? Math.sin(ang) * 1.6 : 0;
    if (
      window.DBD_CROP_RENDERER &&
      window.DBD_CROP_RENDERER.drawRegionalCrop(ctx, c, def, breeze, tNow, shocked, cursorNear, px, py, gpLeaf)
    ) {
      return;
    }
    /* ------------------------------------------------------------------------
     1. RUNAWAY RADISH (r: 16 — Tiny, Caffeinated, Googly-Eyed Runner)
     ------------------------------------------------------------------------ */ if (type === 'radish') {
      const fast = Math.hypot(c.vx, c.vy) > 25 || cursorNear || shocked;
      if (fast) {
        const kick = reduceMotion ? 0 : Math.sin(tNow * 30) * 4;
        ctx.strokeStyle = '#9f1239';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-4, -1);
        ctx.lineTo(-5.5 + kick, 7);
        ctx.moveTo(4, -1);
        ctx.lineTo(5.5 - kick, 7);
        ctx.stroke();
      }
      for (let i = -1; i <= 1; i++) {
        ctx.save();
        ctx.translate(0, -r * 1.45);
        ctx.rotate(i * 0.48 + leafLag);
        ctx.fillStyle = i === 0 ? def.leaf : def.leafDark;
        ell(ctx, 0, -8.5, 4.5, 10);
        ctx.restore();
      }
      ctx.fillStyle = radial(ctx, -4, -r * 0.95, 1.5, 0, -r * 0.75, r, def.light, def.color);
      ctx.strokeStyle = def.shade;
      ctx.lineWidth = 1.6;
      circ(ctx, 0, -r * 0.8, r * 0.82);
      ctx.stroke(); // Asymmetrical googly eyes
      ctx.fillStyle = '#fff';
      circ(ctx, -4.4, -r * 0.9, 4.1);
      circ(ctx, 4.4, -r * 0.9, 3.3);
      ctx.fillStyle = '#111827';
      circ(ctx, -4.4 + px * 0.7, -r * 0.9 + py * 0.7, 1.6);
      circ(ctx, 4.4 + px * 0.7, -r * 0.9 + py * 0.7, 1.3);
      if (c.panic > 0.2 || shocked || cursorNear) {
        ctx.fillStyle = '#4c0519';
        ell(ctx, 0, -r * 0.45, 3.8, 3.0);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-2.5, -r * 0.45 - 2.6, 5, 1.5);
        ctx.fillRect(-2.5, -r * 0.45 + 1.1, 5, 1.5); // Sweat drop
        ctx.fillStyle = '#7dd3fc';
        ctx.beginPath();
        ctx.moveTo(11, -r * 1.3);
        ctx.quadraticCurveTo(14, -r * 1.05, 11, -r * 1.0);
        ctx.quadraticCurveTo(8, -r * 1.05, 11, -r * 1.3);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#4c0519';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(0, -r * 0.5, 2.4, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
    } /* ------------------------------------------------------------------------
     2. GYM-BRO CARROT (r: 19 — 80s Sweatband, Puffed Chest, Wince on Hit)
     ------------------------------------------------------------------------ */ else if (type === 'carrot') {
      for (let i = -2; i <= 2; i++) {
        ctx.save();
        ctx.translate(i * 1.8, -r * 1.38);
        ctx.rotate(i * 0.27 + leafLag);
        ctx.fillStyle = i % 2 === 0 ? def.leaf : def.leafDark;
        ell(ctx, 0, -12, 4, 13);
        ctx.restore();
      }
      ctx.fillStyle = radial(ctx, -4, -r, 2, 0, -r * 0.7, r * 1.2, def.light, def.color);
      ctx.strokeStyle = def.shade;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, -r * 1.15);
      ctx.bezierCurveTo(-r * 0.74, -r * 1.5, r * 0.74, -r * 1.5, r * 0.7, -r * 1.15);
      ctx.quadraticCurveTo(r * 0.5, -r * 0.28, r * 0.2, 2);
      ctx.lineTo(-r * 0.2, 2);
      ctx.quadraticCurveTo(-r * 0.5, -r * 0.28, -r * 0.7, -r * 1.15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // Red & White Gym Sweatband
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-r * 0.69, -r * 1.28, r * 1.38, 5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-r * 0.69, -r * 1.28 + 1.6, r * 1.38, 1.7);
      if (shocked) {
        ctx.strokeStyle = '#431407';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-7, -r * 1.0);
        ctx.lineTo(-2.5, -r * 0.88);
        ctx.lineTo(-7, -r * 0.76);
        ctx.moveTo(7, -r * 1.0);
        ctx.lineTo(2.5, -r * 0.88);
        ctx.lineTo(7, -r * 0.76);
        ctx.stroke();
      } else {
        for (const ex of [-4.8, 4.8]) {
          ctx.fillStyle = '#fff';
          circ(ctx, ex, -r * 0.88, 3.2);
          ctx.fillStyle = '#292524';
          circ(ctx, ex + px * 0.55, -r * 0.88 + py * 0.55, 1.6);
        }
        ctx.strokeStyle = '#431407';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-8, -r * 1.03);
        ctx.lineTo(-2, -r * 0.98);
        ctx.moveTo(8, -r * 1.03);
        ctx.lineTo(2, -r * 0.98);
        ctx.stroke();
        ctx.beginPath();
        if (cursorNear) {
          ctx.arc(0, -r * 0.55, 2.2, 0, Math.PI * 2);
        } else {
          ctx.arc(0, -r * 0.6, 3.8, 0.1 * Math.PI, 0.85 * Math.PI);
        }
        ctx.stroke();
      }
    } /* ------------------------------------------------------------------------
     3. VIP GOLDEN CORN (r: 22 — Aviator Shades & Magnificent Flowing Corn-Silk Beard!)
     ------------------------------------------------------------------------ */ else if (type === 'golden') {
      ctx.fillStyle = radial(ctx, 0, -r, 2, 0, -r, r * 1.65, 'rgba(254,240,138,.45)', 'rgba(254,240,138,0)');
      circ(ctx, 0, -r, r * 1.65); // Outer peeled-back green husk cape cradling the base of the cob
      for (const dir of [-1, 1]) {
        ctx.save();
        ctx.translate(dir * 6, -4);
        ctx.rotate(dir * 0.52 + leafLag * 0.6);
        ctx.fillStyle = '#15803d';
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.quadraticCurveTo(dir * 10, -r * 0.55, dir * 14, -r * 1.05);
        ctx.quadraticCurveTo(dir * 2, -r * 0.75, -dir * 3, 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      const cobW = r * 0.62,
        cobH = r * 1.15;
      ctx.fillStyle = radial(ctx, -4, -r * 1.25, 2, 0, -r, cobH, '#fef9c3', '#eab308');
      ctx.strokeStyle = def.shade;
      ctx.lineWidth = 1.8;
      ell(ctx, 0, -r * 1.04, cobW, cobH);
      ctx.stroke(); // Plump golden kernel rows
      ctx.fillStyle = 'rgba(161, 98, 7, 0.28)';
      for (let row = -3; row <= 2; row++) {
        for (let col = -1; col <= 1; col++) {
          circ(ctx, col * 5.0 + (row % 2 ? 1.8 : 0), -r * 1.12 + row * 4.8, 1.7);
        }
      } // Silky top hair tuft
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      for (let s = -1; s <= 1; s++) {
        ctx.beginPath();
        ctx.moveTo(s * 3, -r * 2.15);
        ctx.quadraticCurveTo(s * 8 + breeze * 18, -r * 2.45, s * 11 + breeze * 25, -r * 2.25);
        ctx.stroke();
      }
      const shadeDrop = shocked ? 6.5 : cursorNear ? 3.2 : 0;
      const shadeTilt = shocked ? 0.28 : cursorNear ? -0.1 : 0;
      if (shadeDrop > 0) {
        for (const ex of [-4.8, 4.8]) {
          ctx.fillStyle = '#fff';
          circ(ctx, ex, -r * 1.28, 3.3);
          ctx.fillStyle = '#111';
          circ(ctx, ex + px * 0.5, -r * 1.28 + py * 0.5, 1.5);
        }
      } // Aviator Sunglasses
      ctx.save();
      ctx.translate(0, -r * 1.22 + shadeDrop);
      ctx.rotate(shadeTilt);
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-11, -2);
      ctx.lineTo(11, -2);
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.3;
      for (const lx of [-5.5, 5.5]) {
        ctx.beginPath();
        ctx.roundRect(lx - 4.8, -3, 9.6, 6.6, [1, 1, 3.8, 3.8]);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.moveTo(lx - 2.2, -1.3);
        ctx.lineTo(lx + 1.4, 2.0);
        ctx.stroke();
        ctx.strokeStyle = '#eab308';
      }
      ctx.restore(); // MAGNIFICENT FLOWING CORN-SILK BEARD & MUSTACHE!
      const beardFlip = shocked ? -0.35 : breeze * 1.4;
      ctx.save();
      ctx.translate(0, -r * 0.82);
      ctx.rotate(beardFlip); // Flowing golden-cream corn-silk beard
      const bGrad = ctx.createLinearGradient(0, 0, 0, r * 0.95);
      bGrad.addColorStop(0, '#fffbeb');
      bGrad.addColorStop(0.6, '#fef08a');
      bGrad.addColorStop(1, '#ca8a04');
      ctx.fillStyle = bGrad;
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-11, 0);
      ctx.bezierCurveTo(-14, r * 0.45, -7, r * 0.85, 0, r * 1.02);
      ctx.bezierCurveTo(7, r * 0.85, 14, r * 0.45, 11, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // Wavy beard silk strands
      ctx.strokeStyle = 'rgba(161, 98, 7, 0.35)';
      ctx.lineWidth = 1.1;
      for (const bx of [-5, 0, 5]) {
        ctx.beginPath();
        ctx.moveTo(bx, 3);
        ctx.quadraticCurveTo(bx + 2, r * 0.45, bx * 0.4, r * 0.82);
        ctx.stroke();
      } // Golden Viking beard clasp bead near the bottom
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#78350f';
      ctx.beginPath();
      ctx.roundRect(-3.5, r * 0.68, 7, 3.5, 1.5);
      ctx.fill();
      ctx.stroke(); // Sweeping handlebar corn-silk mustache on top of the beard!
      ctx.fillStyle = '#fffbeb';
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth = 1.3;
      ell(ctx, -6.5, 0, 7.5, 3.2, -0.25);
      ctx.stroke();
      ell(ctx, 6.5, 0, 7.5, 3.2, 0.25);
      ctx.stroke();
      if (shocked) {
        ctx.fillStyle = '#451a03';
        circ(ctx, 0, 3.5, 3.2);
      }
      ctx.restore();
    } /* ------------------------------------------------------------------------
     4. LORD CABBAGE (r: 28 — Aristocrat, Leaf Mustache & Popping Monocle)
     ------------------------------------------------------------------------ */ else if (type === 'cabbage') {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.fillStyle = i % 2 === 0 ? '#22c55e' : '#15803d';
        ell(ctx, Math.cos(a) * r * 0.55, -r * 0.45 + Math.sin(a) * r * 0.24, r * 0.46, r * 0.32, a * 0.3);
      }
      ctx.fillStyle = radial(ctx, -7, -r * 0.92, 3, 0, -r * 0.66, r, '#ecfccb', '#4ade80');
      ctx.strokeStyle = def.shade;
      ctx.lineWidth = 2;
      ell(ctx, 0, -r * 0.66, r * 0.85, r * 0.76);
      ctx.stroke();
      ctx.fillStyle = 'rgba(244, 63, 94, 0.26)';
      ell(ctx, -11, -r * 0.54, 4.2, 2.4);
      ell(ctx, 11, -r * 0.54, 4.2, 2.4);
      for (const ex of [-7.5, 7.5]) {
        ctx.fillStyle = '#fff';
        circ(ctx, ex, -r * 0.7, 3.9);
        ctx.fillStyle = '#14532d';
        circ(ctx, ex + px * 0.65, -r * 0.7 + py * 0.65, 1.9);
      }
      const browLift = shocked || cursorNear ? -3 : 0;
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-13, -r * 0.88 + browLift);
      ctx.quadraticCurveTo(-5, -r * 0.78 + browLift, 0, -r * 0.82 + browLift);
      ctx.quadraticCurveTo(5, -r * 0.78 + browLift, 13, -r * 0.88 + browLift);
      ctx.stroke(); // Leaf handlebar mustache
      ctx.fillStyle = '#15803d';
      ell(ctx, -5, -r * 0.45, 6, 2.6, -0.24);
      ell(ctx, 5, -r * 0.45, 6, 2.6, 0.24);
      if (shocked || cursorNear) {
        ctx.fillStyle = '#052e16';
        circ(ctx, 0, -r * 0.33, 3.3);
      } // Gold Monocle on chain
      const popOff = c.monoclePop > 0 ? Math.sin(c.monoclePop * Math.PI) * 14 : cursorNear ? 3.5 : 0;
      const mx = 7.5 + popOff * 0.5,
        my = -r * 0.7 - popOff;
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(13, -r * 0.34);
      ctx.quadraticCurveTo(17, -r * 0.48, mx + 5, my);
      ctx.stroke();
      ctx.fillStyle = 'rgba(254, 249, 195, 0.35)';
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.8;
      circ(ctx, mx, my, 5.4);
      ctx.stroke();
    } /* ------------------------------------------------------------------------
     5. COUCH POTATO (r: 36 — Cozy Beanbag Shape, Nightcap ON TOP, Snot Bubble)
     ------------------------------------------------------------------------ */ else if (type === 'potato') {
      // Symmetric-top, chubby-bottom cozy beanbag potato silhouette!
      ctx.fillStyle = radial(ctx, -10, -r * 0.88, 3, 0, -r * 0.55, r * 1.15, def.light, '#a86b32');
      ctx.strokeStyle = def.shade;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.16); // Top crown of head
      ctx.bezierCurveTo(r * 0.65, -r * 1.16, r * 1.02, -r * 0.68, r * 0.96, -r * 0.25);
      ctx.bezierCurveTo(r * 0.9, r * 0.08, -r * 0.9, r * 0.08, -r * 0.96, -r * 0.25);
      ctx.bezierCurveTo(-r * 1.02, -r * 0.68, -r * 0.65, -r * 1.16, 0, -r * 1.16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // Subtle potato freckles
      ctx.fillStyle = 'rgba(110, 66, 25, 0.26)';
      [
        [-18, -12, 2.2],
        [19, -14, 2.0],
        [-14, -28, 1.6],
        [15, -30, 1.8],
      ].forEach(([dx, dy, dr]) => circ(ctx, dx, dy, dr)); // Face: Asleep with snot bubble OR Woken up in rage!
      if (shocked) {
        for (const ex of [-9.5, 9.5]) {
          ctx.fillStyle = '#fff';
          circ(ctx, ex, -r * 0.64, 4.8);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = '#1c1917';
          circ(ctx, ex + px * 0.6, -r * 0.64 + py * 0.6, 2.1);
        }
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(-15, -r * 0.8);
        ctx.lineTo(-4, -r * 0.72);
        ctx.moveTo(15, -r * 0.8);
        ctx.lineTo(4, -r * 0.72);
        ctx.stroke();
        ctx.fillStyle = '#451a03';
        ell(ctx, 0, -r * 0.36, 5, 3.6);
      } else {
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        for (const ex of [-9.5, 9.5]) {
          ctx.beginPath();
          ctx.arc(ex, -r * 0.64, 4.0, 0.15 * Math.PI, 0.85 * Math.PI);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(239, 68, 68, 0.24)';
        ell(ctx, -16, -r * 0.5, 4.5, 2.5);
        ell(ctx, 16, -r * 0.5, 4.5, 2.5);
        ctx.fillStyle = '#451a03';
        circ(ctx, 0, -r * 0.4, 2.5); // Expanding & contracting Sleep Snot Bubble
        const bubbleR = 5.0 + (reduceMotion ? 0 : Math.sin(tNow * 3.2 + c.wob) * 2.8);
        ctx.fillStyle = 'rgba(186, 230, 253, 0.55)';
        ctx.strokeStyle = 'rgba(224, 242, 254, 0.9)';
        ctx.lineWidth = 1.3;
        circ(ctx, 5 + bubbleR * 0.55, -r * 0.46 - bubbleR * 0.25, bubbleR);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        circ(ctx, 5 + bubbleR * 0.25, -r * 0.46 - bubbleR * 0.55, bubbleR * 0.25);
      } // Striped Nightcap sitting RIGHT ON TOP OF ITS HEAD!
      const capLift = c.capBounce > 0 ? Math.sin(c.capBounce * Math.PI) * 16 : 0;
      ctx.save();
      ctx.translate(0, -capLift); // Nightcap cone perched on the top crown (-r * 1.12) and drooping to the right
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-r * 0.58, -r * 1.05);
      ctx.quadraticCurveTo(-r * 0.15, -r * 1.68, r * 0.72, -r * 1.22); // Floppy tip to the side
      ctx.quadraticCurveTo(r * 0.42, -r * 1.1, r * 0.58, -r * 1.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // Decorative cream stripe on cap
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.12, -r * 1.35);
      ctx.lineTo(r * 0.22, -r * 1.12);
      ctx.stroke(); // Fluffy cream headband brim right across the top forehead
      ctx.fillStyle = '#fffbeb';
      ctx.strokeStyle = '#d6c7b2';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(-r * 0.62, -r * 1.14, r * 1.24, 8.5, 4.5);
      ctx.fill();
      ctx.stroke(); // Fluffy white pom-pom at the drooping tip
      ctx.fillStyle = '#fffbeb';
      circ(ctx, r * 0.74, -r * 1.21, 5.5);
      ctx.stroke();
      ctx.restore();
    } /* ------------------------------------------------------------------------
     6. DRAMA-QUEEN ONION (r: 24 — Posh Opera Diva When Peaceful, Bawls Fountains ONLY When Smacked!)
     ------------------------------------------------------------------------ */ else if (type === 'onion') {
      for (let i = -1; i <= 1; i++) {
        ctx.save();
        ctx.translate(i * 2.5, -r * 1.25);
        ctx.rotate(i * 0.25 + leafLag + (shocked ? Math.sin(tNow * 35) * 0.25 : 0));
        ctx.fillStyle = i === 0 ? '#4ade80' : '#16a34a';
        ell(ctx, 0, -9, 3.2, 10);
        ctx.restore();
      }
      ctx.fillStyle = radial(ctx, -6, -r * 0.85, 2, 0, -r * 0.58, r * 1.05, '#f3e8ff', '#9333ea');
      ctx.strokeStyle = '#581c87';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.32);
      ctx.bezierCurveTo(r * 0.45, -r * 1.05, r * 0.95, -r * 0.82, r * 0.92, -r * 0.35);
      ctx.bezierCurveTo(r * 0.88, r * 0.05, -r * 0.88, r * 0.05, -r * 0.92, -r * 0.35);
      ctx.bezierCurveTo(-r * 0.95, -r * 0.82, -r * 0.45, -r * 1.05, 0, -r * 1.32);
      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // Theatrical ribbon bow (pops up when smacked!)
      const bowLift = shocked ? Math.sin(c.eye * Math.PI) * 9 : 0;
      ctx.save();
      ctx.translate(0, -bowLift);
      ctx.fillStyle = '#f43f5e';
      ell(ctx, -6, -r * 1.15, 5.5, 3.2, -0.3);
      ell(ctx, 6, -r * 1.15, 5.5, 3.2, 0.3);
      ctx.fillStyle = '#fda4af';
      circ(ctx, 0, -r * 1.15, 2.5);
      ctx.restore();
      if (shocked) {
        // SMACKED STATE: Scrunched '> <' bawling eyes + gushing fountain of blue tears + wide wailing mouth!
        ctx.strokeStyle = '#3b0764';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-9.5, -r * 0.7);
        ctx.lineTo(-4.2, -r * 0.62);
        ctx.lineTo(-9.5, -r * 0.54);
        ctx.moveTo(9.5, -r * 0.7);
        ctx.lineTo(4.2, -r * 0.62);
        ctx.lineTo(9.5, -r * 0.54);
        ctx.stroke(); // Twin fountains of cartoon tears spraying sideways and down!
        const tearPhase = (tNow * 24) % 1;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.88)';
        for (const dir of [-1, 1]) {
          ell(ctx, dir * 6.5, -r * 0.45, 2.4, 5.5, dir * 0.15);
          circ(ctx, dir * (9 + tearPhase * 8), -r * 0.62 + tearPhase * 10, 2.4);
          circ(ctx, dir * (7 + tearPhase * 5), -r * 0.3 + tearPhase * 8, 2.0);
        } // Huge wailing mouth with tongue
        ctx.fillStyle = '#3b0764';
        ell(ctx, 0, -r * 0.3, 5.6, 4.8);
        ctx.fillStyle = '#fb7185';
        ell(ctx, 0, -r * 0.22, 3.6, 2.0);
      } else if (cursorNear) {
        // CURSOR NEAR: Dramatic gasp!
        for (const ex of [-6.2, 6.2]) {
          ctx.fillStyle = '#fff';
          circ(ctx, ex, -r * 0.62, 4.0);
          ctx.fillStyle = '#1e1b4b';
          circ(ctx, ex + px * 0.5, -r * 0.62 + py * 0.5, 1.6);
        }
        ctx.fillStyle = '#3b0764';
        circ(ctx, 0, -r * 0.33, 3.0);
      } else {
        // PEACEFUL IDLE: Posh snooty opera diva with closed lashed eyes & rosy cheeks (NO tears!)
        ctx.strokeStyle = '#3b0764';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        for (const ex of [-6.2, 6.2]) {
          ctx.beginPath();
          ctx.arc(ex, -r * 0.62, 3.6, 0.15 * Math.PI, 0.85 * Math.PI);
          ctx.stroke(); // Posh eyelashes
          ctx.beginPath();
          ctx.moveTo(ex + (ex < 0 ? -3.5 : 3.5), -r * 0.6);
          ctx.lineTo(ex + (ex < 0 ? -5.5 : 5.5), -r * 0.66);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(244, 63, 94, 0.28)';
        ell(ctx, -10.5, -r * 0.48, 3.5, 2.0);
        ell(ctx, 10.5, -r * 0.48, 3.5, 2.0); // Cute smug smile
        ctx.beginPath();
        ctx.arc(0, -r * 0.38, 3.0, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
    } /* ------------------------------------------------------------------------
     7. BRIAR-BERRY TWINS (r: 25 — Cheeky When Peaceful, Bonk Heads & Scream When Smacked!)
     ------------------------------------------------------------------------ */ else if (type === 'berry') {
      const bonk = shocked ? Math.sin(tNow * 40) * 2.5 : 0;
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-9, -r * 0.65);
      ctx.quadraticCurveTo(0, -r * 1.45 - (shocked ? 6 : 0), 9, -r * 0.65);
      ctx.stroke();
      gpLeaf(ctx, 0, -r * 1.25 - (shocked ? 4 : 0), 0.4 + leafLag + (shocked ? 0.5 : 0), 0.85);
      for (const [baseBx, baseBy, cheeky] of [
        [-8.5, -r * 0.52, false],
        [8.5, -r * 0.48, true],
      ]) {
        const bob = reduceMotion ? 0 : Math.sin(tNow * 5.5 + (cheeky ? 2.2 : 0)) * 1.4;
        const bx = baseBx + (shocked ? (cheeky ? -2.2 : 2.2) + bonk : 0);
        const by = baseBy + (shocked ? -2 : bob);
        ctx.fillStyle = radial(ctx, bx - 3, by - 4, 1, bx, by, 12.5, shocked ? '#fca5a5' : '#c7d2fe', '#4338ca');
        ctx.strokeStyle = '#1e1b4b';
        ctx.lineWidth = 1.6;
        circ(ctx, bx, by, 11.2);
        ctx.stroke();
        if (shocked) {
          // SMACKED STATE: Dizzy '><' X-eyes & screaming mouths!
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 1.8;
          for (const ex of [-3.5, 3.5]) {
            ctx.beginPath();
            ctx.moveTo(bx + ex - 1.8, by - 3.8);
            ctx.lineTo(bx + ex + 1.8, by - 0.2);
            ctx.moveTo(bx + ex + 1.8, by - 3.8);
            ctx.lineTo(bx + ex - 1.8, by - 0.2);
            ctx.stroke();
          }
          ctx.fillStyle = '#0f172a';
          ell(ctx, bx, by + 3.5, 3.6, 3.0);
          ctx.fillStyle = '#fb7185';
          ell(ctx, bx, by + 4.5, 2.2, 1.2);
        } else if (cursorNear) {
          // CURSOR NEAR: Wide nervous eyes + trembling mouth
          for (const ex of [-3.4, 3.4]) {
            ctx.fillStyle = '#fff';
            circ(ctx, bx + ex, by - 2, 2.9);
            ctx.fillStyle = '#0f172a';
            circ(ctx, bx + ex + px * 0.4, by - 2 + py * 0.4, 1.1);
          }
          ctx.strokeStyle = '#e0e7ff';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.arc(bx, by + 4.2, 2.2, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        } else {
          // PEACEFUL IDLE: Happy / winking twin berries!
          for (const ex of [-3.4, 3.4]) {
            if (cheeky && ex > 0) {
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(bx + ex - 2, by - 2);
              ctx.lineTo(bx + ex + 2, by - 2);
              ctx.stroke();
            } else {
              ctx.fillStyle = '#fff';
              circ(ctx, bx + ex, by - 2, 2.5);
              ctx.fillStyle = '#0f172a';
              circ(ctx, bx + ex + px * 0.4, by - 2 + py * 0.4, 1.2);
            }
          }
          if (cheeky) {
            ctx.fillStyle = '#fb7185';
            ell(ctx, bx + 1, by + 3.8, 2.6, 2.0, 0.2);
          } else {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.arc(bx, by + 2, 2.8, 0.1 * Math.PI, 0.9 * Math.PI);
            ctx.stroke();
          }
        }
      }
      if (shocked) {
        // Cartoon impact star between their bonking heads!
        ctx.fillStyle = '#fde047';
        circ(ctx, 0, -r * 0.72, 3.5);
      }
    } /* ------------------------------------------------------------------------
     8. GRANDMA PUMPKIN (r: 44 — Crochets a Flat Beret Hat, Wears It, Then Crochets a Cozy Striped Scarf!)
     ------------------------------------------------------------------------ */ else if (type === 'pumpkin') {
      drawGrandmaPumpkin(ctx, {
        time: tNow + c.wob,
        action: shocked ? FarmScene_clamp(1 - c.eye / 0.85, 0.05, 0.95) : -1,
        hatProgress: c.hatProgress || 0,
        scarfProgress: c.scarfProgress || 0,
        lookX: px,
        radius: r,
      });
    }
  }
  /* Grandma Pumpkin helpers: Flat Pancake Beret Hat & Cozy Striped Scarf */ const TAU = Math.PI * 2;
  function gpLine(g, cmds, col, w = 1) {
    g.beginPath();
    for (const p of cmds) {
      if (p[0] === 'M') g.moveTo(p[1], p[2]);
      else if (p[0] === 'L') g.lineTo(p[1], p[2]);
      else if (p[0] === 'Q') g.quadraticCurveTo(p[1], p[2], p[3], p[4]);
      else g.bezierCurveTo(p[1], p[2], p[3], p[4], p[5], p[6]);
    }
    g.strokeStyle = col;
    g.lineWidth = w;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.stroke();
  }
  function gpOval(g, x, y, rx, ry, col, ang = 0) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, ang, 0, TAU);
    g.fillStyle = col;
    g.fill();
  }
  function gpLeaf(g, x, y, ang, sz = 1) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.scale(sz, sz);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(-7, -6, -1, -13);
    g.quadraticCurveTo(9, -9, 0, 0);
    g.fillStyle = '#65c45a';
    g.fill();
    g.strokeStyle = '#397b35';
    g.lineWidth = 1.1;
    g.stroke();
    gpLine(
      g,
      [
        ['M', 0, -1],
        ['Q', 1, -6, -1, -10],
      ],
      '#b8e78e',
      0.85,
    );
    g.restore();
  }
  function gpHook(g, gx, gy, tx, ty) {
    const ang = Math.atan2(ty - gy, tx - gx),
      len = Math.hypot(tx - gx, ty - gy);
    g.save();
    g.translate(gx, gy);
    g.rotate(ang);
    gpLine(
      g,
      [
        ['M', -3.5, 0],
        ['L', len - 1, 0],
      ],
      '#7b4b29',
      3.4,
    );
    gpLine(
      g,
      [
        ['M', -3, -0.4],
        ['L', 6, -0.4],
      ],
      '#e9ad64',
      2.3,
    );
    gpLine(
      g,
      [
        ['M', 6, -0.3],
        ['L', len, -0.3],
        ['Q', len + 3.5, -0.3, len + 3, 2.6],
        ['Q', len + 2.4, 4.2, len + 0.7, 3],
      ],
      '#ffe5a2',
      1.9,
    );
    g.restore();
  }
  function flatBeret(g, x, bottom, w, h, prog, onHead, t) {
    const half = w / 2,
      top = bottom - h;
    g.save();
    const col = g.createLinearGradient(x, top, x, bottom);
    col.addColorStop(0, '#a7ece0');
    col.addColorStop(0.65, '#5ec2b7');
    col.addColorStop(1, '#358c86');
    g.beginPath();
    g.moveTo(x - half * 0.92, bottom);
    g.bezierCurveTo(x - half * 1.18, bottom - h * 0.12, x - half * 1.12, top + h * 0.08, x - half * 0.52, top);
    g.quadraticCurveTo(x, top - 1.2, x + half * 0.54, top + 0.4);
    g.bezierCurveTo(x + half * 1.14, top + h * 0.12, x + half * 1.2, bottom + 1.2, x + half * 0.9, bottom + 0.4);
    g.quadraticCurveTo(x, bottom - 2.2, x - half * 0.92, bottom);
    g.closePath();
    g.fillStyle = col;
    g.fill();
    g.strokeStyle = '#286c68';
    g.lineWidth = 1.25;
    g.stroke();
    const rows = Math.max(1, Math.floor(1 + prog * 3));
    for (let r = 0; r < rows; r++) {
      const py = bottom - 2.6 - r * 2.5;
      if (py < top + 1.2) continue;
      const reach = half * (0.88 - r * 0.11);
      for (let px = x - reach + 2; px < x + reach - 2; px += 4.5)
        gpLine(
          g,
          [
            ['M', px - 1.4, py - 0.5],
            ['L', px, py + 0.7],
            ['L', px + 1.4, py - 0.5],
          ],
          '#d2f7ef',
          0.85,
        );
    }
    if (onHead) {
      const cw = half * 0.88;
      g.beginPath();
      g.moveTo(x - cw, bottom - 3.0);
      g.quadraticCurveTo(x, bottom - 4.8, x + cw, bottom - 2.6);
      g.lineTo(x + cw, bottom + 1.2);
      g.quadraticCurveTo(x, bottom - 0.8, x - cw, bottom + 0.8);
      g.closePath();
      g.fillStyle = '#c4a7e7';
      g.fill();
      g.strokeStyle = '#7c5d9e';
      g.lineWidth = 1.1;
      g.stroke();
      for (let px = x - cw + 3; px < x + cw - 2; px += 3.8)
        gpLine(
          g,
          [
            ['M', px, bottom - 3.0],
            ['L', px, bottom + 0.4],
          ],
          '#efe3fc',
          0.85,
        );
      gpOval(g, 9, bottom - 4.6, 5.5, 2.0, '#286c68', -0.1);
      const pomX = x - half * 0.55,
        pomY = top - 1.2 + Math.sin(t * 4.5) * 0.6;
      gpOval(g, pomX, pomY, 5.2, 3.8, '#d8b4fe', -0.2);
      gpOval(g, pomX - 1.5, pomY - 1.0, 1.8, 1.0, '#faf5ff');
    }
    g.restore();
  }
  function grandmaScarf(g, prog, onNeck, t, wob) {
    g.save();
    if (!onNeck) {
      const w = 10 + prog * 36,
        h = 4.5 + prog * 5.5,
        left = -1 - w / 2,
        top = -9 - h;
      g.beginPath();
      g.roundRect(left, top, w, h, 3);
      g.fillStyle = '#f43f5e';
      g.fill();
      g.strokeStyle = '#9f1239';
      g.lineWidth = 1.2;
      g.stroke();
      const stripes = Math.floor(prog * 6);
      for (let i = 0; i < stripes; i++) {
        const sx = left + 5 + i * 6.2;
        if (sx + 2.5 < left + w - 2) {
          g.fillStyle = i % 2 === 0 ? '#fef08a' : '#fda4af';
          g.fillRect(sx, top + 1, 2.5, h - 2);
        }
      }
    } else {
      const sway = Math.sin(t * 3.2) * 2.2 + wob * 4;
      g.beginPath();
      g.moveTo(-40, -17);
      g.quadraticCurveTo(0, -8, 40, -17);
      g.quadraticCurveTo(43, -10, 38, -5);
      g.quadraticCurveTo(0, 4, -38, -5);
      g.quadraticCurveTo(-43, -10, -40, -17);
      g.closePath();
      g.fillStyle = '#e11d48';
      g.fill();
      g.strokeStyle = '#881337';
      g.lineWidth = 1.4;
      g.stroke();
      for (let sx = -30; sx <= 30; sx += 10)
        gpLine(
          g,
          [
            ['M', sx, -14],
            ['L', sx, -3],
          ],
          '#fef08a',
          2.2,
        );
      for (const [idx, ox, len] of [
        [0, 16, 22],
        [1, 25, 18],
      ]) {
        g.save();
        g.translate(ox, -6);
        g.rotate((idx === 0 ? 0.12 : -0.08) + sway * 0.04);
        g.beginPath();
        g.roundRect(-5.5, 0, 11, len, 3);
        g.fillStyle = idx === 0 ? '#f43f5e' : '#e11d48';
        g.fill();
        g.strokeStyle = '#881337';
        g.lineWidth = 1.3;
        g.stroke();
        g.fillStyle = '#fef08a';
        g.fillRect(-4.8, len - 6.5, 9.6, 3);
        for (let tx = -4; tx <= 4; tx += 2.6)
          gpLine(
            g,
            [
              ['M', tx, len],
              ['L', tx + sway * 0.25, len + 4.5],
            ],
            '#fef08a',
            1.2,
          );
        g.restore();
      }
    }
    g.restore();
  }
  function drawGrandmaPumpkin(g, s = {}) {
    const t = s.time || 0,
      action = s.action ?? -1;
    const hatP = FarmScene_clamp(s.hatProgress || 0, 0, 1),
      scarfP = FarmScene_clamp(s.scarfProgress || 0, 0, 1);
    const hatDone = hatP >= 1,
      scarfDone = scarfP >= 1,
      allDone = hatDone && scarfDone;
    const hit = action >= 0 && action < 1,
      startled = hit && action < 0.58;
    const wob = hit ? Math.sin(action * 20) * Math.exp(-action * 5) : 0;
    const stitch = allDone || hit ? 0 : Math.sin(t * TAU * 2.8);
    const breathe = hit ? 0 : Math.sin(t * 2) * 0.45;
    const glassesLift = hit ? Math.sin(Math.min(1, action / 0.6) * Math.PI) * 5.5 : 0;
    const hatBounce = hit ? Math.sin(Math.min(1, action / 0.55) * Math.PI) * 12 : 0;
    g.save();
    const sc = (s.radius || 44) / 48;
    g.scale(sc, sc);
    const paint = g.createRadialGradient(-17, -51, 2, 0, -29, 60);
    paint.addColorStop(0, '#fdc07e');
    paint.addColorStop(0.64, '#f98428');
    paint.addColorStop(1, '#df641b');
    g.beginPath();
    g.moveTo(0, -65);
    g.bezierCurveTo(-10, -70, -20, -68, -28, -61);
    g.bezierCurveTo(-42, -61, -50, -48, -50, -33);
    g.bezierCurveTo(-51, -18, -41, -5, -29, -3);
    g.quadraticCurveTo(-14, 2, 0, 0);
    g.quadraticCurveTo(15, 3, 29, -3);
    g.bezierCurveTo(44, -7, 51, -20, 50, -35);
    g.bezierCurveTo(50, -49, 41, -61, 28, -61);
    g.bezierCurveTo(19, -69, 9, -69, 0, -65);
    g.closePath();
    g.fillStyle = paint;
    g.fill();
    g.strokeStyle = '#a4471b';
    g.lineWidth = 1.7;
    g.stroke();
    for (const side of [-1, 1]) {
      gpLine(
        g,
        [
          ['M', side * 16, -65],
          ['C', side * 30, -52, side * 30, -18, side * 20, -2],
        ],
        '#d16b28',
        1.1,
      );
      gpLine(
        g,
        [
          ['M', side * 31, -59],
          ['C', side * 43, -45, side * 42, -20, side * 34, -7],
        ],
        '#dc7832',
        0.8,
      );
    }
    const drawStem = () => {
      g.save();
      g.translate(9, -65 + breathe - hatBounce * 0.35);
      g.rotate(wob * 0.1);
      g.beginPath();
      g.moveTo(-4, 2);
      g.quadraticCurveTo(-5, -10, 1, -17);
      g.lineTo(6, -15);
      g.quadraticCurveTo(0, -8, 4, 2);
      g.closePath();
      g.fillStyle = '#75bd57';
      g.fill();
      g.strokeStyle = '#347831';
      g.lineWidth = 1.5;
      g.stroke();
      gpLeaf(g, 2, -7, 0.95, 0.95);
      g.restore();
    };
    if (!hatDone) drawStem();
    else {
      g.save();
      g.translate(0, -hatBounce + breathe);
      flatBeret(g, -2, -59, 64, 9.8, 1, true, t);
      g.restore();
      drawStem();
    }
    const eyeY = -39 + breathe;
    for (const [x, r] of [
      [-9.5, 4.5],
      [9.5, 4],
    ]) {
      gpOval(g, x, eyeY, r, startled ? r * 1.15 : r * 0.85, '#fffdf3');
      gpOval(g, x + (s.lookX || 0) * 0.6, eyeY + (startled ? 0 : 0.6), 1.65, 1.85, '#342b22');
    }
    g.save();
    g.translate(0, -glassesLift);
    g.rotate(wob * 0.045);
    for (const x of [-10, 10]) {
      g.beginPath();
      g.arc(x, eyeY + 2.2, 7.2, 0, TAU);
      g.strokeStyle = '#725244';
      g.lineWidth = 1.25;
      g.stroke();
    }
    gpLine(
      g,
      [
        ['M', -2.8, eyeY + 1.6],
        ['Q', 0, eyeY - 0.5, 2.8, eyeY + 1.6],
      ],
      '#725244',
      1.1,
    );
    g.restore();
    gpOval(g, -18, -29, 3.8, 1.9, 'rgba(225,91,48,.28)');
    gpOval(g, 18, -29, 3.8, 1.9, 'rgba(225,91,48,.28)');
    if (startled) gpOval(g, 0, -26, 2.9, 3.6, '#63351f');
    else
      gpLine(
        g,
        [
          ['M', -4.2, -27],
          ['Q', 0, allDone ? -20.5 : -23.5, 4.2, -27],
        ],
        '#63351f',
        1.35,
      );
    if (scarfDone) grandmaScarf(g, 1, true, t, wob);
    const isScarf = hatDone && !scarfDone,
      ballX = 58,
      ballY = -3 - Math.abs(stitch) * 0.8;
    const yMain = isScarf ? '#fb7185' : '#b29acb',
      yStr = isScarf ? '#9f1239' : '#816895';
    gpLine(
      g,
      [
        ['M', ballX - 7, ballY + 1],
        ['C', 39, 6, 37, -2, 30, -5],
        ['Q', 23, -8, allDone ? 27 : 13, allDone ? -5 : -12],
      ],
      yStr,
      1.25,
    );
    gpOval(g, ballX, ballY + 1, 8.4, 8.4, yMain);
    const handY = allDone ? -12 : -10 + stitch * 0.85,
      rightX = allDone ? 29 : 27 + stitch * 0.85;
    gpLine(
      g,
      [
        ['M', -37, -25],
        ['C', -44, -11, -31, -5, -17, handY],
      ],
      '#3b8138',
      4,
    );
    gpLine(
      g,
      [
        ['M', 38, -24],
        ['Q', 43, -8, rightX, handY - 2],
      ],
      '#3b8138',
      4,
    );
    if (!hatDone) {
      const cw = 8 + hatP * 38,
        ch = 2.0 + hatP * 6.8;
      flatBeret(g, -1, -7, cw, ch, hatP, false, t);
      gpHook(g, rightX, handY - 2, FarmScene_clamp(cw / 2 - 3, 1, 16) + stitch * 1.6, -7 - ch + 1 + stitch * 1.3);
    } else if (!scarfDone) {
      grandmaScarf(g, scarfP, false, t, wob);
      gpHook(
        g,
        rightX,
        handY - 2,
        FarmScene_clamp((10 + scarfP * 36) * 0.5 - 2, 2, 17) + stitch * 1.6,
        -14 + stitch * 1.4,
      );
    } else {
      gpHook(g, 28, handY - 1, 44, handY - 5);
    }
    gpLeaf(g, -17, handY + 2, 0.9, 0.6);
    gpLeaf(g, rightX, handY + 1, -0.3, 0.6);
    g.restore();
  }
  function drawCrop(c) {
    if (c.age <= 0) return;
    const def = CROP[c.type];
    if (!def) return;
    drawDirtMound(c);
    const [sx, sy] = getCropScales(c); // Heavier crops sway slightly less in the breeze than tiny ones
    const weightDamp = 26 / (c.r + 10);
    const breeze = reduceMotion
      ? 0
      : (Math.sin(tNow * 2.2 + c.x * 0.008 + c.wob) * 0.065 + Math.sin(tNow * 4.8 + c.wob * 1.7) * 0.02) * weightDamp +
        (c.panic > 0.3 ? Math.sin(tNow * 32) * 0.07 : 0);
    ctx.save();
    ctx.translate(c.x, c.y + 2);
    if (c.lucky) {
      const pulse = reduceMotion ? 1 : 1 + Math.sin(tNow * 5 + c.wob) * 0.09;
      ctx.save();
      ctx.scale(c.ds, c.ds);
      ctx.fillStyle = radial(
        ctx,
        0,
        -18,
        0,
        0,
        -18,
        (c.r + 18) * pulse,
        'rgba(255,233,123,.42)',
        'rgba(255,222,105,0)',
      );
      circ(ctx, 0, -18, (c.r + 18) * pulse);
      ctx.strokeStyle = 'rgba(255,225,116,.8)';
      ctx.lineWidth = 1.1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.ellipse(0, 1, c.r * 1.05, c.r * 0.34, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    ctx.rotate(breeze + (c.wobbleAngle || 0));
    ctx.scale(sx, sy);
    if (c.stage === 1) {
      drawStage1Sprout(c, def);
    } else if (c.stage === 2) {
      drawStage2Bud(c, def, breeze);
    } else {
      drawStage3RipeCharacter(c, def, breeze);
    }
    if (c.frosted && c.stage >= 2) {
      ctx.save();
      ctx.fillStyle = 'rgba(186, 230, 253, 0.34)';
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
      ctx.lineWidth = 1.6;
      ell(ctx, 0, -c.r * 0.58, c.r * 0.92, c.r * 0.68);
      ctx.stroke();
      ctx.restore();
    }
    if (c.lucky && c.stage === 3) {
      const starY = -def.top - 8,
        tw = reduceMotion ? 0 : tNow * 0.8;
      ctx.save();
      ctx.translate(0, starY);
      ctx.rotate(tw);
      ctx.fillStyle = '#fff3bf';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          rr = i % 2 ? 2.2 : 5.5;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  function drawHpBar(c) {
    if (c.hpShow <= 0 || c.dead || c.maxHp <= 1.001) return;
    const w = Math.max(30, c.r * 1.1) * c.ds,
      x = c.x - w / 2,
      y = c.y - CROP[c.type].top * c.ds - 12,
      f = FarmScene_clamp(c.hp / c.maxHp, 0, 1);
    ctx.globalAlpha = Math.min(1, c.hpShow * 2);
    ctx.fillStyle = 'rgba(37,37,27,.75)';
    ctx.beginPath();
    ctx.roundRect(x - 2, y - 2, w + 4, 8, 4);
    ctx.fill();
    ctx.fillStyle = f > 0.5 ? '#b4dd8b' : f > 0.25 ? '#f5ce74' : '#ed9773';
    ctx.beginPath();
    ctx.roundRect(x, y, w * f, 4, 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  function drawGoat(gt) {
    const ds = depth(gt.y);
    const angry = !!gt.bumped;
    const freq = angry ? 28 : 10.5;
    const walk = reduceMotion ? 0 : Math.sin(gt.t * freq);
    const stride = reduceMotion ? 0 : Math.cos(gt.t * freq);
    const bounce = reduceMotion ? 0 : Math.abs(Math.sin(gt.t * freq)) * (angry ? 3.5 : 2.6);
    const hopY = (gt.hop || 0) > 0 ? Math.sin(gt.hop * Math.PI) * 14 : 0;
    ctx.save();
    ctx.translate(gt.x, gt.y - bounce - hopY);
    ctx.scale(ds * gt.dir, ds); // Back legs (articulated knee + dark cloven hoof)
    const drawLeg = (hipX, hipY, phase, back) => {
      const sw = Math.sin(gt.t * freq + phase) * (angry ? 7.5 : 4.5);
      const lift = Math.max(0, -Math.cos(gt.t * freq + phase)) * (angry ? 6 : 3.5);
      const kneeX = hipX + sw * 0.55 + 1.5;
      const kneeY = hipY + 9 - lift * 0.5;
      const footX = hipX + sw;
      const footY = -1.5 - lift + bounce;
      ctx.strokeStyle = back ? '#cbd5e1' : '#f1f5f9';
      ctx.lineWidth = 4.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(footX, footY);
      ctx.stroke();
      ctx.fillStyle = '#1e293b';
      ell(ctx, footX + 1, footY + 0.5, 3.6, 2.1);
    };
    drawLeg(-14, -18, Math.PI, true);
    drawLeg(11, -18, 0, true); // Wagging fluffy white tail
    const tailWag = reduceMotion ? 0 : Math.sin(gt.t * (angry ? 32 : 12)) * (angry ? 0.35 : 0.25);
    ctx.save();
    ctx.translate(-25, -31);
    ctx.rotate((angry ? 0.45 : -0.35) + tailWag);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.3;
    ell(ctx, -4, -3, 7.5, 4.5, -0.3);
    ctx.stroke();
    circ(ctx, -8, -5, 4);
    ctx.restore(); // Fluffy cloud-white wool body (scalloped wool puffs so it never looks like a plain oval!)
    ctx.fillStyle = radial(ctx, -6, -34, 3, 0, -25, 32, '#ffffff', angry ? '#ffe4e6' : '#e2e8f0');
    ctx.strokeStyle = angry ? '#fda4af' : '#cbd5e1';
    ctx.lineWidth = 1.6;
    ell(ctx, 0, -25, 26, 15.5, -0.03);
    ctx.stroke();
    const puffs = [
      [-18, -32, 8.5],
      [-9, -36, 9.5],
      [1, -37, 10],
      [11, -35, 9.5],
      [19, -30, 8.5],
      [-17, -18, 7.5],
      [-5, -15, 8.5],
      [7, -15, 8.5],
      [17, -18, 8.0],
    ];
    for (let i = 0; i < puffs.length; i++) {
      const [px, py, pr] = puffs[i];
      const puffJiggle = reduceMotion ? 0 : Math.sin(gt.t * freq * 2 + i) * (angry ? 1.2 : 0.5);
      ctx.fillStyle = i < 5 ? '#ffffff' : '#f1f5f9';
      circ(ctx, px, py + puffJiggle, pr * (angry ? 1.08 : 1));
    } // Subtle wool curl lines inside coat
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1.2;
    for (const [cx, cy] of [
      [-10, -27],
      [2, -26],
      [11, -23],
    ]) {
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0.2 * Math.PI, 1.3 * Math.PI);
      ctx.stroke();
    } // Front legs
    drawLeg(-6, -17, 0, false);
    drawLeg(17, -17, Math.PI, false); // Collar & swinging brass cowbell
    ctx.save();
    ctx.translate(18, -26);
    ctx.rotate(angry ? 0.25 : 0.05);
    ctx.fillStyle = cur && cur.treaty ? '#22c55e' : angry ? '#dc2626' : '#3b82f6';
    ctx.beginPath();
    ctx.roundRect(-3, -6, 6, 15, 3);
    ctx.fill();
    const bellSwing = reduceMotion ? 0 : Math.sin(gt.t * freq) * 0.28;
    ctx.translate(2, 9);
    ctx.rotate(bellSwing);
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 2, 4.2, Math.PI, 0);
    ctx.lineTo(4.8, 6);
    ctx.lineTo(-4.8, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore(); // Head & Neck
    ctx.save();
    const headBob = reduceMotion ? 0 : Math.sin(gt.t * (angry ? 22 : 5.5)) * (angry ? 0.06 : 0.08);
    ctx.translate(22, angry ? -28 : -35);
    ctx.rotate((angry ? -0.42 : 0.08) + headBob); // Curved ridged cream horns
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 4.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-1, -10);
    ctx.quadraticCurveTo(-9, -24, -17, -18);
    ctx.moveTo(5, -11);
    ctx.quadraticCurveTo(1, -26, -7, -23);
    ctx.stroke();
    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-1, -10);
    ctx.quadraticCurveTo(-9, -24, -17, -18);
    ctx.moveTo(5, -11);
    ctx.quadraticCurveTo(1, -26, -7, -23);
    ctx.stroke(); // Floppy white & pink ear that bounces
    const earFlop = reduceMotion ? 0 : Math.sin(gt.t * freq + 1.2) * 0.22;
    ctx.save();
    ctx.translate(-3, -7);
    ctx.rotate((angry ? -0.65 : -0.25) + earFlop);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.2;
    ell(ctx, -6, 0, 7.5, 3.4, -0.15);
    ctx.stroke();
    ctx.fillStyle = '#fda4af';
    ell(ctx, -6, 0.3, 4.8, 1.7, -0.15);
    ctx.restore(); // White goat head & snout
    ctx.fillStyle = radial(ctx, 4, -8, 1, 7, -2, 18, '#ffffff', '#e2e8f0');
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.4;
    ell(ctx, 6, -2, 12.5, 9.5, 0.05);
    ctx.stroke();
    ell(ctx, 14, 0, 7.5, 6.2, 0.12);
    ctx.stroke(); // Fluffy top head tuft
    ctx.fillStyle = '#ffffff';
    circ(ctx, 2, -10, 4.5);
    circ(ctx, 6, -10.5, 4); // Pink nose & nostril
    ctx.fillStyle = angry ? '#f43f5e' : '#fda4af';
    ell(ctx, 19.5, -1, 2.4, 3.2, 0.15);
    ctx.fillStyle = '#881337';
    circ(ctx, 19.5, -1.2, 1.0); // Wagging white chin beard (goatee)
    const chew = reduceMotion ? 0 : Math.sin(gt.t * 9) * 1.4;
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(9, 5 + chew * 0.4);
    ctx.quadraticCurveTo(11, 16 + chew, 15, 18 + chew);
    ctx.quadraticCurveTo(17, 12 + chew, 16, 5 + chew * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (!angry) {
      // PEACEFUL STATE: Big happy derpy goat eye + chewing a clover flower stem!
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.3;
      circ(ctx, 10.5, -4.8, 4.0);
      ctx.stroke(); // Horizontal rectangular goat pupil (classic funny goat look!)
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(8.8, -5.8, 3.6, 2.0, 0.8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      circ(ctx, 11.4, -6.2, 1.0); // Happy curved smile + chewing clover stem
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(15.5, 1.5 + chew * 0.3, 3.2, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke(); // Green clover stem & little yellow flower bobbing as it chews
      ctx.save();
      ctx.translate(18, 3 + chew * 0.4);
      ctx.rotate(0.25 + chew * 0.08);
      ctx.strokeStyle = '#16a34a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(7, 2, 13, -1);
      ctx.stroke();
      ctx.fillStyle = '#22c55e';
      ell(ctx, 8, 1, 3, 1.6, -0.4);
      ctx.fillStyle = '#facc15';
      circ(ctx, 14, -1.5, 2.8);
      ctx.fillStyle = '#fef08a';
      circ(ctx, 14, -1.5, 1.2);
      ctx.restore();
    } else {
      // ANGRY STATE (Only when touched!): Glowing red eye, V-brow, gritted teeth & snorting steam puffs!
      ctx.fillStyle = '#fef08a';
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 1.6;
      circ(ctx, 10.5, -4.5, 4.3);
      ctx.stroke();
      ctx.fillStyle = '#dc2626';
      circ(ctx, 11.2, -4.5, 2.1);
      ctx.fillStyle = '#ffffff';
      circ(ctx, 11.8, -5.2, 0.9); // Heavy slanted angry eyebrow
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(5.5, -9.5);
      ctx.lineTo(15.5, -6.2);
      ctx.stroke(); // Open bleating angry mouth with teeth
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.roundRect(12.5, 1.2, 6.5, 4.2, 1.5);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(13.5, 1.4, 4.5, 1.5); // Snorting steam puffs from nose
      const puffPhase = (gt.t * 4.5) % 1;
      ctx.fillStyle = `rgba(255, 255, 255, ${(1 - puffPhase) * 0.85})`;
      circ(ctx, 22 + puffPhase * 14, -2 - puffPhase * 6, 2.5 + puffPhase * 4.5);
      circ(ctx, 20 + puffPhase * 10, 1 - puffPhase * 3, 2.0 + puffPhase * 3.2);
    }
    ctx.restore();
    ctx.restore();
  }
  function drawPuddles() {
    for (const p of parts) {
      if (p.k !== 'puddle') continue;
      ctx.globalAlpha = (p.life / p.max) * 0.55;
      ctx.fillStyle = p.c;
      ell(ctx, p.x, p.y, p.rx, p.ry);
    }
    ctx.globalAlpha = 1;
  }
  function drawParts() {
    for (const p of parts) {
      if (p.k === 'clod') {
        ctx.globalAlpha = Math.min(1, (p.life / p.max) * 2);
        ctx.fillStyle = p.c;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.roundRect(-p.r, -p.r * 0.8, p.r * 2, p.r * 1.6, 1.5);
        ctx.fill();
        ctx.restore();
      } else if (p.k === 'leaf') {
        ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.8);
        ctx.fillStyle = p.c;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.moveTo(-p.len, 0);
        ctx.quadraticCurveTo(0, -p.wid, p.len, 0);
        ctx.quadraticCurveTo(0, p.wid, -p.len, 0);
        ctx.fill();
        ctx.restore();
      } else if (p.k === 'juice') {
        const ang = Math.atan2(p.vy, p.vx);
        const stretch = Math.min(1.8, 1 + Math.hypot(p.vx, p.vy) * 0.002);
        ctx.globalAlpha = Math.min(1, (p.life / p.max) * 2);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.fillStyle = p.c;
        ell(ctx, 0, 0, p.r * stretch, p.r * 0.85);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        circ(ctx, -p.r * 0.25, -p.r * 0.25, p.r * 0.3);
        ctx.restore();
      } else if (p.k === 'half') {
        const def = CROP[p.type];
        const t = 1 - p.life / p.max;
        ctx.globalAlpha = Math.max(0, 1 - t * t);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = def.color;
        ctx.strokeStyle = def.shade;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI, p.side < 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke(); // Inner pale flesh cross-section
        ctx.fillStyle = def.flesh;
        ctx.beginPath();
        ctx.arc(0, 0, p.r * 0.76, 0, Math.PI, p.side < 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (p.k === 'ring') {
        const t = 1 - p.life / p.max;
        ctx.globalAlpha = (1 - t) * 0.65;
        ctx.strokeStyle = p.c;
        ctx.lineWidth = 2 * (1 - t) + 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.4 + t * 0.9), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.k === 'dust') {
        ctx.globalAlpha = (p.life / p.max) * 0.4;
        ctx.fillStyle = '#d1b285';
        circ(ctx, p.x, p.y, p.s * (1.6 - p.life / p.max));
      } else if (p.k === 'spark') {
        const t = p.life / p.max;
        ctx.globalAlpha = t;
        ctx.fillStyle = '#fff3ba';
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(reduceMotion ? 0 : tNow * 2);
        const s = p.s * (0.5 + t);
        ctx.beginPath();
        ctx.moveTo(-s, 0);
        ctx.lineTo(-s * 0.2, -s * 0.2);
        ctx.lineTo(0, -s);
        ctx.lineTo(s * 0.2, -s * 0.2);
        ctx.lineTo(s, 0);
        ctx.lineTo(s * 0.2, s * 0.2);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.2, s * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
  function drawCoins() {
    for (const p of parts) {
      if (p.k !== 'coin' || p.t < 0) continue;
      const t = FarmScene_clamp(p.t, 0, 1),
        u = 1 - t,
        x = u * u * p.sx + 2 * u * t * p.cx + t * t * p.tx,
        y = u * u * p.sy + 2 * u * t * p.cy + t * t * p.ty,
        r = 5.5 - t * 1.5; // Golden Ribbon Trail behind flying coin
      if (!reduceMotion && t > 0.04) {
        ctx.save();
        ctx.beginPath();
        for (let s = 0; s <= 6; s++) {
          const ts = Math.max(0, t - s * 0.032),
            us = 1 - ts;
          const rx = us * us * p.sx + 2 * us * ts * p.cx + ts * ts * p.tx;
          const ry = us * us * p.sy + 2 * us * ts * p.cy + ts * ts * p.ty;
          if (s === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }
        ctx.strokeStyle = `rgba(255, 230, 128, ${(1 - t) * 0.55})`;
        ctx.lineWidth = r * 1.1;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#a56d24';
      circ(ctx, x, y + 1, r);
      ctx.fillStyle = '#f6cf6d';
      circ(ctx, x, y, r);
      ctx.strokeStyle = '#fff0ab';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.65, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#b08429';
      ctx.fillRect(x - 0.6, y - r * 0.4, 1.2, r * 0.8);
      ctx.fillStyle = '#fff7c9';
      circ(ctx, x - r * 0.3, y - r * 0.3, r * 0.2);
    }
  }
  function drawCursor() {
    if (!pointer.active || mode !== 'day') return;
    const R = cur.R,
      x = pointer.x,
      y = pointer.y;
    ctx.fillStyle = rushTimer > 0 ? 'rgba(255,230,115,.11)' : 'rgba(255,246,213,.06)';
    circ(ctx, x, y, R);
    ctx.setLineDash([5, 7]);
    ctx.lineDashOffset = reduceMotion ? 0 : -tNow * 18;
    ctx.strokeStyle = rushTimer > 0 ? 'rgba(255,230,120,.88)' : 'rgba(255,249,226,.66)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (chargeT > 0.05) {
      const cR = lerp(R * 0.4, R * (cur.cleaver ? 2.4 : 2.05), chargeT);
      ctx.save();
      ctx.strokeStyle = chargeT >= 0.72 ? 'rgba(56, 189, 248, 0.9)' : 'rgba(253, 224, 71, 0.75)';
      ctx.lineWidth = chargeT >= 0.72 ? 3.5 : 2.2;
      ctx.beginPath();
      ctx.arc(x, y, cR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } // Dynamic crescent slash arc when swinging
    if (sweepT > 0) {
      const t = 1 - sweepT / 0.13;
      const span = Math.PI * 1.28 * t;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255, 224, 130, ${0.45 * (1 - t)})`;
      ctx.lineWidth = 12 * (1 - t) + 2;
      ctx.beginPath();
      ctx.arc(x, y, R * 0.88, sweepA, sweepA + span);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 251, 235, ${0.92 * (1 - t)})`;
      ctx.lineWidth = 5.5 * (1 - t) + 1;
      ctx.beginPath();
      ctx.arc(x, y, R * 0.91, sweepA + span * 0.15, sweepA + span);
      ctx.stroke();
      ctx.restore();
    } // Upgraded Harvest Crescent Sickle
    ctx.save();
    ctx.translate(x, y);
    const swingKick = reduceMotion ? 0 : Math.sin((1 - FarmScene_clamp(sweepT / 0.13, 0, 1)) * Math.PI) * 0.95;
    const velTilt = FarmScene_clamp((pointer.vx || 0) * 0.0004, -0.18, 0.18);
    ctx.rotate(-0.62 + swingKick + velTilt);
    const z = FarmScene_clamp(R / 46, 0.72, 1.28);
    ctx.scale(z, z); // Drop shadow
    ctx.save();
    ctx.translate(2, 4);
    ctx.strokeStyle = 'rgba(20, 28, 18, 0.28)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-14, 24);
    ctx.lineTo(6, -12);
    ctx.arc(-6, -18, 18, 0.2, Math.PI * 1.18, true);
    ctx.stroke();
    ctx.restore(); // Forged crescent steel blade (outer spine + honed inner bevel)
    const bladeGrad = ctx.createLinearGradient(-28, -36, 18, -6);
    bladeGrad.addColorStop(0, '#ffffff');
    bladeGrad.addColorStop(0.35, '#e2e8f0');
    bladeGrad.addColorStop(0.75, '#94a3b8');
    bladeGrad.addColorStop(1, '#475569');
    ctx.fillStyle = bladeGrad;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(6, -12); // Tang at collar
    ctx.bezierCurveTo(18, -28, -4, -44, -26, -30); // Outer forged spine
    ctx.bezierCurveTo(-33, -25, -34, -16, -29, -12); // Hooked tip
    ctx.bezierCurveTo(-24, -22, -4, -29, 3, -10); // Razor inner cutting edge
    ctx.closePath();
    ctx.fill();
    ctx.stroke(); // Polished bevel highlight along the inner cutting edge
    ctx.strokeStyle = '#fffbeb';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-28, -14);
    ctx.bezierCurveTo(-20, -25, -3, -29, 4, -12);
    ctx.stroke(); // Golden harvest fuller line etched into blade
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-22, -26);
    ctx.bezierCurveTo(-10, -34, 6, -28, 5, -14);
    ctx.stroke(); // Brass bolster / ferrule collar
    ctx.save();
    ctx.translate(4, -10);
    ctx.rotate(0.48);
    ctx.fillStyle = '#eab308';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-4.2, -3.5, 8.4, 7, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fef08a';
    circ(ctx, 0, 0, 1.3);
    ctx.restore(); // Ergonomic turned ash-wood handle with leather grip wraps
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 7.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(2, -7);
    ctx.quadraticCurveTo(-5, 8, -14, 23);
    ctx.stroke();
    ctx.strokeStyle = '#c27838';
    ctx.lineWidth = 5.0;
    ctx.beginPath();
    ctx.moveTo(2, -7);
    ctx.quadraticCurveTo(-5, 8, -14, 23);
    ctx.stroke();
    ctx.strokeStyle = '#f6d096';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(1, -7);
    ctx.quadraticCurveTo(-6, 7, -15, 22);
    ctx.stroke(); // Leather grip bands
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.4;
    for (const tGrip of [0.28, 0.52, 0.76]) {
      const gx = lerp(2, -14, tGrip),
        gy = lerp(-7, 23, tGrip);
      ctx.beginPath();
      ctx.moveTo(gx - 2.6, gy - 1.2);
      ctx.lineTo(gx + 2.6, gy + 1.2);
      ctx.stroke();
    } // Brass pommel cap at bottom of handle
    ctx.fillStyle = '#d97706';
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.2;
    circ(ctx, -14.5, 23.5, 3.8);
    ctx.stroke();
    ctx.restore();
  }
  function drawTexts() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const t of texts) {
      const a = Math.min(1, (t.life / t.max) * 2.5);
      ctx.globalAlpha = a;
      ctx.font = `800 ${Math.round(t.size)}px "Big Shoulders Stencil", Impact, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(39,35,23,.65)';
      ctx.strokeText(t.t, t.x, t.y);
      ctx.fillStyle = t.col;
      ctx.fillText(t.t, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
  function drawSkyLife(p, night) {
    const motion = reduceMotion ? 0 : tNow;
    for (let i = 0; i < 5; i++) {
      const x = ((worldW * (0.08 + i * 0.23) + motion * (1.8 + i * 0.2)) % (worldW + 150)) - 70,
        y = ((64 + (i % 3) * 24) * FIELD_TOP) / 228,
        z = (0.6 + (i % 2) * 0.24) * 0.8;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(z, z);
      ctx.fillStyle = night > 0.4 ? 'rgba(176,185,209,.12)' : 'rgba(255,246,222,.58)';
      ell(ctx, 0, 0, 42, 11);
      ell(ctx, -20, -6, 20, 13);
      ell(ctx, 3, -12, 24, 18);
      ell(ctx, 29, -3, 23, 12);
      ctx.fillStyle = night > 0.4 ? 'rgba(175,182,205,.08)' : 'rgba(255,251,233,.3)';
      ell(ctx, -3, -15, 20, 10);
      ctx.restore();
    }
    if (night < 0.6) {
      ctx.strokeStyle = 'rgba(54,78,76,.48)';
      ctx.lineWidth = 1.15;
      for (let i = 0; i < 3; i++) {
        const x = (worldW * 0.53 + i * 14 + motion * 7) % (worldW + 50),
          y = ((83 + (i % 2) * 8) * FIELD_TOP) / 228 + Math.sin(motion * 1.3 + i) * 2,
          wing = reduceMotion ? 2 : Math.sin(motion * 6 + i) * 3;
        ctx.beginPath();
        ctx.moveTo(x - 4, y - wing);
        ctx.quadraticCurveTo(x - 2, y - 2, x, y);
        ctx.quadraticCurveTo(x + 2, y - 2, x + 4, y - wing);
        ctx.stroke();
      }
    }
  }
  function drawAmbient(night) {
    if (reduceMotion) return;
    const r = mulberry(93);
    if (night > 0.2) {
      for (let i = 0; i < 15; i++) {
        const x = r() * worldW + Math.sin(tNow * 0.6 + i) * 12,
          y = FIELD_TOP + 25 + r() * (HW - FIELD_TOP - 55) + Math.cos(tNow * 0.7 + i) * 8,
          a = night * (0.2 + 0.6 * Math.pow(Math.sin(tNow * 1.3 + i), 2));
        ctx.fillStyle = `rgba(246,232,137,${a * 0.13})`;
        circ(ctx, x, y, 7);
        ctx.fillStyle = `rgba(255,241,159,${a})`;
        circ(ctx, x, y, 1.2);
      }
    } else {
      for (let i = 0; i < 7; i++) {
        const x = (r() * worldW + tNow * (3 + i * 0.3)) % (worldW + 15),
          y = FIELD_TOP + 20 + r() * (HW - FIELD_TOP - 40) + Math.sin(tNow * 0.6 + i) * 5;
        ctx.fillStyle = 'rgba(255,240,176,.32)';
        ell(ctx, x, y, 1.8, 0.6, -0.7);
      }
    }
  }
  function mountainRidgeY(xNorm) {
    const RR = [
      [0.0, 0.5],
      [0.056, 0.475],
      [0.111, 0.447],
      [0.167, 0.461],
      [0.222, 0.488],
      [0.278, 0.486],
      [0.333, 0.446],
      [0.389, 0.42],
      [0.444, 0.443],
      [0.5, 0.467],
      [0.556, 0.415],
      [0.611, 0.252],
      [0.667, 0.385],
      [0.722, 0.44],
      [0.778, 0.457],
      [0.833, 0.473],
      [0.889, 0.461],
      [0.944, 0.439],
      [1.0, 0.427],
    ];
    const u = FarmScene_clamp((xNorm * worldW - (window.__bandX0 || 0)) / (window.__bandW || worldW), 0, 1);
    for (let i = 1; i < RR.length; i++) {
      if (u <= RR[i][0]) {
        const a = RR[i - 1],
          b = RR[i],
          t = (u - a[0]) / (b[0] - a[0]);
        return (a[1] + (b[1] - a[1]) * t) * FIELD_TOP;
      }
    }
    if (true) return RR[RR.length - 1][1] * FIELD_TOP; // Matches the topmost mountain silhouette in ensureScenery: [[0,137],[.19,103],[.39,138],[.6,109],[.78,126],[1,90]]
    const pts = [
      [0, 137],
      [0.19, 103],
      [0.39, 138],
      [0.6, 109],
      [0.78, 126],
      [1, 90],
    ];
    const x = FarmScene_clamp(xNorm, 0, 1);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1],
        b = pts[i];
      if (x <= b[0]) {
        const t = (x - a[0]) / (b[0] - a[0]);
        const midY = Math.min(a[1], b[1]) - 15;
        return (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * midY + t * t * b[1];
      }
    }
    return 115;
  }
  function drawScarecrowAndSmoke(night) {
    if (true) return; // 1. Evolving Farm: Spinning Windmill (unlocked after Bill 1)
    if (farm.billsPaid >= 1 && worldW > 380) {
      const wx = worldW * 0.34,
        wy = 198;
      ctx.save();
      ctx.translate(wx, wy);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(-3, -44);
      ctx.lineTo(3, -44);
      ctx.lineTo(8, 0);
      ctx.stroke();
      ctx.translate(0, -44);
      ctx.rotate(reduceMotion ? 0.4 : tNow * (dailyEvent && dailyEvent.weather === 'wind' ? 3.2 : 1.2));
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.rect(2, -2.5, 16, 5);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#dc2626';
      circ(ctx, 0, 0, 3);
      ctx.restore();
    } // 2. Evolving Farm: Chugging Red Tractor (unlocked after Bill 3)
    if (farm.billsPaid >= 3 && worldW > 420) {
      const tx = worldW * 0.43,
        ty = 207,
        chug = reduceMotion ? 0 : Math.sin(tNow * 16) * 0.7;
      ctx.save();
      ctx.translate(tx, ty + chug);
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.roundRect(-14, -18, 26, 12, 3);
      ctx.fill();
      ctx.fillStyle = '#991b1b';
      ctx.beginPath();
      ctx.roundRect(-12, -28, 14, 11, 2);
      ctx.fill();
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(-9, -26, 8, 7);
      ctx.fillStyle = '#1e293b';
      circ(ctx, -8, -6, 7.5);
      circ(ctx, 9, -4.5, 5);
      ctx.fillStyle = '#facc15';
      circ(ctx, -8, -6, 3.2);
      circ(ctx, 9, -4.5, 2);
      ctx.restore();
    } // 3. Cozy Farmhouse Chimney Smoke on the right
    if (worldW > 420 && smokePuffs.length) {
      for (const sp of smokePuffs) {
        const k = sp.life / sp.max;
        ctx.fillStyle = `rgba(245, 240, 230, ${(1 - k) * 0.42 * (1 - night * 0.4)})`;
        circ(ctx, sp.x, sp.y, sp.r + (sp.maxR - sp.r) * k);
      }
    } // 4. Background Scarecrow near the fence (wobbles happily during Harvest Rush!)
    const scX = worldW * 0.62,
      scY = 208;
    const dance =
      rushTimer > 0 && mode === 'day'
        ? reduceMotion
          ? 0
          : Math.sin(tNow * 18) * 0.26
        : reduceMotion
          ? 0
          : Math.sin(tNow * 2.1) * 0.035;
    ctx.save();
    ctx.translate(scX, scY);
    ctx.rotate(dance);
    ctx.strokeStyle = '#6b4f35';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -28);
    ctx.moveTo(-14, -19);
    ctx.lineTo(14, -19);
    ctx.stroke();
    ctx.fillStyle = '#c85a32';
    ctx.beginPath();
    ctx.roundRect(-7, -21, 14, 12, 2);
    ctx.fill();
    ctx.fillStyle = '#f3d58d';
    circ(ctx, 0, -26, 5.5);
    ctx.fillStyle = '#7c4d25';
    ctx.beginPath();
    ctx.moveTo(-10, -29);
    ctx.lineTo(0, -37);
    ctx.lineTo(10, -29);
    ctx.closePath();
    ctx.fill();
    ctx.restore(); // 5. Evolving Farm: Glowing Fence Post Lanterns at Dusk/Night (unlocked after Bill 1)
    if (farm.billsPaid >= 1) {
      const fy = FIELD_TOP - 13;
      for (let x = 56; x < worldW - 40; x += 147) {
        ctx.fillStyle = '#475569';
        ctx.fillRect(x - 2, fy - 25, 4, 5);
        ctx.fillStyle = '#fef08a';
        circ(ctx, x, fy - 22, 2.2);
        if (night > 0.05) {
          ctx.fillStyle = radial(
            ctx,
            x,
            fy - 22,
            1,
            x,
            fy - 22,
            22,
            `rgba(255, 220, 120, ${night * 0.45})`,
            'rgba(255, 220, 120, 0)',
          );
          circ(ctx, x, fy - 22, 22);
        }
      }
    } // 6. Character: Authored Arthur Grumble Rig along the fence!
    const st = billStatus();
    const gx = worldW * 0.85,
      gy = 213;
    const paidEnough = farm.cash >= st.b.amt;
    let aState = 'idle';
    let bubble = '';
    if (arthurAngerTimer > 0) {
      aState = 'anger';
      bubble = 'Stop that!!';
    } else if (paidEnough && (st.left <= 1 || mode === 'day')) {
      aState = 'shock';
      if (mode === 'day' && time < 7.0) bubble = 'Impossible! You have the cash?!';
    } else if (mode === 'day' && time < 4.8) {
      aState = 'demand';
      bubble = `Pay ${fmt$(st.b.amt)} at dusk or else!`;
    } else if (st.left <= 1 || (mode === 'day' && time < 9.5)) {
      aState = 'smug';
      if (mode === 'day' && time < 8.0) bubble = `Heh heh... ${fmt$(st.b.amt)} due soon!`;
    }
    const phaserScene = window.__PHASER_FARM_SCENE;
    if (phaserScene && phaserScene.arthurSprite && phaserScene.textures.exists('arthur')) {
      const spr = phaserScene.arthurSprite;
      spr.setPosition(gx, gy + 5);
      const baseW = phaserScene.textures.get('arthur').frames['idle_0']?.frame?.w || 320;
      const norm = 320 / baseW;
      spr.setScale(0.35 * norm, 0.35 * norm);
      spr.play(`arthur_${aState}`, true);
      spr.currentFrameIndex = Math.floor(tNow * (aState === 'anger' ? 14 : 10)) % 6;
      const fRef = spr.currentAnim?.frames[spr.currentFrameIndex];
      if (fRef) {
        spr.textureKey = fRef.key;
        spr.frameName = fRef.frame;
      }
      spr.setVisible(true);
      spr.render(ctx);
      spr.setVisible(false);
      if (bubble) {
        ctx.save();
        ctx.translate(gx, gy - 122);
        ctx.font = '700 10.5px "Courier Prime", monospace';
        const tw = ctx.measureText(bubble).width + 16;
        ctx.fillStyle = 'rgba(255, 253, 242, 0.96)';
        ctx.strokeStyle = paidEnough ? '#15803d' : '#991b1b';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(-tw / 2, -18, tw, 20, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = paidEnough ? '#15803d' : '#b91c1c';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bubble, 0, -8);
        ctx.restore();
      }
    }
  }
  function drawPropsCrowsAndWeather() {
    // Field Props (Fertilizer Bags & Clover Treats)
    for (const fp of fieldProps) {
      const s = fp.ds * (0.92 + Math.sin(tNow * 5) * 0.05);
      ctx.save();
      ctx.translate(fp.x, fp.y);
      ctx.scale(s, s);
      ctx.fillStyle = 'rgba(255, 235, 130, 0.25)';
      circ(ctx, 0, -12, 22);
      if (fp.kind === 'fertilizer') {
        ctx.fillStyle = '#d6b37c';
        ctx.strokeStyle = '#78532a';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(-12, -24, 24, 24, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#16a34a';
        circ(ctx, 0, -12, 6);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('+4', 0, -9);
      } else {
        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 1.5;
        for (const [ox, oy] of [
          [-5, -14],
          [5, -14],
          [0, -20],
        ]) {
          circ(ctx, ox, oy, 6);
          ctx.stroke();
        }
        ctx.fillStyle = '#facc15';
        circ(ctx, 0, -14, 3.5);
      }
      ctx.restore();
    } // Swooping Crow Pests
    for (const cr of crows) {
      const wing = reduceMotion ? 0 : Math.sin(cr.t * 22) * 8;
      ctx.save();
      ctx.translate(cr.x, cr.y);
      if (cr.vx < 0 || (!cr.scared && cr.tx < cr.x)) ctx.scale(-1, 1);
      ctx.fillStyle = '#1e293b';
      ell(ctx, 0, 0, 11, 6.5);
      ctx.beginPath();
      ctx.moveTo(-4, -2);
      ctx.lineTo(-12, -10 + wing);
      ctx.lineTo(4, -3);
      ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(10, -2);
      ctx.lineTo(17, 0);
      ctx.lineTo(10, 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      circ(ctx, 7, -2, 2);
      ctx.fillStyle = '#0f172a';
      circ(ctx, 7.5, -2, 1);
      ctx.restore();
    } // Storm Scythe Chain Lightning Bolts
    for (const b of bolts) {
      ctx.save();
      ctx.globalAlpha = b.life / b.max;
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo((b.x1 + b.x2) * 0.5 + (Math.random() - 0.5) * 18, (b.y1 + b.y2) * 0.5 - 12);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.restore();
    } // Weather Particles (Summer Rain or Blowing Autumn Leaves)
    for (const wp of weatherParts) {
      if (wp.w === 'rain') {
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.48)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(wp.x, wp.y);
        ctx.lineTo(wp.x - 4, wp.y + 13);
        ctx.stroke();
      } else {
        ctx.save();
        ctx.translate(wp.x, wp.y);
        ctx.rotate(wp.rot + tNow * 3);
        ctx.fillStyle = wp.c;
        ell(ctx, 0, 0, 4.5, 2.4);
        ctx.restore();
      }
    }
  }
  function draw() {
    if (!worldW) return;
    const p = skyP(),
      m = lightMul(p),
      night = smooth(1, 1.3, p),
      warm = smooth(0.55, 1, p);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.save();
    if (shakeA > 0.2) ctx.translate((Math.random() - 0.5) * shakeA, (Math.random() - 0.5) * shakeA);
    const [top, bot] = skyAt(p);
    ctx.fillStyle = rgba(top);
    ctx.fillRect(-20, -20, worldW + 40, FIELD_TOP * 0.34 + 20);
    ctx.fillStyle = rgba(mixc(top, bot, 0.5));
    ctx.fillRect(-20, FIELD_TOP * 0.34, worldW + 40, FIELD_TOP * 0.3);
    ctx.fillStyle = rgba(bot);
    ctx.fillRect(-20, FIELD_TOP * 0.64, worldW + 40, FIELD_TOP * 0.36 + 20);
    if (night > 0) {
      for (const s of stars) {
        ctx.globalAlpha = night * (0.55 + 0.45 * Math.sin((reduceMotion ? 0 : tNow) * 1.7 + s.tw));
        ctx.fillStyle = '#fff2ca';
        circ(ctx, s.x * worldW, s.y * (HORIZON - 30), s.r);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = radial(
        ctx,
        worldW * 0.81,
        40,
        2,
        worldW * 0.81,
        40,
        42,
        'rgba(245,239,206,.28)',
        'rgba(245,239,206,0)',
      );
      circ(ctx, worldW * 0.81, 40, 42);
      ctx.fillStyle = '#f5ecd0';
      circ(ctx, worldW * 0.81, 40, 11);
      ctx.strokeStyle = '#2B1708';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(worldW * 0.81, 40, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(162,168,165,.4)';
      circ(ctx, worldW * 0.81 - 3, 37, 2.6);
      circ(ctx, worldW * 0.81 + 3, 44, 1.8);
    } // Sun arc & mountain occlusion check
    const q = Math.min(1, p);
    const sx = worldW * (0.12 + 0.76 * q); // Sun rises high at midday (y ~ 52) and dips behind the mountain ridge around p ~ 0.80
    const sy =
      ((136 - Math.sin(Math.PI * q) * 84 + (p > 0.72 ? Math.pow((p - 0.72) / 0.28, 1.55) * 95 : 0)) * FIELD_TOP) / 228;
    const ridgeY = mountainRidgeY(sx / worldW); // Positive when the sun's center is above the mountain ridge; <= 0 when behind the mountain
    const sunClearance = ridgeY - sy;
    const beamVisibility = FarmScene_clamp((sunClearance - 8) / 28, 0, 1) * (1 - night);
    if (p < 1.06) {
      const sun = mixc(hex('#ffd45c'), hex('#ff9e58'), warm);
      ctx.fillStyle = radial(ctx, sx, sy, 4, sx, sy, 66, rgba(sun, 0.4), rgba(sun, 0));
      circ(ctx, sx, sy, 66);
      ctx.fillStyle = rgba(sun);
      circ(ctx, sx, sy, 15);
      ctx.strokeStyle = '#2B1708';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(sx, sy, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,243,196,.9)';
      circ(ctx, sx - 4.5, sy - 4.5, 4.2);
    }
    drawSkyLife(p, night);
    ensureScenery();
    ctx.drawImage(sceneryLayer, 0, 0, worldW, FIELD_TOP);
    ctx.drawImage(fieldLayer, 0, FIELD_TOP - 14, worldW, HW - FIELD_TOP + 14);
    drawScarecrowAndSmoke(night); // Sunbeams ("God Rays") ONLY when the sun is strictly above the mountain ridge!
    // As the sun drops behind the mountain (beamVisibility -> 0), beams vanish completely.
    if (beamVisibility > 0.01 && mode === 'day') {
      const rayCol = mixc(hex('#fff6c8'), hex('#ffc078'), warm);
      for (let i = -1; i <= 1; i++) {
        ctx.save();
        ctx.translate(sx, sy);
        const sway = reduceMotion ? 0 : Math.sin(tNow * 0.7 + i) * 0.025;
        ctx.rotate(((sx - worldW * 0.5) / worldW) * 0.55 + i * 0.2 + sway);
        const gr = ctx.createLinearGradient(0, 18, 0, 360);
        gr.addColorStop(0, rgba(rayCol, 0.14 * beamVisibility));
        gr.addColorStop(0.65, rgba(rayCol, 0.06 * beamVisibility));
        gr.addColorStop(1, rgba(rayCol, 0));
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(-12, 18);
        ctx.lineTo(12, 18);
        ctx.lineTo(64, 360);
        ctx.lineTo(-64, 360);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    drawPuddles();
    const sunX = sx,
      shDx = mode === 'day' ? (-(sunX - worldW / 2) / worldW) * 1.4 : 0,
      shA = (night > 0.5 ? 0.16 : 0.3) * (0.55 + 0.45 * beamVisibility),
      list = crops.slice().sort((a, b) => a.y - b.y);
    for (const c of list) {
      const grow = c.age <= 0 ? 0 : Math.min(1, c.age / 0.35);
      if (grow <= 0) continue;
      const w = c.r * c.ds * grow;
      ctx.fillStyle = `rgba(36,27,17,${shA * 0.5})`;
      ell(ctx, c.x + shDx * w * 0.9, c.y + 3, w * 1.22, w * 0.38);
      ctx.fillStyle = `rgba(30,22,14,${shA})`;
      ell(ctx, c.x, c.y + 3, w * 0.67, w * 0.2);
    }
    if (goat) {
      const ds = depth(goat.y);
      ctx.fillStyle = `rgba(30,26,17,${shA})`;
      ell(ctx, goat.x + shDx * 20 * ds, goat.y + 2, 29 * ds, 8 * ds);
    }
    let goatDrawn = !goat;
    for (const c of list) {
      if (!goatDrawn && goat.y < c.y) {
        drawGoat(goat);
        goatDrawn = true;
      }
      drawCrop(c);
    }
    if (!goatDrawn) drawGoat(goat);
    for (const c of list) drawHpBar(c);
    drawParts();
    drawPropsCrowsAndWeather(); // Seamless full-canvas evening/night atmospheric tint (NO horizontal cut line at y=105!)
    if (warm > 0.05 || night > 0.05) {
      const ambGrad = ctx.createLinearGradient(0, 0, 0, HW);
      ambGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      ambGrad.addColorStop(0.28, rgba(mixc([255, 255, 255], m, 0.45)));
      ambGrad.addColorStop(1, rgba(m));
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = ambGrad;
      ctx.fillRect(-20, -20, worldW + 40, HW + 40);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (warm > 0.15 && night < 0.85) {
      const duskWash = ctx.createLinearGradient(0, 0, 0, HW);
      duskWash.addColorStop(0, 'rgba(255, 180, 120, 0)');
      duskWash.addColorStop(0.35, `rgba(255, 168, 108, ${warm * 0.14 * (1 - night)})`);
      duskWash.addColorStop(0.7, `rgba(235, 132, 98, ${warm * 0.1 * (1 - night)})`);
      duskWash.addColorStop(1, `rgba(120, 68, 88, ${warm * 0.06 * (1 - night)})`);
      ctx.fillStyle = duskWash;
      ctx.fillRect(0, 0, worldW, HW);
    }
    drawBarn(m, night);
    if (window.DBD_ENV_RENDERER)
      window.DBD_ENV_RENDERER.drawForegroundFraming(ctx, worldW, HW, curBiome().countryCode, tNow);
    drawAmbient(night);
    drawCoins();
    drawTexts();
    if (perfumeSparkleTimer > 0 && !reduceMotion) {
      const pAlpha = Math.min(1, perfumeSparkleTimer);
      ctx.save();
      ctx.fillStyle = `rgba(192, 132, 252, ${pAlpha * 0.14})`;
      ctx.fillRect(0, 0, worldW, HW);
      for (let i = 0; i < 14; i++) {
        const sx = ((i * 97 + tNow * 60) % (worldW - 40)) + 20;
        const sy = FIELD_TOP + ((i * 53 + Math.sin(tNow * 5 + i) * 25) % (HW - FIELD_TOP - 30));
        ctx.fillStyle = i % 2 === 0 ? `rgba(254, 240, 138, ${pAlpha * 0.9})` : `rgba(233, 213, 255, ${pAlpha * 0.9})`;
        circ(ctx, sx, sy, 2.5 + Math.sin(tNow * 12 + i) * 1.2);
      }
      ctx.restore();
    }
    drawCursor();
    ctx.restore();
    if (dawnFade > 0) {
      ctx.fillStyle = `rgba(20,35,50,${dawnFade * 0.65})`;
      ctx.fillRect(0, 0, worldW, HW);
    }
  }
  function drawBarn(m, night) {
    if (true) return;
    if (night < 0.05) return;
    const bs = worldW < 430 ? 0.83 : 1.08,
      bx = Math.max(75, worldW * 0.21),
      x = bx - 11 * bs,
      y = 211 - 61 * bs;
    ctx.fillStyle = radial(ctx, x, y, 1, x, y, 26 * bs, `rgba(255,215,125,${night * 0.42})`, 'rgba(255,207,121,0)');
    circ(ctx, x, y, 26 * bs);
    ctx.fillStyle = `rgba(255,224,149,${night * 0.88})`;
    ctx.fillRect(x - 5 * bs, y - 4 * bs, 10 * bs, 8 * bs);
    if (worldW > 420) {
      const hx = worldW * 0.76,
        hy = 207;
      ctx.fillStyle = `rgba(255,218,143,${night * 0.7})`;
      ctx.fillRect(hx - 19, hy - 24, 8, 9);
      ctx.fillRect(hx + 14, hy - 24, 8, 9);
    }
  }
  /* ================= UI ================= */ const el = {
    hFarm: $('#hFarm'),
    hDay: $('#hDay'),
    hCash: $('#hCash'),
    hGrit: $('#hGrit'),
    btnSound: $('#btnSound'),
    hud: $('#hud'),
    hudEarn: $('#hudEarn'),
    hudCombo: $('#hudCombo'),
    hudLight: $('#hudLight'),
    dlText: $('#dlText'),
    dlFill: $('#dlFill'),
    overlay: $('#overlay'),
    toast: $('#toast'),
    notice: $('#notice'),
    shedList: $('#shedList'),
    shedTag: $('#shedTag'),
    shedHint: $('#shedHint'),
    perkList: $('#perkList'),
    heirList: $('#heirList'),
    gritTag: $('#gritTag'),
    heirHint: $('#heirHint'),
    modal: $('#modal'),
    btnReset: $('#btnReset'),
  };
  let toastTimer = 0;
  function toast(msg, ms) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms || 2600);
  }
  function renderAll() {
    renderHeader();
    renderNotice();
    renderShed();
    renderPerks();
    renderHeir();
    renderCard();
    el.hud.hidden = !(mode === 'day' || mode === 'dusk');
  }
  function renderHeader() {
    setText(el.hFarm, `Farm No. ${farm.no}`);
    setText(el.hDay, String(farm.day));
    setText(el.hCash, fmt$(farm.cash));
    setText(el.hGrit, String(meta.grit));
    const hDia = $('#hDiamonds');
    if (hDia) setText(hDia, `💎 ${meta.diamonds || 0}`);
    el.btnSound.setAttribute('aria-pressed', String(meta.sound));
    setText(el.btnSound, meta.sound ? 'Sound on' : 'Sound off');
    const bm = curBiome(),
      bBtn = $('#btnBiome'),
      fSign = $('#fieldSign');
    if (bBtn) {
      setText(bBtn, `🌍 ${bm.short}`);
      bBtn.disabled = mode !== 'idle';
    }
    if (fSign) setText(fSign, `${bm.countryName.toUpperCase()} · ${bm.city.toUpperCase()} · v0.6.00`);
  }
  let lastStampKey = '';
  function renderNotice() {
    const st = billStatus(),
      b = st.b,
      can = farm.cash >= b.amt,
      pct = FarmScene_clamp(farm.cash / b.amt, 0, 1);
    let due,
      stamp,
      stampCls = '';
    if (st.tonight) {
      due = 'Due tonight. Pay before you sleep.';
      stamp = 'Due tonight';
    } else if (st.left === 1) {
      due = `Due at sunset tomorrow, day ${farm.due}.`;
      stamp = 'Final notice';
    } else {
      due = `Due at sunset on day ${farm.due}, in ${st.left} days.`;
      stamp = 'Notice';
      stampCls = 'muted';
    }
    let proj,
      projCls = '';
    if (can) {
      proj = st.tonight ? 'You have enough. Pay it now.' : 'You could pay this now and pick a perk.';
      projCls = 'ok';
    } else if (st.tonight) {
      proj = `You're ${fmt$(Math.ceil(b.amt - farm.cash))} short.`;
      projCls = 'bad';
    } else if (!farm.played) {
      proj = 'Your first day will show your pace.';
    } else {
      const est = farm.cash + farm.lastEarn * st.left;
      proj = `At yesterday's pace you'll have about ${fmt$(est)} by then.`;
      projCls = est >= b.amt ? 'ok' : 'bad';
    }
    const next = farm.bill + 1 < FarmScene_BILLS.length ? billObj(farm.bill + 1) : null;
    const key = farm.bill + ':' + stamp;
    const pop = key !== lastStampKey && lastStampKey !== '' ? ' pop' : '';
    lastStampKey = key;
    el.notice.innerHTML =
      `<div class="n-lh"><strong>Grumble &amp; Sons</strong> Savings &amp; Loan</div>` +
      `<div class="n-lh">Acct 0047-FARM · Notice ${farm.bill + 1} of ${FarmScene_BILLS.length}</div>` +
      `<div class="n-name">${b.name}</div>` +
      `<p class="n-note">${b.note}</p>` +
      `<div class="n-amtrow"><div class="n-amt">$${b.amt.toLocaleString('en-US')}<small>.00</small></div><span class="stamp ${stampCls}${pop}">${stamp}</span></div>` +
      `<div class="n-due${st.tonight ? ' hot' : ''}">${due}</div>` +
      `<div class="meter${can ? ' full' : ''}" id="nMeter" role="img" aria-label="Cash covers ${Math.round(pct * 100)}% of this bill"><span><i id="nBar" style="width:${(pct * 100).toFixed(1)}%"></i></span></div>` +
      `<div class="n-cash"><span id="nCash">Cash on hand ${fmt$(farm.cash)}</span><span id="nPct">${Math.round(pct * 100)}%</span></div>` +
      `<p class="n-proj ${projCls}">${proj}</p>` +
      `<div class="n-actions"><button class="btn money" type="button" id="btnPay" ${can && mode === 'idle' ? '' : 'disabled'}>Pay ${fmt$(b.amt)}</button>` +
      `<span class="n-next">${next ? `After this: ${lc(next.name)}, ${fmt$(next.amt)}.` : 'This is the last one.'}</span></div>`;
  }
  function guardTonight(cost) {
    const st = billStatus();
    return st.tonight && farm.cash - cost < st.b.amt;
  }
  function renderShed() {
    const open = mode === 'idle';
    el.shedTag.textContent = open ? 'Open' : 'Closed until sunset';
    el.shedTag.classList.toggle('closed', !open);
    const st = billStatus();
    el.shedHint.textContent =
      open && st.tonight && farm.cash >= st.b.amt
        ? "Tonight's bill comes first. Pay it, then shop."
        : 'Upgrades last until the bank takes this farm.';
    const s = stats();
    el.shedList.innerHTML = FarmScene_SHED.map((def) => {
      const lvl = farm.shed[def.id],
        c = shedCost(def, lvl);
      const pips = `<span class="pips" aria-hidden="true">${Array.from({ length: def.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</span>`;
      let fx, btn;
      if (c == null) {
        fx = `${def.show(s)} · maxed`;
        btn = `<button class="buy max" type="button" disabled>Maxed</button>`;
      } else {
        fx = `${def.show(s)} → ${def.show(statsWith(def.id))}`;
        const ok = open && farm.cash >= c && !guardTonight(c);
        btn = `<button class="buy${ok ? ' can' : ''}" type="button" data-buy="${def.id}" ${ok ? '' : 'disabled'} aria-label="Buy ${def.name} for ${fmt$(c)}">${fmt$(c)}</button>`;
      }
      return `<div class="row"><div class="r-name">${def.name} ${pips}</div><div class="r-fx">${fx}</div><div class="r-btn">${btn}</div></div>`;
    }).join('');
  }
  function renderPerks() {
    if (!farm.perks.length) {
      el.perkList.innerHTML = '<p class="empty">None yet. Each bill you pay lets you pick one.</p>';
      return;
    }
    const counts = {};
    farm.perks.forEach((p) => (counts[p] = (counts[p] || 0) + 1));
    el.perkList.innerHTML =
      '<div class="perks">' +
      Object.keys(counts)
        .map((id) => {
          const p = FarmScene_PERKS.find((x) => x.id === id);
          return `<span class="perk" title="${p.line}">${p.name}${counts[id] > 1 ? ` <small>×${counts[id]}</small>` : ''}</span>`;
        })
        .join('') +
      '</div>';
  }
  function renderHeir() {
    setText(el.gritTag, `${meta.grit} Grit`);
    const any = FarmScene_HEIR_IDS.some((k) => meta.heir[k] > 0);
    el.heirHint.textContent =
      meta.grit === 0 && !any
        ? 'Every lost farm leaves you stronger: Grit rewards payments (with diminishing returns), 3 per bill, days survived and saved cash. Heirlooms stay with you forever.'
        : 'Heirlooms stay with you on every farm.';
    const open = mode === 'idle';
    el.heirList.innerHTML = FarmScene_HEIRS.map((def) => {
      const lvl = meta.heir[def.id],
        c = heirCost(def, lvl);
      const pips = `<span class="pips" aria-hidden="true">${Array.from({ length: def.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</span>`;
      const ok = c != null && open && meta.grit >= c;
      const btn =
        c == null
          ? `<button class="buy max" type="button" disabled>Maxed</button>`
          : `<button class="buy${ok ? ' can' : ''}" type="button" data-heir="${def.id}" ${ok ? '' : 'disabled'} aria-label="Buy ${def.name} for ${c} Grit">${c} Grit</button>`;
      return `<div class="row"><div class="r-name">${def.name} ${pips}</div><div class="r-fx">${def.line(lvl)}</div><div class="r-btn">${btn}</div></div>`;
    }).join('');
  }
  function renderCard() {
    if (mode !== 'idle' || (!el.modal.hidden && farm.pendingPerks)) {
      el.overlay.innerHTML = '';
      return;
    }
    if (window.__odCard) {
      el.overlay.innerHTML = window.__odCard();
      return;
    }
    const st = billStatus(),
      b = st.b;
    let title, body, btn;
    const startBtn = `<button class="btn" type="button" data-act="start">Start day ${farm.day}</button>`;
    if (st.tonight && farm.cash < b.amt) {
      title = 'The bank comes tonight.';
      body = `You're ${fmt$(Math.ceil(b.amt - farm.cash))} short on the ${lc(b.name)}. Grumble &amp; Sons will take the farm. You keep your heirlooms and earn Grit.`;
      btn = `<button class="btn money" type="button" data-act="bank">Face the bank</button>`;
    } else if (st.tonight) {
      title = 'Pay before you sleep.';
      body = `The ${lc(b.name)} is due tonight, and you have the money.`;
      btn = `<button class="btn money" type="button" data-act="pay">Pay ${fmt$(b.amt)}</button>`;
    } else if (!farm.played) {
      title = farm.no === 1 ? 'Harvest before the sun goes down.' : 'A fresh farm. A fresh loan.';
      body = `Sweep your scythe over the crops. Each one sells the moment you cut it. The bank wants ${fmt$(b.amt)} by sunset on day ${farm.due}.`;
      btn = startBtn;
    } else {
      title = `Yesterday: ${farm.lastCount} ${farm.lastCount === 1 ? 'crop' : 'crops'}, ${fmt$(farm.lastEarn)}.`;
      body =
        st.left === 1
          ? `The ${lc(b.name)} (${fmt$(b.amt)}) is due at sunset tomorrow.`
          : `The ${lc(b.name)} (${fmt$(b.amt)}) is due in ${st.left} days.`;
      btn = startBtn;
    }
    rollDailyEvent();
    const foot = `📰 COUNTY GAZETTE: ${dailyEvent.title} — ${dailyEvent.desc} (Hold click/Space for Charge Cleave!)`;
    el.overlay.innerHTML = `<div class="card"><p class="eyebrow">${curBiome().city} · Farm No. ${farm.no} · Day ${farm.day}</p><h2 class="ctitle">${title}</h2><p class="cbody">${body}</p><div class="cact">${btn}<button class="chipbtn" type="button" data-act="map">🌍 World Map</button><button class="chipbtn" type="button" data-act="skills">💎 Skill Tree</button><button class="chipbtn" type="button" data-act="veggies" style="background:#fef9c3;border-color:#eab308;color:#78350f;font-weight:700">⚜️🍁 France & Canada Trio Code</button><button class="chipbtn" type="button" data-act="arthur">🎩 Inspect Arthur</button></div><p class="cfoot">${foot}</p></div>`;
  }
  function updateHud() {
    setText(el.hCash, fmt$(farm.cash));
    syncPause();
    if (mode !== 'day' && mode !== 'dusk') return;
    const amt = billObj(farm.bill).amt,
      pct = FarmScene_clamp(farm.cash / amt, 0, 1),
      nCash = $('#nCash');
    if (nCash) {
      setText(nCash, `Cash on hand ${fmt$(farm.cash)}`);
      setText($('#nPct'), `${Math.round(pct * 100)}%`);
      $('#nBar').style.width = (pct * 100).toFixed(1) + '%';
      $('#nMeter').classList.toggle('full', farm.cash >= amt);
    }
    setText(el.hudEarn, fmt$(today.earned));
    el.dlFill.style.transform = `scaleX(${FarmScene_clamp(time / dayLen, 0, 1)})`;
    setText(el.dlText, time.toFixed(1) + ' s');
    el.hudLight.classList.toggle('low', mode === 'day' && time < 3);
    setText(el.hudCombo, combo >= 2 ? `${combo} crop chain` : 'Sweep. Chain. Cash in.');
    const optionalText = (id, value) => {
      const node = $('#' + id);
      if (node) setText(node, value);
    };
    optionalText('multiplierValue', '×' + incomeMultiplier());
    optionalText('chainCount', combo ? `${combo} in a row` : 'Keep harvesting');
    optionalText('rushLabel', rushTimer > 0 ? `RUSH · ${rushTimer.toFixed(1)}s` : `${rushCharge}/${RUSH_GOAL} TO RUSH`);
    optionalText(
      'eventLabel',
      rushTimer > 0
        ? 'HARVEST RUSH · ×1.5 INCOME'
        : dailyEvent
          ? `${dailyEvent.title} · Hold click/Space to Cleave`
          : 'Lucky crops sparkle · ×2 value',
    );
    optionalText('bestChain', String(today.best));
    const chainBar = $('#chainFill'),
      rushBar = $('#rushFill');
    if (chainBar) chainBar.style.transform = `scaleX(${FarmScene_clamp(comboTimer / cur.chainGrace, 0, 1)})`;
    if (rushBar)
      rushBar.style.transform = `scaleX(${rushTimer > 0 ? rushTimer / RUSH_DURATION : rushCharge / RUSH_GOAL})`;
    stage.classList.toggle('rushing', rushTimer > 0 && mode === 'day');
  }
  /* actions */ function payBill() {
    if (mode !== 'idle' || farm.pendingPerks || !el.modal.hidden) return;
    const b = billObj(farm.bill);
    if (farm.cash < b.amt) return;
    Sound.init();
    Sound.stamp();
    farm.cash -= b.amt;
    farm.paidTotal += b.amt;
    farm.billsPaid += 1;
    arthurAngerTimer = 3.0;
    if (farm.billsPaid % 2 === 0) {
      meta.diamonds = (meta.diamonds || 0) + 1;
      toast('Bill milestone! Earned +1 💎 Diamond for the Skill Tree!', 3200);
    }
    if (farm.bill === FarmScene_BILLS.length - 1) {
      win();
      return;
    }
    farm.bill += 1;
    farm.due = farm.day - 1 + FarmScene_BILLS[farm.bill].days;
    const pool = shuffle(
      FarmScene_PERKS.filter((p) => (!p.req || p.req(farm)) && (!p.once || !farm.perks.includes(p.id))).map(
        (p) => p.id,
      ),
    );
    farm.pendingPerks = pool.slice(0, 3);
    cur = stats();
    fillIdle();
    save();
    renderAll();
    openPerkModal();
  }
  function openPerkModal() {
    const paid = billObj(farm.bill - 1),
      nextB = billObj(farm.bill),
      unlock = UNLOCKS[farm.billsPaid];
    openModal(
      `<div class="mtop"><p class="eyebrow">Notice ${farm.bill} of ${FarmScene_BILLS.length} · ${paid.name}</p><span class="stamp ok pop">Paid</span></div>` +
        `<h3 class="mtitle" id="mTitle">Bill paid. Pick a perk for this farm.</h3>` +
        `<div class="perkgrid">${farm.pendingPerks
          .map((id) => {
            const p = FarmScene_PERKS.find((x) => x.id === id);
            return `<button class="perkcard" type="button" data-perk="${p.id}"><span class="pn">${p.name}</span><span class="pl">${p.line}</span></button>`;
          })
          .join('')}</div>` +
        (unlock ? `<p class="unlock"><strong>New on the farm:</strong> ${unlock}</p>` : '') +
        `<p class="hint" style="margin-top:12px">A little less debt. A little more freedom. Next up: ${lc(nextB.name)}, ${fmt$(nextB.amt)}, due at sunset on day ${farm.due}.</p>`,
    );
  }
  function choosePerk(id) {
    if (!farm.pendingPerks || !farm.pendingPerks.includes(id)) return;
    farm.perks.push(id);
    farm.pendingPerks = null;
    closeModal();
    cur = stats();
    Sound.click();
    save();
    renderAll();
    const p = FarmScene_PERKS.find((x) => x.id === id);
    toast(`${p.name}. ${p.line}`);
  }
  function buyShed(id) {
    if (mode !== 'idle' || farm.pendingPerks || !el.modal.hidden) return;
    const def = FarmScene_SHED.find((d) => d.id === id),
      c = shedCost(def, farm.shed[id]);
    if (c == null || farm.cash < c || guardTonight(c)) return;
    farm.cash -= c;
    farm.shed[id] += 1;
    cur = stats();
    Sound.click();
    save();
    renderAll();
  }
  function buyHeir(id) {
    if (mode !== 'idle' || farm.pendingPerks || !el.modal.hidden) return;
    const def = FarmScene_HEIRS.find((d) => d.id === id),
      c = heirCost(def, meta.heir[id]);
    if (c == null || meta.grit < c) return;
    meta.grit -= c;
    meta.heir[id] += 1;
    if (id === 'almanac' && !farm.played && farm.billsPaid === 0)
      farm.cash = Math.max(farm.cash, FarmScene_ALMANAC[meta.heir.almanac]);
    cur = stats();
    Sound.click();
    save();
    renderAll();
  }
  function foreclose() {
    if (
      mode !== 'idle' ||
      farm.pendingPerks ||
      !el.modal.hidden ||
      !billStatus().tonight ||
      farm.cash >= billObj(farm.bill).amt
    )
      return;
    const old = farm,
      b = billObj(old.bill),
      short = Math.ceil(b.amt - old.cash),
      g = gritFor(old);
    meta.grit += g.total;
    meta.lost += 1;
    meta.best = Math.max(meta.best, old.billsPaid);
    farm = newFarm();
    cur = stats();
    mode = 'idle';
    goat = null;
    fillIdle();
    lastStampKey = '';
    save();
    renderAll();
    Sound.sad();
    openModal(
      `<div class="letter"><p class="eyebrow">Grumble &amp; Sons Savings &amp; Loan</p>` +
        `<h3 class="mtitle" id="mTitle">The bank took the farm.</h3>` +
        `<p>Dear farmer,</p><p>Regarding your ${lc(b.name)}: you were ${fmt$(short)} short. The farm, the tractor and the goat now belong to us. The goat is already a problem.</p>` +
        `<p>You keep your heirlooms and your Grit.</p><p class="sig">A. Grumble, Junior Loan Officer</p></div>` +
        `<dl class="tally"><div><dt>Days survived</dt><dd>${old.day - 1}</dd></div><div><dt>Bills paid</dt><dd>${old.billsPaid} of ${FarmScene_BILLS.length}</dd></div><div><dt>Paid to the bank</dt><dd>${fmt$(old.paidTotal)}</dd></div></dl>` +
        `<p class="gritline">Grit earned: <b>${g.total}</b> <span>(${g.a} from payments, ${g.b} for bills, ${g.c} for days, ${g.d} from saved cash)</span></p>` +
        `<div class="mact"><button class="btn" type="button" data-close>Start farm No. ${farm.no}</button></div>`,
    );
  }
  function win() {
    if (farm.bill !== FarmScene_BILLS.length - 1 || farm.billsPaid !== FarmScene_BILLS.length) return;
    const old = farm,
      g = gritFor(old),
      bonus = 25;
    meta.grit += g.total + bonus;
    meta.owned += 1;
    meta.best = FarmScene_BILLS.length;
    if (!meta.cityOwned) meta.cityOwned = {};
    meta.cityOwned[curCity().id] = true;
    meta.diamonds = (meta.diamonds || 0) + 2;
    sceneryKey = '';
    buildFieldLayer();
    farm = newFarm();
    cur = stats();
    mode = 'idle';
    goat = null;
    fillIdle();
    lastStampKey = '';
    save();
    renderAll();
    Sound.fanfare();
    openModal(
      `<div class="letter"><div class="mtop"><p class="eyebrow">Grumble &amp; Sons Savings &amp; Loan</p><span class="stamp ok pop">Paid in full</span></div>` +
        `<h3 class="mtitle" id="mTitle">The farm is yours.</h3>` +
        `<p>Dear former customer,</p><p>Enclosed is the deed. We are, frankly, upset. The scarecrow sends his regards and has withdrawn his lawsuit.</p><p class="sig">A. Grumble, Junior Loan Officer</p></div>` +
        `<dl class="tally"><div><dt>Days</dt><dd>${old.day - 1}</dd></div><div><dt>Crops cut</dt><dd>${old.harvested.toLocaleString('en-US')}</dd></div><div><dt>Earned</dt><dd>${fmt$(old.earned)}</dd></div></dl>` +
        `<p class="gritline">Grit earned: <b>${g.total + bonus}</b> <span>(including ${bonus} for owning the farm outright)</span></p>` +
        `<div class="mact"><button class="btn" type="button" data-close>Buy another run-down farm</button></div>`,
    );
  }
  let atlasView = 'world'; // 'world' | 'country'
  let atlasCountryCode = 'CA';
  let atlasCityId = 'ca_toronto';
  let selectedSkillId = 'core_awakening';
  let treeZoom = 1.0,
    treePanX = 0,
    treePanY = 0;
  let arthurStudioTimer = 0,
    arthurStudioState = 'demand';
  function openWorldMapModal(viewMode, cCode) {
    if (mode === 'day') setPaused(true);
    atlasView = viewMode || 'world';
    atlasCountryCode = cCode || meta.country || 'CA';
    const cObj = GEO.countries[atlasCountryCode] || GEO.countries.CA;
    if (!cObj.cities.some((ct) => ct.id === atlasCityId))
      atlasCityId = meta.country === atlasCountryCode && meta.cityId ? meta.cityId : cObj.cities[0].id;
    const selCity = cObj.cities.find((ct) => ct.id === atlasCityId) || cObj.cities[0];
    let svgHtml = '';
    let inspectorHtml = '';
    if (atlasView === 'world') {
      // WORLD MAP VIEW (viewBox 0 0 1000 500)
      const gridLines = [];
      for (let gx = 100; gx < 1000; gx += 100)
        gridLines.push(
          `<line x1="${gx}" y1="0" x2="${gx}" y2="500" stroke="rgba(30,58,138,0.10)" stroke-dasharray="4 4"/>`,
        );
      for (let gy = 100; gy < 500; gy += 100)
        gridLines.push(
          `<line x1="0" y1="${gy}" x2="1000" y2="${gy}" stroke="rgba(30,58,138,0.10)" stroke-dasharray="4 4"/>`,
        );
      const lockedPaths = GEO.lockedCountries
        .map(
          (lc) => `<g class="locked-group" data-locked-country="${lc.name}">
        <path class="country-locked" d="${lc.path}"><title>${lc.name} (Coming Soon)</title></path>
        <text x="${lc.labelX}" y="${lc.labelY}" text-anchor="middle" font-size="9" font-family="Courier Prime, monospace" fill="#475569" pointer-events="none">${lc.name}</text>
      </g>`,
        )
        .join('');
      const playablePaths = Object.values(GEO.countries)
        .map((pc) => {
          const isSel = pc.code === atlasCountryCode;
          const ownedCnt = pc.cities.filter((ct) => ownsCity(ct.id)).length;
          return `<g class="playable-country-group" data-open-country="${pc.code}">
        <path class="country-playable${isSel ? ' selected' : ''}" d="${pc.worldPath}"/>
        <rect x="${pc.worldLabelX - 46}" y="${pc.worldLabelY - 12}" width="92" height="22" rx="6" fill="#0f172a" stroke="#facc15" stroke-width="1.3" style="cursor:pointer"/>
        <text x="${pc.worldLabelX}" y="${pc.worldLabelY + 2}" text-anchor="middle" font-size="10.5" font-weight="700" font-family="Figtree, sans-serif" fill="#fef08a" pointer-events="none">${pc.flag} ${pc.name} (${ownedCnt}/${pc.cities.length})</text>
      </g>`;
        })
        .join('');
      svgHtml = `<svg class="atlas-svg" viewBox="0 0 1000 500" aria-label="Geographical World Map">
      ${gridLines.join('')}
      ${lockedPaths}
      ${playablePaths}
    </svg>`;
      inspectorHtml = `<div class="atlas-inspector">
      <div class="atlas-info">
        <h4>🌍 World Agricultural Atlas · Click Any Highlighted Country</h4>
        <p>Select a playable country on the geographical world map (<strong>Canada</strong>, <strong>Brazil</strong>, <strong>France</strong>, or <strong>Japan</strong>) to inspect its regional map and cities. Grey countries are marked Coming Soon.</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${Object.values(GEO.countries)
          .map(
            (pc) =>
              `<button class="chipbtn" type="button" data-open-country="${pc.code}">${pc.flag} ${pc.name} →</button>`,
          )
          .join('')}
      </div>
    </div>`;
    } else {
      // COUNTRY DETAIL VIEW (viewBox 0 0 800 520) with geographically positioned cities!
      const featHtml = (cObj.geographicFeatures || [])
        .map((f) => {
          if (f.type === 'water')
            return `<path d="${f.path}" fill="#93c5fd" stroke="#3b82f6" stroke-width="1.2" opacity="0.85"/>${f.lx ? `<text x="${f.lx}" y="${f.ly}" text-anchor="middle" font-size="10" font-weight="700" fill="#1e3a8a" font-family="Courier Prime, monospace">${f.name}</text>` : ''}`;
          if (f.type === 'river')
            return `<path d="${f.path}" fill="none" stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round"/>`;
          return `<path d="${f.path}" fill="none" stroke="#64748b" stroke-width="3" stroke-dasharray="5 5"/>`;
        })
        .join('');
      const cityPins = cObj.cities
        .map((ct) => {
          const isCur = ct.id === selCity.id;
          const isOwned = ownsCity(ct.id);
          const pinCol = isCur ? '#ef4444' : isOwned ? '#eab308' : '#16a34a';
          return `<g class="city-pin" data-pick-city="${ct.id}" transform="translate(${ct.x},${ct.y})">
        <circle class="pin-outer" cx="0" cy="0" r="${isCur ? 11 : 8}" fill="${pinCol}" stroke="#ffffff" stroke-width="2.2"/>
        <circle cx="0" cy="0" r="3.2" fill="#ffffff"/>
        <rect x="-68" y="-30" width="136" height="18" rx="5" fill="${isCur ? '#1e293b' : 'rgba(255,253,242,0.92)'}" stroke="${pinCol}" stroke-width="1.2"/>
        <text x="0" y="-18" text-anchor="middle" font-size="10" font-weight="700" font-family="Figtree, sans-serif" fill="${isCur ? '#fde047' : '#0f172a'}">${isOwned ? '👑 ' : ''}${ct.name}</text>
      </g>`;
        })
        .join('');
      svgHtml = `<svg class="atlas-svg" viewBox="0 0 800 520" aria-label="${cObj.name} Regional Map">
      <path d="${cObj.countryOutline}" fill="#dcfce7" stroke="#15803d" stroke-width="3" stroke-linejoin="round"/>
      ${featHtml}
      ${cityPins}
    </svg>`;
      const bestRec = (meta.cityRecords && meta.cityRecords[selCity.id]) || 0;
      const isOwned = ownsCity(selCity.id);
      const cropBadges = (selCity.crops || [])
        .map((ck) => `<span class="crop-badge">${CROP[ck] ? CROP[ck].name : ck}</span>`)
        .join('');
      inspectorHtml = `<div class="atlas-inspector">
      <div class="atlas-info">
        <h4>${cObj.flag} ${selCity.name} <small style="font-size:12px;color:#64748b">(${selCity.province} · Bills ×${selCity.mul})</small></h4>
        <p>${selCity.desc}</p>
        <p style="font-family:var(--font-type);font-size:11px;color:#0f172a">
          <strong>${isOwned ? '👑 DEED OWNED BY YOU' : `Rival Holder: ${selCity.rival} (Record: $${selCity.record}/day)`}</strong>
          · Your Best: $${bestRec}/day · Regional Tribute: <span style="color:#15803d">${selCity.buff}</span>
        </p>
        <div class="crop-badges">${cropBadges}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
        <button class="btn" type="button" data-enter-city="${selCity.id}" ${mode !== 'idle' ? 'disabled' : ''}>Enter ${selCity.name} Farm →</button>
        <button class="chipbtn" type="button" data-back-world="1">← Back to World Map</button>
      </div>
    </div>`;
    }
    lastFocus = document.activeElement;
    el.modal.innerHTML = `<div class="sheet atlas-sheet" role="dialog" aria-modal="true" aria-labelledby="mTitle">
    <div class="mtop">
      <div>
        <p class="eyebrow">${atlasView === 'world' ? 'GLOBAL AGRICULTURAL ATLAS · STEP 1 OF 2' : `${cObj.flag} ${cObj.name.toUpperCase()} REGIONAL MAP · STEP 2 OF 2`}</p>
        <h3 class="mtitle" id="mTitle" style="margin:2px 0 8px">${atlasView === 'world' ? 'Select a Country on the World Map' : `${cObj.name} — Select a City & Agricultural Region`}</h3>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${atlasView === 'country' ? `<button class="chipbtn" type="button" data-back-world="1">🌍 ← World Map</button>` : ''}
        <button class="chipbtn" type="button" data-close>Close</button>
      </div>
    </div>
    <div class="atlas-Viewport">${svgHtml}</div>
    ${inspectorHtml}
  </div>`;
    el.modal.hidden = false;
    renderCard();
  }
  function openSkillTreeModal() {
    if (mode === 'day') setPaused(true);
    const selNode = SKILL_NODES.find((n) => n.id === selectedSkillId) || SKILL_NODES[0];
    const nodeMap = {};
    SKILL_NODES.forEach((n) => (nodeMap[n.id] = n)); // Build directed edges between prerequisite nodes and child nodes
    const edgesSvg = [];
    for (const n of SKILL_NODES) {
      for (const reqId of n.reqs || []) {
        const pNode = nodeMap[reqId];
        if (!pNode) continue;
        const bothLearned = hasSkill(n.id) && hasSkill(reqId);
        const avail = hasSkill(reqId) && !hasSkill(n.id);
        const stroke = bothLearned ? '#facc15' : avail ? '#38bdf8' : 'rgba(148,163,184,0.28)';
        const sw = bothLearned ? 3.5 : avail ? 2.5 : 1.8;
        const dash = avail ? 'stroke-dasharray="6 5"' : '';
        const mx = (pNode.x + n.x) * 0.5,
          my = (pNode.y + n.y) * 0.5 - 14;
        edgesSvg.push(
          `<path d="M ${pNode.x},${pNode.y} Q ${mx},${my} ${n.x},${n.y}" fill="none" stroke="${stroke}" stroke-width="${sw}" ${dash}/>`,
        );
      }
    }
    const branchColors = { core: '#fde047', reap: '#f87171', soil: '#4ade80', gold: '#fbbf24' };
    const nodesSvg = SKILL_NODES.map((n) => {
      const learned = hasSkill(n.id);
      const avail = !learned && skillPrereqsMet(n);
      const isSel = n.id === selNode.id;
      const bCol = branchColors[n.branch] || '#fde047';
      const fill = learned ? '#facc15' : avail ? '#0f172a' : '#1e293b';
      const stroke = isSel ? '#ffffff' : learned ? '#fef08a' : avail ? '#38bdf8' : '#475569';
      const textCol = learned ? '#0f172a' : '#f8fafc';
      return `<g class="tree-node-g" data-select-skill="${n.id}" transform="translate(${n.x},${n.y})" style="cursor:pointer">
      ${isSel ? `<circle cx="0" cy="0" r="34" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-dasharray="4 4"/>` : ''}
      <circle cx="0" cy="0" r="26" fill="${fill}" stroke="${stroke}" stroke-width="${isSel ? 3.2 : 2.2}"/>
      <text x="0" y="5" text-anchor="middle" font-size="18" fill="${textCol}" pointer-events="none">${n.icon}</text>
      <rect x="-64" y="29" width="128" height="17" rx="4" fill="rgba(6,14,12,0.88)" stroke="${bCol}" stroke-width="0.9"/>
      <text x="0" y="40" text-anchor="middle" font-size="9.5" font-weight="700" font-family="Figtree, sans-serif" fill="${learned ? '#fde047' : '#e2e8f0'}" pointer-events="none">${n.name} ${learned ? '✓' : ''}</text>
    </g>`;
    }).join('');
    const selLearned = hasSkill(selNode.id);
    const selAvail = !selLearned && skillPrereqsMet(selNode);
    const canAfford = selAvail && (meta.diamonds || 0) >= 1 && mode === 'idle';
    const reqNames = (selNode.reqs || []).map((rid) => {
      const rn = nodeMap[rid];
      const ok = hasSkill(rid);
      return `${rn ? rn.name : rid} (${ok ? '✓ Learned' : 'Locked'})`;
    });
    const reqLabel = !reqNames.length
      ? 'Prerequisites: None (Root Node)'
      : `Prerequisites (${selNode.reqMode === 'any' ? 'Either path' : 'Required'}): ${reqNames.join(selNode.reqMode === 'any' ? ' OR ' : ', ')}`;
    lastFocus = document.activeElement;
    el.modal.innerHTML = `<div class="sheet tree-sheet" role="dialog" aria-modal="true" aria-labelledby="mTitle">
    <div class="mtop">
      <div>
        <p class="eyebrow">SPATIAL SKILL CODEX · 1 💎 DIAMOND PER NODE (GRIT UNCHANGED: ${meta.grit} GRIT)</p>
        <h3 class="mtitle" id="mTitle" style="color:#fde047;margin:2px 0 6px">The Harvester's Branching Skill Tree</h3>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <span class="stamp ok" style="color:#38bdf8;border-color:#38bdf8">💎 ${meta.diamonds || 0} Diamonds</span>
        <button class="chipbtn" type="button" data-close>Close</button>
      </div>
    </div>
    <div class="tree-viewport" id="treeViewport">
      <div class="tree-controls">
        <button type="button" data-tree-zoom="in">Zoom +</button>
        <button type="button" data-tree-zoom="out">Zoom −</button>
        <button type="button" data-tree-zoom="reset">Reset View</button>
      </div>
      <svg id="treeSvg" class="atlas-svg" viewBox="${200 - treePanX} ${60 - treePanY} ${Math.round(600 / treeZoom)} ${Math.round(460 / treeZoom)}" aria-label="Branching Skill Tree">
        <text x="160" y="55" font-size="13" font-weight="800" fill="#fca5a5" font-family="Big Shoulders Stencil, sans-serif">I · WAY OF THE REAP (SPEED / CLEAVE)</text>
        <text x="515" y="28" font-size="13" font-weight="800" fill="#86efac" font-family="Big Shoulders Stencil, sans-serif">II · WAY OF THE SOIL (ABUNDANCE / SOLSTICE)</text>
        <text x="615" y="565" font-size="13" font-weight="800" fill="#fde047" font-family="Big Shoulders Stencil, sans-serif">III · WAY OF FORTUNE (COUNSEL / HERD)</text>
        ${edgesSvg.join('')}
        ${nodesSvg}
      </svg>
    </div>
    <div class="tree-inspector">
      <div style="flex:1;min-width:240px">
        <h4>${selNode.icon} ${selNode.name} <small style="font-size:13px;color:#38bdf8">· Cost: 1 💎 Diamond</small></h4>
        <p>${selNode.desc}</p>
        <p class="tree-reqline">${reqLabel} · <em>Earn Diamonds every 2nd bill paid (+1 💎), by beating a City Rival (+1 💎), or paying a Deed (+2 💎).</em></p>
      </div>
      <div>
        <button class="btn" type="button" data-learn-skill="${selNode.id}" ${canAfford ? '' : 'disabled'} style="background:${selLearned ? '#15803d' : '#0284c7'};color:#fff">
          ${selLearned ? 'Learned ✓' : selAvail ? 'Learn Skill (1 💎)' : 'Locked (Needs Prereq)'}
        </button>
      </div>
    </div>
  </div>`;
    el.modal.hidden = false;
    renderCard();
    updateTreeViewBox();
    bindTreeDrag();
  }
  function updateTreeViewBox() {
    const svg = $('#treeSvg');
    if (!svg) return;
    const w = Math.round(1000 / treeZoom),
      h = Math.round(580 / treeZoom);
    const vx = Math.round((1000 - w) * 0.5 - treePanX);
    const vy = Math.round((580 - h) * 0.5 - treePanY);
    svg.setAttribute('viewBox', `${vx} ${vy} ${w} ${h}`);
  }
  function bindTreeDrag() {
    const vp = $('#treeViewport');
    if (!vp) return;
    let dragging = false,
      sx = 0,
      sy = 0;
    vp.onpointerdown = (e) => {
      if (e.target.closest('button') || e.target.closest('.tree-node-g')) return;
      dragging = true;
      sx = e.clientX;
      sy = e.clientY;
      try {
        vp.setPointerCapture(e.pointerId);
      } catch (err) {}
    };
    vp.onpointermove = (e) => {
      if (!dragging) return;
      treePanX += (e.clientX - sx) / treeZoom;
      treePanY += (e.clientY - sy) / treeZoom;
      sx = e.clientX;
      sy = e.clientY;
      updateTreeViewBox();
    };
    vp.onpointerup = () => {
      dragging = false;
    };
  }
  function learnSkillNode(id) {
    if (mode !== 'idle') return;
    const node = SKILL_NODES.find((n) => n.id === id);
    if (!node || hasSkill(id) || !skillPrereqsMet(node)) return;
    if ((meta.diamonds || 0) < 1) return;
    meta.diamonds -= 1; // Spends exactly 1 Diamond; leaves meta.grit 100% unchanged!
    if (!Array.isArray(meta.learnedSkills)) meta.learnedSkills = [];
    meta.learnedSkills.push(id);
    cur = stats();
    Sound.init();
    Sound.fanfare();
    save();
    renderAll();
    openSkillTreeModal();
    toast(`Learned ${node.name} (−1 💎 Diamond, Grit unchanged)!`);
  }
  function openArthurStudioModal(stateOverride) {
    if (mode === 'day') setPaused(true);
    if (stateOverride) arthurStudioState = stateOverride;
    const states = [
      ['idle', '1. Idle (Watch Check)'],
      ['smug', '2. Smug Anticipation'],
      ['demand', '3. Demanding Payment'],
      ['anger', '4. Furious Anger'],
      ['shock', '5. Shocked Defeat'],
    ];
    lastFocus = document.activeElement;
    el.modal.innerHTML = `<div class="sheet atlas-sheet" role="dialog" aria-modal="true" aria-labelledby="mTitle">
    <div class="mtop">
      <div>
        <p class="eyebrow">AUTHORED CHARACTER &amp; SKELETAL RIG SHOWCASE</p>
        <h3 class="mtitle" id="mTitle" style="margin:2px 0 6px">Arthur Grumble — Gameplay Size (1×) &amp; Enlarged (3.6×)</h3>
      </div>
      <button class="chipbtn" type="button" data-close>Close Studio</button>
    </div>
    <canvas id="arthurStudioCanvas" class="arthur-studio-canvas" width="840" height="320"></canvas>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;justify-content:space-between;align-items:center">
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${states.map(([stKey, label]) => `<button class="chipbtn" type="button" data-arthur-state="${stKey}" style="${arthurStudioState === stKey ? 'background:#1e293b;color:#fde047;border-color:#1e293b' : ''}">${label}</button>`).join('')}
      </div>
      <span style="font-family:var(--font-type);font-size:11px;color:#475569">Sculpted jowls · Articulated jaw &amp; 4-fingered hands · Coat-tail physics</span>
    </div>
  </div>`;
    el.modal.hidden = false;
    renderCard();
    startArthurStudioLoop();
  }
  function startArthurStudioLoop() {
    cancelAnimationFrame(arthurStudioTimer);
    const c = $('#arthurStudioCanvas');
    if (!c || el.modal.hidden) return;
    const g = c.getContext('2d');
    const step = (now) => {
      if (!document.body.contains(c) || el.modal.hidden) return;
      const t = now / 1000;
      g.clearRect(0, 0, c.width, c.height); // Background studio comparison labels (placed to the left of the enlarged rig so his top hat never overlaps!)
      g.fillStyle = 'rgba(15, 23, 42, 0.68)';
      g.fillRect(24, 16, 225, 26);
      g.fillRect(275, 16, 240, 44);
      g.fillStyle = '#fef08a';
      g.font = 'bold 11.5px "Courier Prime", monospace';
      g.fillText('GAMEPLAY SCALE (1.0×)', 36, 33);
      g.fillText('ENLARGED AUTHORED RIG (3.2×)', 287, 33);
      g.fillStyle = '#38bdf8';
      g.fillText(`STATE: ${arthurStudioState.toUpperCase()}`, 287, 50); // Fence reference line behind 1x Arthur
      g.strokeStyle = '#785638';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(40, 235);
      g.lineTo(220, 235);
      g.stroke();
      const phaserScene = window.__PHASER_FARM_SCENE;
      if (phaserScene && phaserScene.textures.exists('arthur')) {
        const frameIdx = Math.floor(t * (arthurStudioState === 'anger' ? 14 : 10)) % 6;
        const frameName = `${arthurStudioState}_${frameIdx}`;
        const tex = phaserScene.textures.get('arthur');
        const fData = tex.frames[frameName] || tex.frames['idle_0'];
        if (fData) {
          const { x: sx, y: sy, w: sw, h: sh } = fData.frame; // 1. Normal gameplay size (0.27x = 86x113 px)
          const norm = 320 / sw;
          const gw = sw * 0.27 * norm,
            gh = sh * 0.27 * norm;
          g.drawImage(tex.source, sx, sy, sw, sh, 130 - gw * 0.5, 255 - gh * 0.95, gw, gh); // 2. Enlarged 0.74x inspection size (237x311 px — 2.75x gameplay size!)
          const ew = sw * 0.74 * norm,
            eh = sh * 0.74 * norm;
          g.drawImage(tex.source, sx, sy, sw, sh, 635 - ew * 0.5, 312 - eh * 0.95, ew, eh);
        }
      }
      arthurStudioTimer = requestAnimationFrame(step);
    };
    arthurStudioTimer = requestAnimationFrame(step);
  }
  let veggieStudioTimer = 0;
  let veggieStudioFilter = 'CN'; // Default to 'CN' (China Trio)! Also supports 'MA' | 'US' | 'JP' | 'FR' | 'CA' | 'ALL'
  let veggieStudioAnimMode = 'live'; // Default to 'live' (Continuous 60fps Animated + 4th Live Action Cycle Column!)
  let veggieStudioSelected = 'bittermelon';
  let veggieStudioShowRef = true;
  let veggieStudioShowCode = false;
  let veggieStudioCodeScope = 'cn_all';
  let veggieStudioClickHitAt = 0; // Timestamp when user clicked on a studio canvas to trigger manual On-Hit Gag!
  function getClaudeCodeSnippet(scope) {
    const cnCode = window.DBD_CHINA_TRIO_SOURCE_CODE || '';
    const maCode = window.DBD_MOROCCO_TRIO_SOURCE_CODE || '';
    const usCode = window.DBD_USA_TRIO_SOURCE_CODE || '';
    const jpCode = window.DBD_JAPAN_TRIO_SOURCE_CODE || '';
    const frCode = window.DBD_FRANCE_TRIO_SOURCE_CODE || '';
    const caCode = window.DBD_CANADA_TRIO_SOURCE_CODE || '';
    if (scope === 'cn_all') {
      return (
        `/* ============================================================================
 * DUE BY DUSK — COMPLETE CHINA TRIO VECTOR CHARACTER RENDERER (FOR CLAUDE)
 * Drop into \`src/scenes/FarmScene.ts\` inside \`window.DBD_CROP_RENDERER\`
 * or import as \`DBD_CHINA_TRIO_RENDERER\`.
 *
 * Includes all 3 China Trio characters with continuous 60fps animations:
 *   1. Shaolin Bitter Melon (\`bittermelon\`, r: 26) — Warty Jade Bitter Melon (Shaolin Gong Monk)
 *   2. Sifu Bok Choy (\`bokchoy\`, r: 26) — Crisp Celadon Bok Choy (Kung-Fu Fan Master)
 *   3. Zen Lotus Root (\`lotusroot\`, r: 26) — 7-Hole Pond Lotus Root (Bamboo-Hat Tea Sage)
 *
 * Calls:
 *   DBD_CHINA_TRIO_RENDERER.drawChinaCharacter(ctx, c.type, c.r, state, tNow, px, py, drawMound)
 *   where \`c.type\` is 'bittermelon' | 'bokchoy' | 'lotusroot'
 *   and \`state\` is 'idle' | 'near' | 'gag' (or smooth blend object)
 * ============================================================================ */\n\n` + cnCode
      );
    }
    if (scope === 'bittermelon') {
      const s = cnCode.indexOf('// 1. SHAOLIN BITTER MELON');
      const e = cnCode.indexOf('// 2. SIFU BOK CHOY');
      return s >= 0 && e > s ? cnCode.slice(s, e).trim() : cnCode;
    }
    if (scope === 'bokchoy') {
      const s = cnCode.indexOf('// 2. SIFU BOK CHOY');
      const e = cnCode.indexOf('// 3. ZEN LOTUS ROOT');
      return s >= 0 && e > s ? cnCode.slice(s, e).trim() : cnCode;
    }
    if (scope === 'lotusroot') {
      const s = cnCode.indexOf('// 3. ZEN LOTUS ROOT');
      const e = cnCode.indexOf('// Unified dispatcher');
      return s >= 0 && e > s ? cnCode.slice(s, e).trim() : cnCode;
    }
    if (scope === 'ma_all') {
      return (
        `/* ============================================================================
 * DUE BY DUSK — COMPLETE MOROCCO TRIO VECTOR CHARACTER RENDERER (FOR CLAUDE)
 * Drop into \`src/scenes/FarmScene.ts\` inside \`window.DBD_CROP_RENDERER\`
 * or import as \`DBD_MOROCCO_TRIO_RENDERER\`.
 *
 * Includes all 3 Morocco Trio characters with continuous 60fps animations:
 *   1. Hummus Chickpea (\`chickpea\`, r: 25) — Golden Garbanzo Bean (Marrakech Mint-Tea Host)
 *   2. Zaalouk Eggplant (\`eggplant\`, r: 27) — Royal-Purple Aubergine (Souk Lantern Mystic)
 *   3. Beldi Green Olive (\`olive\`, r: 25) — Pimento-Stuffed Green Olive (Saharan Gnawa Drummer)
 *
 * Calls:
 *   DBD_MOROCCO_TRIO_RENDERER.drawMoroccoCharacter(ctx, c.type, c.r, state, tNow, px, py, drawMound)
 *   where \`c.type\` is 'chickpea' | 'eggplant' | 'olive'
 *   and \`state\` is 'idle' | 'near' | 'gag' (or smooth blend object)
 * ============================================================================ */\n\n` + maCode
      );
    }
    if (scope === 'chickpea') {
      const s = maCode.indexOf('// 1. HUMMUS CHICKPEA');
      const e = maCode.indexOf('// 2. ZAALOUK EGGPLANT');
      return s >= 0 && e > s ? maCode.slice(s, e).trim() : maCode;
    }
    if (scope === 'eggplant') {
      const s = maCode.indexOf('// 2. ZAALOUK EGGPLANT');
      const e = maCode.indexOf('// 3. BELDI GREEN OLIVE');
      return s >= 0 && e > s ? maCode.slice(s, e).trim() : maCode;
    }
    if (scope === 'olive') {
      const s = maCode.indexOf('// 3. BELDI GREEN OLIVE');
      const e = maCode.indexOf('// Unified dispatcher');
      return s >= 0 && e > s ? maCode.slice(s, e).trim() : maCode;
    }
    if (scope === 'us_all') {
      return (
        `/* ============================================================================
 * DUE BY DUSK — COMPLETE USA TRIO VECTOR CHARACTER RENDERER (FOR CLAUDE)
 * ============================================================================ */\n\n` + usCode
      );
    }
    if (scope === 'habanero') {
      const s = usCode.indexOf('// 1. SHERIFF HABANERO');
      const e = usCode.indexOf('// 2. QUARTERBACK SWEETCORN');
      return s >= 0 && e > s ? usCode.slice(s, e).trim() : usCode;
    }
    if (scope === 'sweetcorn') {
      const s = usCode.indexOf('// 2. QUARTERBACK SWEETCORN');
      const e = usCode.indexOf('// 3. SMOKEY BRISKET-ONION');
      return s >= 0 && e > s ? usCode.slice(s, e).trim() : usCode;
    }
    if (scope === 'brisket_onion') {
      const s = usCode.indexOf('// 3. SMOKEY BRISKET-ONION');
      const e = usCode.indexOf('// Unified Dispatcher');
      return s >= 0 && e > s ? usCode.slice(s, e).trim() : usCode;
    }
    if (scope === 'daikon') {
      const s = jpCode.indexOf('// 1. SENSEI DAIKON');
      const e = jpCode.indexOf('// 2. RIKISHI KABOCHA');
      return s >= 0 && e > s ? jpCode.slice(s, e).trim() : jpCode;
    }
    if (scope === 'kabocha') {
      const s = jpCode.indexOf('// 2. RIKISHI KABOCHA');
      const e = jpCode.indexOf('// 3. SHINOBI WASABI');
      return s >= 0 && e > s ? jpCode.slice(s, e).trim() : jpCode;
    }
    if (scope === 'wasabi') {
      const s = jpCode.indexOf('// 3. SHINOBI WASABI');
      const e = jpCode.indexOf('// Unified dispatcher');
      return s >= 0 && e > s ? jpCode.slice(s, e).trim() : jpCode;
    }
    if (scope === 'echalote') {
      const s = frCode.indexOf('// 1. MONSIEUR ÉCHALOTE');
      const e = frCode.indexOf('// 2. CHEVALIER ARTICHAUT');
      return s >= 0 && e > s ? frCode.slice(s, e).trim() : frCode;
    }
    if (scope === 'artichaut') {
      const s = frCode.indexOf('// 2. CHEVALIER ARTICHAUT');
      const e = frCode.indexOf('// 3. DIVA LAVANDE');
      return s >= 0 && e > s ? frCode.slice(s, e).trim() : frCode;
    }
    if (scope === 'lavender') {
      const s = frCode.indexOf('// 3. DIVA LAVANDE');
      const e = frCode.indexOf('// Unified dispatcher');
      return s >= 0 && e > s ? frCode.slice(s, e).trim() : frCode;
    }
    if (scope === 'pei_russet') {
      const s = caCode.indexOf('// 1. HOSER RUSSET');
      const e = caCode.indexOf('// 2. LUMBERJACK FIDDLEHEAD');
      return s >= 0 && e > s ? caCode.slice(s, e).trim() : caCode;
    }
    if (scope === 'fiddlehead') {
      const s = caCode.indexOf('// 2. LUMBERJACK FIDDLEHEAD');
      const e = caCode.indexOf('// 3. MOUNTIE SASKABERRY');
      return s >= 0 && e > s ? caCode.slice(s, e).trim() : caCode;
    }
    if (scope === 'saskaberry') {
      const s = caCode.indexOf('// 3. MOUNTIE SASKABERRY');
      const e = caCode.indexOf('// Unified dispatcher');
      return s >= 0 && e > s ? caCode.slice(s, e).trim() : caCode;
    }
    if (scope === 'jp_all') {
      return (
        `/* ============================================================================
 * DUE BY DUSK — JAPAN TRIO VECTOR CHARACTER RENDERER (FOR CLAUDE)
 * ============================================================================ */\n\n` + jpCode
      );
    }
    if (scope === 'fr_all') {
      return (
        `/* ============================================================================
 * DUE BY DUSK — FRANCE TRIO VECTOR CHARACTER RENDERER (FOR CLAUDE)
 * ============================================================================ */\n\n` + frCode
      );
    }
    if (scope === 'ca_all') {
      return (
        `/* ============================================================================
 * DUE BY DUSK — CANADA TRIO VECTOR CHARACTER RENDERER (FOR CLAUDE)
 * ============================================================================ */\n\n` + caCode
      );
    }
    if (scope === 'all_15' || scope === 'all_12' || scope === 'all_10' || scope === 'all_9' || scope === 'both_all') {
      return (
        `/* ============================================================================
 * DUE BY DUSK — MOROCCO + USA + JAPAN + FRANCE + CANADA TRIO RENDERERS (ALL 15 FOR CLAUDE)
 * ============================================================================ */\n\n` +
        maCode +
        `\n\n` +
        usCode +
        `\n\n` +
        jpCode +
        `\n\n` +
        frCode +
        `\n\n` +
        caCode
      );
    }
    return cnCode;
  }
  function copyTextToClipboard(text, label) {
    let ok = false;
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) {
      ok = false;
    }
    if (!ok && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    const badge = document.getElementById('claudeCopyStatus');
    if (badge) {
      badge.textContent = `✓ Copied ${label} (${text.length.toLocaleString()} chars)! Ready to paste into Claude.`;
      badge.style.background = '#15803d';
      badge.style.color = '#ffffff';
    }
    toast(`Copied ${label} to clipboard! Paste directly into Claude.`, 3600);
  }
  function openVeggieStudioModal(filterOverride, animOverride, selOverride) {
    if (mode === 'day') setPaused(true);
    if (filterOverride) veggieStudioFilter = filterOverride;
    if (animOverride) veggieStudioAnimMode = animOverride;
    if (selOverride) veggieStudioSelected = selOverride;
    const refUri = window.__USA_TRIO_REF_URI || '';
    const maRefs = window.__MOROCCO_TRIO_REF_URIS || {};
    const cnRefs = window.__CHINA_TRIO_REF_URIS || {};
    const allTrioMeta = [
      // 🇨🇳 CHINA TRIO (NEW!)
      {
        id: 'bittermelon',
        country: 'CN',
        flag: '🇨🇳',
        name: '1. Shaolin Bitter Melon',
        sub: 'Warty Jade Bitter Melon · Shaolin Gong Monk',
        r: 26,
        scale: 2.5,
        desc: 'Warty jade-green bitter melon rooted in a sculpted dirt mound with left sprout, wearing a crimson martial-arts headband with fluttering tails and tapping a brass temple gong with a red padded mallet (+ floating ♪ ♫ ding notes & gold sparkles) in Idle; throbbing red anger vein + ! + 2 blue sweat drops + wide eyes + gong held as a defensive shield in Alert; and squashed warty puddle base + airborne headband + flying brass gong (CLANG! CLANG!) + flying mallet (BAM!) + > < wince + spiky "AIYA!" burst in On-Hit Gag.',
      },
      {
        id: 'bokchoy',
        country: 'CN',
        flag: '🇨🇳',
        name: '2. Sifu Bok Choy',
        sub: 'Crisp Celadon Bok Choy · Kung-Fu Fan Master',
        r: 26,
        scale: 2.45,
        desc: 'Plump celadon-white layered bok choy bulb with glossy dark-green spoon leaves, wearing a traditional black-and-red Mandarin skullcap (guapimo) with red button knot, half-lidded serene eyes, hand on hip & waving a crimson folding fan in Idle; tilted cap + glossy blue sweat drop + wide startled eyes + crimson fan held defensively over its mouth in Alert; and 5 splayed spoon leaves + airborne Mandarin cap + tumbling crimson fan + white steam puff + > < wince + spiky "AIYA!" burst in On-Hit Gag.',
      },
      {
        id: 'lotusroot',
        country: 'CN',
        flag: '🇨🇳',
        name: '3. Zen Lotus Root',
        sub: '7-Hole Pond Lotus Root · Bamboo-Hat Tea Sage',
        r: 26,
        scale: 2.45,
        desc: 'Cylindrical warm-tan lotus root segment with 7 circular air-canal holes on its flat top cross-section, wearing a woven conical bamboo hat (douli), relaxed half-lidded zen eyes & sipping hot oolong tea from a blue-and-white porcelain teacup with curling white steam in Idle; tilted bamboo hat + blue sweat drop + wide eyes + clutched teacup in Alert; and airborne bamboo hat exposing all 7 lotus-root holes + white steam jets erupting out of the holes into a cloud + @ @ spinning dizzy spiral eyes + tipping teacup with splashing amber tea droplets + spiky "WAH!" burst in On-Hit Gag.',
      }, // 🇲🇦 MOROCCO TRIO (NEW!)
      {
        id: 'chickpea',
        country: 'MA',
        flag: '🇲🇦',
        name: '1. Hummus Chickpea',
        sub: 'Golden Garbanzo Bean · Marrakech Mint-Tea Host',
        r: 25,
        scale: 2.55,
        desc: 'Plump golden-ochre garbanzo bean in a sculpted Moroccan dirt mound with left sprout & front pebble clod, wearing a crimson-red Fez with swaying black silk tassel and holding an ornate gold Berrad teapot pouring a high animated arc of green mint tea in Idle; wide white shocked eyes + arched brows + gasping mouth + sliding blue sweat drop + clutched teapot in Alert; and creamy multi-lobed hummus mash pile + waving mash arms + `> <` wince + airborne Fez + flung Berrad teapot + mint-tea splashes + spiky "AYWA!" burst in On-Hit Gag.',
      },
      {
        id: 'eggplant',
        country: 'MA',
        flag: '🇲🇦',
        name: '2. Zaalouk Eggplant',
        sub: 'Royal-Purple Aubergine · Souk Lantern Mystic',
        r: 27,
        scale: 2.4,
        desc: 'Tall glossy royal-purple aubergine bulb wearing a conical terracotta clay Tagine lid hat, half-lidded debonair eyes, lush black handlebar mustache (twirled by its left hand) & holding a glowing faceted brass Moroccan Fanous lantern in Idle; wide shocked eyes + furrowed brows + bristling mustache + open gasping mouth + blue sweat drop + clutched lantern in Alert; and airborne Tagine lid + exposed stem stub + 2 billowing white steam clouds + `@ @` spinning dizzy spiral eyes + swinging lantern with gold spark stars + spiky "WAILI!" burst in On-Hit Gag.',
      },
      {
        id: 'olive',
        country: 'MA',
        flag: '🇲🇦',
        name: '3. Beldi Green Olive',
        sub: 'Pimento-Stuffed Green Olive · Saharan Gnawa Drummer',
        r: 25,
        scale: 2.45,
        desc: 'Plump smooth oval Beldi green olive with red pimento crown peeking under a multi-fold royal-blue Saharan Tuareg turban, wearing cool round gold-rimmed sunglasses & rhythmically tapping a wooden Bendir frame drum (with brass zils) in Idle; slipped sunglasses revealing wide panicked eyes + twin blue sweat drops + Bendir drum held as a shield in Alert; and popping cylindrical red pimento cork + airborne blue turban + flying gold sunglasses + bouncing Bendir drum + `> <` wince + spiky "YALLAH!" burst in On-Hit Gag.',
      }, // 🤠 USA TRIO (ALL 3 CHARACTERS)
      {
        id: 'habanero',
        country: 'US',
        flag: '🤠',
        name: '1. Sheriff Habanero',
        sub: 'Texas Habanero Pepper · Wild West Cowboy',
        r: 25,
        scale: 2.28,
        desc: 'Sculpted 3-lobed tapered Texas Habanero pepper in a center-dipped multi-clod dirt mound, wearing a cream cattleman Stetson hat with 6-point gold sheriff star badge, woven red paisley bandana, drooping handlebar mustache & bobbing golden wheat straw in Idle; green stem + throbbing anger cross + sliding sweat drop + chugging cheek steam puffs + silver six-shooter revolver draw in Alert; and crimson-flushed body + flickering yellow-orange flame column + hovering airborne Stetson + spinning rope lasso + spiky "YEE-HAW!" burst in On-Hit Gag.',
      },
      {
        id: 'sweetcorn',
        country: 'US',
        flag: '🏈',
        name: '2. Quarterback Sweetcorn',
        sub: 'Iowa Golden Sweet Corn · Football Linebacker',
        r: 26,
        scale: 2.28,
        desc: 'Sculpted golden sweetcorn cob with individual kernel grid rows & peeled-back green husk shoulder pads, wearing a yellow football helmet with red-white-red center stripe, silver facemask cage, black eye-black grease paint & tucked leather pigskin football in Idle; blitzing linebacker crouch + throbbing anger cross + sliding sweat drop + clenched gritted teeth in Alert; and `> <` wince + exploding fluffy white popcorn puffs + flying golden kernels + spiky "HUT! HUT!" burst in On-Hit Gag.',
      },
      {
        id: 'brisket_onion',
        country: 'US',
        flag: '🍖',
        name: '3. Smokey Brisket-Onion',
        sub: 'Vidalia Sweet Onion · BBQ Pitmaster',
        r: 25,
        scale: 2.28,
        desc: 'Plump golden Vidalia sweet onion bulb wearing a puffy white chef toque hat, cool dark pitmaster sunglasses, red-and-white gingham "KISS THE COOK" apron, clicking stainless-steel BBQ tongs & rising savory smoke curls in Idle; worried brows + twin blue teardrops welling under lowered shades + hand adjusting sunglasses in Alert; and flushed red-orange bulb + tall green onion shoots + gushing cyan waterfall fountains of onion tears + squirting red BBQ hot-sauce bottle + spiky "DAGNABBIT!" burst in On-Hit Gag.',
      }, // 🍁 CANADA TRIO
      {
        id: 'pei_russet',
        country: 'CA',
        flag: '🍁',
        name: '1. Hoser Russet',
        sub: 'PEI Red-Clay Potato · Pro Hockey Enforcer',
        r: 28,
        scale: 3.0,
        desc: 'Tall sculpted russet potato with curved red-white-red hockey sweatband, gap-tooth grin + tapping twig hockey stick in Idle, V-scowl + sweat drop + clenched teeth + cocked twig in Cursor-Near Alert, and > < wince + flying molar tooth + slap-shot dirt clod puck in On-Hit Gag.',
      },
      {
        id: 'fiddlehead',
        country: 'CA',
        flag: '🍁',
        name: '2. Lumberjack Fiddlehead',
        sub: 'New Brunswick Ostrich Fern · Flannel Bushman',
        r: 24,
        scale: 3.1,
        desc: 'True S-curved coiled ostrich fern base & neck with buffalo-plaid trapper hat, sculpted brown beard, flexing coiled bicep arm & cold breath puff in Idle, flared wing earflaps + sweat drop + shiver lines in Alert, and full 4-loop vertical helical spring uncoil + curled left tail in On-Hit Gag.',
      },
      {
        id: 'saskaberry',
        country: 'CA',
        flag: '🍁',
        name: '3. Mountie Saskaberry',
        sub: 'Saskatoon Berry · Polite Royal Mountie',
        r: 24,
        scale: 3.1,
        desc: 'Plump royal-purple Saskatoon berry with tilted Montana-peak tan Stetson hat, whistling mouth & ♪ note in Idle, level low Stetson + stern V-brows + sweat drop in Alert, and airborne popped Stetson (revealing 3-pointed berry calyx crown) + brass pea whistle ("FWEET!") + red "UNLAWFUL HARVEST!" ticket in On-Hit Gag.',
      }, // ⚜️ FRANCE TRIO
      {
        id: 'echalote',
        country: 'FR',
        flag: '⚜️',
        name: '1. Monsieur Échalote',
        sub: 'French Grey Shallot · Snobby Parisian Artist / Mime',
        r: 24,
        scale: 2.9,
        desc: 'Plump coppery-mauve teardrop shallot with tall cut stem tip, tilted black French beret, half-lidded unimpressed eyes, curled handlebar mustache & wooden bubble pipe (+ 4 floating soap bubbles) in Idle; red anger cross + sweat drop + suspicious glare in Alert; and fiery red flush + airborne beret + golden baguette + "SACRÉ BLEU!" bubble in On-Hit Gag.',
      },
      {
        id: 'artichaut',
        country: 'FR',
        flag: '⚜️',
        name: '2. Chevalier Artichaut',
        sub: 'Brittany Globe Artichoke · Pompous Musketeer',
        r: 28,
        scale: 2.75,
        desc: 'Sculpted multi-tier globe artichoke with overlapping pointed green bracts, royal-blue musketeer cavalier hat + white ostrich plume, white handlebar mustache & hands-on-hips in Idle; red anger cross + clenched snarl + bristle lines in Alert; and red-flushed bud crown + airborne hat + 3 flying bracts + silver rapier sword + spiky "MERDE!" bubble in On-Hit Gag.',
      },
      {
        id: 'lavender',
        country: 'FR',
        flag: '⚜️',
        name: '3. Diva Lavande',
        sub: 'Provence Lavender Bundle · Haute-Couture Perfume Snob',
        r: 24,
        scale: 2.75,
        desc: 'Slender minimalist purple lavender sheaf crowned by 5 single-contour scalloped floret spikes, cinched by a French Tricolore flag ribbon bow, wearing oversized white cat-eye sunglasses in Idle; lowered sunglasses + wide offended eyes in Alert; and crimson-magenta flush + airborne sunglasses + purple perfume spritz + spiky "PUTAIN!" bubble in On-Hit Gag.',
      }, // ⛩️ JAPAN TRIO
      {
        id: 'daikon',
        country: 'JP',
        flag: '⛩️',
        name: '1. Sensei Daikon',
        sub: 'Giant White Radish · Karate Master',
        r: 25,
        scale: 2.85,
        desc: 'Sculpted tapered white daikon radish with pale-green crown shoulder, 5-leaf topknot, stern `\\ /` karate sensei brows & black karate belt (`obi`) with gold master stripes in Idle; combat guard crouch + red anger cross + sweat drop + clenched teeth + guard fists in Alert; and crimson-flushed head + `> <` wince + flying karate side-kick + double swoosh arcs + spiky "KIAI!" bubble in On-Hit Gag.',
      },
      {
        id: 'kabocha',
        country: 'JP',
        flag: '⛩️',
        name: '2. Rikishi Kabocha',
        sub: 'Japanese Winter Squash · Sumo Wrestler',
        r: 30,
        scale: 2.75,
        desc: 'Wide multi-lobed ribbed dark-green kabocha squash with glossy black `chonmage` topknot stem (tied with white `motoyui` cord) and ceremonial white-and-red sumo `mawashi` belt in Idle; low `tachiai` charge crouch + red anger cross + sweat drop + clenched teeth + tremor arcs in Alert; and puffed red sumo cheeks + bouncing topknot + `tsuppari` palm thrust + belly-bounce shockwave rings + spiky "DON!" bubble in On-Hit Gag.',
      },
      {
        id: 'wasabi',
        country: 'JP',
        flag: '⛩️',
        name: '3. Shinobi Wasabi',
        sub: 'Mountain Wasabi Root · Stealth Ninja',
        r: 22,
        scale: 3.0,
        desc: 'Knobbly sculpted bright-green mountain wasabi rhizome root wearing a black shinobi cowl & brushed-silver forehead protector (`hachigane`) with fluttering tails and holding a leaf-kunai dagger in Idle; stealth crouch + red anger cross + sweat drop + raised kunai parry guard in Alert; and spicy-red eye-slit flush + billowing green wasabi smoke bomb cloud + spicy lime star sparks + spiky "WASABI!" bubble in On-Hit Gag.',
      },
    ];
    const visibleMeta =
      veggieStudioFilter === 'ALL' ? allTrioMeta : allTrioMeta.filter((m) => m.country === veggieStudioFilter);
    const codeText = getClaudeCodeSnippet(veggieStudioCodeScope);
    const escapedCode = codeText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const sheetsHtml = visibleMeta
      .map(
        (ch) => `
    <div style="background:#fbf7ec;border:2px solid #cbbba0;border-radius:12px;padding:10px 14px;box-shadow:0 3px 10px rgba(0,0,0,0.05)">
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px">
        <div>
          <span style="font-family:var(--font-display);font-size:21px;font-weight:900;color:#2b1708">${ch.flag} ${ch.name}</span>
          <span style="font-size:12px;font-weight:700;color:#57534e;margin-left:6px">(\`${ch.id}\` · ${ch.sub})</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="chipbtn" type="button" data-copy-char="${ch.id}" style="margin:0;min-height:28px;padding:3px 10px;background:#fef3c7;border-color:#d97706;color:#78350f;font-weight:800;font-size:11px">📋 Copy ${ch.name.split('.')[1].trim()} Code</button>
        </div>
      </div>
      <p style="margin:0 0 6px;font-size:11.5px;color:#44403c;line-height:1.35">${ch.desc}</p>
      <div style="background:#f7f2e4;border:1.5px solid #15803d;border-radius:10px;padding:6px;text-align:center">
        <div style="font-size:10.5px;font-family:var(--font-type);font-weight:800;color:#15803d;margin-bottom:2px">
          🎬 CONTINUOUS 60FPS CANVAS 2D ANIMATION + LIVE ACTION STATE-CYCLING STAGE (CLICK ANY POSE TO SMACK!)
        </div>
        <canvas data-trio-sheet="${ch.id}" data-country="${ch.country}" data-r="${ch.r}" data-scale="${ch.scale}" width="1220" height="270" style="width:100%;max-width:1120px;height:auto;display:block;margin:0 auto;cursor:pointer" title="Move cursor over canvas to track eyes, or click to trigger On-Hit Gag!"></canvas>
      </div>
    </div>
  `,
      )
      .join('');
    const refBlockHtml =
      veggieStudioFilter === 'CN' && cnRefs.bittermelon && veggieStudioShowRef
        ? `
    <div style="background:#fbf7ec;border:2px solid #b91c1c;border-radius:12px;padding:10px 14px;margin-top:6px">
      <div style="font-size:11.5px;font-family:var(--font-type);font-weight:800;color:#991b1b;margin-bottom:8px;text-align:center">
        📌 ORIGINAL GENERATED CHINA TRIO 3-POSE REFERENCE SHEETS (Shaolin Bitter Melon · Sifu Bok Choy · Zen Lotus Root)
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">
        <div style="text-align:center">
          <img src="${cnRefs.bittermelon}" alt="Shaolin Bitter Melon Reference Sheet" style="width:100%;height:auto;border-radius:8px;border:1px solid #d6cbb5" />
          <div style="font-size:10.5px;font-weight:800;color:#44403c;margin-top:3px">1. Shaolin Bitter Melon Reference</div>
        </div>
        <div style="text-align:center">
          <img src="${cnRefs.bokchoy}" alt="Sifu Bok Choy Reference Sheet" style="width:100%;height:auto;border-radius:8px;border:1px solid #d6cbb5" />
          <div style="font-size:10.5px;font-weight:800;color:#44403c;margin-top:3px">2. Sifu Bok Choy Reference</div>
        </div>
        <div style="text-align:center">
          <img src="${cnRefs.lotusroot}" alt="Zen Lotus Root Reference Sheet" style="width:100%;height:auto;border-radius:8px;border:1px solid #d6cbb5" />
          <div style="font-size:10.5px;font-weight:800;color:#44403c;margin-top:3px">3. Zen Lotus Root Reference</div>
        </div>
      </div>
    </div>
  `
        : veggieStudioFilter === 'MA' && maRefs.chickpea && veggieStudioShowRef
          ? `
    <div style="background:#fbf7ec;border:2px solid #b91c1c;border-radius:12px;padding:10px 14px;margin-top:6px">
      <div style="font-size:11.5px;font-family:var(--font-type);font-weight:800;color:#991b1b;margin-bottom:8px;text-align:center">
        📌 ORIGINAL GENERATED MOROCCO TRIO 3-POSE REFERENCE SHEETS (Hummus Chickpea · Zaalouk Eggplant · Beldi Green Olive)
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">
        <div style="text-align:center">
          <img src="${maRefs.chickpea}" alt="Hummus Chickpea Reference Sheet" style="width:100%;height:auto;border-radius:8px;border:1px solid #d6cbb5" />
          <div style="font-size:10.5px;font-weight:800;color:#44403c;margin-top:3px">1. Hummus Chickpea Reference</div>
        </div>
        <div style="text-align:center">
          <img src="${maRefs.eggplant}" alt="Zaalouk Eggplant Reference Sheet" style="width:100%;height:auto;border-radius:8px;border:1px solid #d6cbb5" />
          <div style="font-size:10.5px;font-weight:800;color:#44403c;margin-top:3px">2. Zaalouk Eggplant Reference</div>
        </div>
        <div style="text-align:center">
          <img src="${maRefs.olive}" alt="Beldi Green Olive Reference Sheet" style="width:100%;height:auto;border-radius:8px;border:1px solid #d6cbb5" />
          <div style="font-size:10.5px;font-weight:800;color:#44403c;margin-top:3px">3. Beldi Green Olive Reference</div>
        </div>
      </div>
    </div>
  `
          : veggieStudioFilter === 'US' && refUri && veggieStudioShowRef
            ? `
    <div style="background:#fbf7ec;border:2px solid #d97706;border-radius:12px;padding:10px 14px;margin-top:6px">
      <div style="font-size:11.5px;font-family:var(--font-type);font-weight:800;color:#b45309;margin-bottom:6px;text-align:center">
        📌 ORIGINAL UPLOADED USA TRIO REFERENCE SHEET (\`image_7e465b.jpg\` — All 3 Characters for Visual Comparison)
      </div>
      <img src="${refUri}" alt="Original USA Trio Character Sheet Reference" style="width:100%;max-width:960px;height:auto;display:block;margin:0 auto;border-radius:8px;border:1px solid #d6cbb5" />
    </div>
  `
            : '';
    const primaryCopyScope =
      veggieStudioFilter === 'CN'
        ? 'cn_all'
        : veggieStudioFilter === 'MA'
          ? 'ma_all'
          : veggieStudioFilter === 'US'
            ? 'us_all'
            : veggieStudioFilter === 'JP'
              ? 'jp_all'
              : veggieStudioFilter === 'CA'
                ? 'ca_all'
                : veggieStudioFilter === 'ALL'
                  ? 'all_15'
                  : 'fr_all';
    const primaryCopyLabel =
      veggieStudioFilter === 'CN'
        ? '📋 Copy Full China Trio Code for Claude'
        : veggieStudioFilter === 'MA'
          ? '📋 Copy Full Morocco Trio Code for Claude'
          : veggieStudioFilter === 'US'
            ? '📋 Copy Full USA Trio Code for Claude'
            : veggieStudioFilter === 'JP'
              ? '📋 Copy Full Japan Trio Code for Claude'
              : veggieStudioFilter === 'CA'
                ? '📋 Copy Full Canada Trio Code for Claude'
                : veggieStudioFilter === 'ALL'
                  ? '📋 Copy All 18 Characters Code for Claude'
                  : '📋 Copy Full France Trio Code for Claude';
    const playCountry =
      veggieStudioFilter === 'CN'
        ? 'CN'
        : veggieStudioFilter === 'MA'
          ? 'MA'
          : veggieStudioFilter === 'US'
            ? 'US'
            : veggieStudioFilter === 'CA'
              ? 'CA'
              : veggieStudioFilter === 'FR'
                ? 'FR'
                : 'JP';
    const playLabel =
      playCountry === 'CN'
        ? '🇨🇳 Play China Field Live Now →'
        : playCountry === 'MA'
          ? '🇲🇦 Play Morocco Field Live Now →'
          : playCountry === 'US'
            ? '🤠 Play USA Field Live Now →'
            : playCountry === 'CA'
              ? '🌾 Play Canada Field Live →'
              : playCountry === 'FR'
                ? '🌾 Play France Field Live →'
                : '🌾 Play Japan Field Live →';
    const headerTitle =
      veggieStudioFilter === 'CN'
        ? 'China Trio: Shaolin Bitter Melon · Sifu Bok Choy · Zen Lotus Root'
        : veggieStudioFilter === 'MA'
          ? 'Morocco Trio: Hummus Chickpea · Zaalouk Eggplant · Beldi Green Olive'
          : veggieStudioFilter === 'US'
            ? 'USA Trio: Sheriff Habanero · Quarterback Sweetcorn · Smokey Brisket-Onion'
            : veggieStudioFilter === 'JP'
              ? 'Japan Trio: Sensei Daikon · Rikishi Kabocha · Shinobi Wasabi'
              : veggieStudioFilter === 'CA'
                ? 'Canada Trio: Hoser Russet · Lumberjack Fiddlehead · Mountie Saskaberry'
                : veggieStudioFilter === 'ALL'
                  ? 'Morocco + USA + Japan + France + Canada Trios (All 15 Vector Characters)'
                  : 'France Trio: Monsieur Échalote · Chevalier Artichaut · Diva Lavande';
    lastFocus = document.activeElement;
    el.modal.innerHTML = `<div class="sheet atlas-sheet" role="dialog" aria-modal="true" aria-labelledby="mTitle" style="width:min(1140px,100%);max-height:95vh;overflow:auto;background:#f4efe1;border:2px solid #78350f">
    <div class="mtop" style="border-bottom:1.5px solid #d6cbb5;padding-bottom:8px;margin-bottom:10px">
      <div>
        <p class="eyebrow" style="color:#b45309;font-weight:800">🇨🇳🇲🇦🤠⛩️⚜️🍁 DUE BY DUSK · CHINA TRIO &amp; CULTURAL TRIOS VECTOR CODE STUDIO (FOR CLAUDE)</p>
        <h3 class="mtitle" id="mTitle" style="margin:2px 0 2px;font-size:22px;color:#1c1917">${headerTitle}</h3>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <button class="btn money" type="button" data-copy-char="${primaryCopyScope}" style="font-size:14px;padding:7px 14px;margin:0">${primaryCopyLabel}</button>
        <button class="btn" type="button" data-veggie-play-country="${playCountry}" style="font-size:14px;padding:7px 14px;margin:0;background:#15803d">${playLabel}</button>
        <button class="chipbtn" type="button" data-close style="margin:0">Close</button>
      </div>
    </div>

    <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:space-between;align-items:center;margin-bottom:10px;background:#ece4d0;padding:8px 10px;border-radius:10px">
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
        <button class="chipbtn" type="button" data-trio-country="CN" style="margin:0;min-height:32px;padding:4px 11px;font-weight:800;${veggieStudioFilter === 'CN' ? 'background:#b91c1c;color:#fef08a;border-color:#b91c1c' : ''}">🇨🇳 China Trio (3)</button>
        <button class="chipbtn" type="button" data-trio-country="MA" style="margin:0;min-height:32px;padding:4px 11px;font-weight:800;${veggieStudioFilter === 'MA' ? 'background:#991b1b;color:#fef08a;border-color:#991b1b' : ''}">🇲🇦 Morocco Trio (3)</button>
        <button class="chipbtn" type="button" data-trio-country="US" style="margin:0;min-height:32px;padding:4px 11px;font-weight:800;${veggieStudioFilter === 'US' ? 'background:#ea580c;color:#ffffff;border-color:#ea580c' : ''}">🤠 USA Trio (3)</button>
        <button class="chipbtn" type="button" data-trio-country="JP" style="margin:0;min-height:32px;padding:4px 11px;font-weight:800;${veggieStudioFilter === 'JP' ? 'background:#be123c;color:#ffffff;border-color:#be123c' : ''}">⛩️ Japan Trio (3)</button>
        <button class="chipbtn" type="button" data-trio-country="FR" style="margin:0;min-height:32px;padding:4px 11px;font-weight:800;${veggieStudioFilter === 'FR' ? 'background:#1d4ed8;color:#ffffff;border-color:#1d4ed8' : ''}">⚜️ France Trio (3)</button>
        <button class="chipbtn" type="button" data-trio-country="CA" style="margin:0;min-height:32px;padding:4px 11px;font-weight:800;${veggieStudioFilter === 'CA' ? 'background:#b91c1c;color:#ffffff;border-color:#b91c1c' : ''}">🍁 Canada Trio (3)</button>
        <button class="chipbtn" type="button" data-trio-country="ALL" style="margin:0;min-height:32px;padding:4px 11px;font-weight:800;${veggieStudioFilter === 'ALL' ? 'background:#0f172a;color:#fde047;border-color:#0f172a' : ''}">🌎 All 15 Characters</button>
        <span style="color:#a8a29e">|</span>
        <button class="chipbtn" type="button" data-canada-mode="live" style="margin:0;min-height:32px;padding:4px 11px;font-weight:800;${!veggieStudioShowCode && veggieStudioAnimMode === 'live' ? 'background:#1e3a2f;color:#fef08a;border-color:#1e3a2f' : ''}">🎬 Continuous 60fps Animated</button>
        <button class="chipbtn" type="button" data-canada-mode="sheet" style="margin:0;min-height:32px;padding:4px 11px;font-weight:800;${!veggieStudioShowCode && veggieStudioAnimMode === 'sheet' ? 'background:#1e3a2f;color:#fef08a;border-color:#1e3a2f' : ''}">📌 Static Reference Sheet</button>
        <button class="chipbtn" type="button" data-toggle-code="1" style="margin:0;min-height:32px;padding:4px 11px;font-weight:800;${veggieStudioShowCode ? 'background:#b45309;color:#fffbeb;border-color:#b45309' : ''}">💻 ${veggieStudioShowCode ? 'Show Animated Character Sheets' : 'View / Copy Raw Code for Claude'}</button>
      </div>
      <div id="claudeCopyStatus" style="font-family:var(--font-type);font-size:11px;font-weight:700;color:#1e3a2f;padding:4px 10px;border-radius:6px;background:#dcfce7">
        Ready: Click "${primaryCopyLabel.replace('📋 ', '')}" to paste into Claude
      </div>
    </div>

    ${
      veggieStudioShowCode
        ? `
      <div style="background:#0f172a;color:#f8fafc;border-radius:12px;padding:12px;border:2px solid #334155">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            <button class="chipbtn" type="button" data-code-scope="cn_all" style="margin:0;min-height:28px;padding:3px 10px;${veggieStudioCodeScope === 'cn_all' ? 'background:#eab308;color:#0f172a;font-weight:800' : 'background:#1e293b;color:#e2e8f0'}">🇨🇳 Full China Trio (3)</button>
            <button class="chipbtn" type="button" data-code-scope="ma_all" style="margin:0;min-height:28px;padding:3px 10px;${veggieStudioCodeScope === 'ma_all' ? 'background:#eab308;color:#0f172a;font-weight:800' : 'background:#1e293b;color:#e2e8f0'}">🇲🇦 Full Morocco Trio (3)</button>
            <button class="chipbtn" type="button" data-code-scope="us_all" style="margin:0;min-height:28px;padding:3px 10px;${veggieStudioCodeScope === 'us_all' ? 'background:#eab308;color:#0f172a;font-weight:800' : 'background:#1e293b;color:#e2e8f0'}">🤠 Full USA Trio (3)</button>
            <button class="chipbtn" type="button" data-code-scope="ca_all" style="margin:0;min-height:28px;padding:3px 10px;${veggieStudioCodeScope === 'ca_all' ? 'background:#eab308;color:#0f172a;font-weight:800' : 'background:#1e293b;color:#e2e8f0'}">🍁 Full Canada Trio (3)</button>
            <button class="chipbtn" type="button" data-code-scope="fr_all" style="margin:0;min-height:28px;padding:3px 10px;${veggieStudioCodeScope === 'fr_all' ? 'background:#eab308;color:#0f172a;font-weight:800' : 'background:#1e293b;color:#e2e8f0'}">⚜️ Full France Trio (3)</button>
            <button class="chipbtn" type="button" data-code-scope="jp_all" style="margin:0;min-height:28px;padding:3px 10px;${veggieStudioCodeScope === 'jp_all' ? 'background:#eab308;color:#0f172a;font-weight:800' : 'background:#1e293b;color:#e2e8f0'}">⛩️ Full Japan Trio (3)</button>
            <button class="chipbtn" type="button" data-code-scope="all_15" style="margin:0;min-height:28px;padding:3px 10px;${veggieStudioCodeScope === 'all_15' ? 'background:#eab308;color:#0f172a;font-weight:800' : 'background:#1e293b;color:#e2e8f0'}">🌎 All 15 Combined</button>
          </div>
          <button class="btn money" type="button" data-copy-char="${veggieStudioCodeScope}" style="font-size:13px;padding:5px 12px;margin:0">📋 Copy Displayed Code</button>
        </div>
        <pre style="margin:0;max-height:58vh;overflow:auto;font-family:var(--font-type),monospace;font-size:11.5px;line-height:1.42;background:#020617;padding:12px;border-radius:8px;border:1px solid #1e293b;color:#e2e8f0;user-select:all">${escapedCode}</pre>
      </div>
    `
        : `
      <div style="display:flex;flex-direction:column;gap:12px">
        ${sheetsHtml}
        ${refBlockHtml}
      </div>
    `
    }
  </div>`;
    el.modal.hidden = false;
    renderCard();
    startVeggieStudioLoop();
  }
  let veggieStudioPtr = { active: false, clientX: 0, clientY: 0 };
  if (typeof window !== 'undefined' && !window.__VEGGIE_STUDIO_PTR_BOUND) {
    window.__VEGGIE_STUDIO_PTR_BOUND = true;
    window.addEventListener(
      'pointermove',
      (e) => {
        veggieStudioPtr.active = true;
        veggieStudioPtr.clientX = e.clientX;
        veggieStudioPtr.clientY = e.clientY;
        if (!el.modal.hidden && veggieStudioAnimMode === 'sheet' && document.querySelector('[data-trio-sheet]')) {
          startVeggieStudioLoop();
        }
      },
      { passive: true },
    );
    window.addEventListener(
      'pointerdown',
      (e) => {
        const t = e.target;
        if (t && t.tagName === 'CANVAS' && t.dataset && t.dataset.trioSheet) {
          veggieStudioClickHitAt = performance.now();
          Sound.init();
          Sound.hit(true);
          if (veggieStudioAnimMode === 'sheet') {
            veggieStudioAnimMode = 'live';
            openVeggieStudioModal();
          }
        }
      },
      { passive: true },
    );
  }
  function startVeggieStudioLoop() {
    cancelAnimationFrame(veggieStudioTimer);
    const step = (now) => {
      if (el.modal.hidden || !document.querySelector('[data-trio-sheet]')) return;
      const isLive = veggieStudioAnimMode === 'live';
      const t = isLive ? now / 1000 : 0;
      const manualHitActive = now - veggieStudioClickHitAt < 950;
      document.querySelectorAll('canvas[data-trio-sheet]').forEach((cv) => {
        const cid = cv.dataset.trioSheet;
        const country = cv.dataset.country;
        const r = parseFloat(cv.dataset.r || '25');
        const scale = parseFloat(cv.dataset.scale || '2.5');
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, cv.width, cv.height);
        const rect = cv.getBoundingClientRect(); // Subtle vertical divider before the 4th "Live Action Cycle" column
        ctx.save();
        ctx.fillStyle = 'rgba(21, 128, 61, 0.06)';
        ctx.fillRect(855, 6, 358, 258);
        ctx.strokeStyle = '#86efac';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(855, 6, 358, 258);
        ctx.restore();
        const states = [
          ['idle', '1. IDLE', 130],
          ['near', '2. CURSOR-NEAR ALERT', 385],
          ['gag', '3. ON-HIT GAG', 655],
        ];
        for (const [st, label, cx] of states) {
          ctx.save();
          ctx.translate(cx, 214);
          ctx.scale(scale, scale);
          let px = isLive ? Math.sin(t * 2.4) * 1.3 : 0;
          let py = isLive ? Math.cos(t * 1.8) * 0.8 : 0;
          if (veggieStudioPtr.active && rect.width > 0 && rect.height > 0) {
            const localX = (veggieStudioPtr.clientX - rect.left) * (cv.width / rect.width);
            const localY = (veggieStudioPtr.clientY - rect.top) * (cv.height / rect.height);
            const eyeAnchorY = 206 - r * scale * 0.95;
            const ang = Math.atan2(localY - eyeAnchorY, localX - cx);
            const dist = Math.min(1, Math.hypot(localX - cx, localY - eyeAnchorY) / 40);
            px = Math.cos(ang) * 1.9 * dist;
            py = Math.sin(ang) * 1.6 * dist;
          }
          const effectiveSt = manualHitActive ? 'gag' : st;
          if (country === 'CN') {
            DBD_CHINA_TRIO_RENDERER.drawChinaCharacter(ctx, cid, r, effectiveSt, t, px, py, true);
          } else if (country === 'MA') {
            DBD_MOROCCO_TRIO_RENDERER.drawMoroccoCharacter(ctx, cid, r, effectiveSt, t, px, py, true);
          } else if (country === 'US') {
            DBD_USA_TRIO_RENDERER.drawUsaCharacter(ctx, cid, r, effectiveSt, t, px, py, true);
          } else if (country === 'JP') {
            DBD_JAPAN_TRIO_RENDERER.drawJapanCharacter(ctx, cid, r, effectiveSt, t, px, py, true);
          } else if (country === 'FR') {
            DBD_FRANCE_TRIO_RENDERER.drawFranceCharacter(ctx, cid, r, effectiveSt, t, px, py, true);
          } else {
            DBD_CANADA_TRIO_RENDERER.drawCanadaCharacter(ctx, cid, r, effectiveSt, t, px, py, true);
          }
          ctx.restore();
          ctx.fillStyle = '#1c1917';
          ctx.font = '800 16px "Trebuchet MS", "Figtree", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(label, cx, 254);
        } // 4th Column: Continuous Live State-Cycling Showcase (`IDLE -> ALERT -> SCYTHE -> GAG`)
        const cycleCx = 1025;
        ctx.save();
        ctx.translate(cycleCx, 214);
        let cycleInfo = { st: 'idle', stLabel: '▶ LIVE ACTION CYCLE', stColor: '#15803d' };
        const cycleT = manualHitActive ? 0.68 * 4.5 + (now - veggieStudioClickHitAt) / 1000 : isLive ? t : 2.1;
        if (country === 'CN' && DBD_CHINA_TRIO_RENDERER.drawContinuousShowcaseCycle) {
          cycleInfo = DBD_CHINA_TRIO_RENDERER.drawContinuousShowcaseCycle(ctx, cid, r, cycleT, scale);
        } else if (country === 'MA' && DBD_MOROCCO_TRIO_RENDERER.drawContinuousShowcaseCycle) {
          cycleInfo = DBD_MOROCCO_TRIO_RENDERER.drawContinuousShowcaseCycle(ctx, cid, r, cycleT, scale);
        } else if (country === 'US' && DBD_USA_TRIO_RENDERER.drawContinuousShowcaseCycle) {
          cycleInfo = DBD_USA_TRIO_RENDERER.drawContinuousShowcaseCycle(ctx, cid, r, cycleT, scale);
        } else if (country === 'CA' && DBD_CANADA_TRIO_RENDERER.drawContinuousShowcaseCycle) {
          cycleInfo = DBD_CANADA_TRIO_RENDERER.drawContinuousShowcaseCycle(ctx, cid, r, cycleT, scale);
        } else if (country === 'FR' && DBD_FRANCE_TRIO_RENDERER.drawContinuousShowcaseCycle) {
          cycleInfo = DBD_FRANCE_TRIO_RENDERER.drawContinuousShowcaseCycle(ctx, cid, r, cycleT, scale);
        } else if (country === 'JP' && DBD_JAPAN_TRIO_RENDERER.drawContinuousShowcaseCycle) {
          cycleInfo = DBD_JAPAN_TRIO_RENDERER.drawContinuousShowcaseCycle(ctx, cid, r, cycleT, scale);
        }
        ctx.restore();
        ctx.fillStyle = cycleInfo.stColor;
        ctx.font = '900 15px "Trebuchet MS", "Figtree", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('4. LIVE CYCLE: ' + cycleInfo.stLabel, cycleCx, 254);
      });
      if (isLive || manualHitActive) {
        veggieStudioTimer = requestAnimationFrame(step);
      }
    };
    veggieStudioTimer = requestAnimationFrame(step);
  }
  function askWipe() {
    openModal(
      `<h3 class="mtitle" id="mTitle">Wipe your save?</h3><p>This deletes your farm, your Grit and every heirloom in this browser. It can't be undone.</p>` +
        `<div class="mact"><button class="btn" type="button" data-close>Keep my save</button><button class="btn money" type="button" data-wipe>Wipe everything</button></div>`,
    );
  }
  function wipe() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
    meta = {
      grit: 0,
      diamonds: 2,
      learnedSkills: [],
      heir: blank(FarmScene_HEIR_IDS),
      lost: 0,
      owned: 0,
      best: 0,
      sound: meta.sound,
      country: 'US',
      cityId: 'us_austin',
      cityRecords: {},
      cityOwned: {},
    };
    farm = newFarm();
    cur = stats();
    mode = 'idle';
    goat = null;
    fillIdle();
    lastStampKey = '';
    closeModal();
    save();
    renderAll();
    toast('Save wiped. Fresh farm.');
  }
  let lastFocus = null;
  function openModal(html) {
    if (mode === 'day') setPaused(true);
    lastFocus = document.activeElement;
    el.modal.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="mTitle">${html}</div>`;
    el.modal.hidden = false;
    renderCard();
    const b = el.modal.querySelector('button');
    if (b) b.focus();
  }
  function closeModal() {
    el.modal.hidden = true;
    el.modal.innerHTML = '';
    renderCard();
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  /* events */ el.overlay.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    Sound.init();
    Sound.click();
    if (act === 'start') startDay();
    else if (act === 'pay') payBill();
    else if (act === 'bank') foreclose();
    else if (act === 'map') openWorldMapModal('world');
    else if (act === 'skills') openSkillTreeModal();
    else if (act === 'od11') window.__DBD_TEST.claudePlay(11);
    else if (act === 'od1') window.__DBD_TEST.claudePlay(1);
  });
  el.notice.addEventListener('click', (e) => {
    if (e.target.closest('#btnPay')) payBill();
  });
  el.shedList.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-buy]');
    if (b) buyShed(b.dataset.buy);
  });
  el.heirList.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-heir]');
    if (b) buyHeir(b.dataset.heir);
  });
  el.modal.addEventListener('click', (e) => {
    const countryEl = e.target.closest('[data-open-country]');
    if (countryEl) {
      Sound.click();
      openWorldMapModal('country', countryEl.dataset.openCountry);
      return;
    }
    const lockedEl = e.target.closest('[data-locked-country]');
    if (lockedEl) {
      Sound.click();
      toast(`${lockedEl.dataset.lockedCountry} is marked Coming Soon. Select Canada, Brazil, France, or Japan!`);
      return;
    }
    const cityPin = e.target.closest('[data-pick-city]');
    if (cityPin) {
      Sound.click();
      atlasCityId = cityPin.dataset.pickCity;
      openWorldMapModal('country', atlasCountryCode);
      return;
    }
    const skillG = e.target.closest('[data-select-skill]');
    if (skillG) {
      Sound.click();
      selectedSkillId = skillG.dataset.selectSkill;
      openSkillTreeModal();
      return;
    }
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.perk) choosePerk(b.dataset.perk);
    else if (b.dataset.backWorld) {
      Sound.click();
      openWorldMapModal('world');
    } else if (b.dataset.enterCity) {
      if (mode === 'idle') {
        meta.country = atlasCountryCode;
        meta.cityId = b.dataset.enterCity;
        sceneryKey = '';
        buildFieldLayer();
        cur = stats();
        fillIdle();
        Sound.click();
        closeModal();
        save();
        renderAll();
        toast(`Entered ${curCity().name}, ${curCountry().name} (${curCity().province})`);
      }
    } else if (b.dataset.learnSkill) learnSkillNode(b.dataset.learnSkill);
    else if (b.dataset.treeZoom) {
      const zAct = b.dataset.treeZoom;
      if (zAct === 'in') treeZoom = Math.min(2.2, treeZoom * 1.25);
      else if (zAct === 'out') treeZoom = Math.max(0.75, treeZoom / 1.25);
      else {
        treeZoom = 1.0;
        treePanX = 0;
        treePanY = 0;
      }
      updateTreeViewBox();
    } else if (b.dataset.saveAct) {
      const act = b.dataset.saveAct;
      if (act === 'copy') {
        const box = document.getElementById('exportSaveBox');
        if (box && navigator.clipboard) navigator.clipboard.writeText(box.value).catch(() => {});
        toast('Save JSON copied to clipboard!');
      } else if (act === 'download') {
        const json = SaveSystem.exportSaveJson(meta, farm);
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `due_by_dusk_save_day${farm.day}.json`;
        a.click();
        toast('Downloaded save file!');
      } else if (act === 'backup') {
        const bk = SaveSystem.getBackupJson() || '{}';
        const blob = new Blob([bk], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'due_by_dusk_v1_backup.json';
        a.click();
        toast('Downloaded pre-migration backup!');
      } else if (act === 'import') {
        const box = document.getElementById('importSaveBox');
        try {
          const res = SaveSystem.importSaveJson(box ? box.value : '', meta, farm);
          meta = res.meta;
          farm = res.farm;
          sceneryKey = '';
          buildFieldLayer();
          cur = stats();
          fillIdle();
          renderAll();
          const rep = res.migrationReport;
          const msg =
            rep && rep.gritRefundedFromLegacySkills > 0
              ? `Imported & migrated save! Refunded +${rep.gritRefundedFromLegacySkills} Grit from legacy skills.`
              : `Imported save! Loaded Farm No. ${farm.no}, Day ${farm.day}, ${meta.grit} Grit, 💎 ${meta.diamonds}.`;
          openSaveTransferModal(msg);
          toast(msg, 3800);
        } catch (err) {
          openSaveTransferModal('Import error: ' + (err && err.message ? err.message : String(err)));
        }
      }
    } else if (b.dataset.arthurState) {
      Sound.click();
      openArthurStudioModal(b.dataset.arthurState);
    } else if (b.dataset.trioCountry) {
      Sound.click();
      veggieStudioFilter = b.dataset.trioCountry;
      if (veggieStudioFilter === 'CN') veggieStudioCodeScope = 'cn_all';
      else if (veggieStudioFilter === 'MA') veggieStudioCodeScope = 'ma_all';
      else if (veggieStudioFilter === 'US') veggieStudioCodeScope = 'us_all';
      else if (veggieStudioFilter === 'JP') veggieStudioCodeScope = 'jp_all';
      else if (veggieStudioFilter === 'FR') veggieStudioCodeScope = 'fr_all';
      else if (veggieStudioFilter === 'CA') veggieStudioCodeScope = 'ca_all';
      else veggieStudioCodeScope = 'all_15';
      openVeggieStudioModal();
    } else if (b.dataset.copyChar) {
      Sound.click();
      const sc = b.dataset.copyChar;
      const code = getClaudeCodeSnippet(sc);
      const labelMap = {
        cn_all: 'Full China Trio Renderer (All 3)',
        bittermelon: 'Shaolin Bitter Melon Code',
        bokchoy: 'Sifu Bok Choy Code',
        lotusroot: 'Zen Lotus Root Code',
        ma_all: 'Full Morocco Trio Renderer (All 3)',
        chickpea: 'Hummus Chickpea Code',
        eggplant: 'Zaalouk Eggplant Code',
        olive: 'Beldi Green Olive Code',
        all_15: 'Combined All 15 Characters Renderer',
        us_all: 'Full USA Trio Renderer (All 3)',
        habanero: 'Sheriff Habanero Code',
        sweetcorn: 'Quarterback Sweetcorn Code',
        brisket_onion: 'Smokey Brisket-Onion Code',
        jp_all: 'Full Japan Trio Renderer',
        fr_all: 'Full France Trio Renderer',
        ca_all: 'Full Canada Trio Renderer',
        all_12: 'Combined All 12 Characters Renderer',
        daikon: 'Sensei Daikon Code',
        kabocha: 'Rikishi Kabocha Code',
        wasabi: 'Shinobi Wasabi Code',
        echalote: 'Monsieur Échalote Code',
        artichaut: 'Chevalier Artichaut Code',
        lavender: 'Diva Lavande Code',
        pei_russet: 'Hoser Russet Code',
        fiddlehead: 'Lumberjack Fiddlehead Code',
        saskaberry: 'Mountie Saskaberry Code',
      };
      copyTextToClipboard(code, labelMap[sc] || sc);
    } else if (b.dataset.canadaMode) {
      Sound.click();
      veggieStudioShowCode = false;
      veggieStudioAnimMode = b.dataset.canadaMode;
      openVeggieStudioModal();
    } else if (b.dataset.toggleRef) {
      Sound.click();
      veggieStudioShowCode = false;
      veggieStudioShowRef = !veggieStudioShowRef;
      openVeggieStudioModal();
    } else if (b.dataset.toggleCode) {
      Sound.click();
      veggieStudioShowCode = !veggieStudioShowCode;
      openVeggieStudioModal();
    } else if (b.dataset.codeScope) {
      Sound.click();
      veggieStudioCodeScope = b.dataset.codeScope;
      veggieStudioShowCode = true;
      openVeggieStudioModal();
    } else if (b.dataset.veggieFilter) {
      Sound.click();
      openVeggieStudioModal(b.dataset.veggieFilter, undefined, undefined);
    } else if (b.dataset.veggieAnim) {
      Sound.click();
      openVeggieStudioModal(undefined, b.dataset.veggieAnim, undefined);
    } else if (b.dataset.veggieSelect) {
      Sound.click();
      openVeggieStudioModal(undefined, undefined, b.dataset.veggieSelect);
    } else if (b.dataset.veggiePlayCountry) {
      const cc = b.dataset.veggiePlayCountry;
      const cObj = GEO.countries[cc] || GEO.countries.US || GEO.countries.CA;
      meta.country = cObj.code;
      meta.cityId = cObj.cities[0].id;
      sceneryKey = '';
      buildFieldLayer();
      cur = stats();
      fillIdle();
      Sound.click();
      closeModal();
      save();
      renderAll(); // Immediately start the playable day on the field so the user can slice the USA Trio right away!
      startDay();
      toast(
        `🤠 Playing ${cObj.flag} ${cObj.name} Field! Move cursor near crops for Alert & slice for On-Hit Gags!`,
        4200,
      );
    } else if (b.dataset.wipe !== undefined) wipe();
    else if (b.dataset.close !== undefined) {
      Sound.click();
      closeModal();
    }
  });
  el.modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !farm.pendingPerks) {
      closeModal();
      return;
    }
    if (e.key !== 'Tab') return;
    const f = [...el.modal.querySelectorAll('button')];
    if (!f.length) return;
    const first = f[0],
      last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  });
  el.btnSound.addEventListener('click', () => {
    meta.sound = !meta.sound;
    Sound.on = meta.sound;
    if (meta.sound) {
      Sound.init();
      Sound.click();
    }
    save();
    renderHeader();
  });
  const biomeBtn = $('#btnBiome'),
    skillTreeBtn = $('#btnSkillTree');
  if (biomeBtn)
    biomeBtn.addEventListener('click', () => {
      if (mode !== 'idle') return;
      Sound.init();
      Sound.click();
      openWorldMapModal();
    });
  if (skillTreeBtn)
    skillTreeBtn.addEventListener('click', () => {
      if (mode !== 'idle') return;
      Sound.init();
      Sound.click();
      openSkillTreeModal();
    });
  const saveTransferBtn = $('#btnSaveTransfer');
  if (saveTransferBtn)
    saveTransferBtn.addEventListener('click', () => {
      if (mode !== 'idle') return;
      Sound.init();
      Sound.click();
      openSaveTransferModal();
    });
  const arthurBtn = $('#btnArthurStudio');
  if (arthurBtn)
    arthurBtn.addEventListener('click', () => {
      if (mode !== 'idle') return;
      Sound.init();
      Sound.click();
      openArthurStudioModal('demand');
    });
  const veggieBtn = $('#btnVeggieStudio');
  if (veggieBtn)
    veggieBtn.addEventListener('click', () => {
      if (mode !== 'idle') return;
      Sound.init();
      Sound.click();
      openVeggieStudioModal();
    });
  el.btnReset.addEventListener('click', askWipe);
  const pauseButton = $('#btnPause'),
    resumeButton = $('#btnResume');
  if (pauseButton) pauseButton.addEventListener('click', () => setPaused(!paused));
  if (resumeButton) resumeButton.addEventListener('click', () => setPaused(false));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'day') setPaused(true);
  });
  function toWorld(e) {
    const r = canvas.getBoundingClientRect();
    const y0 = (e.clientY - r.top) / scale;
    const k = e.pointerType === 'touch' ? Math.max(0, Math.min(1, (HW - 20 - y0) / 90)) : 0;
    return [(e.clientX - r.left) / scale, y0 - (k * 40) / scale];
  }
  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = toWorld(e);
    if (pointer.ax === undefined || Math.hypot(x - pointer.ax, y - pointer.ay) > 9) {
      pointer.ax = x;
      pointer.ay = y;
      pointer.mt = performance.now();
    }
    pointer.vx = (x - pointer.x) * 30;
    pointer.vy = (y - pointer.y) * 30;
    pointer.x = x;
    pointer.y = y;
    pointer.placed = true;
    if (e.pointerType === 'mouse') {
      pointer.active = true;
      pointer.kind = 'mouse';
    } else if (pointer.down) pointer.active = true;
  });
  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = toWorld(e);
    pointer.x = x;
    pointer.y = y;
    pointer.placed = true;
    pointer.down = true;
    pointer.active = true;
    pointer.kind = e.pointerType;
    pointer.ax = x;
    pointer.ay = y;
    pointer.mt = performance.now();
    if (e.pointerType !== 'mouse' && mode === 'day') {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {}
    }
  });
  const pUp = (e) => {
    if (e.pointerType !== 'mouse' && mode === 'day' && chargeT >= 0.72) {
      pointer.active = true;
      unleashChargeCleave();
    }
    pointer.down = false;
    if (e.pointerType !== 'mouse') pointer.active = false;
  };
  canvas.addEventListener('pointerup', pUp);
  canvas.addEventListener('pointercancel', pUp);
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') pointer.active = false;
  });
  const MOVE_KEYS = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's', ' '];
  addEventListener('keydown', (e) => {
    if (mode !== 'day') return;
    const k = e.key.toLowerCase();
    if ((k === 'p' || k === 'escape') && el.modal.hidden) {
      e.preventDefault();
      setPaused(!paused);
      return;
    }
    if (paused || !MOVE_KEYS.includes(k)) return;
    e.preventDefault();
    keys.add(k);
    if (!pointer.placed || pointer.kind !== 'key') {
      pointer.kind = 'key';
      if (!pointer.placed) {
        pointer.x = worldW / 2;
        pointer.y = (FIELD_TOP + HW) / 2;
        pointer.placed = true;
      }
    }
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => {
    keys.clear();
    pointer.active = false;
    pointer.down = false;
  });
  /* loop */ let last = 0;
  function FarmScene_frame(now) {
    const elapsed = last ? Math.max(0, (now - last) / 1000) : 0;
    last = now;
    if (elapsed > 3.5 && mode === 'day' && !paused) setPaused(true);
    let remaining = Math.min(elapsed, 0.75);
    while (remaining > 0) {
      const step = Math.min(1 / 60, remaining);
      update(step);
      remaining -= step;
    }
    draw();
    updateHud();
    requestAnimationFrame(FarmScene_frame);
  }
  /* Paper ledger tabs: keep the field in view while planning the next day. */ function showLedgerPage(name) {
    document.querySelectorAll('.ledger-tab').forEach((b) => {
      const selected = b.dataset.page === name;
      b.setAttribute('aria-selected', String(selected));
      b.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll('.ledger-page').forEach((p) => (p.hidden = p.id !== 'page-' + name));
  }
  document.querySelectorAll('.ledger-tab').forEach((tab, index, tabs) => {
    tab.addEventListener('click', () => {
      showLedgerPage(tab.dataset.page);
      Sound.click();
    });
    tab.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const next =
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? tabs.length - 1
            : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      showLedgerPage(tabs[next].dataset.page);
      tabs[next].focus();
    });
  });
  class FarmScene extends phaser_shim.Scene {
    arthurSprite = null;
    sceneRenderObj = null;
    constructor() {
      super({ key: 'FarmScene' });
    }
    create() {
      window.__PHASER_FARM_SCENE = this;
      const saved = window.__DBD_INITIAL_SAVE || loadSavedState();
      if (saved) {
        meta = saved.meta;
        farm = saved.farm;
      } else {
        farm = newFarm();
      }
      Sound.on = meta.sound; // Create Arthur Grumble Sprite GameObject backed by the 30-frame Phaser Texture Atlas!
      this.arthurSprite = this.add.sprite(0, 0, 'arthur', 'idle_0');
      this.arthurSprite.setOrigin(0.5, 0.95);
      this.arthurSprite.setVisible(false); // Rendered in scene depth pass alongside fence & speech bubble
      this.arthurSprite.play('arthur_idle');
      cur = stats();
      buildSprites();
      resize();
      if ('ResizeObserver' in window) {
        new ResizeObserver(() => resize()).observe(stage);
      } else {
        addEventListener('resize', resize);
      }
      fillIdle();
      renderAll();
      if (farm.pendingPerks) openPerkModal();
      if (document.fonts && document.fonts.load) {
        document.fonts.load('800 24px "Big Shoulders Stencil"').catch(() => {});
      } // Expose programmatic test hooks for automated headless verification
      window.__DBD_TEST = {
        getScene: () => this,
        claudeApply: (raw) => {
          if (mode !== 'idle') return false;
          const res = SaveSystem.migrateToV2(raw);
          if (!res) return false;
          meta = res.meta;
          farm = res.farm;
          SaveSystem.save(meta, farm, res.migrationId, res.migrationReport);
          goat = null;
          sceneryKey = '';
          buildFieldLayer();
          cur = stats();
          fillIdle();
          lastStampKey = '';
          closeModal();
          renderAll();
          return true;
        },
        claudePrep: (n) => {
          if (mode !== 'idle') return false;
          const cc = 'FR',
            cid = 'fr_avignon';
          let raw;
          if (n === 11) {
            raw = {
              schemaVersion: 2,
              migrationId: 'oneday_day11',
              meta: {
                grit: 0,
                diamonds: 2,
                learnedSkills: ['core_awakening', 'reap_root', 'soil_root'],
                heir: blank(FarmScene_HEIR_IDS),
                lost: 0,
                owned: 1,
                best: 2,
                sound: meta.sound,
                country: cc,
                cityId: cid,
                cityRecords: {},
                cityOwned: {},
              },
              farm: {
                no: 2,
                day: 11,
                cash: 150,
                shed: { scythe: 4, swing: 4, hands: 4, days: 2, soil: 5, market: 4, clover: 2 },
                perks: ['fever', 'hungry', 'storm'],
                bill: 2,
                due: 11,
                paidTotal: 80,
                billsPaid: 2,
                lastEarn: 120,
                lastCount: 30,
                played: false,
                earned: 900,
                harvested: 300,
                pendingPerks: null,
                lastBest: 20,
                lastBonus: 0,
                bestChain: 24,
              },
            };
          } else {
            const m = {
              grit: 0,
              diamonds: 2,
              learnedSkills: [],
              heir: blank(FarmScene_HEIR_IDS),
              lost: 0,
              owned: 0,
              best: 0,
              sound: meta.sound,
              country: cc,
              cityId: cid,
              cityRecords: {},
              cityOwned: {},
            };
            const keep = meta;
            meta = m;
            const f = newFarm();
            meta = keep;
            raw = { schemaVersion: 2, migrationId: 'oneday_day1', meta: m, farm: f };
          }
          window.__odSetup = n;
          return window.__DBD_TEST.claudeApply(raw);
        },
        claudePlay: (n) => {
          if (!window.__DBD_TEST.claudePrep(n)) return false;
          startDay();
          return mode === 'day';
        },
        claudeCity: () => {
          const c = curCity();
          return { name: c.name, record: c.record, rival: c.rival };
        },
        claudeHud: () => {
          const b = billObj(farm.bill);
          return {
            mode,
            paused,
            cash: farm.cash,
            today: today.earned,
            count: today.count,
            best: today.best,
            bill: b ? { name: b.name, amt: b.amt } : null,
            billNo: farm.bill + 1,
            billTotal: FarmScene_BILLS.length,
            combo,
            comboT: comboTimer,
            grace: cur ? cur.chainGrace : 0.9,
            mult: incomeMultiplier(),
            tiers: CHAIN_TIERS,
            rushCharge,
            rushGoal: RUSH_GOAL,
            rushT: rushTimer,
            rushDur: RUSH_DURATION,
            time,
            dayLen,
            sound: meta.sound,
          };
        },
        claudeEvent: () => {
          rollDailyEvent();
          return { id: dailyEvent.id, title: dailyEvent.title, desc: dailyEvent.desc };
        },
        claudeCities: () =>
          GEO.countries.FR.cities.map((c) => ({
            id: c.id,
            name: c.name,
            rival: c.rival,
            record: c.record,
            desc: c.desc,
            buff: c.buff,
          })),
        getState: () => ({ mode, meta, farm, time, dayLen, cropsCount: crops.length }),
        openArthurStudio: (st) => {
          mode = 'idle';
          openArthurStudioModal(st);
        },
        openVeggieStudio: (f, a, s) => {
          mode = 'idle';
          openVeggieStudioModal(f, a, s);
        },
        openWorldMap: () => {
          mode = 'idle';
          openWorldMapModal('world');
        },
        openCountryMap: (cc) => {
          mode = 'idle';
          openWorldMapModal('country', cc);
        },
        openSkillTree: () => {
          mode = 'idle';
          openSkillTreeModal();
        },
        openSaveTransfer: () => {
          mode = 'idle';
          openSaveTransferModal();
        },
        testSaveMigration: (rawJson) => SaveSystem.importSaveJson(rawJson, meta, farm),
        hasBackup: () => !!SaveSystem.getBackupJson(),
        startPlayableDay: (cc, cityId, arthurOverride) => {
          closeModal();
          meta.country = cc;
          meta.cityId = cityId;
          farm.billsPaid = 4;
          farm.bill = 4;
          farm.shed.soil = 4;
          sceneryKey = '';
          buildFieldLayer();
          cur = stats();
          startDay();
          dawnFade = 0;
          if (arthurOverride === 'shock') {
            farm.cash = billObj(farm.bill).amt + 100;
            time = 5.5;
          } else if (arthurOverride === 'demand') {
            farm.cash = 25;
            time = 3.8;
          } else if (arthurOverride === 'anger') {
            arthurAngerTimer = 5.0;
            time = 8.0;
          } else if (arthurOverride === 'smug') {
            farm.cash = 10;
            time = 7.2;
          } else {
            time = dayLen * 0.48;
          }
          const allowed = curCity().crops;
          crops.forEach((c, idx) => {
            const tp = allowed[idx % allowed.length];
            c.type = tp;
            c.r = CROP[tp].r;
            c.age = 1.5;
            c.stage = 3;
            c.frosted = false;
            c.eye = idx === 1 ? 0.9 : 0;
            if (tp === 'pumpkin') {
              c.hatProgress = 1;
              c.scarfProgress = 1;
            }
          });
          pointer.active = true;
          pointer.x = worldW * 0.48;
          pointer.y = FIELD_TOP + 180;
          swing();
        },
      };
    }
    update(_timeMs, deltaMs) {
      const elapsed = Math.min(deltaMs / 1000, 0.75);
      let remaining = elapsed;
      while (remaining > 0) {
        const step = Math.min(1 / 60, remaining);
        update(step);
        remaining -= step;
      }
      draw(); // Apply Phaser Camera 2D flash overlay if active
      if (this.cameras && this.cameras.main && this.cameras.main.flashTimer > 0) {
        const fa = (this.cameras.main.flashTimer / this.cameras.main.flashDuration) * 0.35;
        ctx.save();
        ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
        ctx.fillStyle = `rgba(${this.cameras.main.flashColor},${fa})`;
        ctx.fillRect(0, 0, worldW, HW);
        ctx.restore();
      }
      updateHud();
    }
  } // CONCATENATED MODULE: ./.ts-build/main.js
  // ============================================================================
  // Due by Dusk · Harvest Edition v0.6.00 — Phaser 3 + TypeScript Entry Point
  // ============================================================================

  const config = {
    type: phaser_shim.AUTO,
    parent: 'stage',
    canvas: document.getElementById('field'),
    scale: {
      mode: phaser_shim.Scale.RESIZE,
      width: '100%',
      height: '100%',
    },
    scene: [BootScene, PreloadScene, FarmScene],
  };
  const game = new phaser_shim.Game(config);
  window.__PHASER_GAME = game;
  return game;
}
