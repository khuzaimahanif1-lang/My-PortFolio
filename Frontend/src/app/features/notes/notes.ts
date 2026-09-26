import { Component,inject,signal,afterNextRender,OnDestroy } from '@angular/core';
import { ActivatedRoute,Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Api,Toasts,errorMessage } from '../../core/api.service';
import { Note,Page } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Loader } from '../../shared/loader';
import { Modal } from '../../shared/modal';
import { Markdown } from '../../shared/markdown';
import { resourcePayload } from '../../shared/editor';
@Component({imports:[FormsModule,DatePipe,Icon,Loader,Modal,Markdown],templateUrl:'./notes.html',styleUrl:'./notes.css'})
export class Notes implements OnDestroy {
 route=inject(ActivatedRoute);router=inject(Router);private routeSub?:Subscription;
 api=inject(Api);toasts=inject(Toasts);notes=signal<Note[]>([]);selected=signal<Note|null>(null);busy=signal(true);error=signal('');creating=signal(false);deleting=signal(false);preview=signal(false);filter=signal('all');savedState=signal('All changes saved');
 draft:any={};query='';tags='';page=1;total=signal(0);mobileEditing=signal(false);categories=['AI Ideas','Project Ideas','Learning','Research','Technical Notes','Goals','Future Plans','Personal'];
 private timer?:ReturnType<typeof setTimeout>;private revision=0;private dirty=false;private queue:Promise<void>=Promise.resolve();
 constructor(){afterNextRender(()=>{this.routeSub=this.route.queryParamMap.subscribe(p=>void this.changeFilter(p.get('view')||'all'));void this.load();});}
 chooseFilter(view:string){void this.router.navigate([], {relativeTo:this.route,queryParams:{view}});}
 async flush(){if(this.dirty)await this.save();await this.queue;return !this.dirty;}
 async changeFilter(value:string){const filter=['all','pinned','favorites','archived'].includes(value)?value:'all';if(this.filter()===filter)return;if(!await this.flush())return;this.filter.set(filter);this.query='';this.mobileEditing.set(false);const note=this.visible()[0];if(note)await this.select(note,false);else{this.selected.set(null);this.creating.set(false);this.draft={};}}
 async load(){this.busy.set(true);try{const data=await this.api.get<Page<Note>>('notes?limit=100&page='+this.page);this.notes.set(data.items);this.total.set(data.total||0);this.error.set('');if(!this.selected()&&!this.creating()){if(this.visible().length)await this.select(this.visible()[0],false);else if(this.filter()==='all')await this.beginNew(false);}}catch(e){this.error.set(errorMessage(e));}finally{this.busy.set(false);}}
 visible(){return this.notes().filter(n=>(this.filter()==='archived'?n.archived:!n.archived)&&
 (this.filter()!=='pinned'||n.pinned)&&(this.filter()!=='favorites'||n.favorite)&&
 (n.title+' '+n.content+' '+n.tags.join(' ')).toLowerCase().includes(this.query.toLowerCase())).sort((a,b)=>Number(b.pinned)-Number(a.pinned));}
 async select(note:Note,open=true){if(!await this.flush())return;clearTimeout(this.timer);note=this.notes().find(n=>n.id===note.id)||note;this.selected.set(note);this.creating.set(false);this.draft=resourcePayload('notes',note);this.tags=note.tags.join(', ');this.revision++;this.preview.set(false);this.mobileEditing.set(open);this.savedState.set('All changes saved');}
 async beginNew(open=true){if(!await this.flush())return;clearTimeout(this.timer);this.selected.set(null);this.creating.set(true);this.draft=resourcePayload('notes',{title:'Untitled note'});this.tags='';this.preview.set(false);this.revision++;this.mobileEditing.set(open);this.savedState.set('Start writing to save your note');}
 changed(){this.draft.tags=this.tags.split(',').map(s=>s.trim()).filter(Boolean);this.revision++;this.dirty=true;this.savedState.set('Unsaved changes');clearTimeout(this.timer);this.timer=setTimeout(()=>void this.save(),900);}
 async save(force=false){clearTimeout(this.timer);if(force&&(this.selected()||this.creating()))this.dirty=true;
 this.queue=this.queue.then(async()=>{if(!this.dirty||(!this.selected()&&!this.creating()))return;
 const payload={...this.draft,title:String(this.draft.title||'').trim(),tags:[...this.draft.tags]},revision=this.revision,id=this.selected()?.id;
 if(payload.title.length<2){this.savedState.set('Use at least two characters for the title');return;}this.savedState.set('Saving…');
 try{const result=id?await this.api.put<Note>('notes/'+id,payload):await this.api.post<Note>('notes',payload);
 this.notes.update(items=>items.some(n=>n.id===result.id)?items.map(n=>n.id===result.id?result:n):[result,...items]);this.selected.set(result);this.creating.set(false);
 if(revision===this.revision){this.dirty=false;this.savedState.set('All changes saved');}else this.savedState.set('Unsaved changes');}
 catch(e){this.dirty=true;this.savedState.set('Save failed — retry');this.toasts.show(errorMessage(e));}});
 await this.queue;}
 async toggle(key:string){this.draft[key]=!this.draft[key];this.changed();await this.save();}
 async remove(){clearTimeout(this.timer);await this.queue;const note=this.selected();if(!note)return;try{await this.api.delete('notes/'+note.id);this.dirty=false;this.deleting.set(false);this.notes.update(n=>n.filter(i=>i.id!==note.id));this.selected.set(null);if(this.visible().length)await this.select(this.visible()[0]);else if(this.filter()==='all')await this.beginNew();else this.mobileEditing.set(false);this.toasts.show('Note deleted.');}catch(e){this.toasts.show(errorMessage(e));}}
 async changePage(step:number){if(!await this.flush())return;this.page+=step;this.selected.set(null);this.creating.set(false);await this.load();}
 ngOnDestroy(){this.routeSub?.unsubscribe();clearTimeout(this.timer);if(this.dirty)void this.save();}
}

