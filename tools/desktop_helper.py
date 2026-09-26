"""Opt-in Windows desktop input bridge. No unattended access or command execution.
Run manually on the sharing computer; approved input expires without browser heartbeats.
"""
import argparse, ctypes, json, math, queue, secrets, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import tkinter as tk
from tkinter import messagebox

KEYS={'Backspace':8,'Tab':9,'Enter':13,'Shift':16,'Control':17,'Alt':18,'Escape':27,' ':32,
      'PageUp':33,'PageDown':34,'End':35,'Home':36,'ArrowLeft':37,'ArrowUp':38,'ArrowRight':39,'ArrowDown':40,'Delete':46}

def validate_input(event):
    if not isinstance(event,dict):raise ValueError('Invalid input.')
    kind=event.get('type')
    if kind in ('move','click','button'):
        for axis in ('x','y'):
            value=event.get(axis)
            if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or not 0<=value<=1:raise ValueError('Invalid coordinates.')
        if kind in ('click','button') and event.get('button') not in (0,1,2):raise ValueError('Invalid mouse button.')
        if kind=='button' and not isinstance(event.get('down'),bool):raise ValueError('Invalid button state.')
    elif kind=='release':pass
    elif kind=='scroll':
        if event.get('delta') not in (-1,1):raise ValueError('Invalid scroll input.')
    elif kind=='key':
        key=event.get('key','')
        if not isinstance(key,str) or not (key in KEYS or len(key)==1 and key.isprintable() and ord(key)<128):raise ValueError('Unsupported key.')
        if not isinstance(event.get('down'),bool):raise ValueError('Invalid key state.')
    else:raise ValueError('Unsupported input type.')
    return event

class WindowsInput:
    def __init__(self):
        if not hasattr(ctypes,'windll'):raise RuntimeError('Desktop input requires Windows.')
        self.api=ctypes.windll.user32;self.api.SetProcessDPIAware();self.width=self.api.GetSystemMetrics(0);self.height=self.api.GetSystemMetrics(1)
        self.held=set();self.buttons=set()
    def send(self,event):
        kind=event['type']
        if kind in ('move','click','button'):
            self.api.SetCursorPos(round(event['x']*(self.width-1)),round(event['y']*(self.height-1)))
            if kind in ('click','button'):
                down,up={0:(2,4),1:(32,64),2:(8,16)}[event['button']]
                if kind=='click':self.api.mouse_event(down,0,0,0,0);self.api.mouse_event(up,0,0,0,0)
                else:
                    self.api.mouse_event(down if event['down'] else up,0,0,0,0)
                    if event['down']:self.buttons.add(event['button'])
                    else:self.buttons.discard(event['button'])
        elif kind=='release':self.release()
        elif kind=='scroll':self.api.mouse_event(2048,0,0,event['delta']*120,0)
        elif kind=='key':
            key=event['key'];code=KEYS.get(key)
            if code is None:code=self.api.VkKeyScanW(ord(key))&255
            if code==255:return
            self.api.keybd_event(code,0,0 if event['down'] else 2,0)
            if event['down']:self.held.add(code)
            else:self.held.discard(code)
    def release(self):
        for code in self.held:self.api.keybd_event(code,0,2,0)
        for button in self.buttons:self.api.mouse_event({0:4,1:64,2:16}[button],0,0,0,0)
        self.held.clear();self.buttons.clear()
    def emergency(self):return bool(self.api.GetAsyncKeyState(0x7b)&0x8000)

class BridgeState:
    def __init__(self,device,approve,origin):
        self.device=device;self.approve=approve;self.origin=origin;self.token=secrets.token_urlsafe(32);self.token_expiry=time.monotonic()+600
        self.key='';self.peer='';self.last_seen=0;self.call_id='';self.lock=threading.RLock()
    def revoke(self):
        with self.lock:self.key='';self.peer='';self.call_id='';self.device.release()
    def authorized(self,key):
        with self.lock:
            if not self.key or time.monotonic()-self.last_seen>15:
                self.revoke();return False
            return bool(key and secrets.compare_digest(key,self.key))
    def pair(self,body):
        with self.lock:
            if self.key:raise ValueError('Revoke the current guest before pairing again.')
            token=body.get('token','')
            if not isinstance(token,str) or time.monotonic()>self.token_expiry or not secrets.compare_digest(token,self.token):raise ValueError('The helper token is invalid or expired. Restart the helper.')
            peer=str(body.get('peer_name','Guest'))[:100];call_id=str(body.get('call_id',''))
            if len(call_id)!=36:raise ValueError('Invalid session.')
        if not self.approve(peer):raise ValueError('Desktop control was declined on this computer.')
        with self.lock:
            if self.key:raise ValueError('Another guest has already paired.')
            self.key=secrets.token_urlsafe(32);self.peer=peer;self.call_id=call_id;self.last_seen=time.monotonic()
            self.token=secrets.token_urlsafe(32);self.token_expiry=time.monotonic()+600
            return {'key':self.key,'width':self.device.width,'height':self.device.height}
    def request(self,path,body,key):
        if path=='pair':return self.pair(body)
        with self.lock:
            if not self.authorized(key):raise PermissionError('Desktop permission is absent or expired.')
            if path=='heartbeat':self.last_seen=time.monotonic();return {'ok':True}
            if path=='revoke':self.revoke();return {'ok':True}
            if path=='input':self.device.send(validate_input(body.get('event')));return {'ok':True}
            raise ValueError('Unknown operation.')

class BridgeHandler(BaseHTTPRequestHandler):
    state=None
    def log_message(self,*args):pass
    def do_OPTIONS(self):
        if self.headers.get('Origin')!=self.state.origin:return self.respond(403,{'detail':'Origin denied.'})
        self.respond(204,None)
    def do_POST(self):
        if self.headers.get('Origin')!=self.state.origin:return self.respond(403,{'detail':'Origin denied.'})
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 0<length<=8192:raise ValueError('Invalid request size.')
            if self.headers.get('Content-Type','').split(';')[0]!='application/json':raise ValueError('JSON is required.')
            body=json.loads(self.rfile.read(length))
            if not isinstance(body,dict):raise ValueError('Invalid request.')
            result=self.state.request(self.path.strip('/'),body,self.headers.get('X-Desktop-Key',''))
            self.respond(200,result)
        except PermissionError as error:self.respond(403,{'detail':str(error)})
        except (ValueError,TypeError) as error:self.respond(400,{'detail':str(error)})
    def respond(self,status,body):
        raw=json.dumps(body).encode() if body is not None else b''
        self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store')
        if self.headers.get('Origin')==self.state.origin:
            self.send_header('Access-Control-Allow-Origin',self.state.origin);self.send_header('Vary','Origin')
            self.send_header('Access-Control-Allow-Headers','Content-Type,X-Desktop-Key');self.send_header('Access-Control-Allow-Methods','POST,OPTIONS')
            self.send_header('Access-Control-Allow-Private-Network','true')
        self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--origin',default='http://127.0.0.1:4000');args=parser.parse_args()
    if not (args.origin.startswith('https://') or args.origin.startswith('http://127.0.0.1:') or args.origin.startswith('http://localhost:')):parser.error('Use HTTPS or an explicit localhost origin.')
    root=tk.Tk();root.title('King AI - Desktop sharing permission');root.geometry('620x400');root.attributes('-topmost',True)
    approvals=queue.Queue();device=WindowsInput()
    def approve(peer):
        ready=threading.Event();result=[];approvals.put((peer,ready,result));ready.wait(60);return bool(result and result[0])
    state=BridgeState(device,approve,args.origin);BridgeHandler.state=state
    tk.Label(root,text='Desktop control is OFF until you approve a guest.',font=('Segoe UI',14,'bold'),wraplength=560).pack(pady=(24,12))
    tk.Label(root,text='Share your primary entire screen in the browser. Paste this local token into\nAllow desktop control. Never send the token to your guest.',font=('Segoe UI',10)).pack(pady=8)
    token=tk.StringVar(value=state.token);entry=tk.Entry(root,textvariable=token,width=65,state='readonly');entry.pack(padx=20,pady=10)
    def copy():root.clipboard_clear();root.clipboard_append(state.token)
    tk.Button(root,text='Copy local pairing token',command=copy).pack(pady=5)
    status=tk.StringVar(value='No guest has control.');tk.Label(root,textvariable=status,font=('Segoe UI',11),wraplength=560).pack(pady=18)
    tk.Button(root,text='STOP DESKTOP CONTROL (F12)',command=state.revoke,bg='#a82c2c',fg='white',font=('Segoe UI',11,'bold')).pack(pady=10)
    tk.Label(root,text='Keep this window open. Control expires without browser heartbeats.\nClose this window to stop the helper.',font=('Segoe UI',9)).pack(pady=8)
    server=ThreadingHTTPServer(('127.0.0.1',8765),BridgeHandler);threading.Thread(target=server.serve_forever,daemon=True).start()
    def poll():
        if device.emergency():state.revoke()
        if state.key and time.monotonic()-state.last_seen>15:state.revoke()
        status.set('Approved guest: '+state.peer+' - mouse and keyboard enabled' if state.key else 'Desktop control OFF. No guest has control.')
        token.set(state.token)
        try:
            peer,ready,result=approvals.get_nowait()
            answer=messagebox.askyesno('Approve remote desktop control?',peer+' requests mouse and keyboard control of this computer.\n\nAllow while the session is active?\nPress F12 or STOP here to revoke immediately.',parent=root)
            result.append(answer);ready.set()
        except queue.Empty:pass
        root.after(100,poll)
    def close():state.revoke();server.shutdown();server.server_close();root.destroy()
    root.protocol('WM_DELETE_WINDOW',close);poll();root.mainloop()

if __name__=='__main__':main()
