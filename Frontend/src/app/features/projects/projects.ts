import { Component,inject,signal,afterNextRender,OnDestroy } from '@angular/core';
import { ActivatedRoute,Router,RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Api,errorMessage,Toasts } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import { Project,Page } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Loader } from '../../shared/loader';
import { Modal } from '../../shared/modal';
import { ResourceEditor } from '../../shared/editor';
import { ProjectImage } from '../../shared/project-image';
@Component({imports:[RouterLink,FormsModule,Icon,Loader,Modal,ResourceEditor,ProjectImage],templateUrl:'./projects.html',styles:`
 .portfolio-cover{position:absolute;inset:0}.workspace-project-art{position:relative;overflow:hidden}.workspace-project-art>.tag,.workspace-project-art>app-icon:last-child{position:relative;z-index:1}
 .public-project-grid .workspace-project-art{height:clamp(200px,23vw,280px)}.public-project-grid .workspace-project-art>.tag{position:absolute;bottom:16px;left:16px;background:var(--panel);opacity:.9}.public-project-grid .workspace-project-art>app-icon:last-child{position:absolute;right:18px;top:18px}
 .portfolio-card-links{display:flex;flex-wrap:wrap;gap:16px;margin-top:16px}.portfolio-card-actions{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.portfolio-card-actions button{white-space:nowrap}.portfolio-card-actions .button{padding:8px 12px;font-size:12px}.portfolio-owner-note{margin-bottom:24px;color:var(--muted)}
 `})
export class Projects implements OnDestroy{
 Math=Math;api=inject(Api);auth=inject(Auth);route=inject(ActivatedRoute);router=inject(Router);toasts=inject(Toasts);privateMode=!!this.route.snapshot.data['private'];
 items=signal<Project[]>([]);busy=signal(true);error=signal('');editor=signal<any>(undefined);deleting=signal<Project|null>(null);
 query='';status='';page=1;total=signal(0);private timer?:ReturnType<typeof setTimeout>;
 constructor(){afterNextRender(()=>void this.load());}
 ownerMode(){return !this.privateMode&&this.auth.user()?.role==='OWNER'&&!this.auth.locked();}
 canManage(){return this.privateMode||this.ownerMode();}
 endpoint(){return this.privateMode?'projects':'portfolio/projects';}
 link(p:Project){return this.privateMode?['/workspace/projects',p.id]:p.is_public?['/projects',p.slug]:['/projects/preview',p.id];}
 add(){if(this.canManage())this.editor.set(this.privateMode?null:{is_public:true});}
 unlock(){this.auth.returnUrl='/projects';void this.router.navigate(['/unlock']);}
 async load(){this.busy.set(true);try{
  if(!this.privateMode)await this.auth.ensure();
  const path=this.privateMode?'projects?q='+encodeURIComponent(this.query)+'&status='+this.status+'&page='+this.page+'&limit=12':this.ownerMode()?'portfolio/projects?q='+encodeURIComponent(this.query)+'&status='+this.status+'&page='+this.page+'&limit=12':'public/projects';
  const response=await this.api.get<Page<Project>>(path);this.items.set(response.items);this.total.set(response.total??response.items.length);this.error.set('');
 }catch(e){this.error.set(errorMessage(e));}finally{this.busy.set(false);}}
 filter(){this.page=1;clearTimeout(this.timer);this.timer=setTimeout(()=>void this.load(),250);}
 saved(){this.editor.set(undefined);this.toasts.show('Project saved.');void this.load();}
 async remove(){const project=this.deleting();if(!project||!this.canManage())return;try{await this.api.delete(this.endpoint()+'/'+project.id);this.deleting.set(null);this.toasts.show('Project deleted.');void this.load();}catch(e){this.toasts.show(errorMessage(e));}}
 next(step:number){this.page+=step;void this.load();}
 ngOnDestroy(){clearTimeout(this.timer);}
}
