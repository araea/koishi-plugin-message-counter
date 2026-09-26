import test from 'node:test'
import assert from 'node:assert/strict'
import {createClearAction} from '../src/clear'
test('clear requires an unexpired, single-use confirmation from the same session identity', async () => {
 let removed=0,clock=0
 const action=createClearAction({get:async()=>[{},{}],remove:async()=>{removed++}},()=>clock)
 const session={platform:'mock',selfId:'bot',userId:'u',channelId:'g'}
 const preview=await action({session,options:{}})
 const token=preview!.match(/--confirm (\w+)/)![1]
 assert.equal(removed,0);assert.match(preview!,/2 条/)
 await action({session:{...session,userId:'other'},options:{confirm:token}});assert.equal(removed,0)
 await action({session,options:{confirm:'invalid'}});assert.equal(removed,0)
 clock=300001;await action({session,options:{confirm:token}});assert.equal(removed,0)
 const next=(await action({session,options:{}}))!.match(/--confirm (\w+)/)![1]
 await action({session,options:{confirm:next}});assert.equal(removed,1)
 await action({session,options:{confirm:next}});assert.equal(removed,1)
})
