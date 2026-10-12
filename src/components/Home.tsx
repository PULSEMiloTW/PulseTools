import { Ready } from "./Common";
import { useEffect, useState } from "react";
import { tools, categories } from "../lib/tools";
import { stringList, write } from "../lib/storage";
import Icon from "./Icon";
export default function Home() {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [favorites, setFavorites] = useState<string[]>([]),
    [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    const sync = () =>
      setCategory(new URLSearchParams(location.search).get("category") ?? "");
    sync();
    setFavorites(stringList("favorites"));
    setRecent(stringList("recent"));
    addEventListener("popstate", sync);
    return () => removeEventListener("popstate", sync);
  }, []);
  const toggle = (slug: string) => {
    const next = favorites.includes(slug)
      ? favorites.filter((x) => x !== slug)
      : [...favorites, slug];
    setFavorites(next);
    write("favorites", next);
  };
  const cards = (items: typeof tools) => (
    <div className="tool-grid">
      {items.map((t) => (
        <article className="tool-card" key={t.slug}>
          <div className="card-top">
            <span className={"tool-icon " + t.category}>
              <Icon name={t.icon} />
            </span>
            <button
              className="favorite"
              aria-label={`收藏${t.name}`}
              aria-pressed={favorites.includes(t.slug)}
              onClick={() => toggle(t.slug)}
            >
              {favorites.includes(t.slug) ? "★" : "☆"}
            </button>
          </div>
          <a href={"/" + t.slug}>
            <h3>
              {t.name}
              <span aria-hidden="true">↗</span>
            </h3>
            <p>{t.description}</p>
          </a>
          <small>{categories[t.category]}</small>
        </article>
      ))}
    </div>
  );
  const visible = tools.filter(
    (t) =>
      (!category || t.category === category) &&
      `${t.name} ${t.keywords} ${t.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <Ready>
      <div className="home-title">
        <h1>日常小事，順手完成。</h1>
        <p>十個實用工具，打開就能用。免登入，內容在你的瀏覽器處理。</p>
      </div>
      <label className="search-label" htmlFor="tool-search">
        搜尋工具
      </label>
      <input
        id="tool-search"
        className="search"
        type="search"
        placeholder="搜尋工具、用途或關鍵字…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="filters" aria-label="工具分類">
        {[["", "全部工具"], ...Object.entries(categories)].map(
          ([id, label]) => (
            <button
              key={id}
              aria-pressed={category === id}
              onClick={() => {
                setCategory(id);
                history.pushState(null, "", id ? "/?category=" + id : "/");
              }}
            >
              {label}
            </button>
          ),
        )}
      </div>
      {!query && !category && favorites.length > 0 && (
        <section>
          <h2>我的收藏</h2>
          {cards(tools.filter((t) => favorites.includes(t.slug)))}
        </section>
      )}
      {!query && !category && recent.length > 0 && (
        <section>
          <h2>最近使用</h2>
          <div className="recent">
            {recent.slice(0, 5).map((slug) => {
              const t = tools.find((t) => t.slug === slug);
              return t ? (
                <a key={slug} href={"/" + slug}>
                  {t.name} →
                </a>
              ) : null;
            })}
          </div>
        </section>
      )}
      <section>
        <div className="section-heading">
          <h2>
            {category ? (categories[category] ?? "全部工具") : "全部工具"}
          </h2>
          <span className="muted" role="status">
            {visible.length} 個工具
          </span>
        </div>
        {cards(visible)}
        {!visible.length && <p>找不到符合的工具，試試其他關鍵字或分類。</p>}
      </section>
    </Ready>
  );
}
