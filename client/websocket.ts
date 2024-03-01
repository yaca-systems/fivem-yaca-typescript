import { EventEmitter } from "events";
import { Wait } from "../common/utils";

export class WebSocket extends EventEmitter {
  public readyState: number = 0;
  nuiReady: boolean = false;
  initialized: boolean = false;

  constructor() {
    super();
    console.log("WebSocket created");

    RegisterNuiCallbackType("YACA_OnNuiReady");
    RegisterNuiCallbackType("YACA_OnMessage");
    RegisterNuiCallbackType("YACA_OnError");
    RegisterNuiCallbackType("YACA_OnConnected");
    RegisterNuiCallbackType("YACA_OnDisconnected");

    on(
      "__cfx_nui:YACA_OnNuiReady",
      (_: unknown, cb: (data: unknown) => void) => {
        this.nuiReady = true;
        cb({});
      },
    );

    on(
      "__cfx_nui:YACA_OnMessage",
      (data: object, cb: (data: unknown) => void) => {
        this.emit("message", data);
        cb({});
      },
    );

    on(
      "__cfx_nui:YACA_OnError",
      (data: { reason: string }, cb: (data: unknown) => void) => {
        this.emit("error", data.reason);
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
    console.log("Starting WebSocket");
    while (!this.nuiReady) {
      console.log("Waiting for NUI to be ready");
      await Wait(0);
    }

    SendNuiMessage(
      JSON.stringify({
        action: "connect",
      }),
    );
  }

  send(data: object) {
    const nuiMessage = JSON.stringify({
      action: "command",
      data: data,
    });

    console.log("Sending NUI message", nuiMessage);

    SendNuiMessage(nuiMessage);
  }

  close() {
    SendNuiMessage(
      JSON.stringify({
        action: "close",
      }),
    );
  }
}
