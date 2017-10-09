const main = () => {
  createREGL({
    attributes: {
      alpha: false
    },
    onDone: start
  });
};

const start = (err, regl) => {
  const pr_tex_opts = {
    min: 'nearest',
    mag: 'nearest',
  };

  const pr_normals = loadTexture(regl, 'img/puerto-rico-normals-1024.png', pr_tex_opts);
  const pr_heights = loadTexture(regl, 'img/puerto-rico-heightmap-1024.png', pr_tex_opts);

  const state_width = 1024;
  const state_height = 512;
  const state_aspect_ratio = state_width / state_height;
  const state_pixel_scale = [1.0, 1.0 / state_aspect_ratio];

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
    uniform sampler2D u_normals;
    uniform float u_time;
    uniform vec2 u_pixel_scale;

    varying vec2 v_texcoord;

    vec2 hash21(float p) {
      vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
      p3 += dot(p3, p3.yzx + 19.19);
      return fract((p3.xx + p3.yz) * p3.zy);
    }

    void main() {
      vec4 normal_texel = texture2D(u_normals, v_texcoord);
      vec3 normal = normal_texel.xyz * 2.0 - 1.0;

      vec2 disp = normal.xy * u_pixel_scale * 0.1;
      vec3 c = texture2D(u_prev_state, v_texcoord - disp).rgb;
      c *= 0.99;
      c += vec3(smoothstep(0.01, 0.0, distance(v_texcoord, hash21(floor(u_time * 2.0)))));

      gl_FragColor = vec4(c, normal_texel.a);
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
      u_normals: pr_normals,
      u_heights: pr_heights,
      u_time: ({time}) => time,
      u_pixel_scale: state_pixel_scale,
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

    attribute vec2 a_position;
    attribute vec2 a_texcoord;

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
      u_prev_state: ({tick}) => state[tick % 2]
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
