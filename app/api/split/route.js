import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text prompt is required.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      const amountMatch = text.match(/\d[\d,]*(\.\d+)?/);
      const amount = amountMatch ? Number(amountMatch[0].replace(/,/g, '')) : 0;
      return NextResponse.json({
        items: [
          {
            name: text.replace(/\d[\d,]*(\.\d+)?/, '').trim() || 'Expense',
            amount,
            paidBy: 'You',
            emoji: '🧾',
          },
        ],
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are an expense parser for a group expense sharing app.
Analyze the user's sentence:
"${text}"

Extract all expenses mentioned. A sentence may describe ONE expense or MULTIPLE expenses by different people (e.g., "Aisha paid 300 for food and Raj paid 400 for food").

Return ONLY a strict JSON object with an "items" array, where each item has:
- "name": concise description (e.g., "Food", "Cab", "Dinner")
- "amount": numeric amount paid (e.g., 400)
- "paidBy": name of the person who paid (e.g., "Aisha", "Raj", or "You" if self/unspecified)
- "emoji": a single relevant emoji character (e.g. 🍕, 🚕, 🍽️)

Example:
{
  "items": [
    { "name": "Food", "amount": 300, "paidBy": "Aisha", "emoji": "🍱" },
    { "name": "Food", "amount": 400, "paidBy": "Raj", "emoji": "🍱" }
  ]
}

Return ONLY JSON. No markdown fences.`;

    // Try primary and fallback models to guarantee responses even during high traffic spikes
    const modelCandidates = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.8-flash'];
    let response = null;
    let lastError = null;

    for (const model of modelCandidates) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });
        if (response && response.text) break;
      } catch (err) {
        lastError = err;
        console.warn(`Model ${model} failed, trying next...:`, err.message);
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error('All AI models unavailable');
    }

    const rawOutput = response.text?.trim() || '{}';
    const cleanJson = rawOutput
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const parsed = JSON.parse(cleanJson);

    let items = [];
    if (Array.isArray(parsed.items)) {
      items = parsed.items;
    } else if (Array.isArray(parsed)) {
      items = parsed;
    } else if (parsed.name || parsed.description || parsed.amount) {
      items = [parsed];
    }

    const formattedItems = items.map((item) => ({
      name: String(item.name || item.description || 'Expense').trim(),
      amount: Number(item.amount || 0),
      paidBy: String(item.paidBy || 'You').trim(),
      emoji: item.emoji || '🧾',
    }));

    return NextResponse.json({ items: formattedItems });
  } catch (error) {
    console.error('API /api/split error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to parse expense' },
      { status: 500 }
    );
  }
}
