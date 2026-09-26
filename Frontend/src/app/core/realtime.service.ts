import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { Api } from './api.service';
import { Auth } from './auth.service';
@Injectable({providedIn: 'root'})
export class Realtime implements OnDestroy {
  private api = inject(Api); private auth = inject(Auth);
  status = signal<'offline' | 'connecting' | 'online' | 'reconnecting'>('offline');
  online = signal<string[]>([]); events = new Subject<any>();
  private socket?: WebSocket; private retry?: ReturnType<typeof setTimeout>; private stopped = true; private attempt = 0; private generation = 0;
  connect() { if (!this.auth.browser || !this.stopped) return; this.stopped = false; void this.open(); }
  private async open() {
    if (this.stopped || this.auth.locked() || !this.auth.user()) return;
    const generation = this.generation; const userId = this.auth.user()?.id;
    this.status.set(this.attempt ? 'reconnecting' : 'connecting');
    try {
      const response = await this.api.post<{ticket: string}>('realtime/ticket');
      if (this.stopped || generation !== this.generation || userId !== this.auth.user()?.id) return;
      this.socket = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/ws?ticket=' + encodeURIComponent(response.ticket));
      const socket = this.socket;
      const current = () => !this.stopped && generation === this.generation && userId === this.auth.user()?.id && this.socket === socket;
      this.socket.onopen = () => { if (!current()) return; this.attempt = 0; this.status.set('online'); };
      this.socket.onmessage = e => {
        if (!current()) return;
        const event = JSON.parse(e.data);
        if (event.type === 'connection') this.online.set(event.online_users);
        if (event.type === 'user:online') this.online.update(ids => [...new Set([...ids, event.user_id])]);
        if (event.type === 'user:offline') this.online.update(ids => ids.filter(id => id !== event.user_id));
        this.events.next(event);
      };
      this.socket.onclose = e => { if (!current()) return; if (e.code === 4423) this.auth.goLocked(); this.schedule(); };
    } catch { if (generation === this.generation && userId === this.auth.user()?.id) this.schedule(); }
  }
  private schedule() { this.status.set('offline'); if (!this.stopped && !this.auth.locked()) {
    this.attempt++; this.retry = setTimeout(() => void this.open(), Math.min(30000, 1000 * 2 ** Math.min(this.attempt, 5)));
  }}
  typing(conversationId: string, active: boolean) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({type: active ? 'message:typing' : 'message:stop_typing', conversation_id: conversationId}));
  }
  disconnect() { this.generation++; this.stopped = true; this.attempt = 0; this.online.set([]); clearTimeout(this.retry); this.socket?.close(); this.socket = undefined; this.status.set('offline'); }
  ngOnDestroy() { this.disconnect(); this.events.complete(); }
}

