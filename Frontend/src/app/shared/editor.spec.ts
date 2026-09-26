import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Api } from '../core/api.service';
import { Auth } from '../core/auth.service';
import { ResourceEditor,resourcePayload } from './editor';
describe('Workspace update payloads',()=>{
 it('excludes API ownership, identifiers and server-managed comments',()=>{
  const payload=resourcePayload('tasks',{id:'private-id',owner_id:'other-user',title:'A task',comments:[{content:'server record'}]});
  expect(payload.title).toBe('A task');
  expect(payload).not.toHaveProperty('owner_id');
  expect(payload).not.toHaveProperty('comments');
  expect(payload).not.toHaveProperty('id');
 });
});

describe('Project image save recovery',()=>{
 afterEach(()=>{TestBed.resetTestingModule();vi.unstubAllGlobals();});
 it('retries the unfinished image without creating another project or losing the first image',async()=>{
  const first='/api/project-images/project/first.webp',second='/api/project-images/project/second.webp';
  const post=vi.fn().mockResolvedValueOnce({id:'project',screenshots:[]}).mockResolvedValueOnce({id:'project',screenshots:[first]}).mockRejectedValueOnce(new Error('Temporary upload failure')).mockResolvedValueOnce({id:'project',screenshots:[first,second]});
  const put=vi.fn().mockResolvedValue({id:'project',screenshots:[first]});
  const revoke=vi.fn();vi.stubGlobal('URL',{revokeObjectURL:revoke});
  TestBed.configureTestingModule({providers:[{provide:Api,useValue:{post,put}},{provide:Auth,useValue:{user:signal({role:'OWNER'})}}]});
  const editor=TestBed.runInInjectionContext(()=>new ResourceEditor());editor.ngOnChanges();editor.values.name='A project';editor.values.slug='a-project';
  editor.pendingImages.set([{file:new File(['one'],'one.png',{type:'image/png'}),preview:'blob:one'},{file:new File(['two'],'two.png',{type:'image/png'}),preview:'blob:two'}]);
  const saved=vi.spyOn(editor.saved,'emit');await editor.save();
  expect(saved).not.toHaveBeenCalled();expect(editor.recordId).toBe('project');expect(editor.pendingImages().map(image=>image.file.name)).toEqual(['two.png']);expect(editor.error()).toContain('Project details are saved');
  await editor.save();
  expect(post.mock.calls.filter(([path])=>path==='projects')).toHaveLength(1);
  expect(put).toHaveBeenCalledWith('projects/project',expect.objectContaining({screenshots:[first]}));
  expect(saved).toHaveBeenCalledWith(expect.objectContaining({screenshots:[first,second]}));expect(editor.pendingImages()).toEqual([]);
  expect(revoke.mock.calls.map(([url])=>url)).toEqual(['blob:one','blob:two']);editor.ngOnDestroy();
 });
});


describe('Portfolio editor endpoint',()=>{
 afterEach(()=>TestBed.resetTestingModule());
 it('updates personal portfolio details through the owner portfolio API',async()=>{
  const put=vi.fn().mockResolvedValue({id:'personal',screenshots:[]});
  TestBed.configureTestingModule({providers:[{provide:Api,useValue:{put}},{provide:Auth,useValue:{user:signal({role:'OWNER'})}}]});
  const editor=TestBed.runInInjectionContext(()=>new ResourceEditor());editor.endpoint='portfolio/projects';editor.item={id:'personal',name:'Personal work',slug:'personal-work'};editor.ngOnChanges();
  editor.values.description='Updated for a presentation';await editor.save();
  expect(put).toHaveBeenCalledWith('portfolio/projects/personal',expect.objectContaining({description:'Updated for a presentation'}));editor.ngOnDestroy();
 });
});
