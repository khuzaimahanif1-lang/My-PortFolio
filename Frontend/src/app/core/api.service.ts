import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'Cannot reach the workspace server. Check your connection and try again.';
    const detail = error.error?.detail;
    if (Array.isArray(detail)) return detail.map((e: any) => (e.loc?.slice(1).join(' ') || 'Form') + ': ' + e.msg).join('. ');
    if (typeof detail === 'string') return detail;
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
@Injectable({providedIn: 'root'})
export class Api {
  private http = inject(HttpClient);
  get<T>(path: string) { return firstValueFrom(this.http.get<T>('/api/' + path)); }
  post<T>(path: string, body: unknown = {}) { return firstValueFrom(this.http.post<T>('/api/' + path, body)); }
  put<T>(path: string, body: unknown) { return firstValueFrom(this.http.put<T>('/api/' + path, body)); }
  delete<T>(path: string) { return firstValueFrom(this.http.delete<T>('/api/' + path)); }
  blob(path: string) { return firstValueFrom(this.http.get('/api/' + path, {responseType: 'blob'})); }
}
@Injectable({providedIn: 'root'})
export class Toasts {
  message = signal(''); private timer?: ReturnType<typeof setTimeout>;
  show(value: string) { this.message.set(value); clearTimeout(this.timer); this.timer = setTimeout(() => this.message.set(''), 5000); }
}

