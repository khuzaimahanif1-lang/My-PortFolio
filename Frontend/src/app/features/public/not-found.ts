import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon';
@Component({imports:[RouterLink,Icon],template:`<main class="not-found"><span class="eyebrow">404 / A LITTLE OFF THE PATH</span><h1>This chapter<br><em>doesn't exist yet.</em></h1><p>Let's get you back to somewhere familiar.</p><a class="button primary" routerLink="/">Back to the portfolio <app-icon name="arrow" /></a></main>`})
export class NotFound{}

