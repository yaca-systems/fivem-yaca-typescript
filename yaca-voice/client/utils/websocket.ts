import { EventEmitter } from "events";
import { sleep } from "common/index";

export class WebSocket extends EventEmitter {
  public readyState = 0;
  nuiReady = false;
  initialized = false;

  constructor() {
    super();
    console.log("WebSocket created");

    RegisterNuiCallbackType("YACA_OnMessage");
    RegisterNuiCallbackType("YACA_OnConnected");
    RegisterNuiCallbackType("YACA_OnDisconnected");

    on(
      "__cfx_nui:YACA_OnMessage",
      (data: object, cb: (data: unknown) => void) => {
        this.emit("message", data);
        cb({});
      },
    );

    on(
      "__cfx_nui:YACA_OnConnected",
      (_: unknown, cb: (data: unknown) => void) => {
        this.readyState = 1;
        this.emit("open");
        cb({});
      },
    );

    on(
      "__cfx_nui:YACA_OnDisconnected",
      (data: { code: number; reason: string }, cb: (data: unknown) => void) => {
        this.readyState = 3;
        this.emit("close", data.code, data.reason);
        cb({});
      },
    );
  }

  async start() {
    while (!this.nuiReady) {
      await sleep(100);
    }

    SendNuiMessage(
      JSON.stringify({
        action: "connect",
      }),
    );
  }

  send(data: object) {
    if (this.readyState !== 1) {
      return;
    }

    const nuiMessage = JSON.stringify({
      action: "command",
      data,
    });

    SendNuiMessage(nuiMessage);
  }

  close() {
    if (this.readyState === 3) {
      return;
    }

    SendNuiMessage(
      JSON.stringify({
        action: "close",
      }),
    );
  }
}
