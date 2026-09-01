#P2P Networking - Integration notes
##Signaling server must:
-Relay a single "message" event : {type, from, to, payload}
Handle "join" event: { peerId }
## To use from UI:
-new ConnectionManager({ signalingUrl, peerId, onStateChange, onDataChannelReady })
-manager.start()
-manager.connectToPeer(remotePeerId)
-manager-getDataChannel()?.sendFile(file, transferId)
## Untested (no signaling server/UI live yet):
-Full offer/answer/ICE handshake
-Multi-peer flow
