import { useMemo } from "react";
import { getErrorCodeLabel } from "./home/HomeLogShared";
import { Spinner } from "../ui/Spinner";
import { cn } from "../utils/cn";

function mapSelectionMethod(selectionMethod: string | null) {
  switch (selectionMethod) {
    case "ordered":
      return "按顺序选择供应商";
    case "session_reuse":
      return "复用上一次成功的供应商";
    case "weighted_random":
      return "按权重选择供应商";
    default:
      return null;
  }
}

function mapReasonCode(reasonCode: string | null) {
  switch (reasonCode) {
    case "request_success":
      return "请求已成功完成";
    case "retry_success":
      return "重试后请求成功";
    case "request_failed":
      return "请求失败，系统准备继续处理";
    case "retry_failed":
      return "重试后仍然失败";
    case "session_reuse":
      return "命中了会话复用";
    case "provider_skipped":
      return "该供应商被跳过，未实际发出请求";
    case "failover":
      return "当前供应商失败，系统切换到下一个供应商";
    default:
      return null;
  }
}

function mapDecision(decision: string | null) {
  switch (decision) {
    case "success":
      return "请求成功";
    case "retry":
      return "继续重试";
    case "failover":
      return "切换供应商";
    case "skip":
      return "跳过该供应商";
    default:
      return null;
  }
}

function buildAttemptReason(attempt: ProviderChainAttempt, hasMultipleAttempts: boolean) {
  const errorLabel = attempt.error_code ? getErrorCodeLabel(attempt.error_code) : null;
  const statusText = attempt.status != null ? `HTTP ${attempt.status}` : null;

  if (attempt.session_reuse) {
    return `命中了会话复用，继续使用 ${attempt.provider_name || "当前供应商"}。`;
  }

  if (attempt.outcome === "skipped") {
    return errorLabel
      ? `该供应商被跳过，原因是 ${errorLabel}。`
      : "该供应商被跳过，本次没有真正发出请求。";
  }

  if (attempt.outcome === "success") {
    if (hasMultipleAttempts && attempt.attempt_index > 1) {
      return `前面的尝试未成功，系统改走 ${attempt.provider_name || "当前供应商"} 后请求成功。`;
    }
    return `系统选择 ${attempt.provider_name || "当前供应商"} 发起请求，并成功返回结果。`;
  }

  if (hasMultipleAttempts) {
    if (errorLabel && statusText) {
      return `${attempt.provider_name || "当前供应商"} 返回 ${statusText}，错误为“${errorLabel}”，因此系统继续重试或切换。`;
    }
    if (errorLabel) {
      return `${attempt.provider_name || "当前供应商"} 请求失败，错误为“${errorLabel}”，因此系统继续重试或切换。`;
    }
    if (statusText) {
      return `${attempt.provider_name || "当前供应商"} 返回 ${statusText}，因此系统继续重试或切换。`;
    }
    return `${attempt.provider_name || "当前供应商"} 未成功返回结果，因此系统继续重试或切换。`;
  }

  if (errorLabel && statusText) {
    return `${attempt.provider_name || "当前供应商"} 返回 ${statusText}，错误为“${errorLabel}”。`;
  }
  if (errorLabel) {
    return `${attempt.provider_name || "当前供应商"} 请求失败，错误为“${errorLabel}”。`;
  }
  return `${attempt.provider_name || "当前供应商"} 未成功返回结果。`;
}

export type ProviderChainAttemptLog = {
  attempt_index: number;
  provider_id: number;
  provider_name: string;
  base_url: string;
  outcome: string;
  status: number | null;
  attempt_started_ms?: number | null;
  attempt_duration_ms?: number | null;
};

type ProviderChainAttemptJson = {
  provider_id: number;
  provider_name: string;
  base_url: string;
  outcome: string;
  status: number | null;
  provider_index?: number | null;
  retry_index?: number | null;
  session_reuse?: boolean | null;
  error_category?: string | null;
  error_code?: string | null;
  decision?: string | null;
  reason?: string | null;
  selection_method?: string | null;
  reason_code?: string | null;
  attempt_started_ms?: number | null;
  attempt_duration_ms?: number | null;
  circuit_state_before?: string | null;
  circuit_state_after?: string | null;
  circuit_failure_count?: number | null;
  circuit_failure_threshold?: number | null;
};

type ProviderChainAttempt = {
  attempt_index: number;
  provider_id: number;
  provider_name: string;
  base_url: string;
  outcome: string;
  status: number | null;
  attempt_started_ms: number | null;
  attempt_duration_ms: number | null;
  provider_index: number | null;
  retry_index: number | null;
  session_reuse: boolean | null;
  error_category: string | null;
  error_code: string | null;
  decision: string | null;
  reason: string | null;
  selection_method: string | null;
  reason_code: string | null;
  circuit_state_before: string | null;
  circuit_state_after: string | null;
  circuit_failure_count: number | null;
  circuit_failure_threshold: number | null;
};

export function ProviderChainView({
  attemptLogs,
  attemptLogsLoading,
  attemptsJson,
}: {
  attemptLogs: ProviderChainAttemptLog[];
  attemptLogsLoading?: boolean;
  attemptsJson: string | null | undefined;
}) {
  const parsedAttemptsJson = useMemo(() => {
    if (!attemptsJson)
      return { ok: false as const, attempts: null as ProviderChainAttemptJson[] | null };
    try {
      const parsed = JSON.parse(attemptsJson);
      if (!Array.isArray(parsed)) {
        return { ok: false as const, attempts: null };
      }
      return { ok: true as const, attempts: parsed as ProviderChainAttemptJson[] };
    } catch {
      return { ok: false as const, attempts: null };
    }
  }, [attemptsJson]);

  const attempts = useMemo((): ProviderChainAttempt[] | null => {
    const logs = attemptLogs ?? [];
    const jsonAttempts = parsedAttemptsJson.ok ? parsedAttemptsJson.attempts : null;

    if (logs.length === 0 && !jsonAttempts) return null;

    if (logs.length === 0 && jsonAttempts) {
      return jsonAttempts.map((a, index) => ({
        attempt_index: index + 1,
        provider_id: a.provider_id,
        provider_name: a.provider_name,
        base_url: a.base_url,
        outcome: a.outcome,
        status: a.status ?? null,
        attempt_started_ms: a.attempt_started_ms ?? null,
        attempt_duration_ms: a.attempt_duration_ms ?? null,
        provider_index: a.provider_index ?? null,
        retry_index: a.retry_index ?? null,
        session_reuse: a.session_reuse ?? null,
        error_category: a.error_category ?? null,
        error_code: a.error_code ?? null,
        decision: a.decision ?? null,
        reason: a.reason ?? null,
        selection_method: a.selection_method ?? null,
        reason_code: a.reason_code ?? null,
        circuit_state_before: a.circuit_state_before ?? null,
        circuit_state_after: a.circuit_state_after ?? null,
        circuit_failure_count: a.circuit_failure_count ?? null,
        circuit_failure_threshold: a.circuit_failure_threshold ?? null,
      }));
    }

    const byAttemptIndex: Record<number, ProviderChainAttemptJson | undefined> = {};
    if (jsonAttempts) {
      for (let i = 0; i < jsonAttempts.length; i += 1) {
        byAttemptIndex[i + 1] = jsonAttempts[i];
      }
    }

    const normalized = logs
      .slice()
      .sort((a, b) => a.attempt_index - b.attempt_index)
      .map((log) => {
        const json = byAttemptIndex[log.attempt_index];
        return {
          attempt_index: log.attempt_index,
          provider_id: log.provider_id ?? json?.provider_id ?? 0,
          provider_name: log.provider_name || json?.provider_name || "未知",
          base_url: log.base_url || json?.base_url || "",
          outcome: log.outcome || json?.outcome || "",
          status: log.status ?? json?.status ?? null,
          attempt_started_ms: log.attempt_started_ms ?? json?.attempt_started_ms ?? null,
          attempt_duration_ms: log.attempt_duration_ms ?? json?.attempt_duration_ms ?? null,
          provider_index: json?.provider_index ?? null,
          retry_index: json?.retry_index ?? null,
          session_reuse: json?.session_reuse ?? null,
          error_category: json?.error_category ?? null,
          error_code: json?.error_code ?? null,
          decision: json?.decision ?? null,
          reason: json?.reason ?? null,
          selection_method: json?.selection_method ?? null,
          reason_code: json?.reason_code ?? null,
          circuit_state_before: json?.circuit_state_before ?? null,
          circuit_state_after: json?.circuit_state_after ?? null,
          circuit_failure_count: json?.circuit_failure_count ?? null,
          circuit_failure_threshold: json?.circuit_failure_threshold ?? null,
        };
      });

    return normalized;
  }, [attemptLogs, parsedAttemptsJson]);

  const dataSourceLabel = useMemo(() => {
    if (attemptLogsLoading) return "加载中…";
    if (attemptLogs.length > 0) {
      return parsedAttemptsJson.ok
        ? "数据源：request_logs.attempts_json（结构化）"
        : "数据源：attempts 兼容接口";
    }
    if (parsedAttemptsJson.ok) return "数据源：request_logs.attempts_json";
    return "数据源：尝试 JSON（原始）";
  }, [attemptLogs.length, attemptLogsLoading, parsedAttemptsJson.ok]);

  if (attemptLogsLoading) {
    return (
      <div className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        <Spinner size="sm" />
        加载中…
      </div>
    );
  }

  if (!attempts) {
    return <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">无故障切换尝试。</div>;
  }

  if (attempts.length === 0) {
    return <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">无故障切换尝试。</div>;
  }

  const startAttempt = attempts[0] ?? null;
  const finalAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
  const startProviderLabel = startAttempt
    ? startAttempt.provider_name && startAttempt.provider_name !== "未知"
      ? startAttempt.provider_name
      : `未知（id=${startAttempt.provider_id}）`
    : "—";
  const finalProviderLabel = finalAttempt
    ? finalAttempt.provider_name && finalAttempt.provider_name !== "未知"
      ? finalAttempt.provider_name
      : `未知（id=${finalAttempt.provider_id}）`
    : "—";
  const finalSuccess = finalAttempt ? finalAttempt.outcome === "success" : false;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
        <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1">
          起始供应商：
          <span className="font-medium text-slate-800 dark:text-slate-200">
            {startProviderLabel}
          </span>
        </span>
        <span className="text-slate-400 dark:text-slate-500">→</span>
        <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1">
          最终供应商：
          <span className="font-medium text-slate-800 dark:text-slate-200">
            {finalProviderLabel}
          </span>
        </span>
        <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1">
          共尝试 {attempts.length} 次
        </span>
        {finalAttempt ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 font-medium",
              finalSuccess
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
            )}
          >
            {finalSuccess ? "最终成功" : "最终失败"}
          </span>
        ) : null}
        <span className="text-slate-400 dark:text-slate-500">{dataSourceLabel}</span>
        {attemptLogs.length === 0 && parsedAttemptsJson.ok ? (
          <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1 font-medium text-slate-700 dark:text-slate-300">
            当前显示的是摘要链路，未拿到逐次尝试日志
          </span>
        ) : null}
        {attemptsJson && !parsedAttemptsJson.ok ? (
          <span className="rounded-full bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1 font-medium text-amber-700 dark:text-amber-400">
            尝试 JSON 解析失败
          </span>
        ) : null}
      </div>

      <div className="relative pl-8">
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-700" />
        <div className="space-y-4">
          {attempts.map((attempt) => {
            const success = attempt.outcome === "success";
            const skipped = attempt.outcome === "skipped";
            const isFinal = Boolean(
              finalAttempt && attempt.attempt_index === finalAttempt.attempt_index
            );
            const providerLabel =
              attempt.provider_name && attempt.provider_name !== "未知"
                ? attempt.provider_name
                : `未知（id=${attempt.provider_id}）`;
            const reasonText = buildAttemptReason(attempt, attempts.length > 1);
            const selectionText = mapSelectionMethod(attempt.selection_method?.trim() ?? null);
            const reasonCodeText = mapReasonCode(attempt.reason_code?.trim() ?? null);
            const decisionText = mapDecision(attempt.decision?.trim() ?? null);

            return (
              <div
                key={`${attempt.attempt_index}-${attempt.provider_id}-${attempt.base_url}`}
                className="relative"
              >
                <div
                  className={cn(
                    "absolute -left-8 top-4 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white text-sm font-semibold shadow-sm dark:bg-slate-900",
                    success
                      ? "border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400"
                      : skipped
                        ? "border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-300"
                        : "border-rose-300 text-rose-600 dark:border-rose-700 dark:text-rose-400"
                  )}
                >
                  {attempt.attempt_index}
                </div>

                <div
                  className={cn(
                    "rounded-2xl border bg-white px-4 py-4 shadow-sm dark:bg-slate-800/90",
                    isFinal
                      ? success
                        ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-900/20"
                        : skipped
                          ? "border-slate-200 bg-slate-50/50 dark:border-slate-600 dark:bg-slate-700/20"
                          : "border-rose-200 bg-rose-50/50 dark:border-rose-700 dark:bg-rose-900/20"
                      : "border-slate-200 dark:border-slate-700"
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                          {success
                            ? `请求成功：${providerLabel}`
                            : skipped
                              ? `跳过：${providerLabel}`
                              : attempts.length > 1
                                ? `重试/切换：${providerLabel}`
                                : `请求失败：${providerLabel}`}
                        </span>
                        {attempt.attempt_duration_ms != null ? (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            +{attempt.attempt_duration_ms}ms
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {reasonText}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {attempt.status != null ? (
                          <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1">
                            HTTP {attempt.status}
                          </span>
                        ) : null}
                        {selectionText ? (
                          <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1">
                            {selectionText}
                          </span>
                        ) : null}
                        {reasonCodeText ? (
                          <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1">
                            {reasonCodeText}
                          </span>
                        ) : null}
                        {decisionText ? (
                          <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1">
                            {decisionText}
                          </span>
                        ) : null}
                        {attempt.error_code ? (
                          <span className="rounded-full bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1 font-medium text-amber-700 dark:text-amber-400">
                            {getErrorCodeLabel(attempt.error_code)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium",
                          success
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : skipped
                              ? "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        )}
                      >
                        {success ? "成功" : skipped ? "已跳过" : "未成功"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
