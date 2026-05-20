const blockChannels = {};
const hookedInvokes = new Set();

function hex(ptr, len) {
  if (!ptr || ptr.isNull() || len <= 0) return "";
  const data = new Uint8Array(ptr.readByteArray(len));
  return Array.from(data).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function nsstr(obj) {
  try { return new ObjC.Object(obj).toString(); } catch (_) { return ""; }
}

function nsdata(obj, limit = 2048) {
  try {
    if (obj.isNull()) return { len: 0, hex: "" };
    const data = new ObjC.Object(obj);
    const len = Number(data.length());
    return { len, hex: hex(data.bytes(), Math.min(len, limit)) };
  } catch (_) {
    return { len: -1, hex: "" };
  }
}

function shouldWatch(channel) {
  const c = channel.toLowerCase();
  return c.includes("ble") || c.includes("blue") || c.includes("printer") || c.includes("feasy") || c.includes("universal");
}

function hookBlock(channel, blockPtr) {
  if (blockPtr.isNull()) return;
  blockChannels[blockPtr.toString()] = channel;
  const invoke = blockPtr.add(Process.pointerSize * 2).readPointer();
  console.log(`hook block channel=${channel} block=${blockPtr} invoke=${invoke}`);
  const invokeKey = invoke.toString();
  if (hookedInvokes.has(invokeKey)) return;
  hookedInvokes.add(invokeKey);
  Interceptor.attach(invoke, {
    onEnter(args) {
      const actualChannel = blockChannels[args[0].toString()] || channel;
      const info = nsdata(args[1], 4096);
      console.log(`INBOUND channel=${actualChannel} len=${info.len} hex=${info.hex}`);
    }
  });
}

function hookSetHandler(cls, sel, channelArg, blockArg) {
  if (!ObjC.classes[cls] || !ObjC.classes[cls][sel]) {
    console.log(`missing ${cls} ${sel}`);
    return;
  }
  Interceptor.attach(ObjC.classes[cls][sel].implementation, {
    onEnter(args) {
      const channel = nsstr(args[channelArg]);
      if (!shouldWatch(channel)) return;
      console.log(`SET_HANDLER cls=${cls} channel=${channel}`);
      hookBlock(channel, args[blockArg]);
    }
  });
  console.log(`hooked ${cls} ${sel}`);
}

hookSetHandler("FlutterEngine", "- setMessageHandlerOnChannel:binaryMessageHandler:", 2, 3);
hookSetHandler("FlutterEngine", "- setMessageHandlerOnChannel:binaryMessageHandler:taskQueue:", 2, 3);
hookSetHandler("FlutterBinaryMessengerRelay", "- setMessageHandlerOnChannel:binaryMessageHandler:", 2, 3);
hookSetHandler("FlutterBinaryMessengerRelay", "- setMessageHandlerOnChannel:binaryMessageHandler:taskQueue:", 2, 3);

if (ObjC.classes.FlutterMethodChannel && ObjC.classes.FlutterMethodChannel["- setMethodCallHandler:"]) {
  Interceptor.attach(ObjC.classes.FlutterMethodChannel["- setMethodCallHandler:"].implementation, {
    onEnter(args) {
      let channel = "FlutterMethodChannel";
      try {
        const obj = new ObjC.Object(args[0]);
        channel = obj.valueForKey_("_name").toString();
      } catch (_) {}
      if (!shouldWatch(channel)) return;
      console.log(`SET_METHOD_HANDLER channel=${channel}`);
      hookBlock(channel, args[2]);
    }
  });
  console.log("hooked FlutterMethodChannel setMethodCallHandler");
}

if (ObjC.classes.CBPeripheral && ObjC.classes.CBPeripheral["- writeValue:forCharacteristic:type:"]) {
  Interceptor.attach(ObjC.classes.CBPeripheral["- writeValue:forCharacteristic:type:"].implementation, {
    onEnter(args) {
      const data = nsdata(args[2], 512);
      let uuid = "?";
      try { uuid = new ObjC.Object(args[3]).UUID().UUIDString().toString(); } catch (_) {}
      console.log(`BLE_WRITE uuid=${uuid} type=${args[4].toInt32()} len=${data.len} hex=${data.hex}`);
    }
  });
  console.log("hooked CBPeripheral writeValue");
}
