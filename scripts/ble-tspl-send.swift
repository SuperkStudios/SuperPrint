import CoreBluetooth
import Foundation

private let args = Array(CommandLine.arguments.dropFirst())
private let connectOnly = args.contains("--connect-only")
private let forceWithResponse = args.contains("--with-response")
private let slowMode = args.contains("--slow")
private let byteMode = args.contains("--byte")
private let customChunkSize = intOption(named: "--chunk")
private let customDelaySeconds = doubleOption(named: "--delay-ms").map { max(0.0, $0) / 1000.0 }
private let customLogPath = stringOption(named: "--log")
private let positionalArgs: [String] = args.enumerated().compactMap { index, arg -> String? in
  guard !arg.hasPrefix("--") else { return nil }
  let previous = index > 0 ? args[index - 1] : ""
  return ["--chunk", "--delay-ms", "--log"].contains(previous) ? nil : arg
}
private let targetNamePrefix = positionalArgs.first ?? "A42BT"
private let payloadPath = connectOnly ? nil : positionalArgs.dropFirst().first
private let writeUUID = CBUUID(string: "49535343-8841-43F4-A8D4-ECBE34729BB3")
private let notifyUUID = CBUUID(string: "49535343-1E4D-4BD9-BA61-23C647249616")
private let timeoutSeconds = slowMode || customDelaySeconds != nil ? 180.0 : 60.0
private let logURL = URL(fileURLWithPath: customLogPath ?? "/tmp/superprint-ble-sender.log")

private func intOption(named name: String) -> Int? {
  guard let index = args.firstIndex(of: name), args.indices.contains(index + 1) else { return nil }
  return Int(args[index + 1]).map { max(1, $0) }
}

private func doubleOption(named name: String) -> Double? {
  guard let index = args.firstIndex(of: name), args.indices.contains(index + 1) else { return nil }
  return Double(args[index + 1])
}

private func stringOption(named name: String) -> String? {
  guard let index = args.firstIndex(of: name), args.indices.contains(index + 1) else { return nil }
  return args[index + 1]
}

private func log(_ message: String) {
  let line = "\(Date()) \(message)\n"
  if let data = line.data(using: .utf8) {
    if FileManager.default.fileExists(atPath: logURL.path),
       let handle = try? FileHandle(forWritingTo: logURL) {
      try? handle.seekToEnd()
      try? handle.write(contentsOf: data)
      try? handle.close()
    } else {
      try? data.write(to: logURL)
    }
  }
  print(message)
  fflush(stdout)
}

final class Sender: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
  private var central: CBCentralManager!
  private var peripheral: CBPeripheral?
  private var writeCharacteristic: CBCharacteristic?
  private var notifyCharacteristic: CBCharacteristic?
  private var payload: Data
  private var offset = 0
  private var writeType = CBCharacteristicWriteType.withResponse
  private var chunkSize = 20
  private var waitingForWriteResponse = false
  private var pendingCharacteristicDiscoveries = 0
  private var notificationReady = false
  private var sendStarted = false

  init(payload: Data) {
    self.payload = payload
    super.init()
    self.central = CBCentralManager(delegate: self, queue: nil)
    Timer.scheduledTimer(withTimeInterval: timeoutSeconds, repeats: false) { _ in
      log("Timed out")
      exit(2)
    }
  }

  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    guard central.state == .poweredOn else {
      log("Bluetooth state is \(central.state.rawValue), waiting...")
      return
    }
    log("Scanning for \(targetNamePrefix)...")
    central.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
  }

  func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
    let name = peripheral.name ?? advertisementData[CBAdvertisementDataLocalNameKey] as? String ?? ""
    guard name.hasPrefix(targetNamePrefix) else { return }
    log("Found \(name) RSSI \(RSSI)")
    self.peripheral = peripheral
    central.stopScan()
    peripheral.delegate = self
    central.connect(peripheral, options: nil)
  }

  func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
    log("Connected to \(peripheral.name ?? "printer")")
    if connectOnly {
      log("Holding BLE connection. Press Ctrl+C to disconnect.")
    }
    peripheral.discoverServices(nil)
  }

  func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
    log("Connect failed: \(error?.localizedDescription ?? "unknown")")
    exit(3)
  }

  func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
    if offset >= payload.count {
      log("Disconnected after successful write")
      exit(0)
    }
    log("Disconnected early at \(offset)/\(payload.count): \(error?.localizedDescription ?? "unknown")")
    exit(4)
  }

  func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
    if let error {
      log("Discover services failed: \(error.localizedDescription)")
      exit(5)
    }
    let services = peripheral.services ?? []
    pendingCharacteristicDiscoveries = services.count
    for service in services {
      peripheral.discoverCharacteristics([writeUUID, notifyUUID], for: service)
    }
  }

  func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
    if let error {
      log("Discover characteristics failed: \(error.localizedDescription)")
      exit(6)
    }
    defer {
      pendingCharacteristicDiscoveries -= 1
      startSendingIfReady()
    }
    for characteristic in service.characteristics ?? [] {
      if characteristic.uuid == notifyUUID && characteristic.properties.contains(.notify) {
        log("Enabling notify \(characteristic.uuid)")
        notifyCharacteristic = characteristic
        peripheral.setNotifyValue(true, for: characteristic)
      }
      if characteristic.uuid == writeUUID {
        if connectOnly {
          log("Found write characteristic \(characteristic.uuid). Connection is ready.")
          return
        }
        writeCharacteristic = characteristic
        log("Write characteristic properties: \(characteristic.properties.rawValue)")
        if forceWithResponse && characteristic.properties.contains(.write) {
          writeType = .withResponse
          chunkSize = 20
        } else if characteristic.properties.contains(.writeWithoutResponse) {
          writeType = .withoutResponse
          chunkSize = customChunkSize ?? (byteMode ? 1 : (slowMode ? 20 : min(180, peripheral.maximumWriteValueLength(for: .withoutResponse))))
        } else if characteristic.properties.contains(.write) {
          writeType = .withResponse
          chunkSize = customChunkSize ?? (byteMode ? 1 : (slowMode ? 20 : min(180, peripheral.maximumWriteValueLength(for: .withResponse))))
        } else {
          log("Write characteristic does not support writes: \(characteristic.properties)")
          exit(7)
        }
        log("Prepared write \(characteristic.uuid), type \(writeType == .withoutResponse ? "withoutResponse" : "withResponse"), chunk \(chunkSize)")
      }
    }
  }

  func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
    if let error {
      log("Notify enable failed for \(characteristic.uuid): \(error.localizedDescription)")
      exit(9)
    }
    if characteristic.uuid == notifyUUID {
      notificationReady = characteristic.isNotifying
      log("Notify \(characteristic.uuid) ready: \(notificationReady)")
      startSendingIfReady()
    }
  }

  func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
    waitingForWriteResponse = false
    if let error {
      log("Write failed at \(offset): \(error.localizedDescription)")
      exit(8)
    }
    sendMore()
  }

  func peripheralIsReady(toSendWriteWithoutResponse peripheral: CBPeripheral) {
    sendMore()
  }

  func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
    if let data = characteristic.value, !data.isEmpty {
      log("notify \(data.map { String(format: "%02X", $0) }.joined(separator: " "))")
    }
  }

  private func sendMore() {
    guard let peripheral, let characteristic = writeCharacteristic else { return }
    guard !waitingForWriteResponse else { return }
    while offset < payload.count {
      if writeType == .withoutResponse && !peripheral.canSendWriteWithoutResponse { return }
      let end = min(offset + chunkSize, payload.count)
      let chunk = payload.subdata(in: offset..<end)
      peripheral.writeValue(chunk, for: characteristic, type: writeType)
      offset = end
      if offset % 4096 == 0 || offset == payload.count {
        log("wrote \(offset)/\(payload.count)")
      }
      if let customDelaySeconds {
        RunLoop.current.run(until: Date().addingTimeInterval(customDelaySeconds))
      } else if byteMode {
        RunLoop.current.run(until: Date().addingTimeInterval(0.05))
      } else if slowMode {
        RunLoop.current.run(until: Date().addingTimeInterval(0.02))
      }
      if writeType == .withResponse {
        waitingForWriteResponse = true
        return
      }
    }
    log("Done writing \(payload.count) bytes")
    Timer.scheduledTimer(withTimeInterval: 2.0, repeats: false) { _ in
      self.central.cancelPeripheralConnection(peripheral)
    }
  }

  private func startSendingIfReady() {
    guard !connectOnly else { return }
    guard !sendStarted else { return }
    guard pendingCharacteristicDiscoveries <= 0 else { return }
    guard writeCharacteristic != nil else { return }
    guard notifyCharacteristic == nil || notificationReady else { return }
    sendStarted = true
    log("Starting write after notify setup")
    sendMore()
  }
}

let payload: Data
if let payloadPath {
  payload = try Data(contentsOf: URL(fileURLWithPath: payloadPath))
} else {
  payload = connectOnly ? Data() : Data("""
SIZE 100 mm,150 mm\r
GAP 3 mm,0 mm\r
DENSITY 8\r
SPEED 4\r
CLS\r
TEXT 40,40,"3",0,1,1,"SUPERPRINT BLE OK"\r
PRINT 1,1\r
""".utf8)
}

let sender = Sender(payload: payload)
RunLoop.main.run()
_ = sender
