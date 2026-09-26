import { Component,Input,OnChanges,OnDestroy,inject,signal } from '@angular/core';
import { Api } from '../core/api.service';
@Component({selector:'app-project-image',template:`@if(url()){<img [src]="url()" [alt]="alt" [class.cover]="cover" loading="lazy" referrerpolicy="no-referrer" />}@else{<span class="subtle">{{failed()?'Image unavailable.':'Loading screenshot…'}}</span>}`,styles:':host{display:contents}img.cover{width:100%;height:100%;object-fit:cover;display:block}'})
export class ProjectImage implements OnChanges,OnDestroy{
 @Input() src='';@Input() alt='Project screenshot';@Input() cover=false;api=inject(Api);url=signal('');failed=signal(false);private generation=0;private blobUrl='';
 ngOnChanges(){this.clear();const generation=++this.generation;this.failed.set(false);if(!this.src.startsWith('/api/project-images/')){this.url.set(this.src);return;}
 void this.api.blob(this.src.slice(5)).then(blob=>{if(generation!==this.generation)return;this.blobUrl=URL.createObjectURL(blob);this.url.set(this.blobUrl);}).catch(()=>{if(generation===this.generation)this.failed.set(true);});}
 clear(){if(this.blobUrl)URL.revokeObjectURL(this.blobUrl);this.blobUrl='';this.url.set('');}
 ngOnDestroy(){this.generation++;this.clear();}
}

