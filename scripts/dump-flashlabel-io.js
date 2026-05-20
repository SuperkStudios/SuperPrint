if (!ObjC.available) {
  throw new Error("Objective-C runtime is not available");
}

function hexFromPointer(ptr, len, maxLen = 96) {
  const n = Math.min(Number(len), maxLen);
  if (n <= 0 || ptr.isNull()) return "";
  const raw = ptr.readByteArray(n);
  return Array.from(new Uint8Array(raw))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hookBleWrites() {
  const selector = "- writeValue:forCharacteristic:type:";
  const method = ObjC.classes.CBPeripheral && ObjC.classes.CBPeripheral[selector];
  if (!method) {
    console.log("BLE hook unavailable");
    return;
  }
  Interceptor.attach(method.implementation, {
    onEnter(args) {
      const data = new ObjC.Object(args[2]);
      const characteristic = new ObjC.Object(args[3]);
      const type = args[4].toInt32();
      const uuid = characteristic.UUID().UUIDString().toString();
      console.log(
        [
          "BLE_WRITE",
          "uuid=" + uuid,
          "type=" + type,
          "len=" + data.length(),
          "hex=" + hexFromPointer(data.bytes(), data.length(), 256),
        ].join(" ")
      );
    },
  });
  console.log("BLE hook installed");
}

function findExport(name) {
  for (const module of Process.enumerateModules()) {
    for (const exp of module.enumerateExports()) {
      if (exp.name === name) {
        return exp.address;
      }
    }
  }
  return null;
}

function hookLibusb() {
  const bulk = findExport("libusb_bulk_transfer");
  if (bulk) {
    Interceptor.attach(bulk, {
      onEnter(args) {
        this.endpoint = args[1].toUInt32() & 0xff;
        this.data = args[2];
        this.length = args[3].toInt32();
      },
      onLeave(retval) {
        console.log(
          [
            "USB_BULK",
            "ret=" + retval.toInt32(),
            "ep=0x" + this.endpoint.toString(16),
            "len=" + this.length,
            "hex=" + hexFromPointer(this.data, this.length, 256),
          ].join(" ")
        );
      },
    });
    console.log("USB bulk hook installed");
  } else {
    console.log("USB bulk export not found");
  }

  const control = findExport("libusb_control_transfer");
  if (control) {
    Interceptor.attach(control, {
      onEnter(args) {
        this.requestType = args[1].toUInt32() & 0xff;
        this.request = args[2].toUInt32() & 0xff;
        this.value = args[3].toUInt32() & 0xffff;
        this.index = args[4].toUInt32() & 0xffff;
        this.data = args[5];
        this.length = args[6].toInt32();
      },
      onLeave(retval) {
        console.log(
          [
            "USB_CONTROL",
            "ret=" + retval.toInt32(),
            "requestType=0x" + this.requestType.toString(16),
            "request=0x" + this.request.toString(16),
            "value=0x" + this.value.toString(16),
            "index=0x" + this.index.toString(16),
            "len=" + this.length,
            "hex=" + hexFromPointer(this.data, this.length, 256),
          ].join(" ")
        );
      },
    });
    console.log("USB control hook installed");
  } else {
    console.log("USB control export not found");
  }
}

console.log("=== IO capture started " + new Date().toISOString() + " ===");
hookBleWrites();
hookLibusb();
