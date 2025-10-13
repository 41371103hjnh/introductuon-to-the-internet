import { GoogleGenAI } from '@google/genai';
import React, { useEffect, useMemo, useRef, useState } from 'react';

// ==== Types ====
export type Part = { text: string };
export type ChatMsg = { role: 'user' | 'model'; parts: Part[] };

export type Conversation = {
  id: string;
  title: string;
  history: ChatMsg[];
  createdAt: number;
};

// ==== Helpers ====
const uid = () => Math.random().toString(36).slice(2, 10);
const asUser  = (text: string): ChatMsg => ({ role: 'user'  as const, parts: [{ text }] });
const asModel = (text: string): ChatMsg => ({ role: 'model' as const, parts: [{ text }] });

function autoTitleFromHistory(history: ChatMsg[]): string {
  // 找出第一個使用者訊息
  const userMsg = history.find(m => m.role === 'user');

  if (!userMsg) return '新的美食';

  // 取出文字內容
  let text = userMsg.parts.map(p => p.text).join(' ');

  // 移除多餘符號與空白
  text = text
    .replace(/👋/g, '')
    .replace(/嗨+[～!！]?/g, '')
    .replace(/[#*_\-~`>]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // 限制標題長度（例如 25 字以內）
  const short = text.slice(0, 25);
  return short ? short + (text.length > 25 ? '…' : '') : '新的美食';
}

type FoodRouletteProps = {
  size?: number;            // 整體直徑 (px)
  items?: string[];         // 轉盤項目
  right?: number;           // 距右側距離
  bottom?: number;          // 距底部距離
};

function FoodRoulette({
  size = 200,
  items = [
    '拉麵', '義大利麵', '壽司', '三明治', '牛排',
    '鐵板燒', '烏龍麵', '便利商店', '蔥油餅', '火鍋',
  ],
  right = 20,
  bottom = 20,
}: FoodRouletteProps) {
  const wheelRef = React.useRef<HTMLDivElement | null>(null);
  const [spinning, setSpinning] = React.useState(false);
  const [selected, setSelected] = React.useState<string>('');

  // 幾何/比例
  const ring = Math.max(4, Math.round(size * 0.03));     // 外圈邊框
  const centerSize = Math.round(size * 0.30);            // 中心圓
  const pointerHalf = Math.max(5, Math.round(size * 0.05));
  const pointerHeight = Math.max(10, Math.round(size * 0.09));
  const R = size / 2;                                    // 外半徑
  const sectorDeg = 360 / items.length;
  const theta = (2 * Math.PI) / items.length;


  // 讓文字落在色塊內：半徑往內縮一些
  const labelRadius = R - ring - 24;          // ← 旋鈕1：覺得太靠外就+2，太靠內就-2
 const fontMax = Math.round(size * 0.08);    // ← 旋鈕2：字體上限，size=200 時約 16px

  // 字體大小（隨 size 與弦長自適應）
  const baseFont = Math.round(size * 0.06);

  // 色塊（可自行改配色）
  const colors = ['#fde68a','#bfdbfe','#fecaca','#bbf7d0','#ddd6fe'];
  const gradientStops = items
    .map((_, i) => {
      const start = i * sectorDeg;
      const end = (i + 1) * sectorDeg;
      return `${colors[i % colors.length]} ${start}deg ${end}deg`;
    })
    .join(', ');

  // 開始：進入無限旋轉
  function handleStart() {
    const el = wheelRef.current;
    if (!el || spinning) return;
    setSelected('');
    setSpinning(true);
    el.style.transition = 'none';
    el.style.animation = 'roulette-spin 900ms linear infinite';
  }

  // 停止：移除無限動畫→計算目標角度→3s 減速到位
  function handleStop() {
    const el = wheelRef.current;
    if (!el || !spinning) return;

    setSpinning(false);
    el.style.animation = 'none';

    // 隨機選一格
    const idx = Math.floor(Math.random() * items.length);

    // 0° 在上方（from -90deg），扇區中心角度：
    const targetDeg = - (idx * sectorDeg + sectorDeg / 2);

    // 多繞幾圈營造減速感
    const extraTurns = 6 * 360;
    const finalDeg = extraTurns + targetDeg;

    // 讀取目前 transform 角度，確保連續
    const cs = getComputedStyle(el).transform;
    let currentDeg = 0;
    if (cs && cs !== 'none') {
      const vals = cs.split('(')[1].split(')')[0].split(',');
      const a = parseFloat(vals[0]);
      const b = parseFloat(vals[1]);
      const rad = Math.atan2(b, a);
      currentDeg = (rad * 180) / Math.PI;
    }
    const normalized = ((currentDeg % 360) + 360) % 360;
    const deltaToTarget = (360 + ((finalDeg - normalized) % 360)) % 360;
    const absoluteFinal = currentDeg + deltaToTarget;

    // 3s 減速
    el.style.transition = 'transform 3000ms cubic-bezier(0.12, 0.6, 0.03, 1)';
    el.style.transform = `rotate(${absoluteFinal}deg)`;

    const onDone = () => {
      setSelected(items[idx]);
      el.removeEventListener('transitionend', onDone);
    };
    el.addEventListener('transitionend', onDone);
  }

  return (
    <>
      {/* 無限旋轉用 keyframes */}
      <style>{`
        @keyframes roulette-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          right,
          bottom,
          zIndex: 2147483647,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          userSelect: 'none',
        }}
      >
        {/* 容器 = size × size */}
        <div style={{ position: 'relative', width: size, height: size }}>
          {/* 指針（上方） */}
          <div
            style={{
              position: 'absolute',
              top: `-${size * 0.08}px`,  // 根據轉盤大小自動定位在邊緣上方
              left: '50%',
              transform: 'translateX(0%)',
              width: `${size * 0.015}px`,  // 指針寬度（越小越細）
              height: `${size * 0.2}px`,   // 指針長度
              backgroundColor: '#111827',  // 指針顏色
              borderRadius: `${size * 0.01}px`,
              zIndex: 3,
             boxShadow: '0 0 4px rgba(0,0,0,0.3)',
            }}
          />

          {/* 轉盤本體 */}
          <div
            ref={wheelRef}
            style={{
              position: 'absolute',
              inset: 0,
              margin: 'auto',
              width: size,
              height: size,
              borderRadius: '50%',
              border: `${ring}px solid #111827`,
              background: `conic-gradient(from -90deg, ${gradientStops})`,
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 6px 18px rgba(0,0,0,.25)',
            }}
          >
            {/* 中心圓 */}
            <div
              style={{
                width: centerSize,
                height: centerSize,
                borderRadius: '50%',
                background: '#fff',
                border: `${Math.max(2, Math.round(ring * 0.6))}px solid #111827`,
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
                fontSize: Math.max(10, Math.round(baseFont * 0.9)),
              }}
            >
              吃什麼
            </div>

            {/* 扇區文字：置中→旋轉→沿半徑推出→轉回水平；寬度限制=弦長 */}
            {items.map((label, i) => {
  // ✅ 角度統一到與背景一樣的基準：12 點方向為 0°
  const angleDeg = -90 + i * sectorDeg + sectorDeg / 2;

  // 可用寬度 = 在 labelRadius 半徑處的弦長
  const theta = (2 * Math.PI) / items.length;
  const chord = 2 * labelRadius * Math.sin(theta / 2);
  const maxW = Math.max(40, Math.floor(chord - size * 0.06));
  const fontSize = Math.max(10, Math.min(Math.round(size * 0.08), Math.floor(maxW / 6)));

  return (
    <div
      key={i}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        // ✅ 四步法：先置中 → 旋到該扇區中心角 → 沿半徑推出 → 把字轉回水平
        transform: `translate(-50%, -50%) rotate(${angleDeg}deg) translateY(-${labelRadius}px) rotate(-90deg)`,
        transformOrigin: 'center center',
        width: `${maxW}px`,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        pointerEvents: 'none',
        fontWeight: 700,
        fontSize,
        lineHeight: 1.1,
        textShadow: '0 1px 2px rgba(0,0,0,.25)',
      }}
      title={label}
    >
      {label}
    </div>
  );
})}
          </div>
        </div>

        {/* 按鈕列 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleStart}
            disabled={spinning}
            style={{
              padding: '8px 12px',
              borderRadius: 999,
              border: '1px solid #111827',
              background: '#111827',
              color: '#fff',
              cursor: spinning ? 'not-allowed' : 'pointer',
              fontSize: 14,
            }}
          >
            開始
          </button>
          <button
            type="button"
            onClick={handleStop}
            disabled={!spinning}
            style={{
              padding: '8px 12px',
              borderRadius: 999,
              border: '1px solid #111827',
              background: '#fff',
              color: '#111827',
              cursor: !spinning ? 'not-allowed' : 'pointer',
              fontSize: 14,
            }}
          >
            停止
          </button>
        </div>

        {/* 結果 */}
        <div
          style={{
            minHeight: 22,
            fontSize: 14,
            fontWeight: 700,
            color: '#111827',
          }}
        >
          {selected ? `今天吃：${selected}` : '　'}
        </div>
      </div>
    </>
  );
}




// ==== Props ====
type Props = {
  defaultModel?: string; // e.g. 'gemini-2.5-flash'
  starter?: string;
};

export default function AItest({
  defaultModel = 'gemini-2.5-flash',
  starter = '師大附近有推薦的餐廳嗎?',
}: Props) {
  // --- States ---
  const [model, setModel] = useState<string>(defaultModel);
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [rememberKey, setRememberKey] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  // Conversations (右側選單)
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  // --- Effects ---
  // Load key from localStorage (for demo only — never ship an exposed key in production)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gemini_api_key');
      if (saved) setApiKey(saved);
    } catch {}
  }, []);

  // 初始化一個對話（只跑一次，不因 starter 改變而重置）
  useEffect(() => {
    if (convs.length > 0) return;
    const first: Conversation = {
      id: uid(),
      title: '新的美食',
      history: [asModel('嗨~👋，今天又不知道要吃什麼了嗎？')],
      createdAt: Date.now(),
    };
    setConvs([first]);
    setActiveId(first.id);
    setHistory(first.history);
    if (starter) setInput(starter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auto-scroll to bottom（等排版完成再捲）
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [history, loading]);

  // --- AI Client ---
  const ai = useMemo(() => {
    try {
      return apiKey ? new GoogleGenAI({ apiKey }) : null;
    } catch {
      return null;
    }
  }, [apiKey]);

  // --- Conversation actions ---
  function startNewConversation(prefill?: string) {
    const c: Conversation = {
      id: uid(),
      title: '新的美食',
      history: [asModel('👋 開始一個新的美食旅程吧！')],
      createdAt: Date.now(),
    };
    setConvs(prev => [c, ...prev]);
    setActiveId(c.id);
    setHistory(c.history);
    setInput(prefill ?? '');
    setError('');
  }

  function switchConversation(id: string) {
    const target = convs.find(c => c.id === id);
    if (!target) return;
    setActiveId(id);
    setHistory(target.history);
    setInput('');
    setError('');
  }

  // --- Send message ---
  async function sendMessage(message?: string) {
    const content = (message ?? input).trim();
    if (!content || loading) return;
    if (!ai) { setError('請先輸入有效的 Gemini API Key'); return; }
  console.log("🔹 正在使用模型：", model);


    setError('');
    setLoading(true);

    // 使用者訊息 -> 畫面與當前對話
    const nextHistory = [...history, asUser(content)];
    setHistory(nextHistory);
    setConvs(prev => prev.map(c => c.id === activeId ? { ...c, history: nextHistory } : c));
    setInput('');

    try {
      const resp = await ai.models.generateContent({
        model,
        contents: nextHistory, // 帶上完整歷史（簡化版）
      });

      const reply =
        (resp as any)?.text ??
        (resp as any)?.output_text ??
        (resp as any)?.response?.text?.() ??
        '[No content]';

      setHistory(h => {
       const updated = [...h, asModel(String(reply))];
       const newTitle = autoTitleFromHistory(updated);
       setConvs(prev => prev.map(c =>
         c.id === activeId ? { ...c, history: updated, title: newTitle } : c
    ));
      return updated;
  });

    } catch (err: any) {
      const code = err?.status || err?.code || err?.response?.status;
      let msg = err?.message || String(err);
      if (code === 401) msg = '鑑權失敗（401）：請確認 API Key 是否正確／未過期。';
      else if (code === 403) msg = '拒絕存取（403）：此金鑰可能沒有權限。';
      else if (code === 404) msg = `模型不存在（404）：請確認模型 ID「${model}」是否有效。`;
      else if (code === 429) msg = '已達流量/速率限制（429）：請稍後再試或降低頻率。';
      else if (code >= 500 && code < 600) msg = '伺服器暫時問題（5xx）：請稍後重試。';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // --- Render helpers ---
  function renderMarkdownLike(text: string) {
    const lines = text.split(/\n/);
    return (
      <>
        {lines.map((ln, i) => (
          <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{ln}</div>
        ))}
      </>
    );
  }

  // --- UI ---
return (
  <>
    <div style={styles.wrap}>
      {/* 左：聊天主卡片 */}
      <div style={styles.card}>
  <div style={styles.header}>
    {/* 左：標題 */}
    <span style={{ fontWeight: 800, fontSize: 26 }}>美食報報🍴</span>

    {/* 右：模型選擇 + API Key 輸入 */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* 模型選單 */}
      <select
        value={model}
        onChange={(e) => setModel(e.target.value)}
        style={styles.modelSelect}
      >
        <option value="gemini-2.5-flash">gemini-2.5-flash（快速）</option>
        <option value="gemini-2.5-pro">gemini-2.5-pro（進階）</option>
      </select>

      {/* API Key 輸入框 */}
      <input
        type="password"
        value={apiKey}
        onChange={(e) => {
          const v = e.target.value;
          setApiKey(v);
          if (rememberKey) localStorage.setItem('gemini_api_key', v);
        }}
        placeholder="API Key"
        style={{
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid #d1d5db',
          fontSize: 14,
          width: 220,
        }}
      />

      {/* 記住 key 勾選 */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
        <input
          type="checkbox"
          checked={rememberKey}
          onChange={(e) => {
            setRememberKey(e.target.checked);
            if (!e.target.checked) localStorage.removeItem('gemini_api_key');
            else if (apiKey) localStorage.setItem('gemini_api_key', apiKey);
          }}
        />
        記住在本機
      </label>
    </div>
  </div>

  {/* Messages */}
  <div ref={listRef} style={styles.messages}>
    {history.map((m, idx) => (
      <div
        key={idx}
        style={{ ...styles.msg, ...(m.role === 'user' ? styles.user : styles.assistant) }}
      >
        <div style={styles.msgRole}>{m.role === 'user' ? 'You' : 'Gemini'}</div>
        <div style={styles.msgBody}>
          {renderMarkdownLike((m.parts ?? []).map((p) => p.text ?? '').join('\n'))}
        </div>
      </div>
    ))}
    {loading && (
      <div style={{ ...styles.msg, ...styles.assistant }}>
        <div style={styles.msgRole}>Gemini</div>
        <div style={styles.msgBody}>思考中…</div>
      </div>
    )}
  </div>

  {/* Error */}
  {error && <div style={styles.error}>⚠ {error}</div>}

  {/* Composer */}
  <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} style={styles.composer}>
    <input
      placeholder="輸入訊息，按 Enter 送出"
      value={input}
      onChange={(e) => setInput(e.target.value)}
      style={styles.textInput}
    />
    <button type="submit" disabled={loading || !input.trim() || !apiKey} style={styles.sendBtn}>
      送出
    </button>
  </form>

  {/* Quick examples */}
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      flexWrap: 'wrap',
      marginTop: 8,
      padding: '0 12px 12px',
    }}
  >
    <div style={{ fontWeight: 600, marginBottom: 4 }}>常見問題</div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {['台北有什麼好吃的甜點', '今天午餐要吃什麼？', '推薦好吃的早午餐店'].map((q) => (
        <button key={q} type="button" style={styles.suggestion} onClick={() => sendMessage(q)}>
          {q}
        </button>
      ))}
    </div>
  </div>

  {/* === 🍽️ 料理推薦按鈕（含圖示） === */}
   <div style={{ fontWeight: 600, marginBottom: 4 , marginLeft: 16}}>健康料理</div>
  <div
    style={{
      position: 'sticky',
      bottom: 0,
      background: '#fff',
      padding: '8px 12px 12px',
      borderTop: '1px solid #e5e7eb',
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
      zIndex: 10,
    }}
  >
    {[
      { icon: '🍅🍳', name: '番茄雞蛋麵' },
      { icon: '🥬🥚', name: '蔬菜蛋捲' },
      { icon: '🍲', name: '豬肉白菜豆腐湯' },
      { icon: '🍤🍗', name: '鮮蝦雞肉排' },
    ].map((dish) => (
      <button
        key={dish.name}
        type="button"
        style={styles.suggestion}
        onClick={() => sendMessage(`${dish.name} 的料理食譜`)}
      >
        <span style={{ marginRight: 6 }}>{dish.icon}</span>
        {dish.name}
      </button>
    ))}
  </div>
</div>


      {/* 右：對話選單 */}
      <aside style={styles.sidebar}>
        <div style={styles.sideHeader}>
          你最近搜尋的美食
          <button type="button" style={styles.newBtn} onClick={() => startNewConversation()}>
            ＋ 新增美食
          </button>
        </div>

        <div style={styles.convList}>
          {convs.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => switchConversation(c.id)}
              style={{
                ...styles.convItem,
                ...(c.id === activeId ? styles.convItemActive : null),
              }}
              title={new Date(c.createdAt).toLocaleString()}
            >
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
                {c.title || '未命名'}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7, textAlign: 'left' }}>
                {c.history[c.history.length - 1]?.parts[0]?.text?.slice(0, 24) ?? '（無訊息）'}
              </div>
            </button>
          ))}
        </div>
      </aside>
    </div>

    {/* 🍜 右下角美食轉盤（固定定位，浮在畫面上） */}
    <FoodRoulette />
  </>
);
}

// ==== Styles ====
const styles: Record<string, React.CSSProperties> = {
  // 兩欄：左主區 + 右側欄
  wrap: {
    width: '100vw',
    height: '100vh',
    display: 'grid',
    gridTemplateColumns: '1fr 300px', // 右側選單固定 300px
    gap: 16,
    background: '#98bab7ff',
    padding: 16,
    boxSizing: 'border-box',
  },

  // 左側主卡片
  card: {
  width: '100%',
  height: '90%',
  background: '#fff',
  border: '1px solid #2c4446ff',
  borderRadius: 16,
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
  overflow: 'hidden',
 },

  header: {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between', // ← 左右分佈
  padding: '12px 20px',
  fontWeight: 800,
  fontSize: '26px',
  color: '#111827',
  borderBottom: '1px solid #e5e7eb',
  background: '#ccdcdbff',
},


  controls: {
    display: 'grid',
    gap: 12,
    gridTemplateColumns: '1fr 1fr',
    padding: 12,
    borderBottom: '1px solid #e5e7eb',
    flexShrink: 0,
  },

  label: { display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 },
  input: { padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14 },

  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    background: '#fafafa',
    WebkitOverflowScrolling: 'touch',
  },

  msg: { borderRadius: 12, padding: 10, border: '1px solid #e5e7eb' },
  user: { background: '#eef2ff', borderColor: '#c7d2fe' },
  assistant: { background: '#f1f5f9', borderColor: '#e2e8f0' },
  msgRole: { fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 6 },
  msgBody: { fontSize: 14, lineHeight: 1.5 },

  error: { color: '#b91c1c', padding: '4px 12px' },

  composer: {
    padding: 12,
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 8,
    borderTop: '1px solid #e5e7eb',
    flexShrink: 0,
    background: '#fff',
  },

  textInput: { padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14 },
  sendBtn: { padding: '10px 14px', borderRadius: 999, border: '1px solid #111827', background: '#111827', color: '#fff', fontSize: 14, cursor: 'pointer' },
  suggestion: { padding: '6px 10px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontSize: 12 },

  // 右側選單
  sidebar: {
    height: '50%',
    background: '#ffffff',
    border: '1px solid #2c4446ff',
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
  },

  sideHeader: {
    padding: '12px 14px',
    borderBottom: '1px solid #2c4446ff',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#ccdcdbff',
  },

  newBtn: {
    fontSize: 12,
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid #111827',
    background: '#111827',
    color: '#fff',
    cursor: 'pointer',
  },

  convList: {
    flex: 1,
    overflowY: 'auto',
    padding: 8,
    background: '#fff',
  },

  convItem: {
    width: '100%',
    textAlign: 'left',
    display: 'block',
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid #2c4446ff',
    background: '#fff',
    marginBottom: 8,
    cursor: 'pointer',
  },

  convItemActive: {
    borderColor: '#111827',
    background: '#f3f4f6',
  },

  modelSelect: {
  marginLeft: 'auto',
  padding: '6px 10px',
  fontSize: '14px',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  background: '#fff',
  cursor: 'pointer',
},
  
  controlsSingle: {
  display: 'flex',
  justifyContent: 'flex-start', // 靠左對齊
  padding: 12,
},
 

};

