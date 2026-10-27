// webgl-lane.renderer.ts
//
// Draws the oil pattern as one textured quad lying on the lane.
//
// That is genuinely all the AR layer has to render: oil is flat, has no
// visible height and no parallax, so there is no scene graph, no lighting and
// no depth sorting here. A single unlit alpha-blended quad is the whole job,
// which is why this is a couple of hundred lines rather than a dependency.

import { LANE_LENGTH_FT, LANE_WIDTH_M, feetToMetres } from 'src/app/core/utils/pattern-utils/board.utils';

const VERTEX_SHADER = `
attribute vec3 position;
attribute vec2 uv;
uniform mat4 modelViewProjection;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = modelViewProjection * vec4(position, 1.0);
}`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D pattern;
uniform float opacity;
varying vec2 vUv;
void main() {
  vec4 texel = texture2D(pattern, vUv);
  gl_FragColor = vec4(texel.rgb, texel.a * opacity);
}`;

/** Column-major 4x4 multiply, matching the layout WebXR hands us. */
export function multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);

  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + row] * b[column * 4 + k];
      }
      out[column * 4 + row] = sum;
    }
  }

  return out;
}

export class WebGlLaneRenderer {
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private uvBuffer: WebGLBuffer | null = null;
  private texture: WebGLTexture | null = null;
  private hasTexture = false;

  constructor(private readonly gl: WebGLRenderingContext) {
    this.build();
  }

  private compile(type: number, source: string): WebGLShader | null {
    const shader = this.gl.createShader(type);
    if (!shader) {
      return null;
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Lane shader failed to compile:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private build(): void {
    const vertex = this.compile(this.gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = this.compile(this.gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertex || !fragment) {
      return;
    }

    const program = this.gl.createProgram();
    if (!program) {
      return;
    }

    this.gl.attachShader(program, vertex);
    this.gl.attachShader(program, fragment);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Lane program failed to link:', this.gl.getProgramInfoLog(program));
      return;
    }

    this.program = program;

    // The quad lives in lane space: X across from the centreline, Y up, Z
    // downlane from the foul line. The anchor matrix places it in the world.
    const halfWidth = LANE_WIDTH_M / 2;
    const length = feetToMetres(LANE_LENGTH_FT);

    this.positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-halfWidth, 0, 0, halfWidth, 0, 0, -halfWidth, 0, length, -halfWidth, 0, length, halfWidth, 0, 0, halfWidth, 0, length]),
      this.gl.STATIC_DRAW,
    );

    // The baked texture puts the foul line at the bottom of the image, so v
    // runs 1 at the foul line to 0 at the pin deck.
    this.uvBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.uvBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]), this.gl.STATIC_DRAW);
  }

  /** Uploads a baked pattern texture from a data URI. */
  async setTexture(dataUri: string): Promise<void> {
    const image = await loadImage(dataUri);

    this.texture ??= this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);

    // The texture is a power of two (256 x 2048), so mipmapping is available —
    // worth it, because the far end of the lane shimmers badly without it.
    this.gl.generateMipmap(this.gl.TEXTURE_2D);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

    this.hasTexture = true;
  }

  clearTexture(): void {
    this.hasTexture = false;
  }

  /** Draws the lane for one eye/view. */
  draw(projection: Float32Array, view: Float32Array, model: Float32Array, opacity = 1): void {
    if (!this.program || !this.hasTexture) {
      return;
    }

    const gl = this.gl;
    gl.useProgram(this.program);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    // The overlay lies on a real surface we have no depth for, so writing depth
    // would only let it occlude itself.
    gl.depthMask(false);

    const mvp = multiplyMatrices(projection, multiplyMatrices(view, model));
    gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'modelViewProjection'), false, mvp);
    gl.uniform1f(gl.getUniformLocation(this.program, 'opacity'), opacity);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(gl.getUniformLocation(this.program, 'pattern'), 0);

    const positionLocation = gl.getAttribLocation(this.program, 'position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

    const uvLocation = gl.getAttribLocation(this.program, 'uv');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.enableVertexAttribArray(uvLocation);
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.depthMask(true);
  }

  dispose(): void {
    this.gl.deleteBuffer(this.positionBuffer);
    this.gl.deleteBuffer(this.uvBuffer);
    if (this.texture) {
      this.gl.deleteTexture(this.texture);
    }
    if (this.program) {
      this.gl.deleteProgram(this.program);
    }
  }
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not decode the pattern texture.'));
    image.src = source;
  });
}
