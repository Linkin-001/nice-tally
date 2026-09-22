export type Kind = 'expense' | 'income' | 'transfer'
export type Entity = { id: string; name: string; kind: string; icon: string; color: string; enabled: boolean; parentId: string; note: string }
export type Field = { id: string; name: string; type: string; options: string[]; required: boolean; enabled: boolean; deleted: boolean; searchable: boolean; filterable: boolean; statistical: boolean; defaultValue: string; kinds: string[]; categoryId: string; conditionField: string; conditionValue: string; order: number }
export type Transaction = { id: string; bookId: string; kind: Kind; cents: number; categoryId: string; objectId: string; accountId: string; toAccountId: string; date: string; note: string; values: Record<string, string>; draft: boolean; createdAt: number; updatedAt: number }
export type Report = { id: string; name: string; bookIds: string[]; metric: string; valueField?: string; dimension: string; kind: string; chart: string; period: string; categoryId: string; top: number; order: string }
export type Book = { id: string; name: string; icon: string; color: string; type: string; currency: string; archived: boolean; createdAt: number; entities: Entity[]; fields: Field[]; reports: Report[]; budget: number }
export type Space = { version: number; id: string; name: string; private: boolean; createdAt: number; defaultBookId: string; theme: string; books: Book[]; transactions: Transaction[]; entry: string; autoLock: number }
export const themes = [{ name: '珊瑚粉', color: '#F56B87' }, { name: '湖蓝', color: '#479DD8' }, { name: '薄荷绿', color: '#38B69A' }, { name: '紫罗兰', color: '#9275D9' }, { name: '暖橙', color: '#EC9B51' }, { name: '石墨', color: '#526073' }]
export const fieldTypes = ['文本', '数字', '金额', '单选', '多选', '日期', '日期时间', '开关', '图片', '文件', '星级', '对象引用']
export const nowDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
let sequence = 0
export const id = () => `${Date.now().toString(36)}-${(++sequence).toString(36)}`
export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
export const money = (n: number) => (n / 100).toFixed(2)
export function cents(s: string): number { if (!/^\d{1,8}(\.\d{1,2})?$/.test(s.trim())) throw new Error('请输入有效金额，最多两位小数'); const [a,b = ''] = s.trim().split('.'); return Number(a) * 100 + Number((b + '00').slice(0,2)) }
export function createSpace(name: string, privacy: boolean): Space { return { version: 2, id: id(), name: name.trim() || '我的空间', private: privacy, createdAt: Date.now(), defaultBookId: '', theme: themes[0].color, books: [], transactions: [], entry: 'password', autoLock: 0 } }
export function createBook(name: string, color: string, type: string, currency: string): Book {
  if (!name.trim() || name.trim().length > 20) throw new Error('账本名称为 1–20 个字')
  const entities: Entity[] = []
  for (const [kind, names] of [['expense', ['餐饮','购物','交通','住房','日用','医疗','教育','娱乐','人情','旅行','宠物','其他']], ['income',['工资','奖金','理财','其他收入']], ['account',['现金','微信','支付宝','银行卡']]] as [string,string[]][]) names.forEach((n,i) => entities.push({ id:id(), name:n, kind, icon: ['dining','shopping','transport','home'][i % 4], color: themes[i % themes.length].color, enabled:true, parentId:'', note:'' }))
  return { id:id(), name:name.trim(), icon:'book', color, type, currency, archived:false, createdAt:Date.now(), entities, fields:[], reports:[], budget:0 }
}
export function currentBook(s: Space, bookId: string): Book { const b = s.books.find(v => v.id === bookId); if (!b) throw new Error('账本不存在或不属于当前空间'); return b }
export const label = (b: Book, entityId: string) => b.entities.find(e => e.id === entityId)?.name || '未设置'
export const recordTitle = (b: Book, t: Transaction) => t.kind === 'transfer' ? `${label(b,t.accountId)} → ${label(b,t.toAccountId)}` : label(b,t.categoryId)
export function fieldVisible(f: Field, t: Transaction, fields:Field[] = []): boolean { if(!f.enabled||f.deleted||(f.kinds.length>0&&!f.kinds.includes(t.kind))||(f.categoryId&&f.categoryId!==t.categoryId))return false;if(!f.conditionField)return true;const parent=fields.find(v=>v.id===f.conditionField);if(parent&&(parent.order>=f.order||!fieldVisible(parent,t,fields)))return false;return String(f.conditionField==='category'?t.categoryId:f.conditionField==='account'?t.accountId:t.values[f.conditionField]||'')===f.conditionValue }
export function newTransaction(b: Book): Transaction { const t: Transaction = { id:id(), bookId:b.id, kind:'expense', cents:0, categoryId:'', objectId:'', accountId:'', toAccountId:'', date:nowDate(), note:'', values:{}, draft:false, createdAt:Date.now(), updatedAt:Date.now() }; b.fields.forEach(f => t.values[f.id] = f.defaultValue); return t }
export function validateTransaction(b: Book, t: Transaction): void {
  if (b.archived) throw new Error('归档账本不能新增或修改记录，请先恢复账本')
  if (t.draft) return
  if (!Number.isSafeInteger(t.cents) || t.cents <= 0 || t.cents > 9999999999) throw new Error('金额必须大于 0，且不超过 99999999.99')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date) || new Date(t.date + 'T12:00:00').toISOString().slice(0,10) !== t.date) throw new Error('日期无效')
  const entity = (v: string, k: string) => b.entities.some(e => e.id === v && e.kind === k)
  if (t.kind === 'transfer') { if (!entity(t.accountId,'account') || !entity(t.toAccountId,'account') || t.accountId === t.toAccountId) throw new Error('请选择两个不同的转出和转入账户') }
  else if (!entity(t.categoryId, t.kind)) throw new Error('请选择分类')
  if (t.accountId && !entity(t.accountId,'account')) throw new Error('支付账户不存在')
  if (t.objectId && !entity(t.objectId,'object')) throw new Error('往来对象不存在')
  for (const f of b.fields.filter(f => fieldVisible(f,t,b.fields))) {
    const value = t.values[f.id] || ''
    if (f.required && !value.trim()) throw new Error(`请填写${f.name}`)
    if (value && ['数字','金额','星级'].includes(f.type) && (!Number.isFinite(Number(value)) || (f.type === '星级' && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 5)))) throw new Error(`${f.name}格式不正确`)
    if(value&&f.type==='金额'&&!/^-?\d{1,8}(\.\d{1,2})?$/.test(value))throw new Error(`${f.name}最多保留两位小数`)
    if(value&&f.type==='开关'&&!['是','否'].includes(value))throw new Error(`${f.name}应为是或否`)
    if(value&&['日期','日期时间'].includes(f.type)){const date=value.slice(0,10);const d=new Date(date+'T12:00:00');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date||(f.type==='日期时间'&&!/^\d{4}-\d{2}-\d{2} ([01]\d|2[0-3]):[0-5]\d$/.test(value)))throw new Error(`${f.name}日期格式不正确`)}
  }
}
export function saveTransaction(s: Space, t: Transaction): void { const b = currentBook(s,t.bookId); validateTransaction(b,t); t.updatedAt = Date.now(); const i = s.transactions.findIndex(v => v.id === t.id); if (i < 0) s.transactions.push(clone(t)); else s.transactions[i] = clone(t) }
export function summary(records: Transaction[]) { let income=0, expense=0; records.filter(t => !t.draft).forEach(t => { if(t.kind === 'income') income += t.cents; if(t.kind === 'expense') expense += t.cents }); return {income, expense, net:income-expense, count:records.filter(t=>!t.draft).length} }
export function query(s: Space, bookIds: string[], period: string, kind = 'all', categoryId = '', search = ''): Transaction[] {
  const allowed = s.books.filter(b=>bookIds.includes(b.id)).map(b=>b.id)
  return s.transactions.filter(t => { if(!allowed.includes(t.bookId) || t.draft || (kind!=='all' && t.kind!==kind) || (period!=='all' && !t.date.startsWith(period)) || (categoryId && t.categoryId!==categoryId)) return false; if(!search) return true; const b=currentBook(s,t.bookId); const values = b.fields.filter(f=>f.searchable).map(f=>t.values[f.id]||''); return [t.note,t.date,label(b,t.categoryId),label(b,t.objectId),label(b,t.accountId),...values].join(' ').toLowerCase().includes(search.toLowerCase()) }).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt)
}
export function newReport(b: Book): Report { return {id:id(),name:'本月分类支出',bookIds:[b.id],metric:'sum',dimension:'category',kind:'expense',chart:'donut',period:nowDate().slice(0,7),categoryId:'',top:10,order:'desc'} }
export function aggregate(s: Space, r: Report): { name:string; value:number; ids:string[] }[] {
  if(r.metric!=='count' && new Set(s.books.filter(b=>r.bookIds.includes(b.id)).map(b=>b.currency)).size>1) return []
  const records=query(s,r.bookIds,r.period,r.kind,r.categoryId).filter(t=>(r.kind!=='all'||r.metric==='count'||t.kind!=='transfer')&&(!r.valueField||(!!t.values[r.valueField]&&Number.isFinite(Number(t.values[r.valueField]))))); const groups: Record<string, Transaction[]> = Object.create(null)
  records.forEach(t=>{ const b=currentBook(s,t.bookId); let key = r.chart==='number' ? '全部记录' : r.dimension==='date' ? t.date : r.dimension==='month' ? t.date.slice(0,7) : r.dimension==='account' ? label(b,t.accountId) : r.dimension==='object' ? label(b,t.objectId) : r.dimension==='category' ? label(b,t.categoryId) : t.values[r.dimension] || '未填写'; (groups[key] ||= []).push(t) })
  const result=Object.keys(groups).map(name=>{ const ts=groups[name]; const values=ts.map(t=>r.valueField?Math.round(Number(t.values[r.valueField])*100):t.cents); const sum=values.reduce((a,b)=>a+b,0); const value=r.metric==='count'?ts.length:r.metric==='avg'?Math.round(sum/ts.length):r.metric==='max'?Math.max(...values):r.metric==='min'?Math.min(...values):sum; return {name,value,ids:ts.map(t=>t.id)} })
  result.sort((a,b)=>['date','month'].includes(r.dimension)?a.name.localeCompare(b.name):r.order==='asc'?a.value-b.value:b.value-a.value)
  return result.slice(0,r.top || 1000)
}
export function duplicateBook(s: Space, bookId: string, mode: string) { const source=currentBook(s,bookId); const b=clone(source); b.id=id(); b.name=source.name.slice(0,16)+' 副本'; b.archived=false; b.createdAt=Date.now(); b.reports=[]; if(mode==='config') {b.entities=createBook(b.name,b.color,b.type,b.currency).entities; b.fields=[]} if(mode==='all') s.transactions.filter(t=>t.bookId===bookId).forEach(t=>s.transactions.push({...clone(t),id:id(),bookId:b.id})); s.books.push(b); return b }
export function removeBook(s: Space, bookId: string, confirmation: string) {const b=currentBook(s,bookId);if(confirmation!==b.name)throw new Error('输入的账本名称不一致');s.books=s.books.filter(v=>v.id!==bookId);s.transactions=s.transactions.filter(t=>t.bookId!==bookId);s.books.forEach(v=>v.reports.forEach(r=>r.bookIds=r.bookIds.filter(v=>v!==bookId)));if(s.defaultBookId===bookId)s.defaultBookId=''}
export function validateSpace(value: unknown): Space {
  const s=value as Space
  if(!s || s.version!==2 || typeof s.id!=='string' || typeof s.name!=='string' || !Array.isArray(s.books) || !Array.isArray(s.transactions) || typeof s.private!=='boolean') throw new Error('备份格式不正确或版本不受支持')
  if(!/^#[0-9a-f]{6}$/i.test(s.theme)||typeof s.defaultBookId!=='string'||!['password','logo','version'].includes(s.entry)||!Number.isFinite(s.createdAt)||!Number.isFinite(s.autoLock))throw new Error('空间配置损坏')
  const unique=(items:{id:string}[])=>{const keys=new Set<string>();for(const v of items){if(!v||typeof v.id!=='string'||!v.id||['__proto__','constructor','prototype'].includes(v.id)||keys.has(v.id))throw new Error('数据标识损坏或重复');keys.add(v.id)}}
  unique(s.books);unique(s.transactions)
  const ids=new Set<string>();for(const b of s.books){if(!b || typeof b.name!=='string'||typeof b.currency!=='string'||typeof b.icon!=='string'||typeof b.type!=='string'||!/^#[0-9a-f]{6}$/i.test(b.color)||typeof b.archived!=='boolean'||!Number.isSafeInteger(b.budget)||b.budget<0||!Array.isArray(b.entities)||!Array.isArray(b.fields)||!Array.isArray(b.reports))throw new Error('账本结构损坏');ids.add(b.id);unique(b.entities);unique(b.fields);unique(b.reports)
    for(const e of b.entities)if(typeof e.name!=='string'||!['expense','income','object','account'].includes(e.kind)||typeof e.enabled!=='boolean'||typeof e.parentId!=='string'||typeof e.icon!=='string'||typeof e.color!=='string')throw new Error('分类或账户结构损坏')
    for(const f of b.fields){if(typeof f.name!=='string'||!fieldTypes.includes(f.type)||!Array.isArray(f.options)||f.options.some(v=>typeof v!=='string')||!Array.isArray(f.kinds)||f.kinds.some(v=>!['income','expense','transfer'].includes(v))||typeof f.defaultValue!=='string'||typeof f.conditionValue!=='string'||typeof f.conditionField!=='string'||!Number.isFinite(f.order)||['enabled','deleted','required','searchable','filterable','statistical'].some(k=>typeof (f as any)[k]!=='boolean'))throw new Error('字段结构损坏');if(f.conditionField&&!['category','account'].includes(f.conditionField)&&!b.fields.some(p=>p.id===f.conditionField&&p.order<f.order))throw new Error('字段条件依赖无效')}
    for(const r of b.reports)if(typeof r.name!=='string'||!Array.isArray(r.bookIds)||r.bookIds.some(v=>typeof v!=='string')||!['sum','count','avg','max','min'].includes(r.metric)||typeof r.dimension!=='string'||!['all','expense','income','transfer'].includes(r.kind)||!['line','bar','donut','rank','number'].includes(r.chart)||typeof r.period!=='string'||typeof r.categoryId!=='string'||!Number.isFinite(r.top)||!['asc','desc'].includes(r.order))throw new Error('统计方案损坏')
  }
  if(s.defaultBookId&&!ids.has(s.defaultBookId))throw new Error('默认账本不存在')
  for(const t of s.transactions){if(!ids.has(t.bookId)||!Number.isSafeInteger(t.cents)||t.cents<0||!['income','expense','transfer'].includes(t.kind)||typeof t.note!=='string'||typeof t.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(t.date)||typeof t.draft!=='boolean'||!Number.isFinite(t.createdAt)||!Number.isFinite(t.updatedAt)||!t.values||typeof t.values!=='object'||Array.isArray(t.values)||Object.values(t.values).some(v=>typeof v!=='string')||['categoryId','accountId','objectId','toAccountId'].some(k=>typeof (t as any)[k]!=='string'))throw new Error('交易数据损坏')}
  return clone(s)
}
export function mergeSpace(target: Space, source: Space): Space {const result=clone(target);const bookMap:Record<string,string>={};for(const b of source.books){const existing=result.books.find(v=>v.id===b.id);if(existing){bookMap[b.id]=b.id;for(const f of b.fields)if(!existing.fields.some(v=>v.id===f.id))existing.fields.push(clone(f));for(const e of b.entities)if(!existing.entities.some(v=>v.id===e.id))existing.entities.push(clone(e))}else{result.books.push(clone(b));bookMap[b.id]=b.id}}for(const t of source.transactions){const i=result.transactions.findIndex(v=>v.id===t.id);if(i<0)result.transactions.push({...clone(t),bookId:bookMap[t.bookId]});else if(t.updatedAt>result.transactions[i].updatedAt)result.transactions[i]=clone(t)}return validateSpace(result)}
