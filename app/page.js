'use client';

import { useEffect, useState } from 'react';

const SEED = [
  { id: 'seed-1', emoji: '🍕', name: 'Late night pizza binge', paidBy: 'Aisha', amount: 1800 },
  { id: 'seed-2', emoji: '🚖', name: 'Uber ride (no split no party)', paidBy: 'Raj', amount: 400 },
  { id: 'seed-3', emoji: '🧋', name: 'Boba drip check', paidBy: 'You', amount: 350 },
];

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

function parseExpense(text) {
  const amountMatch = text.match(/\d[\d,]*(\.\d+)?/);
  const amount = amountMatch ? Number(amountMatch[0].replace(/,/g, '')) : 0;
  const name = text.replace(/\d[\d,]*(\.\d+)?/, '').replace(/\s+/g, ' ').trim() || 'Vibe Check Expense';
  const emojis = ['⚡', '💸', '🔥', '✨', '🍟', '🥤', '🎮', '💅'];
  const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
  return { id: 'e-' + Date.now(), emoji: randomEmoji, name: name.charAt(0).toUpperCase() + name.slice(1), paidBy: 'You', amount };
}

export default function Home() {
  const [expenses, setExpenses] = useState(SEED);
  const [text, setText] = useState('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('splitsmart.expenses');
      if (saved) setExpenses(JSON.parse(saved));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) {
      try { localStorage.setItem('splitsmart.expenses', JSON.stringify(expenses)); } catch {}
    }
  }, [expenses, ready]);

  const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const addExpense = async () => {
    const t = text.trim();
    if (!t || loading) return;

    setLoading(true);
    try {
      const res = await fetch('/api/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t }),
      });

      if (!res.ok) throw new Error('Failed to parse with AI');

      const data = await res.json();
      
      if (Array.isArray(data.items) && data.items.length > 0) {
        const newItems = data.items.map((item, idx) => ({
          id: 'e-' + Date.now() + '-' + idx,
          emoji: item.emoji || '🧾',
          name: item.name ? item.name.charAt(0).toUpperCase() + item.name.slice(1) : 'Expense',
          paidBy: item.paidBy || 'You',
          amount: Number(item.amount || 0),
        }));
        setExpenses((list) => [...list, ...newItems]);
      } else if (data.description || data.amount) {
        const newExpense = {
          id: 'e-' + Date.now(),
          emoji: '🧾',
          name: data.description ? data.description.charAt(0).toUpperCase() + data.description.slice(1) : t,
          paidBy: data.paidBy || (data.people > 1 ? `You (${data.people} ways: ${inr(data.each)} ea)` : 'You'),
          amount: Number(data.amount || 0),
        };
        setExpenses((list) => [...list, newExpense]);
      }
      setText('');
    } catch (err) {
      console.warn('AI parse failed, using fallback:', err);
      setExpenses((list) => [...list, parseExpense(t)]);
      setText('');
    } finally {
      setLoading(false);
    }
  };

  const removeExpense = (id) => setExpenses((list) => list.filter((e) => e.id !== id));

  return (
    <main style={styles.page}>
      {/* Top Banner Tag */}
      <div style={styles.topBadge}>
        <span>🔥 NO CAP EXPENSE MANAGER 🔥</span>
      </div>

      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.brand}>
            <div style={styles.logo}>💥</div>
            <h1 style={styles.title}>Ansh&apos;s Tu Tera Main Mera Expense Tracker</h1>
          </div>
          <div style={styles.groupPill}>✨ Da Squad ✨</div>
        </div>

        {/* Input Bar */}
        <div style={styles.addRow}>
          <input
            style={styles.input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addExpense()}
            placeholder={loading ? 'Gemini AI is cooking... 🤖' : 'Drop expense e.g. Dinner 1200 split with 3... 👀'}
            disabled={loading}
            aria-label="Add an expense"
          />
          <button
            style={{
              ...styles.addBtn,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
            onClick={addExpense}
            disabled={loading}
            aria-label="Understand Statement"
          >
            {loading ? 'AI Thinking... ✨' : 'Understand Statement ⚡'}
          </button>
        </div>

        {/* Expense list */}
        <div style={styles.list}>
          {expenses.length === 0 && (
            <div style={styles.empty}>
              Ghost town fr 💀 Add some bills above!
            </div>
          )}
          {expenses.map((e) => (
            <div key={e.id} style={styles.item}>
              <div style={styles.itemEmoji}>{e.emoji}</div>
              <div style={styles.itemMain}>
                <div style={styles.itemName}>{e.name}</div>
                <div style={styles.itemPaid}>
                  paid by <span style={styles.paidHighlight}>{e.paidBy}</span>
                </div>
              </div>
              <div style={styles.itemAmount}>{inr(e.amount)}</div>
              <button
                style={styles.remove}
                onClick={() => removeExpense(e.id)}
                aria-label={`Remove ${e.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Total Box */}
        <div style={styles.totalBox}>
          <span style={styles.totalLabel}>DAMAGE SO FAR 💸</span>
          <span style={styles.totalVal}>{inr(total)}</span>
        </div>
      </div>

      <p style={styles.footnote}>
        Tu Tera Main Mera · Zero drama splits only 💅<br />
        Built with high energy &amp; pure vibes.
      </p>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '32px 16px 56px',
  },
  topBadge: {
    background: '#000',
    color: '#a3ff12',
    fontWeight: 900,
    fontSize: 13,
    letterSpacing: '0.12em',
    padding: '6px 18px',
    borderRadius: 999,
    border: '2px solid #000',
    boxShadow: '3px 3px 0px #000',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  card: {
    width: '100%',
    maxWidth: 540,
    background: '#ffffff',
    borderRadius: 24,
    border: '3px solid #000000',
    boxShadow: '8px 8px 0px #000000',
    padding: '24px 22px',
    position: 'relative',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 20,
    borderBottom: '3px dashed #000',
    paddingBottom: 18,
  },
  brand: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 14,
    display: 'grid',
    placeItems: 'center',
    fontSize: 24,
    background: '#ffe600',
    border: '3px solid #000',
    boxShadow: '3px 3px 0px #000',
    flexShrink: 0,
    transform: 'rotate(-4deg)',
  },
  title: {
    fontSize: 24,
    fontWeight: 900,
    color: '#ff2247',
    margin: 0,
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
    textTransform: 'uppercase',
    textShadow: '1px 1px 0px #000',
  },
  groupPill: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: 900,
    color: '#000',
    background: '#a3ff12',
    padding: '6px 14px',
    borderRadius: 999,
    border: '2px solid #000',
    boxShadow: '2px 2px 0px #000',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  addRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 20,
  },
  input: {
    width: '100%',
    border: '3px solid #000000',
    borderRadius: 16,
    padding: '14px 16px',
    fontSize: 15,
    fontWeight: 700,
    outline: 'none',
    background: '#fff',
    color: '#000',
    boxShadow: '3px 3px 0px #000',
    boxSizing: 'border-box',
  },
  addBtn: {
    width: '100%',
    padding: '14px 20px',
    borderRadius: 16,
    border: '3px solid #000000',
    color: '#000',
    fontSize: 15,
    fontWeight: 900,
    background: '#ffe600',
    boxShadow: '4px 4px 0px #000000',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    minHeight: 60,
  },
  empty: {
    color: '#000',
    fontWeight: 800,
    fontSize: 15,
    textAlign: 'center',
    padding: '30px 12px',
    background: '#f4f4f4',
    border: '2px dashed #000',
    borderRadius: 16,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: '#ffffff',
    border: '3px solid #000000',
    borderRadius: 18,
    padding: '12px 14px',
    boxShadow: '4px 4px 0px #000000',
    transition: 'transform 0.15s ease',
  },
  itemEmoji: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    background: '#ffd6e0',
    border: '2px solid #000',
    fontSize: 22,
    flexShrink: 0,
  },
  itemMain: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontWeight: 800,
    fontSize: 15,
    color: '#000',
    lineHeight: 1.3,
  },
  itemPaid: {
    color: '#555',
    fontSize: 12,
    fontWeight: 700,
    marginTop: 2,
  },
  paidHighlight: {
    color: '#7928ca',
    fontWeight: 900,
    textDecoration: 'underline',
  },
  itemAmount: {
    fontWeight: 900,
    fontSize: 17,
    color: '#000',
    fontVariantNumeric: 'tabular-nums',
  },
  remove: {
    flex: 'none',
    width: 30,
    height: 30,
    borderRadius: 10,
    border: '2px solid #000',
    background: '#ff2a5f',
    color: '#fff',
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1,
    display: 'grid',
    placeItems: 'center',
    boxShadow: '2px 2px 0px #000',
  },
  totalBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    padding: '16px 20px',
    border: '3px solid #000000',
    borderRadius: 18,
    background: '#a3ff12',
    boxShadow: '5px 5px 0px #000000',
  },
  totalLabel: {
    fontWeight: 900,
    fontSize: 14,
    color: '#000',
    letterSpacing: '0.04em',
  },
  totalVal: {
    fontWeight: 900,
    fontSize: 22,
    color: '#000',
    fontVariantNumeric: 'tabular-nums',
  },
  footnote: {
    color: '#000',
    fontWeight: 800,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 1.6,
    marginTop: 24,
    maxWidth: 420,
    background: 'rgba(255, 255, 255, 0.85)',
    padding: '8px 16px',
    borderRadius: 12,
    border: '2px solid #000',
    boxShadow: '3px 3px 0px #000',
  },
};
