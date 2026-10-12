import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { wifiPayload } from "../lib/core";
import { download, ErrorMessage } from "./Common";
type Result = { svg: string; png: string; payload: string; revision: string };
export default function QR() {
  const [mode, setMode] = useState("url"),
    [text, setText] = useState(""),
    [ssid, setSsid] = useState(""),
    [password, setPassword] = useState(""),
    [auth, setAuth] = useState("WPA"),
    [hidden, setHidden] = useState(false),
    [size, setSize] = useState("512"),
    [level, setLevel] = useState<"L" | "M" | "Q" | "H">("M"),
    [error, setError] = useState(""),
    [result, setResult] = useState<Result | null>(null),
    [pending, setPending] = useState(false);
  const revision = JSON.stringify([
    mode,
    text,
    ssid,
    password,
    auth,
    hidden,
    size,
    level,
  ]);
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setError("");
    setPending(false);
    let payload = "";
    try {
      if (mode === "wifi") {
        if (!ssid) return;
        payload = wifiPayload(ssid, password, auth, hidden);
      } else {
        if (!text) return;
        payload = text;
        if (mode === "url") {
          let url: URL;
          try {
            url = new URL(text);
          } catch {
            throw new Error(
              "請輸入完整 HTTP/HTTPS 網址，或點選「補上 HTTPS」。",
            );
          }
          if (!["http:", "https:"].includes(url.protocol))
            throw new Error("網址僅支援 HTTP 或 HTTPS。");
        }
      }
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setPending(true);
    const generate = async () => {
      try {
        const encoded = QRCode.create(payload, { errorCorrectionLevel: level });
        const modules = encoded.modules.size + 8;
        const scale = Math.max(1, Math.floor(Number(size) / modules));
        const options = {
          errorCorrectionLevel: level,
          margin: 4,
          scale,
          color: { dark: "#000000", light: "#ffffff" },
        };
        const [svg, png] = await Promise.all([
          QRCode.toString(payload, { ...options, type: "svg" }),
          QRCode.toDataURL(payload, options),
        ]);
        if (!cancelled) setResult({ svg, png, payload, revision });
      } catch {
        if (!cancelled)
          setError(
            `內容超過 ${level} 級可編碼容量，或無法生成。UTF-8 ${new TextEncoder().encode(payload).length} bytes；請縮短內容或降低容錯等級。`,
          );
      } finally {
        if (!cancelled) setPending(false);
      }
    };
    void generate();
    return () => {
      cancelled = true;
    };
  }, [revision]);
  const current = result?.revision === revision ? result : null;
  return (
    <>
      <div className="workspace-grid qr-layout">
        <div className="panel">
          <label>
            內容類型
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="url">網址</option>
              <option value="text">純文字</option>
              <option value="wifi">Wi-Fi</option>
            </select>
          </label>
          {mode === "wifi" ? (
            <>
              <label>
                網路名稱（SSID）
                <input value={ssid} onChange={(e) => setSsid(e.target.value)} />
              </label>
              <label>
                安全性
                <select value={auth} onChange={(e) => setAuth(e.target.value)}>
                  <option value="WPA">WPA / WPA2</option>
                  <option value="WEP">WEP</option>
                  <option value="nopass">無密碼</option>
                </select>
              </label>
              {auth !== "nopass" && (
                <label>
                  密碼
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="off"
                  />
                </label>
              )}
              <label className="check">
                <input
                  type="checkbox"
                  checked={hidden}
                  onChange={(e) => setHidden(e.target.checked)}
                />
                隱藏網路
              </label>
            </>
          ) : (
            <>
              <label htmlFor="qr-content">
                {mode === "url" ? "完整網址" : "文字內容"}
              </label>
              <textarea
                id="qr-content"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder={mode === "url" ? "https://example.com" : ""}
              />
              {mode === "url" && text && !/^https?:\/\//i.test(text) && (
                <button onClick={() => setText("https://" + text)}>
                  補上 HTTPS
                </button>
              )}
            </>
          )}
          <div className="fields">
            <label>
              圖片尺寸
              <select value={size} onChange={(e) => setSize(e.target.value)}>
                {[256, 512, 1024].map((s) => (
                  <option key={s} value={s}>
                    {s} px 以內（整數模組）
                  </option>
                ))}
              </select>
            </label>
            <label>
              容錯等級
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as typeof level)}
              >
                {["L", "M", "Q", "H"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>
          <ErrorMessage error={error} />
          <p className="muted">內容只在本機處理，不保存 QR 輸入與密碼。</p>
        </div>
        <div className="panel qr-preview">
          <div className="qr-image">
            {current ? (
              <img
                src={current.png}
                alt="目前內容的 QR Code"
                width="320"
                height="320"
              />
            ) : (
              <p>
                {error
                  ? "請修正輸入"
                  : pending
                    ? "生成中…"
                    : "輸入內容後顯示 QR Code"}
              </p>
            )}
          </div>
          <div className="actions">
            <button
              className="primary"
              disabled={!current}
              onClick={() => {
                if (!current) return;
                const a = document.createElement("a");
                a.href = current.png;
                a.download = "PulseTools-QR.png";
                a.click();
              }}
            >
              下載 PNG
            </button>
            <button
              disabled={!current}
              onClick={() =>
                current &&
                download(current.svg, "PulseTools-QR.svg", "image/svg+xml")
              }
            >
              下載 SVG
            </button>
          </div>
          <p>靜態碼 · 無浮水印 · 不轉址</p>
        </div>
      </div>
      <section className="instructions">
        <h2>使用提醒</h2>
        <p>
          QR Code
          本身無到期日；若內容是網址，能否開啟仍取決於目標網站。圖片直接編碼你輸入的內容，下載後不依賴本站。
        </p>
        <p className="muted">
          保留白色留白區並避免遮蓋圖形。實際使用前請用目標手機掃描確認。
        </p>
      </section>
    </>
  );
}
