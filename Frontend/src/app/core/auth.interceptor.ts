import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { from, switchMap, catchError, throwError, tap } from 'rxjs';
import { Auth } from './auth.service';
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')||request.url.startsWith('/api/public/')) return next(request);
  const auth = inject(Auth);
  const attach = (token: string) => request.clone({withCredentials: true, setHeaders: token ? {Authorization: 'Bearer ' + token} : {}});
  const isAuth = request.url.startsWith('/api/auth/');
  const publicRequest=request.url.startsWith('/api/public/');
  const accountId=auth.user()?.id;
  if(!isAuth&&!publicRequest&&auth.locked())return throwError(()=>new Error('Your workspace is locked. Enter your password to continue.'));
  const accountCheck=tap<HttpEvent<unknown>>(()=>{if(!isAuth&&!publicRequest&&accountId&&auth.user()?.id!==accountId)throw new Error('The account changed.');});
  const run = (token: string) => next(attach(token)).pipe(accountCheck,catchError((error: HttpErrorResponse) => {
    if (!isAuth && error.status === 401 && auth.user() && !auth.locked()) {
      return from(auth.refresh()).pipe(switchMap(fresh => next(attach(fresh)).pipe(accountCheck)));
    }
    if (!isAuth && error.status === 423) auth.goLocked();
    return throwError(() => error);
  }));
  return !isAuth && auth.needsRefresh() ? from(auth.refresh()).pipe(switchMap(run)) : run(auth.token());
};

