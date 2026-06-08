export async function POST(request) {
  try {
    const { base64, mimeType } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              { text: "Extract all text content from this PDF. Return only the raw text, preserve structure and headings." }
            ]
          }]
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return Response.json({ success: true, text });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
