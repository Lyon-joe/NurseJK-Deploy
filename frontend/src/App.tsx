import React, { useEffect, useRef, useState } from "react";
import { BrowserRouter } from "react-router-dom"; // Enforces history navigation context
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./components/Login";
import Register from "./components/Register";
import API_BASE from "./api"; 

type MessageType = "assistant" | "user" | "error";

type ConversationMessage = {
  type: MessageType;
  text: string;
  isHistory?: boolean;
};

type HistoryItem = {
  title?: string;
  createdAt?: string;
  userMessage: string;
  assistantReply: string;
};

type ResponseSection = {
  heading: string;
  paragraphs: string[];
  bullets: string[];
};

const sectionIcons = [
  { pattern: /definition/i, icon: "📘" },
  { pattern: /pathophysiology/i, icon: "🧬" },
  { pattern: /risk/i, icon: "⚠️" },
  { pattern: /causes?/i, icon: "🔎" },
  { pattern: /diagnostic|assessment|findings|investigations/i, icon: "🩺" },
  { pattern: /signs?|symptoms?|clinical features/i, icon: "🌡️" },
  { pattern: /nursing|management|intervention/i, icon: "💉" },
  { pattern: /complications?/i, icon: "🚨" },
  { pattern: /medications?|medical management/i, icon: "💊" },
  { pattern: /prevention/i, icon: "🛡️" },
  { pattern: /red flags?/i, icon: "🚩" },
];

const iconForHeading = (text: string) =>
  sectionIcons.find((entry) => entry.pattern.test(text))?.icon || "📌";

const cleanInline = (text: string) =>
  text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .trim();

const parseResponseSections = (text: string): ResponseSection[] => {
  const lines = text.split(/\r?\n/);
  const sections: ResponseSection[] = [];
  let currentSection: ResponseSection | null = null;
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    const paragraph = paragraphBuffer.join(" ").trim();
    paragraphBuffer = [];
    if (!paragraph) return;
    if (!currentSection) {
      currentSection = { heading: "Response", paragraphs: [], bullets: [] };
      sections.push(currentSection);
    }
    currentSection.paragraphs.push(paragraph);
  };

  const createSection = (heading: string) => {
    currentSection = { heading, paragraphs: [], bullets: [] };
    sections.push(currentSection);
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    const headingMatch = line.match(/^#{1,4}\s+(.+)$/) || line.match(/^•\s+([A-Za-z\s]{3,30})$/);
    const numberedMatch = line.match(/^\*{0,2}(\d{1,2}\.\s+[^:*]+)\*{0,2}:?$/);
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);

    if (headingMatch || numberedMatch) {
      flushParagraph();
      const matchGroup = headingMatch ? headingMatch[1] : (numberedMatch ? numberedMatch[1] : "");
      createSection(cleanInline(matchGroup));
      continue;
    }

    if (bulletMatch) {
      flushParagraph();
      if (!currentSection) {
        createSection("Key Points");
      }
      currentSection!.bullets.push(cleanInline(bulletMatch[1]));
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();

  if (sections.length === 0) {
    return [
      {
        heading: "Response",
        paragraphs: [cleanInline(text)],
        bullets: [],
      },
    ];
  }

  return sections;
};

const renderResponseContent = (text: string) => {
  const sections = parseResponseSections(text);

  return (
    <div className="response-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {sections.map((section, sectionIndex) => (
        <section className="response-section" key={`section-${sectionIndex}`} style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
          <h4 className="response-heading" style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-pure)' }}>
            <span className="icon" style={{ fontSize: '16px' }}>{iconForHeading(section.heading)}</span>
            <span>{section.heading}</span>
          </h4>

          {section.paragraphs.map((paragraph, paragraphIndex) => (
            <p className="response-paragraph" key={`paragraph-${sectionIndex}-${paragraphIndex}`} style={{ color: 'var(--text-body)', fontSize: '13.5px', lineHeight: '1.6', margin: '0 0 10px 0' }}>
              {paragraph}
            </p>
          ))}

          {section.bullets.length > 0 && (
            <ul className="response-list" style={{ listStyle: 'none', padding: '0', margin: '0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {section.bullets.map((bullet, bulletIndex) => (
                <li key={`bullet-${sectionIndex}-${bulletIndex}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13.5px', color: 'var(--text-body)' }}>
                  <span className="bullet-icon" style={{ color: 'var(--neon-cyan)' }}>•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
};

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem("token"));
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));

  // App Interface States
  const [statusText, setStatusText] = useState("Checking Engine Connection...");
  const [statusState, setStatusState] = useState<"ready" | "pending" | "error">("pending");
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState<ConversationMessage[]>([
    {
      type: "assistant",
      text: "Ready for a nursing question. Responses use the required sections from the schematic and draw from your specific learning profile history.",
    },
  ]);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [weakTopics, setWeakTopics] = useState<string[]>([]);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [sending, setSending] = useState(false);

  const conversationRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (token) {
      setIsAuthenticated(true);
      checkHealth();
      loadHistory();
      fetchPerformance();
    } else {
      setIsAuthenticated(false);
    }
  }, [token]);

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [conversation]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setConversation([
      {
        type: "assistant",
        text: "Ready for a nursing question. Responses use the required sections from the schematic and draw from your specific learning profile history.",
      },
    ]);
  };

  const formatHistoryDate = (value?: string) => {
    if (!value) return "Saved session";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Saved session";
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const openHistoryItem = (item: HistoryItem) => {
    setConversation((prev) => [
      ...prev,
      { type: "user", text: item.userMessage },
      { type: "assistant", text: item.assistantReply, isHistory: true },
    ]);
  };

  const renderHistory = () => {
    if (history.length === 0) {
      return <div className="empty-history" style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '10px 0' }}>No saved threads.</div>;
    }
    return history.map((item, index) => (
      <button
        key={`history-${index}`}
        type="button"
        className="history-item"
        onClick={() => openHistoryItem(item)}
        style={{ width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '10px', color: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px', transition: 'all 0.2s' }}
      >
        <span className="history-title" style={{ fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{item.title || "Untitled conversation"}</span>
        <span className="history-meta" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatHistoryDate(item.createdAt)}</span>
      </button>
    ));
  };

  const loadHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/conversations`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setHistory(data.conversations || []);
    } catch {
      setHistory([]);
    }
  };

  const fetchPerformance = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/dashboard/performance`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setWeakTopics(data.weakTopics || []);
    } catch {
      setWeakTopics([]);
    }
  };

  const checkHealth = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/protected`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) throw new Error();
      setStatusState("ready");
      setStatusText("Engine Core Online");
    } catch {
      setStatusState("error");
      setStatusText("Backend Unavailable");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sending) return;

    setConversation((prev) => [...prev, { type: "user", text: trimmed }]);
    setMessage("");
    setSending(true);

    const thinkingMessageIndex = conversation.length;
    setConversation((prev) => [...prev, { type: "assistant", text: "Thinking..." }]);

    try {
      const response = await fetch(`${API_BASE}/api/chat/retrieval`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed.");

      setConversation((prev) =>
        prev.map((item, index) =>
          index === thinkingMessageIndex ? { type: "assistant", text: data.reply || "No response received." } : item
        )
      );
      loadHistory();
      fetchPerformance(); 
    } catch (error: unknown) {
      const messageText = error instanceof Error ? error.message : "Failed to connect to backend engine.";
      setConversation((prev) =>
        prev.map((item, index) =>
          index === thinkingMessageIndex ? { type: "error", text: messageText } : item
        )
      );
    } finally {
      setSending(false);
    }
  };

  const setExample = (example: string) => {
    setMessage(example);
  };

  if (!isAuthenticated) {
    return isRegisterMode ? (
      <Register onSwitchToLogin={() => setIsRegisterMode(false)} />
    ) : (
      <Login onSwitchToRegister={() => setIsRegisterMode(true)} />
    )
  }

  return (
    <div className="app-dashboard-shell">
      {/* ==========================================
         LEFT SIDEBAR PANEL
         ========================================== */}
      <aside style={{ display: historyCollapsed ? 'none' : 'flex' }}>
        <div className="brand-row" style={{ marginBottom: '24px' }}>
          <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="brand-mark" style={{ background: 'var(--neon-lime)', color: '#000', fontWeight: '800', padding: '6px 12px', borderRadius: '8px', fontSize: '14px' }}>NJ</div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#fff' }}>NurseJK Assistant</div>
              <small style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Clinical Router v2.5</small>
            </div>
          </div>
        </div>

        {/* Engine Security Status Flag */}
        <div className="status" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-body)', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-glass)', marginBottom: '24px' }}>
          <span className={`dot ${statusState === "ready" ? "ready" : statusState === "error" ? "error" : ""}`} style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusState === 'ready' ? 'var(--neon-lime)' : '#ef4444', display: 'inline-block' }} />
          <span style={{ flexGrow: 1 }}>{statusText}</span>
        </div>

        {/* Board Simulation Interactive Fast Triggers */}
        <div className="examples" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>BOARD CORE EXAMPLES</label>
          <button type="button" onClick={() => setExample("What is meningitis?")} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', padding: '10px', borderRadius: '8px', color: 'var(--text-body)', cursor: 'pointer', textAlign: 'left', fontSize: '12px' }}>
            📘 Meningitis Pathology
          </button>
          <button type="button" onClick={() => setExample("Explain nursing management for hypertension.")} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', padding: '10px', borderRadius: '8px', color: 'var(--text-body)', cursor: 'pointer', textAlign: 'left', fontSize: '12px' }}>
            💉 Hypertension Workflows
          </button>
          <button type="button" onClick={() => setExample("What are red flags for stroke?")} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', padding: '10px', borderRadius: '8px', color: 'var(--text-body)', cursor: 'pointer', textAlign: 'left', fontSize: '12px' }}>
            🚩 Acute Stroke Red Flags
          </button>
        </div>

        {/* Vertical Threads History Hub */}
        <div className="history-panel" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="history-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>RECENT DISCUSSION THREADS</span>
            <button className="icon-button" type="button" title="Refresh history" onClick={loadHistory} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}>↻</button>
          </div>
          <div className="history-list" style={{ overflowY: 'auto', flexGrow: 1 }}>{renderHistory()}</div>
        </div>

        <button type="button" onClick={handleLogout} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', marginTop: '16px' }}>
          Terminate Session
        </button>
      </aside>

      {/* ==========================================
         MAIN CONTENT VIEWPORT & GRID MATRIX
         ========================================== */}
      <main style={{ flexGrow: 1 }}>
        <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className="menu-toggle" type="button" title="Toggle Sidebar" onClick={() => setHistoryCollapsed((val) => !val)} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>☰</button>
              <h1>Clinical Intelligence Gateway</h1>
            </div>
            <p style={{ marginTop: '6px' }}>Adaptive medical reasoning engine synced with your active diagnostic analytics dashboard profile.</p>
          </div>
        </header>

        <div className="dashboard-grid-matrix" style={{ marginTop: '32px' }}>
          {/* Widget Card 1: Focus Metrics Tracker */}
          <section className="glass-panel span-1 glow-cyan" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: '700', color: 'var(--neon-cyan)', letterSpacing: '0.5px' }}>DIAGNOSTIC TRACKING</h3>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#fff', margin: '8px 0' }}>
              {weakTopics.length} <span style={{ fontSize: '13px', color: 'var(--text-body)', fontWeight: '400' }}>Active Knowledge Gaps</span>
            </div>
            <p style={{ margin: '0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>Real-time student weaknesses generated by reasoning content metrics.</p>
          </section>

          {/* Widget Card 2: Knowledge Gaps Badge Display */}
          <section className="glass-panel span-2 glow-purple" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: '700', color: 'var(--neon-purple)', letterSpacing: '0.5px' }}>HIGH-PRIORITY REMEDIATION ITEMS</h3>
            {weakTopics.length === 0 ? (
              <p style={{ margin: "0", fontSize: "12.5px", color: "var(--text-body)" }}>No critical knowledge gaps mapped yet. Submit queries below to calibrate your board evaluation.</p>
            ) : (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", maxHeight: '80px', overflowY: 'auto' }}>
                {weakTopics.map((topic, id) => (
                  <span key={id} style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', color: '#d8b4fe', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>
                    {topic}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Widget Card 3: The Primary Reasoning Chat Module */}
          <section className="glass-panel span-3" style={{ display: 'flex', flexDirection: 'column', height: '560px', padding: '0', overflow: 'hidden' }}>
            <div style={{ borderBottom: '1px solid var(--border-glass)', padding: '16px 24px', background: 'rgba(255,255,255,0.01)' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', letterSpacing: '0.5px', color: 'var(--neon-lime)' }}>REASONING AGENT SUBSYSTEM</div>
            </div>
            
            {/* Thread Area */}
            <div className="conversation" aria-live="polite" ref={conversationRef} style={{ flexGrow: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {conversation.map((messageItem, index) => (
                <article key={`message-${index}`} style={{ display: 'flex', justifyContent: messageItem.type === 'user' ? 'flex-end' : 'flex-start', width: '100%' }}>
                  {messageItem.type === "assistant" ? (
                    <div style={{ width: '100%', maxWidth: '85%' }}>
                      {renderResponseContent(messageItem.text)}
                    </div>
                  ) : (
                    <div style={{ background: messageItem.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)', border: messageItem.type === 'error' ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border-glass)', padding: '12px 18px', borderRadius: '14px 14px 0 14px', maxWidth: '70%', fontSize: '14px', lineHeight: '1.5', color: messageItem.type === 'error' ? '#f87171' : 'var(--text-pure)' }}>
                      {messageItem.text}
                    </div>
                  )}
                </article>
              ))}
            </div>

            {/* Input Composer Anchor */}
            <form onSubmit={handleSubmit} style={{ borderTop: '1px solid var(--border-glass)', padding: '20px 24px', background: 'rgba(6,8,19,0.4)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="Query clinical medical conditions, nursing criteria, or intervention rationales..."
                  required
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  disabled={sending}
                  style={{ flexGrow: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '14px 16px', color: '#fff', fontSize: '14px', outline: 'none', transition: 'border 0.2s' }}
                />
                <button type="submit" disabled={sending} style={{ background: 'var(--neon-lime)', color: '#000', padding: '0 28px', borderRadius: '10px', fontWeight: '700', border: 'none', cursor: 'pointer', transition: 'opacity 0.2s', fontSize: '14px' }}>
                  {sending ? "Analyzing..." : "Query Engine"}
                </button>
              </div>
              <div className="note" style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'left' }}>
                ⚖️ For evaluation verification only. Cross-reference recommendations with physical nursing board curriculum specifications.
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}