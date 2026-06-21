import React, { useEffect, useRef, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./components/Login";
import Register from "./components/Register";
import API_BASE from "./api"; // Imported our unified, mobile-ready configuration

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
    <div className="response-content">
      {sections.map((section, sectionIndex) => (
        <section className="response-section" key={`section-${sectionIndex}`}>
          <h2 className="response-heading">
            <span className="icon">{iconForHeading(section.heading)}</span>
            <span>{section.heading}</span>
          </h2>

          {section.paragraphs.map((paragraph, paragraphIndex) => (
            <p className="response-paragraph" key={`paragraph-${sectionIndex}-${paragraphIndex}`}>
              {paragraph}
            </p>
          ))}

          {section.bullets.length > 0 && (
            <ul className="response-list">
              {section.bullets.map((bullet, bulletIndex) => (
                <li key={`bullet-${sectionIndex}-${bulletIndex}`}>
                  <span className="bullet-icon">•</span>
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

// Component logic separated to accurately utilize useAuth hooks
function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem("token"));
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));

  // Form Field States
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");

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

  // Synchronize and run core endpoints when token state flips true
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

  // Handle continuous chat scrolling mechanics
  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [conversation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("token", data.token);
        setToken(data.token);
      } else {
        setAuthError(data.error || "Login failed");
      }
    } catch {
      setAuthError("Cannot connect to server infrastructure.");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("token", data.token);
        setToken(data.token);
      } else {
        setAuthError(data.error || "Registration failed");
      }
    } catch {
      setAuthError("Cannot connect to server infrastructure.");
    }
  };

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
    if (!value) return "Saved conversation";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Saved conversation";
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
      return <div className="empty-history">No saved conversations yet.</div>;
    }
    return history.map((item, index) => (
      <button
        key={`history-${index}`}
        type="button"
        className="history-item"
        onClick={() => openHistoryItem(item)}
      >
        <span className="history-title">{item.title || "Untitled conversation"}</span>
        <span className="history-meta">{formatHistoryDate(item.createdAt)}</span>
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
      setStatusText("Backend Online & Secure");
    } catch {
      setStatusState("error");
      setStatusText("Backend unavailable");
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

  // RENDER SEPARATE LOGIN / DISCOVERY COMPONENT SCREEN FOR MOBILE WRAPPERS
  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: "420px", margin: "80px auto", padding: "24px", fontFamily: "sans-serif", border: "1px solid #eaeaea", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{ display: "inline-block", padding: "10px 14px", background: "#0070f3", color: "white", borderRadius: "8px", fontWeight: "bold", fontSize: "20px", marginBottom: "8px" }}>NJ</div>
          <h2 style={{ margin: "5px 0" }}>{isRegisterMode ? "Create Account" : "NurseJK Assistant"}</h2>
          <small style={{ color: "#666" }}>Clinical Engine Gateway</small>
        </div>
        
        {authError && <p style={{ color: "#ff4d4f", fontSize: "14px", textAlign: "center", background: "#fff2f0", padding: "8px", borderRadius: "4px", border: "1px solid #ffccc7" }}>{authError}</p>}
        
        <form onSubmit={isRegisterMode ? handleRegister : handleLogin} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {isRegisterMode && (
            <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px" }} />
          )}
          <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px" }} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px" }} />
          <button type="submit" style={{ padding: "12px", backgroundColor: "#0070f3", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "15px", fontWeight: "bold", marginTop: "5px" }}>
            {isRegisterMode ? "Sign Up" : "Sign In"}
          </button>
        </form>
        
        <p style={{ marginTop: "20px", fontSize: "13px", textAlign: "center", color: "#444" }}>
          {isRegisterMode ? "Already have an account? " : "New student? "}
          <span style={{ color: "#0070f3", cursor: "pointer", fontWeight: "600", textDecoration: "underline" }} onClick={() => { setIsRegisterMode(!isRegisterMode); setAuthError(""); }}>
            {isRegisterMode ? "Login here" : "Register here"}
          </span>
        </p>
      </div>
    );
  }

  // CORE UNIFIED SYSTEM WORKSPACE INTERFACE
  return (
    <div className="shell">
      <aside className={historyCollapsed ? "history-collapsed" : ""}>
        <div className="brand-row">
          <div className="brand">
            <div className="brand-mark">NJ</div>
            <div>
              <div>NurseJK Assistant</div>
              <small>Created by Joe Karamuki</small>
            </div>
          </div>
          <button
            className="icon-button"
            type="button"
            title="Show or hide recents"
            aria-label="Show or hide recents"
            onClick={() => setHistoryCollapsed((value) => !value)}
          >
            ☰
          </button>
        </div>

        <div className="status">
          <span>
            <span className={`dot ${statusState === "ready" ? "ready" : statusState === "error" ? "error" : ""}`} />
            <span>{statusText}</span>
          </span>
          <button type="button" onClick={handleLogout} style={{ background: "none", border: "none", color: "#ff4d4f", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>Logout</button>
        </div>

        <div className="performance-widget" style={{ padding: "10px", background: "#f5f5f5", borderRadius: "6px", margin: "10px 0" }}>
          <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#333", display: "flex", alignItems: "center", gap: "5px" }}>
            <span>🎯</span> Tracked Review Topics
          </h4>
          {weakTopics.length === 0 ? (
            <p style={{ margin: "0", fontSize: "11px", color: "#777" }}>No priority review topics tracked yet. Ask a clinical question to train the diagnostic scope.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "120px", overflowY: "auto" }}>
              {weakTopics.map((topic, id) => (
                <div key={id} style={{ background: "#fff", padding: "6px", borderRadius: "4px", fontSize: "11px", borderLeft: "3px solid #ff4d4f", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                  {topic}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="examples" aria-label="Example questions">
          <button type="button" onClick={() => setExample("What is meningitis?")}>
            Meningitis overview
          </button>
          <button type="button" onClick={() => setExample("Explain nursing management for hypertension.")}>
            Hypertension management
          </button>
          <button type="button" onClick={() => setExample("What are red flags for stroke?")}>
            Stroke red flags
          </button>
        </div>

        <div className="history-panel">
          <div className="history-header">
            <span>Recents</span>
            <button
              className="icon-button"
              type="button"
              title="Refresh recents"
              aria-label="Refresh recents"
              onClick={loadHistory}
            >
              ↻
            </button>
          </div>
          <div className="history-list">{renderHistory()}</div>
        </div>
      </aside>

      <main>
        <header>
          <h1>Clinical nursing support</h1>
          <p>Ask a nursing topic question and get a structured response grounded in board preparation schematics.</p>
          <small>Created by Joe Karamuki</small>
        </header>

        <section className="conversation" aria-live="polite" ref={conversationRef}>
          {conversation.map((messageItem, index) => (
            <article
              key={`message-${index}`}
              className={`message ${messageItem.type}${messageItem.type !== "assistant" ? " plain" : ""}${
                messageItem.isHistory ? " history" : ""
              }`}
            >
              {messageItem.type === "assistant" ? (
                renderResponseContent(messageItem.text)
              ) : (
                <>{messageItem.text}</>
              )}
            </article>
          ))}
        </section>

        <form className="composer" id="chatForm" onSubmit={handleSubmit}>
          <div className="input-row">
            <textarea
              id="message"
              name="message"
              placeholder="Hello there, Ask a nursing question..."
              required
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={sending}
            />
            <button className="send" id="sendButton" type="submit" disabled={sending}>
              {sending ? "Sending" : "Send"}
            </button>
          </div>

          <div className="note">
            For clinical decisions, verify with a licensed clinician and local policy.
          </div>
        </form>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}