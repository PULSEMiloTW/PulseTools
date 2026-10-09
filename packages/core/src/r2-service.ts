import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Core } from './index.js';
import { snowflake, type Actor } from '../../shared/src/models.js';
import { PulseError } from '../../shared/src/errors.js';
import { acceptedAttachment, safeFilename, r2AttachmentSchema, type R2Attachment, type R2Choice } from '../../shared/src/r2.js';
import type { R2Store, R2Request } from './r2-store.js';
import type { R2Storage } from './r2-storage.js';
export interface R2Transport {
  actor(actor:Actor):Promise<Actor>;
  prompt(request:R2Request,canDelete:boolean):Promise<string>;
  fresh(request:R2Request):Promise<{files:(R2Attachment & {url:string})[];canDelete:boolean}>;
  result(request:R2Request,links:{name:string;url:string}[]):Promise<string>;
  deleteOriginal(request:R2Request):Promise<void>;
  disable(request:R2Request):Promise<void>;
  verifyLink(url:string):Promise<void>;
}
export class R2Service {
  private active = 0;
  constructor(readonly core:Core,readonly store:R2Store,readonly storage:R2Storage,readonly transport:R2Transport,private readonly onError:(guildId:string)=>Promise<void>) {}
  async accessList(actor:Actor) {
    this.core.permissions.requireOwner(actor.userId);
    await this.core.permissions.requireGuild(actor.guildId);
    return this.store.accessList(actor.guildId);
  }
  async setAccess(actor:Actor,userId:string,enabled:boolean) {
    this.core.permissions.requireOwner(actor.userId);
    await this.core.permissions.requireAdmin(actor,true);
    if(!snowflake.safeParse(userId).success) throw new PulseError('INVALID_INPUT');
    if(enabled) await this.transport.actor({guildId:actor.guildId,userId,nativeAdministrator:false});
    await this.store.setAllowed(actor.guildId,userId,enabled,actor.userId);
  }
  private async requireAccess(guildId:string,userId:string) {
    if(!await this.store.allowed(guildId,userId)) throw new PulseError('PERMISSION_DENIED');
  }
  async ready(guildId:string,mutation=false) {
    await this.core.permissions.requireGuild(guildId);
    if(mutation && await this.core.repository.lockdown()) throw new PulseError('LOCKDOWN');
    if(!this.storage.configured || !await this.core.modules.enabled(guildId,'PT-10')) throw new PulseError('MODULE_UNAVAILABLE');
  }
  async offer(input:Pick<R2Request,'guildId'|'channelId'|'messageId'|'uploaderId'|'attachments'>,canDelete:boolean) {
    z.object({guildId:snowflake,channelId:snowflake,messageId:snowflake,uploaderId:snowflake}).parse(input);
    await this.ready(input.guildId,true); const settings=await this.store.settings(input.guildId);
    if(!settings.channels.includes(input.channelId) || !settings.membersMayUpload || !input.attachments.length) return;
    if(!await this.store.allowed(input.guildId,input.uploaderId)) return;
    const files=z.array(r2AttachmentSchema).max(settings.maxFiles).parse(input.attachments);
    if(files.some(f=>!acceptedAttachment(f,settings))) return;
    const request=await this.store.create({...input,attachments:files,settings}); if(!request) return;
    try { const promptId=await this.transport.prompt(request,canDelete && settings.allowDelete && settings.access==='public' && this.storage.publicAvailable); await this.store.prompt(request.guildId,request.id,promptId); }
    catch {await this.store.state(request.guildId,request.id,'Failed','R2_PROMPT_FAILED'); await this.onError(request.guildId);}
  }
  private async authorizeRequest(actor:Actor,request:R2Request) {
    await this.ready(actor.guildId,true);
    actor=await this.transport.actor(actor);
    await this.requireAccess(actor.guildId,actor.userId);
    await this.requireAccess(actor.guildId,request.uploaderId);
    if(actor.userId!==request.uploaderId) await this.core.permissions.requireAdmin(actor,true);
    const settings=await this.store.settings(actor.guildId);
    if(!settings.channels.includes(request.channelId) || !settings.membersMayUpload || settings.access!==request.settings.access || settings.resultChannelId!==request.settings.resultChannelId || request.attachments.length>settings.maxFiles || request.attachments.some(file=>!acceptedAttachment(file,settings))) throw new PulseError('PERMISSION_DENIED');
    return settings;
  }
  async choose(actor:Actor,id:string,channelId:string,promptId:string,choice:R2Choice) {
    await this.ready(actor.guildId,true); actor=await this.transport.actor(actor); if(!z.uuid().safeParse(id).success) throw new PulseError('INVALID_INPUT');
    const original=await this.store.get(actor.guildId,id);
    if(!original || original.channelId!==channelId || original.promptId!==promptId) throw new PulseError('INVALID_INPUT');
    await this.requireAccess(actor.guildId,actor.userId);
    await this.requireAccess(actor.guildId,original.uploaderId);
    if(actor.userId!==original.uploaderId) await this.core.permissions.requireAdmin(actor,true);
    const current=await this.store.settings(actor.guildId);
    if(!current.channels.includes(original.channelId) || !current.membersMayUpload || current.access!==original.settings.access) throw new PulseError('MODULE_UNAVAILABLE');
    if(choice==='delete' && (!original.settings.allowDelete || !current.allowDelete || original.settings.access!=='public' || current.access!=='public' || !this.storage.publicAvailable)) throw new PulseError('INVALID_INPUT');
    const request=await this.store.claim(actor.guildId,id,choice,actor.userId);
    if(!request) return '此請求已處理或已過期，沒有重複上傳。';
    await this.transport.disable(request).catch(()=>{});
    if(choice==='cancel') return '已取消；沒有下載或上傳附件。';
    if(this.active>=2) {await this.store.state(actor.guildId,id,'Failed','R2_BUSY');return '目前有兩個上傳流程處理中；本次未上傳，請稍後重新發送附件。';}
    this.active++;
    try {
      const fresh=await this.transport.fresh(request);
      if(choice==='delete' && !fresh.canDelete) throw new Error('R2_DELETE_PERMISSION');
      if(fresh.files.length!==request.attachments.length) throw new Error('R2_ATTACHMENT_CHANGED');
      const links:{name:string;url:string}[]=[];
      for(const file of request.attachments) {
        const source=fresh.files.find(f=>f.id===file.id);
        if(!source || source.size!==file.size || source.name!==file.name || source.contentType!==file.contentType || !acceptedAttachment(file,current)) throw new Error('R2_ATTACHMENT_CHANGED');
        await this.authorizeRequest(actor,request);
        const objectId=randomUUID(),date=request.createdAt;
        const key=`${actor.guildId}/${request.settings.prefix}/${date.getUTCFullYear()}/${String(date.getUTCMonth()+1).padStart(2,'0')}/${objectId}-${safeFilename(file.name)}`;
        await this.store.object({id:objectId,guildId:actor.guildId,requestId:id,attachmentId:file.id,filename:file.name,key,contentType:file.contentType??'application/octet-stream',size:file.size,status:'Uploading'});
        let verifiedObject=false;
        try {
          const verified=await this.storage.upload(file,source.url,key,request.settings);
          await this.store.object({id:objectId,guildId:actor.guildId,requestId:id,attachmentId:file.id,filename:file.name,key,...verified,status:'Uploaded',uploadedAt:new Date()}); verifiedObject=true;
          const url=await this.storage.link(key,request.settings.access,verified.contentType);
          await this.transport.verifyLink(url); links.push({name:file.name,url});
        } catch {
          // 寫回或網路結果不明時不覆蓋既有 Object，也不自動重傳。
          if(!verifiedObject) await this.store.object({id:objectId,guildId:actor.guildId,requestId:id,attachmentId:file.id,filename:file.name,key,contentType:file.contentType??'application/octet-stream',size:file.size,status:'Unknown'});
          throw new Error('R2_FILE_FAILED');
        }
      }
      await this.store.state(actor.guildId,id,'Uploaded');
      await this.authorizeRequest(actor,request);
      const resultId=await this.transport.result(request,links);
      await this.store.state(actor.guildId,id,'Uploaded',undefined,resultId);
      if(choice==='delete') {
        await this.authorizeRequest(actor,request);
        const policy=await this.store.settings(actor.guildId);
        if(!policy.allowDelete || policy.access!=='public' || !policy.channels.includes(request.channelId)) throw new Error('R2_DELETE_DISABLED');
        const latest=await this.transport.fresh(request);
        if(!latest.canDelete || latest.files.length!==request.attachments.length || request.attachments.some(f=>!latest.files.some(x=>x.id===f.id && x.name===f.name && x.size===f.size))) throw new Error('R2_ATTACHMENT_CHANGED');
        await this.core.repository.recordEvent({guildId:actor.guildId,actorId:actor.userId,action:'r2.delete.authorized',details:{requestId:id,messageId:request.messageId},eventAt:new Date(),receivedAt:new Date(),processedAt:new Date(),timestampSource:'received'});
        await this.transport.deleteOriginal(request);
      }
      await this.store.state(actor.guildId,id,'Completed',undefined,undefined,choice==='delete'?new Date():undefined);
      return request.settings.access==='private'?'上傳完成，原訊息保留。私人連結有效一小時，可由 /r2 file info 重新取得。':'上傳完成；已發布檔案連結。';
    } catch {
      await this.store.state(actor.guildId,id,'PartiallyCompleted','R2_PROCESS_FAILED');
      await this.onError(actor.guildId);
      return '流程未全部完成，請核對檔案紀錄與原訊息；系統不會自動重傳或重做刪除。';
    } finally { this.active--; }
  }
  async expire() { for(const request of await this.store.expire()) { await this.transport.disable(request).catch(()=>{}); await this.store.prompt(request.guildId,request.id,null); } }
}
