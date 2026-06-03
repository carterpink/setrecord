/* global React */
/* SetSense Home — answers: interpretation line + result renderers + follow-ups */
const { useState: useStateRes } = React;

// ---------- shared bits ----------
function Camelot({ children }) { return <span className="camelot">{children}</span>; }
function Art({ g }) { return <span className="track-art" style={{ background: g }} />; }

// ---------- the quiet, editable interpretation line ----------
// Solves the two-tier trust trap: the deterministic read is visible and editable.
function Interpret({ read, filters, onRerun }) {
  const [open, setOpen] = useStateRes(false);
  const [f, setF] = useStateRes(filters);

  function set(key, val) { setF((p) => ({ ...p, [key]: val })); }

  return (
    <div className="interpret">
      <div className={`interpret-line ${open ? "open" : ""}`} onClick={() => setOpen(!open)}>
        <span className="lead">I read that as</span>
        {read}
        <span className="refine"><i className="l">pencil</i>refine</span>
        <i className="l chev">chevron-down</i>
      </div>

      {open && (
        <div className="refine-panel glass-2">
          <div className="refine-grid">
            {f.kind === "forgotten" && <>
              <Field label="Not played in">
                <div className="refine-pills">
                  {["3 months", "6 months", "12 months"].map((o) => (
                    <span key={o} className={`fpill ${f.window === o ? "on" : ""}`} onClick={() => set("window", o)}>{o}</span>
                  ))}
                </div>
              </Field>
              <Field label="Never played live">
                <span className={`fpill ${f.neverLive ? "on" : ""}`} onClick={() => set("neverLive", !f.neverLive)}>
                  <i className="l">{f.neverLive ? "check" : "plus"}</i>{f.neverLive ? "on" : "off"}
                </span>
              </Field>
              <Field label="How many">
                <Stepper value={f.count} min={5} max={25} step={5} onChange={(v) => set("count", v)} />
              </Field>
            </>}

            {f.kind === "warmup" && <>
              <Field label="Around BPM">
                <div className="refine-pills">
                  {["120", "124", "128"].map((o) => (
                    <span key={o} className={`fpill ${f.bpm === o ? "on" : ""}`} onClick={() => set("bpm", o)}><span className="mono">{o}</span></span>
                  ))}
                </div>
              </Field>
              <Field label="Length">
                <div className="refine-pills">
                  {["60 min", "90 min", "120 min"].map((o) => (
                    <span key={o} className={`fpill ${f.length === o ? "on" : ""}`} onClick={() => set("length", o)}>{o}</span>
                  ))}
                </div>
              </Field>
              <Field label="Shape">
                <div className="refine-pills">
                  {["Slow burn", "Steady"].map((o) => (
                    <span key={o} className={`fpill ${f.shape === o ? "on" : ""}`} onClick={() => set("shape", o)}>{o}</span>
                  ))}
                </div>
              </Field>
            </>}

            {f.kind === "after" && <>
              <Field label="Mixing out of">
                <span className="fpill on"><span className="mono">{f.source}</span></span>
              </Field>
              <Field label="Keep in key">
                <span className={`fpill ${f.inKey ? "on" : ""}`} onClick={() => set("inKey", !f.inKey)}>
                  <i className="l">{f.inKey ? "check" : "plus"}</i>harmonic only
                </span>
              </Field>
              <Field label="Energy">
                <div className="refine-pills">
                  {["Hold", "Lift"].map((o) => (
                    <span key={o} className={`fpill ${f.energy === o ? "on" : ""}`} onClick={() => set("energy", o)}>{o}</span>
                  ))}
                </div>
              </Field>
            </>}

            {f.kind === "duplicates" && <>
              <Field label="Match on">
                <div className="refine-pills">
                  {["Audio", "Tags"].map((o) => (
                    <span key={o} className={`fpill ${f.match === o ? "on" : ""}`} onClick={() => set("match", o)}>{o}</span>
                  ))}
                </div>
              </Field>
              <Field label="Keep">
                <div className="refine-pills">
                  {["Highest quality", "Newest"].map((o) => (
                    <span key={o} className={`fpill ${f.keep === o ? "on" : ""}`} onClick={() => set("keep", o)}>{o}</span>
                  ))}
                </div>
              </Field>
            </>}
          </div>

          <div className="refine-foot">
            <span className="note">Change anything that looks off — results update instantly.</span>
            <button className="btn btn-secondary" onClick={() => { onRerun?.(f); setOpen(false); }}>
              <i className="l">refresh-cw</i>Update
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return <div className="refine-field"><span className="lbl">{label}</span>{children}</div>;
}
function Stepper({ value, min, max, step, onChange }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - step))}><i className="l">x</i></button>
      <span className="val">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + step))}><i className="l">plus</i></button>
    </div>
  );
}

// ============================================================
//  Result renderers
// ============================================================

const FORGOTTEN = [
  { t: "Anchor song",     a: "Björk · Debut",            bpm: "118.0", key: "6A",  last: "8 months", art: "linear-gradient(135deg,#2A3F6E,#6E2A3F)" },
  { t: "Kerala dust",     a: "Four Tet",                 bpm: "120.0", key: "7A",  last: "11 months", art: "linear-gradient(135deg,#6E2A2A,#2A2A6E)" },
  { t: "Harvest moon",    a: "Avalon Emerson",           bpm: "121.0", key: "7B",  last: "9 months",  art: "linear-gradient(135deg,#5E3F1A,#1A5E3F)" },
  { t: "Reverb gospel",   a: "DJ Python · Mas amable",   bpm: "122.5", key: "8A",  last: "14 months", art: "linear-gradient(135deg,#1A3D5E,#1A5E4D)" },
  { t: "Sundial",         a: "Pangaea",                  bpm: "126.0", key: "9B",  last: "7 months",  art: "linear-gradient(135deg,#3D2A6E,#2A6E5E)" },
  { t: "Glass casket",    a: "Anz",                      bpm: "129.0", key: "10B", last: "10 months", art: "linear-gradient(135deg,#5E1A3F,#3F1A5E)" },
];

function ForgottenResult({ count }) {
  const shown = FORGOTTEN.slice(0, Math.min(6, count));
  const more = Math.max(0, count - shown.length);
  return (
    <div className="answer">
      <div className="res-head">
        <span className="res-title">{count} tracks you've left to rest</span>
        <span className="res-meta">oldest first</span>
      </div>
      <div className="res-card glass-1">
        <div className="track-list">
          {shown.map((t, i) => (
            <div className="track-row" key={i}>
              <Art g={t.art} />
              <div className="track-meta"><div className="t">{t.t}</div><div className="a">{t.a}</div></div>
              <span className="track-last">{t.last}</span>
              <span className="track-bpm">{t.bpm}</span>
              <button className="row-add" title="Add to set"><i className="l">plus</i></button>
            </div>
          ))}
        </div>
        {more > 0 && <div className="bp-more" style={{ paddingLeft: 12 }}>+ {more} more in the full list</div>}
      </div>
    </div>
  );
}

function WarmupResult({ bpm, length, shape }) {
  const start = String(Math.max(116, +bpm - 6));
  const mins = parseInt(length);
  const tracks = Math.round(mins / 5);
  const preview = [
    { t: "Anchor song",   a: "Björk",          bpm: start + ".0", key: "6A" },
    { t: "Kerala dust",   a: "Four Tet",       bpm: "120.0",    key: "7A" },
    { t: "Reverb gospel", a: "DJ Python",      bpm: "122.5",    key: "8A" },
    { t: "Sundial",       a: "Pangaea",        bpm: "126.0",    key: "9B" },
  ];
  return (
    <div className="answer">
      <div className="res-head">
        <span className="res-title">A {mins}-minute warm-up, drafted</span>
        <span className="res-meta">{shape.toLowerCase()}</span>
      </div>
      <div className="build-card glass-1">
        <div className="build-stat-row">
          <div className="build-stat"><div className="v">{tracks}<span className="u">tracks</span></div><div className="k">pulled from your library</div></div>
          <div className="build-stat"><div className="v">{mins}<span className="u">min</span></div><div className="k">runtime</div></div>
          <div className="build-stat"><div className="v" style={{ fontFamily: "var(--font-mono)" }}>{start}<span className="u">→ {bpm}</span></div><div className="k">bpm ramp</div></div>
        </div>
        <div className="curve glass-2">
          <svg viewBox="0 0 600 64" preserveAspectRatio="none">
            <defs>
              <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="rgba(200,255,61,0.30)" />
                <stop offset="1" stopColor="rgba(200,255,61,0)" />
              </linearGradient>
            </defs>
            <path d="M0,58 C120,54 200,48 300,38 C400,28 480,20 600,10 L600,64 L0,64 Z" fill="url(#cg)" />
            <path d="M0,58 C120,54 200,48 300,38 C400,28 480,20 600,10" fill="none" stroke="#C8FF3D" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="build-preview">
          {preview.map((t, i) => (
            <div className="bp-row" key={i}>
              <span className="bp-num">{String(i + 1).padStart(2, "0")}</span>
              <div><div className="bp-t">{t.t}</div><div className="bp-a">{t.a}</div></div>
              <span className="track-bpm">{t.bpm}</span>
              <Camelot>{t.key}</Camelot>
            </div>
          ))}
          <div className="bp-more">…{tracks - 4} more, shaped to the curve</div>
        </div>
        <div className="build-head">
          <span className="res-meta">Nothing's committed yet — open it to mix and reorder.</span>
          <button className="btn btn-primary"><i className="l">layers</i>Open in Build</button>
        </div>
      </div>
    </div>
  );
}

const AFTER = [
  { best: true, t: "Polar inertia", a: "Cassegrain · Soporific", bpm: "128.0", key: "9A",
    chips: [{ k: "acc", v: "Same key" }, { k: "n", v: "Energy holds" }, { k: "n", v: "Clean blend" }] },
  { t: "Limpid air", a: "upsammy · Zoom", bpm: "129.0", key: "10A",
    chips: [{ k: "n", v: "Harmonic ↑" }, { k: "n", v: "+1 bpm" }] },
  { t: "Maelstrom", a: "Objekt · Cocoon Crush", bpm: "132.0", key: "11B",
    chips: [{ k: "n", v: "Lifts energy" }, { k: "n", v: "Bridge to peak" }] },
];

function AfterResult() {
  return (
    <div className="answer">
      <div className="res-head">
        <span className="res-title">Three ways out of Raw</span>
        <span className="res-meta">harmonic from <span style={{ fontFamily: "var(--font-mono)" }}>9A · 128</span></span>
      </div>
      <div className="sugg-stack">
        {AFTER.map((s, i) => (
          <div className={`sugg-card ${s.best ? "glass-3 best" : "glass-2"}`} key={i}>
            {s.best && <span className="best-badge">Best match</span>}
            <div className="sugg-row" style={{ marginTop: s.best ? 6 : 0 }}>
              <div><div className="sugg-title">{s.t}</div><div className="sugg-artist">{s.a}</div></div>
              <div style={{ textAlign: "right" }}>
                <div className="sugg-mono">{s.bpm}</div>
                <div style={{ marginTop: 4 }}><Camelot>{s.key}</Camelot></div>
              </div>
            </div>
            <div className="reason-chips">
              {s.chips.map((c, j) => <span key={j} className={`reason-chip ${c.k === "acc" ? "accent" : ""}`}>{c.v}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const DUPES = [
  { t: "Limpid air", a: "upsammy", keep: "320 kbps · FLAC", drop: "128 kbps · mp3", reason: "same audio, lower quality copy" },
  { t: "Maelstrom", a: "Objekt", keep: "WAV master", drop: "256 kbps · m4a", reason: "duplicate import from March" },
  { t: "Harvest moon", a: "Avalon Emerson", keep: "FLAC", drop: "FLAC (copy 2)", reason: "identical file, two folders" },
];

function DuplicatesResult({ count }) {
  return (
    <div className="answer">
      <div className="res-head">
        <span className="res-title">{count} duplicates worth clearing</span>
        <span className="res-meta">keeping the best copy of each</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {DUPES.map((d, i) => (
          <div className="dup-group glass-1" key={i}>
            <div className="dup-pair">
              <div className="dup-keep">
                <span className="dup-tag keep">keep</span>
                <div className="track-meta"><div className="t">{d.t} — {d.a}</div><div className="a" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{d.keep}</div></div>
              </div>
              <span className="dup-reason">{d.reason}</span>
            </div>
            <div className="dup-pair">
              <div className="dup-keep">
                <span className="dup-tag drop">drop</span>
                <div className="track-meta"><div className="a" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{d.drop}</div></div>
              </div>
              <button className="row-add" title="Remove copy" style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}><i className="l">trash-2</i></button>
            </div>
          </div>
        ))}
        <div className="build-head" style={{ marginTop: 2 }}>
          <span className="res-meta">{count - 3} more grouped the same way.</span>
          <button className="btn btn-primary"><i className="l">circle-check</i>Clear all {count}</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  Query → answer mapping (deterministic interpretation)
// ============================================================
window.answerFor = function answerFor(qRaw) {
  const q = qRaw.toLowerCase();
  if (/dupl|duplicate|clean/.test(q)) {
    return {
      kind: "duplicates",
      filters: { kind: "duplicates", match: "Audio", keep: "Highest quality", count: 12 },
      followups: ["Show near-duplicates too", "Export the cleaned library", "What's taking the most space?"],
    };
  }
  if (/after|next|follow|play after|mix out/.test(q)) {
    return {
      kind: "after",
      filters: { kind: "after", source: "Raw — MPH", inKey: true, energy: "Hold" },
      followups: ["Take the energy up instead", "Something with vocals", "Build the rest of the hour"],
    };
  }
  if (/warm|build|bpm|minute|set|hour/.test(q)) {
    return {
      kind: "warmup",
      filters: { kind: "warmup", bpm: "128", length: "90 min", shape: "Slow burn" },
      followups: ["Make the first 20 minutes slower", "Swap in more dub", "Open in Build"],
    };
  }
  // default: forgotten gems
  return {
    kind: "forgotten",
    filters: { kind: "forgotten", window: "6 months", neverLive: false, count: 10 },
    followups: ["Only the ones under 124 bpm", "Surprise me with one", "Build a set from these"],
  };
};

// readable summary line from filters
window.readLine = function readLine(f) {
  if (f.kind === "forgotten") return (<span className="read">not played in <b>{f.window}+</b>{f.neverLive ? <>, <b>never played live</b></> : null}, top <b>{f.count}</b></span>);
  if (f.kind === "warmup") return (<span className="read"><b className="mono" style={{ fontFamily: "var(--font-mono)" }}>{f.bpm} bpm</b> · <b>{f.length}</b> · {f.shape.toLowerCase()}</span>);
  if (f.kind === "after") return (<span className="read">mixing out of <b>Raw — MPH</b> <span style={{ fontFamily: "var(--font-mono)" }}>(9A · 128)</span>, {f.inKey ? "harmonic" : "any key"}, energy {f.energy.toLowerCase()}</span>);
  if (f.kind === "duplicates") return (<span className="read">matched on <b>{f.match.toLowerCase()}</b>, keeping the <b>{f.keep.toLowerCase()}</b></span>);
  return null;
};

window.ResultBody = function ResultBody({ kind, f }) {
  if (kind === "forgotten") return <ForgottenResult count={f.count} />;
  if (kind === "warmup") return <WarmupResult bpm={f.bpm} length={f.length} shape={f.shape} />;
  if (kind === "after") return <AfterResult />;
  if (kind === "duplicates") return <DuplicatesResult count={f.count} />;
  return null;
};

window.Interpret = Interpret;
