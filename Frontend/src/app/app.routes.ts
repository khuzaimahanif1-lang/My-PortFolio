import { Routes } from '@angular/router';
import { workspaceGuard,unlockGuard,portfolioGuard } from './core/guards';
export const routes:Routes=[
 {path:'login',loadComponent:()=>import('./features/auth/auth').then(m=>m.AuthPage),data:{kind:'login'}},
 {path:'signup',loadComponent:()=>import('./features/auth/auth').then(m=>m.AuthPage),data:{kind:'signup'}},
 {path:'forgot-password',loadComponent:()=>import('./features/auth/auth').then(m=>m.AuthPage),data:{kind:'forgot'}},
 {path:'reset-password',loadComponent:()=>import('./features/auth/auth').then(m=>m.AuthPage),data:{kind:'reset'}},
 {path:'unlock',canActivate:[unlockGuard],loadComponent:()=>import('./features/auth/auth').then(m=>m.AuthPage),data:{kind:'unlock'}},
 {path:'workspace',canActivate:[workspaceGuard],canActivateChild:[workspaceGuard],loadComponent:()=>import('./layouts/workspace-layout').then(m=>m.WorkspaceLayout),children:[
  {path:'',pathMatch:'full',loadComponent:()=>import('./features/dashboard/dashboard').then(m=>m.Dashboard)},
  {path:'projects',loadComponent:()=>import('./features/projects/projects').then(m=>m.Projects),data:{private:true}},
  {path:'projects/:id',loadComponent:()=>import('./features/projects/detail').then(m=>m.ProjectDetail),data:{private:true}},
  {path:'tasks',loadComponent:()=>import('./features/resources/resources').then(m=>m.Resources),data:{kind:'tasks'}},
  {path:'notes',loadComponent:()=>import('./features/notes/notes').then(m=>m.Notes)},
  {path:'notepad',redirectTo:'notes'},
  {path:'goals',loadComponent:()=>import('./features/resources/resources').then(m=>m.Resources),data:{kind:'goals'}},
  {path:'reports',loadComponent:()=>import('./features/reports/reports').then(m=>m.Reports),data:{kind:'reports'}},
  {path:'connect',loadComponent:()=>import('./features/connect/connect').then(m=>m.Communication)},
  {path:'analytics',redirectTo:'connect'},
  {path:'charts',redirectTo:'reports'},
  {path:'messages',redirectTo:'connect?mode=chat',pathMatch:'full'},
  {path:'notifications',loadComponent:()=>import('./features/notifications/notifications').then(m=>m.Notifications)},
  {path:'account',loadComponent:()=>import('./features/account/account').then(m=>m.Account),data:{kind:'account'}},
  {path:'settings',loadComponent:()=>import('./features/account/account').then(m=>m.Account),data:{kind:'settings'}}
 ]},
 ...['dashboard','tasks','notepad','reports','analytics','charts','messages','notifications','account','settings'].map(path=>({path,redirectTo:'workspace/'+(path==='dashboard'?'':path),pathMatch:'full' as const})),
 {path:'',loadComponent:()=>import('./layouts/public-layout').then(m=>m.PublicLayout),children:[
  {path:'',pathMatch:'full',loadComponent:()=>import('./features/home/home').then(m=>m.Home)},
  {path:'home',redirectTo:'',pathMatch:'full'},
  {path:'projects',loadComponent:()=>import('./features/projects/projects').then(m=>m.Projects)},
  {path:'projects/preview/:id',canActivate:[portfolioGuard],loadComponent:()=>import('./features/projects/detail').then(m=>m.ProjectDetail),data:{portfolioPreview:true}},
  {path:'projects/:slug',loadComponent:()=>import('./features/projects/detail').then(m=>m.ProjectDetail)},
  ...['about','skills','experience','journey','achievements','goals','contact','blog','research','ai','ml','technology','timeline'].map(kind=>({
   path:kind,loadComponent:()=>import('./features/public/content').then(m=>m.ContentPage),data:{kind}
  }))
 ]},
 {path:'**',loadComponent:()=>import('./features/public/not-found').then(m=>m.NotFound)}
];
