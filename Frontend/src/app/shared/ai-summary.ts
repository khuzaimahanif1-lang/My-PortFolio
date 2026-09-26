import { Component,Input,inject,signal,afterNextRender } from '@angular/core';
import { Api,Toasts,errorMessage } from '../core/api.service';
import { Icon } from './icon';
import { Modal } from './modal';
import { Markdown } from './markdown';
@Component({selector:'app-ai-summary',imports:[Icon,Modal,Markdown],template:`<button class="button secondary small-button" [disabled]="busy()||text.trim().length<10" (click)="summarize()" title="Summarize this content with the connected AI provider"><app-icon name="sparkles" [size]="15" />{{busy()?'Summarizing…':'AI summary'}}</button>@if(summary()){<app-modal title="AI summary" (closed)="summary.set('')"><div class="confirmation-body"><div class="markdown-content" [innerHTML]="summary()|markdown"></div><p class="subtle">AI-generated summary. Review it against your original content.</p></div></app-modal>}`})
export class AiSummary{
 @Input() kind:'note'|'project'|'report'='note';@Input() text='';api=inject(Api);toasts=inject(Toasts);busy=signal(false);summary=signal('');private available=false;
 constructor(){afterNextRender(()=>void this.api.get<{available:boolean}>('assistant/status').then(s=>this.available=s.available).catch(()=>{}));}
 async summarize(){if(!this.available){this.toasts.show('AI summaries are unavailable until an AI provider is connected.');return;}this.busy.set(true);try{const result=await this.api.post<{summary:string}>('assistant/summarize',{kind:this.kind,text:this.text.slice(0,12000)});this.summary.set(result.summary);}catch(e){this.toasts.show(errorMessage(e));}finally{this.busy.set(false);}}
}

