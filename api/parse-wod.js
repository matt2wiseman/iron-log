export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY is not set. Add it in Vercel > Project Settings > Environment Variables, then redeploy.",
    });
  }

  const { rawText } = req.body || {};
  if (!rawText || !String(rawText).trim()) {
    return res.status(400).json({ error: "No workout text provided." });
  }

  const prompt = `Parse this CrossFit-style workout into JSON only. No markdown fences, no preamble, no commentary — return only a raw JSON object matching this schema exactly:
{"title": string, "format": string (e.g. "For Time", "AMRAP 20", "EMOM 12", "5 Rounds"), "timeCap": string or null, "movements": [{"name": string, "scheme": string}], "notes": string or null}

Workout text:
"""
${rawText}
"""`;

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return res.status(502).json({ error: "Upstream API error", detail });
    }

    const data = await upstream.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const cleaned = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(422).json({ error: "Could not parse model output as JSON." });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: "Request failed", detail: String(err) });
  }
}
