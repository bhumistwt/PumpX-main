import { useState, useRef, useEffect } from "react";

// ============================================================
// ARIA — AI Research & Intelligence Assistant for PumpX
// Full integration with Anthropic Claude API
// ============================================================

const ARIA_SYSTEM_PROMPT = `You are ARIA (AI Research & Intelligence Assistant), the intelligent core of PumpX — a decentralized AI-powered prediction market platform.

Your personality: Sharp, confident, data-driven. You speak like a senior quant analyst who also understands crowd psychology. You're direct, never verbose, always actionable.

Your capabilities:
1. MARKET ANALYSIS — Analyze any stock, crypto, or event and give crowd sentiment insights
2. BET INTELLIGENCE — Tell users whether to bet YES or NO with reasoning (always add "not financial advice")
3. MARKET GENERATION — Auto-generate prediction market questions from trending topics
4. RISK PROFILING — Assess risk level of any prediction
5. SENTIMENT EXPLANATION — Explain why the crowd is leaning a certain way
6. PUMPX FEATURES — Explain how PumpX works, Prophet Scores, Battles, PumpScore dial

Response format rules:
- Always be under 120 words unless asked for detail
- Use emojis sparingly but effectively (max 2-3 per response)
- Structure with bullet points when listing multiple items
- For bet recommendations, always show: Crowd Lean | Confidence | Key Signal | Risk Level
- Never say "I cannot" — instead redirect to what you CAN do
- Sign off important analyses with "— ARIA 🤖"

PumpX Context:
- PumpScore: Live 0-100 sentiment index (0=extreme fear, 100=extreme greed). Current: 67 (Greedy)
- PUMP Token: Platform currency for betting
- Prophet Score: User accuracy reputation (max 1000)
- Prediction Battles: 1v1 direct duels between users
- YES/NO tokens represent crowd positions on any market
- Markets auto-settle via oracle verification

Example market types you generate:
- "Will [Stock] close above [price] by [date]?"
- "Will [Company] announce [event] this quarter?"
- "Will [Crypto] cross [threshold] within 7 days?"
- "Will [Person] [action] before [deadline]?"`;

const SAMPLE_MARKETS = [
  { id: 1, question: "Will Nifty 50 close above 22,500 today?", yesOdds: 67, volume: "₹2.4L", category: "Index", closing: "4h" },
  { id: 2, question: "Will Bitcoin cross $70,000 before March end?", yesOdds: 58, volume: "₹8.1L", category: "Crypto", closing: "18d" },
  { id: 3, question: "Will RBI cut interest rates this quarter?", yesOdds: 34, volume: "₹5.6L", category: "Policy", closing: "22d" },
  { id: 4, question: "Will Reliance Industries beat Q4 earnings estimates?", yesOdds: 71, volume: "₹3.2L", category: "Stocks", closing: "12d" },
  { id: 5, question: "Will Infosys announce layoffs in Q1 2025?", yesOdds: 29, volume: "₹1.8L", category: "Stocks", closing: "8d" },
];

const QUICK_PROMPTS = [
  { label: "📊 Analyze Nifty today", text: "Analyze Nifty 50 sentiment and should I bet YES or NO?" },
  { label: "🪙 Bitcoin outlook", text: "What's the crowd sentiment on Bitcoin crossing $70K?" },
  { label: "⚔️ Explain Battles", text: "How do Prediction Battles work on PumpX?" },
  { label: "🎯 Generate markets", text: "Generate 5 fresh prediction markets for today based on trending financial news" },
  { label: "📈 My Prophet Score", text: "How can I improve my Prophet Score on PumpX?" },
  { label: "🌡️ PumpScore explained", text: "What does the current PumpScore of 67 mean for the market?" },
];

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "14px 18px" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "#00ff88",
          animation: "pulse 1.2s ease-in-out infinite",
          animationDelay: `${i * 0.2}s`
        }} />
      ))}
      <span style={{ color: "#888", fontSize: 13, marginLeft: 4 }}>ARIA is thinking...</span>
    </div>
  );
}

function MarketCard({ market }) {
  const isYesBullish = market.yesOdds > 50;
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${isYesBullish ? "rgba(0,255,136,0.2)" : "rgba(255,80,80,0.2)"}`,
      borderRadius: 12,
      padding: "14px 16px",
      marginBottom: 10,
      cursor: "pointer",
      transition: "all 0.2s",
    }}
    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
    onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1,
            color: isYesBullish ? "#00ff88" : "#ff5050",
            background: isYesBullish ? "rgba(0,255,136,0.1)" : "rgba(255,80,80,0.1)",
            padding: "2px 8px", borderRadius: 20, marginBottom: 8, display: "inline-block"
          }}>{market.category}</span>
          <div style={{ color: "#e8e8e8", fontSize: 13, lineHeight: 1.5, marginTop: 6 }}>{market.question}</div>
        </div>
        <div style={{ textAlign: "right", minWidth: 70 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: isYesBullish ? "#00ff88" : "#ff5050", fontFamily: "monospace" }}>
            {market.yesOdds}%
          </div>
          <div style={{ fontSize: 10, color: "#666" }}>YES odds</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{
            background: "rgba(0,255,136,0.15)", border: "1px solid rgba(0,255,136,0.3)",
            color: "#00ff88", padding: "5px 14px", borderRadius: 20, fontSize: 12,
            cursor: "pointer", fontWeight: 600
          }}>YES</button>
          <button style={{
            background: "rgba(255,80,80,0.15)", border: "1px solid rgba(255,80,80,0.3)",
            color: "#ff5050", padding: "5px 14px", borderRadius: 20, fontSize: 12,
            cursor: "pointer", fontWeight: 600
          }}>NO</button>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#666" }}>💰 {market.volume}</span>
          <span style={{ fontSize: 11, color: "#666" }}>⏱ {market.closing}</span>
        </div>
      </div>
    </div>
  );
}

function PumpScoreDial({ score = 67 }) {
  const angle = (score / 100) * 180 - 90;
  const color = score < 30 ? "#ff4444" : score < 50 ? "#ff8800" : score < 70 ? "#ffcc00" : "#00ff88";
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16, padding: "20px 24px", marginBottom: 16, textAlign: "center"
    }}>
      <div style={{ fontSize: 11, color: "#666", letterSpacing: 2, marginBottom: 12 }}>PUMPX SENTIMENT INDEX</div>
      <svg viewBox="0 0 200 110" style={{ width: "100%", maxWidth: 200 }}>
        <defs>
          <linearGradient id="dialGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff4444" />
            <stop offset="50%" stopColor="#ffcc00" />
            <stop offset="100%" stopColor="#00ff88" />
          </linearGradient>
        </defs>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" strokeLinecap="round" />
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#dialGrad)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(score / 100) * 251} 251`} />
        <line
          x1="100" y1="100"
          x2={100 + 60 * Math.cos((angle - 90) * Math.PI / 180)}
          y2={100 + 60 * Math.sin((angle - 90) * Math.PI / 180)}
          stroke={color} strokeWidth="3" strokeLinecap="round"
        />
        <circle cx="100" cy="100" r="6" fill={color} />
        <text x="100" y="90" textAnchor="middle" fill={color} fontSize="22" fontWeight="800" fontFamily="monospace">{score}</text>
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10, color: "#ff4444" }}>😨 FEAR</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>
          {score < 30 ? "Extreme Fear" : score < 50 ? "Fear" : score < 70 ? "Greed" : "Extreme Greed"}
        </span>
        <span style={{ fontSize: 10, color: "#00ff88" }}>GREED 😤</span>
      </div>
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      flexDirection: isUser ? "row-reverse" : "row",
      gap: 12, marginBottom: 20, alignItems: "flex-start"
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
        background: isUser
          ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
          : "linear-gradient(135deg, #00ff88, #00cc6a)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 800, color: isUser ? "#fff" : "#000"
      }}>
        {isUser ? "U" : "A"}
      </div>
      <div style={{
        maxWidth: "75%",
        background: isUser
          ? "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))"
          : "rgba(255,255,255,0.04)",
        border: isUser
          ? "1px solid rgba(99,102,241,0.3)"
          : "1px solid rgba(255,255,255,0.08)",
        borderRadius: isUser ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
        padding: "12px 16px",
      }}>
        <div style={{
          color: "#e8e8e8", fontSize: 14, lineHeight: 1.7,
          whiteSpace: "pre-wrap", fontFamily: isUser ? "inherit" : "inherit"
        }}>
          {msg.content}
        </div>
        <div style={{ fontSize: 10, color: "#555", marginTop: 6, textAlign: isUser ? "right" : "left" }}>
          {msg.time}
        </div>
      </div>
    </div>
  );
}

export default function ARIAPumpX() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hey! I'm ARIA 🤖 — your AI Research & Intelligence Assistant on PumpX.\n\nI can help you:\n• Analyze markets & sentiment\n• Recommend YES/NO positions\n• Generate fresh prediction markets\n• Explain your Prophet Score & strategy\n\nWhat's on your mind?",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("aria");
  const [pumpScore] = useState(67);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;

    const userMsg = {
      role: "user",
      content: userText,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      history.push({ role: "user", content: userText });

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: ARIA_SYSTEM_PROMPT,
          messages: history
        })
      });

      const data = await response.json();
      const replyText = data.content?.map(b => b.text || "").join("") || "ARIA encountered an issue. Please try again.";

      setMessages(prev => [...prev, {
        role: "assistant",
        content: replyText,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "⚠️ Connection error. Check your network and try again.\n\n— ARIA 🤖",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080b0f",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      color: "#e8e8e8",
      display: "flex",
      flexDirection: "column"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(0,255,136,0.1); }
          50% { box-shadow: 0 0 40px rgba(0,255,136,0.25); }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        * { box-sizing: border-box; }
        button:hover { opacity: 0.85; }
      `}</style>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.02)",
        backdropFilter: "blur(20px)",
        position: "sticky", top: 0, zIndex: 100
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, #00ff88, #00cc6a)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 900, color: "#000",
            animation: "glow 3s ease-in-out infinite"
          }}>P</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>
              Pump<span style={{ color: "#00ff88" }}>X</span>
            </div>
            <div style={{ fontSize: 11, color: "#666", letterSpacing: 0.5 }}>AI Prediction Intelligence</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#00ff88",
            animation: "pulse 2s ease-in-out infinite"
          }} />
          <span style={{ fontSize: 12, color: "#00ff88", fontWeight: 600 }}>ARIA ONLINE</span>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: "flex", gap: 4, padding: "12px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.06)"
      }}>
        {[
          { id: "aria", label: "🤖 ARIA Chat" },
          { id: "markets", label: "📊 Live Markets" },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "8px 20px", borderRadius: 30, fontSize: 13, fontWeight: 600,
            border: activeTab === tab.id ? "1px solid rgba(0,255,136,0.4)" : "1px solid rgba(255,255,255,0.08)",
            background: activeTab === tab.id ? "rgba(0,255,136,0.1)" : "transparent",
            color: activeTab === tab.id ? "#00ff88" : "#666",
            cursor: "pointer", transition: "all 0.2s"
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", maxHeight: "calc(100vh - 130px)" }}>

        {/* Left Sidebar */}
        <div style={{
          width: 280, borderRight: "1px solid rgba(255,255,255,0.06)",
          padding: "16px", overflowY: "auto", flexShrink: 0,
          display: "flex", flexDirection: "column", gap: 16
        }}>
          <PumpScoreDial score={pumpScore} />

          {/* Prophet Score */}
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16, padding: "16px"
          }}>
            <div style={{ fontSize: 11, color: "#666", letterSpacing: 2, marginBottom: 12 }}>YOUR PROPHET PROFILE</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18
              }}>🧠</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>You</div>
                <div style={{ fontSize: 11, color: "#00ff88", fontWeight: 600 }}>Oracle Level</div>
              </div>
            </div>
            {[
              { label: "Prophet Score", value: "847", color: "#00ff88" },
              { label: "Accuracy", value: "71%", color: "#6366f1" },
              { label: "Win Streak", value: "🔥 14 days", color: "#ff8800" },
              { label: "PUMP Earned", value: "4,230", color: "#ffcc00" },
            ].map(stat => (
              <div key={stat.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#666" }}>{stat.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: stat.color }}>{stat.value}</span>
              </div>
            ))}
          </div>

          {/* Quick Prompts */}
          <div>
            <div style={{ fontSize: 11, color: "#666", letterSpacing: 2, marginBottom: 10 }}>QUICK PROMPTS</div>
            {QUICK_PROMPTS.map((p, i) => (
              <button key={i} onClick={() => sendMessage(p.text)} style={{
                width: "100%", textAlign: "left",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10, padding: "9px 12px",
                color: "#aaa", fontSize: 12, cursor: "pointer",
                marginBottom: 6, transition: "all 0.2s", display: "block"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,255,136,0.06)"; e.currentTarget.style.color = "#e8e8e8"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#aaa"; }}
              >{p.label}</button>
            ))}
          </div>
        </div>

        {/* Main Panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {activeTab === "aria" && (
            <>
              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{ animation: "fadeSlideUp 0.3s ease forwards" }}>
                    <Message msg={msg} />
                  </div>
                ))}
                {loading && (
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 20 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: "linear-gradient(135deg, #00ff88, #00cc6a)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 800, color: "#000", flexShrink: 0
                    }}>A</div>
                    <div style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "4px 18px 18px 18px",
                    }}>
                      <TypingIndicator />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div style={{
                borderTop: "1px solid rgba(255,255,255,0.06)",
                padding: "16px 24px",
                background: "rgba(255,255,255,0.02)"
              }}>
                <div style={{
                  display: "flex", gap: 12, alignItems: "flex-end",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 16, padding: "12px 16px",
                  transition: "border-color 0.2s",
                }}
                onFocus={e => e.currentTarget.style.borderColor = "rgba(0,255,136,0.3)"}
                onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}
                >
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Ask ARIA anything — markets, bets, sentiment..."
                    rows={1}
                    style={{
                      flex: 1, background: "none", border: "none", outline: "none",
                      color: "#e8e8e8", fontSize: 14, lineHeight: 1.6,
                      resize: "none", fontFamily: "inherit", maxHeight: 120, overflowY: "auto"
                    }}
                    onInput={e => {
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                    }}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: input.trim() && !loading
                        ? "linear-gradient(135deg, #00ff88, #00cc6a)"
                        : "rgba(255,255,255,0.06)",
                      border: "none", cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, flexShrink: 0, transition: "all 0.2s",
                      color: input.trim() && !loading ? "#000" : "#444"
                    }}
                  >↑</button>
                </div>
                <div style={{ fontSize: 11, color: "#444", textAlign: "center", marginTop: 8 }}>
                  ARIA provides crowd intelligence only — not financial advice
                </div>
              </div>
            </>
          )}

          {activeTab === "markets" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20
              }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>Live Markets</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{SAMPLE_MARKETS.length} active markets • Updated live</div>
                </div>
                <button
                  onClick={() => { setActiveTab("aria"); sendMessage("Generate 5 fresh prediction markets for today"); }}
                  style={{
                    background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.3)",
                    color: "#00ff88", padding: "8px 16px", borderRadius: 20,
                    fontSize: 12, cursor: "pointer", fontWeight: 600
                  }}>
                  🤖 Generate with ARIA
                </button>
              </div>

              {/* Category filters */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                {["All", "Index", "Crypto", "Stocks", "Policy"].map(cat => (
                  <button key={cat} style={{
                    padding: "5px 14px", borderRadius: 20, fontSize: 12,
                    border: cat === "All" ? "1px solid rgba(0,255,136,0.4)" : "1px solid rgba(255,255,255,0.1)",
                    background: cat === "All" ? "rgba(0,255,136,0.1)" : "transparent",
                    color: cat === "All" ? "#00ff88" : "#666",
                    cursor: "pointer"
                  }}>{cat}</button>
                ))}
              </div>

              {SAMPLE_MARKETS.map(market => <MarketCard key={market.id} market={market} />)}

              <div style={{
                background: "rgba(0,255,136,0.05)", border: "1px dashed rgba(0,255,136,0.2)",
                borderRadius: 12, padding: "20px", textAlign: "center", marginTop: 10
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🤖</div>
                <div style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>
                  ARIA generates fresh markets every morning at 9 AM based on trending financial news
                </div>
                <button
                  onClick={() => { setActiveTab("aria"); sendMessage("Generate 5 fresh prediction markets for today based on trending financial news"); }}
                  style={{
                    background: "rgba(0,255,136,0.15)", border: "1px solid rgba(0,255,136,0.3)",
                    color: "#00ff88", padding: "8px 20px", borderRadius: 20,
                    fontSize: 13, cursor: "pointer", fontWeight: 600
                  }}>Ask ARIA to generate markets →</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
