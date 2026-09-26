import { Component,inject,signal,afterNextRender,OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Api,Toasts,errorMessage } from '../../core/api.service';
import { Task,Goal,Page } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Loader } from '../../shared/loader';
import { Modal } from '../../shared/modal';
import { ResourceEditor,resourcePayload } from '../../shared/editor';
@Component({imports:[FormsModule,DatePipe,Icon,Loader,Modal,ResourceEditor],templateUrl:'./resources.html'})
export class Resources implements OnDestroy{
 api=inject(Api);route=inject(ActivatedRoute);toasts=inject(Toasts);type=this.route.snapshot.data['kind'] as string;
 items=signal<any[]>([]);busy=signal(true);error=signal('');editor=signal<any>(undefined);deleting=signal<any>(null);details=signal<Task|null>(null);
 query='';view=signal('board');comment='';dragged:Task|null=null;page=1;total=signal(0);private timer?:ReturnType<typeof setTimeout>;
 statuses=['TODO','IN_PROGRESS','REVIEW','COMPLETED'];
 constructor(){afterNextRender(()=>void this.load());}
 async load(){this.busy.set(true);try{const result=await this.api.get<Page<any>>(this.type+'?q='+encodeURIComponent(this.query)+'&page='+this.page+'&limit=50');this.items.set(result.items);this.total.set(result.total||0);this.error.set('');}catch(e){this.error.set(errorMessage(e));}finally{this.busy.set(false);}}
 filter(){this.page=1;clearTimeout(this.timer);this.timer=setTimeout(()=>void this.load(),250);}
 inStatus(status:string){return this.items().filter(i=>i.status===status);}
 async changeStatus(item:Task,status:string){try{const saved=await this.api.put<Task>('tasks/'+item.id,{...resourcePayload('tasks',item),status,progress:status==='COMPLETED'?100:item.progress});this.items.update(items=>items.map(i=>i.id===saved.id?saved:i));this.toasts.show('Task updated.');}catch(e){this.toasts.show(errorMessage(e));}}
 drop(status:string){if(this.dragged)void this.changeStatus(this.dragged,status);this.dragged=null;}
 async milestone(goal:Goal,index:number){const milestones=goal.milestones.map((m,i)=>i===index?{...m,done:!m.done}:m);
 const progress=Math.round(milestones.filter(m=>m.done).length/Math.max(1,milestones.length)*100);
 try{const saved=await this.api.put<Goal>('goals/'+goal.id,{...resourcePayload('goals',goal),milestones,progress});this.items.update(items=>items.map(i=>i.id===saved.id?saved:i));this.toasts.show(progress===100?'Goal completed. Well done.':'Milestone saved.');}catch(e){this.toasts.show(errorMessage(e));}}
 saved(){this.editor.set(undefined);this.toasts.show(this.type==='tasks'?'Task saved.':'Goal saved.');void this.load();}
 async remove(){const item=this.deleting();if(!item)return;try{await this.api.delete(this.type+'/'+item.id);this.deleting.set(null);this.toasts.show('Deleted.');void this.load();}catch(e){this.toasts.show(errorMessage(e));}}
 async subtask(task:Task,index:number){const subtasks=task.subtasks.map((s,i)=>i===index?{...s,done:!s.done}:s);const progress=Math.round(subtasks.filter(s=>s.done).length/Math.max(1,subtasks.length)*100);
 try{const saved=await this.api.put<Task>('tasks/'+task.id,{...resourcePayload('tasks',task),subtasks,progress,status:progress===100?'COMPLETED':task.status==='COMPLETED'?'IN_PROGRESS':task.status});this.details.set(saved);this.items.update(items=>items.map(i=>i.id===saved.id?saved:i));}catch(e){this.toasts.show(errorMessage(e));}}
 async addComment(){const task=this.details();if(!task||!this.comment.trim())return;try{const saved=await this.api.post<Task>('tasks/'+task.id+'/comments',{content:this.comment});this.details.set(saved);this.comment='';this.items.update(items=>items.map(i=>i.id===saved.id?saved:i));}catch(e){this.toasts.show(errorMessage(e));}}
 next(step:number){this.page+=step;void this.load();}
 ngOnDestroy(){clearTimeout(this.timer);}
}

