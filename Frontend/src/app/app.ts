import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toasts } from './core/api.service';
@Component({imports: [RouterOutlet], selector: 'app-root', template: `
  <router-outlet />
  @if (toasts.message()) { <div class="toast" role="status" aria-live="polite">{{toasts.message()}}</div> }
`})
export class App { toasts = inject(Toasts); }
