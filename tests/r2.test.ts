import { beforeEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createCore } from '../packages/core/src/index.js';
import { MemoryRepository } from './helpers/memory-repository.js';
import { R2Service, type R2Transport } from '../packages/core/src/r2-service.js';
import type { R2Store, R2Request, R2Object } from '../packages/core/src/r2-store.js';
import type { R2Storage } from '../packages/core/src/r2-storage.js';
import { r2SettingsSchema, attachmentUrl, safeFilename, acceptedAttachment } from '../packages/shared/src/r2.js';
const owner='100000000000000001',user='100000000000000002',guild='200000000000000001',channel='300000000000000001',message='400000000000000001',prompt='400000000000000002';
const attachment={id:'500000000000000001',name:'test.png',size:100,contentType:'image/png'};
let requests:R2Request[],objects:R2Object[],service:R2Service,transport:R2Transport,storage:R2Storage,store:R2Store,repository:MemoryRepository;
beforeEach(async()=>{
  requests=[];objects=[];repository=new MemoryRepository();const core=createCore(repository,owner,true,true,true);await core.guilds.setAuthorization(owner,guild,'test',true);await core.modules.setEnabled({userId:owner,guildId:guild,nativeAdministrator:true},'PT-10',true);
  const settings=r2SettingsSchema.parse({channels:[channel]});
  store={allowed:vi.fn(async()=>true),accessList:vi.fn(async()=>[]),setAllowed:vi.fn(async()=>{}),settings:vi.fn(async()=>settings),setSettings:vi.fn(),create:vi.fn(async(input)=>{if(requests.some(r=>r.messageId===input.messageId&&r.guildId===input.guildId))return;const r:R2Request={...input,id:randomUUID(),status:'Pending',choice:null,promptId:null,resultId:null,actorId:null,errorCode:null,createdAt:new Date(),expiresAt:new Date(Date.now()+300000),startedAt:null,completedAt:null,deletedAt:null};requests.push(r);return r;}),get:vi.fn(async(g,id)=>requests.find(r=>r.guildId===g&&r.id===id)),prompt:vi.fn(async(g,id,p)=>{const r=requests.find(r=>r.guildId===g&&r.id===id)!;r.promptId=p;}),claim:vi.fn(async(g,id,c,a)=>{const r=requests.find(r=>r.guildId===g&&r.id===id&&r.status==='Pending'&&r.expiresAt>new Date());if(r){r.status=c==='cancel'?'Cancelled':'Uploading';r.choice=c;r.actorId=a;return {...r};}}),state:vi.fn(async(g,id,s,e,result,deleted)=>{const r=requests.find(r=>r.guildId===g&&r.id===id)!;r.status=s;r.errorCode=e??r.errorCode;r.resultId=result??r.resultId;r.deletedAt=deleted??r.deletedAt;}),object:vi.fn(async(o)=>{const previous=objects.findIndex(x=>x.id===o.id);if(previous>=0)objects[previous]={...o,createdAt:new Date()};else objects.push({...o,createdAt:new Date()});}),objects:vi.fn(async(g,id)=>objects.filter(o=>o.guildId===g&&o.requestId===id)),files:vi.fn(async()=>requests),expire:vi.fn(async()=>[]),recover:vi.fn()};
  transport={actor:vi.fn(async(a)=>a),prompt:vi.fn(async()=>prompt),fresh:vi.fn(async()=>({canDelete:true,files:[{...attachment,url:'https://cdn.discordapp.com/attachments/a/b/test.png'}]})),result:vi.fn(async()=>message),deleteOriginal:vi.fn(async()=>{}),disable:vi.fn(async()=>{}),verifyLink:vi.fn(async()=>{})};
  storage={configured:true,publicAvailable:true,upload:vi.fn(async()=>({contentType:'image/png',size:100})),link:vi.fn(async()=> 'https://files.example.test/file'),test:vi.fn()};service=new R2Service(core,store,storage,transport,vi.fn());
});
async function offer(){await service.offer({guildId:guild,channelId:channel,messageId:message,uploaderId:user,attachments:[attachment]},true);return requests[0]!;}
const actor=(id=user,g=guild)=>({userId:id,guildId:g,nativeAdministrator:false});
it('預設私人、無頻道、保留原訊息；來源與檔名驗證',()=>{
  expect(r2SettingsSchema.parse({})).toMatchObject({access:'private',allowDelete:false,channels:[]});
  expect(()=>attachmentUrl('https://localhost/file')).toThrow();expect(()=>attachmentUrl('https://cdn.discordapp.com.evil.test/attachments/a')).toThrow();expect(()=>attachmentUrl('https://cdn.discordapp.com/attachments/a')).not.toThrow();
  expect(safeFilename('../@檔案.png')).not.toContain('/');expect(acceptedAttachment({...attachment,name:'x.exe'},r2SettingsSchema.parse({}))).toBe(false);
});
it('未監聽頻道、不合規類型、重複事件不產生新詢問；確認前不下載',async()=>{
  await service.offer({guildId:guild,channelId:'300000000000000002',messageId:message,uploaderId:user,attachments:[attachment]},true);expect(requests).toHaveLength(0);
  await service.offer({guildId:guild,channelId:channel,messageId:message,uploaderId:user,attachments:[{...attachment,name:'bad.exe'}]},true);expect(requests).toHaveLength(0);
  await offer();await offer();expect(requests).toHaveLength(1);expect(transport.prompt).toHaveBeenCalledTimes(1);expect(storage.upload).not.toHaveBeenCalled();
});
it('取消不下載、不上傳、不刪除；私人模式拒絕刪除',async()=>{
  const r=await offer();await expect(service.choose(actor(),r.id,channel,prompt,'delete')).rejects.toMatchObject({code:'INVALID_INPUT'});
  await service.choose(actor(),r.id,channel,prompt,'cancel');expect(r.status).toBe('Cancelled');expect(storage.upload).not.toHaveBeenCalled();expect(transport.deleteOriginal).not.toHaveBeenCalled();
});
it('他人、錯誤頻道、錯誤按鈕訊息與跨 Guild 不得操作',async()=>{
  const r=await offer();await expect(service.choose(actor(owner),r.id,channel,message,'keep')).rejects.toMatchObject({code:'INVALID_INPUT'});
  await expect(service.choose(actor('100000000000000009'),r.id,channel,prompt,'keep')).rejects.toMatchObject({code:'PERMISSION_DENIED'});
  await expect(service.choose(actor(),r.id,'300000000000000002',prompt,'keep')).rejects.toMatchObject({code:'INVALID_INPUT'});
  await expect(service.choose(actor(user,'200000000000000002'),r.id,channel,prompt,'keep')).rejects.toMatchObject({code:'GUILD_DENIED'});expect(storage.upload).not.toHaveBeenCalled();
});
it('私人上傳成功保留原訊息，並行點擊只上傳一次',async()=>{
  const r=await offer();await Promise.all([service.choose(actor(),r.id,channel,prompt,'keep'),service.choose(actor(),r.id,channel,prompt,'keep')]);
  expect(r.status).toBe('Completed');expect(storage.upload).toHaveBeenCalledTimes(1);expect(objects[0]?.status).toBe('Uploaded');expect(transport.result).toHaveBeenCalledTimes(1);expect(transport.deleteOriginal).not.toHaveBeenCalled();
});
async function publicOffer(){vi.mocked(store.settings).mockResolvedValue(r2SettingsSchema.parse({channels:[channel],access:'public',allowDelete:true}));return offer();}
it('全部 Object 與連結驗證及替代訊息成功後才刪除',async()=>{
  const order:string[]=[];vi.mocked(storage.upload).mockImplementation(async()=>{order.push('upload');return{contentType:'image/png',size:100};});vi.mocked(transport.verifyLink).mockImplementation(async()=>{order.push('link');});vi.mocked(transport.result).mockImplementation(async()=>{order.push('result');return message;});vi.mocked(transport.deleteOriginal).mockImplementation(async()=>{order.push('delete');});
  const r=await publicOffer();await service.choose(actor(),r.id,channel,prompt,'delete');expect(order).toEqual(['upload','link','result','delete']);expect(r.deletedAt).toBeInstanceOf(Date);expect(repository.events.some(e=>e.action==='r2.delete.authorized'&&e.details.requestId===r.id)).toBe(true);
});
it.each(['upload','link','result'] as const)('%s 失敗保留原訊息，請求不可重傳',async(stage)=>{
  const r=await publicOffer();if(stage==='upload')vi.mocked(storage.upload).mockRejectedValue(new Error('secret'));if(stage==='link')vi.mocked(transport.verifyLink).mockRejectedValue(new Error('secret'));if(stage==='result')vi.mocked(transport.result).mockRejectedValue(new Error('secret'));
  await service.choose(actor(),r.id,channel,prompt,'delete');expect(r.status).toBe('PartiallyCompleted');expect(transport.deleteOriginal).not.toHaveBeenCalled();await service.choose(actor(),r.id,channel,prompt,'delete');expect(storage.upload).toHaveBeenCalledTimes(1);expect(JSON.stringify(requests)).not.toContain('secret');
});
it('多附件第二檔失敗保留原訊息與各檔 Object 狀態',async()=>{
  const r=await publicOffer();r.attachments.push({...attachment,id:'500000000000000002',name:'two.png'});vi.mocked(transport.fresh).mockResolvedValue({canDelete:true,files:r.attachments.map(f=>({...f,url:'https://cdn.discordapp.com/attachments/a/b/a.png'}))});vi.mocked(storage.upload).mockResolvedValueOnce({contentType:'image/png',size:100}).mockRejectedValueOnce(new Error('fail'));
  await service.choose(actor(),r.id,channel,prompt,'delete');expect(objects.map(o=>o.status)).toEqual(['Uploaded','Unknown']);expect(transport.result).not.toHaveBeenCalled();expect(transport.deleteOriginal).not.toHaveBeenCalled();
});
it('附件變更、刪除權限消失、Lockdown 及政策變更不執行上傳',async()=>{
  const r=await publicOffer();vi.mocked(transport.fresh).mockResolvedValue({canDelete:false,files:[]});await service.choose(actor(),r.id,channel,prompt,'delete');expect(storage.upload).not.toHaveBeenCalled();
  await repository.setLockdown(true,owner);await expect(service.choose(actor(),r.id,channel,prompt,'keep')).rejects.toMatchObject({code:'LOCKDOWN'});
});

it('過期確認、停用頻道、政策改為私人均不能完成舊公開請求',async()=>{
  const r=await publicOffer();r.expiresAt=new Date(Date.now()-1);expect(await service.choose(actor(),r.id,channel,prompt,'keep')).toContain('過期');expect(storage.upload).not.toHaveBeenCalled();
  r.expiresAt=new Date(Date.now()+10000);vi.mocked(store.settings).mockResolvedValue(r2SettingsSchema.parse({channels:[]}));await expect(service.choose(actor(),r.id,channel,prompt,'keep')).rejects.toMatchObject({code:'MODULE_UNAVAILABLE'});
});
it('上傳期間政策撤銷會停止結果發送及刪除',async()=>{
  const r=await publicOffer();vi.mocked(storage.upload).mockImplementation(async()=>{vi.mocked(store.settings).mockResolvedValue(r2SettingsSchema.parse({channels:[channel],access:'private'}));return{size:100,contentType:'image/png'};});
  await service.choose(actor(),r.id,channel,prompt,'delete');expect(r.status).toBe('PartiallyCompleted');expect(transport.result).not.toHaveBeenCalled();expect(transport.deleteOriginal).not.toHaveBeenCalled();
});
it('刪除 API 失敗保留已驗證檔案與替代訊息，沒有重試',async()=>{
  const r=await publicOffer();vi.mocked(transport.deleteOriginal).mockRejectedValue(new Error('timeout'));
  await service.choose(actor(),r.id,channel,prompt,'delete');expect(r.status).toBe('PartiallyCompleted');expect(r.resultId).toBe(message);expect(objects[0]?.status).toBe('Uploaded');expect(r.deletedAt).toBeNull();
  await service.choose(actor(),r.id,channel,prompt,'delete');expect(transport.deleteOriginal).toHaveBeenCalledTimes(1);
});
it('過期請求停用按鈕，即使 UI 編輯失敗仍不開放重傳',async()=>{
  const r=await offer();r.status='Expired';vi.mocked(store.expire).mockResolvedValue([r]);vi.mocked(transport.disable).mockRejectedValue(new Error('missing'));
  await service.expire();expect(r.promptId).toBeNull();expect(storage.upload).not.toHaveBeenCalled();
});

it('未在手動名單的人不產生詢問，Owner 亦無隱含上傳權限',async()=>{
  vi.mocked(store.allowed).mockResolvedValue(false);
  await offer();expect(requests).toHaveLength(0);expect(transport.prompt).not.toHaveBeenCalled();expect(storage.upload).not.toHaveBeenCalled();
});
it('只有 Owner 可管理名單，Guild Admin 無法自行加入或查看名單',async()=>{
  await expect(service.setAccess(actor(user),user,true)).rejects.toMatchObject({code:'OWNER_REQUIRED'});
  await service.setAccess(actor(owner),user,true);expect(store.setAllowed).toHaveBeenCalledWith(guild,user,true,owner);
  await expect(service.accessList(actor(user))).rejects.toMatchObject({code:'OWNER_REQUIRED'});
  await repository.setLockdown(true,owner);await expect(service.setAccess(actor(owner),user,false)).rejects.toMatchObject({code:'LOCKDOWN'});
});
it('撤銷後舊 Pending 按鈕不可使用；授權 Admin 也需列在名單',async()=>{
  const r=await offer();vi.mocked(store.allowed).mockResolvedValue(false);
  await expect(service.choose(actor(),r.id,channel,prompt,'keep')).rejects.toMatchObject({code:'PERMISSION_DENIED'});
  await expect(service.choose(actor(owner),r.id,channel,prompt,'keep')).rejects.toMatchObject({code:'PERMISSION_DENIED'});expect(storage.upload).not.toHaveBeenCalled();
});
it('上傳過程撤銷上傳者名單，停止結果與刪除',async()=>{
  const r=await publicOffer();vi.mocked(storage.upload).mockImplementation(async()=>{vi.mocked(store.allowed).mockResolvedValue(false);return{size:100,contentType:'image/png'};});
  await service.choose(actor(),r.id,channel,prompt,'delete');expect(r.status).toBe('PartiallyCompleted');expect(transport.result).not.toHaveBeenCalled();expect(transport.deleteOriginal).not.toHaveBeenCalled();
});
