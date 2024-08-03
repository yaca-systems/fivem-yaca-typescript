import { sleep } from "@yaca-voice/common";
import EventEmitter2 from "eventemitter2";

/**
 * The WebSocket class handles the communication between the nui and the client.
 */
export class WebSocket extends EventEmitter2 {
  public readyState = 0;
  nuiReady = false;
  initialized = false;

  /**
   * Creates an instance of the WebSocket class.
   */
  constructor() {
    super();

    RegisterNuiCallbackType("YACA_OnMessage");
    RegisterNuiCallbackType("YACA_OnConnected");
    RegisterNuiCallbackType("YACA_OnDisconnected");

    on("__cfx_nui:YACA_OnMessage", (data: object, cb: (data: unknown) => void) => {
      this.emit("message", data);
      cb({});
    });

    on("__cfx_nui:YACA_OnConnected", (_: unknown, cb: (data: unknown) => void) => {
      this.readyState = 1;
      this.emit("open");
      cb({});
    });

    on("__cfx_nui:YACA_OnDisconnected", (data: { code: number; reason: string }, cb: (data: unknown) => void) => {
      this.readyState = 3;
      this.emit("close", data.code, data.reason);
      cb({});
    });
  }

  /**
   * Sends the message to the nui that the websocket should connect.
   */
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

  /**
   * Sends the message to the nui that the websocket should disconnect.
   *
   * @param data - The data to send.
   */
  send(data: object) {
    if (this.readyState !== 1) {
      return;
    }

    SendNuiMessage(
      JSON.stringify({
        action: "command",
        data,
      }),
    );
  }

  /**
   * Sends the message to the nui that the websocket should disconnect.
   */
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
