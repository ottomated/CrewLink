# TODO before CrewLink 2.0.0

## Server

- [ ] Migrate from socket.io to a raw websocket connection. Ensure it auto-reconnects.
- [ ] Request offsets over the websocket connection, to keep the number of open sockets down.
- [ ] Move the default server to a better host.
- [ ] Rewrite all error messages to be even more human-readable.
- [ ] Integrate an official server list into the client.
- [ ] Detect the reason *why* the server can't provide offsets: i.e. Among Us just updated, it's an old version of Among Us, the server hasn't updated, etc.

### Stretch

- [ ] Distribute the server load, with a centralized matchmaking database.
- [ ] Re-write the server in Rust.

## Voice / WebRTC

- [ ] Add a microphone boost slider.
- [ ] Add a speaker adjustment slider.
- [ ] Add individual adjustment sliders to each of the players.
- [ ] Handle all RTC errors to make it unnecessary to ever re-open an RTC connection.
- [ ] Detect reason for RTC failure: NAT type, etc?
- [ ] Re-enable all `navigator.getUserMedia` functions that can be re-enabled with autoGainControl kicking in.
- [ ] Move all player-to-player communication logic to RTC data channels, versus sending them over the websocket.

### Stretch

- [ ] Implement an optional TURN server.

## Game Reader

- [ ] Fix unicode characters in player names
- [ ] Indicate to the user when it can't read memory properly. Example: screen displays `MENU` while in lobby due to some misplaced offset.
- [ ] Don't use the Unity Analytics file to read the game version. Use either a hash of the GameAssembly dll, or DMA it from the process.

### Stretch

- [ ] Move away from DMA and towards a different method. Probably network packet sniffing? Maybe DLL injection?
- [ ] Add itch.io and Linux/Mac support. This will be easiest with packet sniffing.
