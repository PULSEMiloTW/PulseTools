import { useEffect, useState } from "react";
import { clearData, read, write, stringList } from "../lib/storage";
export default function SiteControls({ slug }: { slug?: string }) {
  const [theme, setTheme] = useState("system"),
    [ready, setReady] = useState(false),
    [favorite, setFavorite] = useState(false),
    [status, setStatus] = useState("");
  useEffect(() => {
    setReady(true);
    const stored = read<unknown>("theme", "system");
    setTheme(typeof stored === "string" ? stored : "system");
    if (slug) {
      const recent = stringList("recent");
      write("recent", [slug, ...recent.filter((x) => x !== slug)].slice(0, 10));
      setFavorite(stringList("favorites").includes(slug));
    }
  }, []);
  return (
    <div className="site-controls">
      <fieldset
        disabled={!ready}
        className="interactive-boundary controls-boundary"
      >
        <label>
          主題
          <select
            value={theme}
            onChange={(e) => {
              const next = e.target.value;
              setTheme(next);
              write("theme", next);
              document.documentElement.dataset.theme =
                next === "system"
                  ? matchMedia("(prefers-color-scheme: dark)").matches
                    ? "dark"
                    : "light"
                  : next;
            }}
          >
            <option value="system">跟隨系統</option>
            <option value="light">淺色</option>
            <option value="dark">深色</option>
          </select>
        </label>
        {slug && (
          <button
            aria-pressed={favorite}
            onClick={() => {
              const items = stringList("favorites");
              write(
                "favorites",
                favorite ? items.filter((x) => x !== slug) : [...items, slug],
              );
              setFavorite(!favorite);
            }}
          >
            {favorite ? "已收藏" : "收藏工具"}
          </button>
        )}
        <button
          onClick={() => {
            if (
              confirm("清除本站的收藏、最近工具、主題、時鐘設定及已保存名單？")
            ) {
              if (clearData()) location.reload();
              else setStatus("無法清除，請從瀏覽器網站設定清除本站資料。");
            }
          }}
        >
          清除本站資料
        </button>
        <span role="status">{status}</span>
      </fieldset>
    </div>
  );
}
