import { safeReturnUrl } from './return-url';
describe('Owner portfolio sign-in redirects',()=>{
  it('returns to the portfolio editor or draft after signing in and unlocking',()=>{
    for(const path of ['/','/projects','/projects/preview/draft-id','/projects/my-project','/workspace/projects'])expect(safeReturnUrl(path)).toBe(path);
  });
  it('rejects external URLs and paths outside the editable application',()=>{
    for(const path of ['//example.com','https://example.com','/\\example.com','/workspaceevil','/login',null])expect(safeReturnUrl(path)).toBe('/workspace');
  });
});
