import { Component,inject,signal,afterNextRender,OnDestroy } from '@angular/core';
import { RouterLink,ActivatedRoute,Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { Api,Toasts,errorMessage } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import { Project,Task,Page } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Loader } from '../../shared/loader';
import { Markdown } from '../../shared/markdown';
import { AiSummary } from '../../shared/ai-summary';
import { ProjectImage } from '../../shared/project-image';
import { ResourceEditor } from '../../shared/editor';
@Component({imports:[RouterLink,DatePipe,Icon,Loader,Markdown,ResourceEditor,AiSummary,ProjectImage],templateUrl:'./detail.html',styles:'.project-demo-links{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}.project-story-cover{height:clamp(180px,30vw,380px);border-radius:12px;overflow:hidden;margin-bottom:28px}.portfolio-draft-banner{margin-bottom:24px}'})
export class ProjectDetail implements OnDestroy{
 uploading=signal(false);toasts=inject(Toasts);
 api=inject(Api);auth=inject(Auth);route=inject(ActivatedRoute);router=inject(Router);privateMode=!!this.route.snapshot.data['private'];preview=!!this.route.snapshot.data['portfolioPreview'];
 project=signal<Project|null>(null);tasks=signal<Task[]>([]);error=signal('');busy=signal(true);tab=signal('Overview');editing=signal(false);editable=signal(false);private subscription?:Subscription;private generation=0;
 tabs=['Overview','Documentation','Features','Architecture','Screenshots','Technologies','Tasks','Changelog','Code','Links','Settings'];
 constructor(){afterNextRender(()=>{this.subscription=this.route.paramMap.subscribe(()=>void this.load());});}
 canEdit(){return this.privateMode||this.editable()&&this.auth.user()?.role==='OWNER'&&!this.auth.locked();}
 async load(){const generation=++this.generation;this.busy.set(true);this.editable.set(false);try{
  if(!this.privateMode)await this.auth.ensure();
  const path=this.privateMode?'projects/'+this.route.snapshot.paramMap.get('id'):this.preview?'portfolio/projects/'+this.route.snapshot.paramMap.get('id'):'public/projects/'+this.route.snapshot.paramMap.get('slug');
  const project=await this.api.get<Project>(path);if(generation!==this.generation)return;this.project.set(project);
  if(this.preview)this.editable.set(true);
  else if(!this.privateMode&&this.auth.user()?.role==='OWNER'&&!this.auth.locked()){
   try{const own=await this.api.get<Project>('portfolio/projects/'+project.id);if(generation===this.generation){this.project.set(own);this.editable.set(true);}}catch{/* Another owner's project remains a public presentation. */}
  }
  if(this.privateMode){const data=await this.api.get<Page<Task>>('tasks?limit=100');if(generation===this.generation)this.tasks.set(data.items.filter(t=>t.project_id===project.id));}
  if(generation===this.generation)this.error.set('');
 }catch(e){if(generation===this.generation)this.error.set(errorMessage(e));}finally{if(generation===this.generation)this.busy.set(false);}}
 summaryText(p:Project){return [p.name,p.description,p.documentation,p.architecture].join('\n\n');}
 async uploadScreenshot(event:Event){const input=event.target as HTMLInputElement,file=input.files?.[0],p=this.project();if(!file||!p||!this.canEdit())return;
  if(file.size>5*1024*1024){this.toasts.show('Choose an image smaller than 5 MB.');input.value='';return;}const form=new FormData();form.append('file',file);this.uploading.set(true);
  try{this.project.set(await this.api.post<Project>('projects/'+p.id+'/screenshots',form));this.toasts.show('Screenshot added.');}catch(e){this.toasts.show(errorMessage(e));}finally{this.uploading.set(false);input.value='';}}
 async removeScreenshot(url:string){const p=this.project();if(!p||!this.canEdit())return;try{await this.api.delete('projects/'+p.id+'/screenshots/'+url.split('/').at(-1));await this.load();this.toasts.show('Screenshot removed.');}catch(e){this.toasts.show(errorMessage(e));}}
 async saved(project:Project){this.editing.set(false);this.project.set(project);this.toasts.show('Project saved.');
  if(this.privateMode){void this.load();return;}
  const next=project.is_public?'/projects/'+project.slug:'/projects/preview/'+project.id;
  if(this.router.url===next)void this.load();else await this.router.navigateByUrl(next);
 }
 ngOnDestroy(){this.generation++;this.subscription?.unsubscribe();}
}
