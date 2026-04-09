import { useState, useEffect, useRef, useCallback } from "react";
import html2pdf from "html2pdf.js";

// ─── CRYPTO ───────────────────────────────────────────────────────────────────
async function sha256(msg) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = n => "KES " + Number(n).toLocaleString("en-KE", { minimumFractionDigits: 2 });
const genReceipt = () => "SAN-" + Date.now().toString().slice(-6);
const todayStr = () => new Date().toLocaleDateString("en-KE", { day: "2-digit", month: "long", year: "numeric" });
const uid = () => Math.random().toString(36).slice(2, 9);

// ─── TERM / YEAR LOGIC ────────────────────────────────────────────────────────
const THIS_YEAR = new Date().getFullYear();
const TERM_LABELS = ["Term 1", "Term 2", "Term 3"];
const buildTerms = (year) => TERM_LABELS.map(t => `${t} ${year}`);
const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => THIS_YEAR - 2 + i);

// ─── DEFAULTS ─────────────────────────────────────────────────────────────────
const DEFAULT_FEES = {
  PP1:    { label: "PP1",     termFee: 12500 },
  PP2:    { label: "PP2",     termFee: 12500 },
  Grade1: { label: "Grade 1", termFee: 15000 },
  Grade2: { label: "Grade 2", termFee: 15000 },
  Grade3: { label: "Grade 3", termFee: 18000 },
  Grade4: { label: "Grade 4", termFee: 18000 },
};
const DEFAULT_YEAR = THIS_YEAR;
const DEFAULT_PASSWORD = "Admin@2025";

const PAYMENT_METHODS = [
  { key: "cash",         label: "Cash",         icon: "💵", color: "#3dd68c" },
  { key: "mpesa",        label: "M-Pesa",        icon: "📱", color: "#4cc764" },
  { key: "airtel_money", label: "Airtel Money",  icon: "🔴", color: "#ff6b6b" },
  { key: "bank",         label: "Bank Transfer", icon: "🏦", color: "#60a5fa" },
];

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const SK = { auth: "san:auth", cfg: "san:cfg", students: "san:students" };
async function sGet(k) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; }
}
async function sSet(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.error(e); }
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const G = {
  bg: "#091a0f", dark: "#0b1f12", mid: "#122b1a",
  card: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)",
  gold: "#e9b84a", goldD: "#c49020",
  green: "#3dd68c", red: "#ff6b6b", amber: "#fbbf24", blue: "#60a5fa",
  text: "#f0f0e8", muted: "rgba(240,240,232,0.52)",
  // dropdown-specific solid colours for readability
  dropBg: "#1a3526", dropBorder: "rgba(233,184,74,0.45)", dropText: "#f0f0e8",
};

// Input style
const iS = (err) => ({
  width: "100%", padding: "11px 14px", borderRadius: 9, outline: "none", fontSize: 14,
  background: "rgba(255,255,255,0.06)", color: G.text, boxSizing: "border-box",
  border: `1.5px solid ${err ? G.red : "rgba(255,255,255,0.14)"}`, fontFamily: "inherit",
});

// Dropdown style — solid, readable, never transparent
const dS = (err) => ({
  width: "100%", padding: "10px 36px 10px 13px", borderRadius: 9, outline: "none",
  fontSize: 14, fontFamily: "'Georgia', 'Times New Roman', serif", fontWeight: 600,
  letterSpacing: "0.01em",
  background: G.dropBg, color: G.dropText, boxSizing: "border-box",
  border: `1.5px solid ${err ? G.red : G.dropBorder}`,
  cursor: "pointer", appearance: "none", WebkitAppearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='9' viewBox='0 0 14 9'%3E%3Cpath d='M1 1l6 6 6-6' stroke='%23e9b84a' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
});

const bS = (v = "gold", full) => ({
  padding: "10px 20px", borderRadius: 10, cursor: "pointer",
  fontWeight: 700, fontSize: 14, fontFamily: "inherit", transition: "opacity .15s",
  width: full ? "100%" : undefined,
  background: v === "gold"   ? `linear-gradient(135deg,${G.gold},${G.goldD})`
            : v === "danger" ? "rgba(255,80,80,0.15)"
            : v === "blue"   ? "rgba(96,165,250,0.15)"
            :                  "rgba(255,255,255,0.07)",
  color: v === "gold" ? G.dark : v === "danger" ? G.red : v === "blue" ? G.blue : G.text,
  border: v === "gold"   ? "none"
        : v === "danger" ? `1px solid rgba(255,80,80,0.3)`
        : v === "ghost"  ? `1px solid rgba(255,255,255,0.14)`
        : v === "blue"   ? `1px solid rgba(96,165,250,0.3)` : "none",
});

// ─── MINI COMPONENTS ──────────────────────────────────────────────────────────
const Card = ({ children, style }) => (
  <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 16, overflow: "hidden", ...style }}>
    {children}
  </div>
);
const SecHead = ({ children }) => (
  <div style={{ padding: "16px 24px 14px", color: G.text, fontWeight: 700, fontSize: 15, borderBottom: `1px solid ${G.border}` }}>
    {children}
  </div>
);
const Lbl = ({ children }) => (
  <div style={{ color: G.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>{children}</div>
);
const Err = ({ msg }) => msg ? <div style={{ color: G.red, fontSize: 11, marginTop: 4 }}>{msg}</div> : null;

// ─── EXCEL EXPORT (SheetJS via CDN) ──────────────────────────────────────────
async function loadSheetJS() {
  if (window.XLSX) return window.XLSX;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => resolve(window.XLSX);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function exportToExcel({ students, fees, year }) {
  const XLSX = await loadSheetJS();
  const wb = XLSX.utils.book_new();
  const terms = buildTerms(year);

  // ── Sheet 1: Summary ──────────────────────────────────────────────────────
  const totalPaid = students.reduce((a, s) => a + s.totalPaid, 0);
  const totalDue  = students.reduce((a, s) => a + Math.max(0, s.balance), 0);
  const methodTotals = {};
  students.forEach(s => s.terms.forEach(t =>
    (t.payments || [t]).forEach(p => { methodTotals[p.method] = (methodTotals[p.method] || 0) + p.paid; })
  ));

  const summaryRows = [
    ["SANTAMONA SCHOOL — FEE MANAGEMENT"],
    [`Academic Year: ${year}   |   Exported: ${todayStr()}`],
    [],
    ["OVERVIEW"],
    ["Total Students",     students.length],
    ["Total Collected (KES)", totalPaid],
    ["Total Outstanding (KES)", totalDue],
    [],
    ["COLLECTIONS BY PAYMENT METHOD"],
    ["Method", "Amount (KES)"],
    ...PAYMENT_METHODS.map(m => [m.label, methodTotals[m.key] || 0]),
    [],
    ["FEE STRUCTURE (per term)"],
    ["Class", "Term Fee (KES)"],
    ...Object.values(fees).map(f => [f.label, f.termFee]),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1["!cols"] = [{ wch: 34 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Summary");

  // ── Sheet 2: Student Ledger ───────────────────────────────────────────────
  const ledgerHeader = ["Student Name", "Class", "Total Fee (KES)", "Total Paid (KES)", "Balance (KES)", "Status"];
  const ledgerRows   = students.map(s => [
    s.name, fees[s.cls]?.label || s.cls,
    s.totalFee, s.totalPaid, Math.max(0, s.balance),
    s.balance <= 0 ? "Fully Paid" : "Outstanding",
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([ledgerHeader, ...ledgerRows]);
  ws2["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Student Ledger");

  // ── Sheet 3: All Transactions ─────────────────────────────────────────────
  const txHeader = ["Date", "Receipt No", "Student Name", "Class", "Term", "Fee (KES)", "Paid (KES)", "Method", "Reference"];
  const txRows   = [];
  students.forEach(s =>
    s.terms.forEach(t =>
      (t.payments || [t]).forEach(p => txRows.push([
        p.date || t.date, p.receiptNo || t.receiptNo || "",
        s.name, fees[s.cls]?.label || s.cls,
        p.term || t.term, t.fee,
        p.paid || t.paid, p.method || t.method, p.ref || t.ref || "",
      ]))
    )
  );
  const ws3 = XLSX.utils.aoa_to_sheet([txHeader, ...txRows]);
  ws3["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 28 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Transactions");

  // ── Sheet 4: Term Breakdown ───────────────────────────────────────────────
  const termHeader = [
    "Student Name", "Class",
    ...terms.map(t => `${t} — Paid`),
    ...terms.map(t => `${t} — Fee`),
    ...terms.map(t => `${t} — Balance`),
  ];
  const termRows = students.map(s => {
    const paid = terms.map(tm => s.terms.find(x => x.term === tm)?.paid ?? 0);
    const fee  = terms.map(tm => s.terms.find(x => x.term === tm)?.fee  ?? (fees[s.cls]?.termFee || 0));
    const bal  = fee.map((f, i) => Math.max(0, f - paid[i]));
    return [s.name, fees[s.cls]?.label || s.cls, ...paid, ...fee, ...bal];
  });
  const ws4 = XLSX.utils.aoa_to_sheet([termHeader, ...termRows]);
  XLSX.utils.book_append_sheet(wb, ws4, "Term Breakdown");

  // ── Sheet 5: Dues Only ────────────────────────────────────────────────────
  const dueHeader = ["Student Name", "Class", "Total Paid (KES)", "Balance Due (KES)"];
  const dueRows   = students
    .filter(s => s.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .map(s => [s.name, fees[s.cls]?.label || s.cls, s.totalPaid, s.balance]);
  const ws5 = XLSX.utils.aoa_to_sheet([dueHeader, ...dueRows]);
  ws5["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws5, "Outstanding Dues");

  XLSX.writeFile(wb, `Santamona_Fees_${year}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─── JSON BACKUP ─────────────────────────────────────────────────────────────
function exportJSON({ students, fees, year }) {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), year, fees, students }, null, 2);
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([payload], { type: "application/json" })),
    download: `santamona_backup_${year}.json`,
  });
  a.click(); URL.revokeObjectURL(a.href);
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function LoginPage({ onLogin }) {
  const [pw, setPw]     = useState("");
  const [err, setErr]   = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  const submit = async () => {
    if (!pw) { setErr("Password required"); return; }
    setBusy(true);
    const hash   = await sha256(pw);
    const stored = await sGet(SK.auth);
    if (!stored) await sSet(SK.auth, { hash: await sha256(DEFAULT_PASSWORD) });
    const expected = stored?.hash || await sha256(DEFAULT_PASSWORD);
    if (hash === expected) { onLogin(); }
    else { setErr("Incorrect password"); setShake(true); setTimeout(() => setShake(false), 500); }
    setBusy(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(ellipse at 30% 20%, #1c5232 0%, ${G.bg} 65%)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia,serif", padding: 16 }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:none} }
        @keyframes shake  { 0%,100%{transform:none} 25%,75%{transform:translateX(-9px)} 50%{transform:translateX(9px)} }
        @keyframes sIn    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        *{box-sizing:border-box}
        button:hover{opacity:.85} button:active{transform:scale(.97)}
        input::placeholder{color:rgba(240,240,232,.28)}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
        .tc{animation:sIn .22s ease}
        select option{background:#1a3526;color:#f0f0e8;font-family:Georgia,serif;font-size:14px;padding:6px 10px}
        select:focus{outline:2px solid #e9b84a;outline-offset:1px}
      `}</style>
      <div style={{ width: "100%", maxWidth: 420, background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 22, padding: "48px 42px", boxShadow: "0 32px 80px rgba(0,0,0,0.6)", animation: shake ? "shake .4s ease" : "fadeUp .5s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🏫</div>
          <div style={{ color: G.gold, fontWeight: 700, fontSize: 22, letterSpacing: 3, textTransform: "uppercase" }}>Santamona School</div>
          <div style={{ color: G.muted, fontSize: 12, marginTop: 6 }}>Fee Management System · Admin Portal</div>
          <div style={{ margin: "18px auto 0", width: 52, height: 2, background: `linear-gradient(90deg,transparent,${G.gold},transparent)` }} />
        </div>
        <Lbl>ADMIN PASSWORD</Lbl>
        <div style={{ position: "relative", marginBottom: 6 }}>
          <input
            type={show ? "text" : "password"} value={pw}
            onChange={e => { setPw(e.target.value); setErr(""); }}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="Enter password…"
            style={{ ...iS(!!err), paddingRight: 46 }}
          />
          <button onClick={() => setShow(s => !s)} style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: G.muted, cursor: "pointer", fontSize: 17, padding: 0 }}>
            {show ? "🙈" : "👁️"}
          </button>
        </div>
        <Err msg={err} />
        <button onClick={submit} disabled={busy} style={{ ...bS("gold", true), marginTop: 20, padding: "13px", fontSize: 15 }}>
          {busy ? "Verifying…" : "🔐 Sign In"}
        </button>
        <div style={{ marginTop: 20, padding: "13px 16px", background: "rgba(233,184,74,0.07)", borderRadius: 10, border: "1px solid rgba(233,184,74,0.18)", textAlign: "center" }}>
          <span style={{ color: G.muted, fontSize: 11 }}>Default password: </span>
          <span style={{ color: G.gold, fontWeight: 700, fontSize: 12 }}>{DEFAULT_PASSWORD}</span>
          <div style={{ color: G.muted, fontSize: 10, marginTop: 3, opacity: .7 }}>Change it in Settings after first login.</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [authed, setAuthed]     = useState(false);
  const [booting, setBooting]   = useState(true);
  const [fees, setFees]         = useState(DEFAULT_FEES);
  const [year, setYear]         = useState(DEFAULT_YEAR);
  const [activeTerm, setActiveTerm] = useState(TERM_LABELS[0]); // "Term 1" etc.
  const [students, setStudents] = useState([]);
  const [tab, setTab]           = useState("entry");
  const [receipt, setReceipt]   = useState(null);
  const [search, setSearch]     = useState("");
  const printRef = useRef();

  const terms = buildTerms(year); // ["Term 1 2025", ...]
  const fullActiveTerm = `${activeTerm} ${year}`; // "Term 1 2025"

  useEffect(() => {
    (async () => {
      const [cfg, studs] = await Promise.all([sGet(SK.cfg), sGet(SK.students)]);
      if (cfg?.fees) setFees(cfg.fees);
      if (cfg?.year) setYear(cfg.year);
      if (Array.isArray(studs)) setStudents(studs);
      setBooting(false);
    })();
  }, []);

  const saveStudents = useCallback(async d => { setStudents(d); await sSet(SK.students, d); }, []);
  const saveSettings = useCallback(async (f, y) => {
    setFees(f); setYear(y);
    await sSet(SK.cfg, { fees: f, year: y });
  }, []);

  if (booting) return (
    <div style={{ minHeight: "100vh", background: G.bg, display: "flex", alignItems: "center", justifyContent: "center", color: G.muted, fontFamily: "Georgia,serif", fontSize: 16 }}>
      Loading…
    </div>
  );
  if (!authed) return <LoginPage onLogin={() => setAuthed(true)} />;

  const totalCollected   = students.reduce((a, s) => a + s.totalPaid, 0);
  const totalOutstanding = students.reduce((a, s) => a + Math.max(0, s.balance), 0);
  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.cls.toLowerCase().includes(search.toLowerCase())
  );

  const TABS = [
    { key: "entry",    icon: "💳", label: "Record"   },
    { key: "receipt",  icon: "🧾", label: "Receipt"  },
    { key: "ledger",   icon: "📋", label: "Ledger"   },
    { key: "dues",     icon: "⚠️", label: "Dues"     },
    { key: "settings", icon: "⚙️", label: "Settings" },
    { key: "backup",   icon: "💾", label: "Backup"   },
  ];

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg,#0e2818 0%,${G.bg} 55%,#060f08 100%)`, fontFamily: "Georgia,Palatino,serif", padding: "18px 16px 60px" }}>
      <style>{`
        @keyframes sIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        *{box-sizing:border-box}
        button:hover{opacity:.85} button:active{transform:scale(.97)}
        input::placeholder{color:rgba(240,240,232,.22)}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
        .tc{animation:sIn .22s ease}
        select option{background:#1a3526;color:#f0f0e8;font-family:Georgia,serif;font-size:14px;padding:6px 10px}
        select:focus{outline:2px solid #e9b84a;outline-offset:1px}
      `}</style>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 960, margin: "0 auto 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "14px 20px", flexWrap: "wrap", rowGap: 12 }}>
          {/* Logo */}
          <div style={{ width: 48, height: 48, background: `linear-gradient(135deg,${G.gold},${G.goldD})`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🏫</div>
          <div>
            <div style={{ color: G.gold, fontWeight: 700, fontSize: 18, letterSpacing: 2, textTransform: "uppercase" }}>Santamona School</div>
            <div style={{ color: G.muted, fontSize: 11 }}>Fee Management System · Nairobi, Kenya</div>
          </div>

          {/* ── Active term selector ─────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 6, flexWrap: "wrap" }}>
            <span style={{ color: G.gold, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>ACTIVE TERM</span>
            <div style={{ position: "relative" }}>
              <select
                value={activeTerm}
                onChange={e => setActiveTerm(e.target.value)}
                style={{ ...dS(false), width: 160, fontSize: 13, padding: "8px 34px 8px 12px" }}
              >
                {TERM_LABELS.map(t => (
                  <option key={t} value={t}>{t} {year}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Stats ───────────────────────────────────────────────────── */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            {[["COLLECTED", fmt(totalCollected), G.green], ["OUTSTANDING", fmt(totalOutstanding), G.amber], ["STUDENTS", students.length, G.muted]].map(([l, v, c]) => (
              <div key={l} style={{ textAlign: "right" }}>
                <div style={{ color: G.muted, fontSize: 9, letterSpacing: 1 }}>{l}</div>
                <div style={{ color: c, fontWeight: 700, fontSize: 15 }}>{v}</div>
              </div>
            ))}
            <button onClick={() => setAuthed(false)} style={{ ...bS("ghost"), padding: "7px 13px", fontSize: 12 }}>🔓 Logout</button>
          </div>
        </div>
      </div>

      {/* ── TABS ───────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 960, margin: "0 auto 14px", display: "flex", gap: 5 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: "8px 2px", borderRadius: 10, cursor: "pointer", fontSize: 11,
            fontWeight: 700, fontFamily: "inherit", transition: "all .18s",
            background: tab === t.key ? `linear-gradient(135deg,${G.gold},${G.goldD})` : "rgba(255,255,255,0.04)",
            color: tab === t.key ? G.dark : G.muted,
            border: tab === t.key ? "none" : "1px solid rgba(255,255,255,0.07)",
            transform: tab === t.key ? "translateY(-2px)" : "none",
            boxShadow: tab === t.key ? `0 4px 14px rgba(233,184,74,.28)` : "none",
          }}>
            <div style={{ fontSize: 16 }}>{t.icon}</div>
            <div style={{ marginTop: 2 }}>{t.label}</div>
          </button>
        ))}
      </div>

      {/* ── CONTENT ────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 960, margin: "0 auto" }} className="tc" key={tab}>
        {tab === "entry"    && <EntryTab    fees={fees} terms={terms} fullActiveTerm={fullActiveTerm} students={students} saveStudents={saveStudents} setReceipt={setReceipt} setTab={setTab} />}
        {tab === "receipt"  && <ReceiptTab  receipt={receipt} printRef={printRef} setTab={setTab} fees={fees} />}
        {tab === "ledger"   && <LedgerTab   students={filtered} search={search} setSearch={setSearch} fees={fees} />}
        {tab === "dues"     && <DuesTab     students={students} fees={fees} totalOutstanding={totalOutstanding} />}
        {tab === "settings" && <SettingsTab fees={fees} year={year} saveSettings={saveSettings} />}
        {tab === "backup"   && <BackupTab   students={students} fees={fees} year={year} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY TAB
// ═══════════════════════════════════════════════════════════════════════════════
function EntryTab({ fees, terms, fullActiveTerm, students, saveStudents, setReceipt, setTab }) {
  const classes = Object.keys(fees);
  const [form, setForm] = useState({
    name: "", cls: classes[0] || "", term: fullActiveTerm, paid: "", method: "cash", ref: "",
  });
  const [errors, setErrors] = useState({});
  const [done, setDone]     = useState(false);

  // Sync term when active term prop changes
  useEffect(() => { setForm(f => ({ ...f, term: fullActiveTerm })); }, [fullActiveTerm]);

  const cls  = classes.includes(form.cls)   ? form.cls  : (classes[0]  || "");
  const term = terms.includes(form.term)    ? form.term : (terms[0]    || "");
  const needsRef = ["mpesa", "airtel_money", "bank"].includes(form.method);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Student name required";
    if (!cls)              e.cls  = "Select a class";
    if (!term)             e.term = "No terms available";
    if (!form.paid || isNaN(form.paid) || Number(form.paid) <= 0) e.paid = "Enter a valid amount";
    if (needsRef && !form.ref.trim()) e.ref = `${PAYMENT_METHODS.find(m => m.key === form.method)?.label} reference required`;
    return e;
  };

  const submit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});

    const termFee = fees[cls]?.termFee || 0;
    const paidAmt = Number(form.paid);
    const recNo   = genReceipt();
    const entry   = { term, fee: termFee, paid: paidAmt, method: form.method, ref: form.ref, date: todayStr(), receiptNo: recNo };
    const updated = [...students];
    const idx     = updated.findIndex(s => s.name.toLowerCase() === form.name.trim().toLowerCase() && s.cls === cls);

    if (idx >= 0) {
      const s    = { ...updated[idx], terms: [...updated[idx].terms] };
      const tIdx = s.terms.findIndex(t => t.term === term);
      if (tIdx >= 0) {
        s.terms[tIdx] = { ...s.terms[tIdx], paid: s.terms[tIdx].paid + paidAmt };
        s.terms[tIdx].payments = [...(s.terms[tIdx].payments || []), entry];
      } else {
        s.terms.push({ ...entry, payments: [entry] });
      }
      s.totalPaid = s.terms.reduce((a, t) => a + t.paid, 0);
      s.totalFee  = s.terms.reduce((a, t) => a + t.fee,  0);
      s.balance   = s.totalFee - s.totalPaid;
      updated[idx] = s;
    } else {
      updated.push({ id: uid(), name: form.name.trim(), cls, terms: [{ ...entry, payments: [entry] }], totalPaid: paidAmt, totalFee: termFee, balance: termFee - paidAmt });
    }

    saveStudents(updated);
    setReceipt({ receiptNo: recNo, date: todayStr(), studentName: form.name.trim(), cls, term, termFee, paid: paidAmt, balance: termFee - paidAmt, method: form.method, ref: form.ref });
    setDone(true);
    setTimeout(() => { setDone(false); setForm(f => ({ ...f, name: "", paid: "", ref: "" })); setTab("receipt"); }, 900);
  };

  const termFee = fees[cls]?.termFee || 0;
  const paid    = Number(form.paid) || 0;
  const balance = Math.max(0, termFee - paid);

  return (
    <Card>
      {/* Fee banner */}
      <div style={{ padding: "12px 22px", background: "rgba(233,184,74,0.07)", borderBottom: "1px solid rgba(233,184,74,0.13)" }}>
        <div style={{ color: G.gold, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>TERM FEE STRUCTURE</div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {Object.entries(fees).map(([k, v]) => (
            <span key={k} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 7, padding: "3px 11px", fontSize: 12, color: G.text }}>
              <span style={{ color: G.gold, fontWeight: 700 }}>{v.label}</span>: {fmt(v.termFee)}
            </span>
          ))}
          {!classes.length && <span style={{ color: G.muted, fontSize: 12 }}>No classes — add them in Settings.</span>}
        </div>
      </div>

      <div style={{ padding: 26 }}>
        <div style={{ color: G.text, fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Record Fee Payment</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* Name */}
          <div style={{ gridColumn: "1/-1" }}>
            <Lbl>STUDENT FULL NAME</Lbl>
            <input value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(er => ({ ...er, name: "" })); }} placeholder="e.g. Jane Wanjiku Mwangi" style={iS(errors.name)} />
            <Err msg={errors.name} />
          </div>

          {/* Class */}
          <div>
            <Lbl>CLASS</Lbl>
            <select value={cls} onChange={e => setForm(f => ({ ...f, cls: e.target.value }))} style={dS(errors.cls)}>
              {!classes.length && <option value="">— Add classes in Settings —</option>}
              {Object.entries(fees).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <Err msg={errors.cls} />
          </div>

          {/* Term */}
          <div>
            <Lbl>TERM</Lbl>
            <select value={term} onChange={e => setForm(f => ({ ...f, term: e.target.value }))} style={dS(errors.term)}>
              {terms.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <Err msg={errors.term} />
          </div>

          {/* Amount */}
          <div style={{ gridColumn: "1/-1" }}>
            <Lbl>AMOUNT PAID (KES)</Lbl>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: G.gold, fontWeight: 700, fontSize: 13 }}>KES</span>
              <input type="number" value={form.paid} onChange={e => { setForm(f => ({ ...f, paid: e.target.value })); setErrors(er => ({ ...er, paid: "" })); }} placeholder="0.00" style={{ ...iS(errors.paid), paddingLeft: 52 }} />
            </div>
            <Err msg={errors.paid} />
            {paid > 0 && (
              <div style={{ marginTop: 9, padding: "9px 13px", background: "rgba(61,214,140,0.07)", border: "1px solid rgba(61,214,140,0.13)", borderRadius: 8, fontSize: 12, display: "flex", flexWrap: "wrap", gap: 16 }}>
                <span style={{ color: G.muted }}>Fee: <b style={{ color: G.gold }}>{fmt(termFee)}</b></span>
                <span style={{ color: G.muted }}>Paying: <b style={{ color: G.green }}>{fmt(paid)}</b></span>
                <span style={{ color: G.muted }}>Balance: <b style={{ color: balance === 0 ? G.green : G.amber }}>{fmt(balance)}</b></span>
              </div>
            )}
          </div>

          {/* Payment method */}
          <div style={{ gridColumn: "1/-1" }}>
            <Lbl>PAYMENT METHOD</Lbl>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {PAYMENT_METHODS.map(m => (
                <button key={m.key} onClick={() => { setForm(f => ({ ...f, method: m.key, ref: "" })); setErrors(er => ({ ...er, ref: "" })); }} style={{
                  padding: "11px 6px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 12, transition: "all .15s",
                  background: form.method === m.key ? `${m.color}22` : "rgba(255,255,255,0.04)",
                  border: form.method === m.key ? `2px solid ${m.color}` : "1.5px solid rgba(255,255,255,0.1)",
                  color: form.method === m.key ? m.color : G.muted,
                  transform: form.method === m.key ? "translateY(-2px)" : "none",
                  boxShadow: form.method === m.key ? `0 4px 12px ${m.color}33` : "none",
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</div>
                  <div>{m.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Reference */}
          {needsRef && (
            <div style={{ gridColumn: "1/-1" }}>
              <Lbl>{form.method === "bank" ? "BANK REFERENCE / SLIP NO." : "TRANSACTION CODE"}</Lbl>
              <input value={form.ref} onChange={e => { setForm(f => ({ ...f, ref: e.target.value })); setErrors(er => ({ ...er, ref: "" })); }}
                placeholder={form.method === "mpesa" ? "e.g. QAB1C2D3E4" : form.method === "airtel_money" ? "e.g. CI241012345" : "e.g. TXN-2025-09871"}
                style={iS(errors.ref)} />
              <Err msg={errors.ref} />
            </div>
          )}
        </div>

        <button onClick={submit} style={{ ...bS("gold", true), marginTop: 22, padding: "14px", fontSize: 15 }}>
          {done ? "✅ Recorded!" : "✅ RECORD PAYMENT & GENERATE RECEIPT"}
        </button>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECEIPT TAB
// ═══════════════════════════════════════════════════════════════════════════════
function ReceiptTab({ receipt, printRef, setTab, fees }) {
  const getPrintHtml = () => `<!DOCTYPE html><html><head><title>Receipt · Santamona</title><style>
      body{font-family:Georgia,serif;padding:40px;background:#fff;color:#111;margin:0}
      .box{max-width:460px;margin:auto;border:2px solid #1a6b3a;border-radius:12px;padding:36px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      td{padding:6px 0} .lbl{color:#666} .val{font-weight:700;text-align:right}
      hr{border:none;border-top:1px dashed #ccc;margin:14px 0}
      .badge{text-align:center;padding:11px;border-radius:8px;font-weight:700;margin-top:16px}
      .foot{text-align:center;font-size:10px;color:#bbb;margin-top:20px}
    </style></head><body>${printRef.current?.innerHTML || ""}</body></html>`;

  const handlePrint = () => {
    const w = window.open("", "_blank");
    w.document.write(getPrintHtml());
    w.document.close(); w.print();
  };

  const handleSavePDF = () => {
    if (!printRef.current) return;
    const opt = {
      margin:       0.2,
      filename:     `Receipt_${receipt?.receiptNo || 'draft'}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(getPrintHtml()).save();
  };

  if (!receipt) return (
    <Card>
      <div style={{ padding: "60px 24px", textAlign: "center", color: G.muted }}>
        <div style={{ fontSize: 52 }}>🧾</div>
        <div style={{ marginTop: 14, fontSize: 16 }}>No receipt yet — record a payment first.</div>
        <button onClick={() => setTab("entry")} style={{ ...bS("gold"), marginTop: 20 }}>+ Record Payment</button>
      </div>
    </Card>
  );

  const fully = receipt.balance <= 0;
  const mInfo = PAYMENT_METHODS.find(m => m.key === receipt.method);

  return (
    <Card>
      <div style={{ padding: "16px 22px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ color: G.text, fontWeight: 700, fontSize: 16 }}>Payment Receipt</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handlePrint} style={bS("ghost")}>🖨️ Print Receipt</button>
          <button onClick={handleSavePDF} style={bS("ghost")}>💾 Save PDF</button>
          <button onClick={() => setTab("entry")} style={bS("ghost")}>+ New Payment</button>
        </div>
      </div>

      <div style={{ padding: "12px 22px 28px" }}>
        <div ref={printRef}>
          <div style={{ background: "#fff", color: "#111", borderRadius: 12, padding: 36, maxWidth: 480, margin: "0 auto", border: "2px solid #1a6b3a", fontFamily: "Georgia,serif" }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div style={{ fontSize: 30 }}>🏫</div>
              <div style={{ color: "#1a6b3a", fontWeight: 800, fontSize: 20, letterSpacing: 2, marginTop: 6 }}>SANTAMONA SCHOOL</div>
              <div style={{ color: "#999", fontSize: 11, marginTop: 3 }}>P.O. Box 00100, Nairobi, Kenya · Tel: +254 700 000 000</div>
              <div style={{ display: "inline-block", marginTop: 10, background: "#1a6b3a", color: "#fff", padding: "4px 22px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
                FEE PAYMENT RECEIPT
              </div>
            </div>

            <hr />

            {/* Details table */}
            <table><tbody>
              {[
                ["Receipt No.", receipt.receiptNo],
                ["Date", receipt.date],
                ["Student Name", receipt.studentName],
                ["Class", fees[receipt.cls]?.label || receipt.cls],
                ["Term", receipt.term],
              ].map(([l, v]) => (
                <tr key={l}><td style={{ color: "#666", padding: "5px 0", width: "45%" }}>{l}</td><td style={{ fontWeight: 700, textAlign: "right" }}>{v}</td></tr>
              ))}
            </tbody></table>

            {/* Method badge */}
            <div style={{ margin: "12px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#666", fontSize: 13 }}>Payment Method</span>
              <span style={{ padding: "4px 15px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: `${mInfo?.color}22`, color: mInfo?.color || "#333", border: `1px solid ${mInfo?.color || "#ccc"}55` }}>
                {mInfo?.icon} {mInfo?.label}
              </span>
            </div>
            {receipt.ref && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#666", fontSize: 13 }}>Reference</span>
                <span style={{ fontWeight: 700, fontSize: 13, fontFamily: "monospace" }}>{receipt.ref}</span>
              </div>
            )}

            <hr style={{ borderTop: "1px solid #eee" }} />

            {/* Amounts */}
            <table><tbody>
              <tr><td style={{ color: "#666", padding: "5px 0" }}>Term Fee</td><td style={{ fontWeight: 600, textAlign: "right" }}>{fmt(receipt.termFee)}</td></tr>
              <tr><td style={{ color: "#666", padding: "5px 0" }}>Amount Paid</td><td style={{ fontWeight: 800, color: "#1a6b3a", textAlign: "right", fontSize: 16 }}>{fmt(receipt.paid)}</td></tr>
              <tr style={{ borderTop: "2px solid #1a6b3a" }}>
                <td style={{ paddingTop: 10, fontWeight: 800, fontSize: 15 }}>Balance Due</td>
                <td style={{ paddingTop: 10, fontWeight: 800, fontSize: 16, textAlign: "right", color: fully ? "#1a6b3a" : "#c0392b" }}>{fmt(Math.max(0, receipt.balance))}</td>
              </tr>
            </tbody></table>

            <div style={{ marginTop: 14, textAlign: "center", padding: "11px", borderRadius: 9, fontWeight: 700, background: fully ? "#e6f4ea" : "#fff3e0", color: fully ? "#1a6b3a" : "#c0392b" }}>
              {fully ? "✅ FULLY PAID FOR THIS TERM" : `⚠️ OUTSTANDING: ${fmt(Math.max(0, receipt.balance))}`}
            </div>
            <div style={{ textAlign: "center", fontSize: 10, color: "#bbb", marginTop: 18 }}>
              Official receipt · Santamona School · {receipt.date}<br />Thank you for your payment!
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEDGER TAB
// ═══════════════════════════════════════════════════════════════════════════════
function LedgerTab({ students, search, setSearch, fees }) {
  return (
    <Card>
      <div style={{ padding: "16px 22px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ color: G.text, fontWeight: 700, fontSize: 16 }}>
          Student Ledger <span style={{ color: G.muted, fontWeight: 400, fontSize: 13 }}>({students.length})</span>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search name or class…" style={{ ...iS(false), width: 220, padding: "8px 13px", fontSize: 13 }} />
      </div>
      <div style={{ padding: "0 22px 22px" }}>
        {!students.length
          ? <div style={{ textAlign: "center", padding: 48, color: G.muted }}>No records found.</div>
          : students.map(s => {
            const methodCounts = {};
            s.terms.forEach(t => (t.payments || []).forEach(p => { methodCounts[p.method] = (methodCounts[p.method] || 0) + 1; }));
            return (
              <div key={s.id} style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px", marginBottom: 9 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  <div>
                    <div style={{ color: G.text, fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ color: G.gold, fontSize: 12, fontWeight: 600 }}>{fees[s.cls]?.label || s.cls}</span>
                      {Object.entries(methodCounts).map(([m, c]) => {
                        const mi = PAYMENT_METHODS.find(x => x.key === m);
                        return <span key={m} style={{ fontSize: 11, background: `${mi?.color}18`, color: mi?.color, border: `1px solid ${mi?.color}44`, borderRadius: 6, padding: "2px 8px" }}>{mi?.icon} {mi?.label} ×{c}</span>;
                      })}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: G.green, fontWeight: 700, fontSize: 14 }}>{fmt(s.totalPaid)} paid</div>
                    <div style={{ color: s.balance > 0 ? G.amber : G.green, fontSize: 12, marginTop: 2 }}>
                      {s.balance > 0 ? `${fmt(s.balance)} due` : "✅ Fully paid"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {s.terms.map(t => (
                    <div key={t.term} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "4px 11px", fontSize: 12, border: "1px solid rgba(255,255,255,0.07)" }}>
                      <span style={{ color: G.muted }}>{t.term}: </span>
                      <span style={{ color: G.green, fontWeight: 600 }}>{fmt(t.paid)}</span>
                      <span style={{ color: "rgba(255,255,255,0.22)" }}> / {fmt(t.fee)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        }
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUES TAB
// ═══════════════════════════════════════════════════════════════════════════════
function DuesTab({ students, fees, totalOutstanding }) {
  const owing = students.filter(s => s.balance > 0).sort((a, b) => b.balance - a.balance);
  return (
    <Card>
      <div style={{ padding: "16px 22px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ color: G.text, fontWeight: 700, fontSize: 16 }}>Outstanding Dues</div>
        <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.24)", borderRadius: 10, padding: "7px 18px", color: G.amber, fontWeight: 700 }}>
          Total: {fmt(totalOutstanding)}
        </div>
      </div>
      <div style={{ padding: "0 22px 22px" }}>
        {!owing.length
          ? (
            <div style={{ textAlign: "center", padding: 48, color: G.muted }}>
              <div style={{ fontSize: 42 }}>🎉</div>
              <div style={{ marginTop: 10 }}>All students are fully paid up!</div>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", marginBottom: 8 }}>
                {["Student", "Class", "Paid", "Balance"].map(h => (
                  <div key={h} style={{ color: G.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: "3px 9px" }}>{h}</div>
                ))}
              </div>
              {owing.map(s => (
                <div key={s.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", background: "rgba(255,255,255,0.03)", borderRadius: 10, marginBottom: 6, border: "1px solid rgba(251,191,36,0.11)", alignItems: "center" }}>
                  <div style={{ padding: "11px 9px", color: G.text, fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                  <div style={{ padding: "11px 9px", color: G.gold, fontSize: 13 }}>{fees[s.cls]?.label || s.cls}</div>
                  <div style={{ padding: "11px 9px", color: G.green, fontSize: 13 }}>{fmt(s.totalPaid)}</div>
                  <div style={{ padding: "11px 9px", color: G.amber, fontWeight: 700, fontSize: 13 }}>{fmt(s.balance)}</div>
                </div>
              ))}
            </>
          )
        }
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function SettingsTab({ fees, year, saveSettings }) {
  const [ef, setEf]     = useState(() => JSON.parse(JSON.stringify(fees)));
  const [ey, setEy]     = useState(year);
  const [newCls, setNewCls] = useState({ key: "", label: "", termFee: "" });
  const [saved, setSaved]   = useState(false);
  const [cErr, setCErr]     = useState("");
  const [oldPw, setOldPw]   = useState("");
  const [newPw, setNewPw]   = useState("");
  const [cfPw, setCfPw]     = useState("");
  const [pwMsg, setPwMsg]   = useState({ type: "", text: "" });
  const [showPw, setShowPw] = useState({ o: false, n: false, c: false });

  const save = async () => { await saveSettings(ef, ey); setSaved(true); setTimeout(() => setSaved(false), 2200); };

  const addCls = () => {
    const k = newCls.key.trim().replace(/\s/g, "");
    if (!k || !newCls.label.trim() || !newCls.termFee) { setCErr("All fields required"); return; }
    if (ef[k]) { setCErr("Key already exists"); return; }
    if (isNaN(newCls.termFee) || Number(newCls.termFee) <= 0) { setCErr("Valid fee required"); return; }
    setCErr("");
    setEf(f => ({ ...f, [k]: { label: newCls.label.trim(), termFee: Number(newCls.termFee) } }));
    setNewCls({ key: "", label: "", termFee: "" });
  };

  const changePw = async () => {
    if (!oldPw || !newPw || !cfPw) { setPwMsg({ type: "err", text: "All fields required" }); return; }
    if (newPw !== cfPw)             { setPwMsg({ type: "err", text: "New passwords don't match" }); return; }
    if (newPw.length < 6)           { setPwMsg({ type: "err", text: "Minimum 6 characters" }); return; }
    const oldHash  = await sha256(oldPw);
    const stored   = await sGet(SK.auth);
    const expected = stored?.hash || await sha256(DEFAULT_PASSWORD);
    if (oldHash !== expected) { setPwMsg({ type: "err", text: "Current password incorrect" }); return; }
    await sSet(SK.auth, { hash: await sha256(newPw) });
    setPwMsg({ type: "ok", text: "✅ Password changed!" });
    setOldPw(""); setNewPw(""); setCfPw("");
    setTimeout(() => setPwMsg({ type: "", text: "" }), 3000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Academic Year ────────────────────────────────────────────────── */}
      <Card>
        <SecHead>📅 Academic Year</SecHead>
        <div style={{ padding: "18px 22px" }}>
          <div style={{ color: G.muted, fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
            The active year determines which terms appear in the Record and Receipt screens.
            Terms are auto-built as <b style={{ color: G.gold }}>Term 1 {ey}</b>, <b style={{ color: G.gold }}>Term 2 {ey}</b>, <b style={{ color: G.gold }}>Term 3 {ey}</b>.
          </div>
          <div style={{ maxWidth: 240 }}>
            <Lbl>SELECT YEAR</Lbl>
            <select value={ey} onChange={e => setEy(Number(e.target.value))} style={dS(false)}>
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {ey !== year && (
            <div style={{ marginTop: 12, padding: "9px 14px", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.22)", borderRadius: 8, fontSize: 12, color: G.amber }}>
              ⚠️ Year changed — click "Save All Settings" below to apply.
            </div>
          )}
        </div>
      </Card>

      {/* ── Fee Structure ────────────────────────────────────────────────── */}
      <Card>
        <SecHead>🏷️ Fee Structure (per term)</SecHead>
        <div style={{ padding: "16px 22px" }}>
          {!Object.keys(ef).length && <div style={{ color: G.muted, fontSize: 13, marginBottom: 12 }}>No classes yet.</div>}
          {Object.entries(ef).map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 10, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 120px" }}>
                <Lbl>LABEL</Lbl>
                <input value={v.label} onChange={e => setEf(f => ({ ...f, [k]: { ...f[k], label: e.target.value } }))} style={{ ...iS(false), padding: "8px 11px" }} />
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <Lbl>TERM FEE (KES)</Lbl>
                <input type="number" value={v.termFee} onChange={e => setEf(f => ({ ...f, [k]: { ...f[k], termFee: Number(e.target.value) } }))} style={{ ...iS(false), padding: "8px 11px" }} />
              </div>
              <button onClick={() => setEf(f => { const n = { ...f }; delete n[k]; return n; })} style={{ ...bS("danger"), padding: "9px 13px", fontSize: 12, alignSelf: "flex-end" }}>✕ Remove</button>
            </div>
          ))}

          {/* Add class form */}
          <div style={{ marginTop: 16, padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px dashed rgba(255,255,255,0.1)" }}>
            <div style={{ color: G.gold, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>+ ADD NEW CLASS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div><Lbl>KEY (no spaces)</Lbl><input value={newCls.key} onChange={e => setNewCls(c => ({ ...c, key: e.target.value }))} placeholder="Grade5" style={{ ...iS(false), padding: "8px 11px" }} /></div>
              <div><Lbl>DISPLAY LABEL</Lbl><input value={newCls.label} onChange={e => setNewCls(c => ({ ...c, label: e.target.value }))} placeholder="Grade 5" style={{ ...iS(false), padding: "8px 11px" }} /></div>
              <div><Lbl>TERM FEE (KES)</Lbl><input type="number" value={newCls.termFee} onChange={e => setNewCls(c => ({ ...c, termFee: e.target.value }))} placeholder="20000" style={{ ...iS(false), padding: "8px 11px" }} /></div>
            </div>
            <button onClick={addCls} style={{ ...bS("gold"), padding: "8px 18px", fontSize: 13 }}>+ Add Class</button>
            <Err msg={cErr} />
          </div>
        </div>
      </Card>

      {/* ── Save Button ─────────────────────────────────────────────────── */}
      <button onClick={save} style={{ ...bS("gold", true), padding: "14px", fontSize: 15, boxShadow: saved ? `0 0 22px rgba(233,184,74,.35)` : "none" }}>
        {saved ? "✅ Settings Saved!" : "💾 SAVE ALL SETTINGS"}
      </button>

      {/* ── Password ─────────────────────────────────────────────────────── */}
      <Card>
        <SecHead>🔐 Change Admin Password</SecHead>
        <div style={{ padding: "18px 22px" }}>
          {[["CURRENT PASSWORD", oldPw, setOldPw, "o"], ["NEW PASSWORD", newPw, setNewPw, "n"], ["CONFIRM NEW PASSWORD", cfPw, setCfPw, "c"]].map(([lbl, val, set, k]) => (
            <div key={k} style={{ marginBottom: 14 }}>
              <Lbl>{lbl}</Lbl>
              <div style={{ position: "relative" }}>
                <input type={showPw[k] ? "text" : "password"} value={val} onChange={e => { set(e.target.value); setPwMsg({ type: "", text: "" }); }} style={{ ...iS(false), paddingRight: 44 }} />
                <button onClick={() => setShowPw(s => ({ ...s, [k]: !s[k] }))} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: G.muted, cursor: "pointer", fontSize: 15, padding: 0 }}>
                  {showPw[k] ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
          ))}
          {pwMsg.text && (
            <div style={{ padding: "9px 14px", borderRadius: 8, fontSize: 13, marginBottom: 14, background: pwMsg.type === "ok" ? "rgba(61,214,140,.1)" : "rgba(255,107,107,.1)", color: pwMsg.type === "ok" ? G.green : G.red, border: `1px solid ${pwMsg.type === "ok" ? "rgba(61,214,140,.3)" : "rgba(255,107,107,.3)"}` }}>
              {pwMsg.text}
            </div>
          )}
          <button onClick={changePw} style={{ ...bS("ghost", true), padding: "11px" }}>🔑 Update Password</button>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACKUP TAB
// ═══════════════════════════════════════════════════════════════════════════════
function BackupTab({ students, fees, year }) {
  const fileRef = useRef();
  const [exporting, setExporting] = useState(false);

  const totalPaid = students.reduce((a, s) => a + s.totalPaid, 0);
  const totalDue  = students.reduce((a, s) => a + Math.max(0, s.balance), 0);
  const methodTotals = {};
  students.forEach(s => s.terms.forEach(t =>
    (t.payments || [t]).forEach(p => { methodTotals[p.method] = (methodTotals[p.method] || 0) + p.paid; })
  ));

  const handleExcelExport = async () => {
    setExporting(true);
    try { await exportToExcel({ students, fees, year }); }
    catch (e) { alert("Export failed. Please check your connection and try again."); console.error(e); }
    finally { setExporting(false); }
  };

  const handleImport = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result);
        // reload page after import so state refreshes cleanly
        if (data.fees)             await sSet(SK.cfg, { fees: data.fees, year: data.year || year });
        if (Array.isArray(data.students)) await sSet(SK.students, data.students);
        alert("✅ Data imported! The page will now reload."); window.location.reload();
      } catch { alert("❌ Invalid backup file. Only JSON files exported from this system are accepted."); }
    };
    reader.readAsText(file); e.target.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Summary ─────────────────────────────────────────────────────── */}
      <Card>
        <SecHead>📊 Data Summary — {year}</SecHead>
        <div style={{ padding: "16px 22px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 22 }}>
            {[["Students", students.length, G.text], ["Total Collected", fmt(totalPaid), G.green], ["Total Outstanding", fmt(totalDue), G.amber]].map(([l, v, c]) => (
              <div key={l} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, padding: "18px", textAlign: "center" }}>
                <div style={{ color: G.muted, fontSize: 11, letterSpacing: 1, marginBottom: 7 }}>{l}</div>
                <div style={{ color: c, fontWeight: 700, fontSize: 20 }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ color: G.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>COLLECTIONS BY PAYMENT METHOD</div>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            {PAYMENT_METHODS.map(m => (
              <div key={m.key} style={{ flex: "1 1 150px", background: `${m.color}12`, border: `1px solid ${m.color}33`, borderRadius: 10, padding: "13px 16px", display: "flex", alignItems: "center", gap: 11 }}>
                <span style={{ fontSize: 24 }}>{m.icon}</span>
                <div>
                  <div style={{ color: m.color, fontWeight: 700, fontSize: 13 }}>{m.label}</div>
                  <div style={{ color: G.text, fontWeight: 700, fontSize: 15, marginTop: 2 }}>{fmt(methodTotals[m.key] || 0)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Excel Export ─────────────────────────────────────────────────── */}
      <Card>
        <SecHead>📥 Export to Excel (.xlsx)</SecHead>
        <div style={{ padding: "18px 22px" }}>
          <div style={{ color: G.muted, fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
            Downloads a full <b style={{ color: G.text }}>Excel workbook</b> with five ready-to-use sheets:
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 9, marginBottom: 20 }}>
            {[
              ["📋 Summary",          "Overview, method totals & fee structure"],
              ["👥 Student Ledger",   "All students with totals and status"],
              ["💳 Transactions",     "Every payment with receipt no. & reference"],
              ["📅 Term Breakdown",   "Per-student paid / fee / balance per term"],
              ["⚠️ Outstanding Dues", "All students with unpaid balances, sorted"],
            ].map(([t, d]) => (
              <div key={t} style={{ padding: "10px 13px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9 }}>
                <div style={{ color: G.gold, fontWeight: 700, fontSize: 12 }}>{t}</div>
                <div style={{ color: G.muted, fontSize: 11, marginTop: 3 }}>{d}</div>
              </div>
            ))}
          </div>
          <button onClick={handleExcelExport} disabled={exporting} style={{ ...bS("gold"), padding: "12px 30px", fontSize: 15 }}>
            {exporting ? "⏳ Preparing Excel…" : `📥 Download Excel — ${year}`}
          </button>
        </div>
      </Card>

      {/* ── JSON Backup ──────────────────────────────────────────────────── */}
      <Card>
        <SecHead>🔄 JSON Backup (Export / Import)</SecHead>
        <div style={{ padding: "18px 22px" }}>
          <div style={{ color: G.muted, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
            Export a <b style={{ color: G.text }}>raw .json file</b> to restore data on any device. Import a previously exported JSON to recover all records.{" "}
            <b style={{ color: G.red }}>Importing overwrites all current data.</b>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <button onClick={() => exportJSON({ students, fees, year })} style={{ ...bS("ghost"), padding: "10px 22px" }}>⬇️ Export JSON</button>
            <button onClick={() => fileRef.current?.click()} style={{ ...bS("blue"), padding: "10px 22px" }}>📂 Import JSON</button>
            <input type="file" accept=".json" ref={fileRef} onChange={handleImport} style={{ display: "none" }} />
          </div>

          {/* Drag & drop zone */}
          <div
            style={{ padding: "20px", background: "rgba(255,255,255,0.025)", border: "2px dashed rgba(255,255,255,0.11)", borderRadius: 12, textAlign: "center" }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) { const dt = new DataTransfer(); dt.items.add(f); fileRef.current.files = dt.files; handleImport({ target: fileRef.current }); }
            }}
          >
            <div style={{ fontSize: 30, marginBottom: 7 }}>📂</div>
            <div style={{ color: G.muted, fontSize: 12 }}>Drag & drop a <code style={{ color: G.blue, fontFamily: "monospace" }}>.json</code> backup file here</div>
          </div>
        </div>
      </Card>

      {/* ── Info ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: "15px 18px", background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 12 }}>
        <div style={{ color: G.blue, fontWeight: 700, fontSize: 13, marginBottom: 7 }}>ℹ️ Storage Notes</div>
        <div style={{ color: G.muted, fontSize: 12, lineHeight: 1.8 }}>
          • <b style={{ color: G.text }}>Auto-saved:</b> All data is saved automatically to <code style={{ color: G.gold }}>localStorage</code> and persists across browser restarts on this device.<br />
          • <b style={{ color: G.text }}>Excel:</b> Best for reporting, printing, and sharing with stakeholders. Open in Excel or Google Sheets.<br />
          • <b style={{ color: G.text }}>JSON:</b> Full system backup. Use this for migrating to a new device or recovering after clearing browser data.<br />
          • <b style={{ color: G.text }}>Tip:</b> Export a backup after every major data entry session.
        </div>
      </div>
    </div>
  );
}
