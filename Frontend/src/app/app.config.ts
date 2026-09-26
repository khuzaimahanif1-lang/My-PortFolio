import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
export const appConfig: ApplicationConfig = {providers: [
  provideBrowserGlobalErrorListeners(), provideRouter(routes, withInMemoryScrolling({scrollPositionRestoration:'enabled',anchorScrolling:'enabled'})),
  provideClientHydration(withEventReplay()), provideHttpClient(withInterceptors([authInterceptor]))
]};
