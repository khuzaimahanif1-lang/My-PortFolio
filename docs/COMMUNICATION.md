# Communication and approved desktop access

The workspace now has one Communication page at `/workspace/connect`, with Voice calls, Video calls, Desktop access and Messages tabs. Reports and analytics share `/workspace/reports`; the old analytics URL redirects to Communication. Each account has its own resources, preferences, notifications and connection history.

## Use a call or session code

1. Both people sign in to different accounts on the same workspace server.
2. Open Communication and choose voice, video or desktop access.
3. Select a member to invite, or create a session code. Allow the browser permissions when you choose to start the session.
4. The other person accepts the invitation, or enters the eight-character code and requests to join. A code request requires the host to approve it.
5. End the session to close the connection and stop capture. Locking or signing out also stops the local call and revokes its access.

Codes expire after ten minutes, accept one guest and stop working once approved. Active sessions expire after two hours. The server stores a hash of the code and sends signaling only to the two browser sessions that joined the call. Call audio/video uses WebRTC; it is not recorded or stored by this application.

A camera and microphone are needed for video; a microphone is needed for voice. Desktop sharing requires the browser's screen chooser. Permission refusal is shown in the page. The page uses live media and does not display a simulated connection.

## Calls on the current computer

The production preview is at http://127.0.0.1:4000. The API runs at 127.0.0.1:8000. The current private Backend/.env also configures an authenticated **local-only** TURN relay on UDP 127.0.0.1:3478. Start-Project.ps1 launches the API, preview and configured local relay in separate hidden background windows; Stop-Project.ps1 stops its managed services. Start-Backend.ps1 remains available for foreground API development and starts its own relay when needed.

To start the configured relay separately:

```powershell
npm ci --prefix tools --ignore-scripts
node tools/local-turn.cjs
```

Its credentials come from Backend/.env. The listener and allocated relay ports 35000-35100 bind only to loopback; this development relay does not provide access from another physical computer. The interface labels it **Local relay configured**. The two test accounts used for live transport verification were removed.

If using the Angular development server, Start-Frontend.ps1 uses http://127.0.0.1:4300. These localhost addresses refer to the computer running the browser.

## Connect another physical computer

Both browsers need a reachable, secure address for the **same** frontend/API, rather than each computer's localhost address. Browsers require a secure context for camera/microphone and screen capture. Screen capture still needs an explicit user gesture and browser permission. See [MDN screen capture](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia).

Set up an HTTPS domain or other trusted HTTPS endpoint for the app, then configure the existing reverse proxy/deployment and these environment settings:

```dotenv
FRONTEND_URL=https://your-workspace.example
ALLOWED_ORIGINS=https://your-workspace.example
SSR_ALLOWED_HOSTS=your-workspace.example
COOKIE_SECURE=true
WEBRTC_TURN_URL=turn:your-relay.example:3478?transport=udp
WEBRTC_TURN_USERNAME=your-relay-username
WEBRTC_TURN_PASSWORD=your-relay-password
```

Replace the example values with your own deployment and relay. Use a reachable authenticated TURN service or your own coturn deployment, with its listener and relay port range permitted by your network. TURN relays provide connectivity when direct peer connections cannot pass through the peers' networks. See [WebRTC TURN setup](https://webrtc.org/getting-started/turn-server).

For Compose, configure these values in the root .env; Compose forwards the WebRTC settings to the API. For a local Python API, put its settings in Backend/.env and set SSR_ALLOWED_HOSTS in the frontend process environment. Restart the API and reload the workspace after changing relay settings. The existing production settings also require MySQL when ENVIRONMENT=production; README.md covers that deployment.

A public domain, production TURN service and physical second computer were not supplied during verification. They have not been deployed or tested. The current loopback relay is for local verification only.

## Optional Windows mouse and keyboard control

Desktop access initially shares the chosen screen in **view-only** mode. A guest can point at the screen and request control. Actual mouse and keyboard input requires the helper running on the sharing Windows computer, plus approval in both the workspace and the helper window.

On the sharing computer:

```powershell
# Built SSR preview, port 4000
.\Start-DesktopHelper.ps1

# Angular development preview, port 4300
.\Start-DesktopHelper.ps1 -Origin http://127.0.0.1:4300

# Your deployed workspace
.\Start-DesktopHelper.ps1 -Origin https://your-workspace.example
```

Share the **primary entire screen**, choose Allow desktop control in Communication, copy the helper's local token into that form on the sharing computer, and approve the named guest in the helper window. Keep that window open. The local token is not the session code and should not be sent to the guest. Your browser may request local-network access to reach the helper.

The guest can then focus the shared screen and use mouse movement, buttons, scrolling and supported keyboard keys in normal Windows applications. This is cooperative browser sharing, not unattended Windows Remote Desktop. Multi-monitor input, elevated application control and Windows/system key shortcuts are not supported.

The helper can run independently on another Windows PC with Python and Tkinter installed: copy tools/desktop_helper.py and run `python desktop_helper.py --origin https://your-workspace.example`. A second backend/database is not required on that sharing PC.

Stop control with **Revoke control**, the helper's Stop button, **F12 on the sharing computer**, closing the helper or ending the call. The helper's input lease expires after fifteen seconds without browser heartbeats and releases held buttons/keys. Locking, account changes, call end and connection loss revoke access. The helper listens only on 127.0.0.1:8765, checks the exact workspace origin and requires a locally approved short-lived key. It has no command-execution, file-transfer or unattended-access API.

## Verified behavior

- 28 backend/helper tests passed using isolated data and a fake input device; no native Windows input was executed.
- 12 frontend tests passed, including account changes, stale WebSocket events and stopping delayed screen capture.
- The production build and 39 HTTP/WebSocket/persistence smoke checks passed.
- 17 real browser WebRTC checks passed across audio, video and desktop sessions, with received audio packets, decoded moving video, code approval and collaboration data delivery. These use generated tracks; they do not access the real camera, microphone or desktop.
- Notification outside-click behavior, project-form reset, dropdown navigation and desktop/mobile Communication layout were checked in the in-app browser.

Physical camera/microphone calls, native mouse/keyboard control, a second physical computer and a production network relay still require device/deployment testing.

## Login, lock and notifications

An incorrect password correctly returns HTTP 401 and shows the login error. A locked workspace goes to password verification without repeatedly posting refresh requests. Signed-out session inspection returns a normal guest response. Switching accounts discards old private HTTP responses and WebSocket events, and resets the previous workspace state. Separate browser profiles/devices are needed to keep different accounts signed in simultaneously; tabs of the same browser share session cookies.

Routine resource edits and sign-in/lock/unlock events no longer create repetitive notifications. Recognizable older copies of that noise are removed only from the current account. Messages, contact submissions and security notices remain. Notifications support individual deletion, clearing read items and clearing all items with an in-app confirmation. Their menus close on an outside click or Escape.

The Grammarly DEFAULT logger warning originates in the browser extension, not the workspace code.
