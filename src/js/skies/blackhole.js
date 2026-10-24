/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - THE BLACK HOLE SKY
   ═══════════════════════════════════════════════════════════════════

   Its painting, mixed into the engine (background.js): every method here
   runs with the engine as `this`, as if it were written in the class.

   A black hole that does not turn (Schwarzschild), with a thin disk of hot
   gas round it, drawn from the paths light really takes near one. In units
   where its mass, G and c are one, light passing at impact parameter b
   follows u'' + u = 3u², u = 1/r, the orbit of a light ray: the closer it
   passes the more it is bent, at the photon sphere (r = 3) it goes round
   and round, and inside b = 3√3, about 5.2, it falls in. That is the edge
   of the shadow, two and a half times the size of the horizon. The paths
   are worked out once for every b and kept as a table, and each point of
   the picture reads off where its light crossed the disk: on its way in,
   or after going once round the back of the hole. So the far side of the
   disk shows as an arch over the shadow and a thin ring under it.

   The disk starts at the innermost orbit that holds (r = 6), and each ring
   of it turns at its own Kepler rate, Ω = r^-3/2, the inner ones fastest.
   Its light leaves as a thin disk's does, F ∝ r^-3 (1 - √(6/r)), and comes
   in shifted by g = √(1 - 3/r) / (1 - Ω x sin i), gravity and the Doppler
   shift together (x is how far right across the picture, i how far the
   disk is tipped towards edge on): the side turning towards the viewer is
   brighter by g⁴ and hotter by g, the other side dimmer and cooler. Behind
   it the stars are bent by the same table, into arcs round the Einstein
   ring as they drift past.

   The disk is worked out in a buffer round the hole and laid over the sky
   in one drawImage; the stars and the hairline of light hugging the shadow
   are drawn at full size. On a light page it is a print, ink for light. */

const NORDLYS_HOLE = {
  shadow: 3 * Math.sqrt(3),        // the edge of the shadow, in masses
  inner: 6,                        // the innermost stable orbit
  outer: 30,                       // where the disk has faded out
  sweep: 3 * Math.PI,              // far enough for the light that went once round
  steps: 720,                      // steps of the sweep each path is kept at
  rows: [96, 448],                 // paths that fall in, and paths that get away
  far: 80,                         // beyond this the light is bent as in weak gravity
  incline: 83 * Math.PI / 180,     // the disk tipped nearly edge on
  roll: -4 * Math.PI / 180,        // and the picture turned a little off level
  distance: 60,                    // the viewer's distance, for the bending of the stars
  spin: 8,                         // masses of time per unit of the scene clock
  band: 0.45                       // the width of a ring of the disk's texture
};
// How hot the disk looks, as [share, colour] stops: a hot body's colours, and on a light page in ink.
const NORDLYS_HOLE_HEAT = [[0, [70, 10, 4]], [0.22, [176, 46, 10]], [0.45, [255, 118, 30]], [0.66, [255, 190, 104]], [0.84, [255, 240, 214]], [1, [214, 228, 255]]];
const NORDLYS_HOLE_INK = [[0, [190, 120, 96]], [0.4, [150, 64, 30]], [0.75, [96, 34, 14]], [1, [40, 22, 30]]];

/* The disk worked out on the GPU, a pixel at a time, from the same table of
   light paths the buffer reads (lightPaths): where the light reaching the
   pixel crossed the disk on its way in and after once round, how hot the gas
   there looks and how bright, turned by the scene clock. The shader is the
   buffer's `crossings` and `paintDisk` written for every pixel at once. */
const NORDLYS_HOLE_VERTEX = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const NORDLYS_HOLE_FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D u_paths;
uniform sampler2D u_rings;
uniform vec2 u_size;
uniform vec2 u_centre;
uniform float u_k;
uniform float u_clock;
uniform float u_rings_count;
uniform float u_peak;
uniform bool u_light;
uniform int u_inside;
uniform int u_outside;
uniform int u_steps;
uniform vec3 u_heat[6];
uniform float u_heat_at[6];
out vec4 o;
const float PI = 3.14159265;
const float SHADOW = ${(3 * Math.sqrt(3)).toFixed(6)};
const float INNER = 6.0;
const float OUTER = 30.0;
const float FAR = 80.0;
const float SWEEP = ${(3 * Math.PI).toFixed(6)};
const float BAND = 0.45;
const float SIN_I = ${Math.sin(NORDLYS_HOLE.incline).toFixed(6)};
const float COS_I = ${Math.cos(NORDLYS_HOLE.incline).toFixed(6)};
const float SIN_R = ${Math.sin(NORDLYS_HOLE.roll).toFixed(6)};
const float COS_R = ${Math.cos(NORDLYS_HOLE.roll).toFixed(6)};

float rowOf(float b) {
  float edge = SHADOW + 1e-3;
  return b < SHADOW ? b / SHADOW * float(u_inside) : float(u_inside) + sqrt(max(0.0, (b - edge) / (FAR - edge))) * float(u_outside - 1);
}
// u = 1/r after sweeping round the hole: a half once fallen in, below nought once away.
float pathU(float b, float sweep) {
  float rows = float(u_inside + u_outside);
  float at = min(rows - 1.001, rowOf(b));
  int r = int(floor(at));
  float s = sweep / (SWEEP / float(u_steps));
  int n = min(u_steps - 1, int(floor(s)));
  float f = s - float(n);
  float a = mix(texelFetch(u_paths, ivec2(n, r), 0).r, texelFetch(u_paths, ivec2(n + 1, r), 0).r, f);
  float c = mix(texelFetch(u_paths, ivec2(n, r + 1), 0).r, texelFetch(u_paths, ivec2(n + 1, r + 1), 0).r, f);
  return mix(a, c, at - float(r));
}
vec3 heat(float t) {
  vec3 c = u_heat[0];
  for (int i = 1; i < 6; i++) c = mix(c, u_heat[i], clamp((t - u_heat_at[i - 1]) / (u_heat_at[i] - u_heat_at[i - 1]), 0.0, 1.0));
  return c / 255.0;
}
float flux(float r) { return r <= INNER ? 0.0 : pow(r, -3.0) * (1.0 - sqrt(INNER / r)); }

void main() {
  vec2 d = vec2(gl_FragCoord.x, u_size.y - gl_FragCoord.y) - u_centre;
  float alpha = (d.x * COS_R + d.y * SIN_R) / u_k;
  float beta = -(-d.x * SIN_R + d.y * COS_R) / u_k;
  float b = length(vec2(alpha, beta));
  vec3 colour = vec3(0.0);
  float cover = 0.0;
  if (b < OUTER + 1.0) {
    float across = atan(beta, alpha);
    float first = atan(SIN_I * sin(across), COS_I) + PI / 2.0;
    float through = 1.0;
    for (int turn = 0; turn < 2; turn++) {
      float sweep = first + float(turn) * PI;
      if (sweep > SWEEP) break;
      float u = pathU(b, sweep);
      if (u >= 0.5 || u <= 0.0) break;
      float r = 1.0 / u;
      if (r < INNER || r > OUTER) continue;
      float x = sin(sweep) * cos(across);
      float y = -cos(sweep) * SIN_I + sin(sweep) * sin(across) * COS_I;
      float omega = pow(r, -1.5);
      float g = sqrt(1.0 - 3.0 / r) / (1.0 - omega * alpha * SIN_I);
      float f = flux(r) / u_peak;
      float fade = clamp((OUTER - r) / (OUTER * 0.4), 0.0, 1.0);
      float light = pow(pow(g, 4.0) * f * fade * fade, 0.6);
      float spin = (atan(y, x) + omega * u_clock) / (2.0 * PI);
      float ring = min((r - INNER) / BAND, u_rings_count - 1.001);
      float grain = texture(u_rings, vec2(fract(spin), (ring + 0.5) / u_rings_count)).r * 2.0;
      float shine = 1.0 - exp(-light * grain * (u_light ? 3.2 : 2.4));
      float hot = clamp((g * pow(f, 0.25) - 0.12) / 1.25, 0.0, 1.0);
      // Front to back: what is nearer covers what is behind it, as far as it is thick.
      colour += through * shine * heat(hot);
      cover += through * shine;
      through *= 1.0 - shine * fade;
      if (fade >= 1.0) break;
    }
  }
  // The photon ring, a hairline at the edge of the shadow, brighter on the side coming closer.
  float edge = exp(-pow((b - SHADOW * 1.004) / 0.035, 2.0)) * (0.5 + 0.35 * clamp(alpha / SHADOW, -1.0, 1.0)) * pow(1.0 - cover, 4.0);
  if (u_light) {
    o = vec4(colour, cover);
    o.rgb += edge * vec3(0.16, 0.08, 0.06);
    o.a = clamp(o.a + edge * 0.6, 0.0, 1.0);
  } else {
    colour += edge * vec3(1.0, 0.86, 0.7);
    cover = clamp(cover + edge, 0.0, 1.0);
    // The shadow: no light comes from inside it, so it hides the stars behind.
    float dark = (1.0 - smoothstep(SHADOW * 0.985, SHADOW * 1.0, b)) * 0.92;
    o = vec4(colour, cover + dark * (1.0 - cover));
  }
}`;

NordlysSkies.paint("blackhole", "renderBlackHole", {
  /* The disk's texture, a ring at a time, and the stars behind: seeded, so a
     shuffle is another disk and another sky of stars. */
  initBlackHole() {
    const H = NORDLYS_HOLE;
    const random = NordlysBackgroundEngine.stream((this.seed ^ 0x1b873593) >>> 0);
    const rings = [];
    // Broad lanes of the disk lighter and darker, some wide and some narrow, as the gas lies.
    const lanes = Array.from({ length: 4 }, (_, i) => [2 + random() * (i < 2 ? 6 : 20), random() * Math.PI * 2]);
    // One ring past the last, so the texture can be read between two rings anywhere on the disk.
    for (let ring = 0; ring <= Math.ceil((H.outer - H.inner) / H.band); ring++) {
      // Long swells and fine filaments, as the gas is drawn out round the hole.
      const waves = Array.from({ length: 6 }, (_, i) => [1 + Math.floor(random() * (i < 3 ? 6 : 24)), random() * Math.PI * 2, (i < 3 ? 0.5 : 0.22) + random() * 0.4]);
      const gain = 1 + 0.14 * lanes.reduce((sum, [period, phase]) => sum + Math.sin((ring / period) * Math.PI * 2 + phase), 0);
      const texture = new Float32Array(256);
      for (let k = 0; k < 256; k++) {
        const angle = (k / 256) * Math.PI * 2;
        const swell = waves.reduce((sum, [m, phase, a]) => sum + a * Math.sin(m * angle + phase), 0) / 2.6;
        texture[k] = Math.max(0.2, gain * (0.84 + 0.36 * swell));
      }
      rings.push(texture);
    }
    // The stars, on a plane behind the hole, in shares of the page each way.
    const stars = Array.from({ length: 170 }, () => ({
      x: random() * 2 - 1, y: random() * 2 - 1,
      size: 0.45 + Math.pow(random(), 3) * 1.25,
      alpha: 0.25 + random() * 0.6,
      phase: random() * Math.PI * 2
    }));
    this.hole = { rings, stars, map: null, lut: null, buffer: null };
  },

  /* Where the hole sits: in the middle of the page and large, the shadow a
     fifth of the page high and the disk running out past both sides of the
     folders, turning towards the viewer on the right. `k` is pixels to a mass. */
  holeFrame() {
    const unit = Math.min(this.w, this.h);
    return { cx: this.w * 0.5, cy: this.h * 0.84, k: (unit * 0.105) / NORDLYS_HOLE.shadow };
  },

  renderBlackHole() {
    if (!this.hole) this.initBlackHole();
    const ctx = this.ctx;
    const light = this.lightMode;
    const H = NORDLYS_HOLE;
    const { cx, cy, k } = this.holeFrame();
    /* On the screen the GPU works the disk out for every pixel, and the quiet
       zones' sample is read from the same picture, glow and all; a thumbnail is
       small enough for the buffer below. */
    if ((this.ctx === this.screen || this.solvingQuiet) && this.renderHoleGL(cx, cy, k, light)) return;
    const map = this.holeMap();
    ctx.save();

    // The shadow: no light comes from inside it. On a light page it stays paper.
    if (!light) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      ctx.beginPath();
      ctx.arc(cx, cy, H.shadow * k, 0, Math.PI * 2);
      ctx.fill();
    }

    // A faint glow of the disk's light in the gas round it, brighter on the side coming closer.
    ctx.globalCompositeOperation = light ? "multiply" : "screen";
    this.glow(cx, cy, H.outer * k * 1.1, H.outer * k * 0.42, H.roll, this.paletteRgb[1], light ? 0.05 : 0.07);
    this.glow(cx + H.inner * k * Math.cos(H.roll), cy + H.inner * k * Math.sin(H.roll), H.inner * k * 2.6, H.inner * k * 1.3, H.roll, this.pale(0, light ? 0 : 0.3), light ? 0.07 : 0.11);

    this.drawLensedStars(cx, cy, k, light);

    /* The photon ring: light that went round the hole more than once,
       crowding at the edge of the shadow, a hairline brighter where the disk
       comes towards the viewer, which here is the right. The near side of
       the disk passes in front of it. */
    const across = H.shadow * k;
    const ring = ctx.createLinearGradient(cx + across * Math.cos(H.roll), cy + across * Math.sin(H.roll), cx - across * Math.cos(H.roll), cy - across * Math.sin(H.roll));
    const [r, g, b] = light ? this.paletteRgb[2] : this.pale(0, 0.5);
    ring.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${light ? 0.5 : 0.62})`);
    ring.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${light ? 0.08 : 0.1})`);
    ctx.strokeStyle = ring;
    ctx.lineWidth = 1 / (ctx.getTransform?.()?.a || 1);
    ctx.beginPath();
    ctx.arc(cx, cy, across * 1.006, 0, Math.PI * 2);
    ctx.stroke();

    // The disk, worked out in the buffer and laid down over what it hides.
    ctx.globalCompositeOperation = "source-over";
    this.paintDisk(map, light);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(map.canvas, map.x, map.y, map.size, map.size);
    ctx.restore();
  },

  /* The screen's black hole: the stars, the disk worked out on the GPU for
     every pixel, and the disk's light spread round it the way a bright thing
     glows in a lens. False where there is no WebGL2, and the buffer draws it. */
  renderHoleGL(cx, cy, k, light) {
    const gl = this.holeGLContext();
    if (!gl) return false;
    const ctx = this.ctx;
    const H = NORDLYS_HOLE;
    const scale = Math.min(this.dpr || 1, 1.25);
    const width = Math.max(1, Math.round(this.w * scale));
    const height = Math.max(1, Math.round(this.h * scale));
    const { canvas, context: g, program, at } = gl;
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    if (gl.rings !== this.hole.rings) this.holeRingsTexture(gl);
    g.viewport(0, 0, width, height);
    g.useProgram(program);
    g.uniform2f(at.u_size, width, height);
    g.uniform2f(at.u_centre, cx * scale, cy * scale);
    g.uniform1f(at.u_k, k * scale);
    g.uniform1f(at.u_clock, this.t * H.spin);
    g.uniform1f(at.u_rings_count, this.hole.rings.length);
    g.uniform1i(at.u_light, light ? 1 : 0);
    const stops = light ? NORDLYS_HOLE_INK : NORDLYS_HOLE_HEAT;
    const six = Array.from({ length: 6 }, (_, i) => stops[Math.min(i, stops.length - 1)]);
    g.uniform3fv(at.u_heat, six.flatMap(([, rgb]) => rgb));
    g.uniform1fv(at.u_heat_at, six.map(([share], i) => (i < stops.length ? share : 1 + i)));
    g.clearColor(0, 0, 0, 0);
    g.clear(g.COLOR_BUFFER_BIT);
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4);

    ctx.save();
    ctx.globalCompositeOperation = light ? "multiply" : "screen";
    // The mood's light in the gas round the hole, faint and wide.
    this.glow(cx, cy, H.outer * k * 1.15, H.outer * k * 0.4, H.roll, this.paletteRgb[1], light ? 0.05 : 0.08);
    this.drawLensedStars(cx, cy, k, light);
    ctx.globalCompositeOperation = "source-over";
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(canvas, 0, 0, this.w, this.h);
    // A page showing the sky through cut-out letters (the website) asks for no glow round them.
    if (!light && this.holeBloom !== false) {
      // The bloom: the frame shrunk and laid back over itself, twice, wider each time.
      const bloom = gl.bloom;
      ctx.globalCompositeOperation = "screen";
      for (const [share, alpha] of [[1 / 8, 0.55], [1 / 28, 0.45]]) {
        bloom.width = Math.max(1, Math.round(this.w * share));
        bloom.height = Math.max(1, Math.round(this.h * share));
        const b = bloom.getContext("2d");
        b.imageSmoothingEnabled = true;
        b.drawImage(canvas, 0, 0, bloom.width, bloom.height);
        ctx.globalAlpha = alpha * (this.ink ?? 1);
        ctx.drawImage(bloom, 0, 0, this.w, this.h);
      }
    }
    ctx.restore();
    return true;
  },

  // The GL context, its program and the table of light paths as a texture: made once, or null for good.
  holeGLContext() {
    if (this.holeGL !== undefined) return this.holeGL;
    this.holeGL = null;
    const canvas = document.createElement("canvas");
    const g = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
    if (typeof g?.createShader !== "function") return null;
    const shader = (type, source) => {
      const s = g.createShader(type);
      g.shaderSource(s, source);
      g.compileShader(s);
      return g.getShaderParameter(s, g.COMPILE_STATUS) ? s : null;
    };
    const vertex = shader(g.VERTEX_SHADER, NORDLYS_HOLE_VERTEX);
    const fragment = shader(g.FRAGMENT_SHADER, NORDLYS_HOLE_FRAGMENT);
    if (!vertex || !fragment) return null;
    const program = g.createProgram();
    g.attachShader(program, vertex);
    g.attachShader(program, fragment);
    g.linkProgram(program);
    if (!g.getProgramParameter(program, g.LINK_STATUS)) return null;
    g.useProgram(program);
    const quad = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, quad);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
    const pos = g.getAttribLocation(program, "a_pos");
    g.enableVertexAttribArray(pos);
    g.vertexAttribPointer(pos, 2, g.FLOAT, false, 0, 0);
    const at = {};
    for (const name of ["u_paths", "u_rings", "u_size", "u_centre", "u_k", "u_clock", "u_rings_count", "u_peak", "u_light", "u_inside", "u_outside", "u_steps", "u_heat", "u_heat_at"]) at[name] = g.getUniformLocation(program, name);
    const paths = NordlysBackgroundEngine.lightPaths();
    const H = NORDLYS_HOLE;
    g.activeTexture(g.TEXTURE0);
    const table = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, table);
    g.pixelStorei(g.UNPACK_ALIGNMENT, 1);
    g.texImage2D(g.TEXTURE_2D, 0, g.R32F, H.steps + 1, paths.rows, 0, g.RED, g.FLOAT, paths.table);
    for (const [key, value] of [[g.TEXTURE_MIN_FILTER, g.NEAREST], [g.TEXTURE_MAG_FILTER, g.NEAREST], [g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE], [g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE]]) g.texParameteri(g.TEXTURE_2D, key, value);
    g.uniform1i(at.u_paths, 0);
    g.uniform1i(at.u_rings, 1);
    g.uniform1i(at.u_inside, paths.inside);
    g.uniform1i(at.u_outside, paths.outside);
    g.uniform1i(at.u_steps, H.steps);
    g.uniform1f(at.u_peak, NordlysBackgroundEngine.diskFlux(8.17));
    g.enable(g.BLEND);
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    this.holeGL = { canvas, context: g, program, at, rings: null, ringTexture: g.createTexture(), bloom: document.createElement("canvas") };
    // A lost context is not worth getting back for one sky: the buffer draws it from then on.
    canvas.addEventListener("webglcontextlost", () => { this.holeGL = null; });
    return this.holeGL;
  },

  // The disk's texture, a ring to a row, halved into a byte so the GPU can read between rings.
  holeRingsTexture(gl) {
    const g = gl.context;
    const rings = this.hole.rings;
    const bytes = new Uint8Array(rings.length * 256);
    rings.forEach((ring, row) => { for (let k = 0; k < 256; k++) bytes[row * 256 + k] = Math.round(Math.min(1, ring[k] / 2) * 255); });
    g.activeTexture(g.TEXTURE1);
    g.bindTexture(g.TEXTURE_2D, gl.ringTexture);
    g.texImage2D(g.TEXTURE_2D, 0, g.R8, 256, rings.length, 0, g.RED, g.UNSIGNED_BYTE, bytes);
    for (const [key, value] of [[g.TEXTURE_MIN_FILTER, g.LINEAR], [g.TEXTURE_MAG_FILTER, g.LINEAR], [g.TEXTURE_WRAP_S, g.REPEAT], [g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE]]) g.texParameteri(g.TEXTURE_2D, key, value);
    gl.rings = rings;
  },

  /* Every point of the buffer, read once for this size: where its light
     crossed the disk, if it did, and what the disk sends it from there. The
     buffer is a square round the hole as wide as the disk, a point for every
     one and a half pixels and four hundred and eighty a side at most. */
  holeMap() {
    const H = NORDLYS_HOLE;
    const { cx, cy, k } = this.holeFrame();
    const half = (H.outer + 2) * k;
    const bw = Math.max(16, Math.min(480, Math.round((2 * half) / 1.5)));
    const bh = bw;
    const key = `${this.w}x${this.h}:${bw}`;
    if (this.hole.map?.key === key) return this.hole.map;
    const paths = NordlysBackgroundEngine.lightPaths();
    const sinI = Math.sin(H.incline), cosI = Math.cos(H.incline);
    const cosR = Math.cos(H.roll), sinR = Math.sin(H.roll);
    const peak = NordlysBackgroundEngine.diskFlux(8.17);
    // What of the disk the light reaching a point (dx, dy) pixels from the hole crossed, nearest first.
    const crossings = (dx, dy) => {
      // Back to the hole's own level, in masses, up the page positive.
      const alpha = (dx * cosR + dy * sinR) / k;
      const beta = -(-dx * sinR + dy * cosR) / k;
      const b = Math.hypot(alpha, beta);
      const hits = [];
      // Light passing wider than the disk never comes near enough to cross it.
      if (b > H.outer + 1) return hits;
      const across = Math.atan2(beta, alpha);
      // Where the light's own plane cuts the disk: first on the way in, then once round.
      const first = Math.atan2(sinI * Math.sin(across), cosI) + Math.PI / 2;
      for (let turn = 0; turn < 2; turn++) {
        const sweep = first + turn * Math.PI;
        const r = paths.radius(b, sweep);
        if (!(r > 0) || r === Infinity) break;
        if (r < H.inner || r > H.outer) continue;
        const x = Math.sin(sweep) * Math.cos(across);
        const y = -Math.cos(sweep) * sinI + Math.sin(sweep) * Math.sin(across) * cosI;
        const omega = Math.pow(r, -1.5);
        // Turning clockwise as the viewer sees it from above, so towards them on the right.
        const g = Math.sqrt(1 - 3 / r) / (1 - omega * alpha * sinI);
        const flux = NordlysBackgroundEngine.diskFlux(r) / peak;
        // The outer disk thins into the dark rather than ending at an edge.
        const fade = Math.min(1, Math.max(0, (H.outer - r) / (H.outer * 0.4)));
        hits.push({
          psi: Math.atan2(y, x),
          omega,
          heat: g * Math.pow(flux, 0.25),
          // As a photograph keeps a bright thing and a dim one both in view: a gentle curve over the true light.
          light: Math.pow(g ** 4 * flux * fade * fade, 0.6),
          ring: Math.min((r - H.inner) / H.band, this.hole.rings.length - 1.001),
          fade,
          over: 0
        });
        // Where it thins, the disk lets through some of what lies behind it.
        if (fade >= 1) break;
      }
      return hits;
    };
    const cell = (2 * half) / bw;
    const found = [];
    for (let py = 0; py < bh; py++) {
      for (let px = 0; px < bw; px++) {
        const dx = ((px + 0.5) / bw - 0.5) * 2 * half;
        const dy = ((py + 0.5) / bh - 0.5) * 2 * half;
        let hits = crossings(dx, dy);
        /* Close round the shadow, the light that went once round the hole
           draws a ring finer than a point of the buffer: sixteen looks
           inside the point, and the ring as bright as the share that saw it. */
        const b = Math.hypot(dx, dy) / k;
        if (b > H.shadow * 0.98 && b < H.shadow * 1.15) {
          let seen = 0, kept = null;
          for (let s = 0; s < 16; s++) {
            const look = crossings(dx + ((s % 4) - 1.5) * cell / 4, dy + (((s / 4) | 0) - 1.5) * cell / 4);
            if (look.length) { seen++; kept ||= look; }
          }
          hits = kept ? kept.map((hit) => ({ ...hit, light: (hit.light * seen) / 16 })) : [];
        }
        for (const hit of hits) hit.index = py * bw + px;
        // The far side first, and the near side laid over it.
        if (hits.length === 2) {
          hits[1].light *= 1 - hits[0].fade;
          hits[0].over = 1;
          hits.reverse();
        }
        found.push(...hits);
      }
    }
    const canvas = this.hole.map?.canvas || document.createElement("canvas");
    canvas.width = bw;
    canvas.height = bh;
    const paint = canvas.getContext("2d");
    const count = found.length;
    this.hole.map = {
      key, canvas, paint, image: paint.createImageData(bw, bh), x: cx - half, y: cy - half, size: 2 * half,
      index: Int32Array.from(found, (point) => point.index),
      psi: Float32Array.from(found, (point) => point.psi),
      omega: Float32Array.from(found, (point) => point.omega),
      heat: Uint8Array.from(found, (point) => Math.round(Math.min(1, Math.max(0, (point.heat - 0.12) / 1.25)) * 255)),
      light: Float32Array.from(found, (point) => point.light),
      ring: Float32Array.from(found, (point) => point.ring),
      over: Uint8Array.from(found, (point) => point.over),
      count
    };
    return this.hole.map;
  },

  /* The disk's colour by how hot it looks: the colours of a hot body, from a
     dull red through orange and gold to white, and past white to blue where
     the side coming closer is shifted hottest. Gas this hot has its own
     colours whatever the mood; the mood colours the sky behind it. On a light
     page the same run in ink, darkest for the hottest. */
  holeColours(light) {
    const key = `${light}`;
    if (this.hole.lut?.key === key) return this.hole.lut.rgb;
    const stops = light ? NORDLYS_HOLE_INK : NORDLYS_HOLE_HEAT;
    const rgb = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const at = i / 255;
      const next = stops.findIndex(([offset]) => offset >= at);
      const [o1, c1] = stops[Math.max(0, next - 1)];
      const [o2, c2] = stops[Math.max(0, next)];
      const t = o2 > o1 ? (at - o1) / (o2 - o1) : 0;
      for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.round(c1[c] + (c2[c] - c1[c]) * t);
    }
    this.hole.lut = { key, rgb };
    return rgb;
  },

  // The disk at this moment of the scene clock: each ring turned by its own rate.
  paintDisk(map, light) {
    const rgb = this.holeColours(light);
    const data = map.image.data;
    const rings = this.hole.rings;
    const clock = this.t * NORDLYS_HOLE.spin;
    const exposure = light ? 3.2 : 1.8;
    for (let j = 0; j < map.count; j++) {
      const turn = (map.psi[j] + map.omega[j] * clock) / (Math.PI * 2);
      const at256 = ((turn - Math.floor(turn)) * 256) | 0;
      // Between two rings of the texture, so the streaks run on without steps.
      const ring = map.ring[j];
      const inner = ring | 0;
      const texture = rings[inner][at256] + (rings[inner + 1][at256] - rings[inner][at256]) * (ring - inner);
      const shine = 1 - Math.exp(-map.light[j] * texture * exposure);
      const at = map.index[j] * 4;
      const colour = map.heat[j] * 3;
      if (map.over[j]) {
        // Over the far side just painted at this point, as one coat of paint over another.
        const under = (data[at + 3] / 255) * (1 - shine);
        const total = shine + under;
        for (let c = 0; c < 3; c++) data[at + c] = total > 0 ? (rgb[colour + c] * shine + data[at + c] * under) / total : 0;
        data[at + 3] = total * 255;
        continue;
      }
      data[at] = rgb[colour];
      data[at + 1] = rgb[colour + 1];
      data[at + 2] = rgb[colour + 2];
      data[at + 3] = Math.round(Math.min(1, shine) * 255);
    }
    map.paint.putImageData(map.image, 0, 0);
  },

  /* The stars behind the hole, drifting slowly across, each where the hole
     bends its light: the direct image outside the Einstein ring and a
     fainter one inside it on the other side, both drawn out along the ring
     as far as the bending stretches them. */
  drawLensedStars(cx, cy, k, light) {
    const H = NORDLYS_HOLE;
    const ctx = this.ctx;
    const paths = NordlysBackgroundEngine.lightPaths();
    const spanX = this.w / (2 * k) + 12;
    const spanY = this.h / (2 * k) + 12;
    const drift = this.t * 0.012;
    const cosR = Math.cos(H.roll), sinR = Math.sin(H.roll);
    const ink = light ? [40, 46, 70] : [236, 242, 255];
    for (const star of this.hole.stars) {
      const sx = ((((star.x + drift + 1) % 2) + 2) % 2 - 1) * spanX;
      const sy = star.y * spanY;
      const away = Math.hypot(sx, sy);
      if (away < 1e-3) continue;
      const twinkle = 0.85 + 0.15 * Math.sin(this.t * 3 + star.phase);
      for (const side of [1, -1]) {
        const b = paths.image(away * side);
        if (!b) continue;
        // How much the bending stretches it along the ring, and squeezes it across.
        const along = b / away;
        const across = 1 / paths.slope(b);
        const shine = star.alpha * twinkle * Math.min(2.2, Math.pow(along * across, 0.45));
        if (shine < 0.03) continue;
        const ax = (sx / away) * b * side;
        const ay = (sy / away) * b * side;
        // From the hole's level back to the page, down the page positive.
        const x = cx + (ax * cosR - -ay * sinR) * k;
        const y = cy + (ax * sinR + -ay * cosR) * k;
        if (x < -20 || x > this.w + 20 || y < -20 || y > this.h + 20) continue;
        ctx.fillStyle = `rgba(${ink[0]}, ${ink[1]}, ${ink[2]}, ${Math.min(0.95, shine).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(x, y, star.size * Math.min(6, Math.max(1, Math.sqrt(along))), star.size * Math.min(1, Math.max(0.35, Math.sqrt(across))), Math.atan2(y - cy, x - cx) + Math.PI / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}, {
  // A thin disk's flux at radius r, from the innermost stable orbit out (Shakura and Sunyaev).
  diskFlux(r) {
    return r <= NORDLYS_HOLE.inner ? 0 : Math.pow(r, -3) * (1 - Math.sqrt(NORDLYS_HOLE.inner / r));
  },

  /* The paths of light past the hole, worked out once for every engine: for
     each impact parameter b, u = 1/r as the light sweeps round the hole, in
     steps of the sweep. It is kept as u, which runs smoothly where r runs
     off to infinity, so neighbouring paths can be read between: a half once
     the light has fallen in, below nought once it has got away. Integrated
     with a fourth-order Runge-Kutta step from far away, where u = 0 and
     du/dφ = 1/b. */
  lightPaths() {
    if (NordlysBackgroundEngine.paths) return NordlysBackgroundEngine.paths;
    const H = NORDLYS_HOLE;
    const [inside, outside] = H.rows;
    const rows = inside + outside;
    const edge = H.shadow + 1e-3;
    const impact = (row) => (row < inside ? (H.shadow * row) / inside : edge + (H.far - edge) * ((row - inside) / (outside - 1)) ** 2);
    const rowOf = (b) => (b < H.shadow ? (b / H.shadow) * inside : inside + Math.sqrt(Math.max(0, (b - edge) / (H.far - edge))) * (outside - 1));
    const step = H.sweep / H.steps;
    const table = new Float32Array(rows * (H.steps + 1));
    const away = new Float32Array(rows).fill(Infinity);
    const pull = (u) => 3 * u * u - u;
    for (let row = 0; row < rows; row++) {
      const b = Math.max(impact(row), 1e-3);
      let u = 0, v = 1 / b, fallen = false;
      for (let n = 1; n <= H.steps; n++) {
        const at = row * (H.steps + 1) + n;
        if (fallen) { table[at] = 0.5; continue; }
        const k1u = v, k1v = pull(u);
        const k2u = v + 0.5 * step * k1v, k2v = pull(u + 0.5 * step * k1u);
        const k3u = v + 0.5 * step * k2v, k3v = pull(u + 0.5 * step * k2u);
        const k4u = v + step * k3v, k4v = pull(u + step * k3u);
        const before = u;
        u += (step / 6) * (k1u + 2 * k2u + 2 * k3u + k4u);
        v += (step / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
        if (u >= 0.5) { fallen = true; table[at] = 0.5; continue; }
        // Past the way out the sum runs on below nought, which is all the reading between needs.
        if (u <= 0 && before > 0 && away[row] === Infinity) away[row] = (n - 1 + before / (before - u)) * step;
        table[at] = u;
      }
    }
    // The bending, past the table's reach as weak gravity has it.
    const bend = (b) => {
      if (b >= H.far) return 4 / b + (15 * Math.PI) / (4 * b * b);
      const at = rowOf(b);
      const low = Math.floor(at), high = Math.min(rows - 1, low + 1);
      if (!Number.isFinite(away[low]) || !Number.isFinite(away[high])) return Infinity;
      return away[low] + (away[high] - away[low]) * (at - low) - Math.PI;
    };
    // The lens equation for the stars: where on the sky, in masses, light at b came from.
    const source = (b) => b - H.distance * bend(b);
    const api = {
      // The table itself, for the GPU to read the same paths (holeGL).
      table, rows, inside, outside, edge,
      /* How far from the hole light at b is after sweeping `sweep` round it,
         read between the four nearest points of the table: nought once it
         has fallen in, Infinity once it has got away. */
      radius(b, sweep) {
        if (sweep > H.sweep) return 0;
        if (b >= H.far) return sweep < Math.PI ? b / Math.sin(sweep) : Infinity;
        const at = Math.min(rows - 1.001, rowOf(b));
        const row = Math.floor(at);
        const s = sweep / step;
        const n = Math.min(H.steps - 1, Math.floor(s));
        const read = (r) => table[r * (H.steps + 1) + n] + (table[r * (H.steps + 1) + n + 1] - table[r * (H.steps + 1) + n]) * (s - n);
        const u = read(row) + (read(row + 1) - read(row)) * (at - row);
        return u >= 0.5 ? 0 : u <= 0 ? Infinity : 1 / u;
      },
      // The impact parameter of the image of a star `where` masses out (negative: the other side).
      image(where) {
        let low = edge, high = Math.abs(where) + H.distance + 40;
        if (!(source(high) > where)) return 0;
        for (let i = 0; i < 40; i++) {
          const mid = (low + high) / 2;
          if (source(mid) > where) high = mid; else low = mid;
        }
        return (low + high) / 2;
      },
      // How fast the place on the sky moves as b does: one over the stretch across the ring.
      slope(b) {
        const d = Math.max(1e-3, b * 1e-3);
        return Math.max(1e-3, (source(b + d) - source(b - d)) / (2 * d));
      }
    };
    NordlysBackgroundEngine.paths = api;
    return api;
  }
});
