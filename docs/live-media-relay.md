# Live Media Relay

SuperPrint supports two printer camera paths:

- Diagnostic fallback: SuperNode uploads JPEG frames to SuperPrint.
- Production live view: SuperNode pushes a continuous H.264 stream to MediaMTX, and viewers watch WebRTC or low-latency HLS from the VPS.

The production live view keeps the printer private on the LAN. The local SuperNode opens outbound connections only.

## VPS

`docker-compose.production.yml` includes a `mediamtx` service.

Expose RTMP only as much as needed for the SuperNode publisher. Prefer restricting TCP `1935` to the shop/home public IP with the VPS firewall. Web playback should go through Caddy to localhost ports:

- WebRTC HTTP: `127.0.0.1:8889`
- HLS HTTP: `127.0.0.1:8888`
- WebRTC ICE UDP: `8189/udp`

Example public URLs:

```env
PUBLIC_PRINTER_WEBRTC_URL="https://live.print.superk.studio/centauri-carbon-1"
PUBLIC_PRINTER_HLS_URL="https://hls.print.superk.studio/centauri-carbon-1/index.m3u8"
```

## Local SuperNode

Enable the media relay by adding a push URL to `.env.supernode`:

```env
SUPERNODE_MEDIA_PUSH_URL="rtmp://print.superk.studio:1935/centauri-carbon-1"
SUPERNODE_MEDIA_SOURCE_URL="http://192.168.10.125:3031/video"
SUPERNODE_MEDIA_FPS="15"
SUPERNODE_MEDIA_BITRATE="1200k"
SUPERNODE_MEDIA_SCALE="1280:-2"
```

Then restart:

```bash
docker compose -f docker-compose.supernode.yml up -d --build
```

If the media relay is not configured or fails, the JPEG frame bridge remains available for diagnostics.
