import { useEffect, useState, type ReactNode } from "react";
import { read, write, remove } from "../lib/storage";
export function Ready({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <>
      <fieldset className="interactive-boundary" disabled={!ready}>
        {children}
      </fieldset>
      {!ready && <p role="status">正在啟動工具…</p>}
    </>
  );
}
export function Copy({
  text,
  label = "複製",
}: {
  text: string;
  label?: string;
}) {
  const [status, setStatus] = useState("");
  return (
    <span className="copy">
      <button
        disabled={!text}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setStatus("已複製");
          } catch {
            setStatus("複製失敗，請選取下方文字手動複製。");
          }
        }}
      >
        {label}
      </button>
      <span role="status">{status}</span>
      {status.startsWith("複製失敗") && (
        <textarea
          aria-label="手動複製文字"
          readOnly
          value={text}
          onFocus={(e) => e.target.select()}
        />
      )}
    </span>
  );
}
export function download(
  text: string,
  name: string,
  type = "text/plain;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ListInput({
  value,
  onChange,
  max,
  disabled = false,
  storageKey,
}: {
  value: string;
  onChange: (v: string) => void;
  max: number;
  disabled?: boolean;
  storageKey: string;
}) {
  const [save, setSave] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const stored = read<unknown>("list:" + storageKey, null);
    if (typeof stored === "string") {
      onChange(stored);
      setSave(true);
    }
  }, []);
  const update = (v: string) => {
    onChange(v);
  };
  useEffect(() => {
    if (save && !write("list:" + storageKey, value))
      setError("無法保存，名單仍可在本次頁面使用。");
  }, [save, value, storageKey]);
  return (
    <div className="list-input">
      <label htmlFor="names">名單（每行一項）</label>
      <textarea
        id="names"
        value={value}
        disabled={disabled}
        onChange={(e) => update(e.target.value)}
        rows={9}
      />
      <p className="muted">
        最多 {max} 項，每項 80 字元。同名仍是獨立票，會增加權重；可用編號區分。
      </p>
      <div className="actions">
        <button
          disabled={disabled}
          onClick={() => update("選項 A\n選項 B\n選項 C\n選項 D")}
        >
          載入範例
        </button>
        <button
          disabled={disabled}
          onClick={() => {
            if (!value || confirm("清空目前名單？")) update("");
          }}
        >
          清空名單
        </button>
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={save}
          disabled={disabled}
          onChange={(e) => {
            setSave(e.target.checked);
            if (e.target.checked) {
              if (!write("list:" + storageKey, value))
                setError("無法保存本機資料。");
            } else {
              remove("list:" + storageKey);
            }
          }}
        />
        在這台裝置保存名單（預設關閉）
      </label>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export function useReducedMotion() {
  const [value, setValue] = useState(false);
  useEffect(() => {
    const q = matchMedia("(prefers-reduced-motion: reduce)");
    setValue(q.matches);
    const update = () => setValue(q.matches);
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);
  return value;
}
export function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <p className="error" role="alert">
      {error}
    </p>
  ) : null;
}
