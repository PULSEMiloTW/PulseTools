import type { ChatInputCommandInteraction } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';
import type { Actor } from '../../../packages/shared/src/models.js';
import type { R2Service } from '../../../packages/core/src/r2-service.js';
import { r2SettingsSchema, r2FileTypes } from '../../../packages/shared/src/r2.js';
import { PulseError } from '../../../packages/shared/src/errors.js';
import { formatTimestamp } from '../../../packages/shared/src/timestamp.js';
import { z } from 'zod';
export async function r2Command(interaction:ChatInputCommandInteraction,actor:Actor,service:R2Service) {
  const sub=interaction.options.getSubcommand(),group=interaction.options.getSubcommandGroup(false),settings=await service.store.settings(actor.guildId);
  if(group==='file') await service.core.permissions.requireGuild(actor.guildId); else await service.core.permissions.requireAdmin(actor);
  const timezone=(await service.core.repository.guild(actor.guildId))?.configuration.timezone??'Asia/Taipei';
  if(sub==='status') return `R2 憑證：${service.storage.configured?'已設定':'未設定'}\n模組：${await service.core.modules.enabled(actor.guildId,'PT-10')?'啟用':'停用'}\n模式：${settings.access}\n監聽頻道：${settings.channels.join(', ')||'無'}\n刪除政策：${settings.allowDelete}\n最大檔案：${settings.maxBytes} bytes × ${settings.maxFiles}\n類型：${settings.allowedTypes.join(', ')}\n確認期限：${settings.promptSeconds} 秒`;
  if(group==='channel') {
    if(sub==='list') return settings.channels.join('\n')||'沒有監聽頻道。';
    await service.core.permissions.requireAdmin(actor,true);
    const channel=interaction.options.getChannel('channel',true),guildChannel=await interaction.guild?.channels.fetch(channel.id),me=await interaction.guild?.members.fetchMe({force:true});
    if(!guildChannel || !guildChannel.isTextBased() || guildChannel.isThread() || !me || !guildChannel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.EmbedLinks,PermissionFlagsBits.ReadMessageHistory])) throw new PulseError('PERMISSION_DENIED');
    await service.store.setSettings(actor.guildId,r2SettingsSchema.parse({...settings,channels:sub==='add'?[...new Set([...settings.channels,channel.id])]:settings.channels.filter(id=>id!==channel.id)}));
    return '監聽頻道已更新。只有啟用 PT-10 且確認後才上傳。';
  }
  if(sub==='config') {
    const changes:Record<string,unknown>={};
    for(const [option,key] of [['max_mb','maxBytes'],['max_files','maxFiles'],['prompt_seconds','promptSeconds']] as const) {const value=interaction.options.getInteger(option); if(value!==null) changes[key]=key==='maxBytes'?value*1024*1024:value;}
    for(const [option,key] of [['allow_delete','allowDelete'],['members','membersMayUpload']] as const) {const value=interaction.options.getBoolean(option);if(value!==null)changes[key]=value;}
    for(const key of ['access','prefix'] as const) {const value=interaction.options.getString(key);if(value!==null)changes[key]=value;}
    const types=interaction.options.getString('types');if(types!==null) changes.allowedTypes=types.split(',').map(s=>s.trim());
    const resultChannel=interaction.options.getChannel('result_channel');
    if(resultChannel) {const channel=await interaction.guild?.channels.fetch(resultChannel.id),me=await interaction.guild?.members.fetchMe({force:true});if(!channel || !channel.isTextBased() || channel.isThread() || !me || !channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.EmbedLinks,PermissionFlagsBits.ReadMessageHistory])) throw new PulseError('INVALID_INPUT');changes.resultChannelId=resultChannel.id;}
    if(!Object.keys(changes).length) return `${JSON.stringify(settings,null,2)}\n可用類型：${r2FileTypes.join(', ')}`;
    await service.core.permissions.requireAdmin(actor,true);
    const next=r2SettingsSchema.parse({...settings,...changes});
    if(next.access==='public' && !service.storage.publicAvailable || next.allowDelete && next.access!=='public') throw new PulseError('INVALID_INPUT');
    await service.store.setSettings(actor.guildId,next); return 'R2 上傳政策已更新。憑證只從本機 .env 讀取。';
  }
  if(sub==='test') {await service.core.permissions.requireAdmin(actor,true);await service.storage.test();return '指定 Bucket 連線檢查通過（HeadBucket）；未上傳或刪除物件。';}
  if(sub==='files') return (await service.store.files(actor.guildId)).map(r=>`${r.id} · ${r.status} · ${r.uploaderId} · ${formatTimestamp(r.createdAt,timezone)}（${timezone}）`).join('\n')||'尚無上傳請求。';
  const id=interaction.options.getString('id',true);if(!z.uuid().safeParse(id).success)throw new PulseError('INVALID_INPUT');
  const request=await service.store.get(actor.guildId,id);if(!request)throw new PulseError('INVALID_INPUT');
  if(request.uploaderId!==actor.userId) await service.core.permissions.requireAdmin(actor);
  const lines=[`Request ID：${id}`,`上傳者：${request.uploaderId}`,`來源：${request.channelId} / ${request.messageId}`,`狀態：${request.status}`,`時間：${formatTimestamp(request.createdAt,timezone)}（${timezone}）`,`開始時間：${request.startedAt?.toISOString()??'尚未開始'}`,`完成時間：${request.completedAt?.toISOString()??'尚未完成'}`,`刪除時間：${request.deletedAt?.toISOString()??'未刪除'}`,`錯誤碼：${request.errorCode??'無'}`];
  const links = [];
  for(const file of await service.store.objects(actor.guildId,id)) {
    lines.push(`${file.filename} · ${file.status} · ${file.size} bytes · ${file.contentType}\nObject Key：${file.key}\n上傳時間：${file.uploadedAt?.toISOString()??'尚未確認'}`);
    if(file.status==='Uploaded') links.push({name:file.filename,url:await service.storage.link(file.key,request.settings.access)});
  }
  return {description:lines.join('\n'),links};
}
