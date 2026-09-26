import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from './auth.service';
export const workspaceGuard: CanActivateFn = async (_, state) => {
  const auth = inject(Auth), router = inject(Router);
  auth.returnUrl = state.url;
  if (!await auth.ensure()) return router.createUrlTree(['/login'], {queryParams: {returnUrl: state.url}});
  return auth.locked() ? router.createUrlTree(['/unlock']) : true;
};
export const unlockGuard: CanActivateFn = async () => {
  const auth = inject(Auth), router = inject(Router);
  return await auth.ensure() ? true : router.createUrlTree(['/login']);
};


export const portfolioGuard: CanActivateFn = async (_, state) => {
  const auth = inject(Auth), router = inject(Router);
  auth.returnUrl = state.url;
  if(!await auth.ensure())return router.createUrlTree(['/login'], {queryParams:{returnUrl:state.url}});
  if(auth.user()?.role!=='OWNER')return router.createUrlTree(['/projects']);
  return auth.locked()?router.createUrlTree(['/unlock']):true;
};
