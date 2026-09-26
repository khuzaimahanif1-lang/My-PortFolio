import { RenderMode, ServerRoute } from '@angular/ssr';
export const serverRoutes: ServerRoute[] = [
  {path: 'workspace/**', renderMode: RenderMode.Client},
  {path: 'unlock', renderMode: RenderMode.Client},
  {path: '**', renderMode: RenderMode.Server}
];
