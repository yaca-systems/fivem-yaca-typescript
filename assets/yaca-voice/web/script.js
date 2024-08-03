let webSocket = null;

/**
 * Connect to the YaCA voice plugin
 */
function connect() {
  console.log("[YaCA-Websocket] Trying to Connect to YaCA WebSocket...");

  try {
    webSocket = new window.WebSocket("ws://127.0.0.1:30125/");
  } catch {
    connect();
  }

  webSocket.onmessage = (event) => {
    if (!event) return;
    sendNuiData("YACA_OnMessage", event.data);
  };

  webSocket.onopen = (event) => {
    if (!event) return;
    sendNuiData("YACA_OnConnected");
  };

  webSocket.onclose = (event) => {
    if (!event) return;

    sendNuiData("YACA_OnDisconnected", {
      code: event.code,
      reason: event.reason,
    });

    setTimeout(() => {
      connect();
    }, 1000);
  };
}

/**
 * Send a command to the YaCA voice plugin
 *
 * @param command - The command to send as a object
 */
function runCommand(command) {
  if (!webSocket || webSocket.readyState !== WebSocket.OPEN) {
    return;
  }

  webSocket.send(JSON.stringify(command));
}

/**
 * Send a NUI message to the client
 *
 * @param event - The name of the callback
 * @param data - The data to send
 */
function sendNuiData(event, data = {}) {
  fetch(`https://${GetParentResourceName()}/${event}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(data),
  }).catch((error) =>
    console.error("[YaCA-Websocket] Error sending NUI Message:", error),
  );
}

$(() => {
  window.addEventListener("DOMContentLoaded", () => {
    sendNuiData("YACA_OnNuiReady");
  });

  window.addEventListener("message", (event) => {
    if (event.data.action === "connect") {
      connect();
    } else if (event.data.action === "command") {
      runCommand(event.data.data);
    } else if (event.data.action === "close") {
      if (webSocket) webSocket.close();
    } else {
      console.error("[YaCA-Websocket] Unknown message:", event.data);
    }
  })
});
