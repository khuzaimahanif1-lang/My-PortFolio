import { Directive, ElementRef, inject, afterNextRender, OnDestroy } from '@angular/core';
@Directive({selector: '[reveal]'})
export class Reveal implements OnDestroy {
  private element = inject(ElementRef<HTMLElement>); private observer?: IntersectionObserver;
  constructor() { afterNextRender(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.element.nativeElement.classList.add('will-reveal');
    this.observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('revealed'); this.observer?.unobserve(entry.target); }
    }, {threshold: 0.08}); this.observer.observe(this.element.nativeElement);
  }); }
  ngOnDestroy() { this.observer?.disconnect(); }
}

