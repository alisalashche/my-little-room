// port of the shadertoy shader "Prehistoric" (sepia + film grain): https://www.shadertoy.com/view/Xl3cDn
// glsl -> wgsl, line by line. changes for my little room:
// - iChannel0 (the street photo) = our room render (tex)
// - iChannel1 (the greenscreen video) is left out, so the greenscreen mask is gone
// - added interaction: inside the lens around the pointer the room keeps its colours
fn sepiaFilter(tex: texture_2d<f32>, tex_sampler: sampler, uv: vec2<f32>, resolution: vec2<f32>, mouse: vec2<f32>, time: f32, lens: f32) -> vec4<f32> {
  // glsl: vec3 bg = texture(iChannel0, uv).rgb;
  // our render is linear light, so first squeeze it into screen colours like a shadertoy image
  let raw = textureSampleLevel(tex, tex_sampler, uv, 0.0).rgb;
  let col = pow(raw / (raw + vec3<f32>(0.6)), vec3<f32>(0.85));

  // glsl: vec3 sepia = vec3(col.r * .393 + col.g * .769 + col.b * .189, ...);
  let sepia = vec3<f32>(
    col.r * 0.393 + col.g * 0.769 + col.b * 0.189,
    col.r * 0.349 + col.g * 0.686 + col.b * 0.168,
    col.r * 0.272 + col.g * 0.534 + col.b * 0.131,
  );

  // glsl: film grain, float x = (uv.x + 4.0) * (uv.y + 4.0) * (iTime * 10.0);
  // glsl mod() always rounds down, so it is written out with floor() (wgsl % works differently for negatives)
  let noiseStrength = 50.0;
  let x = (uv.x + 4.0) * (uv.y + 4.0) * (time * 10.0);
  let a = (x - 13.0 * floor(x / 13.0)) + 1.0;
  let b = (x - 123.0 * floor(x / 123.0)) + 1.0;
  let ab = a * b;
  let grain = vec3<f32>((ab - 0.01 * floor(ab / 0.01)) - 0.005) * noiseStrength;

  // added: the lens around the pointer shows the room in colour, the rest is an old photo
  let aspect = resolution.x / resolution.y;
  let d = length((uv - mouse) * vec2<f32>(aspect, 1.0));
  let reveal = 1.0 - smoothstep(lens * 0.75, lens, d);
  let result = mix(sepia + grain, col, reveal);

  // glsl: fragColor = vec4(sepia + grain, 1.0);
  // back to linear light, three.js converts it for the screen
  return vec4<f32>(pow(clamp(result, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(2.2)), 1.0);
}
