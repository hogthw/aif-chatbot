// Giả lập R2, KV, Rate Limiter cho test (chạy bằng Node 22, không cần Cloudflare)
export class MemR2 {
  constructor() { this.m = new Map(); }
  async put(key, bytes, opts) { this.m.set(key, { bytes: new Uint8Array(bytes), opts }); }
  async get(key) { const o = this.m.get(key); if (!o) return null; return { text: async () => new TextDecoder().decode(o.bytes), arrayBuffer: async () => o.bytes.buffer }; }
  async delete(key) { this.m.delete(key); }
  keys() { return [...this.m.keys()].sort(); }
}
export class MemKV {
  constructor() { this.m = new Map(); }
  async get(k) { return this.m.has(k) ? this.m.get(k) : null; }
  async put(k, v) { this.m.set(k, String(v)); }
}
export function limiter(n) { let c = 0; return { limit: async () => ({ success: ++c <= n }) }; }

export async function readSSE(res) {
  const txt = await res.text();
  return txt.split("\n\n").filter(Boolean).map((b) => JSON.parse(b.replace(/^data:\s*/, "")));
}
export function sseStream(pieces, shape = "response") {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const p of pieces) {
        const obj = shape === "response" ? { response: p } : { choices: [{ delta: { content: p } }] };
        c.enqueue(enc.encode("data: " + JSON.stringify(obj) + "\n\n"));
      }
      c.enqueue(enc.encode("data: [DONE]\n\n"));
      c.close();
    },
  });
}
