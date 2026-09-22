import { pbkdf2 } from '@noble/hashes/pbkdf2'
import { sha256 } from '@noble/hashes/sha256'
import { hmac } from '@noble/hashes/hmac'
import { gcm } from '@noble/ciphers/aes'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { Space, createSpace, validateSpace, clone } from './model'
const KEY='xiaojin.v2.vault'
const ATTEMPTS='xiaojin.v2.attempts'
// A six-digit PIN needs key stretching, but 210,000 SHA-256 rounds are too
// expensive for Harmony's JavaScript main thread. New slots use 10,000 rounds.
// Slots made by earlier builds omit `iterations` and keep using 210,000 until a
// successful UI unlock transparently upgrades that one slot.
const ITERATIONS=10000
const LEGACY_ITERATIONS=210000
// PBKDF2 is deliberately expensive. On Harmony, doing every round in one timer
// callback blocks the ArkUI main thread long enough for the watchdog to kill the
// app, so the UI-facing functions below calculate it in fixed, short slices.
// Do not use elapsed time here: ArkUI's tight-loop clock does not advance
// reliably enough to make a time-based yield a safe watchdog boundary.
const KDF_ROUNDS_PER_SLICE=256
type Envelope={nonce:string;data:string;iterations?:number}
type Vault={version:number;salt:string;slots:Record<string,Envelope>}
let activeKey:Uint8Array|null=null
let activeId=''
let activeSpaceId=''
let entropy:(length:number)=>string=(length)=>{const c=globalThis.crypto;if(!c?.getRandomValues)throw new Error('此平台的安全随机数服务尚不可用');return bytesToHex(c.getRandomValues(new Uint8Array(length)))}
export function setEntropy(provider:(length:number)=>string){entropy=provider}
function randomHex(length:number){const result=entropy(length);if(result.length!==length*2||!/^[0-9a-f]+$/i.test(result))throw new Error('安全随机数服务返回无效结果');return result}
const bytes=(s:string)=>new Uint8Array(Array.from(unescape(encodeURIComponent(s))).map(c=>c.charCodeAt(0)))
const decodeText=(b:Uint8Array):string=>decodeURIComponent(escape(Array.from(b).map(v=>String.fromCharCode(v)).join('')))!
function read():Vault|null {const raw=uni.getStorageSync(KEY);if(!raw)return null;try{const v=JSON.parse(raw) as Vault;if(!v||v.version!==2||typeof v.salt!=='string'||!/^[0-9a-f]{64}$/i.test(v.salt)||!v.slots||typeof v.slots!=='object'||Array.isArray(v.slots))throw 0;return v}catch{throw new Error('本地数据异常，原数据已保留。请从有效备份恢复。')}}
function write(v:Vault){try{uni.setStorageSync(KEY,JSON.stringify(v))}catch{throw new Error('保存失败，请检查设备存储空间后重试。原数据未修改。')}}
function slotIterations(envelope:Envelope|undefined):number{const value=envelope?.iterations;return typeof value==='number'&&Number.isInteger(value)&&value>=1000&&value<=LEGACY_ITERATIONS?value:LEGACY_ITERATIONS}
function candidateIterations(v:Vault):number[]{const result:number[]=[];for(const key in v.slots){const value=slotIterations(v.slots[key]);if(!result.includes(value))result.push(value)}if(!result.includes(ITERATIONS))result.push(ITERATIONS);return result}
function withoutSlot(slots:Record<string,Envelope>,removedId:string):Record<string,Envelope>{const result:Record<string,Envelope>={};for(const key in slots)if(key!==removedId)result[key]=slots[key];return result}
function derive(pin:string,salt:string,iterations=ITERATIONS){return pbkdf2(sha256,bytes(pin),hexToBytes(salt),{c:iterations,dkLen:32})}
function yieldToEventLoop():Promise<void>{return new Promise<void>(resolve=>{setTimeout(()=>resolve(),0)})}
async function deriveAsync(pin:string,salt:string,iterations=ITERATIONS):Promise<Uint8Array>{
  const password=bytes(pin),saltBytes=hexToBytes(salt),derived=new Uint8Array(32),block=new Uint8Array(4)
  const prf=hmac.create(sha256,password),prfSalt=prf._cloneInto().update(saltBytes),u=new Uint8Array(prf.outputLen)
  let prfWork:any=undefined
  try{
    for(let index=1,offset=0;offset<derived.length;index++,offset+=prf.outputLen){
      const target=derived.subarray(offset,offset+prf.outputLen)
      block[0]=(index>>>24)&255;block[1]=(index>>>16)&255;block[2]=(index>>>8)&255;block[3]=index&255
      prfWork=prfSalt._cloneInto(prfWork).update(block).digestInto(u)
      target.set(u.subarray(0,target.length))
      for(let round=1;round<iterations;round++){
        prfWork=prf._cloneInto(prfWork).update(u).digestInto(u)
        for(let byte=0;byte<target.length;byte++)target[byte]^=u[byte]
        if(round%KDF_ROUNDS_PER_SLICE===0)await yieldToEventLoop()
      }
    }
    return derived
  }catch(e){derived.fill(0);throw e}
  finally{password.fill(0);saltBytes.fill(0);block.fill(0);u.fill(0);prf.destroy();prfSalt.destroy();if(prfWork)prfWork.destroy()}
}
const slot=(k:Uint8Array)=>bytesToHex(hmac(sha256,k,bytes('xiaojin-space-v2')))
function seal(s:Space,k:Uint8Array,iterations=ITERATIONS):Envelope{const nonce=randomHex(12);return {nonce,data:bytesToHex(gcm(k,hexToBytes(nonce),bytes('xiaojin-v2')).encrypt(bytes(JSON.stringify(s)))),iterations}}
function open(e:Envelope,k:Uint8Array):Space{try{return validateSpace(JSON.parse(decodeText(gcm(k,hexToBytes(e.nonce),bytes('xiaojin-v2')).decrypt(hexToBytes(e.data)))))}catch{throw new Error('密码不正确或备份已损坏')}}
export function initialized(){return read()!==null}
export function lock(){activeKey?.fill(0);activeKey=null;activeId='';activeSpaceId=''}
export function remaining(){const raw=uni.getStorageSync(ATTEMPTS);if(!raw)return 0;try{const a=JSON.parse(raw) as {until:number};if(!a||!Number.isFinite(a.until))return 300;return Math.max(0,Math.ceil((a.until-Date.now())/1000))}catch{return 300}}
export function unlock(pin:string):Space{
  if(remaining()>0)throw new Error('尝试次数过多，请稍后重试')
  const v=read();if(!v)throw new Error('尚未创建数据空间')
  let k:Uint8Array|null=null,key='',envelope:Envelope|undefined
  for(const iterations of candidateIterations(v)){const candidate=derive(pin,v.salt,iterations);const candidateKey=slot(candidate),candidateEnvelope=v.slots[candidateKey];if(candidateEnvelope){k=candidate;key=candidateKey;envelope=candidateEnvelope;break}candidate.fill()}
  if(!k||!envelope){let count=0;try{const a=JSON.parse(uni.getStorageSync(ATTEMPTS)||'{"count":0}') as {count:number};if(a&&Number.isInteger(a.count)&&a.count>=0)count=a.count}catch{}count++;uni.setStorageSync(ATTEMPTS,JSON.stringify({count:count>=5?0:count,until:count>=5?Date.now()+300000:0}));throw new Error(count>=5?'尝试次数过多，请在 05:00 后重试':count>=3?`已连续输入错误 ${count} 次`:'密码不正确')}
  try{const s=open(envelope,k);uni.setStorageSync(ATTEMPTS,JSON.stringify({count:0,until:0}));lock();activeKey=k;activeId=key;activeSpaceId=s.id;return s}catch(e){k.fill(0);throw e}
}
export async function unlockAsync(pin:string):Promise<Space>{
  if(remaining()>0)throw new Error('尝试次数过多，请稍后重试')
  const v=read();if(!v)throw new Error('尚未创建数据空间')
  let k:Uint8Array|null=null,key='',envelope:Envelope|undefined
  for(const iterations of candidateIterations(v)){const candidate=await deriveAsync(pin,v.salt,iterations);const candidateKey=slot(candidate),candidateEnvelope=v.slots[candidateKey];if(candidateEnvelope){k=candidate;key=candidateKey;envelope=candidateEnvelope;break}candidate.fill()}
  if(!k||!envelope){let count=0;try{const a=JSON.parse(uni.getStorageSync(ATTEMPTS)||'{"count":0}') as {count:number};if(a&&Number.isInteger(a.count)&&a.count>=0)count=a.count}catch{}count++;uni.setStorageSync(ATTEMPTS,JSON.stringify({count:count>=5?0:count,until:count>=5?Date.now()+300000:0}));throw new Error(count>=5?'尝试次数过多，请在 05:00 后重试':count>=3?`已连续输入错误 ${count} 次`:'密码不正确')}
  try{const s=open(envelope,k);if(slotIterations(envelope)!==ITERATIONS){const upgraded=await deriveAsync(pin,v.salt);const upgradedId=slot(upgraded);if(!v.slots[upgradedId]){const nextSlots=withoutSlot(v.slots,key);nextSlots[upgradedId]=seal(s,upgraded);v.slots=nextSlots;write(v);k.fill();k=upgraded;key=upgradedId}else upgraded.fill()}uni.setStorageSync(ATTEMPTS,JSON.stringify({count:0,until:0}));lock();activeKey=k;activeId=key;activeSpaceId=s.id;return s}catch(e){k.fill();throw e}
}
export function register(name:string,privacy:boolean,pin:string, imported?:Space):Space{
  if(!/^\d{6}$/.test(pin))throw new Error('请设置 6 位数字密码')
  const v=read()||{version:2,salt:randomHex(32),slots:{}};const k=derive(pin,v.salt);const key=slot(k)
  if(v.slots[key]){k.fill(0);throw new Error('此密码不可用，请设置其他密码')}
  try{const s=imported?validateSpace(imported):createSpace(name,privacy);v.slots[key]=seal(s,k);write(v);lock();activeKey=k;activeId=key;activeSpaceId=s.id;return s}catch(e){k.fill(0);throw e}
}
export async function registerAsync(name:string,privacy:boolean,pin:string,imported?:Space):Promise<Space>{
  if(!/^\d{6}$/.test(pin))throw new Error('请设置 6 位数字密码')
  const v=read()||{version:2,salt:randomHex(32),slots:{}};const k=await deriveAsync(pin,v.salt);const key=slot(k)
  if(v.slots[key]){k.fill(0);throw new Error('此密码不可用，请设置其他密码')}
  try{const s=imported?validateSpace(imported):createSpace(name,privacy);v.slots[key]=seal(s,k);write(v);lock();activeKey=k;activeId=key;activeSpaceId=s.id;return s}catch(e){k.fill(0);throw e}
}
export function persist(s:Space){if(!activeKey||!activeId)throw new Error('会话已锁定，请重新输入密码');if(s.id!==activeSpaceId)throw new Error('不能写入其他数据空间');const v=read();if(!v||!v.slots[activeId])throw new Error('数据空间不存在');v.slots[activeId]=seal(validateSpace(s),activeKey);write(v)}
export function backup(s:Space):string{if(!activeKey||s.id!==activeSpaceId)throw new Error('请先解锁对应空间');const v=read()!;return JSON.stringify({format:'xiaojin-backup',version:2,salt:v.salt,createdAt:Date.now(),envelope:seal(validateSpace(s),activeKey)})}
export function inspectBackup(raw:string,pin:string):Space{if(raw.length>20*1024*1024)throw new Error('备份超过 20 MB，请拆分账本后重试');let v:any;try{v=JSON.parse(raw)}catch{throw new Error('无法读取备份，请选择完整的小金账备份文件')}if(v.format!=='xiaojin-backup'||v.version!==2||typeof v.salt!=='string'||v.salt.length!==64||!v.envelope)throw new Error('备份版本或格式不受支持');const k=derive(pin,v.salt,slotIterations(v.envelope as Envelope));try{return open(v.envelope,k)}finally{k.fill(0)}}
export async function inspectBackupAsync(raw:string,pin:string):Promise<Space>{if(raw.length>20*1024*1024)throw new Error('备份超过 20 MB，请拆分账本后重试');let v:any;try{v=JSON.parse(raw)}catch{throw new Error('无法读取备份，请选择完整的小金账备份文件')}if(v.format!=='xiaojin-backup'||v.version!==2||typeof v.salt!=='string'||v.salt.length!==64||!v.envelope)throw new Error('备份版本或格式不受支持');const k=await deriveAsync(pin,v.salt,slotIterations(v.envelope as Envelope));try{return open(v.envelope,k)}finally{k.fill(0)}}
export function snapshot(s:Space){try{uni.setStorageSync('xiaojin.v2.rollback.'+activeId,backup(s))}catch{throw new Error('恢复前快照保存失败，已取消恢复')}}
export function restoreSnapshot(pin:string):Space{const raw=uni.getStorageSync('xiaojin.v2.rollback.'+activeId);if(!raw)throw new Error('没有可回滚的恢复快照');return inspectBackup(raw,pin)}
export async function restoreSnapshotAsync(pin:string):Promise<Space>{const raw=uni.getStorageSync('xiaojin.v2.rollback.'+activeId);if(!raw)throw new Error('没有可回滚的恢复快照');return inspectBackupAsync(raw,pin)}
export function changePin(s:Space,oldPin:string,newPin:string){if(!activeKey||s.id!==activeSpaceId)throw new Error('请先解锁对应空间');if(!/^\d{6}$/.test(newPin))throw new Error('新密码须为 6 位数字');const v=read()!;const old=derive(oldPin,v.salt,slotIterations(v.slots[activeId]));if(slot(old)!==activeId){old.fill(0);throw new Error('当前密码不正确')}old.fill(0);const k=derive(newPin,v.salt);const key=slot(k);try{if(v.slots[key]&&key!==activeId)throw new Error('此密码不可用');const next=clone(v);next.slots=withoutSlot(next.slots,activeId);next.slots[key]=seal(validateSpace(s),k);const rollback=uni.getStorageSync('xiaojin.v2.rollback.'+activeId);if(rollback){const snapshot=inspectBackup(rollback,oldPin);uni.setStorageSync('xiaojin.v2.rollback.'+key,JSON.stringify({format:'xiaojin-backup',version:2,salt:v.salt,createdAt:Date.now(),envelope:seal(snapshot,k)}))}write(next);lock();activeKey=k;activeId=key;activeSpaceId=s.id}catch(e){k.fill(0);throw e}}
export async function changePinAsync(s:Space,oldPin:string,newPin:string):Promise<void>{if(!activeKey||s.id!==activeSpaceId)throw new Error('请先解锁对应空间');if(!/^\d{6}$/.test(newPin))throw new Error('新密码须为 6 位数字');const v=read()!;const old=await deriveAsync(oldPin,v.salt,slotIterations(v.slots[activeId]));if(slot(old)!==activeId){old.fill(0);throw new Error('当前密码不正确')}old.fill(0);const k=await deriveAsync(newPin,v.salt);const key=slot(k);try{if(v.slots[key]&&key!==activeId)throw new Error('此密码不可用');const next=clone(v);next.slots=withoutSlot(next.slots,activeId);next.slots[key]=seal(validateSpace(s),k);const rollback=uni.getStorageSync('xiaojin.v2.rollback.'+activeId);if(rollback){const snapshot=await inspectBackupAsync(rollback,oldPin);uni.setStorageSync('xiaojin.v2.rollback.'+key,JSON.stringify({format:'xiaojin-backup',version:2,salt:v.salt,createdAt:Date.now(),envelope:seal(snapshot,k)}))}write(next);lock();activeKey=k;activeId=key;activeSpaceId=s.id}catch(e){k.fill(0);throw e}}
