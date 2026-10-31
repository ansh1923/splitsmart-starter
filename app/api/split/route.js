import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

// Robust rule-based fallback that understands human sentences even when offline
function parseHumanFallback(text) {
  const t = text.toLowerCase();
  
  // 1. Extract total amount
  const amountMatch = t.match(/(?:for|rs\.?|inr|₹|\$)?\s*(\d[\d,]*(\.\d+)?)/i);
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : 0;

  // 2. Count people
  let people = 1;
  const friendsMatch = t.match(/(\d+)\s+friends?/i);
  const betweenMatch = t.match(/(?:between|among)\s+(\d+)/i);

  if (friendsMatch) {
    // "with 2 friends" means speaker + 2 = 3 people
    people = Number(friendsMatch[1]) + 1;
  } else if (betweenMatch) {
    people = Number(betweenMatch[1]);
  } else if (t.includes('me') && t.includes('and')) {
    // e.g. "me, raj and priya" -> count commas/and + 1
    const parts = t.split(/,|and/).map(s => s.trim()).filter(s => s.length > 0);
    if (parts.length >= 2) people = parts.length;
  }

  // 3. Extract description
  let description = 'Expense';
  if (t.includes('dinner')) description = 'Dinner';
  else if (t.includes('cab') || t.includes('taxi') || t.includes('uber')) description = 'Cab';
  else if (t.includes('coffee')) description = 'Coffee';
  else if (t.includes('pizza')) description = 'Pizza';
  else if (t.includes('food') || t.includes('lunch')) description = 'Food';
  else {
    const cleaned = text.replace(/\d[\d,]*(\.\d+)?/, '').replace(/split with.*/i, '').trim();
    if (cleaned) description = cleaned;
  }

  // 4. Emoji
  let emoji = '🧾';
  if (/dinner|food|lunch|pizza/i.test(description)) emoji = '🍽️';
  else if (/cab|taxi|uber/i.test(description)) emoji = '🚕';
  else if (/coffee|tea|cafe/i.test(description)) emoji = '☕';

  const each = Math.round((amount / people) * 100) / 100;

  return [
    {
      description,
      amount,
      people,
      each,
      paidBy: 'You',
      emoji,
    },
  ];
}

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
      return NextResponse.json({ items: parseHumanFallback(text) });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are an expert expense parser for an expense sharing app.
Analyze the user's sentence:
"${text}"

Task:
Understand messy, natural human statements and extract the structured expense split.

Human language rules to follow strictly:
1. People count:
   - "me, raj and priya" = 3 people (me + raj + priya)
   - "split with 2 friends" = 3 people (speaker + 2 friends)
   - "coffee 300, just me" = 1 person
   - "split between 4 people" = 4 people
   - If unspecified = 1 person
2. Calculations:
   - amount: total bill amount as a number
   - people: total count of people sharing
   - each: amount divided by people (rounded to 2 decimal places)
   - description: short title of item (e.g. "Dinner", "Cab", "Coffee")
   - paidBy: person who paid (default "You" if speaker paid or unspecified)
   - emoji: matching emoji (e.g. 🍽️, 🚕, ☕, 🍕)

Return ONLY valid JSON matching this schema:
{
  "items": [
    {
      "description": "Dinner",
      "amount": 1200,
      "people": 3,
      "each": 400,
      "paidBy": "You",
      "emoji": "🍽️"
    }
  ]
}`;

    const modelCandidates = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.8-flash'];
    let response = null;

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
        console.warn(`Model ${model} issue:`, err.message);
      }
    }

    if (!response || !response.text) {
      return NextResponse.json({ items: parseHumanFallback(text) });
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
    } else if (parsed.amount || parsed.description) {
      items = [parsed];
    }

    if (items.length === 0) {
      items = parseHumanFallback(text);
    }

    const formattedItems = items.map((item) => {
      const amount = Number(item.amount || 0);
      const people = Math.max(1, Number(item.people || 1));
      const each = Number(
        item.each != null ? item.each : Math.round((amount / people) * 100) / 100
      );
      return {
        description: String(item.description || item.name || 'Expense').trim(),
        amount,
        people,
        each,
        paidBy: String(item.paidBy || 'You').trim(),
        emoji: item.emoji || '🧾',
      };
    });

    return NextResponse.json({ items: formattedItems });
  } catch (error) {
    console.error('API /api/split error:', error);
    return NextResponse.json({ items: parseHumanFallback(text) });
  }
}
