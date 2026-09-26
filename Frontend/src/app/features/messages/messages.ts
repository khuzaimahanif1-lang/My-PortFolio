import { Component,inject,signal,afterNextRender,OnDestroy,ViewChild,ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { Api,Toasts,errorMessage } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import { Realtime } from '../../core/realtime.service';
import { Conversation,Message,Member,Page } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Loader } from '../../shared/loader';
import { Modal } from '../../shared/modal';
@Component({selector:'app-messages',imports:[FormsModule,DatePipe,Icon,Loader,Modal],templateUrl:'./messages.html',styleUrl:'./messages.css'})
export class Messages implements OnDestroy{
 api=inject(Api);auth=inject(Auth);realtime=inject(Realtime);toasts=inject(Toasts);http=inject(HttpClient);
 conversations=signal<Conversation[]>([]);selected=signal<Conversation|null>(null);messages=signal<Message[]>([]);
 users=signal<Member[]>([]);newChat=signal(false);busy=signal(true);loadingHistory=signal(false);error=signal('');sending=signal(false);
 attachment=signal<{id:string;url:string}|null>(null);uploadProgress=signal(-1);typing=signal(false);hasMore=signal(false);
 content='';query='';userQuery='';imageUrls=signal<Record<string,string>>({});private sub?:Subscription;private typingTimer?:ReturnType<typeof setTimeout>;private incomingTyping?:ReturnType<typeof setTimeout>;private upload?:Subscription;private generation=0;private destroyed=false;
 @ViewChild('history') history?:ElementRef<HTMLElement>;
 constructor(){afterNextRender(()=>{void this.load();this.sub=this.realtime.events.subscribe(e=>void this.event(e));});}
 initials(name:string){return name.split(' ').map(s=>s[0]).slice(0,2).join('');}
 preview(c:Conversation){const m=c.last_message;if(!m)return 'Start the conversation';return (m.sender_id===this.auth.user()?.id?'You: ':'')+(m.content||(m.attachment_id?'Image':''));}
 visible(){return this.conversations().filter(c=>(c.member.full_name+' '+(c.last_message?.content||'')).toLowerCase().includes(this.query.toLowerCase()));}
 async load(){this.busy.set(true);try{this.conversations.set((await this.api.get<Page<Conversation>>('conversations')).items);this.error.set('');}catch(e){this.error.set(errorMessage(e));}finally{this.busy.set(false);}}
 async choose(c:Conversation){const generation=++this.generation;this.upload?.unsubscribe();this.uploadProgress.set(-1);this.removeAttachment();clearTimeout(this.incomingTyping);this.releaseImages();this.messages.set([]);this.selected.set(c);this.loadingHistory.set(true);this.typing.set(false);this.content='';this.attachment.set(null);
 try{const data=await this.api.get<Page<Message>>('conversations/'+c.id+'/messages');if(generation!==this.generation)return;this.messages.set(data.items);this.hasMore.set(!!data.has_more);await this.images(data.items);await this.api.post('conversations/'+c.id+'/read');this.conversations.update(items=>items.map(i=>i.id===c.id?{...i,unread:0}:i));this.scroll();}
 catch(e){this.toasts.show(errorMessage(e));}finally{if(generation===this.generation)this.loadingHistory.set(false);}}
 async more(){const c=this.selected(),first=this.messages()[0];if(!c||!first)return;
 try{const data=await this.api.get<Page<Message>>('conversations/'+c.id+'/messages?before='+first.id);if(this.selected()?.id!==c.id)return;this.messages.update(m=>[...data.items,...m]);this.hasMore.set(!!data.has_more);await this.images(data.items);}catch(e){this.toasts.show(errorMessage(e));}}
 async findUsers(){try{this.users.set((await this.api.get<Page<Member>>('users?q='+encodeURIComponent(this.userQuery))).items);}catch(e){this.toasts.show(errorMessage(e));}}
 async start(user:Member){try{const c=await this.api.post<Conversation>('conversations',{user_id:user.id});this.newChat.set(false);await this.load();await this.choose(this.conversations().find(i=>i.id===c.id)!);}catch(e){this.toasts.show(errorMessage(e));}}
 openNew(){this.newChat.set(true);void this.findUsers();}
 async send(){const c=this.selected();if(!c||this.sending()||(!this.content.trim()&&!this.attachment()))return;
 const content=this.content,attachment=this.attachment();this.sending.set(true);try{const message=await this.api.post<Message>('conversations/'+c.id+'/messages',{content,attachment_id:attachment?.id||null});
 if(this.selected()?.id!==c.id){void this.refreshConversations();return;}if(!this.messages().some(m=>m.id===message.id))this.messages.update(m=>[...m,message]);if(this.content===content)this.content='';if(this.attachment()?.id===attachment?.id)this.removeAttachment();this.realtime.typing(c.id,false);await this.images([message]);this.scroll();void this.refreshConversations();}
 catch(e){this.toasts.show(errorMessage(e)+' Your message is kept here so you can retry.');}finally{this.sending.set(false);}}
 async refreshConversations(){try{this.conversations.set((await this.api.get<Page<Conversation>>('conversations')).items);}catch{}}
 onTyping(){const c=this.selected();if(!c)return;this.realtime.typing(c.id,true);clearTimeout(this.typingTimer);this.typingTimer=setTimeout(()=>this.realtime.typing(c.id,false),1500);}
 attach(event:Event){const file=(event.target as HTMLInputElement).files?.[0],c=this.selected();if(!file||!c)return;
 if(file.size>5*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){this.toasts.show('Choose a PNG, JPEG or WebP image smaller than 5 MB.');return;}
 this.upload?.unsubscribe();this.removeAttachment();const form=new FormData();form.append('file',file);form.append('conversation_id',c.id);this.uploadProgress.set(0);
 this.upload=this.http.post<any>('/api/uploads',form,{observe:'events',reportProgress:true}).subscribe({next:e=>{
 if(e.type===1&&e.total)this.uploadProgress.set(Math.round(e.loaded/e.total*100));
 if(e.type===4){if(this.selected()?.id!==c.id)return;this.attachment.set({id:e.body.id,url:URL.createObjectURL(file)});this.uploadProgress.set(-1);}},
 error:e=>{this.uploadProgress.set(-1);this.toasts.show(errorMessage(e));}});(event.target as HTMLInputElement).value='';}
 removeAttachment(){const image=this.attachment();if(image)URL.revokeObjectURL(image.url);this.attachment.set(null);}
 releaseImages(){Object.values(this.imageUrls()).forEach(url=>URL.revokeObjectURL(url));this.imageUrls.set({});}
 async images(messages:Message[]){const generation=this.generation;await Promise.all(messages.filter(m=>m.attachment_id&&!this.imageUrls()[m.attachment_id!]).map(async m=>{
 try{const blob=await this.api.blob('uploads/'+m.attachment_id);if(this.destroyed||generation!==this.generation)return;this.imageUrls.update(urls=>({...urls,[m.attachment_id!]:URL.createObjectURL(blob)}));}catch{}}));}
 links(content:string){return content.match(/https?:\/\/[^\s<>"]+/g)?.slice(0,3)||[];}
 scroll(){setTimeout(()=>{const h=this.history?.nativeElement;if(h)h.scrollTop=h.scrollHeight;},30);}
 async event(e:any){
 if(e.type==='message:new'){const m=e.message as Message;if(m.conversation_id===this.selected()?.id){if(!this.messages().some(i=>i.id===m.id))this.messages.update(i=>[...i,m]);await this.images([m]);this.typing.set(false);this.scroll();if(m.sender_id!==this.auth.user()?.id)await this.api.post('conversations/'+m.conversation_id+'/read');}void this.refreshConversations();}
 if(e.type==='message:read'&&e.conversation_id===this.selected()?.id&&e.reader_id!==this.auth.user()?.id)this.messages.update(m=>m.map(i=>i.sender_id===this.auth.user()?.id?{...i,read_at:new Date().toISOString()}:i));
 if(e.type==='message:typing'&&e.conversation_id===this.selected()?.id){this.typing.set(true);clearTimeout(this.incomingTyping);this.incomingTyping=setTimeout(()=>this.typing.set(false),2500);}
 if(e.type==='message:stop_typing'&&e.conversation_id===this.selected()?.id)this.typing.set(false);
 }
 ngOnDestroy(){this.destroyed=true;this.generation++;this.sub?.unsubscribe();this.upload?.unsubscribe();clearTimeout(this.typingTimer);clearTimeout(this.incomingTyping);this.releaseImages();this.removeAttachment();}
}

