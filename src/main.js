const main = () => {
  createREGL({
    attributes: {
      alpha: false
    },
    onDone: start
  });
};

const start = (err, regl) => {
  const pr_height_map = loadTexture(regl, 'img/puerto-rico-heightmap-1024.png');

  const state = (Array(2)).fill().map(() =>
    regl.framebuffer({
      color: regl.texture({
        width: 1024,
        height: 512,
        wrap: 'clamp'
      }),
      depthStencil: false
    })
  );

  const update = regl({
    frag: `
    precision highp float;

    uniform sampler2D u_prev_state;
    uniform sampler2D u_height_map;
    
    varying vec2 v_uv;
    
    void main() {
      gl_FragColor = texture2D(u_prev_state, v_uv);
    }`,

    vert: `
    precision highp float;
    
    attribute vec2 a_position;
    
    varying vec2 v_uv;

    void main() {
      v_uv = a_position;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }`,

    attributes: {
      a_position: [-1, -1, -1, 1, 1, -1, 1, 1]
    },

    uniforms: {
      u_prev_state: ({tick}) => state[tick % 2],
      u_height_map: pr_height_map
    },

    depth: { enable: false },

    primitive: 'triangle strip',
    count: 4,

    framebuffer: ({tick}) => state[(tick + 1) % 2],
  });

  const draw = regl({
    frag: `
    precision highp float;

    uniform sampler2D u_prev_state;
    
    varying vec2 v_uv;
    
    void main() {
      gl_FragColor = texture2D(u_prev_state, v_uv);
    }`,

    vert: `
    precision highp float;
    
    attribute vec2 a_position;
    
    varying vec2 v_uv;

    void main() {
      v_uv = a_position;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }`,

    attributes: {
      a_position: [-1, -1, -1, 1, 1, -1, 1, 1]
    },

    uniforms: {
      u_prev_state: ({tick}) => state[tick % 2],
      u_height_map: pr_height_map
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
