const main = () => {
  createREGL({
    container: document.getElementById('pr-graphic'),
    extensions: [
    ],
    attributes: {
      alpha: true,
      premultipliedAlpha: true,
      depth: false,
      antialias: false,
    },
    onDone: start,
  });
};

const start = (err, regl) => {
  const pr_height_tex = loadTexture(regl, 'img/puerto-rico-heightmap-1024.png');
  const random_tex = loadTexture(regl, 'img/random.png', {
    min: 'nearest',
    mag: 'nearest',
    wrap: 'repeat',
  });

  const state_width = 1024;
  const state_height = 512;
  const state_aspect_ratio = state_width / state_height;
  const state_inv_aspect_ratio = state_height / state_width;
  const state_pixel_scale = [state_aspect_ratio / state_width, 1.0 / state_height];

  const state = [];
  for (let i = 0; i < 2; ++i) {
    state.push(regl.framebuffer({
      color: regl.texture({
        width: 1024,
        height: 512,
        wrap: 'clamp',
        min: 'linear',
        mag: 'linear',
      }),
      depthStencil: false,
    }));
  }

  const update = regl({
    frag: `
    precision highp float;

    uniform sampler2D u_prev_state;
    uniform sampler2D u_elevation_tex;
    uniform sampler2D u_random_tex;
    uniform vec2 u_state_size;
    uniform float u_time;
    uniform float u_aspect;

    varying vec2 v_texcoord;

    float hash11(float p) {
      vec3 p3  = fract(vec3(p) * 0.1031);
      p3 += dot(p3, p3.yzx + 19.19);
      return fract((p3.x + p3.y) * p3.z);
    }
    float hash13(vec3 p3) {
      p3  = fract(p3 * 0.1031);
      p3 += dot(p3, p3.yzx + 19.19);
      return fract((p3.x + p3.y) * p3.z);
    }
    vec2 hash21(float p) {
      vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
      p3 += dot(p3, p3.yzx + 19.19);
      return fract((p3.xx + p3.yz) * p3.zy);
    }

    vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
      return a + b * cos(6.28318 * (c * t + d));
    }

    void main() {
      vec2 aspect_scale = vec2(1.0, u_aspect);

      vec4 c = texture2D(u_prev_state, v_texcoord);

      float decay = hash13(vec3(v_texcoord * 200.0, u_time * 100.0));
      c *= 0.97 + 0.03 * (1.0 - decay * decay);

      float elevation = texture2D(u_elevation_tex, v_texcoord).r;

      const int N = 6;
      for (int i = 0; i < N; ++i) {
        float t = (u_time * 0.25) - (float(i) / float(N));
        float ti = floor(t) * float(N) + float(i);
        float tf = fract(t);

        float opacity = smoothstep(0.5, 0.0, abs(tf - 0.5));
        vec2 ctr = mix(vec2(0.0, 0.2), vec2(1.0, 0.8), hash21(ti));
        float r = 0.1 + hash11(ti) * 0.3;

        opacity *= smoothstep(r, 0.0, length((ctr - v_texcoord) / aspect_scale));
        float opacity_min = 0.5 + 0.5 * hash11(ti + 12.845);
        opacity_min *= opacity_min;
        opacity *= 0.04 * mix(opacity_min, 1.0, 1.0 - elevation);
        
        vec3 col = pal(ti * 0.2, vec3(0.5,0.5,0.5), vec3(0.5,0.5,0.5), vec3(1.0,1.0,0.5), vec3(0.8,0.90,0.30));
        c.rgb += col * opacity;
      }

      gl_FragColor = vec4(c.rgb, 1.0);
    }`,

    vert: `
    precision highp float;

    attribute vec2 a_texcoord;
    attribute vec2 a_position;

    varying vec2 v_texcoord;

    void main() {
      v_texcoord = a_texcoord;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }`,

    attributes: {
      a_texcoord: [0, 0, 0, 1, 1, 0, 1, 1],
      a_position: [-1, -1, -1, 1, 1, -1, 1, 1],
    },

    uniforms: {
      u_prev_state: ({tick}) => state[tick % 2],
      u_elevation_tex: pr_height_tex,
      u_random_tex: random_tex,
      u_state_size: [state_width, state_height],
      u_time: ({time}) => time,
      u_aspect: state_aspect_ratio,
    },

    primitive: 'triangle strip',
    count: 4,

    framebuffer: ({tick}) => state[(tick + 1) % 2],
  });

  const draw = regl({
    frag: `
    precision highp float;

    uniform sampler2D u_prev_state;
    uniform sampler2D u_elevation_tex;

    varying vec2 v_texcoord;

    void main() {
      gl_FragColor = texture2D(u_prev_state, v_texcoord);
      vec4 elev = texture2D(u_elevation_tex, v_texcoord);
      gl_FragColor.rgb += (1.0 - elev.r) * 0.05;
      gl_FragColor *= elev.a;
    }`,

    vert: `
    precision highp float;

    uniform mat3 u_transform;

    attribute vec2 a_position;
    attribute vec2 a_texcoord;

    varying vec2 v_texcoord;

    void main() {
      v_texcoord = a_texcoord;
      gl_Position = vec4((u_transform * vec3(a_position, 1.0)).xy, 0.0, 1.0);
    }`,

    attributes: {
      a_texcoord: [0, 0, 0, 1, 1, 0, 1, 1],
      a_position: [-1, -1, -1, 1, 1, -1, 1, 1],
    },

    uniforms: {
      u_prev_state: ({tick}) => state[tick % 2],
      u_elevation_tex: pr_height_tex,
      u_transform: ({viewportWidth, viewportHeight}) => {
        const aspect = viewportWidth / viewportHeight;
        const scale = mat3.fromScaling([], [state_inv_aspect_ratio / aspect, 1.0]);
        return mat3.rotate([], scale, Math.PI / 2);
      },
    },

    depth: { enable: false },

    primitive: 'triangle strip',
    count: 4,
  });

  regl.frame(() => {
    regl.clear({
      color: () => [0, 0, 0, 1],
    });
    draw();
    update();
  });
};
