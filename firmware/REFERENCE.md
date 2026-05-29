# Firmware Reference Notes

## Hardware Stack

| Component | Part | Notes |
|-----------|------|-------|
| MCU | nRF52840 | BLE 5.0, Cortex-M4F, 256KB RAM |
| IMU | MPU-6050 | 6-axis accel + gyroscope |
| Storage | microSD | SPI interface on nRF52840 |
| Spool | Retractable tape measure | 50,000+ cycle rated |
| Mount | Magnet strip | Two sides + center |
| Enclosure | 3x3x3" printed | PLA/PETG |

## Reference Repositories

### Primary Firmware Reference
- **squatsandsciencelabs/OpenBarbell-V3** — C/React Native
  - Velocity algorithm implementation
  - Rolling average window: 5 samples
  - Outlier rejection: 0.15 m/s threshold
  - BLE GATT profile design

### Hardware Design Reference
- **Liftology/OpenBarbell** — C
  - Original sub-$50 hardware design
  - Spool mechanism schematics

### nRF52840 Dev Kit
- **makerdiary/nrf52840-mdk** — C/Zephyr RTOS
  - Full dev kit with schematics
  - BLE streaming examples
- **makerdiary/nrf52840-mdk-usb-dongle** — C/Zephyr RTOS
  - USB dongle for BLE testing pre-hardware
- **makerdiary/nrf52840-connectkit** — C/Python/Zephyr
  - Rapid prototyping with CircuitPython support

### Camera VBT (for algorithm calibration)
- **kostecky/VBT-Barbell-Tracker** — Python/OpenCV
  - Gym testing with laptop + webcam
  - High contrast bar marker detection
- **tlancon/barbellcv** — Python/PyQt5
  - Alternative camera VBT implementation

## BLE Latency Strategy

- **High priority mode** during active lift (notification every ~16ms = 60Hz)
- **Balanced mode** between sets (notification every ~100ms = 10Hz)
- **Connection interval**: Request 7.5ms minimum with nRF52840
- **GATT characteristic**: Custom velocity service (UUID TBD after PWA BLE service defined)

## Firmware TODOs

1. Define custom BLE GATT service UUID for VBT Tracker
2. Implement velocity calculation from IMU data (complementary filter or Kalman)
3. Wire-based LPT for vertical velocity (primary sensor)
4. IMU data for form tracking (secondary sensor)
5. microSD local backup via SPI
6. BLE notification timing optimization
7. Power management for battery life
