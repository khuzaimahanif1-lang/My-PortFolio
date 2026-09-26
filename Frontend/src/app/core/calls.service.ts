import { Injectable,inject,signal,OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Api,Toasts,errorMessage } from './api.service';
import { Auth } from './auth.service';
import { Realtime } from './realtime.service';
export interface Call {id:string;kind:'AUDIO'|'VIDEO'|'DESKTOP';state:string;initiator:{id:string;full_name:string};recipient:{id:string;full_name:string}|null;control_allowed:boolean;created_at:string;expires_at:string;code?:string;}
@Injectable({providedIn:'root'})
export class Calls implements OnDestroy {
 private api=inject(Api);private auth=inject(Auth);private realtime=inject(Realtime);private toasts=inject(Toasts);
 current=signal<Call|null>(null);incoming=signal<Call|null>(null);busy=signal(false);status=signal('Ready');error=signal('');code=signal('');
 local=signal<MediaStream|null>(null);remote=signal<MediaStream|null>(null);muted=signal(false);cameraOff=signal(false);sharing=signal(false);remoteSharing=signal(false);pointer=signal<{x:number;y:number}|null>(null);controlRequested=signal(false);helperConnected=signal(false);elapsed=signal(0);
 private sub?:Subscription;private peer?:RTCPeerConnection;private channel?:RTCDataChannel;private candidates:RTCIceCandidateInit[]=[];private iceServers:RTCIceServer[]=[];private camera?:MediaStreamTrack;private screen?:MediaStream;private helperKey='';private helperTimer?:ReturnType<typeof setInterval>;private clock?:ReturnType<typeof setInterval>;private poll?:ReturnType<typeof setInterval>;private startedAt=0;private connecting?:Promise<void>;private activation?:Promise<void>;private generation=0;private pointerTime=0;
 start(){if(this.sub)return;const generation=this.generation;this.sub=this.realtime.events.subscribe(e=>void this.event(e));this.poll=setInterval(()=>void this.check(),5000);void this.api.get<{ice_servers:RTCIceServer[]}>('calls/config').then(c=>{if(generation===this.generation)this.iceServers=c.ice_servers;}).catch(()=>{});}
 other(call=this.current()){return !call?null:call.initiator.id===this.auth.user()?.id?call.recipient:call.initiator;}
 isHost(){return this.current()?.initiator.id===this.auth.user()?.id;}
 label(){return this.current()?.kind==='DESKTOP'?'Desktop session':this.current()?.kind==='VIDEO'?'Video call':'Voice call';}
 private async media(kind:Call['kind'],host:boolean){const generation=this.generation;if(!navigator.mediaDevices)throw new Error('Calls require HTTPS or localhost and a browser with media support.');
  let stream:MediaStream;
  if(kind==='DESKTOP'){stream=host?await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'monitor'},audio:true}):new MediaStream();this.sharing.set(host);}
  else stream=await navigator.mediaDevices.getUserMedia({audio:true,video:kind==='VIDEO'?{width:{ideal:1280},height:{ideal:720}}:false});
  if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());throw new Error('The session changed.');}
  this.local.set(stream);this.camera=kind!=='DESKTOP'?stream.getVideoTracks()[0]:undefined;
  if(kind==='DESKTOP'&&host)stream.getVideoTracks()[0]?.addEventListener('ended',()=>void this.end(),{once:true});
 }
 async create(kind:Call['kind'],userId?:string){if(this.current()){this.toasts.show('End your current session first.');return;}this.busy.set(true);this.error.set('');try{
  await this.media(kind,true);const call=await this.api.post<Call>('calls',{kind,user_id:userId||null});this.current.set(call);this.code.set(call.code||'');this.status.set(userId?'Ringing':'Waiting for your guest');
 }catch(e){this.cleanup();this.fail(e);}finally{this.busy.set(false);}}
 async join(code:string){if(this.current()){this.toasts.show('End your current session first.');return;}this.busy.set(true);this.error.set('');try{const call=await this.api.post<Call>('calls/join',{code:code.trim().toUpperCase()});this.current.set(call);this.status.set('Waiting for the host to approve');}catch(e){this.fail(e);}finally{this.busy.set(false);}}
 async accept(){const invite=this.incoming();if(!invite||this.busy())return;if(this.current()&&this.current()?.id!==invite.id){this.toasts.show('End your current session before accepting.');return;}this.busy.set(true);try{
  if(!this.local())await this.media(invite.kind,invite.initiator.id===this.auth.user()?.id);
  this.current.set(invite);const call=await this.api.post<Call>('calls/'+invite.id+'/accept');this.incoming.set(null);this.current.set(call);this.status.set('Connecting');await this.begin();
 }catch(e){await this.end();this.fail(e);}finally{this.busy.set(false);}}
 async decline(){const invite=this.incoming();this.incoming.set(null);if(!invite)return;try{await this.api.post('calls/'+invite.id+'/end');if(this.current()?.id===invite.id)this.cleanup();}catch(e){this.fail(e);}}
 async end(){const call=this.current();this.cleanup();if(call)try{await this.api.post('calls/'+call.id+'/end');}catch(e){if(this.auth.token())this.toasts.show(errorMessage(e));}}
 async endHistory(id:string){try{await this.api.post('calls/'+id+'/end');}catch(e){this.fail(e);}}
 private async check(){const call=this.current();if(!call||this.auth.locked()||!this.auth.token())return;try{const latest=await this.api.get<Call>('calls/'+call.id);if(this.current()?.id===latest.id)await this.changed(latest);}catch{}}
 private async event(e:any){try{
  if(e.type==='call:invite'){const call=e.call as Call;const shouldReceive=call.state==='RINGING'&&call.recipient?.id===this.auth.user()?.id||call.state==='REQUESTED'&&call.initiator.id===this.auth.user()?.id;if(shouldReceive)this.incoming.set(call);if(this.current()?.id===call.id)this.current.set(call);}
  if(e.type==='call:changed')await this.changed(e.call);
  if(e.type==='call:signal'&&this.current()?.id===e.call_id){await this.activate();await this.signal(e.signal);}
 }catch(e){this.fail(e);}}
 private async changed(call:Call){if(this.incoming()?.id===call.id&&['ACTIVE','ENDED','DECLINED','EXPIRED'].includes(call.state))this.incoming.set(null);if(this.current()?.id!==call.id)return;this.current.set(call);
  if(['ENDED','DECLINED','EXPIRED'].includes(call.state)){this.cleanup();this.status.set(call.state==='DECLINED'?'Request declined':call.state==='EXPIRED'?'Code expired':'Session ended');return;}
  if(!call.control_allowed&&this.helperKey)await this.disconnectHelper(false);
  if(call.state==='ACTIVE'){this.code.set('');await this.activate();}
 }
 private activate():Promise<void>{if(this.activation)return this.activation;this.activation=(async()=>{let call=this.current();if(!call)return;if(call.state!=='ACTIVE'){call=await this.api.get<Call>('calls/'+call.id);this.current.set(call);}if(call.state!=='ACTIVE')return;if(!this.local())await this.media(call.kind,this.isHost());await this.begin();})().finally(()=>this.activation=undefined);return this.activation;}
 private begin():Promise<void>{if(this.peer)return Promise.resolve();if(this.connecting)return this.connecting;this.connecting=this.buildPeer().finally(()=>this.connecting=undefined);return this.connecting;}
 private async buildPeer(){const call=this.current();if(!call||call.state!=='ACTIVE')return;const generation=this.generation;
  if(!this.iceServers.length){const config=await this.api.get<{ice_servers:RTCIceServer[]}>('calls/config');this.iceServers=config.ice_servers;}
  if(generation!==this.generation||this.current()?.id!==call.id)return;
  const peer=new RTCPeerConnection({iceServers:this.iceServers});this.peer=peer;const local=this.local()||new MediaStream();const remote=new MediaStream();this.remote.set(remote);
  for(const kind of ['audio','video'] as const){const track=local.getTracks().find(t=>t.kind===kind);if(track)peer.addTransceiver(track,{streams:[local],direction:'sendrecv'});else peer.addTransceiver(kind,{direction:kind==='video'&&call.kind==='DESKTOP'&&!this.isHost()?'recvonly':'sendrecv'});}
  peer.ontrack=e=>{if(this.peer!==peer)return;if(!remote.getTracks().includes(e.track))remote.addTrack(e.track);this.remote.set(new MediaStream(remote.getTracks()));};
  peer.onicecandidate=e=>{if(e.candidate)void this.sendSignal({type:'candidate',candidate:e.candidate.toJSON()});};
  peer.onconnectionstatechange=()=>{if(this.peer!==peer)return;if(['failed','disconnected','closed'].includes(peer.connectionState))void this.disconnectHelper();this.status.set(peer.connectionState==='connected'?'Connected':peer.connectionState==='failed'?'Connection failed — try again':peer.connectionState==='disconnected'?'Connection interrupted': 'Connecting');if(peer.connectionState==='connected'&&!this.clock){this.startedAt=Date.now();this.clock=setInterval(()=>this.elapsed.set(Math.floor((Date.now()-this.startedAt)/1000)),1000);}};
  if(this.isHost()){this.bindChannel(peer.createDataChannel('collaboration'));const offer=await peer.createOffer();await peer.setLocalDescription(offer);await this.sendSignal({type:'offer',sdp:offer.sdp});}else peer.ondatachannel=e=>this.bindChannel(e.channel);
 }
 private async sendSignal(signal:any){const call=this.current();if(!call)return;try{await this.api.post('calls/'+call.id+'/signal',signal);}catch(e){if(this.current()?.id===call.id)this.fail(e);}}
 private async signal(signal:any){const peer=this.peer;if(!peer)return;
  if(signal.type==='candidate'){if(peer.remoteDescription)await peer.addIceCandidate(signal.candidate);else this.candidates.push(signal.candidate);return;}
  await peer.setRemoteDescription({type:signal.type,sdp:signal.sdp});for(const candidate of this.candidates.splice(0))await peer.addIceCandidate(candidate);
  if(signal.type==='offer'){const answer=await peer.createAnswer();await peer.setLocalDescription(answer);await this.sendSignal({type:'answer',sdp:answer.sdp});}
 }
 private bindChannel(channel:RTCDataChannel){this.channel=channel;channel.onclose=()=>void this.disconnectHelper();channel.onmessage=({data})=>{try{const message=JSON.parse(data);if(message.type==='sharing')this.remoteSharing.set(!!message.active);if(message.type==='pointer')this.pointer.set({x:Math.max(0,Math.min(1,message.x)),y:Math.max(0,Math.min(1,message.y))});if(message.type==='control:request'&&this.isHost())this.controlRequested.set(true);if(message.type==='control:input'&&this.isHost()&&this.current()?.control_allowed&&this.helperKey)void this.helper('input',{event:message.event}).catch(()=>void this.disconnectHelper());}catch{}};}
 private data(message:any){if(this.channel?.readyState==='open')this.channel.send(JSON.stringify(message));}
 releaseInput(){this.input({type:'release'});}
 point(x:number,y:number){if(Date.now()-this.pointerTime<40)return;this.pointerTime=Date.now();this.data({type:'pointer',x,y});}
 requestControl(){this.data({type:'control:request'});this.toasts.show('Control requested. The sharing person must approve on their computer.');}
 input(event:any){if(!this.isHost()&&this.current()?.control_allowed)this.data({type:'control:input',event});}
 toggleMute(){this.muted.set(!this.muted());this.local()?.getAudioTracks().forEach(track=>track.enabled=!this.muted());}
 toggleCamera(){this.cameraOff.set(!this.cameraOff());this.local()?.getVideoTracks().forEach(track=>track.enabled=!this.cameraOff());}
 async shareScreen(){const generation=this.generation;try{const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});if(generation!==this.generation||!this.current()){stream.getTracks().forEach(t=>t.stop());return;}this.screen=stream;const track=stream.getVideoTracks()[0];const sender=this.peer?.getTransceivers().find(t=>t.receiver.track.kind==='video')?.sender;await sender?.replaceTrack(track);if(generation!==this.generation||!this.current()){stream.getTracks().forEach(t=>t.stop());return;}const audio=this.local()?.getAudioTracks()||[];this.local.set(new MediaStream([...audio,track]));this.sharing.set(true);this.data({type:'sharing',active:true});track.addEventListener('ended',()=>void this.stopSharing(),{once:true});}catch(e){this.fail(e);}}
 async stopSharing(){const generation=this.generation;this.screen?.getTracks().forEach(t=>t.stop());this.screen=undefined;const sender=this.peer?.getTransceivers().find(t=>t.receiver.track.kind==='video')?.sender;await sender?.replaceTrack(this.camera||null);if(generation!==this.generation||!this.current())return;this.local.set(new MediaStream([...(this.local()?.getAudioTracks()||[]),...(this.camera?[this.camera]:[])]));this.sharing.set(false);this.data({type:'sharing',active:false});}
 async connectHelper(token:string){const call=this.current();if(!call||!this.isHost()||call.kind!=='DESKTOP')return;
  const track=this.local()?.getVideoTracks()[0];if(track?.getSettings().displaySurface!=='monitor')throw new Error('Share your entire primary screen before enabling desktop control.');
  const response=await this.helper('pair',{token,call_id:call.id,peer_name:this.other()?.full_name||'Guest'},false);this.helperKey=response.key;
  try{this.current.set(await this.api.post<Call>('calls/'+call.id+'/control',{enabled:true}));this.helperConnected.set(true);this.controlRequested.set(false);this.helperTimer=setInterval(()=>void this.helper('heartbeat',{}).catch(()=>void this.disconnectHelper()),5000);}catch(e){await this.disconnectHelper();throw e;}
 }
 private async helper(path:string,body:any,authorized=true){const response=await fetch('http://127.0.0.1:8765/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(authorized?{'X-Desktop-Key':this.helperKey}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(path==='pair'?65000:5000)});const result=await response.json();if(!response.ok)throw new Error(result.detail||'Desktop helper request failed.');return result;}
 async disconnectHelper(update=true){clearInterval(this.helperTimer);if(this.helperKey)try{await this.helper('revoke',{});}catch{}this.helperKey='';this.helperConnected.set(false);if(update&&this.current()?.control_allowed&&this.isHost())try{this.current.set(await this.api.post<Call>('calls/'+this.current()!.id+'/control',{enabled:false}));}catch{}}
 private fail(e:unknown){let message=errorMessage(e);if(e instanceof DOMException){message=e.name==='NotAllowedError'?'Camera, microphone, or screen permission was declined. You can try again.':e.name==='NotFoundError'?'No matching camera or microphone was found. Connect a device and try again.':e.message;}this.error.set(message);this.toasts.show(message);}
 private cleanup(){this.generation++;void this.disconnectHelper(false);clearInterval(this.clock);this.clock=undefined;this.channel?.close();this.channel=undefined;this.peer?.close();this.peer=undefined;this.connecting=undefined;this.activation=undefined;this.local()?.getTracks().forEach(t=>t.stop());this.screen?.getTracks().forEach(t=>t.stop());this.camera?.stop();this.camera=undefined;this.screen=undefined;this.local.set(null);this.remote.set(null);this.current.set(null);this.incoming.set(null);this.code.set('');this.candidates=[];this.muted.set(false);this.cameraOff.set(false);this.sharing.set(false);this.remoteSharing.set(false);this.pointer.set(null);this.controlRequested.set(false);this.elapsed.set(0);this.status.set('Ready');}
 async stop(){this.sub?.unsubscribe();this.sub=undefined;clearInterval(this.poll);await this.end();this.iceServers=[];}
 ngOnDestroy(){void this.stop();}
}
