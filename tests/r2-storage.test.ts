import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { R2StorageService } from '../packages/core/src/r2-storage.js';
import { parseEnvironment } from '../packages/shared/src/environment.js';
import { r2SettingsSchema, fileDisposition } from '../packages/shared/src/r2.js';
const sdk=vi.hoisted(()=>({send:vi.fn(),options:vi.fn()}));
vi.mock('@aws-sdk/client-s3',()=>({S3Client:class {constructor(o:unknown){sdk.options(o);}send=sdk.send;destroy(){}},PutObjectCommand:class{constructor(public input:unknown){}},HeadObjectCommand:class{constructor(public input:unknown){}},HeadBucketCommand:class{constructor(public input:unknown){}},GetObjectCommand:class{constructor(public input:unknown){}}}));
vi.mock('@aws-sdk/s3-request-presigner',()=>({getSignedUrl:vi.fn(async()=> 'https://test.example/private')}));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfoQAAAAASUVORK5CYII=','base64');
const env=()=>parseEnvironment({DISCORD_BOT_TOKEN:'test',DISCORD_CLIENT_ID:'100000000000000001',DISCORD_OWNER_ID:'100000000000000002',DATABASE_URL:'postgresql://localhost/test',R2_ACCOUNT_ID:'a'.repeat(32),R2_ACCESS_KEY_ID:'offline',R2_SECRET_ACCESS_KEY:'offline',R2_BUCKET_NAME:'offline'});
const file={id:'100000000000000003',name:'image.png',size:png.length,contentType:'image/png'},url='https://cdn.discordapp.com/attachments/a/b/image.png';
let before:string[];
beforeEach(async()=>{before=(await readdir(tmpdir())).filter(x=>x.startsWith('pulsetools-r2-'));sdk.send.mockReset();sdk.options.mockClear();vi.stubGlobal('fetch',vi.fn(async()=>new Response(png,{headers:{'Content-Length':String(png.length)}})));});
afterEach(async()=>{vi.unstubAllGlobals();expect((await readdir(tmpdir())).filter(x=>x.startsWith('pulsetools-r2-')).sort()).toEqual(before.sort());});
it('下載串流、內容探測、指定 Key 上傳與 Head 比對；暫存清理',async()=>{
  sdk.send.mockResolvedValueOnce({}).mockResolvedValueOnce({ContentLength:png.length,ContentType:'image/png',Metadata:{sha256:createHash('sha256').update(png).digest('hex')}});
  const storage=new R2StorageService(env());expect(await storage.upload(file,url,'guild/key',r2SettingsSchema.parse({}))).toEqual({contentType:'image/png',size:png.length});
  expect(sdk.options.mock.calls[0]?.[0]).toMatchObject({maxAttempts:1,region:'auto'});
  expect(sdk.send.mock.calls[0]?.[0].input).toMatchObject({Key:'guild/key',ContentLength:png.length,IfNoneMatch:'*',ContentDisposition:'inline'});
  expect(await storage.link('guild/key','private')).toContain('/private');
});
it.each(['mime','extension','size','head'] as const)('拒絕 %s 不一致並清理暫存',async(kind)=>{
  sdk.send.mockResolvedValueOnce({}).mockResolvedValueOnce({ContentLength:0});const storage=new R2StorageService(env());
  const input={...file,...(kind==='mime'?{contentType:'application/pdf'}:{}),...(kind==='extension'?{name:'image.pdf'}:{}),...(kind==='size'?{size:1}: {})};
  await expect(storage.upload(input,url,'guild/key',r2SettingsSchema.parse({}))).rejects.toThrow();
  expect(sdk.send).toHaveBeenCalledTimes(kind==='head'?2:0);
});
it('拒絕外部來源，不發出請求；缺憑證不阻止建構',async()=>{
  const storage=new R2StorageService(env());await expect(storage.upload(file,'https://evil.test/file','key',r2SettingsSchema.parse({}))).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();
  const empty=new R2StorageService({...env(),R2_SECRET_ACCESS_KEY:undefined});expect(empty.configured).toBe(false);await expect(empty.test()).rejects.toThrow('R2_CONFIG_REQUIRED');
});

it('安全圖片可直接顯示，PDF／ZIP／未知類型維持下載',()=>{
  expect(fileDisposition('image/png')).toBe('inline');expect(fileDisposition('image/jpeg')).toBe('inline');
  expect(fileDisposition('image/svg+xml')).toBe('attachment');expect(fileDisposition('application/pdf')).toBe('attachment');expect(fileDisposition()).toBe('attachment');
});
it('Custom Domain 使用完整 Object Key，不附簽章；私人圖片仍覆寫為 inline',async()=>{
  const storage=new R2StorageService({...env(),R2_PUBLIC_BASE_URL:'https://cdn.example.test'});
  expect(await storage.link('guild/uploads/a b.png','public','image/png')).toBe('https://cdn.example.test/guild/uploads/a%20b.png');
  const {getSignedUrl}=await import('@aws-sdk/s3-request-presigner');await storage.link('guild/a.png','private','image/png');
  expect(vi.mocked(getSignedUrl).mock.calls.at(-1)?.[1].input).toMatchObject({ResponseContentDisposition:'inline'});
});
