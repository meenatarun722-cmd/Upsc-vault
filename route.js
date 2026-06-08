export async function POST(request) {
  try {
    const { text, pdfName } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;

    const prompt = `You are a UPSC exam expert. Analyze this content and generate study material.

Content from: "${pdfName}"
---
${text.slice(0, 12000)}
---

Generate EXACTLY this JSON structure (no markdown, no explanation, just raw JSON):
{
  "topic": "main topic name",
  "subtopics": ["subtopic1", "subtopic2"],
  "flashcards": [
    {"id": "f1", "question": "...", "answer": "...", "difficulty": "Easy|Moderate|Difficult", "subtopic": "..."},
    {"id": "f2", "question": "...", "answer": "...", "difficulty": "Easy|Moderate|Difficult", "subtopic": "..."}
  ],
  "mcqs": [
    {
      "id": "m1",
      "question": "Consider the following statements: 1. ... 2. ... Which of the above is/are correct?",
      "options": ["1 only", "2 only", "Both 1 and 2", "Neither 1 nor 2"],
      "correct": 0,
      "explanation": "...",
      "difficulty": "Easy|Moderate|Difficult",
      "subtopic": "..."
    }
  ],
  "keypoints": ["point1", "point2", "point3"]
}

Generate at least 10 flashcards and 8 MCQs. Make MCQs in UPSC Prelims style (statement-based). Be thorough and exam-focused.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
        })
      }
    );

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return Response.json({ success: true, data: parsed });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
