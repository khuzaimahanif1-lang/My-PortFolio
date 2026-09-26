import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Api } from './api.service';
import { Auth } from './auth.service';
import { Realtime } from './realtime.service';
class TestSocket {
 static sockets:TestSocket[]=[];
 onopen?:()=>void;onmessage?:(e:{data:string})=>void;onclose?:(e:{code:number})=>void;
 constructor(public url:string){TestSocket.sockets.push(this);}
 close(){}
}
describe('realtime account isolation',()=>{
 let realtime:Realtime,auth:any,api:any;
 beforeEach(()=>{TestSocket.sockets=[];vi.stubGlobal('WebSocket',TestSocket);auth={browser:true,user:signal({id:'alice'}),locked:signal(false),goLocked:vi.fn()};api={post:vi.fn().mockResolvedValue({ticket:'test-ticket'})};TestBed.configureTestingModule({providers:[{provide:Auth,useValue:auth},{provide:Api,useValue:api}]});realtime=TestBed.inject(Realtime);});
 afterEach(()=>{realtime.disconnect();TestBed.resetTestingModule();vi.unstubAllGlobals();});
 it('discards a delayed ticket after signing out',async()=>{let resolve!:(value:any)=>void;api.post.mockImplementation(()=>new Promise(done=>resolve=done));realtime.connect();realtime.disconnect();resolve({ticket:'old-ticket'});await Promise.resolve();expect(TestSocket.sockets).toHaveLength(0);expect(realtime.status()).toBe('offline');});
 it('discards messages and lock events from the previous account',async()=>{const events:any[]=[];realtime.events.subscribe(event=>events.push(event));realtime.connect();await Promise.resolve();const socket=TestSocket.sockets[0];expect(socket).toBeDefined();socket.onopen?.();socket.onmessage?.({data:JSON.stringify({type:'connection',online_users:['alice']})});expect(realtime.online()).toEqual(['alice']);events.length=0;auth.user.set({id:'bob'});socket.onmessage?.({data:JSON.stringify({type:'notification:new',body:'Alice private message'})});socket.onclose?.({code:4423});expect(events).toEqual([]);expect(auth.goLocked).not.toHaveBeenCalled();realtime.disconnect();expect(realtime.online()).toEqual([]);});
});
