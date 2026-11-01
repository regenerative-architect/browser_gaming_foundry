/** FNV-1a + mulberry32: deterministic across compliant JavaScript engines. No Math.random in generation. */
export function seedNumber(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function rngFromSeed(text) {
  let a = seedNumber(String(text));
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffled(items, rng) {
  const result = [...items];
  for (let i = result.length-1; i > 0; i--) {
    const j = Math.floor(rng() * (i+1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function randomSeed() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint32Array(2); crypto.getRandomValues(bytes);
    return `${bytes[0].toString(36)}-${bytes[1].toString(36)}`;
  }
  // Non-security fallback; this seed is only for gameplay, not for generating secrets.
  return `trail-${Date.now().toString(36)}`;
}
