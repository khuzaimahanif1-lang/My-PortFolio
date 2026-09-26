import { Pipe, PipeTransform } from '@angular/core';
@Pipe({name:'markdown'})
export class Markdown implements PipeTransform {
  transform(value:string|undefined):string{
    const escaped=(value||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
    return escaped.split('\n').map(line=>{
      if(line.startsWith('### '))return '<h3>'+line.slice(4)+'</h3>';
      if(line.startsWith('## '))return '<h2>'+line.slice(3)+'</h2>';
      if(line.startsWith('# '))return '<h1>'+line.slice(2)+'</h1>';
      if(line.startsWith('- '))return '<p class="markdown-bullet">• '+line.slice(2)+'</p>';
      return line?'<p>'+line.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')+'</p>':'<br>';
    }).join('');
  }
}

