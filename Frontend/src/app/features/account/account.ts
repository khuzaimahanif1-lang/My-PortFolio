import { Component,inject,signal,afterNextRender } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Api,Toasts,errorMessage } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import { User,Page,Portfolio } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Loader } from '../../shared/loader';
@Component({imports:[FormsModule,DatePipe,Icon,Loader],templateUrl:'./account.html'})
export class Account{
 api=inject(Api);auth=inject(Auth);toasts=inject(Toasts);settings=inject(ActivatedRoute).snapshot.data['kind']==='settings';
 tab=signal('Profile');busy=signal(true);saving=signal(false);error=signal('');profile:any={};prefs:any={};sessions=signal<any[]>([]);
 currentPassword='';newPassword='';confirmPassword='';content:any={};skills='';achievements='';journey='[]';contacts=signal<any[]>([]);aiAvailable=signal(false);
 constructor(){afterNextRender(()=>void this.load());}
 async load(){this.busy.set(true);try{const u=await this.api.get<User>('account');this.auth.update(u);this.profile={full_name:u.full_name,title:u.title,bio:u.bio,location:u.location};
 this.prefs={workspace_name:'',workspace_accent:'gold',email_notifications:true,message_notifications:true,reduced_motion:false,compact_sidebar:false,theme:'dark',...u.preferences};
 this.sessions.set((await this.api.get<Page<any>>('account/sessions')).items);this.aiAvailable.set((await this.api.get<{available:boolean}>('assistant/status')).available);
 if(u.role==='OWNER'&&this.settings){this.content=await this.api.get<Portfolio>('owner/content');this.skills=this.content.skills.join(', ');this.achievements=this.content.achievements.join('\n');this.journey=JSON.stringify(this.content.journey,null,2);this.contacts.set((await this.api.get<Page<any>>('owner/contacts')).items);}
 this.applyPreferences();this.error.set('');}catch(e){this.error.set(errorMessage(e));}finally{this.busy.set(false);}}
 async saveProfile(){this.saving.set(true);try{this.auth.update(await this.api.put<User>('account/profile',this.profile));this.toasts.show('Profile saved.');}catch(e){this.toasts.show(errorMessage(e));}finally{this.saving.set(false);}}
 async savePreferences(){this.saving.set(true);try{this.auth.update(await this.api.put<User>('account/preferences',this.prefs));this.applyPreferences();this.toasts.show('Preferences saved.');}catch(e){this.toasts.show(errorMessage(e));}finally{this.saving.set(false);}}
 applyPreferences(){document.documentElement.dataset['theme']=this.prefs.theme;document.documentElement.classList.toggle('reduce-motion',!!this.prefs.reduced_motion);}
 async changePassword(){if(this.newPassword!==this.confirmPassword){this.toasts.show('Passwords do not match.');return;}this.saving.set(true);try{const result=await this.api.post<{message:string}>('account/password',{current_password:this.currentPassword,password:this.newPassword});this.currentPassword='';this.newPassword='';this.confirmPassword='';this.toasts.show(result.message);void this.load();}catch(e){this.toasts.show(errorMessage(e));}finally{this.saving.set(false);}}
 async revoke(session:any){try{await this.api.delete('account/sessions/'+session.id);if(session.current)await this.auth.logout();else{this.sessions.update(s=>s.filter(i=>i.id!==session.id));this.toasts.show('Session signed out.');}}catch(e){this.toasts.show(errorMessage(e));}}
 async publish(){this.saving.set(true);try{const payload={...this.content,skills:this.skills.split(',').map(s=>s.trim()).filter(Boolean),achievements:this.achievements.split('\n').filter(Boolean),journey:JSON.parse(this.journey)};
 this.content=await this.api.put('owner/content',payload);this.toasts.show('Public portfolio updated.');}catch(e){this.toasts.show(errorMessage(e));}finally{this.saving.set(false);}}
}

