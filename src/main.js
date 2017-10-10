const main = () => {
  createREGL({
    extensions: [
    ],
    attributes: {
      alpha: false
    },
    onDone: start
  });
};

const start = (err, regl) => {
  const pr_normal_tex = loadTexture(regl, 'img/puerto-rico-normals-1024.png');
  const pr_height_tex = loadTexture(regl, 'img/puerto-rico-heightmap-1024.png', {
    min: 'nearest',
    mag: 'nearest',
  });
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

  const state = (Array(2)).fill().map(() =>
    regl.framebuffer({
      color: regl.texture({
        width: 1024,
        height: 512,
        wrap: 'clamp',
        min: 'linear',
        mag: 'linear',
      }),
      depthStencil: false,
    })
  );

  const update = regl({
    frag: `
    precision highp float;

    uniform sampler2D u_prev_state;
    uniform sampler2D u_elevation_tex, u_normal_tex;
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
    float hash12(vec2 p) {
      vec3 p3  = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 19.19);
      return fract((p3.x + p3.y) * p3.z);
    }
    float hash13(vec3 p3) {
      p3  = fract(p3 * 0.1031);
      p3 += dot(p3, p3.yzx + 19.19);
      return fract((p3.x + p3.y) * p3.z);
    }
    vec2 hash22(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
      p3 += dot(p3, p3.yzx + 19.19);
      return fract((p3.xx+p3.yz)*p3.zy);
    }
    vec2 hash23(vec3 p3) {
      p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
      p3 += dot(p3, p3.yzx + 19.19);
      return fract((p3.xx + p3.yz) * p3.zy);
    }
    vec2 hash21(float p) {
      vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
      p3 += dot(p3, p3.yzx + 19.19);
      return fract((p3.xx + p3.yz) * p3.zy);
    }

    vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
      return a + b * cos(6.28318 * (c * t + d));
    }

    vec4 gaussian(vec4 x, vec4 x_nw, vec4 x_n, vec4 x_ne, vec4 x_w, vec4 x_e, vec4 x_sw, vec4 x_s, vec4 x_se) {
      const float G0 = 0.25;
      const float G1 = 0.125;
      const float G2 = 0.0625;
      return G0 * x + G1 * (x_n + x_e + x_w + x_s) + G2 * (x_nw + x_sw + x_ne + x_se);
    }

    void main() {
      vec2 aspect_scale = vec2(1.0, u_aspect);

      vec4 c = vec4(0.0);

      vec4 normal_texel = texture2D(u_normal_tex, v_texcoord);
      vec2 normal = normal_texel.xy * 2.0 - 1.0;

#if 0
      vec2 step = 1.0 / u_state_size;
      vec2 uv = v_texcoord;// + normal * -50.0 * step;
      c += gaussian(texture2D(u_prev_state, uv),
                    texture2D(u_prev_state, uv + vec2(    0.0,  step.y)),
                    texture2D(u_prev_state, uv + vec2( step.x,  step.y)),
                    texture2D(u_prev_state, uv + vec2( step.x,     0.0)),
                    texture2D(u_prev_state, uv + vec2( step.x, -step.y)),
                    texture2D(u_prev_state, uv + vec2(    0.0, -step.y)),
                    texture2D(u_prev_state, uv + vec2(-step.x, -step.y)),
                    texture2D(u_prev_state, uv + vec2(-step.x,     0.0)),
                    texture2D(u_prev_state, uv + vec2(-step.x,  step.y)));
#else
      c += texture2D(u_prev_state, v_texcoord);
#endif

      float decay = hash13(vec3(v_texcoord * 500.0, u_time * 100.0));
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

      c *= normal_texel.a;

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
      u_normal_tex: pr_normal_tex,
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

    varying vec2 v_texcoord;

    void main() {
      gl_FragColor = texture2D(u_prev_state, v_texcoord);
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
      u_transform: ({viewportWidth, viewportHeight}) => {
        const inv_aspect = viewportHeight / viewportWidth;
        return mat3.fromScaling([], [0.9, 0.9 * state_inv_aspect_ratio / inv_aspect]);
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
