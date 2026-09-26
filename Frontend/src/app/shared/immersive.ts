import { Component, ElementRef, ViewChild, afterNextRender, OnDestroy, signal } from '@angular/core';
@Component({selector: 'app-immersive', template: `<canvas #canvas class="sequence-canvas" aria-hidden="true"></canvas>
  <span class="sequence-index" aria-hidden="true">{{frame().toString().padStart(3,'0')}} <i>/</i> 320</span>`})
export class Immersive implements OnDestroy {
  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;
  frame = signal(1); private cache = new Map<number, HTMLImageElement>();
  private pending = new Set<number>(); private raf = 0; private observer?: ResizeObserver;
  private destroyed = false; private context?: CanvasRenderingContext2D | null;
  private onScroll = () => { if (!this.raf) this.raf = requestAnimationFrame(() => {this.raf=0; this.update();}); };
  constructor() { afterNextRender(() => {
    this.context = this.canvas.nativeElement.getContext('2d');
    this.observer = new ResizeObserver(() => this.paint()); this.observer.observe(this.canvas.nativeElement);
    if (!document.documentElement.classList.contains('reduce-motion') && !matchMedia('(prefers-reduced-motion: reduce)').matches && !(navigator as any).connection?.saveData)
      window.addEventListener('scroll', this.onScroll, {passive:true});
    this.load(1); this.update();
  }); }
  private update() {
    const progress = Math.min(1,Math.max(0,window.scrollY / Math.max(1,document.documentElement.scrollHeight-window.innerHeight)));
    const target = Math.min(320,1+Math.round(progress*319)); this.frame.set(target);
    this.load(target);
    const ahead = window.innerWidth < 700 ? 3 : 6;
    for (let i=Math.max(1,target-ahead); i<=Math.min(320,target+ahead); i++) this.load(i);
    for (const key of this.cache.keys()) if (Math.abs(key-target)>12) this.cache.delete(key);
    this.paint();
  }
  private load(index: number) {
    if (this.cache.has(index)||this.pending.has(index)||this.destroyed||this.pending.size>=12) return;
    this.pending.add(index); const img = new Image();
    img.onload = () => {this.pending.delete(index); if (!this.destroyed && Math.abs(index-this.frame())<=12) {
      this.cache.set(index,img); this.paint(); } this.load(this.frame()); };
    img.onerror = () => this.pending.delete(index);
    img.src = '/assets/sequence/frame-'+index.toString().padStart(3,'0')+'.webp';
  }
  private paint() {
    if (!this.context||this.destroyed) return;
    const image = this.cache.get(this.frame()) || this.cache.values().next().value;
    if (!image) return;
    const c=this.canvas.nativeElement, ratio=Math.min(devicePixelRatio,1.5);
    const w=Math.round(c.clientWidth*ratio),h=Math.round(c.clientHeight*ratio);
    if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
    this.context.clearRect(0,0,w,h);
    const side=Math.max(w,h); this.context.drawImage(image,(w-side)/2,(h-side)/2,side,side);
  }
  ngOnDestroy() { this.destroyed=true; if (typeof window !== 'undefined') window.removeEventListener('scroll',this.onScroll); if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.raf); this.observer?.disconnect(); this.cache.clear(); }
}
@Component({selector: 'app-orbit-scene', template: '<div #host class="orbit-scene" aria-hidden="true"></div>'})
export class OrbitScene implements OnDestroy {
  @ViewChild('host') host!: ElementRef<HTMLDivElement>; private dispose?: ()=>void; private destroyed=false;
  constructor() { afterNextRender(async () => {
    if(document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches || (navigator as any).connection?.saveData) return;
    try {
      const THREE=await import('three'); if(this.destroyed)return;
      const element=this.host.nativeElement; const scene=new THREE.Scene();
      const camera=new THREE.PerspectiveCamera(40,1,0.1,100); camera.position.z=8;
      const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
      renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); element.appendChild(renderer.domElement);
      const geometry=new THREE.IcosahedronGeometry(2.1,1);
      const material=new THREE.MeshBasicMaterial({color:0xb9904e,wireframe:true,transparent:true,opacity:0.16});
      const mesh=new THREE.Mesh(geometry,material); scene.add(mesh);
      let raf=0;let visible=true;
      const resize=new ResizeObserver(()=>{const w=element.clientWidth,h=element.clientHeight;renderer.setSize(w,h);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();});
      resize.observe(element);
      const visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;}); visibility.observe(element);
      const draw=()=>{if(this.destroyed)return;raf=requestAnimationFrame(draw);if(!visible||document.hidden)return;
        mesh.rotation.y+=0.0018;mesh.rotation.x+=0.0007;renderer.render(scene,camera);};draw();
      this.dispose=()=>{cancelAnimationFrame(raf);resize.disconnect();visibility.disconnect();geometry.dispose();material.dispose();renderer.dispose();element.replaceChildren();};
    } catch { /* The CSS orbital artwork remains when WebGL is unavailable. */ }
  }); }
  ngOnDestroy(){this.destroyed=true;this.dispose?.();}
}


