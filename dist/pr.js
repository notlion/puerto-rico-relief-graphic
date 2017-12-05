'use strict';var main=function main(){createREGL({container:document.getElementById('pr-graphic'),extensions:[],attributes:{alpha:true,premultipliedAlpha:true,depth:false,antialias:false},onDone:start})};var start=function start(err,regl){var pr_height_tex=loadTexture(regl,'img/puerto-rico-heightmap-1024.png');var random_tex=loadTexture(regl,'img/random.png',{min:'nearest',mag:'nearest',wrap:'repeat'});var state_width=1024;var state_height=512;var state_aspect_ratio=state_width/state_height;var state_inv_aspect_ratio=state_height/state_width;var state_pixel_scale=[state_aspect_ratio/state_width,1/state_height];var state=[];for(var i=0;i<2;++i){state.push(regl.framebuffer({color:regl.texture({width:1024,height:512,wrap:'clamp',min:'linear',mag:'linear'}),depthStencil:false}))}var update=regl({frag:'\n    precision highp float;\n\n    uniform sampler2D u_prev_state;\n    uniform sampler2D u_elevation_tex;\n    uniform sampler2D u_random_tex;\n    uniform vec2 u_state_size;\n    uniform float u_time;\n    uniform float u_aspect;\n\n    varying vec2 v_texcoord;\n\n    float hash11(float p) {\n      vec3 p3  = fract(vec3(p) * 0.1031);\n      p3 += dot(p3, p3.yzx + 19.19);\n      return fract((p3.x + p3.y) * p3.z);\n    }\n    float hash13(vec3 p3) {\n      p3  = fract(p3 * 0.1031);\n      p3 += dot(p3, p3.yzx + 19.19);\n      return fract((p3.x + p3.y) * p3.z);\n    }\n    vec2 hash21(float p) {\n      vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));\n      p3 += dot(p3, p3.yzx + 19.19);\n      return fract((p3.xx + p3.yz) * p3.zy);\n    }\n\n    vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d) {\n      return a + b * cos(6.28318 * (c * t + d));\n    }\n\n    void main() {\n      vec2 aspect_scale = vec2(1.0, u_aspect);\n\n      vec4 c = texture2D(u_prev_state, v_texcoord);\n\n      float decay = hash13(vec3(v_texcoord * 200.0, u_time * 100.0));\n      c *= 0.97 + 0.03 * (1.0 - decay * decay);\n\n      float elevation = texture2D(u_elevation_tex, v_texcoord).r;\n\n      const int N = 6;\n      for (int i = 0; i < N; ++i) {\n        float t = (u_time * 0.25) - (float(i) / float(N));\n        float ti = floor(t) * float(N) + float(i);\n        float tf = fract(t);\n\n        float opacity = smoothstep(0.5, 0.0, abs(tf - 0.5));\n        vec2 ctr = mix(vec2(0.0, 0.2), vec2(1.0, 0.8), hash21(ti));\n        float r = 0.1 + hash11(ti) * 0.3;\n\n        opacity *= smoothstep(r, 0.0, length((ctr - v_texcoord) / aspect_scale));\n        float opacity_min = 0.5 + 0.5 * hash11(ti + 12.845);\n        opacity_min *= opacity_min;\n        opacity *= 0.04 * mix(opacity_min, 1.0, 1.0 - elevation);\n        \n        vec3 col = pal(ti * 0.2, vec3(0.5,0.5,0.5), vec3(0.5,0.5,0.5), vec3(1.0,1.0,0.5), vec3(0.8,0.90,0.30));\n        c.rgb += col * opacity;\n      }\n\n      gl_FragColor = vec4(c.rgb, 1.0);\n    }',vert:'\n    precision highp float;\n\n    attribute vec2 a_texcoord;\n    attribute vec2 a_position;\n\n    varying vec2 v_texcoord;\n\n    void main() {\n      v_texcoord = a_texcoord;\n      gl_Position = vec4(a_position, 0.0, 1.0);\n    }',attributes:{a_texcoord:[0,0,0,1,1,0,1,1],a_position:[-1,-1,-1,1,1,-1,1,1]},uniforms:{u_prev_state:function u_prev_state(_ref){var tick=_ref.tick;return state[tick%2]},u_elevation_tex:pr_height_tex,u_random_tex:random_tex,u_state_size:[state_width,state_height],u_time:function u_time(_ref2){var time=_ref2.time;return time},u_aspect:state_aspect_ratio},primitive:'triangle strip',count:4,framebuffer:function framebuffer(_ref3){var tick=_ref3.tick;return state[(tick+1)%2]}});var draw=regl({frag:'\n    precision highp float;\n\n    uniform sampler2D u_prev_state;\n    uniform sampler2D u_elevation_tex;\n\n    varying vec2 v_texcoord;\n\n    void main() {\n      gl_FragColor = texture2D(u_prev_state, v_texcoord);\n      vec4 elev = texture2D(u_elevation_tex, v_texcoord);\n      gl_FragColor.rgb += (1.0 - elev.r) * 0.05;\n      gl_FragColor *= elev.a;\n    }',vert:'\n    precision highp float;\n\n    uniform mat3 u_transform;\n\n    attribute vec2 a_position;\n    attribute vec2 a_texcoord;\n\n    varying vec2 v_texcoord;\n\n    void main() {\n      v_texcoord = a_texcoord;\n      gl_Position = vec4((u_transform * vec3(a_position, 1.0)).xy, 0.0, 1.0);\n    }',attributes:{a_texcoord:[0,0,0,1,1,0,1,1],a_position:[-1,-1,-1,1,1,-1,1,1]},uniforms:{u_prev_state:function u_prev_state(_ref4){var tick=_ref4.tick;return state[tick%2]},u_elevation_tex:pr_height_tex,u_transform:function u_transform(_ref5){var viewportWidth=_ref5.viewportWidth,viewportHeight=_ref5.viewportHeight;var aspect=viewportWidth/viewportHeight;var scale=mat3.fromScaling([],[state_inv_aspect_ratio/aspect,1]);return mat3.rotate([],scale,Math.PI/2)}},depth:{enable:false},primitive:'triangle strip',count:4});regl.frame(function(){regl.clear({color:function color(){return[0,0,0,1]}});draw();update()})};
'use strict';var mix=function mix(a,b,t){return a+(b-a)*t};var loadTexture=function loadTexture(regl,url,opts){var img=new Image;img.src=url;var defaults={data:img,min:'linear',mag:'linear',flipY:true};if(opts!==undefined){for(var k in opts){defaults[k]=opts[k]}}var tex=regl.texture({data:null,width:1,height:1});img.addEventListener('load',function(){tex=regl.texture(defaults)});return function(){return tex}};var loadCube=function loadCube(regl,url){var cube=regl.cube(4);var faces=[];var numComplete=0;var onLoad=function onLoad(i){if(++numComplete==6){cube=regl.cube({faces:[faces[1],faces[3],faces[4],faces[5],faces[0],faces[2]],min:'linear mipmap linear',mag:'linear'})}};var _loop=function _loop(i){var img=new Image;img.src=url.replace('{}',i);img.addEventListener('load',function(){return onLoad(i)});faces.push(img)};for(var i=0;i<6;++i){_loop(i)}return function(){return cube}};
