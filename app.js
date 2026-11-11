const DATA = window.SITE_DATA;
const CFG = window.SITE_CONFIG || {};
const PREFIX = DATA.prefix || "";                 // tiền tố mã đếm, để không trộn số với trang khác dùng chung Firebase
const MIN_SHOW = Number(CFG.hienThiToiThieu || 0);
const COOLDOWN_MS = 12 * 60 * 60 * 1000;

let counts = {};          // { statId: { views, downloads } }
let db = null;            // Firestore, nếu kết nối được
let fs = null;            // các hàm Firestore
const els = {};           // phần tử hiển thị số đếm theo id tài liệu

const statId = id => PREFIX + id;
const ALL = DATA.groups.flatMap(g => [...g.docs, ...g.extra]);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function fmt(n) {
  if (n === undefined || n === null) return "–";
  if (n < MIN_SHOW) return "–";
  return Number(n).toLocaleString("vi-VN");
}

function refresh(id) {
  const e = els[id];
  if (!e) return;
  const c = counts[statId(id)] || {};
  e.views.textContent = fmt(db ? (c.views || 0) : undefined);
  e.downloads.textContent = fmt(db ? (c.downloads || 0) : undefined);
}

// Chống đếm trùng: mỗi trình duyệt tối đa 1 lần / 12 giờ cho mỗi (tài liệu, loại).
function shouldCount(kind, sid) {
  const key = "cnt:" + kind + ":" + sid;
  try {
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < COOLDOWN_MS) return false;
    localStorage.setItem(key, String(Date.now()));
  } catch (e) { /* localStorage bị chặn: vẫn đếm */ }
  return true;
}

async function bump(id, kind) {
  if (!db) return;
  const sid = statId(id);
  if (!shouldCount(kind, sid)) return;
  const c = counts[sid] || (counts[sid] = { views: 0, downloads: 0 });
  c[kind] = (c[kind] || 0) + 1;     // cập nhật giao diện ngay
  refresh(id);
  try {
    const payload = {
      views: fs.increment(kind === "views" ? 1 : 0),
      downloads: fs.increment(kind === "downloads" ? 1 : 0)
    };
    await fs.setDoc(fs.doc(db, "stats", sid), payload, { merge: true });
  } catch (err) {
    console.warn("Không ghi được bộ đếm:", err);
  }
}

function card(d) {
  const c = el("article", "card");
  if (d.label) c.appendChild(el("span", "week", d.label));
  c.appendChild(el("h3", "", d.title));
  c.appendChild(el("p", "note", d.note));
  c.appendChild(el("p", "meta", d.pages + " trang · PDF"));

  const row = el("div", "counts");
  const v = el("span"); v.append("Xem: "); const vb = el("b", "", "–"); v.appendChild(vb);
  const dl = el("span"); dl.append("Tải: "); const db_ = el("b", "", "–"); dl.appendChild(db_);
  row.append(v, dl);
  els[d.id] = { views: vb, downloads: db_ };
  c.appendChild(row);

  const act = el("div", "actions");
  const file = "pdf/" + d.id + ".pdf";
  const view = el("a", "btn primary", "Xem");
  view.href = file; view.target = "_blank"; view.rel = "noopener";
  view.addEventListener("click", () => bump(d.id, "views"));
  const dl2 = el("a", "btn ghost", "Tải về");
  dl2.href = file; dl2.setAttribute("download", d.id + ".pdf");
  dl2.addEventListener("click", () => bump(d.id, "downloads"));
  act.append(view, dl2);
  c.appendChild(act);
  return c;
}

function planTable(plan) {
  const t = el("table", "plan");
  const thead = el("thead"); const hr = el("tr");
  ["Tuần", "Nội dung", "Việc cần hoàn thành"].forEach(h => hr.appendChild(el("th", "", h)));
  thead.appendChild(hr); t.appendChild(thead);
  const tb = el("tbody");
  plan.forEach(([w, a, b]) => {
    const tr = el("tr");
    tr.append(el("td", "", w), el("td", "", a), el("td", "", b));
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  return t;
}

function render() {
  const root = document.getElementById("groups");
  const nav = document.getElementById("nav-list");
  DATA.groups.forEach(g => {
    const sec = el("section"); sec.id = g.id; sec.setAttribute("aria-labelledby", g.id + "-h");
    const h = el("h2", "", g.title); h.id = g.id + "-h";
    sec.append(h, el("p", "intro", g.intro));
    const grid = el("div", "grid"); g.docs.forEach(d => grid.appendChild(card(d)));
    sec.appendChild(grid);
    sec.appendChild(el("h3", "sub", "Đáp án và trọn bộ"));
    const gx = el("div", "grid"); g.extra.forEach(d => gx.appendChild(card(d)));
    sec.appendChild(gx);
    if (g.plan) {
      sec.appendChild(el("h3", "sub", "Lộ trình học gợi ý"));
      sec.appendChild(planTable(g.plan));
    }
    root.appendChild(sec);
    const a = el("a", "", g.nav); a.href = "#" + g.id; nav.appendChild(a);
  });
}

async function initCounter() {
  const f = CFG.firebase || {};
  if (!f.apiKey || !f.projectId) return;        // chưa cấu hình: chạy không có bộ đếm
  try {
    const [appMod, fsMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
    ]);
    const app = appMod.initializeApp(f);
    db = fsMod.getFirestore(app);
    fs = fsMod;
    const snap = await fs.getDocs(fs.collection(db, "stats"));
    snap.forEach(s => { counts[s.id] = s.data(); });
    ALL.forEach(d => refresh(d.id));
    const siteEl = document.getElementById("stat-site");
    const sid = statId("site");
    const site = counts[sid] || {};
    siteEl.textContent = fmt(site.views || 0);
    // Đếm lượt truy cập trang: 1 lần mỗi 12 giờ
    if (shouldCount("views", sid)) {
      site.views = (site.views || 0) + 1;
      counts[sid] = site;
      siteEl.textContent = fmt(site.views);
      await fs.setDoc(fs.doc(db, "stats", sid), { views: fs.increment(1), downloads: fs.increment(0) }, { merge: true });
    }
  } catch (err) {
    console.warn("Bộ đếm chưa chạy được:", err);
    db = null;
  }
}

render();
initCounter();
