import { Component,inject,signal,effect,OnDestroy,afterNextRender,HostListener } from '@angular/core';
import { RouterLink,RouterLinkActive,RouterOutlet,Router,NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { Auth } from '../core/auth.service';
import { Api,Toasts,errorMessage } from '../core/api.service';
import { Realtime } from '../core/realtime.service';
import { Calls } from '../core/calls.service';
import { Page,Notification,SearchResult } from '../core/models';
import { Icon } from '../shared/icon';
import { Modal } from '../shared/modal';
@Component({imports:[RouterLink,RouterLinkActive,RouterOutlet,FormsModule,DatePipe,Icon,Modal],templateUrl:'./workspace-layout.html',styleUrl:'./workspace-layout.css'})
export class WorkspaceLayout implements OnDestroy {
 auth=inject(Auth);api=inject(Api);realtime=inject(Realtime);calls=inject(Calls);router=inject(Router);toasts=inject(Toasts);
 collapsed=signal(false);mobile=signal(false);bell=signal(false);workspaceMenu=signal(false);searchOpen=signal(false);searchQuery='';searchResults=signal<SearchResult[]>([]);
 notifications=signal<Notification[]>([]);unread=signal(0);title=signal('Overview');expanded=signal<string[]>([]);
 groups=[{id:'projects',icon:'projects',label:'Projects',links:[{label:'My projects',path:'/workspace/projects',params:{}},{label:'Owner projects',path:'/projects',params:{}}]},
 {id:'planning',icon:'tasks',label:'Planning',links:[{label:'Tasks',path:'/workspace/tasks',params:{}},{label:'Goals',path:'/workspace/goals',params:{}}]},
 {id:'notes',icon:'notes',label:'Notepad',links:[{label:'All notes',path:'/workspace/notes',params:{view:'all'}},{label:'Pinned notes',path:'/workspace/notes',params:{view:'pinned'}},{label:'Favorites',path:'/workspace/notes',params:{view:'favorites'}},{label:'Archive',path:'/workspace/notes',params:{view:'archived'}}]},
 {id:'connect',icon:'phone',label:'Communication',links:[{label:'Voice calls',path:'/workspace/connect',params:{mode:'audio'}},{label:'Video calls',path:'/workspace/connect',params:{mode:'video'}},{label:'Desktop access',path:'/workspace/connect',params:{mode:'desktop'}},{label:'Messages',path:'/workspace/connect',params:{mode:'chat'}}]}];
 private subscription=new Subscription();private timer?:ReturnType<typeof setTimeout>;private poll?:ReturnType<typeof setInterval>;private searchGeneration=0;signingOut=signal(false);
 constructor(){effect(()=>this.collapsed.set(!!this.auth.user()?.preferences['compact_sidebar']));afterNextRender(()=>{this.realtime.connect();this.calls.start();void this.loadNotifications();this.poll=setInterval(()=>void this.loadNotifications(),30000);
  this.subscription.add(this.realtime.events.subscribe(e=>{if(e.type==='notification:new'||e.type==='notification:changed')void this.loadNotifications();}));
  this.subscription.add(this.router.events.subscribe(e=>{if(e instanceof NavigationEnd){this.mobile.set(false);this.bell.set(false);this.workspaceMenu.set(false);this.updateTitle();}}));this.updateTitle();});}
 @HostListener('document:click',['$event']) outside(event:Event){const node=event.target as HTMLElement;if(!node.closest('.notification-anchor'))this.bell.set(false);if(!node.closest('.workspace-switcher'))this.workspaceMenu.set(false);}
 @HostListener('document:keydown.escape') escape(){this.bell.set(false);this.workspaceMenu.set(false);this.mobile.set(false);}
 openWorkspaceMenu(){if(this.collapsed()&&!this.mobile()){void this.router.navigate(['/workspace/account']);return;}this.expanded.set([]);this.workspaceMenu.set(!this.workspaceMenu());}
 openFromLogo(){if(this.collapsed()&&!this.mobile()){this.collapsed.set(false);this.expanded.set([]);}else void this.router.navigate(['/']);}
 toggleSidebar(){this.workspaceMenu.set(false);if(this.mobile()){this.mobile.set(false);return;}this.collapsed.update(value=>!value);}
 toggleGroup(id:string){this.workspaceMenu.set(false);const group=this.groups.find(g=>g.id===id);if(this.collapsed()&&!this.mobile()){if(group)void this.router.navigate([group.links[0].path],{queryParams:group.links[0].params});return;}const open=!this.expanded().includes(id);this.expanded.set(open?[id]:[]);if(id==='notes'&&open&&this.router.url.split('?')[0]!=='/workspace/notes')void this.router.navigate(['/workspace/notes'],{queryParams:{view:'all'}});}
 groupActive(group:any){return group.links.some((link:any)=>this.router.url.split('?')[0]===link.path||this.router.url.split('?')[0].startsWith(link.path+'/'));}
 workspaceName(){return String(this.auth.user()?.preferences['workspace_name']||(this.auth.user()?.full_name.split(' ')[0]||'My')+"'s workspace");}
 updateTitle(){const path=this.router.url.split('?')[0];const titles:Record<string,string>={'/workspace':'Overview','/workspace/projects':'Projects','/workspace/tasks':'Tasks','/workspace/goals':'Goals','/workspace/notes':'Notepad','/workspace/reports':'Reports & analytics','/workspace/connect':'Communication','/workspace/messages':'Messages','/workspace/notifications':'Notifications','/workspace/account':'My account','/workspace/settings':'Settings'};this.title.set(path==='/workspace/connect'&&this.router.parseUrl(this.router.url).queryParams['mode']==='chat'?'Messages':titles[path]||'Project details');const activeGroup=this.groups.find(group=>this.groupActive(group));this.expanded.set(activeGroup?[activeGroup.id]:[]);}
 async loadNotifications(){if(this.auth.locked()||!this.auth.token())return;try{const data=await this.api.get<Page<Notification>>('notifications');this.notifications.set(data.items);this.unread.set(data.unread||0);}catch{}}
 async markAll(){try{await this.api.post('notifications/read-all');await this.loadNotifications();}catch(e){this.toasts.show(errorMessage(e));}}
 async removeNotification(n:Notification){try{await this.api.delete('notifications/'+n.id);await this.loadNotifications();}catch(e){this.toasts.show(errorMessage(e));}}
 async clearRead(){try{await this.api.delete('notifications?read_only=true');await this.loadNotifications();}catch(e){this.toasts.show(errorMessage(e));}}
 async openNotification(n:Notification){try{await this.api.post('notifications/'+n.id+'/read');this.bell.set(false);void this.loadNotifications();void this.router.navigateByUrl(n.link);}catch(e){this.toasts.show(errorMessage(e));}}
 closeSearch(){this.searchOpen.set(false);this.searchQuery='';this.searchResults.set([]);this.searchGeneration++;clearTimeout(this.timer);}
 search(){clearTimeout(this.timer);const generation=++this.searchGeneration;this.timer=setTimeout(async()=>{if(this.searchQuery.trim().length<2){this.searchResults.set([]);return;}try{const response=await this.api.get<Page<SearchResult>>('search?q='+encodeURIComponent(this.searchQuery));if(generation===this.searchGeneration)this.searchResults.set(response.items);}catch(e){this.toasts.show(errorMessage(e));}},300);}
 async signOut(){if(this.signingOut())return;this.signingOut.set(true);try{await this.auth.logout();}catch(e){this.toasts.show(errorMessage(e));}finally{this.signingOut.set(false);}}
 async lock(){try{await this.auth.lock();}catch(e){this.toasts.show(errorMessage(e));}}
 initials(){return this.auth.user()?.full_name.split(' ').map(s=>s[0]).slice(0,2).join('')||'KH';}
 ngOnDestroy(){void this.calls.stop();this.realtime.disconnect();this.subscription.unsubscribe();clearTimeout(this.timer);clearInterval(this.poll);}
}
