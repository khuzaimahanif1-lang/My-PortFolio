import { Component, Input } from '@angular/core';
@Component({selector: 'app-loader', template: `
  <div class="logo-loading" role="status" aria-live="polite"><div class="loader-emblem">
    <img src="/assets/kh-professional.png" alt="" width="88" height="88" /></div>
    <span>{{label}}</span><div class="loader-track"></div></div>`})
export class Loader { @Input() label = 'Opening your digital world'; }

