// Only ship public assets. Server code, SQL and local secrets stay out of the CDN.
import {cp,mkdir,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist');
for(const path of ['index.html','assets','admin','_headers'])await cp(path,'dist/'+path,{recursive:true});
