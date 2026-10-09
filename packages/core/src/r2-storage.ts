import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { fileTypeFromFile } from 'file-type';
import { createReadStream } from 'node:fs';
import { mkdtemp, rm, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { attachmentUrl, type R2Attachment, type R2Settings } from '../../shared/src/r2.js';
import type { Environment } from '../../shared/src/environment.js';
export interface R2Storage {
  configured: boolean; publicAvailable: boolean;
  upload(file:R2Attachment,url:string,key:string,settings:R2Settings):Promise<{contentType:string;size:number}>;
  link(key:string,access:'private'|'public'):Promise<string>;
  test():Promise<void>;
}
export class R2StorageService implements R2Storage {
  readonly configured:boolean; readonly publicAvailable:boolean; private readonly client:S3Client | undefined; private readonly publicBase:URL|undefined; private readonly active=new Set<AbortController>();
  constructor(private readonly env:Environment) {
    this.configured=Boolean(env.R2_ACCOUNT_ID && /^[a-f0-9]{32}$/i.test(env.R2_ACCOUNT_ID) && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME);
    if(env.R2_PUBLIC_BASE_URL) {
      try { const u=new URL(env.R2_PUBLIC_BASE_URL); if(u.protocol==='https:' && !u.username && !u.password && !u.search && !u.hash && !u.hostname.endsWith('r2.cloudflarestorage.com') && !u.hostname.endsWith('r2.dev') && !['localhost','127.0.0.1','[::1]'].includes(u.hostname)) this.publicBase=u; } catch {}
    }
    this.publicAvailable=Boolean(this.publicBase);
    if(this.configured) this.client=new S3Client({region:'auto',endpoint:`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,credentials:{accessKeyId:env.R2_ACCESS_KEY_ID!,secretAccessKey:env.R2_SECRET_ACCESS_KEY!},maxAttempts:1,requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});
  }
  async test() { if(!this.client) throw new Error('R2_CONFIG_REQUIRED'); await this.client.send(new HeadBucketCommand({Bucket:this.env.R2_BUCKET_NAME}),{abortSignal:AbortSignal.timeout(10000)}); }
  async link(key:string,access:'private'|'public') {
    if(!this.client) throw new Error('R2_CONFIG_REQUIRED');
    if(access==='public') { if(!this.publicBase) throw new Error('R2_PUBLIC_REQUIRED'); return `${this.publicBase.toString().replace(/\/$/,'')}/${key.split('/').map(encodeURIComponent).join('/')}`; }
    return getSignedUrl(this.client,new GetObjectCommand({Bucket:this.env.R2_BUCKET_NAME,Key:key,ResponseContentDisposition:'attachment'}),{expiresIn:3600});
  }
  async upload(file:R2Attachment,url:string,key:string,settings:R2Settings) {
    if(!this.client) throw new Error('R2_CONFIG_REQUIRED');
    attachmentUrl(url);
    const directory=await mkdtemp(join(tmpdir(),'pulsetools-r2-')),path=join(directory,'attachment');
    const controller=new AbortController();this.active.add(controller);
    try {
      const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(120000)]);
      const response=await fetch(url,{redirect:'error',signal});
      if(!response.ok || !response.body) throw new Error('R2_DOWNLOAD_FAILED');
      const declared=response.headers.get('content-length');
      if(declared && Number(declared)!==file.size) { await response.body.cancel(); throw new Error('R2_SIZE_MISMATCH'); }
      const writer=await open(path,'wx'); const reader=response.body.getReader(); let size=0; const hash=createHash('sha256');
      try { while(true) { const chunk=await reader.read(); if(chunk.done) break; size+=chunk.value.length; if(size>settings.maxBytes || size>file.size) throw new Error('R2_SIZE_LIMIT'); hash.update(chunk.value); await writer.writeFile(chunk.value); } }
      finally { await reader.cancel().catch(()=>{}); await writer.close(); }
      if(size!==file.size) throw new Error('R2_SIZE_MISMATCH');
      const detected=await fileTypeFromFile(path),ext=file.name.split('.').pop()?.toLowerCase();
      if(!detected || !settings.allowedTypes.some(t=>t===detected.ext) || (ext==='jpeg'?'jpg':ext)!==detected.ext || (file.contentType && file.contentType.split(';')[0]!==detected.mime)) throw new Error('R2_TYPE_MISMATCH');
      const digest=hash.digest('hex'); const stream=createReadStream(path);
      try { await this.client.send(new PutObjectCommand({Bucket:this.env.R2_BUCKET_NAME,Key:key,Body:stream,ContentLength:size,ContentType:detected.mime,ContentDisposition:'attachment',Metadata:{sha256:digest},IfNoneMatch:'*'}),{abortSignal:signal}); }
      finally {stream.destroy();}
      const head=await this.client.send(new HeadObjectCommand({Bucket:this.env.R2_BUCKET_NAME,Key:key}),{abortSignal:signal});
      if(head.ContentLength!==size || head.ContentType!==detected.mime || head.Metadata?.sha256!==digest) throw new Error('R2_VERIFY_FAILED');
      return {contentType:detected.mime,size};
    } finally { this.active.delete(controller); await rm(directory,{recursive:true,force:true}); }
  }
  cancelUploads() {for(const controller of this.active) controller.abort();}
  destroy() {this.cancelUploads();this.client?.destroy();}
}
