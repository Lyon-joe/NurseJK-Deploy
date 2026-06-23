import React, { useEffect, useRef, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Login from "./components/Login";
import Register from "./components/Register";

type MessageType = "assistant" | "user" | "error";
type ConversationMessage = { type: MessageType; text: string; isHistory?: boolean; };
type HistoryItem = { title?: string; createdAt?: string; userMessage: string; assistantReply: string; };
type ResponseSection = { heading: string; paragraphs: string[]; bullets: string[]; };
type ActiveViewType = "dashboard" | "library";

export interface StudyMaterial {
  id: string;
  name: string;
  type: string;
  size: string;
  url: string; 
}

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

const iconForHeading = (text: string) => sectionIcons.find((entry) => entry.pattern.test(text))?.icon || "📌";
const cleanInline = (text: string) => text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/`(.*?)`/g, "$1").trim();

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
    const headingMatch = line.match(/^#{1,4}\s+(.+)$/) || line.match(/^•\s+([A-Za-z\s]{3,30})$/);
    const numberedMatch = line.match(/^\*{0,2}(\d{1,2}\.\s+[^:*]+)\*{0,2}:?$/);
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);

    if (headingMatch || numberedMatch) { flushParagraph(); createSection(cleanInline(headingMatch ? headingMatch[1] : numberedMatch![1])); continue; }
    if (bulletMatch) { flushParagraph(); if (!currentSection) createSection("Key Points"); currentSection!.bullets.push(cleanInline(bulletMatch[1])); continue; }
    paragraphBuffer.push(line);
  }
  flushParagraph();
  return sections.length === 0 ? [{ heading: "Response", paragraphs: [cleanInline(text)], bullets: [] }] : sections;
};

const renderResponseContent = (text: string) => {
  const sections = parseResponseSections(text);
  return (
    <div className="response-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {sections.map((section, idx) => (
        <section key={`s-${idx}`} style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }} className="response-section">
          <h4 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
            <span>{iconForHeading(section.heading)}</span> {section.heading}
          </h4>
          {section.paragraphs.map((p, pIdx) => <p key={`p-${idx}-${pIdx}`} style={{ color: '#475569', fontSize: '14px', lineHeight: '1.6', margin: '0 0 10px 0' }}>{p}</p>)}
          <ul style={{ listStyle: 'none', padding: '0', margin: '0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {section.bullets.map((b, bIdx) => <li key={`b-${idx}-${bIdx}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '14px', color: '#475569' }}><span style={{ color: '#0d9488', fontWeight: 'bold' }}>•</span><span>{b}</span></li>)}
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
  const [isMemoryCollapsed, setIsMemoryCollapsed] = useState(false);

  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");

  const [statusText, setStatusText] = useState("Engine Core Online");
  const [statusState, setStatusState] = useState<"ready" | "pending" | "error">("ready");
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState<ConversationMessage[]>([
    { type: "assistant", text: "Ready for a nursing clinical logic exploration." }
  ]);
  const [weakTopics, setWeakTopics] = useState<string[]>(["Maternal Shock Profiles", "Neonatal Resuscitation Timelines"]);
  const [recentMemories] = useState([
  "Pulmonary embolism",
  "Myasthenia gravis",
  "Postpartum hemorrhage",
  "Diabetic ketoacidosis",
  "Neonatal jaundice",
  "Tuberculosis treatment"
]);
  const conversationRef = useRef<HTMLDivElement | null>(null);

  const [materials, setMaterials] = useState<StudyMaterial[]>([
    { id: "hp-1", name: "Healing Tissues, Faster Recovery", type: "pdf", size: "4.2 MB", url: "/assets/Maternal_Healthcare_Guidelines.pdf" },
    { id: "hp-2", name: "Growth Of Medical AI & Digital Health", type: "pptx", size: "18.5 MB", url: "/assets/Advanced_Pharmacology_Lectures.pptx" },
    { id: "hp-3", name: "Emerging Trends In Healthcare & Research", type: "pdf", size: "6.1 MB", url: "/assets/Emerging_Trends.pdf" },
    { id: "hp-4", name: "Advancements In Vaccine Development", type: "docx", size: "2.4 MB", url: "/assets/Vaccine_Development.docx" },
    { id: "hp-5", name: "Comparison Of Treatment Success Rates", type: "xlsx", size: "1.1 MB", url: "/assets/Clinical_Lab_Normal_Ranges.xlsx" },
    { id: "hp-6", name: "From Cutting Edge Treatments To Digital Health", type: "pptx", size: "14.2 MB", url: "/assets/Digital_Health.pptx" },
    { id: "hp-7", name: "Key Milestones In Treatment", type: "pptx", size: "9.8 MB", url: "/assets/Key_Milestones.pptx" }
  ]);

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
    } else setIsAuthenticated(false);
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setIsAuthenticated(false);
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
      const successfulUploads: StudyMaterial[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Construct clean JSON payload
        const payload = {
          name: file.name,
          type: file.name.split('.').pop()?.toLowerCase() || 'unknown',
          url: `/uploads/${file.name}`, // Or your cloud storage URL
          size: (file.size / (1024 * 1024)).toFixed(1) + " MB"
        };

        // Ensure you are using the correct relative path
const response = await fetch("/api/materials/manual-add", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  },
  body: JSON.stringify(payload)
});

        if (!response.ok) {
          throw new Error(`Server returned ${response.status} for ${file.name}`);
        }

        const result = await response.json();
        successfulUploads.push({ id: Date.now().toString() + i, ...payload });
      }

      setMaterials(prev => [...prev, ...successfulUploads]);
      setStatusText("Engine Core Online");
      setStatusState("ready");
      console.log("Successfully added:", successfulUploads);

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
    <div className="app-dashboard-shell" style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* SIDEBAR NAVIGATION */}
      <aside
  className="sidebar-dock-shelf"
  style={{
    width: isSidebarCollapsed ? '80px' : '260px',
    background: '#0f172a',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px',
    justifyContent: 'space-between',
    transition: 'width .3s ease'
  }}
>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <button
  type="button"
  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
  style={{
    background: "#1e293b",
    border: "none",
    color: "#fff",
    padding: "10px",
    borderRadius: "8px",
    cursor: "pointer",
    marginBottom: "10px"
  }}
>
  {isSidebarCollapsed ? "🤯" : "😎AI Assistant😎"}
</button>

          <div style={{ paddingBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h2
  style={{
    fontSize: '18px',
    fontWeight: '700',
    color: '#fff',
    margin: '0 0 4px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '2px'
  }}
>
  <span style={{ color: '#2dd4bf' }}>🩺</span>
  {!isSidebarCollapsed && "NurseJK Assistant"}
</h2>

{!isSidebarCollapsed && (
  <p
    style={{
      fontSize: '11px',
      color: '#94a3b8',
      margin: 0,
      textTransform: 'uppercase',
      letterSpacing: '1px'
    }}
  >
    Clinical Companion
  </p>
)}
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button 
              type="button" 
              onClick={() => { setActiveView("dashboard"); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 12px', borderRadius: '8px', border: 'none', background: activeView === 'dashboard' ? 'rgba(45, 212, 191, 0.1)' : 'transparent', color: activeView === 'dashboard' ? '#2dd4bf' : '#94a3b8', fontSize: '14px', fontWeight: '500', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
            >
              <>
  <span>🖥️</span>
  {!isSidebarCollapsed && "Dashboard Hub"}
</>
            </button>
            <button 
              type="button" 
              onClick={() => { setActiveView("library"); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 12px', borderRadius: '8px', border: 'none', background: activeView === 'library' ? 'rgba(45, 212, 191, 0.1)' : 'transparent', color: activeView === 'library' ? '#2dd4bf' : '#94a3b8', fontSize: '14px', fontWeight: '500', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
            >
              <>
  <span>📚</span>
  {!isSidebarCollapsed && "Material Library"}
</>
            </button>
            <div
  style={{
    background: "#111827",
    borderRadius: "12px",
    padding: "12px",
    marginTop: "20px"
  }}
>
  <button
    type="button"
    onClick={() => setIsMemoryCollapsed(!isMemoryCollapsed)}
    style={{
      width: "100%",
      background: "transparent",
      border: "none",
      color: "#2dd4bf",
      cursor: "pointer",
      fontWeight: "600",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }}
  >
    {!isSidebarCollapsed && (
      <>
        🧠 Recent Memory
        <span>{isMemoryCollapsed ? "▼" : "▲"}</span>
      </>
    )}
  </button>

  {!isMemoryCollapsed && !isSidebarCollapsed && (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        marginTop: "12px"
      }}
    >
      {recentMemories.map((memory, index) => (
        <div
          key={index}
          style={{
            background: "#1e293b",
            color: "#cbd5e1",
            padding: "10px",
            borderRadius: "8px",
            fontSize: "13px"
          }}
        >
          <button
  type="button"
  style={{
    width: "100%",
    background: "transparent",
    border: "none",
    color: "#cbd5e1",
    textAlign: "left",
    cursor: "pointer",
    fontSize: "13px"
  }}
>
  📝 {memory}
</button>
        </div>
      ))}
    </div>
  )}
</div>
          </nav>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '12px' }}>
          
          <div style={{ padding: '4px 8px' }}>
            {!isSidebarCollapsed && (
              <>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Student Profile</span>
                <span style={{ fontSize: '13.5px', color: '#f1f5f9', fontWeight: '500' }}>Joseph Karamuki</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#222738', color: '#ef4444', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#2d1e24'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#222738'}
          ><>
  <span>🚪</span>
  {!isSidebarCollapsed && "Log Out Session"}
</><span></span>
          </button>
        </div>
      </aside>

      {/* WORKSPACE CONTENT AREA */}
      <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '40px', boxSizing: 'border-box' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '20px', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0' }}>
              {activeView === 'dashboard' ? "Core Reasoning Subsystem" : "Study Material Repository"}
            </h1>
            <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
              {activeView === 'dashboard' ? "Real-time student workspace optimized for high-yield diagnostic synthesis." : "Access structured clinical guideline slide decks and training modules."}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ display: 'block', fontSize: '18px', fontWeight: '700', color: '#0f172a', fontFamily: 'monospace' }}>{timeStr}</span>
            <span style={{ display: 'block', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginTop: '2px', letterSpacing: '0.5px', fontWeight: '600' }}>{dateStr}</span>
          </div>
        </div>

        {/* VIEW 1: DASHBOARD HUB */}
        <div style={{ display: activeView === 'dashboard' ? 'block' : 'none' }}>
          <div style={{ display: 'grid', gridTemplateColumns: (isChatMaximized ? '1fr' : '280px 1fr'), gap: '24px', alignItems: 'start' }}>
            
            {!isChatMaximized && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ color: '#0f172a', fontSize: '13px', fontWeight: '700', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Diagnostic Tracking</h3>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '36px', fontWeight: 'bold', color: '#0d9488' }}>{weakTopics.length}</span>
                    <span style={{ color: '#475569', fontSize: '13.5px', fontWeight: '500' }}>Knowledge Gaps</span>
                  </div>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: '12px 0 0 0', lineHeight: '1.5' }}>Dynamic areas needing curriculum review based on recent analytical performance.</p>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ color: '#b91c1c', fontSize: '13px', fontWeight: '700', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>High Priority Focus</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {weakTopics.map((topic, index) => (
                      <div key={index} style={{ background: '#fef2f2', borderLeft: '3px solid #ef4444', padding: '10px', borderRadius: '0 8px 8px 0' }}>
                        <span style={{ fontSize: '13px', color: '#991b1b', display: 'block', fontWeight: '600' }}>{topic}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* REASONING ENGINE INTERFACE */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', minHeight: '500px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h3 style={{ color: '#0f172a', fontSize: '15px', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Reasoning Agent Subsystem</h3>
                  <span style={{ fontSize: '12px', color: statusState === 'error' ? '#ef4444' : '#0d9488', fontWeight: '600', background: statusState === 'error' ? '#fef2f2' : '#f0fdfa', padding: '4px 8px', borderRadius: '6px' }}>● {statusText}</span>
                </div>
                
                <button
                  type="button"
                  onClick={() => setIsChatMaximized(!isChatMaximized)}
                  style={{ background: '#f1f5f9', border: 'none', color: '#475569', padding: '6px 12px', borderRadius: '6px', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
                >
                  {isChatMaximized ? "🗜️ Exit Fullscreen" : "📺 Maximize Workspace"}
                </button>
              </div>

              <div className="conversation" ref={conversationRef} style={{ flexGrow: 1, overflowY: 'auto', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: isChatMaximized ? '580px' : '380px', paddingRight: '4px' }}>
                {conversation.map((msg, index) => (
                  <div key={index} style={{ alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', background: msg.type === 'user' ? '#0f172a' : '#f8fafc', border: '1px solid ' + (msg.type === 'user' ? '#0f172a' : '#e2e8f0'), padding: '14px', borderRadius: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                    {msg.type === 'assistant' ? renderResponseContent(msg.text) : <span style={{ color: '#ffffff', fontSize: '14px', lineHeight: '1.5' }}>{msg.text}</span>}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <input 
                  type="text" 
                  placeholder="Ask a question about pathology or nursing guidelines..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onFocus={() => setIsChatFocused(true)}
                  onBlur={() => setIsChatFocused(false)}
                  style={{ flexGrow: 1, padding: '14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '14px', outline: 'none', transition: 'border 0.2s' }}
                />
                <button 
                  type="button"
                  style={{ background: '#0d9488', color: '#fff', border: 'none', padding: '0 28px', borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', transition: 'background 0.2s' }}
                >
                  Analyze
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* VIEW 2: MATERIAL LIBRARY */}
        <div style={{ display: activeView === 'library' ? 'block' : 'none' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div>
              <h3 style={{ color: '#0f172a', margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700' }}>Interactive Module Assets</h3>
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Upload multiple presentations and blueprints to populate your digital clinical archive.</p>
            </div>
            
            {isAdmin && (
              <button 
                type="button" 
                onClick={handleFileUploadClick}
                style={{ background: '#0d9488', color: '#fff', padding: '10px 20px', borderRadius: '8px', border: 'none', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s', boxShadow: '0 2px 4px rgba(13,148,136,0.2)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#0f766e'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#0d9488'}
              >
                <span>➕</span> Import Asset Decks
              </button>
            )}
          </div>

          <div className="library-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
            {materials.map((file) => (
              <div 
                key={file.id} 
                style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s, box-shadow 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
              >
                <div style={{ height: '140px', background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ position: 'absolute', top: '12px', left: '12px', background: file.type === 'pdf' ? '#ef4444' : file.type.includes('ppt') ? '#f59e0b' : '#10b981', color: '#fff', fontSize: '10px', fontWeight: '700', padding: '3px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                    {file.type}
                  </span>
                  
                  <div style={{ fontSize: '40px' }}>
                    {file.type === 'pdf' ? '📖' : file.type.includes('ppt') ? '📊' : '📝'}
                  </div>

                  <div style={{ position: 'absolute', bottom: '12px', left: '12px', right: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ width: '35%', height: '4px', background: '#cbd5e1', borderRadius: '2px' }}></div>
                    <div style={{ width: '60%', height: '3px', background: '#e2e8f0', borderRadius: '2px' }}></div>
                  </div>
                </div>

                <div style={{ padding: '16px', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ color: '#0f172a', fontSize: '14.5px', fontWeight: '600', margin: '0 0 4px 0', lineHeight: '1.4' }}>
                      {file.name}
                    </h4>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>
                      Allocation Component: {file.size}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: 'auto' }}>
                    <a 
                      href={file.url} 
                      download={`${file.name}.${file.type}`}
                      style={{ textDecoration: 'none', color: '#0d9488', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}
                    >
                      Get Deck
                    </a>

                    {isAdmin && (
                      <button 
                        type="button" 
                        onClick={() => purgeMaterial(file.id)}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
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

export default function App() { return <BrowserRouter><AuthProvider><AppContent /></AuthProvider></BrowserRouter>; }