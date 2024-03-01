let isConnected = false;
let webSocket = null;

function connect() {
  console.log("[YaCA-Websocket] Trying to Connect to YaCA WebSocket...");

  try {
    webSocket = new window.WebSocket(`ws://127.0.0.1:30125/`);
  } catch {
    connect();
  }

  webSocket.onmessage = (event) => {
    if (!event) return;
    sendNuiData("YACA_OnMessage", event.data);
  };

  webSocket.onerror = (event) => {
    sendNuiData("YACA_OnError", event);
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

function runCommand(command) {
  if (!webSocket) {
    return;
  }

  if (webSocket.readyState !== WebSocket.OPEN) {
    return;
  }

  webSocket.send(command);
}

function sendNuiData(event, data) {
  if (typeof data === "undefined") {
    $.post(`http://${GetParentResourceName()}/${event}`);
  } else {
    $.post(`http://${GetParentResourceName()}/${event}`, data);
  }
}

$(function () {
  window.addEventListener("DOMContentLoaded", function () {
    sendNuiData("YACA_OnNuiReady");
  });

  window.addEventListener("beforeunload", function () {
    if (webSocket) webSocket.close();
  });

  window.addEventListener("unload", function () {
    if (webSocket) webSocket.close();
  });

  window.addEventListener(
    "message",
    function (event) {
      switch (event.data.action) {
        case "connect":
          connect();
          break;
        case "command":
          runCommand(event.data.data);
          break;
        case "close":
          if (webSocket) webSocket.close();
          break;
      }
    },
    false,
  );
});
