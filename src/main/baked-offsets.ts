export const offset_2020_12_5 = `
meetingHud: [0x1BE0CB4, 0x5c, 0]
meetingHudCachePtr: [0x8]
meetingHudState: [0x84]
gameState: [0x1BE1074, 0x5C, 0, 0x64]

allPlayersPtr: [0x1BE0BB8, 0x5c, 0, 0x24]
allPlayers: [0x08]
playerCount: [0x0c]
playerAddrPtr: 0x10
exiledPlayerId: [0xff, 0x1BE0CB4, 0x5c, 0, 0x94, 0x08]

gameCode: [0x1B5AB00, 0x5c, 0, 0x20, 0x28]

player:
  struct:
  - type: SKIP
    skip: 8
    name: unused
  - type: UINT
    name: id
  - type: UINT
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
  - type: UINT
    name: taskPtr
  - type: BYTE
    name: impostor
  - type: BYTE
    name: dead
  - type: SKIP
    skip: 2
    name: unused
  - type: UINT
    name: objectPtr
  isLocal: [0x54]
  localX: [0x60, 0x50]
  localY: [0x60, 0x54]
  remoteX: [0x60, 0x3C]
  remoteY: [0x60, 0x40]
  bufferLength: 56
  offsets: [0, 0]
  inVent: [0x31]
`
export const offsets_2020_12_9 = `
meetingHud: [0x1C573A4, 0x5c, 0]
meetingHudCachePtr: [0x8]
meetingHudState: [0x84]
gameState: [0x1C57F54, 0x5C, 0, 0x64]

allPlayersPtr: [0x1C57BE8, 0x5c, 0, 0x24]
allPlayers: [0x08]
playerCount: [0x0c]
playerAddrPtr: 0x10
exiledPlayerId: [0xff, 0x1C573A4, 0x5c, 0, 0x94, 0x08]

gameCode: [0x1AF20FC, 0x5c, 0, 0x20, 0x28]

player:
  struct:
  - type: SKIP
    skip: 8
    name: unused
  - type: UINT
    name: id
  - type: UINT
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
  - type: UINT
    name: taskPtr
  - type: BYTE
    name: impostor
  - type: BYTE
    name: dead
  - type: SKIP
    skip: 2
    name: unused
  - type: UINT
    name: objectPtr
  isLocal: [0x54]
  localX: [0x60, 0x50]
  localY: [0x60, 0x54]
  remoteX: [0x60, 0x3C]
  remoteY: [0x60, 0x40]
  bufferLength: 56
  offsets: [0, 0]
  inVent: [0x31]

`