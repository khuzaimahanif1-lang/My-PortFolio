import { Component,inject,signal,afterNextRender,OnDestroy,HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute,Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { Calls,Call } from '../../core/calls.service';
import { Api,Toasts,errorMessage } from '../../core/api.service';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { StreamVideo } from '../../shared/stream-video';
import { Messages } from '../messages/messages';
@Component({imports:[FormsModule,DatePipe,Icon,Modal,StreamVideo,Messages],templateUrl:'./connect.html',styleUrl:'./connect.css',host:{'[class.chat-mode]':'mode()==="chat"'}})
export class Communication implements OnDestroy {
 calls=inject(Calls);api=inject(Api);toasts=inject(Toasts);route=inject(ActivatedRoute);router=inject(Router);
 mode=signal('audio');users=signal<any[]>([]);history=signal<Call[]>([]);relay=signal(false);relayLocal=signal(false);helperModal=signal(false);helperBusy=signal(false);helperError=signal('');helperToken='';member='';joinCode='';query='';private sub?:Subscription;private historyPoll?:ReturnType<typeof setInterval>;
 constructor(){afterNextRender(()=>{this.sub=this.route.queryParamMap.subscribe(p=>{this.mode.set(['audio','video','desktop','chat'].includes(p.get('mode')||'')?p.get('mode')!:'audio');this.member='';this.joinCode='';});void this.load();this.historyPoll=setInterval(()=>void this.loadHistory(),10000);});}
 async load(){try{this.users.set((await this.api.get<{items:any[]}>('users')).items);const config=await this.api.get<{relay_configured:boolean;relay_local:boolean}>('calls/config');this.relay.set(config.relay_configured);this.relayLocal.set(config.relay_local);await this.loadHistory();}catch(e){this.toasts.show(errorMessage(e));}}
 async loadHistory(){try{this.history.set((await this.api.get<{items:Call[]}>('calls')).items);}catch{}}
 tab(mode:string){void this.router.navigate([],{relativeTo:this.route,queryParams:{mode},queryParamsHandling:'merge'});this.member='';this.joinCode='';}
 filteredUsers(){return this.users().filter(u=>u.full_name.toLowerCase().includes(this.query.toLowerCase()));}
 async start(){await this.calls.create(this.mode()==='desktop'?'DESKTOP':this.mode()==='video'?'VIDEO':'AUDIO',this.member||undefined);void this.loadHistory();}
 async join(){await this.calls.join(this.joinCode.replace(/[ -]/g,''));if(this.calls.current())this.joinCode='';void this.loadHistory();}
 async copy(){try{await navigator.clipboard.writeText(this.calls.code());this.toasts.show('Session code copied.');}catch{this.toasts.show('Select the displayed code to copy it.');}}
 duration(){const s=this.calls.elapsed();return Math.floor(s/60).toString().padStart(2,'0')+':'+(s%60).toString().padStart(2,'0');}
 enableAudio(){document.querySelectorAll<HTMLVideoElement>('.call-stage video').forEach(video=>void video.play().catch(()=>this.toasts.show('Your browser blocked playback. Check site sound permissions.')));}
 position(event:MouseEvent){const element=event.currentTarget as HTMLElement,video=element.querySelector('video')!,rect=element.getBoundingClientRect();const ratio=(video.videoWidth||16)/(video.videoHeight||9);const width=Math.min(rect.width,rect.height*ratio),height=width/ratio;return {x:Math.max(0,Math.min(1,(event.clientX-rect.left-(rect.width-width)/2)/width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top-(rect.height-height)/2)/height))};}
 pointer(event:MouseEvent){if(this.calls.isHost())return;const point=this.position(event);this.calls.point(point.x,point.y);if(this.calls.current()?.control_allowed)this.calls.input({type:'move',...point});}
 clickDesktop(event:MouseEvent,down:boolean){if(this.calls.isHost()||!this.calls.current()?.control_allowed)return;(event.currentTarget as HTMLElement).focus();const point=this.position(event);this.calls.input({type:'button',button:event.button,down,...point});}
 wheel(event:WheelEvent){if(!this.calls.current()?.control_allowed)return;event.preventDefault();this.calls.input({type:'scroll',delta:Math.sign(event.deltaY)*-1});}
 key(event:KeyboardEvent,down:boolean){if(this.calls.isHost()||!this.calls.current()?.control_allowed)return;event.preventDefault();this.calls.input({type:'key',key:event.key,down});}
 closeHelper(){this.helperModal.set(false);this.helperToken='';this.helperError.set('');}
 async pairHelper(){this.helperBusy.set(true);this.helperError.set('');try{await this.calls.connectHelper(this.helperToken.trim());this.closeHelper();this.toasts.show('Desktop control enabled. Press F12 on the sharing computer to stop.');}catch(e){this.helperError.set(errorMessage(e));}finally{this.helperBusy.set(false);}}
 async removeSession(call:Call){await this.calls.endHistory(call.id);await this.loadHistory();}
 @HostListener('window:blur') blur(){this.calls.releaseInput();}
 ngOnDestroy(){this.calls.releaseInput();this.sub?.unsubscribe();clearInterval(this.historyPoll);this.member='';this.joinCode='';this.helperToken='';}
}
