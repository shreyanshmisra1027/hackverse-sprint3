# P2P acceptance test

Run this check on two separate browser profiles or devices connected to the
same LAN. Do not call simulated tests a transfer test.

1. In the project directory, run `npm install`, `npm run check`,
   `npm run build`, then `npm start`.
2. Open `http://<server-LAN-IP>:3000` in two clients. Give them distinct peer
   IDs containing only letters, numbers, `_`, or `-`.
3. Confirm that each client shows the other under **Peers** without a refresh.
4. Select the other peer on one client. Both clients must report an open data
   channel and an encryption-ready notification.
5. Transfer a text file and a 50 MB binary file. Confirm the receiver downloads
   both files and compare hashes:

   ```bash
   sha256sum original-file received-file
   ```

6. Disconnect one peer. The other peer must disappear from the list. Rejoin
   using the same peer ID and repeat a transfer.

Record browser versions, file sizes, elapsed time, and hash matches in the PR.

## Expected limitations

- This is LAN-only by default. Different subnets require a deliberately
  configured local TURN service and network approval.
- VIT-domain authentication is a deployment integration, not part of this
  demo. Do not claim it is implemented until SSO token validation exists.
