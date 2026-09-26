import { Subscription } from 'rxjs';
import { Auth } from '../core/auth.service';
import { Component, inject, signal, afterNextRender, HostListener, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { Icon } from '../shared/icon';
@Component({selector: 'app-public-layout', imports: [RouterLink, RouterLinkActive, RouterOutlet, Icon], styles:':host{display:block;--public-header-height:76px}.header-spacer{height:var(--public-header-height)}.public-header{height:var(--public-header-height);position:fixed;top:0;left:0;right:0;z-index:60;transition:transform .22s ease;will-change:transform}.public-header.header-hidden{transform:translateY(-100%);pointer-events:none}.public-header nav a{font-size:12px}@media(prefers-reduced-motion:reduce){.public-header{transition:none}}@media(max-width:700px){:host{--public-header-height:68px}.public-header nav{top:68px}.public-header nav a{font-size:13px}}',template: `
  <a class="skip-link" href="#main-content">Skip to content</a>
  <div class="header-spacer" aria-hidden="true"></div>
  <header class="public-header" [class.header-hidden]="hidden()" (focusin)="hidden.set(false)"><a class="brand" routerLink="/" aria-label="Khuzaima Hanif home">
    <span class="brand-emblem"><img src="/assets/kh-professional.png" alt="KH crowned monogram" width="48" height="48" /></span>
    <span>KHUZAIMA HANIF<small>BUILD. LEARN. GROW.</small></span></a>
    <nav aria-label="Main navigation" [class.mobile-open]="menu()">
      <a routerLink="/" [routerLinkActiveOptions]="{exact:true}" routerLinkActive="active" (click)="menu.set(false)">Home</a>
      <a routerLink="/projects" routerLinkActive="active" (click)="menu.set(false)">Selected work</a>
      <a routerLink="/about" routerLinkActive="active" (click)="menu.set(false)">About</a>
      <a routerLink="/contact" routerLinkActive="active" (click)="menu.set(false)">Contact</a>
    </nav>
    <div class="header-actions">@if(auth.user()&&auth.user()?.role!=='OWNER'){<a class="workspace-link" routerLink="/workspace">My workspace <app-icon name="arrow" [size]="16" /></a>}@else{<a class="workspace-link" href="/?portfolio=manage" (click)="editPortfolio($event)">Edit portfolio <app-icon name="edit" [size]="16" /></a>}
      <button class="icon-button mobile-menu" aria-label="Toggle navigation" [attr.aria-expanded]="menu()" (click)="menu.set(!menu())"><app-icon name="menu" /></button></div>
  </header>
  <main id="main-content"><router-outlet /></main>
  <footer class="public-footer"><div class="footer-top"><div><span class="eyebrow">LET'S BUILD SOMETHING MEANINGFUL</span><a class="footer-invitation" routerLink="/contact">The next idea starts<br>with a conversation. <app-icon name="arrow" [size]="38" /></a></div>
    <div class="footer-links"><a routerLink="/skills">Skills & technologies</a><a routerLink="/journey">My journey</a><a routerLink="/research">Research & AI</a><a routerLink="/goals">Future vision</a><a routerLink="/blog">Field notes</a><a routerLink="/achievements">Achievements</a></div></div>
    <div class="footer-bottom"><a class="brand" routerLink="/"><span class="brand-emblem"><img src="/assets/kh-professional.png" alt="" width="36" height="36" /></span><span>KHUZAIMA HANIF<small>KING AI · PERSONAL DIGITAL WORLD</small></span></a>
      <span>Designed with intention. Built with curiosity.</span><a routerLink="/login">Private workspace <app-icon name="lock" [size]="13" /></a></div></footer>`})
export class PublicLayout implements OnDestroy {
 auth=inject(Auth);router=inject(Router);menu=signal(false);hidden=signal(false);private subscription:Subscription;private lastScroll=0;private travel=0;private direction=0;
 constructor(){this.subscription=this.router.events.subscribe(event=>{if(event instanceof NavigationEnd){this.menu.set(false);this.hidden.set(false);this.lastScroll=this.auth.browser?window.scrollY:0;this.travel=0;}});afterNextRender(()=>{this.lastScroll=window.scrollY;void this.auth.ensure();});}
 @HostListener('window:scroll') scroll(){const position=Math.max(0,window.scrollY),delta=position-this.lastScroll;this.lastScroll=position;if(position<80||this.menu()){this.hidden.set(false);this.travel=0;return;}if(!delta)return;const direction=Math.sign(delta);if(direction!==this.direction){this.direction=direction;this.travel=0;}this.travel+=delta;if(Math.abs(this.travel)>=12)this.hidden.set(direction>0);}
 async editPortfolio(event:Event){event.preventDefault();await this.auth.ensure();const target='/?portfolio=manage';if(this.auth.user()?.role!=='OWNER'){await this.router.navigate(['/login'],{queryParams:{returnUrl:target}});return;}if(this.auth.locked()){this.auth.returnUrl=target;await this.router.navigate(['/unlock']);return;}await this.router.navigate(['/'],{queryParams:{portfolio:'manage'}});}
 @HostListener('document:keydown.escape') closeMenu(){this.menu.set(false);}
 @HostListener('document:click',['$event']) outside(event:Event){if(!(event.target as HTMLElement).closest('.public-header'))this.menu.set(false);}
 ngOnDestroy(){this.subscription.unsubscribe();}
}


