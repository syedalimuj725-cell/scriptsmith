import React, { useState, useRef, useEffect } from "react";
import { TEMPLATES, matchIntent } from "./engine.js";

/* ============================================================
   SCRIPTSMITH — offline natural language → PowerShell + Python
   UI layer. The engine lives in ./engine.js.
   ============================================================ */

/* ---------- UI ---------- */

const C = {
  bg: "#0E1116",
  panel: "#161B22",
  panel2: "#1C232D",
  line: "#2A3341",
  amber: "#FFB454",
  amberDim: "#8a6a3e",
  text: "#DCE3EA",
  dim: "#7D8896",
  green: "#7EC97E",
  code: "#C9D4DF",
};

const mono = `ui-monospace, "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace`;

function CopyBtn({ text, label = "Copy" }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setOk(true);
        setTimeout(() => setOk(false), 1400);
      }}
      style={{
        background: ok ? C.green : "transparent",
        color: ok ? "#10130f" : C.amber,
        border: `1px solid ${ok ? C.green : C.amberDim}`,
        borderRadius: 6,
        padding: "4px 12px",
        fontFamily: mono,
        fontSize: 12,
        cursor: "pointer",
        transition: "all .15s",
      }}
    >
      {ok ? "Copied ✓" : label}
    </button>
  );
}

export default function Scriptsmith() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null); // {tpl, slots} | {miss:true}
  const [lang, setLang] = useState("ps");
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(true);
  const recRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVoiceOk(false); return; }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const said = e.results[0][0].transcript;
      setInput(said);
      run(said);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
  }, []);

  function run(text) {
    const t = (text ?? input).trim();
    if (!t) return;
    const tpl = matchIntent(t);
    if (!tpl) { setResult({ miss: true }); return; }
    setResult({ tpl, slots: tpl.parse(t) });
  }

  function toggleMic() {
    if (!recRef.current) return;
    if (listening) { recRef.current.stop(); setListening(false); }
    else { setListening(true); recRef.current.start(); }
  }

  const code = result && !result.miss ? (lang === "ps" ? result.tpl.ps(result.slots) : result.tpl.py(result.slots)) : "";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: mono, padding: "0 0 64px" }}>
      <style>{`
        input::placeholder { color: ${C.dim}; }
        button:focus-visible, input:focus-visible { outline: 2px solid ${C.amber}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
      `}</style>

      {/* header */}
      <header style={{ maxWidth: 780, margin: "0 auto", padding: "28px 18px 10px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1, color: C.amber, fontWeight: 700 }}>
            SCRIPTSMITH
          </h1>
          <span style={{ fontSize: 12, color: C.dim }}>plain English → PowerShell + Python · runs 100% offline · no AI</span>
        </div>
      </header>

      {/* input bar */}
      <section style={{ maxWidth: 780, margin: "0 auto", padding: "8px 18px" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder='e.g. "delete log files older than 14 days in downloads"'
            aria-label="Describe the automation you want"
            style={{
              flex: 1, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8,
              color: C.text, padding: "13px 14px", fontSize: 14, fontFamily: mono, minWidth: 0,
            }}
          />
          {voiceOk && (
            <button
              onClick={toggleMic}
              aria-label={listening ? "Stop listening" : "Speak your request"}
              title="Voice input"
              style={{
                width: 48, borderRadius: 8, border: `1px solid ${listening ? C.amber : C.line}`,
                background: listening ? "#3a2c14" : C.panel, color: listening ? C.amber : C.dim,
                fontSize: 18, cursor: "pointer", animation: listening ? "pulse 1.2s infinite" : "none",
              }}
            >
              {listening ? "●" : "🎙"}
            </button>
          )}
          <button
            onClick={() => run()}
            style={{
              background: C.amber, color: "#181205", border: "none", borderRadius: 8,
              padding: "0 18px", fontFamily: mono, fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}
          >
            Build
          </button>
        </div>
        {!voiceOk && <div style={{ fontSize: 11, color: C.dim, marginTop: 6 }}>Voice input needs Chrome, Edge, or Safari.</div>}
      </section>

      {/* parse readout — the engine showing its work */}
      {result && !result.miss && (
        <section style={{ maxWidth: 780, margin: "14px auto 0", padding: "0 18px" }}>
          <div style={{ border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.amber}`, background: C.panel, borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>
              MATCHED INTENT → <span style={{ color: C.amber }}>{result.tpl.name}</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {result.tpl.chips(result.slots).map((c, i) => (
                <span key={i} style={{
                  fontSize: 12, padding: "3px 10px", borderRadius: 20,
                  border: `1px solid ${c.d ? C.line : C.amberDim}`,
                  color: c.d ? C.dim : C.text, background: C.panel2,
                }}>
                  {c.k}: <b style={{ color: c.d ? C.dim : C.amber }}>{c.v}</b>{c.d ? " (default)" : ""}
                </span>
              ))}
            </div>
          </div>

          {/* code panes */}
          <div style={{ marginTop: 14, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", background: C.panel2, borderBottom: `1px solid ${C.line}` }}>
              {[["ps", "PowerShell (.ps1)"], ["py", "Python (.py)"]].map(([k, label]) => (
                <button key={k} onClick={() => setLang(k)} style={{
                  background: lang === k ? C.panel : "transparent", color: lang === k ? C.amber : C.dim,
                  border: "none", borderBottom: lang === k ? `2px solid ${C.amber}` : "2px solid transparent",
                  padding: "10px 16px", fontFamily: mono, fontSize: 13, cursor: "pointer",
                }}>{label}</button>
              ))}
              <div style={{ marginLeft: "auto", padding: "0 10px" }}>
                <CopyBtn text={code} />
              </div>
            </div>
            <pre style={{
              margin: 0, padding: "16px 16px 20px", background: C.panel, color: C.code,
              fontSize: 12.5, lineHeight: 1.55, overflowX: "auto", whiteSpace: "pre",
            }}>{code}</pre>
          </div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>
            Destructive scripts ship in dry-run mode (-WhatIf / DRY_RUN=True). Review, test, then arm.
          </div>
        </section>
      )}

      {result?.miss && (
        <section style={{ maxWidth: 780, margin: "14px auto 0", padding: "0 18px" }}>
          <div style={{ border: `1px solid ${C.line}`, background: C.panel, borderRadius: 8, padding: "14px", fontSize: 13, color: C.dim }}>
            No template matched that phrasing. This engine is rule-based — try wording from the command library below, or tap an example to load it.
          </div>
        </section>
      )}

      {/* command library */}
      <section style={{ maxWidth: 780, margin: "28px auto 0", padding: "0 18px" }}>
        <div style={{ fontSize: 11, color: C.dim, letterSpacing: 1.5, marginBottom: 10 }}>
          COMMAND LIBRARY — {TEMPLATES.length} AUTOMATIONS · TAP TO TRY
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
          {TEMPLATES.map((t) => (
            <button key={t.id}
              onClick={() => { setInput(t.example); run(t.example); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              style={{
                textAlign: "left", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8,
                padding: "11px 12px", cursor: "pointer", color: C.text, fontFamily: mono,
              }}
            >
              <div style={{ fontSize: 13, marginBottom: 4 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: C.dim }}>"{t.example}"</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
