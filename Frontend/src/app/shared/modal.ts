import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, afterNextRender } from '@angular/core';
import { Icon } from './icon';
@Component({selector: 'app-modal', imports: [Icon], template: `
  <dialog #dialog class="modal" (cancel)="cancel($event)" (click)="backdrop($event)">
    <div class="modal-header"><div><span class="eyebrow">{{eyebrow}}</span><h2>{{title}}</h2></div>
      <button class="icon-button" aria-label="Close dialog" (click)="closed.emit()"><app-icon name="close" /></button></div>
    <ng-content />
  </dialog>`})
export class Modal {
  @Input() title = ''; @Input() eyebrow = 'YOUR WORKSPACE'; @Output() closed = new EventEmitter<void>();
  @ViewChild('dialog') dialog!: ElementRef<HTMLDialogElement>;
  constructor() { afterNextRender(() => this.dialog.nativeElement.showModal()); }
  cancel(e: Event) { e.preventDefault(); this.closed.emit(); }
  backdrop(e: MouseEvent) { if (e.target === this.dialog.nativeElement) {
    const rect = this.dialog.nativeElement.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) this.closed.emit();
  }}
}

