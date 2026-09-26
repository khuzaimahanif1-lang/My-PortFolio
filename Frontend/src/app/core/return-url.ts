/** Keep sign-in and unlock redirects inside the application's editable pages. */
export function safeReturnUrl(value:string|null|undefined):string {
  if(!value||!value.startsWith('/')||value.startsWith('//')||/[\\\r\n]/.test(value))return '/workspace';
  const path=value.split(/[?#]/)[0];
  return path==='/'||path==='/projects'||path.startsWith('/projects/')||path==='/workspace'||path.startsWith('/workspace/')?value:'/workspace';
}
