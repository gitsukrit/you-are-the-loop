import React, { useState, useRef, useEffect, useCallback } from "react";
import { Play, RotateCcw, Sparkles, Loader2, Copy, Check, Pause } from "lucide-react";

// ============ palette ============
const C = {
  bg: "#FAFAF7", ink: "#1F2329", pipe: "#E8E8E2",
  low: "#2BB673", mid: "#F0A219", high: "#E5484D",
  blue: "#3B6FF6", soft: "#8A8F98",
};
const MONO = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };
const ROUND = { fontFamily: "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif" };

const HEADLINES = [
  "Bot refunds $1,280 to fraudster 🥷",
  "AI approves chargeback in 0.3 seconds 💸",
  "Bot upgrades entire hostel to penthouse 🛎️",
  "Customer's lawyer thanks 'the helpful robot' ⚖️",
  "AI promises helicopter transfer. There is no helicopter. 🚁",
  "Bot apologizes 47 times, refunds twice 🤖",
];

const DAY_LENGTH = 60;

// share of traffic the AI would handle at threshold a (risk distribution: 55% low, 30% mid, 15% high)
function aiShare(a) {
  let p;
  if (a <= 35) p = 0.55 * (a / 35);
  else if (a <= 70) p = 0.55 + 0.30 * ((a - 35) / 35);
  else p = 0.85 + 0.15 * ((a - 70) / 30);
  return Math.round(Math.min(1, p) * 100);
}

function freshSim() {
  return {
    dots: [], fx: [], t: 0, dayT: 0, lastSpawn: 0,
    queue: [], procTimers: [],
    csat: 90, cost: 0, costN: 0, incidents: 0, churn: 0,
    autoCount: 0, humanCount: 0, escCount: 0, total: 0,
    surge: false, surgeAt: 20 + Math.random() * 8, surgeDone: false, surgeEndsAt: 0,
    over: false, paused: false, tutorial: false,
  };
}

const TUT = [
  { emoji: "🎫", text: "Each dot is a customer ticket. Color = how risky it is.", sub: "🟢 easy question · 🟡 money involved · 🔴 legal / fraud", btn: "Got it" },
  { emoji: "🚦", text: "Every ticket gets a risk score from 0 to 100. Your AI autonomy dial draws the line on that scale.", sub: "Everything in the 🤖 AI zone (left of your line) is handled solo by AI. Everything riskier goes to 🧑‍💻 your team.", btn: "Show me the dial" },
  { emoji: "🎛️", text: "Drag the slider and watch the AI zone grow into riskier territory.", sub: "Go on — this one's required 😄", btn: null },
  { emoji: "⚖️", text: "The tension: high autonomy → 💥 incidents. Low autonomy → your team drowns and customers walk 💢.", sub: "You have 60 seconds. Find the line.", btn: "Start the clock ▶" },
];

export default function YouAreTheLoop() {
  const canvasRef = useRef(null);
  const simRef = useRef(freshSim());
  const autonomyRef = useRef(45);
  const humansRef = useRef(2);
  const tutStepRef = useRef(0);

  const [autonomy, setAutonomy] = useState(45);
  const [humans, setHumans] = useState(2);
  const [hud, setHud] = useState({ csat: 90, cost: "0.00", incidents: 0, churn: 0, time: DAY_LENGTH, queue: 0 });
  const [toasts, setToasts] = useState([]);
  const [phase, setPhase] = useState("intro"); // intro | tutorial | playing | report
  const [tutStep, setTutStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [report, setReport] = useState(null);
  const [copied, setCopied] = useState(false);

  const [ticketText, setTicketText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState(null);

  useEffect(() => { autonomyRef.current = autonomy; }, [autonomy]);
  useEffect(() => { humansRef.current = humans; }, [humans]);
  useEffect(() => { tutStepRef.current = tutStep; }, [tutStep]);
  useEffect(() => { simRef.current.paused = paused; }, [paused]);

  const pushToast = useCallback((text, tone) => {
    const id = Math.random();
    setToasts(ts => [...ts.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 3200);
  }, []);

  const startTutorial = () => {
    simRef.current = freshSim();
    simRef.current.tutorial = true;
    setTutStep(0); setReport(null); setToasts([]); setPaused(false);
    setPhase("tutorial");
  };
  const startDay = () => {
    const s = simRef.current;
    s.tutorial = false; s.dayT = 0;
    s.csat = 90; s.cost = 0; s.costN = 0; s.incidents = 0; s.churn = 0;
    s.autoCount = 0; s.humanCount = 0; s.escCount = 0; s.total = s.dots.length;
    setPhase("playing");
  };
  const replay = () => { startTutorialSkip(); };
  const startTutorialSkip = () => {
    simRef.current = freshSim();
    setReport(null); setToasts([]); setPaused(false);
    setPhase("playing");
  };

  const onAutonomy = (v) => {
    setAutonomy(v);
    if (phase === "tutorial" && tutStepRef.current === 2) {
      setTimeout(() => setTutStep(3), 500);
    }
  };

  // ============ game loop (runs for tutorial + playing) ============
  useEffect(() => {
    if (phase !== "playing" && phase !== "tutorial") return;
    let raf, last = performance.now();

    const loop = (now) => {
      const dt0 = Math.min(0.05, (now - last) / 1000); last = now;
      const s = simRef.current;
      const dt = s.paused ? 0 : dt0;
      const canvas = canvasRef.current;
      if (!canvas) { raf = requestAnimationFrame(loop); return; }

      s.t += dt;
      if (!s.tutorial) s.dayT += dt;

      if (!s.tutorial) {
        if (!s.surgeDone && s.dayT > s.surgeAt) {
          s.surge = true; s.surgeDone = true; s.surgeEndsAt = s.dayT + 12;
          pushToast("📈 Monday spike! Volume x2.5", "warn");
        }
        if (s.surge && s.dayT > s.surgeEndsAt) { s.surge = false; pushToast("Volume back to normal", "ok"); }
      }

      // spawn — gentle ramp-up, very slow in tutorial
      const ramp = s.tutorial ? 2.2 : Math.max(0.7, 1.15 - s.dayT * 0.03);
      const rate = ramp / (s.surge ? 2.5 : 1);
      if (s.t - s.lastSpawn > rate) {
        s.lastSpawn = s.t;
        const r = Math.random();
        const risk = r < 0.55 ? Math.random() * 35 : r < 0.85 ? 35 + Math.random() * 35 : 70 + Math.random() * 30;
        s.dots.push({ risk, p: 0, lane: null, x: 0, y: 0, state: "intake", wait: 0 });
        s.total++;
      }

      const W = canvas.width / (window.devicePixelRatio || 1);
      const H = canvas.height / (window.devicePixelRatio || 1);
      const midY = H * 0.5, junctionX = W * 0.36;
      const laneY = { auto: H * 0.18, human: H * 0.55, esc: H * 0.86 };
      const deskX = W * 0.72;

      const cap = humansRef.current;
      while (s.procTimers.length < cap) s.procTimers.push(0);
      s.procTimers.length = cap;
      for (let i = 0; i < cap; i++) {
        s.procTimers[i] -= dt;
        if (s.procTimers[i] <= 0 && s.queue.length > 0) {
          const d = s.queue.shift();
          d.state = "done"; s.humanCount++;
          s.cost += 4; s.costN++;
          s.procTimers[i] = d.lane === "esc" ? 2.2 : 1.3;
        }
      }

      for (const d of s.dots) {
        if (d.state === "intake") {
          d.p += dt * 0.5;
          d.x = d.p * junctionX; d.y = midY + Math.sin(d.p * 9 + d.risk) * 4;
          if (d.p >= 1) {
            const a = autonomyRef.current;
            if (d.risk >= 85) d.lane = "esc";
            else if (d.risk <= a) d.lane = "auto";
            else d.lane = "human";
            d.state = "routing"; d.p = 0; d.sx = d.x; d.sy = d.y;
          }
        } else if (d.state === "routing") {
          d.p += dt * (d.lane === "auto" ? 0.85 : 0.7);
          const ty = laneY[d.lane];
          const tx = d.lane === "auto" ? W + 20 : deskX;
          d.x = d.sx + (tx - d.sx) * d.p;
          d.y = d.sy + (ty - d.sy) * Math.min(1, d.p * 1.6);
          if (d.p >= 1) {
            if (d.lane === "auto") {
              d.state = "done"; s.autoCount++; s.cost += 0.4; s.costN++;
              if (!s.tutorial && d.risk > 40) {
                const pInc = Math.pow((d.risk - 40) / 60, 2) * 0.55;
                if (Math.random() < pInc) {
                  s.incidents++; s.csat = Math.max(0, s.csat - 6); s.cost += 50;
                  s.fx.push({ x: W - 30, y: laneY.auto, t0: s.t, emoji: "💥" });
                  pushToast(HEADLINES[Math.floor(Math.random() * HEADLINES.length)], "bad");
                }
              }
            } else {
              if (d.lane === "esc") s.escCount++;
              if (s.queue.length >= 9) {
                d.state = "churn"; d.p = 0; s.churn++; s.csat = Math.max(0, s.csat - 1.5);
                s.fx.push({ x: d.x, y: d.y, t0: s.t, emoji: "💢" });
              } else { d.state = "queued"; s.queue.push(d); }
            }
          }
        } else if (d.state === "queued") {
          const idx = s.queue.indexOf(d);
          const tx = deskX - 16 - idx * 13;
          d.x += (tx - d.x) * Math.min(1, dt * 8);
          d.y += (laneY[d.lane] - d.y) * Math.min(1, dt * 8);
          d.wait += dt;
          if (d.wait > 6 && !s.tutorial) s.csat = Math.max(0, s.csat - dt * 0.4);
        } else if (d.state === "churn") {
          d.p += dt * 1.4; d.y += dt * 90; d.x += dt * 50;
        }
      }
      s.dots = s.dots.filter(d => d.state !== "done" && !(d.state === "churn" && d.p > 1));
      s.fx = s.fx.filter(f => s.t - f.t0 < 0.9);
      if (s.queue.length < 5 && !s.tutorial) s.csat = Math.min(100, s.csat + dt * 0.25);

      // --- draw ---
      const ctx = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      ctx.save(); ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      // pipes
      ctx.lineCap = "round"; ctx.lineWidth = 14; ctx.strokeStyle = C.pipe;
      ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(junctionX, midY); ctx.stroke();
      for (const [k, endX] of [["auto", W], ["human", deskX], ["esc", deskX]]) {
        ctx.beginPath(); ctx.moveTo(junctionX, midY);
        ctx.quadraticCurveTo(junctionX + 50, laneY[k], junctionX + 110, laneY[k]);
        ctx.lineTo(endX, laneY[k]); ctx.stroke();
      }

      // lane labels (always visible — the canvas explains itself)
      ctx.textBaseline = "middle";
      ctx.font = "bold 14px system-ui";
      ctx.fillStyle = C.low;  ctx.fillText("🤖 AI handles alone", junctionX + 118, laneY.auto - 18);
      ctx.fillStyle = C.mid;  ctx.fillText(`🧑‍💻 Your team — queue ${s.queue.length}/9`, junctionX + 118, laneY.human - 18);
      ctx.fillStyle = C.high; ctx.fillText("🧑‍⚖️ Senior review (always human)", junctionX + 118, laneY.esc - 18);
      ctx.fillStyle = C.soft; ctx.font = "bold 13px system-ui";
      ctx.fillText("tickets in →", 8, midY - 18);

      // gate with live threshold
      ctx.fillStyle = C.ink;
      ctx.beginPath(); ctx.arc(junctionX, midY, 9, 0, 7); ctx.fill();
      ctx.font = "bold 13px system-ui"; ctx.fillStyle = C.ink;
      ctx.textAlign = "center";
      ctx.fillText(`GATE 0–${Math.round(autonomyRef.current)}`, junctionX, midY + 26);
      ctx.textAlign = "left";

      // desk capacity pips
      for (let i = 0; i < cap; i++) {
        ctx.fillStyle = s.procTimers[i] > 0 ? C.mid : "#D6D6CE";
        ctx.fillRect(deskX + 8 + i * 12, laneY.human - 5, 9, 10);
      }
      ctx.font = "20px system-ui";
      ctx.fillText("🧑‍💻", deskX + 8, laneY.human + 22);
      ctx.fillText("🧑‍⚖️", deskX + 8, laneY.esc);

      // dots
      for (const d of s.dots) {
        const col = d.risk >= 70 ? C.high : d.risk >= 35 ? C.mid : C.low;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(d.x, d.y, 7.5, 0, 7); ctx.fill();
      }
      // fx
      for (const f of s.fx) {
        const age = (s.t - f.t0) / 0.9;
        ctx.globalAlpha = 1 - age;
        ctx.font = `${22 + age * 16}px system-ui`;
        ctx.fillText(f.emoji, f.x - 10, f.y - age * 20);
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      if (Math.floor(s.t * 4) !== Math.floor((s.t - dt0) * 4)) {
        setHud({
          csat: Math.round(s.csat),
          cost: s.costN ? (s.cost / s.costN).toFixed(2) : "0.00",
          incidents: s.incidents, churn: s.churn,
          time: Math.max(0, Math.ceil(DAY_LENGTH - s.dayT)),
          queue: s.queue.length,
        });
      }

      if (!s.tutorial && s.dayT >= DAY_LENGTH && !s.over) {
        s.over = true;
        const avgCost = s.costN ? s.cost / s.costN : 0;
        const score = s.csat - s.incidents * 6 - s.churn * 1.5 - Math.max(0, avgCost - 2.5) * 4;
        const grade = score >= 85 ? "A" : score >= 72 ? "B" : score >= 58 ? "C" : score >= 42 ? "D" : "F";
        setReport({
          grade, csat: Math.round(s.csat), incidents: s.incidents, churn: s.churn,
          avgCost: avgCost.toFixed(2), autonomy: Math.round(autonomyRef.current),
          autoShare: Math.round((s.autoCount / Math.max(1, s.autoCount + s.humanCount)) * 100),
        });
        setPhase("report");
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, pushToast]);

  // canvas sizing
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = cv.parentElement.clientWidth;
      const h = Math.min(360, Math.max(280, w * 0.52));
      cv.width = w * dpr; cv.height = h * dpr;
      cv.style.width = w + "px"; cv.style.height = h + "px";
    };
    resize(); window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [phase]);

  async function triageReal() {
    if (!ticketText.trim() || aiBusy) return;
    setAiBusy(true); setAiResult(null); setAiError(null);
    try {
      const prompt = `You are an AI triage engine for a customer support desk (travel booking platform). Analyze this ticket. Respond ONLY with raw JSON, no fences:
{"intent":"<3-5 word label>","risk_score":<0-100 integer for financial/legal/fraud exposure>,"confidence":<0.0-1.0>,"draft_reply":"<2-3 sentences>","reasoning":"<one short sentence>"}

draft_reply rules: it must RESOLVE the issue, not defer it. State a concrete action already taken or exact steps the customer can do right now, with specifics and a timeframe (e.g. "I've pulled 3 comparable hotels at the same rate — here are your rebooking options in the app under Trips > Rebook" or "Your duplicate charge of $89 has been reversed; it will appear in 3-5 business days"). Invent plausible specifics. NEVER write vague reassurance like "our team is on it" or "someone will look into this".
reasoning must be consistent with risk_score (0-30 low, 31-69 moderate, 70+ high).

Ticket: ${ticketText.trim().slice(0, 600)}`;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
      const ai = JSON.parse(text.replace(/```json|```/g, "").trim());
      setAiResult(ai);
    } catch (e) {
      setAiError("Triage hiccup — try once more.");
    }
    setAiBusy(false);
  }

  const shareLine = report
    ? `I ran a support desk at ${report.autonomy}% AI autonomy: grade ${report.grade} — CSAT ${report.csat}, ${report.incidents} incidents, $${report.avgCost}/ticket. Where would you set the dial?`
    : "";
  const laneLabel = { auto: ["🤖 Auto-resolved", C.low], human: ["🧑‍💻 Human review", C.mid], esc: ["🧑‍⚖️ Escalated", C.high] };
  const inGame = phase === "playing" || phase === "tutorial";

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.ink }}>
      <div className="max-w-3xl mx-auto px-4 py-6">

        <div className="text-center mb-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={ROUND}>You Are The Loop</h1>
          <p className="text-sm mt-1" style={{ color: C.soft }}>Run a support desk for 60 seconds. Decide how much to trust the AI. Live with it.</p>
        </div>

        {phase === "intro" && (
          <div className="text-center py-10">
            <div className="flex justify-center gap-6 text-4xl mb-6"><span>🟢</span><span>🟡</span><span>🔴</span></div>
            <p className="max-w-md mx-auto text-base mb-8">Tickets flow in. <b>One dial</b> decides which ones the AI handles alone.</p>
            <button onClick={startTutorial} className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-white text-lg font-bold shadow-lg hover:scale-105 transition-transform focus:outline-none focus:ring-4 focus:ring-blue-300" style={{ background: C.ink, ...ROUND }}>
              <Play className="w-5 h-5" /> Start (30-sec tutorial)
            </button>
            <div>
              <button onClick={startTutorialSkip} className="mt-3 text-sm underline focus:outline-none" style={{ color: C.soft }}>
                I've played before — skip to the shift
              </button>
            </div>
          </div>
        )}

        {inGame && (
          <>
            {phase === "playing" && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-3 text-center items-center" style={MONO}>
                <div className="bg-white rounded-lg py-1.5 border border-stone-200"><div className="text-base font-bold">⏱ {hud.time}s</div><div className="text-xs" style={{ color: C.soft }}>time left</div></div>
                <div className="bg-white rounded-lg py-1.5 border border-stone-200"><div className="text-base font-bold">😊 {hud.csat}</div><div className="text-xs" style={{ color: C.soft }}>happiness</div></div>
                <div className="bg-white rounded-lg py-1.5 border border-stone-200"><div className="text-base font-bold">${hud.cost}</div><div className="text-xs" style={{ color: C.soft }}>per ticket</div></div>
                <div className="bg-white rounded-lg py-1.5 border border-stone-200"><div className="text-base font-bold">💥 {hud.incidents}</div><div className="text-xs" style={{ color: C.soft }}>AI disasters</div></div>
                <div className="bg-white rounded-lg py-1.5 border border-stone-200"><div className="text-base font-bold">💢 {hud.churn}</div><div className="text-xs" style={{ color: C.soft }}>walked away</div></div>
                <button onClick={() => setPaused(p => !p)} className="bg-white rounded-lg py-3 border border-stone-300 hover:border-stone-500 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300" aria-label={paused ? "resume" : "pause"}>
                  {paused ? "▶ resume" : "⏸ pause"}
                </button>
              </div>
            )}
            {phase === "tutorial" && (
              <div className="mb-3 bg-white border-2 rounded-2xl p-4 text-center" style={{ borderColor: C.blue }}>
                <p className="text-2xl mb-1">{TUT[tutStep].emoji}</p>
                <p className="font-bold" style={ROUND}>{TUT[tutStep].text}</p>
                <p className="text-xs mt-1" style={{ color: C.soft }}>{TUT[tutStep].sub}</p>
                {TUT[tutStep].btn && (
                  <button onClick={() => (tutStep === 3 ? startDay() : setTutStep(tutStep + 1))}
                    className="mt-3 px-5 py-2 rounded-xl text-white font-bold focus:outline-none focus:ring-4 focus:ring-blue-300" style={{ background: tutStep === 3 ? C.low : C.blue, ...ROUND }}>
                    {TUT[tutStep].btn}
                  </button>
                )}
                <div className="flex justify-center gap-1.5 mt-3">
                  {TUT.map((_, i) => <span key={i} className="w-2 h-2 rounded-full" style={{ background: i <= tutStep ? C.blue : "#DDD" }} />)}
                </div>
              </div>
            )}

            <div className="relative bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <canvas ref={canvasRef} />
              <div className="absolute top-2 left-0 right-0 flex flex-col items-center gap-1 pointer-events-none">
                {toasts.map(t => (
                  <div key={t.id} className={`px-3 py-1.5 rounded-full text-xs font-semibold shadow ${t.tone === "bad" ? "bg-rose-600 text-white" : t.tone === "warn" ? "bg-amber-500 text-white" : "bg-emerald-600 text-white"}`}>
                    {t.text}
                  </div>
                ))}
              </div>
            </div>

            {/* legend */}
            <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs" style={{ color: C.soft }}>
              <span>🟢 low risk</span><span>🟡 money involved</span><span>🔴 legal / fraud</span><span>queue max 9 → customers walk</span>
            </div>

            <div className="mt-3 space-y-4">
              <div className={phase === "tutorial" && tutStep === 2 ? "ring-4 ring-blue-300 rounded-xl p-2 -m-2 animate-pulse" : ""}>
                <div className="flex justify-between text-sm font-bold mb-1" style={ROUND}>
                  <span>🤖 AI autonomy</span>
                  <span style={MONO}>AI takes risk 0–{autonomy} · ≈{aiShare(autonomy)}% of tickets</span>
                </div>
                {/* risk spectrum: green→red, with the dial as a boundary line */}
                <div className="relative h-8 rounded-lg overflow-hidden border border-stone-300"
                  style={{ background: "linear-gradient(to right, #2BB673 0%, #A8C94B 35%, #F0A219 60%, #E5484D 100%)" }}>
                  <div className="absolute inset-y-0 left-0 flex items-center justify-center text-xs font-bold text-white"
                    style={{ width: autonomy + "%", background: "rgba(31,35,41,0.28)", transition: "width 80ms linear", overflow: "hidden", whiteSpace: "nowrap" }}>
                    {autonomy > 18 ? "🤖 AI zone" : ""}
                  </div>
                  <div className="absolute inset-y-0 flex items-center justify-center text-xs font-bold"
                    style={{ left: autonomy + "%", right: 0, color: "#1F2329", overflow: "hidden", whiteSpace: "nowrap", transition: "left 80ms linear" }}>
                    {autonomy < 82 ? "🧑 humans" : ""}
                  </div>
                  <div className="absolute inset-y-0 w-1 bg-white shadow" style={{ left: `calc(${autonomy}% - 2px)`, transition: "left 80ms linear" }} />
                </div>
                <input type="range" min="0" max="100" value={autonomy} onChange={e => onAutonomy(+e.target.value)}
                  className="w-full h-3 accent-emerald-600 cursor-pointer -mt-1" aria-label="AI autonomy: maximum risk the AI handles alone" />
                <div className="flex justify-between text-xs" style={{ color: C.soft }}>
                  <span>0 · risk-free only</span><span>risk grows →</span><span>100 · AI takes everything</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm font-bold mb-1" style={ROUND}>
                  <span>🧑‍💻 Humans on desk</span><span style={MONO}>{humans} · $4/ticket each</span>
                </div>
                <input type="range" min="1" max="5" value={humans} onChange={e => setHumans(+e.target.value)}
                  className="w-full h-3 accent-amber-500 cursor-pointer" aria-label="Humans on desk" />
                <div className="flex justify-between text-xs" style={{ color: C.soft }}><span>1 (cheap)</span><span>5 (fast, costly)</span></div>
              </div>
            </div>
          </>
        )}

        {phase === "report" && report && (() => {
          const pen = [
            { k: "inc", v: report.incidents * 6, msg: "💥 Incidents hurt you most — your dial let risky 🔴 tickets through to the AI. Lower autonomy, or add humans and let them absorb more." },
            { k: "churn", v: report.churn * 1.5, msg: "💢 Lost customers hurt you most — your team's queue overflowed. Raise autonomy on the easy 🟢 tickets, or put more humans on desk." },
            { k: "cost", v: Math.max(0, parseFloat(report.avgCost) - 2.5) * 4, msg: "💸 Cost hurt you most — humans handled too much routine work at $4 a ticket. Nudge autonomy up so the AI takes the greens." },
          ].sort((a, b) => b.v - a.v);
          const verdict = pen[0].v < 3 ? "🏆 Clean shift — you found the line between trust and chaos." : pen[0].msg;
          const ROWS = [
            ["😊 Happiness (CSAT)", report.csat, "how customers felt by end of shift (starts at 90)"],
            ["💥 AI disasters", report.incidents, "risky tickets the AI mishandled alone (−6 happiness, +$50 each)"],
            ["💢 Walked away", report.churn, "customers who left because your queue was full"],
            ["💸 Cost per ticket", "$" + report.avgCost, "AI ≈ $0.40 · human ≈ $4 · disaster +$50"],
            ["🤖 AI share", report.autoShare + "%", "portion of tickets the AI resolved alone"],
            ["🎛 Your dial", report.autonomy, "max risk you let the AI handle solo"],
          ];
          return (
          <div className="text-center py-6">
            <div className="inline-block bg-white border-2 rounded-3xl px-6 sm:px-10 py-8 shadow-lg text-left max-w-md" style={{ borderColor: C.ink }}>
              <p className="text-sm font-bold uppercase tracking-wider text-center" style={{ color: C.soft }}>Shift report</p>
              <p className="text-7xl font-extrabold my-2 text-center" style={{ ...ROUND, color: report.grade === "A" ? C.low : report.grade === "F" ? C.high : C.ink }}>{report.grade}</p>
              <div className="space-y-2 mt-3">
                {ROWS.map(([label, val, sub]) => (
                  <div key={label} className="flex items-start justify-between gap-4 border-b border-stone-100 pb-1.5">
                    <div>
                      <p className="text-sm font-bold" style={ROUND}>{label}</p>
                      <p className="text-xs" style={{ color: C.soft }}>{sub}</p>
                    </div>
                    <b className="text-base" style={MONO}>{val}</b>
                  </div>
                ))}
              </div>
              <p className="text-sm mt-4 rounded-xl p-3 font-medium" style={{ background: "#F4F4EF" }}>{verdict}</p>
            </div>
            <p className="max-w-md mx-auto text-sm mt-5" style={{ color: C.soft }}>
              That dial is the whole job: it's an organization's risk appetite, written as a number.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-5">
              <button onClick={replay} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold focus:outline-none focus:ring-4 focus:ring-blue-300" style={{ background: C.ink, ...ROUND }}>
                <RotateCcw className="w-4 h-4" /> Run it again
              </button>
              <button onClick={() => { navigator.clipboard?.writeText(shareLine); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 font-bold focus:outline-none focus:ring-4 focus:ring-blue-300" style={{ borderColor: C.ink, ...ROUND }}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Copied!" : "Copy my score"}
              </button>
            </div>
          </div>
          );
        })()}

        <div className="mt-10 bg-white border border-stone-200 rounded-2xl p-5">
          <h2 className="font-extrabold text-lg flex items-center gap-2" style={ROUND}>
            <Sparkles className="w-5 h-5" style={{ color: C.blue }} /> Now try it with a real AI
          </h2>
          <p className="text-sm mt-1 mb-3" style={{ color: C.soft }}>
            Type any support ticket. Claude scores its risk and drafts a resolution — then your dial decides where it lands.
          </p>
          <textarea value={ticketText} onChange={e => setTicketText(e.target.value)}
            placeholder='e.g. "I was charged twice for my hotel and I want my money back or I am calling my bank"'
            rows={3} className="w-full border border-stone-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <button onClick={triageReal} disabled={aiBusy || !ticketText.trim()}
            className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold disabled:opacity-40 focus:outline-none focus:ring-4 focus:ring-blue-300" style={{ background: C.blue, ...ROUND }}>
            {aiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {aiBusy ? "Triaging…" : "Triage my ticket"}
          </button>
          {aiError && <p className="text-sm text-rose-600 mt-2">{aiError}</p>}
          {aiResult && (() => {
            const lane = aiResult.risk_score >= 85 ? "esc" : aiResult.risk_score <= autonomy ? "auto" : "human";
            const laneMeaning = {
              auto: "✅ Sent to the customer instantly — no human touched it.",
              human: "✋ Held as a draft — one of your team approves or edits it before it's sent.",
              esc: "🚨 Routed straight to senior staff — too high-stakes for the normal flow.",
            };
            return (
            <div className="mt-4 rounded-xl border-2 p-4 transition-colors" style={{ borderColor: laneLabel[lane][1] }}>
              <div className="flex flex-wrap items-center gap-2 text-sm" style={MONO}>
                <span className="font-bold">{aiResult.intent}</span>
                <span>· risk {aiResult.risk_score}</span>
                <span>· conf {Math.round(aiResult.confidence * 100)}%</span>
              </div>
              <p className="text-lg font-extrabold mt-2" style={{ ...ROUND, color: laneLabel[lane][1] }}>
                → {laneLabel[lane][0]}
              </p>
              <p className="text-sm font-medium">{laneMeaning[lane]}</p>
              <p className="text-xs italic mt-1" style={{ color: C.soft }}>{aiResult.reasoning}</p>
              <div className="mt-2 bg-stone-50 rounded-lg p-3 text-sm">
                <p className="text-xs font-bold mb-1" style={{ color: C.soft }}>{lane === "auto" ? "REPLY SENT BY AI" : "AI DRAFT — AWAITING HUMAN"}</p>
                {aiResult.draft_reply}
              </div>
              {/* live mini dial: re-routes this ticket as you slide */}
              <div className="mt-4">
                <div className="flex justify-between text-sm font-bold mb-1" style={ROUND}>
                  <span>🎛 Your dial — slide me</span>
                  <span style={MONO}>AI takes risk 0–{autonomy}</span>
                </div>
                <div className="relative h-6 rounded-lg overflow-hidden border border-stone-300"
                  style={{ background: "linear-gradient(to right, #2BB673 0%, #A8C94B 35%, #F0A219 60%, #E5484D 100%)" }}>
                  <div className="absolute inset-y-0 left-0" style={{ width: autonomy + "%", background: "rgba(31,35,41,0.28)", transition: "width 80ms linear" }} />
                  {/* this ticket's risk, pinned on the spectrum */}
                  <div className="absolute -translate-x-1/2 inset-y-0 flex items-center" style={{ left: Math.min(98, Math.max(2, aiResult.risk_score)) + "%" }}>
                    <span className="bg-white rounded-full border-2 px-1 text-xs font-bold shadow" style={{ borderColor: laneLabel[lane][1] }}>🎫</span>
                  </div>
                  <div className="absolute inset-y-0 w-1 bg-white shadow" style={{ left: `calc(${autonomy}% - 2px)`, transition: "left 80ms linear" }} />
                </div>
                <input type="range" min="0" max="100" value={autonomy} onChange={e => setAutonomy(+e.target.value)}
                  className="w-full h-3 accent-emerald-600 cursor-pointer" aria-label="AI autonomy — re-routes this ticket live" />
                <p className="text-xs" style={{ color: C.soft }}>
                  Your ticket (🎫 at risk {aiResult.risk_score}) sits on the spectrum. Slide the boundary past it and watch the routing flip — that's the human in the loop, as one number.
                </p>
              </div>
            </div>
            );
          })()}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: C.soft }}>
          A 60-second game about where humans belong in AI operations · Built by Sukrit Chakravarty
        </p>
      </div>
    </div>
  );
}
