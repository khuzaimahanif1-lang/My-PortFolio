import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute,Router } from '@angular/router';
import { EMPTY } from 'rxjs';
import { Api } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import { Home } from './home';
describe('landing project editing access',()=>{
 let home:Home,auth:{user:ReturnType<typeof signal<any>>;locked:ReturnType<typeof signal<boolean>>;ensure:ReturnType<typeof vi.fn>;returnUrl:string},navigate:ReturnType<typeof vi.fn>;
 beforeEach(()=>{
  auth={user:signal<any>(null),locked:signal(false),ensure:vi.fn().mockResolvedValue(true),returnUrl:'/workspace'};navigate=vi.fn().mockResolvedValue(true);
  TestBed.configureTestingModule({providers:[{provide:Api,useValue:{}},{provide:Auth,useValue:auth},{provide:Router,useValue:{navigate}},{provide:ActivatedRoute,useValue:{queryParamMap:EMPTY}}]});
  home=TestBed.runInInjectionContext(()=>new Home());
 });
 afterEach(()=>{home.ngOnDestroy();TestBed.resetTestingModule();});
 it('waits for the owner session to restore before opening the landing Add form',async()=>{
  let restore!:()=>void;auth.ensure.mockImplementation(()=>new Promise<void>(resolve=>restore=()=>{auth.user.set({role:'OWNER'});resolve();}));
  const pending=home.requestAction('new');expect(home.editor()).toBeUndefined();restore();await pending;
  expect(home.editor()).toEqual({is_public:true});expect(navigate).not.toHaveBeenCalled();
 });
 it('keeps the intended landing editor across unlock and consumes it after returning',async()=>{
  auth.user.set({role:'OWNER'});auth.locked.set(true);await home.requestAction('manage');
  expect(auth.returnUrl).toBe('/?portfolio=manage');expect(navigate).toHaveBeenCalledWith(['/unlock']);expect(home.management()).toBe(false);
  auth.locked.set(false);await home.resumeAction('manage');expect(home.management()).toBe(true);
  expect(navigate).toHaveBeenLastCalledWith([],expect.objectContaining({queryParams:{portfolio:null},replaceUrl:true}));
 });
 it('does not open an old editor or redirect after leaving the landing during session restoration',async()=>{
  let restore!:()=>void;auth.ensure.mockImplementation(()=>new Promise<void>(resolve=>restore=resolve));
  const pending=home.requestAction('new');home.ngOnDestroy();restore();await pending;
  expect(navigate).not.toHaveBeenCalled();expect(home.editor()).toBeUndefined();
 });
 it('returns guests to the landing Add form after sign-in and protects owner controls from other accounts',async()=>{
  await home.requestAction('new');expect(navigate).toHaveBeenCalledWith(['/login'],{queryParams:{returnUrl:'/?portfolio=new'}});
  auth.user.set({role:'USER'});await home.resumeAction('new');expect(home.editor()).toBeUndefined();expect(home.management()).toBe(false);expect(home.accessMessage()).toContain('portfolio owner account');
  auth.user.set({role:'OWNER'});await home.resumeAction('new');expect(home.editor()).toEqual({is_public:true});
 });
});
