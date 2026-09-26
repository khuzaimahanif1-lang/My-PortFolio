import { Directive,Input,ElementRef,OnChanges,OnDestroy } from '@angular/core';
@Directive({selector:'video[appStream]'})
export class StreamVideo implements OnChanges,OnDestroy {
 @Input() appStream:MediaStream|null=null;
 constructor(private element:ElementRef<HTMLVideoElement>){}
 ngOnChanges(){this.element.nativeElement.srcObject=this.appStream;if(this.appStream)void this.element.nativeElement.play().catch(()=>{});}
 ngOnDestroy(){this.element.nativeElement.srcObject=null;}
}
