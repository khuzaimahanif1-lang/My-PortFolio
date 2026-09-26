import { Component,inject,signal,afterNextRender,OnDestroy,HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { Api,Toasts,errorMessage } from '../../core/api.service';
import { Page,Notification } from '../../core/models';
import { Realtime } from '../../core/realtime.service';
import { Icon } from '../../shared/icon';
import { Loader } from '../../shared/loader';
import { Modal } from '../../shared/modal';
@Component({imports:[RouterLink,DatePipe,Icon,Loader,Modal],template:`
<div class="page-heading"><div><span class="eyebrow">ONLY THE UPDATES THAT MATTER</span><h1>Notifications<span class="gold">.</span></h1><p>Messages, inquiries, and important security updates. Routine edits stay in your activity log.</p></div><div class="heading-actions"><button class="button secondary" [disabled]="!items().length" (click)="markAll()"><app-icon name="check" />Mark all read</button><div class="notification-options"><button class="button secondary" (click)="options.set(!options())" [attr.aria-expanded]="options()">Options <app-icon name="down" [size]="14" /></button>@if(options()){<div class="action-dropdown"><button (click)="clearRead()">Delete read notifications</button><button class="danger-text" (click)="options.set(false);confirmClear.set(true)">Delete all notifications</button></div>}</div></div></div>
<div class="tabs"><button [class.active]="!unreadOnly()" (click)="unreadOnly.set(false)">All updates <span class="subtle">{{items().length}}</span></button><button [class.active]="unreadOnly()" (click)="unreadOnly.set(true)">Unread <span class="subtle">{{unread()}}</span></button></div>
@if(busy()){<app-loader label="Checking your updates" />}@else if(error()){<div class="panel empty-state"><p>{{error()}}</p><button class="button secondary" (click)="load()">Try again</button></div>}
@else{<section class="panel notification-center">@for(n of visible();track n.id){<div class="notification-center-item" [class.unread]="!n.is_read"><a class="notification-row" [routerLink]="n.link" (click)="read(n)"><span class="notification-symbol"><app-icon [name]="n.kind==='message'?'messages':n.kind==='security'?'shield':'notifications'" /></span><div><strong>{{n.title}}</strong><p>{{n.body}}</p><small>{{n.created_at+'Z'|date:'MMM d, h:mm a'}}</small></div></a><div class="row-actions">@if(!n.is_read){<button class="icon-button" [attr.aria-label]="'Mark notification read: '+n.title" (click)="read(n)"><app-icon name="check" [size]="16" /></button>}<button class="icon-button" [attr.aria-label]="'Delete notification: '+n.title" (click)="remove(n)"><app-icon name="trash" [size]="16" /></button></div></div>}
@empty{<div class="empty-state"><app-icon name="notifications" [size]="42" /><h3>You're all caught up.</h3><p>Important updates will appear here.</p></div>}</section>}
@if(confirmClear()){<app-modal title="Delete all notifications?" (closed)="confirmClear.set(false)"><div class="confirmation-body"><p>This removes notifications from your account. Your messages and workspace records remain available.</p><div class="modal-actions"><button class="button secondary" (click)="confirmClear.set(false)">Cancel</button><button class="button danger" (click)="clearAll()">Delete all</button></div></div></app-modal>}`})
export class Notifications implements OnDestroy {
 api=inject(Api);toasts=inject(Toasts);realtime=inject(Realtime);items=signal<Notification[]>([]);busy=signal(true);error=signal('');unreadOnly=signal(false);options=signal(false);confirmClear=signal(false);private sub?:Subscription;
 constructor(){afterNextRender(()=>{void this.load();this.sub=this.realtime.events.subscribe(e=>{if(e.type==='notification:new'||e.type==='notification:changed')void this.load(false);});});}
 @HostListener('document:click',['$event']) outside(e:Event){if(!(e.target as HTMLElement).closest('.notification-options'))this.options.set(false);}
 @HostListener('document:keydown.escape') escape(){this.options.set(false);}
 visible(){return this.items().filter(i=>!this.unreadOnly()||!i.is_read);}unread(){return this.items().filter(i=>!i.is_read).length;}
 async load(spinner=true){if(spinner)this.busy.set(true);try{this.items.set((await this.api.get<Page<Notification>>('notifications')).items);this.error.set('');}catch(e){this.error.set(errorMessage(e));}finally{this.busy.set(false);}}
 async read(n:Notification){try{await this.api.post('notifications/'+n.id+'/read');await this.load(false);}catch(e){this.toasts.show(errorMessage(e));}}
 async markAll(){try{await this.api.post('notifications/read-all');await this.load(false);}catch(e){this.toasts.show(errorMessage(e));}}
 async remove(n:Notification){try{await this.api.delete('notifications/'+n.id);await this.load(false);this.toasts.show('Notification deleted.');}catch(e){this.toasts.show(errorMessage(e));}}
 async clearRead(){this.options.set(false);try{await this.api.delete('notifications?read_only=true');await this.load(false);this.toasts.show('Read notifications deleted.');}catch(e){this.toasts.show(errorMessage(e));}}
 async clearAll(){try{await this.api.delete('notifications');this.confirmClear.set(false);await this.load(false);this.toasts.show('Notifications cleared.');}catch(e){this.toasts.show(errorMessage(e));}}
 ngOnDestroy(){this.sub?.unsubscribe();}
}
