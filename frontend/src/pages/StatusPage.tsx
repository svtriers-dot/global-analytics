/**
 * StatusPage — внутренний дашборд состояния источников данных.
 * Доступен по маршруту /status.
 * Показывает: статус, последнее обновление, количество записей, наличие ключей.
 */

import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

interface SourceStatus {
  source: string;
  label: string;
  description: string;
  url: string;
  key_required: boolean;
  key_configured: boolean;
  status: "ok" | "no_key" | "error" | "stale" | "never_fetched";
  last_success: string | null;
  last_attempt: string | null;
  last_error: string | null;
  records_count: number;
  data_age_hours: number | null;
}

interface StatusResponse {
  overall_healthy: boolean;
  checked_at: string;
  sources: SourceStatus[];
}

const STATUS_CONFIG = {
  ok:            { emoji: "✅", label: "OK",           color: "#22c55e" },
  no_key:        { emoji: "🔑", label: "Нет ключа",    color: "#f59e0b" },
  error:         { emoji: "❌", label: "Ошибка",        color: "#ef4444" },
  stale:         { emoji: "⚠️", label: "Устаревшие",   color: "#f97316" },
  never_fetched: { emoji: "⏳", label: "Ожидание",      color: "#94a3b8" },
};

function formatAge(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} мин назад`;
  if (hours < 24) return `${Math.round(hours)} ч назад`;
  return `${Math.round(hours / 24)} д назад`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60_000); // обновляем раз в минуту
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: "24px", maxWidth: "900px", margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      {/* Заголовок */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>
            📊 Состояние источников данных
          </h1>
          {data && (
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "13px" }}>
              Обновлено: {formatDate(data.checked_at)}
              {" · "}
              <span style={{ color: data.overall_healthy ? "#22c55e" : "#ef4444" }}>
                {data.overall_healthy ? "Всё работает" : "Есть проблемы"}
              </span>
            </p>
          )}
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            background: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "13px",
            color: "#475569",
          }}
        >
          {loading ? "⏳ Загрузка..." : "🔄 Обновить"}
        </button>
      </div>

      {/* Ошибка подключения */}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: "8px", background: "#fef2f2", color: "#ef4444", marginBottom: "16px", fontSize: "14px" }}>
          ❌ Не удалось получить статус: {error}
          <br />
          <small style={{ color: "#94a3b8" }}>Убедитесь, что бэкенд запущен и доступен</small>
        </div>
      )}

      {/* Карточки источников */}
      {data && (
        <div style={{ display: "grid", gap: "12px" }}>
          {data.sources.map((src) => {
            const cfg = STATUS_CONFIG[src.status] ?? STATUS_CONFIG.never_fetched;
            return (
              <div
                key={src.source}
                style={{
                  padding: "16px 20px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                  {/* Левая колонка */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "18px" }}>{cfg.emoji}</span>
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontWeight: 600, fontSize: "15px", color: "#1e293b", textDecoration: "none" }}
                      >
                        {src.label}
                      </a>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: "99px",
                        fontSize: "11px",
                        fontWeight: 600,
                        background: `${cfg.color}18`,
                        color: cfg.color,
                      }}>
                        {cfg.label}
                      </span>
                    </div>
                    <p style={{ margin: "0 0 8px", color: "#64748b", fontSize: "13px" }}>
                      {src.description}
                    </p>

                    {/* Ошибка */}
                    {src.last_error && (
                      <div style={{ fontSize: "12px", color: "#ef4444", background: "#fef2f2", padding: "4px 8px", borderRadius: "4px", marginBottom: "8px", fontFamily: "monospace" }}>
                        {src.last_error}
                      </div>
                    )}

                    {/* Инструкция по ключу */}
                    {src.key_required && !src.key_configured && (
                      <div style={{ fontSize: "12px", color: "#92400e", background: "#fffbeb", padding: "6px 10px", borderRadius: "6px", border: "1px solid #fde68a" }}>
                        🔑 Добавьте <code style={{ background: "#fef9c3", padding: "0 3px" }}>
                          {src.source === "alpha_vantage" ? "ALPHA_VANTAGE_API_KEY" : "FRED_API_KEY"}
                        </code> в переменные окружения Railway
                      </div>
                    )}
                  </div>

                  {/* Правая колонка — метрики */}
                  <div style={{ display: "flex", gap: "16px", flexShrink: 0, fontSize: "13px" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "2px" }}>Последнее</div>
                      <div style={{ fontWeight: 600, color: "#334155" }}>{formatAge(src.data_age_hours)}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "2px" }}>Записей</div>
                      <div style={{ fontWeight: 600, color: "#334155" }}>{src.records_count.toLocaleString("ru")}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "2px" }}>Ключ</div>
                      <div style={{ fontWeight: 600, color: src.key_configured ? "#22c55e" : "#f59e0b" }}>
                        {!src.key_required ? "—" : src.key_configured ? "✓" : "✗"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Подсказка */}
      <p style={{ marginTop: "24px", color: "#94a3b8", fontSize: "12px" }}>
        Данные обновляются автоматически через Celery. Страница обновляется каждые 60 секунд.
      </p>
    </div>
  );
}
