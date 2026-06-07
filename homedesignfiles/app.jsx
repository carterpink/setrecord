/* global React, ReactDOM, Composer, Interpret, ResultBody, answerFor, readLine,
   useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSlider */
const { useState: useStateApp, useEffect: useEffectApp, useRef: useRefApp } = React;

const PLACEHOLDERS = [
  "Ask anything about your library — or just talk",
  "Find something, build something, or ask what's next",
  "What are we building tonight?",
];
const DICTATIONS = [
  "what do I play after Raw by MPH",
  "help me build a 90-minute warm-up around 128 bpm",
  "find me 10 songs i havent played in ages",
];

const EXAMPLES = [
  { icon: "clock", text: "find me 10 songs i havent played in ages" },
  { icon: "layers", text: "help me build a 90-minute warm-up around 128 bpm" },
  { icon: "disc-3", text: "what do I play after Raw by MPH" },
  { icon: "copy", text: "clean up my duplicates" },
];

function greetingParts() {
  const d = new Date();
  const h = d.getHours();
  const day = d.toLocaleDateString("en-US", { weekday: "long" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  let line;
  if (h >= 22 || h < 5) line = <>Late one, <b>Mara</b>.</>;
  else if (h < 12) line = <>Morning, <b>Mara</b>.</>;
  else if (h < 18) line = <>Afternoon, <b>Mara</b>.</>;
  else line = <>Evening, <b>Mara</b>.</>;
  return { eyebrow: `${day} · ${time}`.toUpperCase(), line };
}

function TweakDefaults() {
  return /*EDITMODE-BEGIN*/{
    "expressiveness": "Full neural",
    "glow": 100,
  }/*EDITMODE-END*/;
}

const EXPR_MAP = {
  "Restrained": 0.18,
  "Living":     0.55,
  "Full neural": 1.0,
};

function Turn({ turn, onRerun, onFollow }) {
  if (turn.pending) {
    return (
      <div className="turn">
        <div className="user-line">{turn.query}</div>
        <div className="thinking-line">
          <span className="thinking-dots"><span /><span /><span /></span>
          Reading your library…
        </div>
      </div>
    );
  }
  return (
    <div className="turn">
      <div className="user-line">{turn.query}</div>
      <div className="answer">
        <Interpret read={readLine(turn.filters)} filters={turn.filters} onRerun={(f) => onRerun(turn.id, f)} />
        <ResultBody kind={turn.kind} f={turn.filters} />
        <div className="followups">
          {turn.followups.map((fu, i) => (
            <button className="followup" key={i} onClick={() => onFollow(fu)}>
              <i className="l">arrow-right</i>{fu}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TweakDefaults());
  const [thread, setThread] = useStateApp([]);
  const [phase, setPhase] = useStateApp("idle"); // idle | listening | thinking
  const [value, setValue] = useStateApp("");
  const [focused, setFocused] = useStateApp(false);
  const [phIdx] = useStateApp(() => Math.floor(Math.random() * PLACEHOLDERS.length));
  const dictRef = useRefApp({ i: 0, timer: null });
  const scrollRef = useRefApp(null);
  const idRef = useRefApp(1);

  const active = thread.length > 0 || phase === "thinking";
  const greet = greetingParts();

  // apply tweaks to CSS vars
  useEffectApp(() => {
    const r = document.documentElement;
    r.style.setProperty("--neural", String(EXPR_MAP[t.expressiveness] ?? 1));
    r.style.setProperty("--glow", (t.glow / 100).toFixed(2));
  }, [t.expressiveness, t.glow]);

  // autoscroll on new content
  useEffectApp(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread, phase]);

  function runQuery(text) {
    const q = text.trim();
    if (!q) return;
    const ans = answerFor(q);
    const id = idRef.current++;
    setValue("");
    setPhase("thinking");
    setThread((prev) => [...prev, { id, query: q, pending: true }]);
    setTimeout(() => {
      setThread((prev) => prev.map((tr) => tr.id === id
        ? { id, query: q, pending: false, kind: ans.kind, filters: ans.filters, followups: ans.followups }
        : tr));
      setPhase("idle");
    }, 1100);
  }

  function onRerun(id, filters) {
    setThread((prev) => prev.map((tr) => (tr.id === id ? { ...tr, filters } : tr)));
  }

  function stopDictation() {
    if (dictRef.current.timer) { clearTimeout(dictRef.current.timer); dictRef.current.timer = null; }
  }

  function toggleMic() {
    if (phase === "listening") {
      stopDictation();
      setPhase("idle");
      return;
    }
    // begin dictation
    const phrase = DICTATIONS[dictRef.current.i % DICTATIONS.length];
    dictRef.current.i++;
    const words = phrase.split(" ");
    setValue("");
    setPhase("listening");
    let k = 0;
    const step = () => {
      k++;
      setValue(words.slice(0, k).join(" "));
      if (k < words.length) {
        dictRef.current.timer = setTimeout(step, 95 + Math.random() * 95);
      } else {
        // finished speaking — settle, then send
        dictRef.current.timer = setTimeout(() => {
          setPhase("idle");
          runQuery(words.join(" "));
        }, 560);
      }
    };
    dictRef.current.timer = setTimeout(step, 260);
  }

  const composer = (
    <Composer
      phase={phase}
      value={value}
      onChange={setValue}
      onSubmit={() => runQuery(value)}
      onMicToggle={toggleMic}
      focused={focused}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={PLACEHOLDERS[phIdx]}
    />
  );

  return (
    <div className="home">
      <div className="aurora" />
      <div className="vignette" />

      <div className="home-top">
        <span className="logo"><span className="logo-mark" /><span className="logo-text">SetSense</span></span>
        <div className="home-top-right">
          <button className="workspace-link"><i className="l">history</i>History</button>
          <button className="workspace-link"><i className="l">layers</i>Workspace</button>
        </div>
      </div>

      <div className="stage">
        {!active ? (
          <div className={`greet-wrap ${phase === "listening" ? "engaged" : ""}`}>
            <div className="greeting">
              <div className="eyebrow">{greet.eyebrow}</div>
              <h1>{greet.line}</h1>
              <div className="sub">What do you want to do with your library?</div>
            </div>
            <div className="composer-dock idle" style={{ paddingBottom: 0 }}>{composer}</div>
            <div className="examples">
              {EXAMPLES.map((ex, i) => (
                <button className="example" key={i} onClick={() => runQuery(ex.text)}>
                  <i className="l">{ex.icon}</i>{ex.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="thread-scroll" ref={scrollRef}>
              <div className="thread">
                {thread.map((tr) => (
                  <Turn key={tr.id} turn={tr} onRerun={onRerun} onFollow={runQuery} />
                ))}
              </div>
            </div>
            <div className="composer-dock">{composer}</div>
          </>
        )}
      </div>

      <TweaksPanel>
        <TweakSection label="The box" />
        <TweakRadio
          label="Expressiveness"
          value={t.expressiveness}
          options={["Restrained", "Living", "Full neural"]}
          onChange={(v) => setTweak("expressiveness", v)}
        />
        <TweakSlider
          label="Accent glow"
          value={t.glow}
          min={0} max={100} unit="%"
          onChange={(v) => setTweak("glow", v)}
        />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
