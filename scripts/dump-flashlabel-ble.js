if (!ObjC.available) {
  throw new Error("Objective-C runtime is not available");
}

function appendLine(line) {
  console.log(line);
}

function bytesToHex(data) {
  const len = data.length();
  const ptr = data.bytes();
  const raw = ptr.readByteArray(len);
  return Array.from(new Uint8Array(raw))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

appendLine("=== capture started " + new Date().toISOString() + " ===");

const selector = "- writeValue:forCharacteristic:type:";
const impl = ObjC.classes.CBPeripheral[selector].implementation;

Interceptor.attach(impl, {
  onEnter(args) {
    const data = new ObjC.Object(args[2]);
    const characteristic = new ObjC.Object(args[3]);
    const type = args[4].toInt32();
    const uuid = characteristic.UUID().UUIDString().toString();
    const hex = bytesToHex(data);
    appendLine(
      [
        "WRITE",
        "uuid=" + uuid,
        "type=" + type,
        "len=" + data.length(),
        "hex=" + hex,
      ].join(" ")
    );
  },
});
