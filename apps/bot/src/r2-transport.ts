import type { Actor } from '../../../packages/shared/src/models.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags, type Client, type ButtonInteraction } from 'discord.js';
import { createHash } from 'node:crypto';
import type { R2Transport, R2Service } from '../../../packages/core/src/r2-service.js';
import type { R2Request } from '../../../packages/core/src/r2-store.js';
import { pulseEmbed, allowedMentions } from '../../../packages/embed-system/src/index.js';
import { PulseError } from '../../../packages/shared/src/errors.js';
export class DiscordR2Transport implements R2Transport {
  constructor(private readonly client:Client) {}
  async actor(actor:Actor) {
    const member=await this.client.guilds.cache.get(actor.guildId)?.members.fetch({user:actor.userId,force:true});
    if(!member || member.user.bot) throw new PulseError('PERMISSION_DENIED');
    return {...actor,nativeAdministrator:member.permissions.has(PermissionFlagsBits.Administrator)};
  }
  private async channel(guildId:string,id:string) {
    const guild=this.client.guilds.cache.get(guildId),channel=await guild?.channels.fetch(id),me=await guild?.members.fetchMe({force:true});
    if(!channel || !channel.isTextBased() || !('send' in channel) || !me || !channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.EmbedLinks,PermissionFlagsBits.ReadMessageHistory])) throw new PulseError('PERMISSION_DENIED');
    return {channel,me};
  }
  private nonce(id:string,purpose:string) {return BigInt('0x'+createHash('sha256').update(id+purpose).digest('hex').slice(0,16)).toString();}
  async prompt(request:R2Request,canDelete:boolean) {
    const {channel}=await this.channel(request.guildId,request.channelId);
    const row=new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`r2:keep:${request.id}`).setLabel('上傳並保留原訊息').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`r2:delete:${request.id}`).setLabel('上傳並刪除原訊息').setStyle(ButtonStyle.Danger).setDisabled(!canDelete),
      new ButtonBuilder().setCustomId(`r2:cancel:${request.id}`).setLabel('取消上傳').setStyle(ButtonStyle.Secondary));
    return (await channel.send({embeds:[pulseEmbed({title:'雲端檔案上傳',kind:'r2',timestamp:request.createdAt,description:`上傳者：${request.uploaderId}\nRequest ID：${request.id}\n檔案數：${request.attachments.length}\n${request.attachments.map(f=>`${f.name} · ${f.size} bytes`).join('\n')}\n確認期限：${request.expiresAt.toISOString()}\n是否上傳 Cloudflare R2？${request.settings.access==='private'?'私人連結有效一小時；保留原訊息。':''}\n${canDelete?'刪除會連同原訊息文字一起移除。':'刪除未開放：需永久公開連結、Guild 政策及 Manage Messages 權限。'}`})],components:[row],allowedMentions,reply:{messageReference:request.messageId,failIfNotExists:true},nonce:this.nonce(request.id,'prompt'),enforceNonce:true})).id;
  }
  async fresh(request:R2Request) {
    const {channel,me}=await this.channel(request.guildId,request.channelId);
    const message=await channel.messages.fetch({message:request.messageId,force:true});
    if(message.author.id!==request.uploaderId || message.author.bot) throw new PulseError('INVALID_INPUT');
    return {canDelete:channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageMessages)??false,files:message.attachments.map(f=>({id:f.id,name:f.name,size:f.size,contentType:f.contentType,url:f.url}))};
  }
  async result(request:R2Request,links:{name:string;url:string}[]) {
    const {channel}=await this.channel(request.guildId,request.settings.resultChannelId??request.channelId);
    return (await channel.send({embeds:links.map(link=>pulseEmbed({title:link.name,kind:'success',description:`雲端檔案上傳\nRequest ID：${request.id}\n上傳者：${request.uploaderId}\n來源訊息：${request.messageId}\n${request.settings.access==='private'?'私人下載連結一小時後到期，可由檔案紀錄重新取得。':'點擊標題下載檔案。'}`}).setURL(link.url)),allowedMentions,nonce:this.nonce(request.id,'result'),enforceNonce:true})).id;
  }
  async deleteOriginal(request:R2Request) {
    const {channel,me}=await this.channel(request.guildId,request.channelId);
    if(!channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageMessages)) throw new PulseError('PERMISSION_DENIED');
    const message=await channel.messages.fetch({message:request.messageId,force:true});
    if(message.author.id!==request.uploaderId || message.author.bot) throw new PulseError('INVALID_INPUT');
    await message.delete();
  }
  async disable(request:R2Request) {
    if(!request.promptId) return;
    const {channel}=await this.channel(request.guildId,request.channelId);
    const message=await channel.messages.fetch(request.promptId);
    await message.edit({components:[]});
  }
  async verifyLink(url:string) {
    const response=await fetch(url,{headers:{Range:'bytes=0-0'},redirect:'error',signal:AbortSignal.timeout(10000)});
    await response.body?.cancel(); if(!response.ok) throw new Error('R2_LINK_UNAVAILABLE');
  }
}
export async function r2Button(interaction:ButtonInteraction,service:R2Service) {
  try {
    await interaction.deferReply({flags:MessageFlags.Ephemeral});
    const [,choice,id]=interaction.customId.split(':');
    if(!interaction.guildId || !id || !['keep','delete','cancel'].includes(choice??'')) throw new PulseError('INVALID_INPUT');
    const guild=interaction.guild,member=await guild?.members.fetch({user:interaction.user.id,force:true});
    if(!member) throw new PulseError('PERMISSION_DENIED');
    const description=await service.choose({guildId:interaction.guildId,userId:interaction.user.id,nativeAdministrator:member.permissions.has(PermissionFlagsBits.Administrator)},id,interaction.channelId,interaction.message.id,choice as 'keep'|'delete'|'cancel');
    await interaction.editReply({embeds:[pulseEmbed({title:'雲端檔案上傳',description,kind:'r2'})],allowedMentions});
  } catch(error) {
    try {await interaction.editReply({embeds:[pulseEmbed({title:'雲端檔案上傳',description:error instanceof PulseError?error.message:'流程未完成，原訊息不會因重試被自動刪除。請查看檔案紀錄。',kind:'error'})],allowedMentions});} catch {console.error('[PulseTools] R2_REPLY_FAILED');}
  }
}
