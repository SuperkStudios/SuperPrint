function hex(ptr, len) {
  if (!ptr || ptr.isNull() || len <= 0) return "";
  const data = new Uint8Array(ptr.readByteArray(len));
  return Array.from(data).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function utf8(obj) {
  try {
    return new ObjC.Object(obj).toString();
  } catch (_) {
    return "";
  }
}

function nsdataInfo(obj) {
  try {
    const data = new ObjC.Object(obj);
    const len = Number(data.length());
    const ptr = data.bytes();
    return { len, hex: hex(ptr, Math.min(len, 512)) };
  } catch (_) {
    return null;
  }
}

function hook(cls, sel, cb) {
  if (!ObjC.available || !ObjC.classes[cls] || !ObjC.classes[cls][sel]) {
    console.log(`missing ${cls} ${sel}`);
    return;
  }
  Interceptor.attach(ObjC.classes[cls][sel].implementation, cb);
  console.log(`hooked ${cls} ${sel}`);
}

hook("FlutterBasicMessageChannel", "- sendMessage:reply:", {
  onEnter(args) {
    const message = nsdataInfo(args[2]);
    console.log(`BASIC sendMessage messageClass=${new ObjC.Object(args[2]).$className} len=${message?.len ?? "?"} hex=${message?.hex ?? ""}`);
  },
});

hook("FlutterMethodChannel", "- invokeMethod:arguments:result:", {
  onEnter(args) {
    console.log(`METHOD invoke method=${utf8(args[2])} argsClass=${args[3].isNull() ? "nil" : new ObjC.Object(args[3]).$className} args=${args[3].isNull() ? "" : new ObjC.Object(args[3]).toString()}`);
  },
});

hook("FlutterStandardMethodCodec", "- decodeMethodCall:", {
  onEnter(args) {
    const message = nsdataInfo(args[2]);
    this.messageLen = message?.len ?? 0;
    this.messageHex = message?.hex ?? "";
  },
  onLeave(retval) {
    if (retval.isNull()) return;
    try {
      const call = new ObjC.Object(retval);
      const method = call.method().toString();
      if (!method.toLowerCase().includes("ble") &&
          !method.toLowerCase().includes("write") &&
          !method.toLowerCase().includes("send") &&
          !method.toLowerCase().includes("connect") &&
          !method.toLowerCase().includes("printer")) return;
      const args = call.arguments();
      console.log(`DECODE method=${method} argsClass=${args.isNull() ? "nil" : new ObjC.Object(args).$className} args=${args.isNull() ? "" : new ObjC.Object(args).toString()} msgLen=${this.messageLen} msgHex=${this.messageHex}`);
    } catch (e) {
      console.log(`DECODE error ${e} msgLen=${this.messageLen} msgHex=${this.messageHex}`);
    }
  },
});

hook("FlutterEngine", "- sendOnChannel:message:binaryReply:", {
  onEnter(args) {
    const channel = utf8(args[2]);
    if (!channel.includes("ble") && !channel.includes("Ble") && !channel.includes("printer") && !channel.includes("Printer")) return;
    const message = nsdataInfo(args[3]);
    console.log(`ENGINE send channel=${channel} len=${message?.len ?? "?"} hex=${message?.hex ?? ""}`);
  },
});

hook("FlutterViewController", "- sendOnChannel:message:binaryReply:", {
  onEnter(args) {
    const channel = utf8(args[2]);
    if (!channel.includes("ble") && !channel.includes("Ble") && !channel.includes("printer") && !channel.includes("Printer")) return;
    const message = nsdataInfo(args[3]);
    console.log(`VC send channel=${channel} len=${message?.len ?? "?"} hex=${message?.hex ?? ""}`);
  },
});
