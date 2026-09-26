import { Component,inject,signal,afterNextRender } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api,Toasts,errorMessage } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import { Report } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Charts } from '../../shared/charts';
import { Loader } from '../../shared/loader';
import { Modal } from '../../shared/modal';
@Component({imports:[RouterLink,DatePipe,FormsModule,Icon,Charts,Loader,Modal],templateUrl:'./dashboard.html'})
export class Dashboard{
  api=inject(Api);auth=inject(Auth);toasts=inject(Toasts);report=signal<Report|null>(null);error=signal('');busy=signal(true);learning=signal(false);topic='';minutes=30;
  kpis=[['projects','total_projects','Total projects'],['check','completed_projects','Completed projects'],['code','active_projects','Active projects'],
    ['brain','technologies','Technologies'],['tasks','total_tasks','Tasks'],['notes','notes','Notes captured'],['goals','total_goals','Personal goals'],['clock','learning_hours','Learning hours']];
  constructor(){afterNextRender(()=>void this.load());}
  async load(){this.busy.set(true);try{this.report.set(await this.api.get<Report>('reports'));this.error.set('');}catch(e){this.error.set(errorMessage(e));}finally{this.busy.set(false);}}
  firstName(){return this.auth.user()?.full_name.split(' ')[0]||'creator';}
  greeting(){const h=new Date().getHours();return h<12?'Good morning':h<18?'Good afternoon':'Good evening';}
  get starter(){return this.report()?.recent_projects.some(p=>p.tags.includes('Starter concept'));}
  closeLearning(){this.learning.set(false);this.topic='';this.minutes=30;}
 async logLearning(){try{await this.api.post('learning',{topic:this.topic,minutes:this.minutes});this.closeLearning();this.toasts.show('Learning session saved.');void this.load();}catch(e){this.toasts.show(errorMessage(e));}}
}

