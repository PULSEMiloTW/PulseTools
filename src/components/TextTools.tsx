import { useState } from "react";
import { textStyles, convertText } from "../lib/core";
import { Copy } from "./Common";
export default function TextTools({
  instagram = false,
}: {
  instagram?: boolean;
}) {
  const [text, setText] = useState(
    instagram ? "Pulse Studio | 每天一點靈感 ✨" : "PulseTools 讓日常更順手 ✨",
  );
  const invalid = [...text].length > 2000;
  const styles = instagram
    ? [...textStyles].sort(
        (a, b) =>
          ["花體", "粗體", "雙線", "小型大寫"].indexOf(b[0]) -
          ["花體", "粗體", "雙線", "小型大寫"].indexOf(a[0]),
      )
    : textStyles;
  return (
    <>
      <div className="panel">
        <label htmlFor="source-text">
          {instagram ? "自介、暱稱或貼文文字" : "輸入文字"}
        </label>
        <textarea
          id="source-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
        />
        <p className="muted">
          {[...text].length} / 2,000
          字元。主要轉換拉丁字母與支援的數字；中文、Emoji 與換行保持原文。
        </p>
        {invalid && (
          <p className="error" role="alert">
            最多 2,000 個字元，請縮短文字。
          </p>
        )}
      </div>
      {!invalid && (
        <div className="text-results">
          {styles.map(([name, map]) => {
            const result = convertText(text, map);
            return (
              <section className="text-row" key={name}>
                <div>
                  <h2>{name}</h2>
                  <p className="converted">{result || "輸入文字後顯示結果"}</p>
                </div>
                <Copy text={result} />
              </section>
            );
          })}
          {instagram && (
            <section className="text-row">
              <div>
                <h2>星光裝飾</h2>
                <p className="converted">✦ {text} ✦</p>
              </div>
              <Copy text={"✦ " + text + " ✦"} />
            </section>
          )}
        </div>
      )}
      <section className="instructions">
        <h2>使用提醒</h2>
        <p>
          結果是 Unicode
          純文字。目標平台可能顯示不同，也可能影響搜尋、螢幕閱讀器及字數計算。
          {instagram &&
            "無需 Instagram 登入，與官方無合作；不保證可用於帳號 username。"}
        </p>
        <div className="actions">
          <a href="/emoji">加入 Emoji →</a>
          <a href="/symbols">尋找特殊符號 →</a>
        </div>
      </section>
    </>
  );
}
