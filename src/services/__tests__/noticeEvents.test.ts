import { describe, expect, it, vi } from "vitest";
import { appEventNames } from "../../constants/appEvents";
import {
  tauriIsPermissionGranted,
  tauriListen,
  tauriSendNotification,
  tauriUnlisten,
} from "../../test/mocks/tauri";
import { setTauriRuntime } from "../../test/utils/tauriRuntime";

const logToConsoleMock = vi.hoisted(() => vi.fn());
const getNotificationSoundEnabledMock = vi.hoisted(() => vi.fn());
const playNotificationSoundMock = vi.hoisted(() => vi.fn());

vi.mock("../consoleLog", () => ({
  logToConsole: logToConsoleMock,
}));

vi.mock("../notificationSound", () => ({
  getNotificationSoundEnabled: getNotificationSoundEnabledMock,
  playNotificationSound: playNotificationSoundMock,
}));

describe("services/noticeEvents", () => {
  it("listens and sends notifications when permission is granted", async () => {
    setTauriRuntime();
    vi.resetModules();

    vi.mocked(tauriListen).mockResolvedValue(tauriUnlisten);
    vi.mocked(tauriIsPermissionGranted).mockResolvedValue(true);
    vi.mocked(tauriSendNotification).mockResolvedValue(undefined);
    getNotificationSoundEnabledMock.mockReturnValue(true);

    const { listenNoticeEvents } = await import("../noticeEvents");
    const unlisten = await listenNoticeEvents();

    expect(tauriListen).toHaveBeenCalledWith(appEventNames.notice, expect.any(Function));

    const handler = vi
      .mocked(tauriListen)
      .mock.calls.find((c) => c[0] === appEventNames.notice)?.[1];
    expect(handler).toBeTypeOf("function");

    await handler?.({ payload: { level: "info", title: "T", body: "B" } } as any);
    expect(playNotificationSoundMock).toHaveBeenCalledTimes(1);
    expect(tauriSendNotification).toHaveBeenCalledWith({
      title: "T",
      body: "B",
      silent: true,
    });

    unlisten();
    expect(tauriUnlisten).toHaveBeenCalled();
  });

  it("does not send notifications when permission is denied", async () => {
    setTauriRuntime();
    vi.resetModules();

    vi.mocked(tauriListen).mockResolvedValue(tauriUnlisten);
    vi.mocked(tauriIsPermissionGranted).mockResolvedValue(false);
    vi.mocked(tauriSendNotification).mockResolvedValue(undefined);
    getNotificationSoundEnabledMock.mockReturnValue(true);

    const { listenNoticeEvents } = await import("../noticeEvents");
    await listenNoticeEvents();

    const handler = vi
      .mocked(tauriListen)
      .mock.calls.find((c) => c[0] === appEventNames.notice)?.[1];
    await handler?.({ payload: { level: "info", title: "T", body: "B" } } as any);

    expect(playNotificationSoundMock).not.toHaveBeenCalled();
    expect(tauriSendNotification).not.toHaveBeenCalled();
  });

  it("logs error when sendNotification throws", async () => {
    setTauriRuntime();
    vi.resetModules();

    vi.mocked(tauriListen).mockResolvedValue(tauriUnlisten);
    vi.mocked(tauriIsPermissionGranted).mockResolvedValue(true);
    vi.mocked(tauriSendNotification).mockRejectedValue(new Error("notification failed"));
    getNotificationSoundEnabledMock.mockReturnValue(true);

    const { listenNoticeEvents } = await import("../noticeEvents");
    await listenNoticeEvents();

    const handler = vi
      .mocked(tauriListen)
      .mock.calls.find((c) => c[0] === appEventNames.notice)?.[1];
    expect(handler).toBeTypeOf("function");

    await handler?.({ payload: { level: "error", title: "T", body: "B" } } as any);

    expect(logToConsoleMock).toHaveBeenCalledWith(
      "error",
      "发送系统通知失败",
      expect.objectContaining({
        error: expect.stringContaining("notification failed"),
        level: "error",
        title: "T",
      })
    );
    expect(playNotificationSoundMock).toHaveBeenCalledTimes(1);
  });
});
