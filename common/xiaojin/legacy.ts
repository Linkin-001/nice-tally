import { parseLedger } from '../tally/ledger.uts'
import { Space, createBook, newTransaction, id, saveTransaction } from './model'

/** Explicit import only. Original storage is never written or deleted. Stable IDs make repeats safe. */
export function migrateLegacyInto(space:Space,raw:string):number {
  const legacy=parseLedger(raw)
  if(!legacy)throw new Error('旧版数据格式不正确，原始数据未修改')
  if(legacy.preferences.pinHash)throw new Error('旧账本已启用应用锁。请打开旧版、验证密码并关闭应用锁后，再回来导入。')
  let book=space.books.find(b=>b.id==='legacy-book')
  if(!book){book=createBook('旧版活动账本',space.theme,'个人账本',legacy.preferences.currency==='$'?'US$':legacy.preferences.currency);book.id='legacy-book';space.books.push(book)}
  if(book.archived)throw new Error('请先恢复“旧版活动账本”，再执行增量导入')
  let imported=0
  for(const group of [{records:legacy.records,draft:false},{records:legacy.drafts,draft:true}])for(const activity of group.records)for(const person of activity.people){
    if(!person.cents&&!group.draft)continue
    const key='legacy:'+activity.id+':'+person.id
    if(space.transactions.some(t=>t.id===key))continue
    const kind=person.cents>0?'income':'expense'
    let category=book.entities.find(e=>e.kind===kind&&e.name===activity.category)
    if(!category){category={id:id(),name:activity.category,kind,icon:'book',color:book.color,enabled:true,parentId:'',note:'旧版活动分类'};book.entities.push(category)}
    let object=book.entities.find(e=>e.kind==='object'&&e.name===person.name)
    if(!object&&person.name){object={id:id(),name:person.name,kind:'object',icon:'user',color:book.color,enabled:true,parentId:'',note:'从旧版迁移'};book.entities.push(object)}
    const t=newTransaction(book);t.id=key;t.kind=kind;t.cents=Math.abs(person.cents);t.draft=group.draft;t.categoryId=category.id;t.objectId=object?.id||'';t.date=activity.date;t.note=[activity.time,activity.place,activity.note].filter(Boolean).join(' · ');saveTransaction(space,t);imported++
  }
  return imported
}
