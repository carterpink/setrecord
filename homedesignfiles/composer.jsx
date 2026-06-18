/* global React */
/* SetRecord Home — the neural-expressive composer */
const { useRef: useRefC, useEffect: useEffectC } = React;

// React-owned inline icon (bypasses the icons.js DOM-swap to avoid reconcile conflicts on toggling icons)
function Ico({ name, style }) {
  const html = (window.ssIcon && window.ssIcon(name)) || "";
  return <i className="ico" style={{ display: "inline-flex", lineHeight: 0, ...style }} dangerouslySetInnerHTML={{ __html: html }} />;
}

function NeuralField() {
  return (
    <div className="neural" aria-hidden="true">
      <span className="blob b1" />
      <span className="blob b2" />
      <span className="blob b3" />
      <span className="blob b4" />
    </div>
  );
}

// phase: "idle" | "listening" | "thinking"
window.Composer = function Composer({
  phase, value, onChange, onSubmit, onMicToggle, focused, onFocus, onBlur, placeholder,
}) {
  const rootRef = useRefC(null);
  const taRef = useRefC(null);
  const rafRef = useRefC(0);

  // autosize textarea
  useEffectC(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(160, ta.scrollHeight) + "px";
  }, [value]);

  // drive the neural swell level (--lvl) on the composer root
  useEffectC(() => {
    const el = rootRef.current;
    if (!el) return;
    if (phase === "listening") {
      let t = 0;
      const tick = () => {
        t += 0.08;
        // organic-ish level: layered sines + a little jitter
        const v = 0.45 + 0.3 * Math.sin(t * 2.1) + 0.18 * Math.sin(t * 5.3) + (Math.random() - 0.5) * 0.12;
        el.style.setProperty("--lvl", Math.max(0.05, Math.min(1, (v + 0.2))).toFixed(3));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      return () => cancelAnimationFrame(rafRef.current);
    }
    if (phase === "thinking") {
      el.style.setProperty("--lvl", "0.55");
    } else {
      el.style.setProperty("--lvl", "0");
    }
  }, [phase]);

  const listening = phase === "listening";
  const thinking = phase === "thinking";
  const ready = value.trim().length > 0 && !listening;

  function keyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (ready) onSubmit(); }
  }

  return (
    <div
      ref={rootRef}
      className={`composer ${focused ? "focused" : ""} ${listening ? "listening" : ""} ${thinking ? "thinking" : ""}`}
      style={{ "--lvl": 0 }}
    >
      <NeuralField />
      <div className="box">
        <div className="box-inner glass-3 box-glow">
          <div className="box-input-row">
            <textarea
              ref={taRef}
              className="box-text"
              rows={1}
              value={value}
              placeholder={listening ? "" : placeholder}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={keyDown}
              onFocus={onFocus}
              onBlur={onBlur}
              readOnly={listening}
            />
            <button
              className={`mic-btn ${listening ? "live" : ""}`}
              onClick={onMicToggle}
              title={listening ? "Stop" : "Speak"}
            >
              <Ico name={listening ? "audio-lines" : "mic"} />
            </button>
            <button className={`send-btn ${ready ? "ready" : ""}`} onClick={() => ready && onSubmit()} title="Send">
              <Ico name="arrow-up" />
            </button>
          </div>

          {listening ? (
            <div className="listen-bar">
              <span className="listen-state">
                <span className="eq"><span /><span /><span /><span /><span /></span>
                Listening — keep going
              </span>
              <span className="stop-link" onClick={onMicToggle}><Ico name="stop-circle" />tap to stop</span>
            </div>
          ) : (
            <div className="box-actions">
              <div className="box-actions-left">
                <span className="box-hint"><Ico name="command" />Everything stays on this machine</span>
              </div>
              <span className="box-hint"><span className="kbd">↵</span>to send · <span className="kbd">⇧↵</span>new line</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
