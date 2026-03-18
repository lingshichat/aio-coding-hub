// Usage:
// - Import helpers/components from this module for Home "request logs" list and "realtime traces" cards.
// - Designed to keep status badge / error_code label / session reuse tooltip consistent across the Home page.

import { GatewayErrorCodes } from "../../constants/gatewayErrorCodes";
import type { CliKey } from "../../services/providers";
import type { RequestLogRouteHop } from "../../services/requestLogs";
import { Tooltip } from "../../ui/Tooltip";
import { RouteTooltipContent } from "./RouteTooltipContent";

const ERROR_CODE_LABELS: Record<string, string> = {
  [GatewayErrorCodes.ALL_PROVIDERS_UNAVAILABLE]: "全部不可用",
  [GatewayErrorCodes.UPSTREAM_ALL_FAILED]: "全部失败",
  [GatewayErrorCodes.NO_ENABLED_PROVIDER]: "无供应商",
  [GatewayErrorCodes.UPSTREAM_TIMEOUT]: "上游超时",
  [GatewayErrorCodes.UPSTREAM_CONNECT_FAILED]: "连接失败",
  [GatewayErrorCodes.UPSTREAM_5XX]: "上游5XX",
  [GatewayErrorCodes.UPSTREAM_4XX]: "上游4XX",
  [GatewayErrorCodes.UPSTREAM_READ_ERROR]: "读取错误",
  [GatewayErrorCodes.STREAM_ERROR]: "流错误",
  [GatewayErrorCodes.STREAM_ABORTED]: "流中断",
  [GatewayErrorCodes.STREAM_IDLE_TIMEOUT]: "流空闲超时",
  [GatewayErrorCodes.REQUEST_ABORTED]: "请求中断",
  [GatewayErrorCodes.INTERNAL_ERROR]: "内部错误",
  [GatewayErrorCodes.BODY_TOO_LARGE]: "请求过大",
  [GatewayErrorCodes.INVALID_CLI_KEY]: "无效CLI",
  [GatewayErrorCodes.INVALID_BASE_URL]: "无效URL",
  [GatewayErrorCodes.PORT_IN_USE]: "端口占用",
  [GatewayErrorCodes.RESPONSE_BUILD_ERROR]: "响应构建错误",
  [GatewayErrorCodes.PROVIDER_RATE_LIMITED]: "供应商限额",
  [GatewayErrorCodes.PROVIDER_CIRCUIT_OPEN]: "供应商熔断",
};

const CLIENT_ABORT_ERROR_CODES: ReadonlySet<string> = new Set([
  GatewayErrorCodes.STREAM_ABORTED,
  GatewayErrorCodes.REQUEST_ABORTED,
]);

const STATUS_TEXT_UNKNOWN = "状态未知";

const SESSION_REUSE_TOOLTIP =
  "同一 session_id 在 5 分钟 TTL 内优先复用上一次成功 provider，减少抖动/提升缓存命中";

export function getErrorCodeLabel(errorCode: string) {
  return ERROR_CODE_LABELS[errorCode] ?? errorCode;
}

export function SessionReuseBadge({ showCustomTooltip }: { showCustomTooltip: boolean }) {
  const className =
    "inline-flex items-center rounded-md bg-indigo-50/75 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:bg-indigo-900/25 dark:text-indigo-200 cursor-help";
  return showCustomTooltip ? (
    <Tooltip content={SESSION_REUSE_TOOLTIP}>
      <span className={className}>会话复用</span>
    </Tooltip>
  ) : (
    <span className={className} title={SESSION_REUSE_TOOLTIP}>
      会话复用
    </span>
  );
}

export function FreeBadge() {
  return (
    <span className="inline-flex items-center rounded-md bg-emerald-50/75 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:bg-emerald-900/25 dark:text-emerald-200">
      免费
    </span>
  );
}

export type StatusBadge = {
  text: string;
  semanticText: string;
  tone: string;
  title?: string;
  isError: boolean;
  isClientAbort: boolean;
  hasFailover: boolean;
};

export function computeStatusBadge(input: {
  status: number | null;
  errorCode: string | null;
  inProgress?: boolean;
  hasFailover?: boolean;
}): StatusBadge {
  if (input.inProgress) {
    return {
      text: "进行中",
      semanticText: "请求进行中",
      tone: "bg-accent/10 text-accent",
      isError: false,
      isClientAbort: false,
      hasFailover: !!input.hasFailover,
    };
  }

  const isClientAbort = !!(input.errorCode && CLIENT_ABORT_ERROR_CODES.has(input.errorCode));
  const hasFailover = !!input.hasFailover;
  const isSuccessStatus = input.status != null && input.status >= 200 && input.status < 400;
  const isError = input.status != null ? input.status >= 400 : input.errorCode != null;

  let text = STATUS_TEXT_UNKNOWN;
  let semanticText = STATUS_TEXT_UNKNOWN;

  if (isClientAbort) {
    text = input.status == null ? "已中断" : `${input.status} 已中断`;
    semanticText = "客户端已中断";
  } else if (isSuccessStatus && hasFailover) {
    text = input.status == null ? "切换后成功" : `${input.status} 切换后成功`;
    semanticText = "切换供应商后成功";
  } else if (isSuccessStatus) {
    text = input.status == null ? "成功" : `${input.status} 成功`;
    semanticText = "请求成功";
  } else if (isError) {
    text = input.status == null ? "失败" : `${input.status} 失败`;
    semanticText = "请求失败";
  }

  const tone = isClientAbort
    ? "bg-amber-50 text-amber-600 border border-amber-200/60 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700/60"
    : isSuccessStatus
      ? hasFailover
        ? "text-emerald-600 bg-emerald-50/50 border border-amber-300/60 dark:text-emerald-400 dark:bg-emerald-900/30 dark:border-amber-600/60"
        : "text-emerald-600 bg-emerald-50/50 dark:text-emerald-400 dark:bg-emerald-900/30"
      : isError
        ? "text-rose-600 bg-rose-50/50 dark:text-rose-400 dark:bg-rose-900/30"
        : "text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-700";

  const title = input.errorCode
    ? `${semanticText} · ${getErrorCodeLabel(input.errorCode)} (${input.errorCode})`
    : semanticText;

  return { text, semanticText, tone, title, isError, isClientAbort, hasFailover };
}

export function computeEffectiveInputTokens(
  cliKey: CliKey | string,
  inputTokens: number | null,
  cacheReadInputTokens: number | null
) {
  if (inputTokens == null) return null;
  const cacheRead = cacheReadInputTokens ?? 0;
  if (cliKey === "codex" || cliKey === "gemini") return Math.max(inputTokens - cacheRead, 0);
  return inputTokens;
}

export function buildRequestRouteMeta(input: {
  route: RequestLogRouteHop[] | null | undefined;
  status: number | null;
  hasFailover: boolean;
  attemptCount: number;
}) {
  const hops = input.route ?? [];
  if (hops.length === 0) {
    return {
      hasRoute: false,
      label: "链路",
      summary: "暂无链路信息",
      tooltipText: null as string | null,
      tooltipContent: null as React.ReactNode,
    };
  }

  const totalHopAttempts = hops.reduce((sum, h) => sum + (h.attempts ?? 1), 0);
  const skippedCount = Math.max(0, input.attemptCount - totalHopAttempts);
  const hasRetry = hops.some((h) => (h.attempts ?? 1) > 1);

  const summary = input.hasFailover
    ? `切换 ${input.attemptCount} 次后${input.status != null && input.status < 400 ? "成功" : "结束"}`
    : skippedCount > 0 && hasRetry
      ? `跳过 ${skippedCount} 个候选，并重试 ${input.attemptCount} 次`
      : skippedCount > 0
        ? `跳过 ${skippedCount} 个候选`
        : hasRetry
          ? `同一供应商重试 ${input.attemptCount} 次`
          : "直连完成";

  // 纯文本 fallback（用于 title 属性）
  const tooltipText = hops
    .map((hop, idx) => {
      const rawProviderName = hop.provider_name?.trim();
      const providerName =
        !rawProviderName || rawProviderName === "Unknown" ? "未知" : rawProviderName;
      const status = hop.status ?? (idx === hops.length - 1 ? input.status : null) ?? null;
      const statusText = status == null ? "状态未知" : String(status);
      const attemptsSuffix = hop.attempts && hop.attempts > 1 ? `，尝试 ${hop.attempts} 次` : "";
      if (hop.ok) return `${providerName}（${statusText}，成功${attemptsSuffix}）`;
      if (hop.skipped) return `${providerName}（已跳过${attemptsSuffix}）`;
      const errorCode = hop.error_code ?? null;
      const errorLabel = errorCode ? getErrorCodeLabel(errorCode) : "失败";
      return `${providerName}（${statusText}，${errorLabel}${attemptsSuffix}）`;
    })
    .join(" → ");

  let label = summary;
  if (input.hasFailover) {
    label = `切换 ${input.attemptCount} 次`;
  } else if (skippedCount > 0 && hasRetry) {
    label = `跳过 ${skippedCount} 个 + 重试`;
  } else if (skippedCount > 0) {
    label = `跳过 ${skippedCount} 个`;
  } else if (hasRetry) {
    label = `重试 ${input.attemptCount} 次`;
  }

  const tooltipContent = (
    <RouteTooltipContent
      hops={hops}
      finalStatus={input.status}
      summary={summary}
      skippedCount={skippedCount}
    />
  );

  return {
    hasRoute: true,
    label,
    summary,
    tooltipText,
    tooltipContent,
  };
}
