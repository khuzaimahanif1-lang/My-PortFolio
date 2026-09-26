import { Markdown } from './markdown';
describe('User-authored Markdown',()=>{
 it('escapes executable markup before formatting',()=>{
  const result=new Markdown().transform('# Note\n<script>alert(1)</script>\n<img src=x onerror=alert(1)>');
  expect(result).toContain('<h1>Note</h1>');
  expect(result).not.toContain('<script>');
  expect(result).not.toContain('<img');
  expect(result).toContain('&lt;script&gt;');
 });
});

