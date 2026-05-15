import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { PrinterFeedRelay } from "./printer-feed-relay";

describe("printer feed relay", () => {
  it("shares one upstream camera connection across multiple clients", async () => {
    const upstream = new PassThrough();
    const open = vi.fn().mockResolvedValue({ stream: upstream, contentType: "multipart/x-mixed-replace; boundary=frame" });
    const relay = new PrinterFeedRelay(open);

    const first = await relay.openClient("http://printer/video");
    const second = await relay.openClient("http://printer/video");

    expect(open).toHaveBeenCalledTimes(1);
    expect(first.contentType).toBe("multipart/x-mixed-replace; boundary=frame");
    expect(second.contentType).toBe("multipart/x-mixed-replace; boundary=frame");
    expect(relay.getState()).toMatchObject({ state: "connected", clientCount: 2 });
  });

  it("reconnects only after the upstream stream disconnects", async () => {
    const firstUpstream = new PassThrough();
    const secondUpstream = new PassThrough();
    const open = vi.fn()
      .mockResolvedValueOnce({ stream: firstUpstream, contentType: "multipart/x-mixed-replace" })
      .mockResolvedValueOnce({ stream: secondUpstream, contentType: "multipart/x-mixed-replace" });
    const relay = new PrinterFeedRelay(open);

    await relay.openClient("http://printer/video");
    await relay.openClient("http://printer/video");
    firstUpstream.destroy();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await relay.openClient("http://printer/video");

    expect(open).toHaveBeenCalledTimes(2);
    expect(relay.getState()).toMatchObject({ state: "connected" });
  });

  it("closes the upstream when all clients disconnect", async () => {
    const upstream = new PassThrough();
    const open = vi.fn().mockResolvedValue({ stream: upstream, contentType: "multipart/x-mixed-replace" });
    const relay = new PrinterFeedRelay(open, { idleDisconnectMs: 0 });
    const client = await relay.openClient("http://printer/video");
    const reader = client.stream.getReader();

    void reader.cancel();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(relay.getState()).toMatchObject({ state: "disconnected", clientCount: 0 });
    expect(upstream.destroyed).toBe(true);
  });

  it("does not close a browser stream controller more than once during disconnect races", async () => {
    const upstream = new PassThrough();
    const open = vi.fn().mockResolvedValue({ stream: upstream, contentType: "multipart/x-mixed-replace" });
    const relay = new PrinterFeedRelay(open, { idleDisconnectMs: 0 });
    const unhandled = vi.fn();
    process.once("unhandledRejection", unhandled);

    const client = await relay.openClient("http://printer/video");
    const reader = client.stream.getReader();

    await reader.cancel();
    upstream.destroy();
    await new Promise((resolve) => setTimeout(resolve, 5));

    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(relay.getState()).toMatchObject({ state: "disconnected", clientCount: 0 });
  });
});
