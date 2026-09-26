import { Component, inject, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute,Router,RouterLink } from '@angular/router';
import { Auth } from '../../core/auth.service';
import { safeReturnUrl } from '../../core/return-url';
import { Api,errorMessage } from '../../core/api.service';
import { Icon } from '../../shared/icon';
import { Loader } from '../../shared/loader';
@Component({imports:[FormsModule,RouterLink,Icon,Loader],templateUrl:'./auth.html'})
export class AuthPage implements OnDestroy {
  auth=inject(Auth);api=inject(Api);route=inject(ActivatedRoute);router=inject(Router);
  kind=this.route.snapshot.data['kind']||'login';
  fullName='';email='';password='';confirm='';remember=false;showPassword=false;
  busy=signal(false);error=signal('');success=signal('');
  titles:Record<string,string>={login:'Welcome back.',signup:'Make room for your next idea.',unlock:'Your workspace is locked.',forgot:'A fresh start.',reset:'Set a new password.'};
  subtitles:Record<string,string>={login:'Your ideas, projects, and possibilities are waiting.',signup:'A private command center for the way you create.',unlock:'Enter your password to continue where you left off.',forgot:'Enter your email to receive a password reset link.',reset:'Choose a new password for your private workspace.'};
  async submit(){
    this.busy.set(true);this.error.set('');
    try{
      if(this.kind==='signup'){await this.auth.signup({full_name:this.fullName,email:this.email,password:this.password,confirm_password:this.confirm});await this.router.navigate(['/workspace']);}
      if(this.kind==='login'){await this.auth.login({email:this.email,password:this.password,remember:this.remember});
        const target=this.route.snapshot.queryParamMap.get('returnUrl')||'/workspace';await this.router.navigateByUrl(safeReturnUrl(target));}
      if(this.kind==='unlock'){await this.auth.unlock(this.password);await this.router.navigateByUrl(safeReturnUrl(this.auth.returnUrl));}
      if(this.kind==='forgot'){const result=await this.api.post<{message:string}>('auth/forgot-password',{email:this.email});this.success.set(result.message);}
      if(this.kind==='reset'){const result=await this.api.post<{message:string}>('auth/reset-password',{password:this.password,token:this.route.snapshot.queryParamMap.get('token')||''});this.success.set(result.message);}
    }catch(e){this.error.set(errorMessage(e));}finally{this.busy.set(false);this.password='';this.confirm='';this.showPassword=false;}
  }
  ngOnDestroy(){this.password='';this.confirm='';this.email='';this.fullName='';
  }
}

