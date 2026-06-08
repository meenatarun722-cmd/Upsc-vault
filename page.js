"use client";
import { useState, useEffect, useCallback } from "react";

// ─── SM-2 Algorithm ────────────────────────────────────────────────────────
function sm2(card, grade) {
  let { interval = 1, repetitions = 0, easeFactor = 2.5, lapses = 0 } = card;
  if (grade === 0) {
    lapses += 1; repetitions = 0; interval = 1;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 3;
    else interval = Math.round(interval * easeFactor);
    repetitions += 1;
    easeFactor = Math.max(1.3, easeFactor + 0.1 - (3 - grade) * (0.08 + (3 - grade) * 0.02));
  }
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + interval);
  return { interval, repetitions, easeFactor, lapses, dueDate: dueDate.toISOString(), lastReviewed: new Date().toISOString() };
}

function isDue(card) {
  if (!card.dueDate) return true;
  return new Date(card.dueDate) <= new Date();
}

const STORAGE_KEY = "upsc_vault_v1";

function loadFromStorage() {
  try {
    const d = localStorage.getItem(STORAGE_KEY);
    return d ? JSON.parse(d) : null;
  } catch { return null; }
}

function saveToStorage(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { console.error(e); }
}

const defaultState = { pdfs: [], cards: [], mcqs: [], sessions: [], streak: 0, lastStudyDate: null };

// ─── Styles ────────────────────────────────────────────────────────────────
const S = {
  app: { minHeight: "100vh", background: "#0a0a0f", color: "#e8e0d0", fontFamily: "'Georgia', serif" },
  nav: { background: "#0f0f1a", borderBottom: "1px solid #2a2a3e", padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", position: "sticky", top: 0, zIndex: 100 },
  navBrand: { color: "#e2c97e", fontWeight: "bold", fontSize: 18, marginRight: "auto", letterSpacing: 1 },
  navBtn: (active) => ({ background: active ? "#e2c97e" : "transparent", color: active ? "#0a0a0f" : "#999", border: "1px solid " + (active ? "#e2c97e" : "#333"), borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }),
  main: { maxWidth: 900, margin: "0 auto", padding: "24px 16px" },
  card: { background: "#0f0f1a", border: "1px solid #2a2a3e", borderRadius: 12, padding: 20, marginBottom: 16 },
  h2: { color: "#e2c97e", fontSize: 22, marginBottom: 16, fontWeight: "normal", letterSpacing: 0.5 },
  h3: { color: "#c4b896", fontSize: 16, marginBottom: 10, fontWeight: "normal" },
  badge: (color) => ({ background: color + "22", color: color, border: "1px solid " + color + "44", borderRadius: 4, padding: "2px 8px", fontSize: 12, display: "inline-block" }),
  btn: (variant = "primary") => ({ background: variant === "primary" ? "#e2c97e" : variant === "danger" ? "#c0392b" : variant === "success" ? "#27ae60" : "transparent", color: variant === "primary" ? "#0a0a0f" : "#e8e0d0", border: variant === "ghost" ? "1px solid #333" : "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 14, fontFamily: "inherit", fontWeight: variant === "primary" ? "bold" : "normal" }),
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 },
  statCard: { background: "#0f0f1a", border: "1px solid #2a2a3e", borderRadius: 10, padding: 16, textAlign: "center" },
  input: { background: "#0f0f1a", border: "1px solid #333", borderRadius: 6, padding: "8px 12px", color: "#e8e0d0", fontFamily: "inherit", width: "100%", fontSize: 14 },
};

export default function App() {
  const [appData, setAppData] = useState(defaultState);
  const [view, setView] = useState("dashboard");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [quizMode, setQuizMode] = useState("flashcard");
  const [quizFilter, setQuizFilter] = useState("due");
  const [currentCard, setCurrentCard] = useState(null);
  const [quizQueue, setQuizQueue] = useState([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [sessionStats, setSessionStats] = useState({ correct: 0, wrong: 0, skipped: 0 });
  const [filterPDF, setFilterPDF] = useState("all");
  const [filterTopic, setFilterTopic] = useState("all");
  const [toast, setToast] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const d = loadFromStorage();
    if (d) setAppData(d);
    setHydrated(true);
  }, []);

  const persist = useCallback((newData) => {
    setAppData(newData);
    saveToStorage(newData);
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handlePDF = async (file) => {
    setUploading(true);
    try {
      setUploadProgress("Reading PDF...");
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });

      setUploadProgress("Extracting text from PDF...");
      const extractRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType: "application/pdf" })
      });
      const extractData = await extractRes.json();
      if (!extractData.success) throw new Error(extractData.error);

      setUploadProgress("AI generating UPSC flashcards & MCQs...");
      const processRes = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: extractData.text, pdfName: file.name })
      });
      const processData = await processRes.json();
      if (!processData.success) throw new Error(processData.error);

      const generated = processData.data;
      const pdfId = `pdf_${Date.now()}`;

      const newCards = generated.flashcards.map((f, i) => ({
        ...f, id: `${pdfId}_f${i}`, pdfId, pdfName: file.name, topic: generated.topic, type: "flashcard",
        interval: 1, repetitions: 0, easeFactor: 2.5, lapses: 0,
        dueDate: new Date().toISOString(), lastReviewed: null, wrongCount: 0, skippedCount: 0
      }));

      const newMCQs = generated.mcqs.map((m, i) => ({
        ...m, id: `${pdfId}_m${i}`, pdfId, pdfName: file.name, topic: generated.topic, type: "mcq",
        interval: 1, repetitions: 0, easeFactor: 2.5, lapses: 0,
        dueDate: new Date().toISOString(), lastReviewed: null, wrongCount: 0, skippedCount: 0
      }));

      const newPDF = {
        id: pdfId, name: file.name, topic: generated.topic,
        subtopics: generated.subtopics, keypoints: generated.keypoints,
        uploadedAt: new Date().toISOString(), cardCount: newCards.length, mcqCount: newMCQs.length
      };

      const updated = { ...appData, pdfs: [...appData.pdfs, newPDF], cards: [...appData.cards, ...newCards], mcqs: [...appData.mcqs, ...newMCQs] };
      persist(updated);
      showToast(`✅ ${file.name} done! ${newCards.length} flashcards + ${newMCQs.length} MCQs created`);
      setView("dashboard");
    } catch (e) {
      console.error(e);
      showToast("❌ Error: " + e.message, "error");
    }
    setUploading(false);
    setUploadProgress("");
  };

  const startQuiz = (mode, filter, pdfId = filterPDF, topic = filterTopic) => {
    let pool = mode === "flashcard" ? [...appData.cards] : [...appData.mcqs];
    if (pdfId !== "all") pool = pool.filter(c => c.pdfId === pdfId);
    if (topic !== "all") pool = pool.filter(c => c.topic === topic);
    if (filter === "due") pool = pool.filter(isDue);
    else if (filter === "weak") pool = pool.filter(c => c.wrongCount > 0 || c.skippedCount > 0).sort((a, b) => (b.wrongCount + b.skippedCount) - (a.wrongCount + a.skippedCount));
    if (!pool.length) { showToast("No cards match this filter!", "error"); return; }
    setQuizMode(mode); setQuizFilter(filter);
    setQuizQueue(pool); setQuizIndex(0); setCurrentCard(pool[0]);
    setShowAnswer(false); setSelectedOption(null);
    setSessionStats({ correct: 0, wrong: 0, skipped: 0 });
    setView("quiz");
  };

  const nextCard = (grade, isCorrect) => {
    const updatedSm2 = sm2(currentCard, grade);
    const updateFn = (arr) => arr.map(c => c.id === currentCard.id ? {
      ...c, ...updatedSm2,
      wrongCount: grade === 0 ? (c.wrongCount || 0) + 1 : (c.wrongCount || 0),
      skippedCount: grade === -1 ? (c.skippedCount || 0) + 1 : (c.skippedCount || 0)
    } : c);

    const newStats = {
      correct: sessionStats.correct + (isCorrect ? 1 : 0),
      wrong: sessionStats.wrong + (!isCorrect && grade !== -1 ? 1 : 0),
      skipped: sessionStats.skipped + (grade === -1 ? 1 : 0)
    };
    setSessionStats(newStats);

    const updated = {
      ...appData,
      cards: quizMode === "flashcard" ? updateFn(appData.cards) : appData.cards,
      mcqs: quizMode === "mcq" ? updateFn(appData.mcqs) : appData.mcqs,
    };

    const next = quizIndex + 1;
    if (next >= quizQueue.length) {
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      const newStreak = appData.lastStudyDate === yesterday ? appData.streak + 1 : appData.lastStudyDate === today ? appData.streak : 1;
      const session = { date: new Date().toISOString(), mode: quizMode, total: quizQueue.length, ...newStats };
      persist({ ...updated, streak: newStreak, lastStudyDate: today, sessions: [session, ...(updated.sessions || [])].slice(0, 50) });
      setView("result");
    } else {
      persist(updated);
      setQuizIndex(next); setCurrentCard(quizQueue[next]);
      setShowAnswer(false); setSelectedOption(null);
    }
  };

  const deletePDF = (pdfId) => {
    if (!confirm("Delete this PDF and all its cards?")) return;
    const updated = {
      ...appData,
      pdfs: appData.pdfs.filter(p => p.id !== pdfId),
      cards: appData.cards.filter(c => c.pdfId !== pdfId),
      mcqs: appData.mcqs.filter(c => c.pdfId !== pdfId),
    };
    persist(updated);
    showToast("PDF deleted");
  };

  // Computed
  const dueCards = appData.cards.filter(isDue).length;
  const dueMCQs = appData.mcqs.filter(isDue).length;
  const allTopics = [...new Set([...appData.cards, ...appData.mcqs].map(c => c.topic))];
  const topicStats = {};
  [...appData.cards, ...appData.mcqs].forEach(c => {
    if (!topicStats[c.topic]) topicStats[c.topic] = { total: 0, wrong: 0, skipped: 0 };
    topicStats[c.topic].total++;
    topicStats[c.topic].wrong += c.wrongCount || 0;
    topicStats[c.topic].skipped += c.skippedCount || 0;
  });

  if (!hydrated) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0a0f", color: "#e2c97e", fontSize: 20 }}>Loading UPSC Vault...</div>;

  // ── QUIZ VIEW ──
  if (view === "quiz" && currentCard) {
    const isMCQ = quizMode === "mcq";
    const progress = (quizIndex / quizQueue.length) * 100;
    return (
      <div style={S.app}>
        {toast && <Toast toast={toast} />}
        <div style={S.nav}>
          <span style={S.navBrand}>📚 UPSC Vault</span>
          <span style={{ color: "#888", fontSize: 13 }}>{quizIndex + 1} / {quizQueue.length}</span>
          <span style={{ color: "#e2c97e", fontSize: 13 }}>🔥 {appData.streak} days</span>
          <button style={S.btn("ghost")} onClick={() => setView("dashboard")}>✕ Exit</button>
        </div>
        <div style={S.main}>
          <div style={{ height: 6, background: "#1a1a2e", borderRadius: 3, marginBottom: 20, overflow: "hidden" }}>
            <div style={{ height: "100%", width: progress + "%", background: "#e2c97e", borderRadius: 3, transition: "width 0.3s" }} />
          </div>
          <div style={{ ...S.card, minHeight: 220 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <span style={S.badge(currentCard.difficulty === "Easy" ? "#27ae60" : currentCard.difficulty === "Difficult" ? "#c0392b" : "#e67e22")}>{currentCard.difficulty}</span>
              <span style={S.badge("#3498db")}>{currentCard.topic}</span>
              {currentCard.subtopic && <span style={S.badge("#9b59b6")}>{currentCard.subtopic}</span>}
              {(currentCard.wrongCount > 0 || currentCard.skippedCount > 0) && <span style={S.badge("#e74c3c")}>⚠ Weak (×{(currentCard.wrongCount || 0) + (currentCard.skippedCount || 0)})</span>}
            </div>
            <p style={{ fontSize: 17, lineHeight: 1.8, color: "#e8e0d0", marginBottom: 16 }}>{currentCard.question}</p>

            {isMCQ ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {currentCard.options.map((opt, i) => {
                  let bg = "#1a1a2e", border = "#2a2a3e", col = "#e8e0d0";
                  if (selectedOption !== null) {
                    if (i === currentCard.correct) { bg = "#27ae6022"; border = "#27ae60"; col = "#27ae60"; }
                    else if (i === selectedOption && i !== currentCard.correct) { bg = "#c0392b22"; border = "#c0392b"; col = "#c0392b"; }
                  }
                  return (
                    <button key={i} onClick={() => { if (selectedOption === null) { setSelectedOption(i); setShowAnswer(true); } }}
                      style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: "12px 16px", color: col, textAlign: "left", cursor: selectedOption === null ? "pointer" : "default", fontFamily: "inherit", fontSize: 14, lineHeight: 1.5 }}>
                      <strong style={{ marginRight: 8 }}>{["A", "B", "C", "D"][i]}.</strong>{opt}
                    </button>
                  );
                })}
                {showAnswer && (
                  <div style={{ background: "#27ae6011", border: "1px solid #27ae6044", borderRadius: 8, padding: 14, marginTop: 4 }}>
                    <p style={{ color: "#27ae60", fontWeight: "bold", marginBottom: 6 }}>Explanation:</p>
                    <p style={{ color: "#b8c8b8", fontSize: 14, lineHeight: 1.7 }}>{currentCard.explanation}</p>
                  </div>
                )}
              </div>
            ) : (
              !showAnswer
                ? <button style={{ ...S.btn("ghost"), width: "100%", marginTop: 8 }} onClick={() => setShowAnswer(true)}>Reveal Answer →</button>
                : <div style={{ background: "#1a1a2e", borderRadius: 8, padding: 16, borderLeft: "3px solid #e2c97e" }}>
                    <p style={{ color: "#e2c97e", fontSize: 12, marginBottom: 8, letterSpacing: 1 }}>ANSWER</p>
                    <p style={{ lineHeight: 1.8 }}>{currentCard.answer}</p>
                  </div>
            )}
          </div>

          {(showAnswer || (isMCQ && selectedOption !== null)) && (
            <div>
              {!isMCQ && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                  {[{ label: "Again", grade: 0, color: "#c0392b", sub: "< 1d" }, { label: "Hard", grade: 1, color: "#e67e22", sub: "3d" }, { label: "Good", grade: 2, color: "#27ae60", sub: "7d" }, { label: "Easy", grade: 3, color: "#2980b9", sub: "14d+" }].map(({ label, grade, color, sub }) => (
                    <button key={label} onClick={() => nextCard(grade, grade >= 2)}
                      style={{ background: color + "22", border: `1px solid ${color}`, color, borderRadius: 8, padding: "12px 4px", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                      <div>{label}</div><div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{sub}</div>
                    </button>
                  ))}
                </div>
              )}
              {isMCQ && <button style={{ ...S.btn("primary"), width: "100%", marginTop: 8 }} onClick={() => nextCard(selectedOption === currentCard.correct ? 2 : 0, selectedOption === currentCard.correct)}>Next →</button>}
              <button style={{ ...S.btn("ghost"), width: "100%", marginTop: 8, fontSize: 13 }} onClick={() => nextCard(-1, false)}>Skip this card</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── RESULT VIEW ──
  if (view === "result") {
    const total = quizQueue.length;
    const pct = total > 0 ? Math.round((sessionStats.correct / total) * 100) : 0;
    return (
      <div style={S.app}>
        <div style={S.nav}><span style={S.navBrand}>📚 UPSC Vault</span></div>
        <div style={S.main}>
          <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>{pct >= 80 ? "🏆" : pct >= 60 ? "📈" : pct >= 40 ? "💪" : "🔄"}</div>
            <h2 style={{ ...S.h2, fontSize: 28, textAlign: "center" }}>Session Complete!</h2>
            <div style={{ fontSize: 52, color: "#e2c97e", fontWeight: "bold", marginBottom: 8 }}>{pct}%</div>
            <p style={{ color: "#888", marginBottom: 28 }}>{pct >= 80 ? "Excellent! You're on fire!" : pct >= 60 ? "Good progress. Keep it up!" : pct >= 40 ? "Keep practicing. You'll get there!" : "Don't give up — review weak topics!"}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, maxWidth: 360, margin: "0 auto 28px" }}>
              <div style={S.statCard}><div style={{ fontSize: 32, color: "#27ae60" }}>{sessionStats.correct}</div><div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Correct</div></div>
              <div style={S.statCard}><div style={{ fontSize: 32, color: "#c0392b" }}>{sessionStats.wrong}</div><div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Wrong</div></div>
              <div style={S.statCard}><div style={{ fontSize: 32, color: "#e67e22" }}>{sessionStats.skipped}</div><div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Skipped</div></div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button style={S.btn("primary")} onClick={() => setView("dashboard")}>🏠 Dashboard</button>
              <button style={S.btn("ghost")} onClick={() => startQuiz(quizMode, "weak")}>⚠ Practice Weak</button>
              <button style={S.btn("ghost")} onClick={() => startQuiz(quizMode, quizFilter)}>🔄 Retry</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN VIEWS ──
  return (
    <div style={S.app}>
      {toast && <Toast toast={toast} />}
      <div style={S.nav}>
        <span style={S.navBrand}>📚 UPSC Vault</span>
        {["dashboard", "practice", "weak", "progress", "upload"].map(v => (
          <button key={v} style={S.navBtn(view === v)} onClick={() => setView(v)}>
            {{ dashboard: "🏠 Home", practice: "🎯 Practice", weak: "⚠ Weak", progress: "📊 Progress", upload: "📤 Upload" }[v]}
          </button>
        ))}
      </div>

      <div style={S.main}>

        {/* DASHBOARD */}
        {view === "dashboard" && (
          <>
            <h2 style={S.h2}>Jai Hind! 🇮🇳 Welcome Back</h2>
            <div style={S.grid}>
              {[
                { label: "🔥 Day Streak", value: appData.streak, color: "#e67e22" },
                { label: "📝 Due Flashcards", value: dueCards, color: "#e2c97e" },
                { label: "🎯 Due MCQs", value: dueMCQs, color: "#3498db" },
                { label: "⚠ Weak Topics", value: Object.values(topicStats).filter(t => t.wrong > 0 || t.skipped > 0).length, color: "#c0392b" },
              ].map(s => (
                <div key={s.label} style={{ ...S.statCard, borderTop: `3px solid ${s.color}`, cursor: "default" }}>
                  <div style={{ fontSize: 32, color: s.color, fontWeight: "bold" }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: "#888", marginTop: 6 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ ...S.card, marginTop: 4 }}>
              <h3 style={S.h3}>⚡ Quick Start</h3>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={S.btn("primary")} onClick={() => startQuiz("flashcard", "due")}>📝 Due Flashcards ({dueCards})</button>
                <button style={{ ...S.btn(), background: "#1a2a3a" }} onClick={() => startQuiz("mcq", "due")}>🎯 Due MCQs ({dueMCQs})</button>
                <button style={{ ...S.btn(), background: "#2a1a1a" }} onClick={() => startQuiz("flashcard", "weak")}>⚠ Weak Topics</button>
                <button style={{ ...S.btn(), background: "#1a2a1a", color: "#27ae60" }} onClick={() => setView("upload")}>📤 Upload PDF</button>
              </div>
            </div>

            {appData.pdfs.length > 0 ? (
              <div style={S.card}>
                <h3 style={S.h3}>📂 Your Study Material ({appData.pdfs.length} PDFs)</h3>
                {appData.pdfs.map(pdf => (
                  <div key={pdf.id} style={{ borderBottom: "1px solid #1a1a2e", paddingBottom: 14, marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: "#e2c97e", marginBottom: 4 }}>📄 {pdf.name}</p>
                        <p style={{ color: "#888", fontSize: 13 }}>{pdf.topic} • {pdf.cardCount} flashcards • {pdf.mcqCount} MCQs</p>
                        {pdf.keypoints && pdf.keypoints.length > 0 && (
                          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {pdf.keypoints.slice(0, 3).map((k, i) => <span key={i} style={{ ...S.badge("#555"), fontSize: 11 }}>{k}</span>)}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={{ ...S.btn("ghost"), padding: "6px 12px", fontSize: 12 }} onClick={() => startQuiz("flashcard", "all", pdf.id, "all")}>Practice</button>
                        <button style={{ ...S.btn("ghost"), padding: "6px 12px", fontSize: 12, color: "#c0392b", borderColor: "#c0392b44" }} onClick={() => deletePDF(pdf.id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ ...S.card, textAlign: "center", padding: 48, border: "1px dashed #333" }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>📂</div>
                <p style={{ color: "#888", marginBottom: 20, fontSize: 16 }}>Koi notes nahi hai abhi. PDF upload karo!</p>
                <button style={S.btn("primary")} onClick={() => setView("upload")}>Upload First PDF →</button>
              </div>
            )}
          </>
        )}

        {/* PRACTICE */}
        {view === "practice" && (
          <>
            <h2 style={S.h2}>🎯 Practice Session</h2>
            <div style={S.card}>
              <h3 style={S.h3}>Filters</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 6 }}>PDF</label>
                  <select style={S.input} value={filterPDF} onChange={e => setFilterPDF(e.target.value)}>
                    <option value="all">All PDFs</option>
                    {appData.pdfs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 6 }}>Topic</label>
                  <select style={S.input} value={filterTopic} onChange={e => setFilterTopic(e.target.value)}>
                    <option value="all">All Topics</option>
                    {allTopics.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={S.grid}>
              {[
                { title: "Due Flashcards", desc: "Cards due for review today (Spaced Repetition)", icon: "🗂", mode: "flashcard", filter: "due", count: dueCards, color: "#e2c97e" },
                { title: "All Flashcards", desc: "Practice all your notes anytime", icon: "📝", mode: "flashcard", filter: "all", count: appData.cards.length, color: "#3498db" },
                { title: "Due MCQs", desc: "UPSC-style questions due today", icon: "🎯", mode: "mcq", filter: "due", count: dueMCQs, color: "#27ae60" },
                { title: "All MCQs", desc: "Full MCQ bank — all questions", icon: "✅", mode: "mcq", filter: "all", count: appData.mcqs.length, color: "#9b59b6" },
                { title: "Weak Flashcards", desc: "Cards you got wrong or skipped", icon: "⚠", mode: "flashcard", filter: "weak", count: appData.cards.filter(c => c.wrongCount > 0 || c.skippedCount > 0).length, color: "#c0392b" },
                { title: "Weak MCQs", desc: "MCQs you got wrong or skipped", icon: "🔄", mode: "mcq", filter: "weak", count: appData.mcqs.filter(c => c.wrongCount > 0 || c.skippedCount > 0).length, color: "#e67e22" },
              ].map(item => (
                <div key={item.title} onClick={() => startQuiz(item.mode, item.filter)}
                  style={{ ...S.card, cursor: "pointer", borderTop: `3px solid ${item.color}`, transition: "transform 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "none"}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{item.icon}</div>
                  <h3 style={{ color: item.color, marginBottom: 6, fontSize: 15 }}>{item.title}</h3>
                  <p style={{ color: "#888", fontSize: 13, marginBottom: 10, lineHeight: 1.5 }}>{item.desc}</p>
                  <span style={S.badge(item.color)}>{item.count} cards</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* WEAK TOPICS */}
        {view === "weak" && (
          <>
            <h2 style={S.h2}>⚠ Weak Topics Dashboard</h2>
            {Object.entries(topicStats).filter(([_, s]) => s.wrong > 0 || s.skipped > 0).length === 0 ? (
              <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                <p style={{ color: "#27ae60", fontSize: 16 }}>Koi weak topic nahi! Keep practicing.</p>
              </div>
            ) : (
              Object.entries(topicStats).filter(([_, s]) => s.wrong > 0 || s.skipped > 0)
                .sort((a, b) => (b[1].wrong + b[1].skipped) - (a[1].wrong + a[1].skipped))
                .map(([topic, stats]) => {
                  const errorRate = Math.round(((stats.wrong + stats.skipped) / stats.total) * 100);
                  const color = errorRate > 60 ? "#c0392b" : errorRate > 30 ? "#e67e22" : "#e2c97e";
                  return (
                    <div key={topic} style={S.card}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                        <h3 style={{ color: "#e8e0d0", margin: 0, fontSize: 17 }}>{topic}</h3>
                        <span style={S.badge(color)}>{errorRate}% error rate</span>
                      </div>
                      <div style={{ display: "flex", gap: 20, fontSize: 14, color: "#888", marginBottom: 12 }}>
                        <span>❌ {stats.wrong} wrong</span>
                        <span>⏭ {stats.skipped} skipped</span>
                        <span>📊 {stats.total} total</span>
                      </div>
                      <div style={{ height: 6, background: "#1a1a2e", borderRadius: 3, marginBottom: 14, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: (100 - errorRate) + "%", background: color, borderRadius: 3 }} />
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button style={{ ...S.btn("primary"), padding: "8px 16px", fontSize: 13 }} onClick={() => { setFilterTopic(topic); startQuiz("flashcard", "weak", "all", topic); }}>Revise Flashcards</button>
                        <button style={{ ...S.btn("ghost"), padding: "8px 16px", fontSize: 13 }} onClick={() => { setFilterTopic(topic); startQuiz("mcq", "weak", "all", topic); }}>Revise MCQs</button>
                      </div>
                    </div>
                  );
                })
            )}
          </>
        )}

        {/* PROGRESS */}
        {view === "progress" && (
          <>
            <h2 style={S.h2}>📊 Progress & History</h2>
            <div style={S.grid}>
              {[
                { label: "Total Flashcards", value: appData.cards.length, color: "#e2c97e" },
                { label: "Total MCQs", value: appData.mcqs.length, color: "#3498db" },
                { label: "Sessions Done", value: appData.sessions.length, color: "#27ae60" },
                { label: "🔥 Day Streak", value: appData.streak, color: "#e67e22" },
              ].map(s => (
                <div key={s.label} style={{ ...S.statCard, borderBottom: `3px solid ${s.color}` }}>
                  <div style={{ fontSize: 32, color: s.color, fontWeight: "bold" }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: "#888", marginTop: 6 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ ...S.card, marginTop: 4 }}>
              <h3 style={S.h3}>Topic Mastery</h3>
              {Object.entries(topicStats).length === 0 && <p style={{ color: "#888", fontSize: 14 }}>Practice karo — phir stats dikhenge!</p>}
              {Object.entries(topicStats).map(([topic, stats]) => {
                const accuracy = stats.wrong === 0 ? 100 : Math.round(((stats.total - stats.wrong) / stats.total) * 100);
                const color = accuracy > 70 ? "#27ae60" : accuracy > 40 ? "#e67e22" : "#c0392b";
                return (
                  <div key={topic} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6 }}>
                      <span style={{ color: "#e8e0d0" }}>{topic}</span>
                      <span style={{ color }}>{accuracy}%</span>
                    </div>
                    <div style={{ height: 6, background: "#1a1a2e", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: accuracy + "%", background: color, borderRadius: 3, transition: "width 0.5s" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={S.card}>
              <h3 style={S.h3}>Recent Sessions</h3>
              {appData.sessions.length === 0 && <p style={{ color: "#888", fontSize: 14 }}>Koi session complete nahi hua abhi tak.</p>}
              {appData.sessions.slice(0, 15).map((s, i) => {
                const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #1a1a2e", fontSize: 14, flexWrap: "wrap", gap: 8 }}>
                    <span style={{ color: "#888" }}>{new Date(s.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}</span>
                    <span style={{ color: "#888" }}>{s.mode === "flashcard" ? "Flashcards" : "MCQs"}</span>
                    <span style={{ color: "#888" }}>{s.total} cards</span>
                    <span style={{ color: "#27ae60" }}>✓ {s.correct}</span>
                    <span style={{ color: "#c0392b" }}>✗ {s.wrong}</span>
                    <span style={{ color: pct >= 70 ? "#27ae60" : pct >= 40 ? "#e67e22" : "#c0392b", fontWeight: "bold" }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* UPLOAD */}
        {view === "upload" && (
          <>
            <h2 style={S.h2}>📤 Upload Study Material</h2>
            <div style={{ ...S.card, textAlign: "center", padding: 48 }}>
              {uploading ? (
                <div>
                  <div style={{ fontSize: 52, marginBottom: 20, animation: "pulse 1.5s infinite" }}>⚙️</div>
                  <p style={{ color: "#e2c97e", fontSize: 18, marginBottom: 10 }}>AI Processing your notes...</p>
                  <p style={{ color: "#888", fontSize: 15 }}>{uploadProgress}</p>
                  <div style={{ height: 6, background: "#1a1a2e", borderRadius: 3, marginTop: 24, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: "70%", background: "linear-gradient(90deg, #e2c97e, #c4a84f)", borderRadius: 3, animation: "pulse 1.5s infinite" }} />
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 56, marginBottom: 20 }}>📄</div>
                  <p style={{ color: "#e8e0d0", fontSize: 17, marginBottom: 10 }}>Apne UPSC notes ka PDF upload karo</p>
                  <p style={{ color: "#888", fontSize: 14, marginBottom: 28, lineHeight: 1.7 }}>
                    AI automatically generate karega:<br />
                    ✅ UPSC-style flashcards &nbsp; ✅ Statement-based MCQs &nbsp; ✅ Key points
                  </p>
                  <label style={{ ...S.btn("primary"), display: "inline-block", cursor: "pointer", fontSize: 16, padding: "14px 32px" }}>
                    Choose PDF File
                    <input type="file" accept=".pdf" style={{ display: "none" }} onChange={e => e.target.files[0] && handlePDF(e.target.files[0])} />
                  </label>
                  <p style={{ color: "#444", fontSize: 12, marginTop: 16 }}>Best results: 5–50 page PDFs</p>
                </>
              )}
            </div>

            {appData.pdfs.length > 0 && (
              <div style={S.card}>
                <h3 style={S.h3}>Uploaded PDFs ({appData.pdfs.length})</h3>
                {appData.pdfs.map(pdf => (
                  <div key={pdf.id} style={{ padding: "12px 0", borderBottom: "1px solid #1a1a2e" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div>
                        <p style={{ color: "#e2c97e", marginBottom: 4 }}>📄 {pdf.name}</p>
                        <p style={{ color: "#888", fontSize: 12 }}>{pdf.topic} • {pdf.cardCount} flashcards • {pdf.mcqCount} MCQs • {new Date(pdf.uploadedAt).toLocaleDateString("en-IN")}</p>
                      </div>
                      <button style={{ ...S.btn("ghost"), padding: "6px 12px", fontSize: 12, color: "#c0392b", borderColor: "#c0392b44", flexShrink: 0 }} onClick={() => deletePDF(pdf.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Toast({ toast }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: toast.type === "error" ? "#c0392b" : "#27ae60",
      color: "#fff", borderRadius: 10, padding: "14px 28px", fontSize: 14,
      zIndex: 9999, boxShadow: "0 4px 24px rgba(0,0,0,0.5)", maxWidth: "90vw", textAlign: "center",
      animation: "slideUp 0.3s ease"
    }}>
      {toast.msg}
    </div>
  );
}
