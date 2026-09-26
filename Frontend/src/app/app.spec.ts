import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
describe('Application shell',()=>{
 beforeEach(()=>TestBed.configureTestingModule({imports:[App],providers:[provideRouter([])]}));
 it('provides a routed application outlet',()=>{
  const fixture=TestBed.createComponent(App);fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
 });
});
