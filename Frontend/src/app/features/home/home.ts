import { Component, inject, signal, afterNextRender,OnDestroy } from '@angular/core';
import { Router,RouterLink,ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { Api, errorMessage } from '../../core/api.service';
import { Portfolio, Project, Page } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Reveal } from '../../shared/reveal';
import { Immersive, OrbitScene } from '../../shared/immersive';
import { Auth } from '../../core/auth.service';
import { ResourceEditor } from '../../shared/editor';
import { ProjectImage } from '../../shared/project-image';
import { PortfolioProjectManager } from '../../shared/portfolio-project-manager';
export const defaultPortfolio: Portfolio = {name:'Khuzaima Hanif',title:'AI Engineer · Full-Stack Developer · AI Enthusiast',
  bio:'I explore artificial intelligence and build thoughtful web experiences. My focus is simple: keep learning, solve real problems, and turn ambitious ideas into useful tools.',
  skills:['Angular','TypeScript','Python','FastAPI','MySQL','Machine Learning','Three.js','WebSocket'],
  location:'',email:'',github_url:'',linkedin_url:'',journey:[],achievements:[],vision:'Build intelligent tools that make a meaningful difference. Stay curious. Keep creating.'};
@Component({imports:[RouterLink,Icon,Reveal,Immersive,OrbitScene,ResourceEditor,ProjectImage,PortfolioProjectManager],templateUrl:'./home.html',styleUrl:'./home.css'})
export class Home implements OnDestroy {
  api=inject(Api);auth=inject(Auth);router=inject(Router);route=inject(ActivatedRoute);selectedProject=signal(0);profile=signal<Portfolio>(defaultPortfolio);projects=signal<Project[]>([]);error=signal('');editor=signal<any>(undefined);management=signal(false);accessMessage=signal('');private routeSub?:Subscription;
  motion=signal(false);private destroyed=false;
  constructor(){afterNextRender(()=>{this.motion.set(!document.documentElement.classList.contains('reduce-motion') && !matchMedia('(prefers-reduced-motion: reduce)').matches && !(navigator as any).connection?.saveData);void this.initialize();});}
  async initialize(){await this.load();if(this.destroyed)return;this.routeSub=this.route.queryParamMap.subscribe(params=>void this.resumeAction(params.get('portfolio')));}
  owner(){return this.auth.user()?.role==='OWNER'&&!this.auth.locked();}
  featuredProject(){return this.projects()[this.selectedProject()]||this.projects()[0];}
  showProject(step:number){this.selectedProject.update(index=>Math.max(0,Math.min(this.projects().length-1,index+step)));}
  actionReturnUrl(action:'new'|'manage'){return '/?portfolio='+action;}
  async requestAction(action:'new'|'manage'){
    await this.auth.ensure();if(this.destroyed)return;this.accessMessage.set('');
    if(this.auth.user()?.role!=='OWNER'){await this.router.navigate(['/login'],{queryParams:{returnUrl:this.actionReturnUrl(action)}});return;}
    if(this.auth.locked()){this.auth.returnUrl=this.actionReturnUrl(action);await this.router.navigate(['/unlock']);return;}
    this.openAction(action);
  }
  openAction(action:'new'|'manage'){this.management.set(action==='manage');this.editor.set(action==='new'?{is_public:true}:undefined);}
  async resumeAction(action:string|null){
    if(this.destroyed||action!=='new'&&action!=='manage')return;
    if(this.auth.user()?.role==='OWNER'&&this.auth.locked()){await this.requestAction(action);return;}
    if(this.owner())this.openAction(action);else this.accessMessage.set('Sign in with the portfolio owner account to add or edit these projects.');
    await this.router.navigate([],{relativeTo:this.route,queryParams:{portfolio:null},queryParamsHandling:'merge',preserveFragment:true,replaceUrl:true});
  }
  addProject(){void this.requestAction('new');}
  manageProjects(){void this.requestAction('manage');}
  editProject(project:Project){if(this.owner()){this.management.set(false);this.editor.set(project);}}
  projectLink(project:Project){return project.is_public?['/projects',project.slug]:['/projects/preview',project.id];}
  async saved(project:Project){this.editor.set(undefined);await this.load();const index=this.projects().findIndex(p=>p.id===project.id);this.selectedProject.set(Math.max(0,index));document.getElementById('owner-projects')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  async load(){try{await this.auth.ensure();const owner=this.auth.user()?.role==='OWNER'&&!this.auth.locked();const [profile,projects]=await Promise.all([this.api.get<Portfolio>('public/profile'),this.api.get<Page<Project>>(owner?'portfolio/projects?limit=100':'public/projects')]);
    this.profile.set(profile);this.projects.set(projects.items);this.selectedProject.update(index=>Math.max(0,Math.min(index,projects.items.length-1)));this.error.set('');}catch(e){this.error.set(errorMessage(e));}}
  ngOnDestroy(){this.destroyed=true;this.routeSub?.unsubscribe();}
}

