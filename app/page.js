'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

export default function Home() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMsg, setAuthMsg] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadGroups = async () => {
    try {
      setErrorMessage('');
      const { data, error } = await supabase.from('groups').select('*').order('created_at');
      if (error) throw error;
      setGroups(data || []);
      if (data && data.length) {
        setGroupId((cur) => (data.find((g) => g.id === cur) ? cur : data[0].id));
      }
    } catch (err) {
      setErrorMessage('Could not load groups: ' + (err.message || 'Check your connection.'));
    }
  };

  useEffect(() => {
    if (session) {
      loadGroups();
    } else {
      setGroups([]);
      setGroupId('');
    }
  }, [session]);

  useEffect(() => {
    if (!session || !groupId) {
      setExpenses([]);
      return;
    }
    setLoadingExpenses(true);
    setErrorMessage('');
    supabase
      .from('expenses')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at')
      .then(({ data, error }) => {
        if (error) {
          setErrorMessage('Could not load expenses: ' + error.message);
        } else {
          setExpenses(data || []);
        }
      })
      .catch((err) => {
        setErrorMessage('Failed to fetch expenses: ' + err.message);
      })
      .finally(() => {
        setLoadingExpenses(false);
      });
  }, [session, groupId]);

  const signUp = async () => {
    setAuthMsg('');
    const { error } = await supabase.auth.signUp({ email, password });
    setAuthMsg(error ? error.message : 'Account created — you are signed in!');
  };

  const signIn = async () => {
    setAuthMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthMsg(error.message);
  };

  const signOut = () => supabase.auth.signOut();

  const createGroup = async () => {
    const name = prompt('Name your group (e.g. Goa Trip):');
    if (!name || !name.trim()) return;
    setErrorMessage('');
    try {
      const { data: g, error } = await supabase
        .from('groups')
        .insert({ name: name.trim(), created_by: session.user.id })
        .select()
        .single();
      if (error) throw error;
      await supabase.from('group_members').insert({ group_id: g.id, user_id: session.user.id });
      await loadGroups();
      setGroupId(g.id);
    } catch (err) {
      setErrorMessage('Group creation failed: ' + err.message);
    }
  };

  const joinGroup = async () => {
    const code = prompt('Enter the 6-character group code:');
    if (!code || !code.trim()) return;
    setErrorMessage('');
    try {
      const { data, error } = await supabase.rpc('join_group', { code: code.trim() });
      if (error) throw error;
      await loadGroups();
      setGroupId(data);
    } catch (err) {
      setErrorMessage('Could not join group: ' + err.message);
    }
  };

  const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const currentGroup = groups.find((g) => g.id === groupId);

  const addExpense = async () => {
    const t = text.trim();
    if (!t || !groupId || submitting) return;
    setSubmitting(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: t, text: t }),
      });
      const data = await res.json();
      if (data.error) {
        setErrorMessage('AI Error: ' + data.error);
        return;
      }

      const description = data.description || (data.items && data.items[0]?.description) || t;
      const amount = data.amount ?? (data.items && data.items[0]?.amount) ?? 0;
      const emoji = data.emoji || (data.items && data.items[0]?.emoji) || '🧾';
      const paidBy = data.paidBy || (data.items && data.items[0]?.paidBy) || 'You';

      const { data: rows, error } = await supabase
        .from('expenses')
        .insert({
          user_id: session.user.id,
          group_id: groupId,
          name: description,
          paid_by: paidBy,
          amount: amount,
          emoji: emoji,
        })
        .select();

      if (error) {
        setErrorMessage('Save error: ' + error.message);
        return;
      }
      setExpenses((list) => [...list, rows[0]]);
      setText('');
    } catch (e) {
      setErrorMessage('Could not add expense: ' + (e.message || 'Network error'));
    } finally {
      setSubmitting(false);
    }
  };

  const removeExpense = async (id) => {
    try {
      await supabase.from('expenses').delete().eq('id', id);
      setExpenses((list) => list.filter((e) => e.id !== id));
    } catch (err) {
      setErrorMessage('Could not delete expense: ' + err.message);
    }
  };

  if (checking) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 30 }}>
            <span className="spinner-dark" />
            <span style={{ fontWeight: 700, fontSize: 16 }}>Loading Ansh TTMM SplitSmart…</span>
          </div>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <div style={styles.header}>
            <div style={styles.brand}>
              <div style={styles.logo}>⚖️</div>
              <div style={styles.titleWrap}>
                <div style={styles.title}>Ansh TTMM</div>
                <div style={styles.subTitle}>SplitSmart</div>
              </div>
            </div>
          </div>
          <p style={{ color: '#4b5563', fontSize: 14, marginBottom: 18, lineHeight: 1.4 }}>
            Sign in to access your TTMM groups on any phone or device.
          </p>
          <input
            style={styles.input2}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            autoComplete="email"
          />
          <input
            style={styles.input2}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (6+ characters)"
            autoComplete="current-password"
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={styles.authBtn} onClick={signUp}>Sign up</button>
            <button style={styles.authBtnAlt} onClick={signIn}>Sign in</button>
          </div>
          {authMsg && (
            <div style={styles.msgBanner}>{authMsg}</div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.brand}>
            <div style={styles.logo}>⚖️</div>
            <div style={styles.titleWrap}>
              <div style={styles.title}>Ansh TTMM</div>
              <div style={styles.subTitle}>SplitSmart</div>
            </div>
          </div>
          <button style={styles.signout} onClick={signOut}>Sign out</button>
        </div>

        {/* Group Selector Bar */}
        <div style={styles.groupBar}>
          <select
            style={styles.select}
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            {groups.length === 0 && <option value="">No groups yet</option>}
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button style={styles.gbtn} onClick={createGroup} title="Create group">+ New</button>
          <button style={styles.gbtn} onClick={joinGroup} title="Join with code">Join</button>
        </div>

        {currentGroup && (
          <div style={styles.codeLine}>
            Invite Code: <b style={styles.codeHighlight}>{currentGroup.join_code}</b>
          </div>
        )}

        {/* Friendly Error Banner */}
        {errorMessage && (
          <div style={styles.errorBanner}>
            <span>⚠️ {errorMessage}</span>
            <button style={styles.errorDismiss} onClick={() => setErrorMessage('')}>×</button>
          </div>
        )}

        {/* Main Content Area */}
        {groupId ? (
          <>
            <div style={styles.list}>
              {loadingExpenses ? (
                <div style={styles.loadingBox}>
                  <span className="spinner-dark" />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#4b5563' }}>
                    Loading expenses…
                  </span>
                </div>
              ) : expenses.length === 0 ? (
                <div style={styles.emptyCard}>
                  <div style={styles.emptyIcon}>💸</div>
                  <div style={styles.emptyTitle}>No expenses recorded yet</div>
                  <div style={styles.emptySub}>
                    Be the first to split something! Type a sentence below and tap <b>+</b>.
                  </div>
                </div>
              ) : (
                expenses.map((e) => (
                  <div key={e.id} style={styles.item}>
                    <div style={styles.itemEmoji}>{e.emoji || '🧾'}</div>
                    <div style={styles.itemMain}>
                      <div style={styles.itemName}>{e.name}</div>
                      <div style={styles.itemPaid}>paid by {e.paid_by || 'You'}</div>
                    </div>
                    <div style={styles.itemAmount}>{inr(e.amount)}</div>
                    <button
                      style={styles.remove}
                      onClick={() => removeExpense(e.id)}
                      title="Delete expense"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>

            {expenses.length > 0 && (
              <div style={styles.totalRow}>
                <span style={styles.totalLabel}>Group Total:</span>
                <span style={styles.totalAmount}>{inr(total)}</span>
              </div>
            )}
          </>
        ) : (
          <div style={styles.emptyCard}>
            <div style={styles.emptyIcon}>👥</div>
            <div style={styles.emptyTitle}>Select or Create a Group</div>
            <div style={styles.emptySub}>
              Tap <b>+ New</b> to make a new TTMM group, or <b>Join</b> to join a friend's group.
            </div>
          </div>
        )}
      </div>

      {/* Pinned Mobile-First Bottom Bar */}
      {groupId && (
        <div style={styles.bottomBar}>
          <div style={styles.bottomBarInner}>
            <input
              style={styles.bottomInput}
              value={text}
              disabled={submitting}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addExpense()}
              placeholder={submitting ? 'AI is thinking & recording…' : 'e.g. Ansh paid ₹600 for pizza'}
            />
            <button
              style={{
                ...styles.bottomBtn,
                ...(submitting ? styles.bottomBtnDisabled : {}),
              }}
              onClick={addExpense}
              disabled={submitting}
              aria-label="Add expense"
            >
              {submitting ? (
                <span className="spinner" />
              ) : (
                <span style={{ fontSize: 26, lineHeight: 1 }}>+</span>
              )}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px 12px 100px', // Extra bottom space so bottom bar never covers items
    boxSizing: 'border-box',
    overflowX: 'hidden',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    background: '#ffffff',
    borderRadius: 20,
    boxShadow: '0 12px 36px -12px rgba(13,27,62,0.25)',
    border: '2px solid #0b0b14',
    padding: '18px 16px',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 44,
    height: 44,
    minWidth: 44,
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    fontSize: 22,
    background: '#ffe600',
    border: '2px solid #000',
    boxShadow: '2px 2px 0px #000',
  },
  titleWrap: {
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontSize: 18,
    fontWeight: 900,
    lineHeight: 1.15,
    color: '#0b0b14',
    letterSpacing: '-0.3px',
  },
  subTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#ff007f',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  signout: {
    minHeight: 44,
    border: '2px solid #0b0b14',
    background: '#f3f4f6',
    borderRadius: 12,
    padding: '0 14px',
    fontSize: 13.5,
    fontWeight: 800,
    color: '#0b0b14',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  groupBar: {
    display: 'flex',
    gap: 8,
    marginBottom: 8,
  },
  select: {
    flex: 1,
    minHeight: 44,
    border: '2px solid #0b0b14',
    borderRadius: 12,
    padding: '0 12px',
    fontSize: 14.5,
    fontWeight: 700,
    background: '#f9fafb',
    color: '#0b0b14',
    outline: 'none',
  },
  gbtn: {
    flex: 'none',
    minHeight: 44,
    minWidth: 54,
    border: '2px solid #0b0b14',
    background: '#ffe600',
    borderRadius: 12,
    padding: '0 12px',
    fontSize: 13.5,
    fontWeight: 800,
    color: '#0b0b14',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '2px 2px 0px #000',
  },
  codeLine: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 14,
    padding: '6px 10px',
    background: '#f3f4f6',
    borderRadius: 8,
    display: 'inline-block',
  },
  codeHighlight: {
    color: '#7928ca',
    letterSpacing: '1px',
    fontFamily: 'monospace',
    fontSize: 14,
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: '#fee2e2',
    border: '1.5px solid #ef4444',
    borderRadius: 12,
    color: '#991b1b',
    fontSize: 13.5,
    fontWeight: 600,
    marginBottom: 14,
  },
  errorDismiss: {
    background: 'none',
    border: 'none',
    fontSize: 20,
    color: '#991b1b',
    cursor: 'pointer',
    padding: '0 4px',
  },
  msgBanner: {
    marginTop: 14,
    padding: '10px 14px',
    background: '#dbeafe',
    border: '1.5px solid #3b82f6',
    borderRadius: 12,
    fontSize: 13.5,
    fontWeight: 600,
    color: '#1e40af',
  },
  input2: {
    width: '100%',
    minHeight: 48,
    border: '2px solid #0b0b14',
    borderRadius: 12,
    padding: '0 14px',
    fontSize: 15,
    outline: 'none',
    background: '#f9fafb',
    marginBottom: 12,
    boxSizing: 'border-box',
  },
  authBtn: {
    flex: 1,
    minHeight: 48,
    border: '2px solid #000',
    borderRadius: 12,
    color: '#000',
    fontSize: 15,
    fontWeight: 800,
    background: '#a3ff12',
    cursor: 'pointer',
    boxShadow: '3px 3px 0px #000',
  },
  authBtnAlt: {
    flex: 1,
    minHeight: 48,
    border: '2px solid #000',
    borderRadius: 12,
    color: '#000',
    fontSize: 15,
    fontWeight: 800,
    background: '#ffe600',
    cursor: 'pointer',
    boxShadow: '3px 3px 0px #000',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minHeight: 80,
  },
  loadingBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '30px 0',
  },
  emptyCard: {
    textAlign: 'center',
    padding: '28px 16px',
    background: '#f9fafb',
    borderRadius: 16,
    border: '1.5px dashed #d1d5db',
  },
  emptyIcon: {
    fontSize: 34,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: '#111827',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 1.4,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: '#f9fafb',
    border: '2px solid #0b0b14',
    borderRadius: 16,
    padding: '10px 12px',
    boxShadow: '2px 2px 0px #0b0b14',
  },
  itemEmoji: {
    width: 44,
    height: 44,
    minWidth: 44,
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    background: '#ffffff',
    border: '2px solid #0b0b14',
    fontSize: 20,
    flex: 'none',
  },
  itemMain: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontWeight: 800,
    fontSize: 15,
    color: '#0b0b14',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemPaid: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
    fontWeight: 600,
  },
  itemAmount: {
    fontWeight: 900,
    fontSize: 16,
    color: '#0b0b14',
  },
  remove: {
    flex: 'none',
    width: 44,
    height: 44,
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    color: '#9ca3af',
    fontSize: 22,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 14,
    borderTop: '2px dashed #e5e7eb',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: 800,
    color: '#4b5563',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 900,
    color: '#0b0b14',
  },
  bottomBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'rgba(255, 255, 255, 0.96)',
    backdropFilter: 'blur(10px)',
    borderTop: '2px solid #0b0b14',
    padding: '10px 14px calc(10px + env(safe-area-inset-bottom, 0px))',
    boxShadow: '0 -6px 20px rgba(0, 0, 0, 0.08)',
    zIndex: 100,
    display: 'flex',
    justifyContent: 'center',
  },
  bottomBarInner: {
    width: '100%',
    maxWidth: 480,
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  bottomInput: {
    flex: 1,
    minHeight: 48,
    border: '2px solid #0b0b14',
    borderRadius: 14,
    padding: '0 14px',
    fontSize: 14.5,
    outline: 'none',
    background: '#f9fafb',
    color: '#0b0b14',
    boxSizing: 'border-box',
  },
  bottomBtn: {
    flex: 'none',
    width: 48,
    height: 48,
    minWidth: 48,
    borderRadius: 14,
    border: '2px solid #000',
    color: '#fff',
    background: '#7928ca',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '2px 2px 0px #000',
    transition: 'all 0.15s ease',
  },
  bottomBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
    transform: 'none !important',
  },
};
