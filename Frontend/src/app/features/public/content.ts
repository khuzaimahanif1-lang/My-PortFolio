import { Component,inject,signal,afterNextRender,OnDestroy } from '@angular/core';
import { ActivatedRoute,RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Api,errorMessage } from '../../core/api.service';
import { Portfolio } from '../../core/models';
import { defaultPortfolio } from '../home/home';
import { Icon } from '../../shared/icon';
import { Reveal } from '../../shared/reveal';
const pages:Record<string,{eyebrow:string;title:string;accent:string;description:string}>={
  about:{eyebrow:'THE MIND BEHIND THE WORK',title:'Curiosity is',accent:'my starting point.',description:'A developer exploring the space where artificial intelligence, thoughtful design, and useful software meet.'},
  skills:{eyebrow:'SKILLS & TECHNOLOGIES',title:'The tools to turn',accent:'ideas into reality.',description:'A connected toolkit for modern interfaces, reliable APIs, and practical intelligence.'},
  technology:{eyebrow:'THE CONNECTED STACK',title:'From interface',accent:'to intelligence.',description:'Technology choices guided by clarity, maintainability, and the problem at hand.'},
  journey:{eyebrow:'BUILD. LEARN. GROW.',title:'A journey of',accent:'continuous creation.',description:'Progress comes from asking better questions, making things, and learning from every iteration.'},
  timeline:{eyebrow:'THE STORY SO FAR',title:'Every step',accent:'opens a new door.',description:'Explore the evolving direction of my learning and work.'},
  experience:{eyebrow:'LEARNING THROUGH PRACTICE',title:'Experience starts',accent:'with making.',description:'Building knowledge through real projects and experimentation. Verified professional milestones can be added as the journey develops.'},
  achievements:{eyebrow:'MILESTONES',title:'Small steps.',accent:'Meaningful progress.',description:'A space for verified achievements, certificates, and milestones.'},
  goals:{eyebrow:'THE FUTURE VISION',title:'Ambitious ideas.',accent:'Intentional growth.',description:'Practical AI engineering, useful products, and a commitment to keep learning.'},
  blog:{eyebrow:'FIELD NOTES',title:'Thoughts from',accent:'the process.',description:'A future collection of lessons, technical decisions, and ideas from the work.'},
  research:{eyebrow:'EXPLORE THE UNKNOWN',title:'Questions worth',accent:'following.',description:'Explorations in intelligent systems, computer vision, and the possibilities at the intersection of AI and the web.'},
  ai:{eyebrow:'ARTIFICIAL INTELLIGENCE',title:'Intelligence with',accent:'a clear purpose.',description:'Exploring assistants, language, interview practice, and intelligent tools designed around real needs.'},
  ml:{eyebrow:'MACHINE LEARNING',title:'From patterns',accent:'to possibility.',description:'A learning space for data, models, experimentation, and computer vision.'},
  contact:{eyebrow:'LET’S CONNECT',title:'Have an idea?',accent:'Let’s talk.',description:'A project, a collaboration, or an interesting question. I would love to hear what you have in mind.'}
};
@Component({imports:[RouterLink,FormsModule,Icon,Reveal],templateUrl:'./content.html'})
export class ContentPage implements OnDestroy {
  api=inject(Api);route=inject(ActivatedRoute);kind=signal('about');profile=signal<Portfolio>(defaultPortfolio);
  name='';email='';message='';busy=signal(false);error=signal('');sent=signal(false);private sub?:Subscription;
  constructor(){this.sub=this.route.data.subscribe(d=>this.kind.set(d['kind']||'about'));afterNextRender(async()=>{try{this.profile.set(await this.api.get<Portfolio>('public/profile'));}catch{}});}
  get page(){return pages[this.kind()]||pages['about'];}
  get isJourney(){return ['journey','timeline','experience'].includes(this.kind());}
  get isTechnology(){return ['skills','technology','ai','ml','research'].includes(this.kind());}
  async send(){this.busy.set(true);this.error.set('');try{await this.api.post('public/contact',{name:this.name,email:this.email,message:this.message});this.sent.set(true);}
    catch(e){this.error.set(errorMessage(e));}finally{this.busy.set(false);}}
  ngOnDestroy(){this.sub?.unsubscribe();}
}

