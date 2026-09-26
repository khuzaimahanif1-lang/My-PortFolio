import { Component,Input,Output,EventEmitter,OnChanges,OnDestroy,inject,signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api,errorMessage } from '../core/api.service';
import { Auth } from '../core/auth.service';
import { Project,Page } from '../core/models';
import { Modal } from './modal';
import { Icon } from './icon';
import { ProjectImage } from './project-image';
export interface Field {key:string;label:string;type?:string;required?:boolean;options?:string[];default?:any;advanced?:boolean;max?:number;}
const baseTitle:Field={key:'title',label:'Title',required:true,max:200};
const progress:Field={key:'progress',label:'Progress (%)',type:'number',default:0};
const priority:Field={key:'priority',label:'Priority',type:'select',options:['LOW','MEDIUM','HIGH','URGENT'],default:'MEDIUM'};
export const resourceFields:Record<string,Field[]>={
 projects:[{key:'name',label:'Project name',required:true,max:150},{key:'slug',label:'URL slug',required:true,max:160},
 {key:'short_description',label:'Short description',type:'textarea',max:300},{key:'description',label:'Description',type:'textarea',max:20000},
 {key:'category',label:'Category',type:'select',options:['Full-stack','AI / ML','Research','Web app','Other'],default:'Full-stack'},
 {key:'technologies',label:'Technologies (comma separated)',type:'list'},{key:'status',label:'Status',type:'select',options:['PLANNED','IN_PROGRESS','REVIEW','COMPLETED'],default:'PLANNED'},progress,
 {key:'is_public',label:'Publish on the portfolio homepage',type:'checkbox',default:false},
 {key:'start_date',label:'Start date',type:'date',advanced:true},{key:'end_date',label:'End date',type:'date',advanced:true},
 {key:'github_url',label:'Source code URL',type:'url',max:500},{key:'live_url',label:'Project / live demo URL',type:'url',max:500},
 {key:'tags',label:'Tags (comma separated)',type:'list',advanced:true},{key:'features',label:'Features (one per line)',type:'lines',advanced:true},
 {key:'documentation',label:'Documentation (Markdown)',type:'textarea',advanced:true,max:50000},
 {key:'architecture',label:'Architecture',type:'textarea',advanced:true,max:20000},
 {key:'challenges',label:'Challenges',type:'textarea',advanced:true,max:10000},{key:'solutions',label:'Solutions',type:'textarea',advanced:true,max:10000},
 {key:'future_improvements',label:'Future improvements',type:'textarea',advanced:true,max:10000},
 {key:'screenshots',label:'Project image URLs (one per line, optional)',type:'lines'},{key:'logo_url',label:'Project logo URL',type:'url',advanced:true,max:500}],
 tasks:[baseTitle,{key:'description',label:'Description',type:'textarea',max:10000},{key:'project_id',label:'Project',type:'project',default:null},
 {key:'status',label:'Status',type:'select',options:['TODO','IN_PROGRESS','REVIEW','COMPLETED'],default:'TODO'},priority,
 {key:'due_date',label:'Due date',type:'date'},progress,{key:'tags',label:'Tags (comma separated)',type:'list'},
 {key:'subtasks',label:'Subtasks (one per line)',type:'checklist'}],
 notes:[baseTitle,{key:'content',label:'Content (Markdown)',type:'textarea',max:100000},
 {key:'category',label:'Category',type:'select',options:['AI Ideas','Project Ideas','Learning','Research','Technical Notes','Goals','Future Plans','Personal'],default:'Personal'},
 {key:'tags',label:'Tags (comma separated)',type:'list'},{key:'pinned',label:'Pin note',type:'checkbox',default:false},
 {key:'favorite',label:'Favorite',type:'checkbox',default:false},{key:'archived',label:'Archive note',type:'checkbox',default:false}],
 goals:[baseTitle,{key:'description',label:'Description',type:'textarea',max:10000},{key:'deadline',label:'Deadline',type:'date'},priority,progress,
 {key:'milestones',label:'Milestones (one per line)',type:'checklist'}]
};
export function resourcePayload(type:string,item:any):any{
 const result:any={};
 for(const field of resourceFields[type]||[]) result[field.key]=item[field.key]??field.default??(['list','lines','checklist'].includes(field.type||'')?[]:'');
 return result;
}
@Component({selector:'app-resource-editor',imports:[FormsModule,Modal,Icon,ProjectImage],template:`
<app-modal [eyebrow]="endpoint==='portfolio/projects'?'OWNER PROJECTS':'YOUR WORKSPACE'" [title]="(recordId?'Edit ':'New ')+singular" (closed)="closed.emit()"><form #form="ngForm" class="editor-form" (ngSubmit)="form.valid&&save()">
  <div class="editor-fields">@for(field of fields;track field.key){
    @if((!field.advanced||advanced())&&(field.key!=='is_public'||auth.user()?.role==='OWNER')){
      <label [class.checkbox-label]="field.type==='checkbox'" [class.wide-field]="['textarea','lines','checklist'].includes(field.type||'')">
      @if(field.type==='checkbox'){<input type="checkbox" [name]="field.key" [(ngModel)]="values[field.key]" />{{field.label}}}@else{
        {{field.label}}@if(field.required){<span class="gold"> *</span>}
        @if(field.type==='select'){<select [name]="field.key" [(ngModel)]="values[field.key]">@for(option of field.options;track option){<option [value]="option">{{option.replaceAll('_',' ')}}</option>}</select>}
        @else if(field.type==='project'){<select [name]="field.key" [(ngModel)]="values[field.key]"><option [ngValue]="null">No project</option>@for(p of projects();track p.id){<option [value]="p.id">{{p.name}}</option>}</select>}
        @else if(['textarea','lines','checklist'].includes(field.type||'')){<textarea [name]="field.key" [(ngModel)]="values[field.key]" [maxlength]="field.max||20000" rows="4"></textarea>}
        @else{<input [name]="field.key" [(ngModel)]="values[field.key]" (ngModelChange)="changed(field.key)" [type]="field.type==='number'?'number':field.type==='date'?'date':field.type==='url'?'url':'text'" [required]="!!field.required" [attr.maxlength]="field.max||1000" [attr.min]="field.type==='number'?0:null" [attr.max]="field.type==='number'?100:null" />}
      }</label>
    }}</div>
  @if(type==='projects'){@if(existingImages().length){<div class="existing-project-images">@for(url of existingImages();track $index;let i=$index){<div><div class="existing-image-preview"><app-project-image [src]="url" [alt]="'Project image '+(i+1)" [cover]="true" /></div><div class="existing-image-actions">@if(i===0){<span class="subtle">Cover image</span>}@else{<button type="button" class="inline-link" [disabled]="busy()" [attr.aria-label]="'Use project image '+(i+1)+' as cover'" (click)="useCover(i)">Use as cover</button>}<button type="button" class="icon-button" [disabled]="busy()" [attr.aria-label]="'Remove project image '+(i+1)" (click)="removeExisting(i)"><app-icon name="trash" [size]="15" /></button></div></div>}</div>}<div class="project-image-upload"><label class="button secondary"><app-icon name="image" />Add project images<input class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple aria-label="Upload project images" [disabled]="busy()" (change)="addImages($event)" /></label><p class="subtle">PNG, JPEG or WebP, up to 5 MB each. The first image is your portfolio cover. Maximum 12 images.</p><div class="project-image-drafts">@for(image of pendingImages();track image.preview){<div><img [src]="image.preview" [alt]="image.file.name" /><button type="button" class="icon-button" [attr.aria-label]="'Remove '+image.file.name" [disabled]="busy()" (click)="removeImage(image.preview)"><app-icon name="close" [size]="15" /></button></div>}</div></div><button type="button" class="inline-link advanced-toggle" (click)="advanced.set(!advanced())">{{advanced()?'Hide':'Show'}} documentation & more details <app-icon [name]="advanced()?'left':'chevron'" [size]="14" /></button>}
  @if(error()){<p class="form-error" role="alert">{{error()}}</p>}
  <div class="modal-actions"><button type="button" class="button secondary" (click)="closed.emit()">Cancel</button><button class="button primary" [disabled]="busy()||!form.valid">{{busy()?'Saving…':recordId?'Save changes':'Create '+singular}}<app-icon name="check" /></button></div>
</form></app-modal>`,styles:'.existing-project-images{display:flex;flex-wrap:wrap;gap:16px;margin-top:20px}.existing-project-images>div{width:150px}.existing-image-preview{height:100px;border:1px solid var(--border);border-radius:8px;overflow:hidden}.existing-image-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:7px}.existing-image-actions .icon-button{width:28px;height:28px}.existing-image-actions .inline-link{font-size:10px}.existing-image-actions .subtle{font-size:10px}.project-image-upload{margin:20px 0}.project-image-upload p{margin:10px 0}.project-image-drafts{display:flex;flex-wrap:wrap;gap:12px}.project-image-drafts>div{position:relative}.project-image-drafts img{width:110px;height:80px;object-fit:cover;border:1px solid var(--border);border-radius:8px}.project-image-drafts button{position:absolute;top:4px;right:4px;background:var(--panel);border:1px solid var(--border);border-radius:50%;width:25px;height:25px}'})
export class ResourceEditor implements OnChanges,OnDestroy{
 @Input() type='projects';@Input() endpoint='';@Input() item:any=null;@Output() saved=new EventEmitter<any>();@Output() closed=new EventEmitter<void>();
 api=inject(Api);auth=inject(Auth);values:any={};fields:Field[]=[];busy=signal(false);error=signal('');advanced=signal(false);projects=signal<Project[]>([]);pendingImages=signal<{file:File;preview:string}[]>([]);private savedRecordId='';private destroyed=false;
 get recordId(){return this.savedRecordId||this.item?.id;}
 get singular(){return ({projects:'project',tasks:'task',notes:'note',goals:'goal'} as Record<string,string>)[this.type];}
 ngOnChanges(){this.clearImages();this.savedRecordId='';this.error.set('');this.busy.set(false);this.advanced.set(false);this.projects.set([]);this.fields=resourceFields[this.type]||[];this.values=resourcePayload(this.type,this.item||{});
  for(const field of this.fields){if(field.type==='list')this.values[field.key]=this.values[field.key].join(', ');
    if(field.type==='lines')this.values[field.key]=this.values[field.key].join('\n');
    if(field.type==='checklist')this.values[field.key]=this.values[field.key].map((v:any)=>v.title).join('\n');}
  if(this.type==='tasks')void this.api.get<Page<Project>>('projects').then(p=>this.projects.set(p.items)).catch(()=>{});}
 existingImages(){return String(this.values.screenshots||'').split('\n').map(url=>url.trim()).filter(Boolean);}
 removeExisting(index:number){this.values.screenshots=this.existingImages().filter((_,i)=>i!==index).join('\n');}
 useCover(index:number){const images=this.existingImages(),cover=images.splice(index,1)[0];if(cover)this.values.screenshots=[cover,...images].join('\n');}
 changed(key:string){if(key==='name'&&!this.recordId)this.values.slug=this.values.name.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
 addImages(event:Event){const input=event.target as HTMLInputElement,files=Array.from(input.files||[]);input.value='';if(this.busy()||!files.length)return;const existing=String(this.values.screenshots||'').split('\n').filter(url=>url.trim()).length;
  if(existing+this.pendingImages().length+files.length>12){this.error.set('A project can have up to 12 images. Remove an image before adding more.');return;}
  if(files.some(file=>file.size>5*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))){this.error.set('Choose PNG, JPEG or WebP images smaller than 5 MB each.');return;}
  this.error.set('');this.pendingImages.update(images=>[...images,...files.map(file=>({file,preview:URL.createObjectURL(file)}))]);}
 removeImage(preview:string){URL.revokeObjectURL(preview);this.pendingImages.update(images=>images.filter(image=>image.preview!==preview));}
 clearImages(){this.pendingImages().forEach(image=>URL.revokeObjectURL(image.preview));this.pendingImages.set([]);}
 async save(){if(this.busy())return;this.busy.set(true);this.error.set('');const payload:any={...this.values};
  for(const field of this.fields){if(field.type==='list')payload[field.key]=String(payload[field.key]).split(',').map(s=>s.trim()).filter(Boolean);
    if(field.type==='lines')payload[field.key]=String(payload[field.key]).split('\n').map(s=>s.trim()).filter(Boolean);
    if(field.type==='checklist')payload[field.key]=String(payload[field.key]).split('\n').map(s=>s.trim()).filter(Boolean).map(title=>({title,done:this.item?.[field.key]?.find((v:any)=>v.title===title)?.done||false}));}
  try{let result:any=this.recordId?await this.api.put((this.endpoint||this.type)+'/'+this.recordId,payload):await this.api.post(this.endpoint||this.type,payload);this.savedRecordId=result.id;if(this.destroyed)return;
   if(this.type==='projects'){this.values.screenshots=result.screenshots.join('\n');for(const image of this.pendingImages().slice()){const form=new FormData();form.append('file',image.file);result=await this.api.post<Project>('projects/'+result.id+'/screenshots',form);if(this.destroyed)return;this.values.screenshots=result.screenshots.join('\n');this.removeImage(image.preview);}}
   this.saved.emit(result);}
  catch(e){if(!this.destroyed)this.error.set((this.type==='projects'&&this.savedRecordId?'Project details are saved. Retry to finish adding your images. ':'')+errorMessage(e));}finally{this.busy.set(false);}}
 ngOnDestroy(){this.destroyed=true;this.clearImages();}
}


