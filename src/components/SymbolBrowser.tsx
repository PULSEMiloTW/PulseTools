import { Ready } from "./Common";
import { useEffect, useState } from "react";
import messages from "emojibase-data/zh-hant/messages.json";
import { symbols, symbolGroups, type SymbolItem } from "../lib/symbols";
import { stringList, write } from "../lib/storage";
import { Copy } from "./Common";
export default function SymbolBrowser({ emoji = false }: { emoji?: boolean }) {
  const [query, setQuery] = useState(""),
    [group, setGroup] = useState("all"),
    [limit, setLimit] = useState(120),
    [favorites, setFavorites] = useState<string[]>([]),
    [recent, setRecent] = useState<string[]>([]),
    [selected, setSelected] = useState<SymbolItem | null>(null),
    [tone, setTone] = useState(""),
    [status, setStatus] = useState("");
  const key = emoji ? "emoji" : "symbols";
  useEffect(() => {
    setFavorites(stringList(key + ":favorites"));
    setRecent(stringList(key + ":recent"));
  }, [key]);
  const [emojiItems, setEmojiItems] = useState<SymbolItem[]>([]);
  useEffect(() => {
    if (!emoji) return;
    const controller = new AbortController();
    fetch("/emoji-data.json", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setEmojiItems)
      .catch((e) => {
        if (e.name !== "AbortError")
          setStatus("Emoji 資料載入失敗，請重新整理重試。");
      });
    return () => controller.abort();
  }, [emoji]);
  const items = emoji ? emojiItems : symbols;
  const categories = emoji
    ? messages.groups.map((g) => ({ id: g.order, name: g.message }))
    : symbolGroups;
  const visible = items.filter(
    (e) =>
      (group === "all" ||
        (group === "favorites"
          ? favorites.includes(e.text)
          : group === "recent"
            ? recent.includes(e.text)
            : e.group === Number(group))) &&
      `${e.text} ${e.label} ${e.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const select = async (e: SymbolItem) => {
    setSelected(e);
    setTone("");
    const next = [e.text, ...recent.filter((x) => x !== e.text)].slice(0, 30);
    setRecent(next);
    write(key + ":recent", next);
    try {
      await navigator.clipboard.writeText(e.text);
      setStatus("已複製：" + e.label);
    } catch {
      setStatus("複製失敗，請使用下方可選文字手動複製。");
    }
  };
  const output = tone || selected?.text || "";
  return (
    <Ready>
      <div className="browser-controls">
        <label>
          搜尋名稱或關鍵字
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(120);
            }}
            placeholder="中文或 English…"
          />
        </label>
        <label>
          分類
          <select
            value={group}
            onChange={(e) => {
              setGroup(e.target.value);
              setLimit(120);
            }}
          >
            <option value="all">全部分類</option>
            <option value="favorites">我的收藏</option>
            <option value="recent">最近使用</option>
            {categories.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {selected && (
        <div className="selection panel">
          <span className="selected-symbol">{output}</span>
          <div>
            <p>{selected.label}</p>
            {selected.skins && (
              <label>
                膚色
                <select value={tone} onChange={(e) => setTone(e.target.value)}>
                  <option value="">預設</option>
                  {selected.skins.map((s) => (
                    <option key={s.text} value={s.text}>
                      {s.text} {s.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="actions">
              <Copy text={output} />
              <button
                aria-pressed={favorites.includes(selected.text)}
                onClick={() => {
                  const next = favorites.includes(selected.text)
                    ? favorites.filter((x) => x !== selected.text)
                    : [...favorites, selected.text];
                  setFavorites(next);
                  write(key + ":favorites", next);
                }}
              >
                {favorites.includes(selected.text) ? "取消收藏" : "收藏"}
              </button>
            </div>
            {status.startsWith("複製失敗") && (
              <input
                aria-label="手動複製符號"
                readOnly
                value={output}
                onFocus={(e) => e.target.select()}
              />
            )}
          </div>
        </div>
      )}
      <p role="status">{status}</p>
      <p className="muted">找到 {visible.length} 項 · 點選即可複製</p>
      <div className="symbol-grid">
        {visible.slice(0, limit).map((e) => (
          <button
            key={e.text}
            aria-label={e.label}
            title={e.label}
            onClick={() => void select(e)}
          >
            {e.text}
          </button>
        ))}
      </div>
      {visible.length > limit && (
        <button className="load-more" onClick={() => setLimit((n) => n + 120)}>
          顯示更多（已顯示 {limit} 項）
        </button>
      )}
      {!visible.length && <p>沒有符合的項目，試試其他關鍵字。</p>}
      <section className="instructions">
        <h2>使用提醒</h2>
        <p>
          {emoji
            ? "使用系統原生 Emoji，外觀與支援程度依裝置不同。完整序列包含旗幟、膚色及組合表情，複製時保持完整。資料採 Emojibase 17.0.0（MIT）；來源與授權詳見專案文件。"
            : "複製的是 Unicode 純文字，部分符號外觀會依字型與裝置而不同。"}
        </p>
      </section>
    </Ready>
  );
}
