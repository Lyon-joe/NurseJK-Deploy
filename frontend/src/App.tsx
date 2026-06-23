import React, { useEffect, useRef, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Login from "./components/Login";
import Register from "./components/Register";

type MessageType = "assistant" | "user" | "error";
type ConversationMessage = { type: MessageType; text: string; isHistory?: boolean; };
type StudyMaterial = { id: string; name: string; type: string; size: string; url: string; };
type ResponseSection = { heading: string; paragraphs: string[]; bullets: string[]; };
type ActiveViewType = "dashboard" | "library";

const sectionIcons = [
  { pattern: /definition/i, icon: "📘" }, 
  { pattern: /pathophysiology/i, icon: "🧬" },
  { pattern: /risk/i, icon: "⚠️" }, 
  { pattern: /causes?/i, icon: "🔎" },
  { pattern: /diagnostic|assessment|findings|investigations/i, icon: "🩺" },
  { pattern: /signs?|symptoms?|clinical features/i, icon: "🌡️" },
  { pattern: /nursing|management|intervention/i, icon: "💉" },
  { pattern: /complications?/i, icon: "🚨" },
  { pattern: /medications?|medical management|surgical/i, icon: "💊" },
  { pattern: /prevention/i, icon: "🛡️" }, 
  { pattern: /red flags?/i, icon: "🚩" },
  { pattern: /type|classification/i, icon: "🗂️" }
];

const iconForHeading = (text: string) => sectionIcons.find((entry) => entry.pattern.test(text))?.icon || "📌";
const cleanInline = (text: string) => text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/`(.*?)`/g, "$1").trim();

const renderMarkdownInline = (text: string) => {
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = text.split(regex);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} style={{ color: 'var(--neon-cyan)', fontWeight: 'bold' }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={idx} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
};

const parseResponseSections = (text: string): ResponseSection[] => {
  const lines = text.split(/\r?\n/);
  const sections: ResponseSection[] = [];
  let currentSection: ResponseSection | null = null;
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    const paragraph = paragraphBuffer.join(" ").trim();
    paragraphBuffer = [];
    if (!paragraph) return;
    if (!currentSection) { currentSection = { heading: "Response", paragraphs: [], bullets: [] }; sections.push(currentSection); }
    currentSection.paragraphs.push(paragraph);
  };

  const createSection = (heading: string) => { currentSection = { heading, paragraphs: [], bullets: [] }; sections.push(currentSection); };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { flushParagraph(); continue; }
    
    const markdownHeadingMatch = line.match(/^#{1,4}\s+(.+)$/);
    const genericHeadingMatch = line.match(/^[-*•]?\s*\*\*([^*:\n]{3,40})\*\*$/) || line.match(/^•\s+([A-Za-z0-9\s/()]{3,40})$/);
    const numberedMatch = line.match(/^\*{0,2}(\d{1,2}\.\s+[^:*]+)\*{0,2}:?$/);
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);

    if (markdownHeadingMatch || genericHeadingMatch || numberedMatch) { 
      flushParagraph(); 
      const headingText = markdownHeadingMatch ? markdownHeadingMatch[1] : (genericHeadingMatch ? genericHeadingMatch[1] : numberedMatch![1]);
      createSection(cleanInline(headingText)); 
      continue; 
    }
    if (bulletMatch) { 
      flushParagraph(); 
      if (!currentSection) createSection("Key Points"); 
      currentSection!.bullets.push(bulletMatch[1]); 
      continue; 
    }
    paragraphBuffer.push(line);
  }
  flushParagraph();
  return sections.length === 0 ? [{ heading: "Response", paragraphs: [text], bullets: [] }] : sections;
};

const renderResponseContent = (text: string) => {
  const sections = parseResponseSections(text);
  return (
    <div className="response-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {sections.map((section, idx) => (
        <section key={`s-${idx}`} className="response-section">
          <h4 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--neon-cyan)' }}>
            <span>{iconForHeading(section.heading)}</span> {section.heading}
          </h4>
          {section.paragraphs.map((p, pIdx) => <p key={`p-${idx}-${pIdx}`} style={{ color: 'var(--text-pure)', fontSize: '14px', lineHeight: '1.6', margin: '0 0 10px 0' }}>{renderMarkdownInline(p)}</p>)}
          <ul style={{ listStyle: 'none', padding: '0', margin: '0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {section.bullets.map((b, bIdx) => (
              <li key={`b-${idx}-${bIdx}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '14px', color: 'var(--text-pure)' }}>
                <span style={{ color: 'var(--neon-lime)', fontWeight: 'bold' }}>•</span><span>{renderMarkdownInline(b)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem("token"));
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [token, setToken] = useState(localStorage.getItem("token"));
  
  const [activeView, setActiveView] = useState<ActiveViewType>("dashboard");
  const [isChatFocused, setIsChatFocused] = useState(false);
  const [isChatMaximized, setIsChatMaximized] = useState(false);

  const [isAdmin, setIsAdmin] = useState<boolean>(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);

  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");

  const [statusText, setStatusText] = useState("Engine Core Online");
  const [statusState, setStatusState] = useState<"ready" | "pending" | "error">("ready");
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState<ConversationMessage[]>([
    { type: "assistant", text: "Ready for a structured clinical logic exploration. What complex pathology are we breaking down today?" }
  ]);
  const [weakTopics, setWeakTopics] = useState<string[]>([]);
  const [recentMemories, setRecentMemories] = useState<string[]>([
    "Pulmonary embolism",
    "Myasthenia gravis",
    "Postpartum hemorrhage",
    "Diabetic ketoacidosis",
    "Neonatal jaundice",
    "Tuberculosis treatment"
  ]);
  
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [materials, setMaterials] = useState<StudyMaterial[]>([
    { id: "hp-1", name: "Healing Tissues, Faster Recovery", type: "pdf", size: "4.2 MB", url: "/assets/Maternal_Healthcare_Guidelines.pdf" },
    { id: "hp-2", name: "Growth Of Medical AI & Digital Health", type: "pptx", size: "18.5 MB", url: "/assets/Advanced_Pharmacology_Lectures.pptx" },
    { id: "hp-3", name: "Emerging Trends In Healthcare & Research", type: "pdf", size: "6.1 MB", url: "/assets/Emerging_Trends.pdf" },
    { id: "hp-4", name: "Advancements In Vaccine Development", type: "docx", size: "2.4 MB", url: "/assets/Vaccine_Development.docx" },
    { id: "hp-5", name: "Comparison Of Treatment Success Rates", type: "xlsx", size: "1.1 MB", url: "/assets/Clinical_Lab_Normal_Ranges.xlsx" },
    { id: "hp-6", name: "From Cutting Edge Treatments To Digital Health", type: "pptx", size: "14.2 MB", url: "/assets/Digital_Health.pptx" },
    { id: "hp-7", name: "Key Milestones In Treatment", type: "pptx", size: "9.8 MB", url: "/assets/Key_Milestones.pptx" }
  ]);

  // Sync performance telemetry metrics from database endpoints
  const fetchPerformanceAnalytics = async () => {
    if (!token) return;
    try {
      const response = await fetch("/api/dashboard/performance", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.weakTopics) setWeakTopics(data.weakTopics);
      }
    } catch (err) {
      console.error("Failed to sync structural dashboard analytics", err);
    }
  };

  // Sync historical message summaries to fill recent memory tab
  const fetchRecentConversations = async () => {
    if (!token) return;
    try {
      const response = await fetch("/api/conversations", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.conversations && data.conversations.length > 0) {
          const loadedTitles = data.conversations.map((c: any) => c.title);
          setRecentMemories(loadedTitles);
        }
      }
    } catch (err) {
      console.error("Failed to fetch past session streams", err);
    }
  };

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (token) {
      setIsAuthenticated(true);
      fetchPerformanceAnalytics();
      fetchRecentConversations();
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
    setIsAuthenticated(false);
  };

  // Submission engine driving direct queries down to /api/chat/retrieval 
  const handleSendMessage = async (overrideQuery?: string) => {
    const userQuery = (overrideQuery ?? message).trim();
    if (!userQuery || statusState === "pending") return;
    
    setConversation(prev => [...prev, { type: "user", text: userQuery }]);
    setMessage("");

    setStatusText("Synthesizing Logic...");
    setStatusState("pending");

    try {
      // Aligned with backend path: /api/chat/retrieval
      const response = await fetch("/api/chat/retrieval", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ message: userQuery }) // Aligned payload: key is 'message'
      });

      if (!response.ok) {
        throw new Error(`Core routing error: ${response.status}`);
      }

      const data = await response.json();
      
      setConversation(prev => [...prev, {
        type: "assistant",
        text: data.reply || "No dynamic tracking returned."
      }]);
      
      setStatusText("Engine Core Online");
      setStatusState("ready");
      
      // Update sidebar memory nodes and knowledge gaps dynamically post-response
      fetchPerformanceAnalytics();
      fetchRecentConversations();

    } catch (error: any) {
      console.error("AI execution failure:", error);
      setConversation(prev => [...prev, {
        type: "error",
        text: `Connection disrupted. System message: ${error.message}`
      }]);
      setStatusText("Offline Error");
      setStatusState("error");
    }
  };

  // Wire up structural click selections on recent memories directly back into execution pipeline
  const handleSelectMemory = (topic: string) => {
    setActiveView("dashboard");
    setMessage(`Provide a systematic evaluation of ${topic}, emphasizing critical nursing roles, primary assessment methods, and high-priority diagnostics.`);
    setIsMemoryOpen(false);
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  };

  const handleFileUploadClick = () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.accept = ".pdf,.doc,.docx,.ppt,.pptx,.xlsx";

    fileInput.onchange = async (e: any) => {
      const files: FileList = e.target.files;
      if (!files || files.length === 0) return;

      setStatusText("Processing Assets...");
      setStatusState("pending");

      try {
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
          formData.append("files", files[i]);
        }

        const response = await fetch("/api/materials/upload", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status} during upload`);
        }

        const uploadedMaterials = await response.json();
        setMaterials(prev => [...prev, ...uploadedMaterials]);
        setStatusText("Engine Core Online");
        setStatusState("ready");

      } catch (error: any) {
        console.error("Upload failure:", error);
        setStatusText("Upload Failed");
        setStatusState("error");
        alert(`Error: ${error.message}`);
      }
    };

    fileInput.click();
  };

  const purgeMaterial = (id: string) => {
    setMaterials(prev => prev.filter(item => item.id !== id));
  };

  if (!isAuthenticated) return isRegisterMode ? <Register onSwitchToLogin={() => setIsRegisterMode(false)} /> : <Login onSwitchToRegister={() => setIsRegisterMode(true)} />;

  return (
    <div className="app-dashboard-shell">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className={`sidebar-dock-shelf ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-main-content">
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="sidebar-toggle-btn"
          >
            {isSidebarCollapsed ? "🧭" : "⚡ Collapse Navigation"}
          </button>

          <div className="sidebar-brand">
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--neon-cyan)' }}>🩺</span>
              <span className="brand-text-desktop">NurseJK Assistant</span>
              <span className="brand-text-mobile">NurseJK</span>
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--text-body)', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Clinical Companion</p>
          </div>

          <nav className="sidebar-nav">
            <button 
              type="button" 
              onClick={() => { setActiveView("dashboard"); }}
              className={`nav-button ${activeView === 'dashboard' ? 'active' : ''}`}
            >
              <span>🖥️</span>
              <span className="nav-button-text">Reasoning Core</span>
            </button>
            <button 
              type="button" 
              onClick={() => { setActiveView("library"); }}
              className={`nav-button ${activeView === 'library' ? 'active' : ''}`}
            >
              <span>📚</span>
              <span className="nav-button-text">Material Repository</span>
            </button>
            
            <button
              type="button"
              onClick={() => setIsMemoryOpen(!isMemoryOpen)}
              className={`nav-button ${isMemoryOpen ? 'active' : ''}`}
              style={{ color: isMemoryOpen ? 'var(--neon-lime)' : undefined }}
            >
              <span>🧠</span>
              <span className="nav-button-text">Recent Memory</span>
            </button>
          </nav>
        </div>

        <div className="sidebar-footer">
          {!isSidebarCollapsed && (
            <div className="profile-container">
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Practitioner Profile</span>
              <span style={{ fontSize: '13.5px', color: 'var(--text-pure)', fontWeight: '500' }}>Joseph Karamuki</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="logout-button"
          >
            <span>🚪</span>
            <span className="logout-button-text">Logout</span>
          </button>
        </div>
      </aside>

      {/* RETRACTABLE HISTORY DRAWER */}
      <div className={`history-tab ${isMemoryOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--neon-lime)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🧠</span> Diagnostic Ledger
          </h3>
          <button type="button" onClick={() => setIsMemoryOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-body)', fontSize: '16px', cursor: 'pointer' }}>✕</button>
        </div>
        <div className="history-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', height: 'calc(100vh - 100px)' }}>
          {recentMemories.map((memory, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelectMemory(memory)}
              style={{ width: '100%', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-glass)', color: 'var(--text-pure)', padding: '12px', borderRadius: '8px', textAlign: 'left', cursor: 'pointer', fontSize: '13.5px', transition: 'all 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--neon-cyan)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-glass)'}
            >
              📝 {memory}
            </button>
          ))}
        </div>
      </div>

      {/* WORKSPACE CONTENT AREA */}
      <main>
        
        {/* TOP META BAR HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '20px', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-pure)', margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
              {activeView === 'dashboard' ? "Core Reasoning Subsystem" : "Study Material Repository"}
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-body)', margin: 0 }}>
              {activeView === 'dashboard' ? "Real-time student workspace optimized for high-yield diagnostic synthesis." : "Access structured clinical guideline slide decks and training modules."}
            </p>
          </div>

          <div id="live-header-clock">
            <span className="live-time">{timeStr}</span>
            <span className="live-date">{dateStr}</span>
          </div>
        </div>

        {/* VIEW 1: DASHBOARD HUB */}
        <div style={{ display: activeView === 'dashboard' ? 'block' : 'none' }}>
          <div className="dashboard-grid-matrix" style={{ gridTemplateColumns: isChatMaximized ? '1fr' : undefined }}>
            
            {!isChatMaximized && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="glass-panel">
                  <h3 style={{ color: 'var(--text-pure)', fontSize: '13px', fontWeight: '700', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Diagnostic Tracking</h3>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--neon-cyan)' }}>{weakTopics.length}</span>
                    <span style={{ color: 'var(--text-body)', fontSize: '13.5px', fontWeight: '500' }}>Knowledge Gaps</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '12px 0 0 0', lineHeight: '1.5' }}>Dynamic areas needing curriculum review based on recent analytical performance.</p>
                </div>

                <div className="glass-panel" style={{ borderTop: '2px solid var(--neon-pink)' }}>
                  <h3 style={{ color: 'var(--neon-pink)', fontSize: '13px', fontWeight: '700', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>High Priority Focus</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {weakTopics.length === 0 ? (
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No topics flags logged yet.</span>
                    ) : (
                      weakTopics.map((topic, index) => (
                        <div
                          key={index}
                          className="weak-topic-card"
                          onClick={() => {
                            const query = `Provide a board-exam focused breakdown of ${topic}, covering pathophysiology, clinical features, nursing interventions, and common NCLEX pitfalls.`;
                            setActiveView('dashboard');
                            setIsMemoryOpen(false);
                            handleSendMessage(query);
                          }}
                          title="Click to trigger AI evaluation"
                        >
                          <span style={{ fontSize: '11px', color: 'var(--neon-pink)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>⚡ Auto-Analyze</span>
                          <span style={{ fontSize: '13px', color: 'var(--text-pure)', display: 'block', fontWeight: '600', marginTop: '4px' }}>{topic}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* REASONING ENGINE INTERFACE */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: '520px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h3 style={{ color: 'var(--text-pure)', fontSize: '15px', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Reasoning Agent Subsystem</h3>
                  <span style={{ fontSize: '12px', color: statusState === 'error' ? 'var(--neon-pink)' : 'var(--neon-cyan)', fontWeight: '600', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-glass)' }}>● {statusText}</span>
                </div>
                
                <button
                  type="button"
                  onClick={() => setIsChatMaximized(!isChatMaximized)}
                  style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid var(--border-glass)', color: 'var(--text-pure)', padding: '6px 12px', borderRadius: '6px', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  {isChatMaximized ? "🗜️ Exit Fullscreen" : "📺 Maximize Workspace"}
                </button>
              </div>

              <div className="conversation" ref={conversationRef} style={{ flexGrow: 1, overflowY: 'auto', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: isChatMaximized ? '620px' : '400px' }}>
                {conversation.map((msg, index) => (
                  <div
                    key={index}
                    style={{
                      alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '88%',
                      background: msg.type === 'user'
                        ? 'var(--bg-card-glass)'
                        : msg.type === 'error'
                        ? 'rgba(255, 0, 127, 0.06)'
                        : 'rgba(255,255,255,0.03)',
                      border: '1px solid ' + (msg.type === 'user'
                        ? 'var(--border-glass-bright)'
                        : msg.type === 'error'
                        ? 'rgba(255, 0, 127, 0.3)'
                        : 'var(--border-glass)'),
                      padding: '14px 18px',
                      borderRadius: msg.type === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {msg.type === 'assistant'
                      ? renderResponseContent(msg.text)
                      : msg.type === 'error'
                      ? <span style={{ color: 'var(--neon-pink)', fontSize: '13.5px', lineHeight: '1.5', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>⚠️</span><span>{msg.text.replace('🔴 ', '')}</span>
                        </span>
                      : <span style={{ color: 'var(--text-pure)', fontSize: '14px', lineHeight: '1.5' }}>{msg.text}</span>
                    }
                  </div>
                ))}
                {statusState === 'pending' && (
                  <div style={{ alignSelf: 'flex-start', padding: '12px 18px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: '4px 16px 16px 16px' }}>
                    <span style={{ color: 'var(--neon-cyan)', fontSize: '13px', letterSpacing: '2px' }}>● ● ●</span>
                  </div>
                )}
              </div>

              {/* CHAT INPUT SUBMISSION GROUP */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <input 
                  type="text" 
                  ref={inputRef}
                  placeholder={statusState === "pending" ? "Mira is evaluating data fields..." : "Ask Mira a question about pathology or nursing guidelines..."}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                  disabled={statusState === "pending"}
                  onFocus={() => setIsChatFocused(true)}
                  onBlur={() => setIsChatFocused(false)}
                  style={{ flexGrow: 1, padding: '14px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', color: 'var(--text-pure)', fontSize: '14px', outline: 'none', opacity: statusState === "pending" ? 0.6 : 1 }}
                />
                <button 
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={statusState === "pending"}
                  style={{ background: 'var(--border-glass-bright)', color: '#fff', border: 'none', padding: '0 28px', borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,177,54,0.3)', opacity: statusState === "pending" ? 0.6 : 1 }}
                >
                  {statusState === "pending" ? "..." : "Analyze"}
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* VIEW 2: MATERIAL LIBRARY */}
        <div style={{ display: activeView === 'library' ? 'block' : 'none' }}>
          <div className="glass-panel" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ color: 'var(--text-pure)', margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700' }}>Interactive Module Assets</h3>
              <p style={{ color: 'var(--text-body)', fontSize: '13px', margin: 0 }}>Upload multiple presentations and blueprints to populate your digital clinical archive.</p>
            </div>
            
            {isAdmin && (
              <button 
                type="button" 
                onClick={handleFileUploadClick}
                style={{ background: 'var(--border-glass-bright)', color: '#fff', padding: '10px 20px', borderRadius: '8px', border: 'none', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(99,177,54,0.2)' }}
              >
                <span>➕</span> Import Asset Decks
              </button>
            )}
          </div>

          <div className="library-grid">
            {materials.map((file) => (
              <div key={file.id} className="glass-panel" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: '140px', background: 'rgba(255,255,255,0.05)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--border-glass)' }}>
                  <span style={{ position: 'absolute', top: '12px', left: '12px', background: file.type === 'pdf' ? '#ef4444' : file.type.includes('ppt') ? '#f59e0b' : '#10b981', color: '#fff', fontSize: '10px', fontWeight: '700', padding: '3px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                    {file.type}
                  </span>
                  
                  <div style={{ fontSize: '40px' }}>
                    {file.type === 'pdf' ? '📖' : file.type.includes('ppt') ? '📊' : '📝'}
                  </div>
                </div>

                <div style={{ padding: '16px', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ color: 'var(--text-pure)', fontSize: '14.5px', fontWeight: '600', margin: '0 0 4px 0', lineHeight: '1.4' }}>
                      {file.name}
                    </h4>
                    <span style={{ color: 'var(--text-body)', fontSize: '12px' }}>
                      Allocation Component: {file.size}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-glass)', paddingTop: '12px', marginTop: 'auto' }}>
                    <a 
                      href={file.url} 
                      download={`${file.name}.${file.type}`}
                      style={{ textDecoration: 'none', color: 'var(--neon-cyan)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}
                    >
                      Get Deck
                    </a>

                    {isAdmin && (
                      <button 
                        type="button" 
                        onClick={() => purgeMaterial(file.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', fontWeight: '500', transition: 'color 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--neon-pink)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        Purge
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
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