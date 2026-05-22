import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";

// ============================================================
//  PumpScore — Live Crowd Sentiment Index
//  Drop-in React component for PumpX
// ============================================================

// ─────────────────────────────────────────────────────────────
//  SECTION 1: CORE CALCULATION LOGIC
// ─────────────────────────────────────────────────────────────

function calculatePumpScore(markets) {
  if (!markets || markets.length === 0) return 50;

  const active = markets.filter(m => m.status === "active");
  if (active.length === 0) return 50;

  const totalVolume = active.reduce((sum, m) => sum + m.volume, 0);
  if (totalVolume === 0) return 50;

  const weightedSum = active.reduce((sum, m) => {
    const weight = m.volume / totalVolume;
    return sum + (m.yesPercent * weight);
  }, 0);

  return Math.round(Math.max(0, Math.min(100, weightedSum)));
}

function getSentimentZone(score) {
  if (score >= 80) return { label: "Extreme Greed", emoji: "🤑", color: "#00ff88", bg: "rgba(0,255,136,0.12)", border: "rgba(0,255,136,0.3)" };
  if (score >= 60) return { label: "Greed",         emoji: "😏", color: "#7dde8e", bg: "rgba(125,222,142,0.10)", border: "rgba(125,222,142,0.25)" };
  if (score >= 40) return { label: "Neutral",        emoji: "😐", color: "#f0d060", bg: "rgba(240,208,96,0.10)",  border: "rgba(240,208,96,0.25)"  };
  if (score >= 20) return { label: "Fear",           emoji: "😟", color: "#f09040", bg: "rgba(240,144,64,0.10)", border: "rgba(240,144,64,0.25)"  };
  return               { label: "Extreme Fear",  emoji: "😱", color: "#ff5555", bg: "rgba(255,85,85,0.12)",  border: "rgba(255,85,85,0.3)"    };
}

// ─────────────────────────────────────────────────────────────
//  SECTION 2: SIMULATED DATA SOURCE
// ─────────────────────────────────────────────────────────────

const SEED_MARKETS = [
  { id: 1,  q: "Will Nifty 50 close above 22,800 today?",        cat: "Index",  yesPercent: 68, volume: 420000, status: "active", trend: +4 },
  { id: 2,  q: "Will Bitcoin cross $72,000 before April?",        cat: "Crypto", yesPercent: 61, volume: 1280000, status: "active", trend: +8 },
  { id: 3,  q: "Will RBI cut rates in April meeting?",            cat: "Policy", yesPercent: 38, volume: 610000, status: "active", trend: -3 },
  { id: 4,  q: "Will Reliance Q4 revenue beat ₹2.3L Cr?",       cat: "Stocks", yesPercent: 74, volume: 380000, status: "active", trend: +12 },
  { id: 5,  q: "Will Infosys FY26 guidance exceed 8%?",           cat: "Stocks", yesPercent: 45, volume: 210000, status: "active", trend: -1 },
  { id: 6,  q: "Will USD/INR cross 84.5 this week?",              cat: "Forex",  yesPercent: 29, volume: 140000, status: "active", trend: -7 },
  { id: 7,  q: "Will India win next Test vs England?",            cat: "Sports", yesPercent: 82, volume: 930000, status: "active", trend: +15 },
  { id: 8,  q: "Will Sensex cross 75,000 before Budget 2026?",   cat: "Index",  yesPercent: 55, volume: 570000, status: "active", trend: +2  },
];

function useMarketFeed() {
  const [markets, setMarkets] = useState(SEED_MARKETS);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [betFeed, setBetFeed] = useState([]);
  const betterNames = ["Rohit_T", "DeepakBull", "NiftyNinja", "CryptoK", "PolicyPro", "ArjunM", "PriyaN", "TechTrader"];

  useEffect(() => {
    const interval = setInterval(() => {
      setMarkets(prev => {
        const idx = Math.floor(Math.random() * prev.length);
        const market = prev[idx];

        const betSide = Math.random() > 0.45 ? "YES" : "NO";
        const betAmount = Math.floor(Math.random() * 5000) + 500;
        const shift = betSide === "YES" ? 0.3 : -0.3;
        const newYes = Math.max(5, Math.min(95, market.yesPercent + shift));
        const newVol = market.volume + betAmount;

        const bettor = betterNames[Math.floor(Math.random() * betterNames.length)];
        setBetFeed(feed => [{
          id: Date.now(),
          bettor,
          market: market.q.slice(0, 40) + "...",
          side: betSide,
          amount: betAmount,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        }, ...feed].slice(0, 12));

        setLastUpdate(Date.now());

        return prev.map((m, i) => i === idx
          ? { ...m, yesPercent: Math.round(newYes * 10) / 10, volume: newVol }
          : m
        );
      });
    }, 1800 + Math.random() * 2200);

    return () => clearInterval(interval);
  }, []);

  return { markets, lastUpdate, betFeed };
}

// ─────────────────────────────────────────────────────────────
//  SECTION 3: THE DIAL (SVG arc math)
// ─────────────────────────────────────────────────────────────

function Dial({ score, size = 280, prevScore }) {
  const [displayScore, setDisplayScore] = useState(prevScore ?? score);
  const animRef = useRef(null);

  useEffect(() => {
    const start = displayScore;
    const end = score;
    const duration = 800;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(start + (end - start) * eased);
      if (progress < 1) animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [score]);

  const s = displayScore;
  const zone = getSentimentZone(Math.round(s));

  const cx = size / 2;
  const cy = size * 0.58;
  const R = size * 0.37;
  const toXY = (deg) => ({
    x: cx + R * Math.cos((deg - 180) * Math.PI / 180),
    y: cy + R * Math.sin((deg - 180) * Math.PI / 180),
  });

  const angle = (s / 100) * 180;
  const arcStart = toXY(0);
  const arcEnd = toXY(angle);
  const bgEnd = toXY(180);
  const largeArc = angle > 180 ? 1 : 0;

  const ticks = [0, 20, 40, 60, 80, 100].map(v => {
    const a = (v / 100) * 180;
    const inner = toXY(a);
    const oR = R + size * 0.06;
    const outer = {
      x: cx + oR * Math.cos((a - 180) * Math.PI / 180),
      y: cy + oR * Math.sin((a - 180) * Math.PI / 180),
    };
    return { inner, outer, v };
  });

  return (
    <svg width={size} height={size * 0.66} viewBox={`0 0 ${size} ${size * 0.66}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#ff5555" />
          <stop offset="35%"  stopColor="#f09040" />
          <stop offset="60%"  stopColor="#f0d060" />
          <stop offset="100%" stopColor="#00ff88" />
        </linearGradient>
        <filter id="dialGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="needleGlow">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
        </filter>
        <clipPath id="semiClip">
          <rect x={cx - R - 20} y={cy - R - 20} width={(R + 20) * 2} height={R + 40} />
        </clipPath>
      </defs>

      <path
        d={`M ${arcStart.x} ${arcStart.y} A ${R} ${R} 0 0 1 ${bgEnd.x} ${bgEnd.y}`}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={size * 0.07}
        strokeLinecap="round"
      />

      {s > 0 && (
        <path
          d={`M ${arcStart.x} ${arcStart.y} A ${R} ${R} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`}
          fill="none"
          stroke={zone.color}
          strokeWidth={size * 0.07}
          strokeLinecap="round"
          filter="url(#dialGlow)"
          style={{ transition: "stroke 0.5s ease" }}
        />
      )}

      {ticks.map(({ inner, outer, v }) => (
        <line
          key={v}
          x1={inner.x} y1={inner.y}
          x2={outer.x} y2={outer.y}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      ))}

      <circle cx={arcEnd.x} cy={arcEnd.y} r={size * 0.06}
        fill={zone.color} opacity={0.3} filter="url(#needleGlow)" />
      <circle cx={arcEnd.x} cy={arcEnd.y} r={size * 0.04}
        fill={zone.color}
        style={{ filter: `drop-shadow(0 0 ${size * 0.04}px ${zone.color})`, transition: "all 0.05s" }}
      />

      <text x={cx} y={cy - R * 0.05}
        textAnchor="middle"
        fill={zone.color}
        fontSize={size * 0.26}
        fontWeight="900"
        fontFamily="'JetBrains Mono', monospace"
        style={{ filter: `drop-shadow(0 0 14px ${zone.color}80)` }}
      >
        {Math.round(s)}
      </text>

      <text x={cx} y={cy + R * 0.32}
        textAnchor="middle"
        fill={zone.color}
        fontSize={size * 0.08}
        fontWeight="700"
        fontFamily="'Plus Jakarta Sans', sans-serif"
        opacity="0.9"
      >
        {zone.emoji} {zone.label}
      </text>

      <text x={arcStart.x - 6} y={cy + 8} textAnchor="end"
        fill="rgba(255,85,85,0.6)" fontSize={size * 0.065} fontWeight="700"
        fontFamily="'Plus Jakarta Sans', sans-serif">FEAR</text>
      <text x={bgEnd.x + 6} y={cy + 8} textAnchor="start"
        fill="rgba(0,255,136,0.6)" fontSize={size * 0.065} fontWeight="700"
        fontFamily="'Plus Jakarta Sans', sans-serif">GREED</text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
//  SECTION 4: SCORE HISTORY SPARKLINE
// ─────────────────────────────────────────────────────────────

function ScoreSparkline({ history, color, width = 300, height = 60 }) {
  if (history.length < 2) return null;

  const min = Math.min(...history) - 2;
  const max = Math.max(...history) + 2;
  const range = max - min || 1;

  const pts = history.map((v, i) => {
    const x = (i / (history.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  const lastX = width;
  const lastY = height - ((history[history.length - 1] - min) / range) * height;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${pts} ${width},${height}`}
        fill="url(#sparkGrad)"
      />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}80)` }}
      />
      <circle cx={lastX} cy={lastY} r={4} fill={color}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
//  SECTION 5: MINI WIDGET
// ─────────────────────────────────────────────────────────────

export function PumpScoreMini({ score }) {
  const zone = getSentimentZone(score);
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      padding: "8px 16px", borderRadius: 14,
      background: zone.bg,
      border: `1px solid ${zone.border}`,
    }}>
      <div style={{ position: "relative", width: 8, height: 8 }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: zone.color, opacity: 0.4,
          animation: "miniRipple 2s ease-out infinite",
        }} />
        <div style={{ position: "absolute", inset: "2px", borderRadius: "50%", background: zone.color }} />
      </div>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 18, fontWeight: 700, color: zone.color,
        textShadow: `0 0 12px ${zone.color}60`,
      }}>{score}</span>
      <span style={{ fontSize: 12, color: zone.color, fontWeight: 700 }}>
        {zone.emoji} {zone.label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  SECTION 6: MARKET BREAKDOWN ROW
// ─────────────────────────────────────────────────────────────

const CAT_COLORS = {
  Index:  { color: "#00ff88", bg: "rgba(0,255,136,0.08)"  },
  Crypto: { color: "#fbbf24", bg: "rgba(251,191,36,0.08)" },
  Policy: { color: "#f472b6", bg: "rgba(244,114,182,0.08)" },
  Stocks: { color: "#818cf8", bg: "rgba(129,140,248,0.08)" },
  Forex:  { color: "#f0d060", bg: "rgba(240,208,96,0.08)" },
  Sports: { color: "#34d399", bg: "rgba(52,211,153,0.08)" },
};

function MarketBreakdownRow({ market, prevYes }) {
  const cat = CAT_COLORS[market.cat] || CAT_COLORS.Index;
  const zone = getSentimentZone(market.yesPercent);
  const changed = prevYes !== undefined && prevYes !== market.yesPercent;
  const up = market.yesPercent > (prevYes ?? market.yesPercent);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px", borderRadius: 12,
      background: changed ? `${zone.color}08` : "rgba(255,255,255,0.02)",
      border: `1px solid ${changed ? zone.color + "25" : "rgba(255,255,255,0.04)"}`,
      transition: "all 0.4s ease",
      marginBottom: 6,
    }}>
      <div style={{
        padding: "2px 8px", borderRadius: 20, fontSize: 9, fontWeight: 800,
        letterSpacing: 1, color: cat.color, background: cat.bg,
        border: `1px solid ${cat.color}30`, flexShrink: 0,
      }}>{market.cat}</div>

      <div style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>
        {market.q}
      </div>

      {changed && (
        <div style={{ fontSize: 10, fontWeight: 800, color: up ? "#00ff88" : "#ff5555", flexShrink: 0 }}>
          {up ? "▲" : "▼"} {Math.abs(market.yesPercent - (prevYes ?? 0)).toFixed(1)}
        </div>
      )}

      <div style={{
        fontSize: 18, fontWeight: 900, color: zone.color,
        fontFamily: "'JetBrains Mono', monospace",
        flexShrink: 0, minWidth: 52, textAlign: "right",
        textShadow: `0 0 10px ${zone.color}50`,
        transition: "color 0.5s",
      }}>{market.yesPercent}%</div>

      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", flexShrink: 0, minWidth: 50, textAlign: "right" }}>
        ₹{(market.volume / 100000).toFixed(1)}L
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  SECTION 7: LIVE BET FEED
// ─────────────────────────────────────────────────────────────

function BetFeedItem({ bet, index }) {
  const isYes = bet.side === "YES";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 12px", borderRadius: 10,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.04)",
      marginBottom: 4,
      animation: "feedSlide 0.4s ease forwards",
      opacity: 1 - index * 0.07,
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
        background: isYes ? "#00ff88" : "#ff5555",
        boxShadow: `0 0 6px ${isYes ? "#00ff88" : "#ff5555"}`,
      }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", flexShrink: 0 }}>
        {bet.bettor}
      </span>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        bet {bet.side} on {bet.market}
      </span>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", flexShrink: 0, fontFamily: "'JetBrains Mono',monospace" }}>
        {bet.time}
      </span>
      <span style={{ fontSize: 11, fontWeight: 700, color: isYes ? "#00ff88" : "#ff5555", flexShrink: 0, fontFamily: "'JetBrains Mono',monospace" }}>
        +₹{(bet.amount / 1000).toFixed(1)}K
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  SECTION 8: MAIN PUMPSCORE COMPONENT
// ─────────────────────────────────────────────────────────────

function PumpScoreIndex() {
  const { markets, lastUpdate, betFeed } = useMarketFeed();

  const score = calculatePumpScore(markets);
  const zone = getSentimentZone(score);

  const prevMarketsRef = useRef({});
  const prevScoreRef = useRef(score);

  useEffect(() => {
    markets.forEach(m => { prevMarketsRef.current[m.id] = m.yesPercent; });
    prevScoreRef.current = score;
  }, [markets]);

  const [scoreHistory, setScoreHistory] = useState([score]);
  useEffect(() => {
    setScoreHistory(h => [...h, score].slice(-30));
  }, [score]);

  const [bettorCount, setBettorCount] = useState(1847);
  useEffect(() => {
    const t = setInterval(() => {
      setBettorCount(c => c + Math.floor(Math.random() * 3));
    }, 2600);
    return () => clearInterval(t);
  }, []);

  const [pulseKey, setPulseKey] = useState(0);
  useEffect(() => { setPulseKey(k => k + 1); }, [lastUpdate]);

  const [secondsAgo, setSecondsAgo] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setSecondsAgo(Math.round((Date.now() - lastUpdate) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [lastUpdate]);

  const [activeTab, setActiveTab] = useState("breakdown");

  return (
    <div style={{
      minHeight: "100vh",
      background: "#04060d",
      fontFamily: "'Plus Jakarta Sans', 'DM Sans', sans-serif",
      color: "#e8f0fe",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
      position: "relative",
      overflow: "hidden",
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        @keyframes feedSlide { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes miniRipple { 0%{transform:scale(0.8);opacity:0.8} 100%{transform:scale(2.5);opacity:0} }
        @keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.85)} 50%{opacity:1;transform:scale(1.15)} }
        @keyframes scorePop { 0%{transform:scale(1)} 50%{transform:scale(1.04)} 100%{transform:scale(1)} }
        @keyframes auroraFloat { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,15px) scale(1.06)} }
        .ps-tab-btn {
          padding: 7px 18px; border-radius: 20px; font-size: 12px; font-weight: 700;
          border: none; cursor: pointer; transition: all 0.2s;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .ps-tab-btn.active { background: rgba(0,255,136,0.15); color: #00ff88; border: 1px solid rgba(0,255,136,0.3); }
        .ps-tab-btn.inactive { background: transparent; color: rgba(255,255,255,0.35); border: 1px solid rgba(255,255,255,0.07); }
        .ps-tab-btn:hover { opacity: 0.85; }
        .ps-glass {
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          position: relative;
          overflow: hidden;
        }
        .ps-glass::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent);
        }
      ` }} />

      {/* Aurora BG */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,255,136,0.07), transparent 70%)", top: -150, right: -100, filter: "blur(80px)", animation: "auroraFloat 18s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,111,239,0.08), transparent 70%)", bottom: -150, left: -100, filter: "blur(80px)", animation: "auroraFloat 22s ease-in-out infinite reverse" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* Main layout */}
      <div style={{ maxWidth: 1100, width: "100%", display: "grid", gridTemplateColumns: "380px 1fr", gap: 20, position: "relative", zIndex: 10 }}>

        {/* ── LEFT: DIAL CARD ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Main Dial Card */}
          <div className="ps-glass" style={{ padding: "32px 28px", textAlign: "center" }} key={pulseKey}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ position: "relative", width: 8, height: 8 }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: zone.color, opacity: 0.4, animation: "miniRipple 2s ease-out infinite" }} />
                <div style={{ position: "absolute", inset: "2px", borderRadius: "50%", background: zone.color }} />
              </div>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 3, fontWeight: 700 }}>
                PUMPX CROWD SENTIMENT INDEX
              </span>
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginBottom: 20 }}>
              Updated {secondsAgo}s ago · {bettorCount.toLocaleString()} bettors active
            </div>

            <div style={{ position: "relative", display: "inline-block" }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(circle at 50% 65%, ${zone.color}15, transparent 70%)`, filter: "blur(20px)", pointerEvents: "none" }} />
              <Dial score={score} size={300} prevScore={prevScoreRef.current} />
            </div>

            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 20px", borderRadius: 14, marginTop: 16,
              background: zone.bg, border: `1px solid ${zone.border}`,
              transition: "all 0.5s",
            }}>
              <span style={{ fontSize: 18 }}>{zone.emoji}</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: zone.color }}>{zone.label}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Crowd Sentiment Zone</div>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>
                <span>😱 Extreme Fear</span>
                <span>🤑 Extreme Greed</span>
              </div>
              <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${score}%`,
                  background: `linear-gradient(90deg, #ff5555, #f09040, #f0d060, ${zone.color})`,
                  borderRadius: 3,
                  boxShadow: `0 0 10px ${zone.color}60`,
                  transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
                }} />
              </div>
              <div style={{ textAlign: "center", marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                Score: <span style={{ color: zone.color, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{score}</span> / 100
              </div>
            </div>
          </div>

          {/* Sparkline History Card */}
          <div className="ps-glass" style={{ padding: "20px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>📈 Score History</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Last {scoreHistory.length} updates</div>
            </div>
            <ScoreSparkline history={scoreHistory} color={zone.color} width={320} height={55} />
          </div>

          {/* Zone Explanation Card */}
          <div className="ps-glass" style={{ padding: "18px 22px" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>
              SCORE SCALE
            </div>
            {[
              { range: "80–100", label: "Extreme Greed", emoji: "🤑", color: "#00ff88" },
              { range: "60–79",  label: "Greed",         emoji: "😏", color: "#7dde8e" },
              { range: "40–59",  label: "Neutral",        emoji: "😐", color: "#f0d060" },
              { range: "20–39",  label: "Fear",           emoji: "😟", color: "#f09040" },
              { range: "0–19",   label: "Extreme Fear",   emoji: "😱", color: "#ff5555" },
            ].map(z => (
              <div key={z.range} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "7px 0",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                opacity: z.color === zone.color ? 1 : 0.4,
                transition: "opacity 0.5s",
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: z.color, flexShrink: 0, boxShadow: z.color === zone.color ? `0 0 8px ${z.color}` : "none" }} />
                <span style={{ fontSize: 12, color: z.color, fontWeight: 700, minWidth: 60, fontFamily: "'JetBrains Mono',monospace" }}>{z.range}</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{z.emoji} {z.label}</span>
                {z.color === zone.color && (
                  <span style={{ marginLeft: "auto", fontSize: 9, color: z.color, fontWeight: 800 }}>← NOW</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: BREAKDOWN + FEED ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Score Formula Explainer */}
          <div className="ps-glass" style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 2, fontWeight: 700, marginBottom: 8 }}>HOW PUMPX SCORE IS CALCULATED</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.7 }}>
                  Volume-weighted average of YES% across all {markets.length} active markets. Bigger markets have more influence. Updated every time a bet is placed. <span style={{ color: "#00ff88", fontWeight: 700 }}>Cannot be faked. Cannot be bought.</span>
                </div>
              </div>
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>FORMULA</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#f0d060", lineHeight: 1.8, background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)" }}>
                  Σ (YES% × Volume)<br />÷ Total Volume
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={`ps-tab-btn ${activeTab === "breakdown" ? "active" : "inactive"}`}
              onClick={() => setActiveTab("breakdown")}
            >📊 Market Breakdown</button>
            <button
              className={`ps-tab-btn ${activeTab === "feed" ? "active" : "inactive"}`}
              onClick={() => setActiveTab("feed")}
            >⚡ Live Bet Feed</button>
          </div>

          {/* Breakdown */}
          {activeTab === "breakdown" && (
            <div className="ps-glass" style={{ padding: "20px", flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
                  Active Markets Contributing to Score
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                  {markets.filter(m => m.status === "active").length} markets live
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, padding: "0 14px", marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: 1.5, flex: 1 }}>MARKET</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: 1.5, width: 40, textAlign: "right" }}>YES%</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: 1.5, width: 50, textAlign: "right" }}>VOLUME</div>
              </div>

              {[...markets]
                .sort((a, b) => b.volume - a.volume)
                .map(m => (
                  <MarketBreakdownRow
                    key={m.id}
                    market={m}
                    prevYes={prevMarketsRef.current[m.id]}
                  />
                ))
              }

              <div style={{ marginTop: 16, padding: "14px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 10, letterSpacing: 1.5 }}>MARKET INFLUENCE (by volume)</div>
                <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", gap: 1 }}>
                  {[...markets]
                    .sort((a, b) => b.volume - a.volume)
                    .map(m => {
                      const totalVol = markets.reduce((s, x) => s + x.volume, 0);
                      const pct = (m.volume / totalVol) * 100;
                      const cat = CAT_COLORS[m.cat] || CAT_COLORS.Index;
                      return (
                        <div key={m.id} title={`${m.cat}: ${pct.toFixed(1)}%`} style={{
                          width: `${pct}%`, background: cat.color,
                          opacity: 0.7, transition: "width 0.5s",
                        }} />
                      );
                    })}
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
                  {Object.entries(CAT_COLORS).map(([cat, { color }]) => (
                    markets.find(m => m.cat === cat) && (
                      <div key={cat} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{cat}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Bet Feed */}
          {activeTab === "feed" && (
            <div className="ps-glass" style={{ padding: "20px", flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>Live Bet Stream</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", animation: "pulse 1.5s infinite" }} />
                  <span style={{ fontSize: 10, color: "#00ff88", fontWeight: 700 }}>LIVE</span>
                </div>
              </div>
              {betFeed.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
                  Waiting for bets...
                </div>
              ) : (
                betFeed.map((bet, i) => <BetFeedItem key={bet.id} bet={bet} index={i} />)
              )}
            </div>
          )}

          {/* Stats row at bottom */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              { label: "Total Volume",   value: `₹${(markets.reduce((s,m)=>s+m.volume,0)/100000).toFixed(1)}L`, color: "#f0d060" },
              { label: "Active Markets", value: markets.length,                                                   color: "#818cf8" },
              { label: "Bettors Live",   value: bettorCount.toLocaleString(),                                    color: "#00ff88" },
            ].map(s => (
              <div key={s.label} className="ps-glass" style={{ padding: "16px", textAlign: "center" }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 700, color: s.color, textShadow: `0 0 14px ${s.color}50` }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default dynamic(() => Promise.resolve(PumpScoreIndex), { ssr: false });
