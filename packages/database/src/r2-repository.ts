import { and, eq, inArray, lt, desc, sql } from 'drizzle-orm';
import type { Database } from './connection.js';
import { r2GuildSettings, r2UploadRequests, r2UploadedObjects, r2UploadEvents, auditEvents, r2UploadUsers, guilds, securityEvents } from './schema.js';
import { r2SettingsSchema, type R2Settings, type R2State } from '../../shared/src/r2.js';
import type { R2Store, R2Request, R2Object } from '../../core/src/r2-store.js';
export class PostgresR2Store implements R2Store {
  constructor(private readonly db: Database) {}
  async allowed(guildId:string,userId:string) { return (await this.db.select({userId:r2UploadUsers.userId}).from(r2UploadUsers).where(and(eq(r2UploadUsers.guildId,guildId),eq(r2UploadUsers.userId,userId)))).length>0; }
  async accessList(guildId:string) { return (await this.db.select({userId:r2UploadUsers.userId}).from(r2UploadUsers).where(eq(r2UploadUsers.guildId,guildId)).orderBy(r2UploadUsers.createdAt)).map(row=>row.userId); }
  async setAllowed(guildId:string,userId:string,enabled:boolean,ownerId:string) {
    await this.db.transaction(async tx=> {
      const [guild]=await tx.select({authorized:guilds.authorized}).from(guilds).where(eq(guilds.id,guildId)).for('share');
      if(!guild?.authorized) throw new Error('R2_GUILD_DENIED');
      if(enabled) await tx.insert(r2UploadUsers).values({guildId,userId,grantedBy:ownerId}).onConflictDoNothing();
      else await tx.delete(r2UploadUsers).where(and(eq(r2UploadUsers.guildId,guildId),eq(r2UploadUsers.userId,userId)));
      await tx.insert(securityEvents).values({guildId,actorId:ownerId,action:'r2.access.change',details:{userId,enabled},eventAt:new Date(),receivedAt:new Date(),processedAt:new Date(),timestampSource:'received'});
    });
  }
  async settings(guildId: string) { return r2SettingsSchema.parse((await this.db.select().from(r2GuildSettings).where(eq(r2GuildSettings.guildId,guildId)))[0]?.settings ?? {}); }
  async setSettings(guildId: string, settings: R2Settings) { await this.db.insert(r2GuildSettings).values({guildId,settings:r2SettingsSchema.parse(settings),updatedAt:new Date()}).onConflictDoUpdate({target:r2GuildSettings.guildId,set:{settings,updatedAt:new Date()}}); }
  async create(input: Pick<R2Request,'guildId'|'channelId'|'messageId'|'uploaderId'|'attachments'|'settings'>) {
    return this.db.transaction(async tx=> {
      const record=(await tx.insert(r2UploadRequests).values({...input,createdAt:new Date(),expiresAt:new Date(Date.now()+input.settings.promptSeconds*1000)}).onConflictDoNothing().returning())[0];
      if(record) await tx.insert(r2UploadEvents).values({guildId:record.guildId,requestId:record.id,status:'Pending',occurredAt:new Date()});
      return record;
    });
  }
  async get(guildId:string,id:string) { return (await this.db.select().from(r2UploadRequests).where(and(eq(r2UploadRequests.guildId,guildId),eq(r2UploadRequests.id,id))))[0]; }
  async prompt(guildId:string,id:string,promptId:string|null) { await this.db.update(r2UploadRequests).set({promptId}).where(and(eq(r2UploadRequests.guildId,guildId),eq(r2UploadRequests.id,id))); }
  async claim(guildId:string,id:string,choice:string,actorId:string) {
    return this.db.transaction(async tx=> {
      const status=choice==='cancel'?'Cancelled':'Uploading';
      const record=(await tx.update(r2UploadRequests).set({status,choice,actorId,startedAt:new Date()}).where(and(eq(r2UploadRequests.guildId,guildId),eq(r2UploadRequests.id,id),eq(r2UploadRequests.status,'Pending'),sql`${r2UploadRequests.expiresAt} > now()`)).returning())[0];
      if(record) await tx.insert(r2UploadEvents).values({guildId,requestId:id,status,occurredAt:new Date()});
      return record;
    });
  }
  async state(guildId:string,id:string,status:R2State,errorCode?:string,resultId?:string,deletedAt?:Date) {
    await this.db.transaction(async tx=> {
      if(deletedAt) {
        const [request]=await tx.select({messageId:r2UploadRequests.messageId}).from(r2UploadRequests).where(and(eq(r2UploadRequests.guildId,guildId),eq(r2UploadRequests.id,id)));
        if(request) {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${guildId}),hashtext(${request.messageId}))`);
          await tx.update(auditEvents).set({uploadRequestId:id}).where(and(eq(auditEvents.guildId,guildId),eq(auditEvents.messageId,request.messageId),eq(auditEvents.eventType,'message.delete')));
        }
      }
      const updated=await tx.update(r2UploadRequests).set({status,...(errorCode?{errorCode}:{}),...(resultId?{resultId}:{}),...(deletedAt?{deletedAt}:{}),...(['Completed','Failed','PartiallyCompleted','Expired'].includes(status)?{completedAt:new Date()}: {})}).where(and(eq(r2UploadRequests.guildId,guildId),eq(r2UploadRequests.id,id))).returning({id:r2UploadRequests.id});
      if(updated.length) await tx.insert(r2UploadEvents).values({guildId,requestId:id,status,code:errorCode??null,occurredAt:new Date()});
    });
  }
  async object(object:Omit<R2Object,'createdAt'>) { const saved=await this.db.insert(r2UploadedObjects).values({...object,createdAt:new Date()}).onConflictDoUpdate({target:r2UploadedObjects.id,set:{status:object.status,contentType:object.contentType,size:object.size,...(object.uploadedAt?{uploadedAt:object.uploadedAt}:{})},setWhere:and(eq(r2UploadedObjects.guildId,object.guildId),eq(r2UploadedObjects.requestId,object.requestId))!}).returning({id:r2UploadedObjects.id}); if(!saved.length) throw new Error('R2_OBJECT_SCOPE'); }
  async objects(guildId:string,requestId:string) { return this.db.select().from(r2UploadedObjects).where(and(eq(r2UploadedObjects.guildId,guildId),eq(r2UploadedObjects.requestId,requestId))); }
  async files(guildId:string) { return this.db.select().from(r2UploadRequests).where(eq(r2UploadRequests.guildId,guildId)).orderBy(desc(r2UploadRequests.createdAt)).limit(25); }
  async expire() {
    return this.db.transaction(async tx=> {
      const rows=await tx.update(r2UploadRequests).set({status:'Expired',completedAt:new Date()}).where(and(eq(r2UploadRequests.status,'Pending'),lt(r2UploadRequests.expiresAt,new Date()))).returning();
      for(const r of rows) await tx.insert(r2UploadEvents).values({guildId:r.guildId,requestId:r.id,status:'Expired',occurredAt:new Date()});
      return tx.select().from(r2UploadRequests).where(and(eq(r2UploadRequests.status,'Expired'),sql`${r2UploadRequests.promptId} is not null`)).limit(25);
    });
  }
  async recover() {
    await this.db.transaction(async tx=> {
      const rows=await tx.update(r2UploadRequests).set({status:'PartiallyCompleted',errorCode:'R2_INTERRUPTED',completedAt:new Date()}).where(inArray(r2UploadRequests.status,['Uploading','Uploaded'])).returning();
      for(const r of rows) await tx.insert(r2UploadEvents).values({guildId:r.guildId,requestId:r.id,status:'PartiallyCompleted',code:'R2_INTERRUPTED',occurredAt:new Date()});
    });
    await this.db.update(r2UploadedObjects).set({status:'Unknown'}).where(eq(r2UploadedObjects.status,'Uploading'));
  }
}
