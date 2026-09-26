import { Component,Input,Output,EventEmitter } from '@angular/core';
import { Project } from '../core/models';
import { Modal } from './modal';
import { Icon } from './icon';
import { ProjectImage } from './project-image';
@Component({selector:'app-portfolio-project-manager',imports:[Modal,Icon,ProjectImage],template:`
<app-modal title="Owner projects" eyebrow="YOUR LANDING PAGE" (closed)="closed.emit()">
 <div class="manager-heading"><p>Add your work here to show it on your portfolio.</p><button class="button primary small-button" (click)="add.emit()"><app-icon name="plus" [size]="16" />Add project</button></div>
 <div class="manager-list">@for(project of projects;track project.id){<article><div class="manager-cover">@if(project.screenshots[0]||project.logo_url;as cover){<app-project-image [src]="cover" [alt]="project.name+' cover'" [cover]="true" />}@else{<app-icon name="projects" [size]="24" />}</div><div class="manager-detail"><strong>{{project.name}}</strong><small>{{project.is_public?'Published on your landing page':'Draft · only you'}}</small></div><button class="button secondary small-button" [attr.aria-label]="'Edit '+project.name" (click)="edit.emit(project)"><app-icon name="edit" [size]="15" />Edit</button></article>}@empty{<p>No portfolio projects yet. Add your first project to get started.</p>}</div>
</app-modal>`,styles:`.manager-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:24px 0}.manager-heading p{font-size:13px}.manager-list{display:flex;flex-direction:column;gap:12px}.manager-list article{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--border)}.manager-cover{display:flex;align-items:center;justify-content:center;width:64px;height:52px;flex-shrink:0;border-radius:7px;overflow:hidden;background:var(--panel)}.manager-detail{flex:1;min-width:0}.manager-detail strong{display:block;overflow-wrap:anywhere}.manager-detail small{display:block;color:var(--muted);margin-top:4px}.small-button{padding:9px 12px;font-size:12px;white-space:nowrap}@media(max-width:500px){.manager-heading{align-items:flex-start}.manager-cover{width:42px;height:42px}.manager-list article{gap:10px}.manager-detail strong{font-size:12px}.manager-detail small{font-size:10px}}`})
export class PortfolioProjectManager {
 @Input() projects:Project[]=[];@Output() add=new EventEmitter<void>();@Output() edit=new EventEmitter<Project>();@Output() closed=new EventEmitter<void>();
}
