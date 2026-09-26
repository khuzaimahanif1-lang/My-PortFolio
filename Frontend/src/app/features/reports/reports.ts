import { Component,inject,signal,afterNextRender } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Api,Toasts,errorMessage } from '../../core/api.service';
import { Report } from '../../core/models';
import { Charts } from '../../shared/charts';
import { Icon } from '../../shared/icon';
import { Loader } from '../../shared/loader';
import { Modal } from '../../shared/modal';
import { Markdown } from '../../shared/markdown';
@Component({imports:[FormsModule,DatePipe,Charts,Icon,Loader,Modal,Markdown],template:`
<div class="page-heading"><div><span class="eyebrow">THE BIGGER PICTURE</span><h1>Reports & analytics<span class="gold">.</span></h1><p>Real progress, in perspective. Every number comes from your workspace.</p></div>
<div class="heading-actions"><select [(ngModel)]="days" (ngModelChange)="load()" aria-label="Report period"><option [ngValue]="30">Last 30 days</option><option [ngValue]="90">Last 90 days</option><option [ngValue]="180">Last 6 months</option><option [ngValue]="365">Last year</option></select><button class="button secondary" (click)="export()"><app-icon name="download" />Export report</button></div></div>
@if(busy()){<app-loader label="Connecting the dots in your progress" />}
@else if(error()){<div class="panel empty-state"><h3>Reports unavailable.</h3><p>{{error()}}</p><button class="button secondary" (click)="load()">Try again</button></div>}
@else if(report();as r){
<div class="report-kpis"><article class="panel kpi-card"><span>Project completion</span><strong>{{percentage(r.kpis['completed_projects'],r.kpis['total_projects'])}}<small>%</small></strong><div class="progress-track"><span [style.width.%]="percentage(r.kpis['completed_projects'],r.kpis['total_projects'])"></span></div><small>{{r.kpis['completed_projects']}} of {{r.kpis['total_projects']}} projects</small></article>
<article class="panel kpi-card"><span>Task completion</span><strong>{{percentage(r.kpis['completed_tasks'],r.kpis['total_tasks'])}}<small>%</small></strong><div class="progress-track"><span [style.width.%]="percentage(r.kpis['completed_tasks'],r.kpis['total_tasks'])"></span></div><small>{{r.kpis['completed_tasks']}} of {{r.kpis['total_tasks']}} tasks</small></article>
<article class="panel kpi-card"><span>Learning hours</span><strong>{{r.kpis['learning_hours']}}</strong><small>Logged during the selected period</small></article>
<article class="panel kpi-card"><span>Goals achieved</span><strong>{{r.kpis['completed_goals']}}<small> / {{r.kpis['total_goals']}}</small></strong><small>Workspace goals at 100% completion</small></article></div>
<p class="report-note">Project, task, and goal totals reflect the current workspace. Activity and learning use the selected period.</p>
<app-charts [report]="r" [expanded]="true" />
<div class="dashboard-lower"><section class="panel"><div class="panel-title"><div><span class="eyebrow">STAY THE COURSE</span><h3>Goal progress</h3></div><app-icon name="goals" /></div>@for(g of r.goal_progress;track g.name){<div class="report-goal"><div><strong>{{g.name}}</strong><span>{{g.progress}}%</span></div><div class="progress-track"><span [style.width.%]="g.progress"></span></div></div>}@empty{<div class="compact-empty">Set your first goal to track its progress here.</div>}</section>
<section class="panel"><div class="panel-title"><div><span class="eyebrow">THE RECENT STORY</span><h3>Workspace activity</h3></div></div>@for(a of r.activity;track a.id){<div class="activity-row"><span class="activity-dot"></span><div><strong>{{a.action}}</strong><small>{{a.created_at+'Z'|date:'MMM d, h:mm a'}}</small></div></div>}@empty{<div class="compact-empty">No activity in this period.</div>}</section></div>
<div class="report-footer"><span class="subtle">Generated {{r.generated_at|date:'medium'}}</span><button class="inline-link" (click)="summarize()">Summarize with AI <app-icon name="sparkles" [size]="15" /></button></div>
}
@if(summary()){<app-modal title="Your progress, summarized" (closed)="summary.set('')"><div class="confirmation-body markdown-content" [innerHTML]="summary()|markdown"></div></app-modal>}`})
export class Reports{
 api=inject(Api);toasts=inject(Toasts);analytics=inject(ActivatedRoute).snapshot.data['kind']==='analytics';
 report=signal<Report|null>(null);busy=signal(true);error=signal('');summary=signal('');days=180;
 constructor(){afterNextRender(()=>void this.load());}
 percentage(completed:number,total:number){return total?Math.round(completed/total*100):0;}
 async load(){this.busy.set(true);try{this.report.set(await this.api.get<Report>('reports?days='+this.days));this.error.set('');}catch(e){this.error.set(errorMessage(e));}finally{this.busy.set(false);}}
 async export(){try{const blob=await this.api.blob('reports/export?days='+this.days);const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='king-ai-report.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){this.toasts.show(errorMessage(e));}}
 async summarize(){try{this.toasts.show('Preparing your summary…');const result=await this.api.post<{summary:string}>('assistant/summarize',{kind:'report',text:JSON.stringify(this.report()?.kpis)});this.summary.set(result.summary);}catch(e){this.toasts.show(errorMessage(e));}}
}

