import { EventEmitter } from "events";

export class WebSocket extends EventEmitter {
  public readyState: number = 0;
  nuiReady: boolean = false;

  constructor() {
    super();
    console.log("WebSocket created");

    RegisterNuiCallbackType("YACA_OnNuiReady");
    RegisterNuiCallbackType("YACA_OnMessage");
    RegisterNuiCallbackType("YACA_OnError");
    RegisterNuiCallbackType("YACA_OnConnected");
    RegisterNuiCallbackType("YACA_OnDisconnected");

    on("__cfx_nui:YACA_OnNuiReady", () => {
      this.nuiReady = true;
    });

    on("__cfx_nui:YACA_OnMessage", (data: object) => {
      this.emit("message", data);
    });

    on("__cfx_nui:YACA_OnError", (data: { reason: string }) => {
      this.emit("error", data.reason);
    });

    on("__cfx_nui:YACA_OnConnected", () => {
      this.readyState = 1;
      this.emit("open");
    });

    on(
      "__cfx_nui:YACA_OnDisconnected",
      (data: { code: number; reason: string }) => {
        this.readyState = 3;
        this.emit("close", data.code, data.reason);
      },
    );
  }

  start() {
    while (!this.nuiReady) {
      Wait(0);
    }

    SendNuiMessage(
      JSON.stringify({
        action: "connect",
      }),
    );
  }

  send(data: string) {
    SendNuiMessage(
      JSON.stringify({
        action: "command",
        data,
      }),
    );
  }

  close() {
    SendNuiMessage(
      JSON.stringify({
        action: "close",
      }),
    );
  }
}
