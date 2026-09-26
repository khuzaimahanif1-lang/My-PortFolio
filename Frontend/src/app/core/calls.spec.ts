import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { Api,Toasts } from './api.service';
import { Auth } from './auth.service';
import { Realtime } from './realtime.service';
import { Calls,Call } from './calls.service';
describe('call media lifetime',()=>{
 afterEach(()=>{TestBed.resetTestingModule();vi.unstubAllGlobals();});
 it('stops a screen granted after the call has ended',async()=>{
  let resolve!:(value:any)=>void;const stop=vi.fn();const capture=new Promise(done=>resolve=done);
  vi.stubGlobal('navigator',{mediaDevices:{getDisplayMedia:vi.fn().mockReturnValue(capture)}});
  TestBed.configureTestingModule({providers:[{provide:Api,useValue:{post:vi.fn().mockResolvedValue({})}},{provide:Auth,useValue:{user:signal({id:'alice'}),token:signal('test-token'),locked:signal(false)}},{provide:Realtime,useValue:{events:new Subject()}},{provide:Toasts,useValue:{show:vi.fn()}}]});
  const calls=TestBed.inject(Calls);calls.current.set({id:'test-call',kind:'VIDEO',state:'ACTIVE',initiator:{id:'alice',full_name:'Alice'},recipient:null,control_allowed:false,created_at:'',expires_at:''} as Call);
  const pending=calls.shareScreen();await calls.end();resolve({getTracks:()=>[{stop}]});await pending;
  expect(stop).toHaveBeenCalledOnce();expect(calls.current()).toBeNull();expect(calls.local()).toBeNull();expect(calls.sharing()).toBe(false);
 });
});
