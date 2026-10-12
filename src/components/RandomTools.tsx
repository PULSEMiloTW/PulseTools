import { useEffect, useRef, useState } from "react";
import {
  parseList,
  shuffle,
  groupTickets,
  randomInt,
  wheelAngle,
  type Ticket,
} from "../lib/core";
import {
  Copy,
  download,
  ListInput,
  ErrorMessage,
  useReducedMotion,
} from "./Common";
export default function RandomTools({ kind }: { kind: string }) {
  const [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState<Ticket[]>([]),
    [result, setResult] = useState(""),
    [angle, setAngle] = useState(0),
    [removeWinner, setRemoveWinner] = useState(false),
    [groups, setGroups] = useState<Ticket[][]>([]),
    [names, setNames] = useState<string[]>([]),
    [mode, setMode] = useState("count"),
    [value, setValue] = useState("2"),
    [cards, setCards] = useState<Ticket[]>([]),
    [revealed, setRevealed] = useState<string[]>([]),
    [amount, setAmount] = useState("1");
  const reduced = useReducedMotion(),
    lock = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [spunTickets,setSpunTickets]=useState<Ticket[]|null>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const max = kind === "groups" ? 1000 : kind === "draw" ? 200 : 100;
  let tickets: Ticket[] = [];
  try {
    tickets = parseList(text, max);
  } catch {}
  const displayTickets=spunTickets??tickets;
  const run = (action: () => void) => {
    try {
      setError("");
      action();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const validate = () => {
    const list = parseList(text, max);
    if (list.length < (kind === "groups" ? 1 : 2))
      throw new Error(
        kind === "groups" ? "請至少輸入一人。" : "請至少輸入兩個選項。",
      );
    return list;
  };
  const reset = () => {
    if (history.length || cards.length || groups.length) {
      if (!confirm("重新開始會清空本輪結果，確定繼續？")) return;
    }
    setHistory([]);
    setResult("");
    setCards([]);
    setRevealed([]);
    setGroups([]);
    setAngle(0);
    setSpunTickets(null);
  };
  const update = (next: string) => {
    if (cards.length && next !== text) {
      if (!confirm("修改名單會清空籤卡，開始新一輪。確定修改？")) return;
      setCards([]);
      setRevealed([]);
      setHistory([]);
    }
    setText(next);
    setSpunTickets(null);
  };
  const spin = () =>
    run(() => {
      if (lock.current) return;
      const list = validate();
      const index = randomInt(list.length),
        winner = list[index];
      setSpunTickets(list);
      lock.current = true;
      setBusy(true);
      setResult("");
      setAngle((a) => wheelAngle(index, list.length, a));
      const finish = () => {
        setResult(winner.name);
        setHistory((h) => [...h, winner]);
        if (removeWinner)
          setText(
            list
              .filter((x) => x.id !== winner.id)
              .map((x) => x.name)
              .join("\n"),
          );
        lock.current = false;
        setBusy(false);
      };
      timer.current = setTimeout(finish, reduced ? 0 : 2800);
    });
  const group = () =>
    run(() => {
      const out = groupTickets(validate(), Number(value), mode);
      setGroups(out);
      setNames(out.map((_, i) => `第 ${i + 1} 組`));
    });
  const start = () =>
    run(() => {
      if (cards.length && !confirm("重新洗牌會清空本輪揭曉紀錄，確定繼續？"))
        return;
      setCards(shuffle(validate()));
      setRevealed([]);
      setHistory([]);
    });
  const reveal = (ids: string[]) => {
    const next = cards.filter(
      (c) => ids.includes(c.id) && !revealed.includes(c.id),
    );
    setRevealed((r) => [...r, ...next.map((c) => c.id)]);
    setHistory((h) => [...h, ...next]);
  };
  const draw = (n: number) =>
    run(() => {
      const remaining = cards.filter((c) => !revealed.includes(c.id));
      if (!Number.isInteger(n) || n < 1 || n > remaining.length)
        throw new Error("張數必須介於 1 與剩餘張數之間。");
      reveal(remaining.slice(0, n).map((c) => c.id));
    });
  const allGroups = groups
    .map(
      (g, i) =>
        `${names[i]}（${g.length} 人）\n${g.map((x) => x.name).join("\n")}`,
    )
    .join("\n\n");
  const palette = [
    "#5865f2",
    "#8b5cf6",
    "#136b8a",
    "#b45309",
    "#9f3568",
    "#25634e",
  ];
  return (
    <>
      <div className="workspace-grid">
        <div className="panel">
          <ListInput
            value={text}
            onChange={update}
            max={max}
            disabled={busy}
            storageKey={kind}
          />
          {kind === "wheel" && (
            <>
              <button
                disabled={busy}
                onClick={() =>
                  run(() =>
                    setText(
                      [
                        ...new Set(parseList(text, max).map((x) => x.name)),
                      ].join("\n"),
                    ),
                  )
                }
              >
                主動去除同名選項
              </button>
              <label className="check">
                <input
                  type="checkbox"
                  checked={removeWinner}
                  disabled={busy}
                  onChange={(e) => setRemoveWinner(e.target.checked)}
                />
                抽後移除中獎票
              </label>
            </>
          )}
          {kind === "groups" && (
            <div className="fields">
              <label>
                分組方式
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="count">指定組數</option>
                  <option value="size">每組最多人數</option>
                </select>
              </label>
              <label>
                {mode === "count" ? "組數" : "每組最多人數"}
                <input
                  type="number"
                  min="1"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </label>
            </div>
          )}
          <ErrorMessage error={error} />
          <div className="actions">
            <button
              className="primary"
              disabled={busy}
              onClick={
                kind === "wheel" ? spin : kind === "groups" ? group : start
              }
            >
              {busy
                ? "旋轉中…"
                : kind === "wheel"
                  ? "旋轉轉盤"
                  : kind === "groups"
                    ? "隨機分組"
                    : cards.length
                      ? "重新洗牌"
                      : "開始抽籤"}
            </button>
            <button disabled={busy} onClick={reset}>
              重新開始
            </button>
          </div>
        </div>
        <div className={"stage panel " + kind}>
          {kind === "wheel" && (
            <>
              <div className="wheel-wrap">
                <span className="pointer" aria-hidden="true" />
                <div
                  className="wheel-disc"
                  style={{
                    transform: `rotate(${angle}deg)`,
                    transitionDuration: reduced ? "0ms" : "2800ms",
                    background: displayTickets.length
                      ? `conic-gradient(${displayTickets.map((_, i) => `${palette[i % palette.length]} ${(i * 360) / displayTickets.length}deg ${((i + 1) * 360) / displayTickets.length}deg`).join(",")})`
                      : "#5865f2",
                  }}
                >
                  {displayTickets.length <= 16 &&
                    displayTickets.map((t, i) => (
                      <span
                        className="wheel-label"
                        key={t.id}
                        style={{
                          transform: `rotate(${((i + 0.5) * 360) / displayTickets.length}deg) translateY(-105px)`,
                        }}
                        title={t.name}
                      >
                        {t.name.length > 9 ? t.name.slice(0, 8) + "…" : t.name}
                      </span>
                    ))}
                </div>
                <div className="wheel-center" aria-hidden="true">
                  P
                </div>
              </div>
              <p className="muted">
                {displayTickets.length} 張獨立票 · 上方指針決定結果
              </p>
              <div className="result" role="status">
                {busy ? "等待揭曉…" : result || "你的下一個決定"}
              </div>
            </>
          )}
          {kind === "groups" && (
            <>
              {!groups.length ? (
                <div className="empty">
                  <h2>一起開始，分組就緒。</h2>
                  <p>輸入名單，選擇組數或人數上限。</p>
                </div>
              ) : (
                <div className="group-results">
                  {groups.map((g, i) => (
                    <section key={i}>
                      <label>
                        第 {i + 1} 組名稱
                        <input
                          value={names[i]}
                          onChange={(e) =>
                            setNames((n) =>
                              n.map((x, j) => (j === i ? e.target.value : x)),
                            )
                          }
                        />
                      </label>
                      <p className="muted">{g.length} 人</p>
                      <ol>
                        {g.map((t) => (
                          <li key={t.id}>{t.name}</li>
                        ))}
                      </ol>
                    </section>
                  ))}
                </div>
              )}
              {groups.length > 0 && (
                <div className="actions">
                  <Copy text={allGroups} label="複製全部" />
                  <button
                    onClick={() =>
                      download("\ufeff" + allGroups, "PulseTools-分組.txt")
                    }
                  >
                    下載文字
                  </button>
                </div>
              )}
            </>
          )}
          {kind === "draw" && (
            <>
              {!cards.length ? (
                <div className="empty">
                  <h2>每張籤，等待你揭曉。</h2>
                  <p>先輸入名單，再洗牌。卡片內容於開始時決定。</p>
                </div>
              ) : (
                <>
                  <p role="status">剩餘 {cards.length - revealed.length} 張</p>
                  <div className="actions">
                    <button
                      disabled={revealed.length === cards.length}
                      onClick={() => draw(1)}
                    >
                      抽一張
                    </button>
                    <label>
                      一次抽幾張
                      <input
                        type="number"
                        min="1"
                        max={cards.length - revealed.length}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </label>
                    <button
                      disabled={revealed.length === cards.length}
                      onClick={() => draw(Number(amount))}
                    >
                      抽 N 張
                    </button>
                  </div>
                  <div className="draw-grid">
                    {cards.map((c, i) => {
                      const open = revealed.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          className={open ? "revealed" : "ticket-back"}
                          disabled={open}
                          aria-label={
                            open ? `已揭曉：${c.name}` : `揭曉第 ${i + 1} 張`
                          }
                          onClick={() => reveal([c.id])}
                        >
                          {open ? c.name : "?"}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
      {history.length > 0 && (
        <section className="panel history">
          <h2>當次結果紀錄</h2>
          <ol>
            {history.map((x, i) => (
              <li key={i}>{x.name}</li>
            ))}
          </ol>
          <Copy
            text={history.map((x, i) => `${i + 1}. ${x.name}`).join("\n")}
          />
        </section>
      )}
      <section className="instructions">
        <h2>怎麼使用</h2>
        <p>
          {kind === "wheel"
            ? "每行一票，同名增加權重。結果在動畫開始前決定，旋轉期間名單會鎖定。"
            : kind === "groups"
              ? "名單先洗牌，再平均分配，每組人數差最多一人。相同姓名仍各保留一次。"
              : "開始時已決定每張籤的內容，點卡片只揭曉，不重新抽取。同一張籤不會再次抽到。"}
        </p>
        <p className="muted">適合本機一般用途；沒有公證或第三方驗證功能。</p>
      </section>
    </>
  );
}
