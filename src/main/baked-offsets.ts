export const bundledOffsets: Record<string, string> = {
  // Windows Store UWP 2020.12.4.0
  '2020.12.4.0': `
is64Bit: true
meetingHud: [0x21D03E0, 0xB8, 0]
meetingHudCachePtr: [0x8]
meetingHudState: [0xC0]
gameState: [0x21D0EA0, 0xB8, 0, 0xAC]
allPlayersPtr: [0x1BE0BB8, 0xB8, 0, 0x30]
allPlayers: [0x08]
playerCount: [0x0c]
playerAddrPtr: 0x10
exiledPlayerId: [0xff, 0x21D03E0, 0xB8, 0, 0xE0, 0x10]
gameCode: [0x1D50138, 0xB8, 0, 0x40, 0x48]
player:
  struct:
  - type: SKIP
    skip: 10
    name: unused
  - type: UINT
    name: id
  - type: UINT64
    name: name
  - type: UINT
    name: color
  - type: UINT
    name: hat
  - type: UINT
    name: pet
  - type: UINT
    name: skin
  - type: UINT
    name: disconnected
  - type: UINT64
    name: taskPtr
  - type: BYTE
    name: impostor
  - type: BYTE
    name: dead
  - type: SKIP
    skip: 2
    name: unused
  - type: UINT64
    name: objectPtr
  isLocal: [0x78]
  localX: [0x90, 0x6C]
  localY: [0x90, 0x70]
  remoteX: [0x90, 0x58]
  remoteY: [0x90, 0x5C]
  bufferLength: 64
  offsets: [0, 0]
  inVent: [0x3D]
`
};