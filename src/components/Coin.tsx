import { useEffect, useRef, useState } from "react";
import { randomInt } from "../lib/core";
import { useReducedMotion, Copy } from "./Common";
export default function Coin() {
  const [labels, setLabels] = useState(["正面", "反面"]),
    [outcomes, setOutcomes] = useState<number[]>([]),
    [side, setSide] = useState<number | null>(null),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    reduced = useReducedMotion();
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <>
      <div className="coin-layout panel">
        <div className="coin-options">
          {labels.map((x, i) => (
            <label key={i}>
              {i === 0 ? "正面文字" : "反面文字"}
              <input
                value={x}
                maxLength={20}
                disabled={busy}
                onChange={(e) =>
                  setLabels((a) =>
                    a.map((v, j) => (i === j ? e.target.value : v)),
                  )
                }
              />
            </label>
          ))}
          <button
            className="primary"
            disabled={busy || labels.some((x) => !x.trim())}
            onClick={() => {
              if (lock.current) return;
              lock.current = true;
              const winner = randomInt(2);
              setBusy(true);
              timer.current = setTimeout(
                () => {
                  setSide(winner);
                  setOutcomes((a) => [...a, winner]);
                  setBusy(false);
                  lock.current = false;
                },
                reduced ? 0 : 900,
              );
            }}
          >
            {busy ? "拋擲中…" : "拋擲硬幣"}
          </button>
          <button
            disabled={busy}
            onClick={() => {
              if (!outcomes.length || confirm("清除本輪硬幣紀錄？")) {
                setOutcomes([]);
                setSide(null);
              }
            }}
          >
            清除紀錄
          </button>
        </div>
        <div className="coin-stage">
          <div
            className={"coin-disc " + (busy ? "flipping" : "")}
            data-side={side ?? ""}
          >
            {busy ? "…" : side === null ? "P" : labels[side]}
          </div>
          <p role="status">
            {busy
              ? "等待落面…"
              : side === null
                ? "準備拋出第一枚硬幣"
                : `結果：${labels[side]}`}
          </p>
        </div>
      </div>
      <section className="panel">
        <h2>本輪統計</h2>
        <div className="stats">
          <p>
            拋擲次數 <strong>{outcomes.length}</strong>
          </p>
          {labels.map((x, i) => (
            <p key={i}>
              {x || "未命名"}{" "}
              <strong>{outcomes.filter((v) => v === i).length}</strong>
            </p>
          ))}
        </div>
        <Copy
          text={outcomes.map((s, i) => `${i + 1}. ${labels[s]}`).join("\n")}
        />
      </section>
      <section className="instructions">
        <h2>怎麼使用</h2>
        <p>可自訂兩面文字，每次獨立二選一。過去的結果不會影響下一次機率。</p>
      </section>
    </>
  );
}
