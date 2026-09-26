import { Injectable, inject, signal, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom,timeout } from 'rxjs';
import { User } from './models';
interface AuthResponse { access_token:string; user:User; expires_in:number; unlock_until:string; }
@Injectable({providedIn:'root'})
export class Auth implements OnDestroy {
 private http=inject(HttpClient); private router=inject(Router);
 browser=isPlatformBrowser(inject(PLATFORM_ID));user=signal<User|null>(null);token=signal('');locked=signal(false);notice=signal('');
 private ready=false;private pending?:Promise<boolean>;private refreshPromise?:Promise<string>;private expiration=0;private timer?:ReturnType<typeof setTimeout>;
 private channel?:BroadcastChannel;private epoch=0;returnUrl='/workspace';
 constructor(){if(this.browser&&typeof BroadcastChannel!=='undefined'){this.channel=new BroadcastChannel('king-ai-account');this.channel.onmessage=({data})=>{
  if(data?.type==='lock'&&data.user_id===this.user()?.id){this.goLocked();return;}
  if(data?.type==='login'||data?.type==='logout'){this.endLocal('The account changed in another tab. Sign in to open the correct workspace.');}
 };}}
 private serial<T>(action:()=>Promise<T>):Promise<T>{return this.browser&&navigator.locks?navigator.locks.request('king-ai-session-refresh',action):action();}
 private accept(response:AuthResponse){this.update(response.user,true);this.token.set(response.access_token);this.locked.set(false);this.expiration=Date.now()+response.expires_in*1000;this.ready=true;this.notice.set('');clearTimeout(this.timer);
  this.timer=setTimeout(()=>this.goLocked(),Math.max(1,Date.parse(response.unlock_until)-Date.now()));}
 async ensure():Promise<boolean>{
  if(!this.browser)return false;if(this.ready)return !!this.user();if(this.pending)return this.pending;const generation=this.epoch;
  this.pending=(async()=>{try{
   const session=await firstValueFrom(this.http.get<{authenticated:boolean;user:User|null;locked:boolean}>('/api/auth/session',{withCredentials:true}));
   if(generation!==this.epoch)return false;if(!session.user){this.ready=true;return false;}
   this.update(session.user,true);this.locked.set(session.locked);this.ready=true;
   if(!session.locked)await this.refresh();return !!this.user();
  }catch(e){if(generation!==this.epoch)return false;if(e instanceof HttpErrorResponse&&e.status===423){this.goLocked();return !!this.user();}this.clear();this.ready=true;return false;
  }finally{this.pending=undefined;}})();return this.pending;
 }
 async signup(data:unknown){await this.serial(async()=>{const response=await firstValueFrom(this.http.post<AuthResponse>('/api/auth/signup',data,{withCredentials:true}));this.epoch++;this.accept(response);this.channel?.postMessage({type:'login',user_id:response.user.id});});}
 async login(data:unknown){await this.serial(async()=>{const response=await firstValueFrom(this.http.post<AuthResponse>('/api/auth/login',data,{withCredentials:true}));this.epoch++;this.accept(response);this.channel?.postMessage({type:'login',user_id:response.user.id});});}
 async refresh():Promise<string>{
  if(this.locked())throw new Error('Your workspace is locked. Enter your password to continue.');if(this.refreshPromise)return this.refreshPromise;
  const expected=this.user()?.id,generation=this.epoch;
  this.refreshPromise=this.serial(async()=>{try{
   if(this.locked()||generation!==this.epoch)throw new Error('The session changed.');
   const response=await firstValueFrom(this.http.post<AuthResponse>('/api/auth/refresh',{user_id:expected},{withCredentials:true}));
   if(generation!==this.epoch||expected&&response.user.id!==expected){this.endLocal('The account changed. Please sign in again.');throw new Error('The account changed.');}
   this.accept(response);return response.access_token;
  }catch(e){if(generation===this.epoch){if(e instanceof HttpErrorResponse&&e.status===423)this.goLocked();else this.endLocal('Your session ended. Please sign in again.');}throw e;
  }}).finally(()=>{this.refreshPromise=undefined;});return this.refreshPromise;
 }
 needsRefresh(){return !!this.token()&&!this.locked()&&Date.now()>this.expiration-10000;}
 async unlock(password:string){await this.serial(async()=>{const response=await firstValueFrom(this.http.post<AuthResponse>('/api/auth/unlock',{password,user_id:this.user()?.id},{withCredentials:true}));this.accept(response);});}
 async lock(){if(this.needsRefresh())await this.refresh();await firstValueFrom(this.http.post('/api/auth/lock',{}, {withCredentials:true}));this.channel?.postMessage({type:'lock',user_id:this.user()?.id});this.goLocked();}
 goLocked(){if(!this.user())return;if(!this.router.url.startsWith('/unlock')&&this.router.url.startsWith('/workspace'))this.returnUrl=this.router.url;clearTimeout(this.timer);this.token.set('');this.locked.set(true);if(this.router.url.startsWith('/workspace')||this.router.url.startsWith('/unlock'))void this.router.navigate(['/unlock']);}
 private clear(){this.epoch++;this.user.set(null);this.token.set('');this.locked.set(false);this.expiration=0;clearTimeout(this.timer);if(this.browser){document.documentElement.removeAttribute('data-workspace-accent');}}
 private endLocal(message:string){this.clear();this.ready=true;this.notice.set(message);void this.router.navigate(['/login']);}
 async logout(){
  this.channel?.postMessage({type:'logout'});this.clear();this.ready=true;this.notice.set('');
  const revoke=firstValueFrom(this.http.post('/api/auth/logout',{}, {withCredentials:true}).pipe(timeout(8000)));
  const result=revoke.then(()=>null,error=>error);
  await this.router.navigate(['/login']);
  const error=await result;if(error)throw new Error('You are signed out here. The server could not confirm session removal; retry when connected.');
 }
 update(user:User,replace=false){if(!replace&&this.user()?.id&&user.id!==this.user()?.id)return;this.user.set(user);if(this.browser){document.documentElement.dataset['theme']=String(user.preferences['theme']||'dark');document.documentElement.dataset['workspaceAccent']=String(user.preferences['workspace_accent']||'gold');document.documentElement.classList.toggle('reduce-motion',!!user.preferences['reduced_motion']);}}
 ngOnDestroy(){this.channel?.close();clearTimeout(this.timer);}
}
