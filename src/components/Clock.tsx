import { useEffect, useRef, useState } from "react";
import { clockParts } from "../lib/core";
import { read, write } from "../lib/storage";
const zones = [
  ["Asia/Taipei", "台北 Taipei"],
  ["Asia/Tokyo", "東京 Tokyo"],
  ["Asia/Seoul", "首爾 Seoul"],
  ["Asia/Hong_Kong", "香港 Hong Kong"],
  ["Asia/Shanghai", "上海 Shanghai"],
  ["Asia/Singapore", "新加坡 Singapore"],
  ["Europe/London", "倫敦 London"],
  ["Europe/Paris", "巴黎 Paris"],
  ["America/New_York", "紐約 New York"],
  ["America/Los_Angeles", "洛杉磯 Los Angeles"],
  ["Australia/Sydney", "雪梨 Sydney"],
  ["UTC", "UTC"],
];
export default function Clock() {
  const [zone, setZone] = useState("Asia/Taipei"),
    [style, setStyle] = useState("minimal"),
    [now, setNow] = useState<Date | null>(null),
    [fallback, setFallback] = useState(false),
    [notice, setNotice] = useState("");
  const stage = useRef<HTMLDivElement>(null),
    button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const saved = read<unknown>("clock", null);
    if (saved && typeof saved === "object") {
      const s = saved as Record<string, unknown>;
      if (zones.some(([z]) => z === s.zone)) setZone(s.zone as string);
      if (["minimal", "led", "flip", "analog"].includes(s.style as string))
        setStyle(s.style as string);
    }
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 250);
    const sync = () => {
      if (!document.fullscreenElement) button.current?.focus();
    };
    document.addEventListener("visibilitychange", tick);
    document.addEventListener("fullscreenchange", sync);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      document.removeEventListener("fullscreenchange", sync);
    };
  }, []);
  useEffect(() => {
    const exit = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fallback) {
        setFallback(false);
        button.current?.focus();
      }
    };
    document.addEventListener("keydown", exit);
    return () => document.removeEventListener("keydown", exit);
  }, [fallback]);
  const update = (z: string, s: string) => {
    setZone(z);
    setStyle(s);
    write("clock", { zone: z, style: s });
  };
  const parts = now ? clockParts(now, zone) : ["--", "--", "--"];
  const [h, m, s] = parts.map(Number);
  const exit = () => {
    if (document.fullscreenElement === stage.current) {
      void document.exitFullscreen();
    } else if (fallback) {
      setFallback(false);
      button.current?.focus();
    }
  };
  return (
    <>
      <div className="clock-controls">
        <label>
          時區（可輸入中英文城市）
          <input
            list="timezones"
            value={zones.find(([z]) => z === zone)?.[1] ?? zone}
            onChange={(e) => {
              const input = e.target.value;
              const match = zones.find(
                ([z, label]) => label === input || z === input,
              );
              if (match) update(match[0], style);
              else {
                setZone(input);
              }
            }}
            onBlur={() => {
              const match = zones.find(
                ([z, label]) => z === zone || label === zone,
              );
              if (match) update(match[0], style);
              else update("Asia/Taipei", style);
            }}
          />
          <datalist id="timezones">
            {zones.map(([z, label]) => (
              <option key={z} value={label}>
                {z}
              </option>
            ))}
          </datalist>
        </label>
        <label>
          時鐘樣式
          <select value={style} onChange={(e) => update(zone, e.target.value)}>
            <option value="minimal">極簡數字</option>
            <option value="led">LED</option>
            <option value="flip">翻頁</option>
            <option value="analog">指針</option>
          </select>
        </label>
        <button
          ref={button}
          className="primary"
          onClick={async () => {
            setNotice("");
            try {
              if (!stage.current?.requestFullscreen) throw new Error();
              await stage.current.requestFullscreen();
            } catch {
              setFallback(true);
              setNotice(
                "使用填滿網頁視窗模式，無法移除瀏覽器介面。按 Esc 或點時鐘退出。",
              );
            }
          }}
        >
          進入全螢幕
        </button>
      </div>
      <p className="muted">展示時按 Esc 或點一下時鐘即可退出。</p>
      <p role="status">{notice}</p>
      <div
        ref={stage}
        className={"clock-stage " + style + (fallback ? " presentation" : "")}
        onClick={exit}
      >
        {style === "analog" ? (
          <div className="analog-face" aria-label={parts.join(":")}>
            {Array.from({ length: 12 }, (_, i) => (
              <span
                className="tick"
                key={i}
                style={{ transform: `rotate(${i * 30}deg)` }}
              />
            ))}
            <div
              className="hand hour"
              style={{ transform: `rotate(${h * 30 + m * 0.5}deg)` }}
            />
            <div
              className="hand minute"
              style={{ transform: `rotate(${m * 6 + s * 0.1}deg)` }}
            />
            <div
              className="hand second"
              style={{ transform: `rotate(${s * 6}deg)` }}
            />
            <span className="hand-center" />
          </div>
        ) : (
          <div className="digits" aria-label={parts.join(":")}>
            {parts.map((p, i) => (
              <span key={i} className="digit-pair">
                {i > 0 && <span className="colon">:</span>}
                <span className="number" key={p}>
                  {p}
                </span>
              </span>
            ))}
          </div>
        )}
        <p>
          {zones.find(([z]) => z === zone)?.[1] ?? "台北 Taipei"} ·{" "}
          {zones.some(([z]) => z === zone) ? zone : "Asia/Taipei"}
        </p>
      </div>
      <section className="instructions">
        <h2>怎麼使用</h2>
        <p>
          選擇城市與樣式即可展示。时间來源為裝置系統時間，未做 NTP
          或原子鐘校準；各時區依瀏覽器時區規則顯示。
        </p>
      </section>
    </>
  );
}
