import type { Readable } from "node:stream";

type UpstreamFeed = {
  stream: Readable;
  contentType: string;
};

type FeedState = "disconnected" | "connecting" | "connected";

type FeedClient = ReadableStreamDefaultController<Uint8Array>;
type TrackedFeedClient = {
  controller: FeedClient;
  closed: boolean;
};

export class PrinterFeedRelay {
  private state: FeedState = "disconnected";
  private contentType = "multipart/x-mixed-replace";
  private clients = new Map<number, TrackedFeedClient>();
  private nextClientId = 1;
  private connecting: Promise<void> | null = null;
  private upstream: Readable | null = null;
  private lastError: string | null = null;
  private idleDisconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disconnecting = false;

  constructor(
    private readonly openUpstream: (url: string) => Promise<UpstreamFeed>,
    private readonly options: { idleDisconnectMs?: number } = {}
  ) {}

  getState() {
    return {
      state: this.state,
      clientCount: this.clients.size,
      contentType: this.contentType,
      lastError: this.lastError
    };
  }

  async openClient(url: string, options?: { beforeConnect?: () => Promise<void> }) {
    await this.ensureConnected(url, options);

    let clientId: number | null = null;
    const clientStream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.clearIdleDisconnect();
        clientId = this.nextClientId++;
        this.clients.set(clientId, { controller, closed: false });
      },
      cancel: () => {
        if (clientId !== null) this.closeClient(clientId);
        this.scheduleIdleDisconnect();
      }
    });

    return {
      stream: clientStream,
      contentType: this.contentType
    };
  }

  private async ensureConnected(url: string, options?: { beforeConnect?: () => Promise<void> }) {
    if (this.state === "connected") return;
    if (this.connecting) return this.connecting;

    this.state = "connecting";
    this.connecting = this.connect(url, options).finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async connect(url: string, options?: { beforeConnect?: () => Promise<void> }) {
    try {
      await options?.beforeConnect?.();
      const upstream = await this.openUpstream(url);
      this.upstream = upstream.stream;
      this.contentType = upstream.contentType;
      this.state = "connected";
      this.lastError = null;

      upstream.stream.on("data", (chunk: Buffer) => this.broadcast(new Uint8Array(chunk)));
      upstream.stream.once("end", () => this.disconnect());
      upstream.stream.once("close", () => this.disconnect());
      upstream.stream.once("error", (error) => this.disconnect(error instanceof Error ? error.message : String(error)));
    } catch (error) {
      this.disconnect(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private broadcast(chunk: Uint8Array) {
    for (const [id, client] of this.clients) {
      if (client.closed) continue;
      try {
        client.controller.enqueue(chunk);
      } catch {
        this.closeClient(id);
      }
    }
  }

  private disconnect(error?: string) {
    if (this.disconnecting) return;
    if (this.state === "disconnected" && !this.upstream && this.clients.size === 0) {
      this.lastError = error ?? null;
      return;
    }
    this.disconnecting = true;
    this.clearIdleDisconnect();
    const upstream = this.upstream;
    this.upstream = null;
    try {
      if (upstream && !upstream.destroyed) upstream.destroy();
    } catch {
      // The upstream may already be closing itself.
    }
    this.state = "disconnected";
    this.lastError = error ?? null;
    for (const id of Array.from(this.clients.keys())) {
      this.closeClient(id, { closeController: true });
    }
    this.disconnecting = false;
  }

  private closeClient(id: number, options: { closeController?: boolean } = {}) {
    const client = this.clients.get(id);
    if (!client) return;
    this.clients.delete(id);
    if (client.closed) return;
    client.closed = true;
    if (!options.closeController) return;
    try {
      client.controller.close();
    } catch {
      // The browser may already have closed this response.
    }
  }

  private scheduleIdleDisconnect() {
    if (this.clients.size > 0 || this.state !== "connected") return;
    this.clearIdleDisconnect();
    this.idleDisconnectTimer = setTimeout(() => {
      try {
        if (this.clients.size === 0) this.disconnect();
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
        this.state = "disconnected";
      }
    }, this.options.idleDisconnectMs ?? 30000);
  }

  private clearIdleDisconnect() {
    if (!this.idleDisconnectTimer) return;
    clearTimeout(this.idleDisconnectTimer);
    this.idleDisconnectTimer = null;
  }
}
