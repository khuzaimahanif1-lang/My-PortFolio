import { TestBed } from '@angular/core/testing';
import { ActivatedRoute,provideRouter } from '@angular/router';
import { EMPTY } from 'rxjs';
import { Api,Toasts } from '../../core/api.service';
import { Notes } from './notes';
import { Note } from '../../core/models';
const record:Note={id:'test-note',title:'My note',content:'First version',category:'Personal',tags:[],pinned:false,favorite:false,archived:false,updated_at:'2026-09-12T00:00:00'};
describe('inline notepad saves',()=>{
 let notes:Notes,api:{post:ReturnType<typeof vi.fn>;put:ReturnType<typeof vi.fn>};
 beforeEach(()=>{
  api={post:vi.fn(),put:vi.fn()};
  TestBed.configureTestingModule({providers:[provideRouter([]),{provide:ActivatedRoute,useValue:{queryParamMap:EMPTY}},{provide:Api,useValue:api},{provide:Toasts,useValue:{show:vi.fn()}}]});
  notes=TestBed.runInInjectionContext(()=>new Notes());
 });
 afterEach(async()=>{await notes.flush();notes.ngOnDestroy();TestBed.resetTestingModule();});
 it('updates the same new note when typing continues during its first save',async()=>{
  let finish!:(value:Note)=>void;api.post.mockImplementation(()=>new Promise<Note>(resolve=>finish=resolve));
  api.put.mockImplementation(async(_path:string,payload:any)=>({...record,...payload}));
  await notes.beginNew();notes.draft.title='My note';notes.draft.content='First version';notes.changed();
  const first=notes.save();await Promise.resolve();expect(api.post).toHaveBeenCalledTimes(1);
  notes.draft.content='Latest version';notes.changed();const second=notes.save();
  finish(record);await first;await second;
  expect(api.post).toHaveBeenCalledTimes(1);expect(api.put).toHaveBeenCalledWith('notes/test-note',expect.objectContaining({content:'Latest version'}));
  expect(notes.draft.content).toBe('Latest version');expect(notes.selected()?.content).toBe('Latest version');expect(notes.savedState()).toBe('All changes saved');
 });
 it('retains a failed draft and blocks switching notes until it can save',async()=>{
  api.post.mockRejectedValueOnce(new Error('Offline')).mockRejectedValueOnce(new Error('Offline')).mockImplementation(async(_path:string,payload:any)=>({...record,...payload}));
  await notes.beginNew();notes.draft.title='My note';notes.draft.content='Keep this thought';notes.changed();await notes.save();
  await notes.select({...record,id:'other-note',title:'Other note'});
  expect(notes.creating()).toBe(true);expect(notes.selected()).toBeNull();expect(notes.draft.content).toBe('Keep this thought');
  await notes.save(true);expect(notes.selected()?.content).toBe('Keep this thought');expect(notes.savedState()).toBe('All changes saved');
 });
});
