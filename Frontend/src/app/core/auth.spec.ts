import { TestBed } from '@angular/core/testing';
import { provideHttpClient,withInterceptors,HttpClient } from '@angular/common/http';
import { provideHttpClientTesting,HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { provideRouter,Router } from '@angular/router';
import { Auth } from './auth.service';
const user={id:'11111111-1111-1111-1111-111111111111',full_name:'Alice',email:'alice@example.com',role:'USER',preferences:{},bio:'',title:'',location:'',avatar_url:'',created_at:''};
const response={user,access_token:'test-token',expires_in:900,unlock_until:new Date(Date.now()+3600000).toISOString()};
describe('workspace account sessions',()=>{
 let auth:Auth,http:HttpTestingController;
 beforeEach(()=>{TestBed.configureTestingModule({providers:[provideHttpClient(withInterceptors([authInterceptor])),provideHttpClientTesting(),provideRouter([])]});auth=TestBed.inject(Auth);http=TestBed.inject(HttpTestingController);});
 afterEach(()=>{http.verify();TestBed.resetTestingModule();});
 it('restores a locked account without attempting refresh',async()=>{const pending=auth.ensure();http.expectOne('/api/auth/session').flush({authenticated:true,user,locked:true});expect(await pending).toBe(true);expect(auth.locked()).toBe(true);http.expectNone('/api/auth/refresh');});
 it('leaves public pages visible when the workspace locks',()=>{auth.update(user as any,true);const navigation=vi.spyOn(TestBed.inject(Router),'navigate');auth.goLocked();expect(auth.locked()).toBe(true);expect(navigation).not.toHaveBeenCalled();});
 it('discards private responses when another account replaces the session',async()=>{auth.update(user as any,true);const pending=firstValueFrom(TestBed.inject(HttpClient).get('/api/reports'));const request=http.expectOne('/api/reports');auth.update({...user,id:'22222222-2222-2222-2222-222222222222'} as any,true);request.flush({private:'old account'});await expect(pending).rejects.toThrow('account changed');});
 it('treats a guest session as signed out without an error response',async()=>{const pending=auth.ensure();http.expectOne('/api/auth/session').flush({authenticated:false,user:null,locked:false});expect(await pending).toBe(false);expect(await auth.ensure()).toBe(false);});
 it('refuses refreshing a locked workspace locally',async()=>{auth.update(user as any,true);auth.locked.set(true);await expect(auth.refresh()).rejects.toThrow('locked');http.expectNone('/api/auth/refresh');});
 it('does not replace the current account with a stale profile response',()=>{auth.update(user as any,true);auth.update({...user,id:'22222222-2222-2222-2222-222222222222',full_name:'Bob'} as any);expect(auth.user()?.id).toBe(user.id);});
 it('signs out immediately even while the refresh lock is unavailable',async()=>{
  auth.update(user as any,true);auth.token.set('active-token');
  const navigation=vi.spyOn(TestBed.inject(Router),'navigate').mockResolvedValue(true);
  const serial=vi.spyOn(auth as any,'serial').mockImplementation(()=>new Promise(()=>{}));
  const pending=auth.logout();expect(auth.user()).toBeNull();expect(auth.token()).toBe('');
  expect(navigation).toHaveBeenCalledWith(['/login']);expect(serial).not.toHaveBeenCalled();
  http.expectOne('/api/auth/logout').flush({message:'Signed out'});await pending;
  expect(await auth.ensure()).toBe(false);http.expectNone('/api/auth/session');
 });
 it('does not restore an account when a pending session response arrives after sign out',async()=>{
  vi.spyOn(TestBed.inject(Router),'navigate').mockResolvedValue(true);
  const restore=auth.ensure(),session=http.expectOne('/api/auth/session');
  const logout=auth.logout();http.expectOne('/api/auth/logout').flush({message:'Signed out'});
  session.flush({authenticated:true,user,locked:false});await logout;
  expect(await restore).toBe(false);expect(auth.user()).toBeNull();http.expectNone('/api/auth/refresh');
 });
});
