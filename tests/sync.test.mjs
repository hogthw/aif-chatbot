import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { runSync, r2KeyOf, labelOf, idOf } from "../workers/aif-kb-sync/src/sync.js";
import { _resetTokenCache } from "../workers/aif-kb-sync/src/google.js";
import worker from "../workers/aif-kb-sync/src/index.js";
import { MemR2, MemKV } from "./helpers.mjs";

async function makeSA() {
  const kp = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const der = Buffer.from(await webcrypto.subtle.exportKey("pkcs8", kp.privateKey)).toString("base64");
  const pem = "-----BEGIN PRIVATE KEY-----\n" + der.match(/.{1,64}/g).join("\n") + "\n-----END PRIVATE KEY-----\n";
  return { sa: JSON.stringify({ client_email: "kb@test.iam.gserviceaccount.com", private_key: pem }), pub: kp.publicKey };
}
const b64d = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

// Ổ Drive giả: cây thư mục + nội dung
function fakeDrive(tree, pub, log) {
  return async (url, init) => {
    url = String(url);
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      const p = new URLSearchParams(init.body); const [h, b, s] = p.get("assertion").split(".");
      const ok = await webcrypto.subtle.verify("RSASSA-PKCS1-v1_5", pub, b64d(s), new TextEncoder().encode(h + "." + b));
      const claims = JSON.parse(b64d(b).toString());
      if (!ok || claims.scope !== "https://www.googleapis.com/auth/drive.readonly") return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
      return Response.json({ access_token: "tok", expires_in: 3600 });
    }
    assert.equal(init.headers.Authorization, "Bearer tok");
    const u = new URL(url);
    if (u.pathname === "/drive/v3/files") {
      const parent = /'(.+?)' in parents/.exec(u.searchParams.get("q"))[1];
      return Response.json({ files: tree.filter((f) => f.parent === parent).map(({ parent, body, ...f }) => f) });
    }
    const id = u.pathname.split("/")[4];
    const f = tree.find((x) => x.id === id);
    log && log.push(u.pathname.endsWith("/export") ? "export:" + id : "get:" + id);
    return new Response(f.body);
  };
}
const F = "application/vnd.google-apps.folder";
function baseTree() {
  return [
    { id: "d1", parent: "ROOT", name: "02-faq", mimeType: F },
    { id: "d2", parent: "ROOT", name: "03-sach", mimeType: F },
    { id: "d3", parent: "d2", name: "ai-first-business", mimeType: F },
    { id: "f1", parent: "d1", name: "faq-012-chuyen-doi.md", mimeType: "text/markdown", md5Checksum: "a1", size: "60", body: "# Q\nNguồn: AI First Business, mục 11.3\n\nNội dung" },
    { id: "f2", parent: "d3", name: "4.4-roi-hai-tang.md", mimeType: "text/markdown", md5Checksum: "b1", size: "50", body: "# 4.4\nNguồn: AI First Business, mục 4.4\n\nROI" },
    { id: "f3", parent: "ROOT", name: "Bang gia", mimeType: "application/vnd.google-apps.spreadsheet", modifiedTime: "2026-11-01T00:00:00Z", body: "xlsx-bytes" },
    { id: "f4", parent: "ROOT", name: "_HUONG-DAN.md", mimeType: "text/markdown", md5Checksum: "z", size: "5", body: "x" },
    { id: "f5", parent: "ROOT", name: "anh.mov", mimeType: "video/quicktime", md5Checksum: "m", size: "5", body: "x" },
    { id: "f6", parent: "d1", name: "w1-mua-sach.md", mimeType: "text/markdown", md5Checksum: "w", size: "40", body: "# Mua sách\nNguồn: Website aifirstbusiness.vn\n\nx" },
  ];
}

test("tiện ích: khóa R2, nhãn nguồn, mã FAQ", () => {
  assert.equal(r2KeyOf({ name: "Bang gia", mimeType: "application/vnd.google-apps.spreadsheet", path: "" }), "Bang gia.xlsx");
  assert.equal(r2KeyOf({ name: "a.md", mimeType: "text/markdown", path: "03-sach/x" }), "03-sach/x/a.md");
  assert.equal(labelOf({}, "a/b.md", new TextEncoder().encode("# T\nNguồn: AI First Business, mục 4.4\n")), "AI First Business, mục 4.4");
  assert.equal(labelOf({}, "a/Chinh sach.pdf", null), "Chinh sach");
  assert.equal(idOf("02-faq/faq-012-x.md"), "12");
  assert.equal(idOf("04-website/w3-abc.md"), "W3");
  assert.equal(idOf("03-sach/x.md"), null);
});

test("đồng bộ lần đầu, lần hai không đổi, sửa và xóa tệp", async () => {
  _resetTokenCache();
  const { sa, pub } = await makeSA();
  const tree = baseTree(); const log = [];
  const env = { DRIVE_FOLDER_ID: "ROOT", GOOGLE_SA_KEY: sa, KB_BUCKET: new MemR2(), KB_STATE: new MemKV(), MAX_FILES_PER_RUN: "40" };
  const fetchImpl = fakeDrive(tree, pub, log);

  let r = await runSync(env, { fetchImpl });
  assert.deepEqual(env.KB_BUCKET.keys(), ["02-faq/faq-012-chuyen-doi.md", "02-faq/w1-mua-sach.md", "03-sach/ai-first-business/4.4-roi-hai-tang.md", "Bang gia.xlsx"]);
  assert.equal(r.added.length, 4); assert.equal(r.skipped.length, 1); // .mov bị bỏ, _HUONG-DAN bị lờ
  assert.ok(log.includes("export:f3"));
  const labels = JSON.parse(await env.KB_STATE.get("kb:labels"));
  assert.equal(labels["03-sach/ai-first-business/4.4-roi-hai-tang.md"], "AI First Business, mục 4.4");
  assert.equal(labels["Bang gia.xlsx"], "Bang gia");
  assert.deepEqual(JSON.parse(await env.KB_STATE.get("kb:ids")), { "12": "02-faq/faq-012-chuyen-doi.md", W1: "02-faq/w1-mua-sach.md" });

  log.length = 0;
  r = await runSync(env, { fetchImpl });
  assert.equal(r.added.length + r.updated.length, 0); assert.equal(log.length, 0);

  tree.find((f) => f.id === "f2").md5Checksum = "b2"; tree.find((f) => f.id === "f2").body = "# 4.4\nNguồn: AI First Business, mục 4.4 (sửa)\n";
  tree.splice(tree.findIndex((f) => f.id === "f1"), 1);
  r = await runSync(env, { fetchImpl });
  assert.deepEqual(r.updated, ["03-sach/ai-first-business/4.4-roi-hai-tang.md"]);
  assert.deepEqual(r.deleted, ["02-faq/faq-012-chuyen-doi.md"]);
  assert.ok(!env.KB_BUCKET.keys().includes("02-faq/faq-012-chuyen-doi.md"));
  assert.equal(JSON.parse(await env.KB_STATE.get("kb:labels"))["03-sach/ai-first-business/4.4-roi-hai-tang.md"], "AI First Business, mục 4.4 (sửa)");
});

test("giới hạn số tệp mỗi lượt, chạy thử không ghi", async () => {
  _resetTokenCache();
  const { sa, pub } = await makeSA();
  const env = { DRIVE_FOLDER_ID: "ROOT", GOOGLE_SA_KEY: sa, KB_BUCKET: new MemR2(), KB_STATE: new MemKV(), MAX_FILES_PER_RUN: "2" };
  const fetchImpl = fakeDrive(baseTree(), pub);
  let r = await runSync(env, { fetchImpl, dry: true });
  assert.equal(env.KB_BUCKET.keys().length, 0); assert.equal(r.pending, 2);
  r = await runSync(env, { fetchImpl }); assert.equal(r.added.length, 2); assert.equal(r.pending, 2);
  r = await runSync(env, { fetchImpl }); assert.equal(r.added.length, 2); assert.equal(r.pending, 0);
  assert.equal(env.KB_BUCKET.keys().length, 4);
});

test("HTTP: cần SYNC_TOKEN; báo lỗi rõ khi thiếu cấu hình", async () => {
  const env = { SYNC_TOKEN: "s", KB_STATE: new MemKV(), KB_BUCKET: new MemR2() };
  let res = await worker.fetch(new Request("https://x/sync", { method: "POST" }), env);
  assert.equal(res.status, 401);
  res = await worker.fetch(new Request("https://x/sync", { method: "POST", headers: { Authorization: "Bearer s" } }), env);
  assert.equal(res.status, 500); assert.match((await res.json()).error, /DRIVE_FOLDER_ID/);
  res = await worker.fetch(new Request("https://x/status", { headers: { Authorization: "Bearer s" } }), env);
  assert.equal(res.status, 200);
});
