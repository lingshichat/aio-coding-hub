import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { settingsGet, settingsSet } from "../../services/settings";
import { settingsCircuitBreakerNoticeSet } from "../../services/settingsCircuitBreakerNotice";
import { settingsCodexSessionIdCompletionSet } from "../../services/settingsCodexSessionIdCompletion";
import { settingsGatewayRectifierSet } from "../../services/settingsGatewayRectifier";
import { createTestAppSettings } from "../../test/fixtures/settings";
import { createQueryWrapper, createTestQueryClient } from "../../test/utils/reactQuery";
import { setTauriRuntime } from "../../test/utils/tauriRuntime";
import { settingsKeys } from "../keys";
import {
  useSettingsCircuitBreakerNoticeSetMutation,
  useSettingsCodexSessionIdCompletionSetMutation,
  useSettingsGatewayRectifierSetMutation,
  useSettingsQuery,
  useSettingsSetMutation,
} from "../settings";

vi.mock("../../services/settings", async () => {
  const actual =
    await vi.importActual<typeof import("../../services/settings")>("../../services/settings");
  return { ...actual, settingsGet: vi.fn(), settingsSet: vi.fn() };
});
vi.mock("../../services/settingsGatewayRectifier", async () => {
  const actual = await vi.importActual<typeof import("../../services/settingsGatewayRectifier")>(
    "../../services/settingsGatewayRectifier"
  );
  return { ...actual, settingsGatewayRectifierSet: vi.fn() };
});
vi.mock("../../services/settingsCircuitBreakerNotice", async () => {
  const actual = await vi.importActual<
    typeof import("../../services/settingsCircuitBreakerNotice")
  >("../../services/settingsCircuitBreakerNotice");
  return { ...actual, settingsCircuitBreakerNoticeSet: vi.fn() };
});
vi.mock("../../services/settingsCodexSessionIdCompletion", async () => {
  const actual = await vi.importActual<
    typeof import("../../services/settingsCodexSessionIdCompletion")
  >("../../services/settingsCodexSessionIdCompletion");
  return { ...actual, settingsCodexSessionIdCompletionSet: vi.fn() };
});

describe("query/settings", () => {
  it("useSettingsQuery respects enabled=false", () => {
    setTauriRuntime();
    vi.mocked(settingsGet).mockClear();

    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);

    renderHook(() => useSettingsQuery({ enabled: false }), { wrapper });

    expect(settingsGet).not.toHaveBeenCalled();
  });

  it("calls settingsGet with tauri runtime", async () => {
    setTauriRuntime();
    vi.mocked(settingsGet).mockResolvedValue(createTestAppSettings());

    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);

    renderHook(() => useSettingsQuery(), { wrapper });

    await waitFor(() => {
      expect(settingsGet).toHaveBeenCalled();
    });
  });

  it("useSettingsQuery enters error state when settingsGet rejects", async () => {
    setTauriRuntime();
    vi.mocked(settingsGet).mockRejectedValue(new Error("settings query boom"));

    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);

    const { result } = renderHook(() => useSettingsQuery(), { wrapper });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("useSettingsSetMutation updates cache and invalidates on settle", async () => {
    setTauriRuntime();

    const updated = createTestAppSettings({ preferred_port: 40000 });
    vi.mocked(settingsSet).mockResolvedValue(updated);

    const client = createTestQueryClient();
    client.setQueryData(settingsKeys.get(), createTestAppSettings());
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = createQueryWrapper(client);

    const { result } = renderHook(() => useSettingsSetMutation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        preferredPort: 40000,
        autoStart: false,
        trayEnabled: true,
        logRetentionDays: 30,
        providerCooldownSeconds: 30,
        providerBaseUrlPingCacheTtlSeconds: 60,
        upstreamFirstByteTimeoutSeconds: 0,
        upstreamStreamIdleTimeoutSeconds: 0,
        upstreamRequestTimeoutNonStreamingSeconds: 0,
        enableCacheAnomalyMonitor: false,
        failoverMaxAttemptsPerProvider: 5,
        failoverMaxProvidersToTry: 5,
        circuitBreakerFailureThreshold: 5,
        circuitBreakerOpenDurationMinutes: 30,
      });
    });

    expect(client.getQueryData(settingsKeys.get())).toEqual(updated);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: settingsKeys.get() });
  });

  it("useSettingsSetMutation keeps cache when service returns null", async () => {
    setTauriRuntime();

    const initial = createTestAppSettings();
    vi.mocked(settingsSet).mockResolvedValue(null as any);

    const client = createTestQueryClient();
    client.setQueryData(settingsKeys.get(), initial);
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = createQueryWrapper(client);

    const { result } = renderHook(() => useSettingsSetMutation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        preferredPort: 40000,
        autoStart: false,
        trayEnabled: true,
        logRetentionDays: 30,
        providerCooldownSeconds: 30,
        providerBaseUrlPingCacheTtlSeconds: 60,
        upstreamFirstByteTimeoutSeconds: 0,
        upstreamStreamIdleTimeoutSeconds: 0,
        upstreamRequestTimeoutNonStreamingSeconds: 0,
        enableCacheAnomalyMonitor: false,
        failoverMaxAttemptsPerProvider: 5,
        failoverMaxProvidersToTry: 5,
        circuitBreakerFailureThreshold: 5,
        circuitBreakerOpenDurationMinutes: 30,
      });
    });

    expect(client.getQueryData(settingsKeys.get())).toEqual(initial);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: settingsKeys.get() });
  });

  it("useSettingsGatewayRectifierSetMutation updates cache", async () => {
    setTauriRuntime();

    const updated = createTestAppSettings({ enable_response_fixer: false });
    vi.mocked(settingsGatewayRectifierSet).mockResolvedValue(updated);

    const client = createTestQueryClient();
    client.setQueryData(settingsKeys.get(), createTestAppSettings());
    const wrapper = createQueryWrapper(client);

    const { result } = renderHook(() => useSettingsGatewayRectifierSetMutation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ enable_response_fixer: false } as any);
    });

    expect(client.getQueryData(settingsKeys.get())).toEqual(updated);
  });

  it("useSettingsGatewayRectifierSetMutation keeps cache when service returns null", async () => {
    setTauriRuntime();

    const initial = createTestAppSettings();
    vi.mocked(settingsGatewayRectifierSet).mockResolvedValue(null as any);

    const client = createTestQueryClient();
    client.setQueryData(settingsKeys.get(), initial);
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = createQueryWrapper(client);

    const { result } = renderHook(() => useSettingsGatewayRectifierSetMutation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ enable_response_fixer: false } as any);
    });

    expect(client.getQueryData(settingsKeys.get())).toEqual(initial);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: settingsKeys.get() });
  });

  it("useSettingsCircuitBreakerNoticeSetMutation updates cache", async () => {
    setTauriRuntime();

    const updated = createTestAppSettings({ enable_circuit_breaker_notice: true });
    vi.mocked(settingsCircuitBreakerNoticeSet).mockResolvedValue(updated);

    const client = createTestQueryClient();
    client.setQueryData(settingsKeys.get(), createTestAppSettings());
    const wrapper = createQueryWrapper(client);

    const { result } = renderHook(() => useSettingsCircuitBreakerNoticeSetMutation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(true);
    });

    expect(client.getQueryData(settingsKeys.get())).toEqual(updated);
  });

  it("useSettingsCircuitBreakerNoticeSetMutation keeps cache when service returns null", async () => {
    setTauriRuntime();

    const initial = createTestAppSettings();
    vi.mocked(settingsCircuitBreakerNoticeSet).mockResolvedValue(null as any);

    const client = createTestQueryClient();
    client.setQueryData(settingsKeys.get(), initial);
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = createQueryWrapper(client);

    const { result } = renderHook(() => useSettingsCircuitBreakerNoticeSetMutation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(true);
    });

    expect(client.getQueryData(settingsKeys.get())).toEqual(initial);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: settingsKeys.get() });
  });

  it("useSettingsCodexSessionIdCompletionSetMutation updates cache", async () => {
    setTauriRuntime();

    const updated = createTestAppSettings({ enable_codex_session_id_completion: false });
    vi.mocked(settingsCodexSessionIdCompletionSet).mockResolvedValue(updated);

    const client = createTestQueryClient();
    client.setQueryData(settingsKeys.get(), createTestAppSettings());
    const wrapper = createQueryWrapper(client);

    const { result } = renderHook(() => useSettingsCodexSessionIdCompletionSetMutation(), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync(false);
    });

    expect(client.getQueryData(settingsKeys.get())).toEqual(updated);
  });

  it("useSettingsCodexSessionIdCompletionSetMutation keeps cache when service returns null", async () => {
    setTauriRuntime();

    const initial = createTestAppSettings();
    vi.mocked(settingsCodexSessionIdCompletionSet).mockResolvedValue(null as any);

    const client = createTestQueryClient();
    client.setQueryData(settingsKeys.get(), initial);
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = createQueryWrapper(client);

    const { result } = renderHook(() => useSettingsCodexSessionIdCompletionSetMutation(), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync(false);
    });

    expect(client.getQueryData(settingsKeys.get())).toEqual(initial);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: settingsKeys.get() });
  });
});
