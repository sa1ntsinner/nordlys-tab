/* ═══════════════════════════════════════════════════════════════════
   NORDLYS - SKY GL
   The long lines of the sky, drawn on the GPU.
   ═══════════════════════════════════════════════════════════════════ */

/* Chrome's 2D canvas draws a thick antialiased stroke by rasterising a
   coverage mask the size of the stroke's whole bounding box on the CPU — in
   the GPU process — and uploading it. A short stroke costs nothing that way;
   a long one that curls across the window costs its whole box. Silk stroked
   sixty such threads three times each, and on an integrated GPU that was a
   hundred milliseconds a frame: it ran at ten to eighteen frames a second
   while every other scene held thirty. The cost followed the box and not the
   ink — thinner passes, mitred joins or flat colour barely moved it, while
   half the device pixels halved it (docs/performance-plan.md).

   Here the same lines are triangle strips: the CPU lists the points, the GPU
   fills the strip's pixels and nothing around them, and the frame is laid
   onto the 2D canvas in one drawImage, so everything the engine does after a
   scene paints — the sheen, the sun, the quiet zones — is unchanged. A strip
   is drawn as up to three bands stacked across its width, the way the 2D
   scenes stroke one line two or three times, widest and faintest first, and
   the bands are combined in each pixel the way the canvas blends one stroke
   over the next. Only the screen uses this: a thumbnail and the quiet-zone
   sample are small enough for the 2D canvas, and are painted by it. */

// x, y and across in device pixels; r, g, b and a from 0 to 1; the core width.
const NORDLYS_GL_FLOATS = 8;

const NORDLYS_GL_VERTEX = `#version 300 es
in vec2 a_pos;
in float a_across;
in vec4 a_colour;
in float a_width;
uniform vec2 u_size;
uniform mat3 u_matrix;
out float v_across;
out vec4 v_colour;
out float v_width;
void main() {
  v_across = a_across;
  v_colour = a_colour;
  v_width = a_width;
  vec2 p = (u_matrix * vec3(a_pos, 1.0)).xy / u_size * 2.0 - 1.0;
  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
}`;

/* A pixel's share of a band is its overlap with the band across the line,
   which is what the canvas's own antialiasing works out. The bands under a
   pixel are combined as the canvas composites one pass over the next: screen
   on a dark sky, multiply on a light one. The colour arrives unpremultiplied
   and leaves premultiplied, as the canvas keeps it. */
const NORDLYS_GL_FRAGMENT = `#version 300 es
precision highp float;
in float v_across;
in vec4 v_colour;
in float v_width;
uniform vec2 u_bands[3];
uniform int u_count;
uniform float u_ink;
uniform bool u_light;
out vec4 colour;
float cover(float d, float w) {
  return clamp(min(d + 0.5, w * 0.5) - max(d - 0.5, -w * 0.5), 0.0, 1.0);
}
void main() {
  float d = abs(v_across);
  vec3 c = vec3(0.0);
  float a = 0.0;
  for (int i = 0; i < 3; i++) {
    if (i >= u_count) break;
    float s = u_bands[i].y * u_ink * v_colour.a * cover(d, u_bands[i].x * v_width);
    vec3 sc = s * v_colour.rgb;
    c = u_light ? sc + c - sc * a - c * s + sc * c : sc + c - sc * c;
    a = s + a - s * a;
  }
  if (a <= 0.0) discard;
  colour = vec4(c, a);
}`;

class NordlysSkyGL {
  // The colour a strip's tint callback writes, shared so a frame allocates nothing.
  static scratch = new Float32Array(4);
  static IDENTITY = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

  /* A layer, or null where there is no WebGL2 or no OffscreenCanvas; the
     engine then paints in 2D, as it always did. */
  static create() {
    if (typeof OffscreenCanvas === "undefined") return null;
    let gl = null;
    try {
      const surface = new OffscreenCanvas(1, 1);
      gl = surface.getContext("webgl2", {
        alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false,
        preserveDrawingBuffer: false, powerPreference: "low-power"
      });
      return gl ? new NordlysSkyGL(surface, gl) : null;
    } catch {
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      return null;
    }
  }

  constructor(surface, gl) {
    this.surface = surface;
    this.gl = gl;
    this.dropped = false;
    surface.addEventListener?.("webglcontextlost", (event) => {
      event.preventDefault();
      this.dropped = true;
    });
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "shader");
      return shader;
    };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, NORDLYS_GL_VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, NORDLYS_GL_FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "program");
    gl.useProgram(program);
    this.attributes = ["a_pos", "a_across", "a_colour", "a_width"].map((name) => gl.getAttribLocation(program, name));
    this.uniforms = Object.fromEntries(["u_size", "u_matrix", "u_bands", "u_count", "u_ink", "u_light"]
      .map((name) => [name, gl.getUniformLocation(program, name)]));
    this.streamBuffer = gl.createBuffer();
    this.layers = new Map();
    this.bands = new Float32Array(6);
    this.size = [1, 1];
    gl.enable(gl.BLEND);
  }

  // Lost to the driver, or let go of: either way, the engine paints in 2D.
  get lost() {
    return this.dropped || this.gl.isContextLost();
  }

  /* A frame the size of the canvas, cleared. */
  begin(width, height) {
    const gl = this.gl;
    if (this.surface.width !== width) this.surface.width = width;
    if (this.surface.height !== height) this.surface.height = height;
    this.size = [width, height];
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /* This frame's strip, uploaded to be drawn once. */
  stream(data, count) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.streamBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * NORDLYS_GL_FLOATS), gl.STREAM_DRAW);
    return { buffer: this.streamBuffer, count };
  }

  /* A strip that holds its shape between frames, kept on the GPU under a key
     and built again only when `version` changes. */
  layer(key, version, build) {
    let entry = this.layers.get(key);
    if (!entry || entry.version !== version) {
      const gl = this.gl;
      const { data, count } = build();
      const buffer = entry?.buffer || gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * NORDLYS_GL_FLOATS), gl.STATIC_DRAW);
      entry = { buffer, count, version };
      this.layers.set(key, entry);
    }
    return entry;
  }

  /* Draws a strip. `bands` are [width in cores, alpha], widest first.
     `blend` is how one line meets another: "screen" on a dark sky; "over" on
     a light one, where the canvas multiplies — for lines this faint the two
     differ by well under a percent; "max" for lines that should merge where
     they touch rather than brighten. `matrix` moves the whole strip, for a
     sky that turns without being rebuilt. */
  strips(source, { bands, blend = "screen", light = false, ink = 1, matrix = null }) {
    if (!source.count) return;
    const gl = this.gl;
    const u = this.uniforms;
    const stride = NORDLYS_GL_FLOATS * 4;
    const [pos, across, colour, width] = this.attributes;
    gl.bindBuffer(gl.ARRAY_BUFFER, source.buffer);
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(across);
    gl.vertexAttribPointer(across, 1, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(colour);
    gl.vertexAttribPointer(colour, 4, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(width);
    gl.vertexAttribPointer(width, 1, gl.FLOAT, false, stride, 28);
    this.bands.fill(0);
    bands.slice(0, 3).forEach(([w, a], i) => { this.bands[i * 2] = w; this.bands[i * 2 + 1] = a; });
    gl.uniform2f(u.u_size, this.size[0], this.size[1]);
    gl.uniformMatrix3fv(u.u_matrix, false, matrix || NordlysSkyGL.IDENTITY);
    gl.uniform2fv(u.u_bands, this.bands);
    gl.uniform1i(u.u_count, Math.min(3, bands.length));
    gl.uniform1f(u.u_ink, ink);
    gl.uniform1i(u.u_light, light ? 1 : 0);
    if (blend === "max") {
      gl.blendEquation(gl.MAX);
    } else {
      gl.blendEquation(gl.FUNC_ADD);
      if (blend === "over") gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      else gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, source.count);
  }

  /* Lays the frame onto a 2D context pixel for pixel. The layer is the size
     of the canvas, so the context's transform is set aside rather than
     trusted to map it exactly: a canvas one device pixel narrower than its
     window times the ratio would otherwise resample every line. */
  paint(ctx, op = "source-over") {
    const frame = this.surface.transferToImageBitmap();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = op;
    ctx.drawImage(frame, 0, 0);
    ctx.restore();
    frame.close();
  }

  /* Gives the context back: a scene that draws no long lines keeps no GPU
     surface the size of the window. */
  release() {
    this.layers.clear();
    this.dropped = true;
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }

  /* A turn of `angle` about (cx, cy), as the strip's matrix: clockwise on the
     screen for a positive angle, the way the canvas measures arcs. Column
     major, as uniformMatrix3fv takes it. */
  static turn(angle, cx, cy) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Float32Array([c, s, 0, -s, c, 0, cx - c * cx + s * cy, cy - s * cx - c * cy, 1]);
  }

  /* The vertices a set of lines needs, joined into one strip: two a point,
     and one repeated at each end of each line. */
  static room(counts) {
    let total = 0;
    for (const count of counts) total += count * 2 + 2;
    return total;
  }

  /* Appends one line to a strip: two vertices a point, `reach` device pixels
     out along the normal on either side, and the first and last repeated so
     that lines join into one draw without a triangle between them. `points`
     are CSS pixels, [x0, y0, x1, y1, ...], and `scale` takes them to device
     pixels. `tint(i, rgba)` writes the colour and alpha at point i. `cap`
     pushes both ends out along the line by that many device pixels, as a
     square cap would. Returns the next free vertex. */
  static strip(out, at, points, count, scale, width, reach, tint, cap = 0) {
    const rgba = NordlysSkyGL.scratch;
    let v = at;
    const put = (x, y, across) => {
      const i = v * NORDLYS_GL_FLOATS;
      out[i] = x;
      out[i + 1] = y;
      out[i + 2] = across;
      out[i + 3] = rgba[0];
      out[i + 4] = rgba[1];
      out[i + 5] = rgba[2];
      out[i + 6] = rgba[3];
      out[i + 7] = width;
      v++;
    };
    for (let i = 0; i < count; i++) {
      // The normal at a point bisects the segments either side of it.
      const a = i > 0 ? i - 1 : 0;
      const b = i < count - 1 ? i + 1 : count - 1;
      let dx = points[2 * b] - points[2 * a];
      let dy = points[2 * b + 1] - points[2 * a + 1];
      const length = Math.hypot(dx, dy) || 1;
      dx /= length;
      dy /= length;
      let x = points[2 * i] * scale;
      let y = points[2 * i + 1] * scale;
      if (cap && i === 0) { x -= dx * cap; y -= dy * cap; }
      if (cap && i === count - 1) { x += dx * cap; y += dy * cap; }
      const nx = -dy * reach;
      const ny = dx * reach;
      tint(i, rgba);
      if (i === 0 && at > 0) put(x + nx, y + ny, reach);
      put(x + nx, y + ny, reach);
      put(x - nx, y - ny, -reach);
    }
    const last = (v - 1) * NORDLYS_GL_FLOATS;
    out.copyWithin(v * NORDLYS_GL_FLOATS, last, last + NORDLYS_GL_FLOATS);
    return v + 1;
  }
}
