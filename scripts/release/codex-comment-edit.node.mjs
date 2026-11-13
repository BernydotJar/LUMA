import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyBotEditHistory } from './codex-comment-edit.mjs';
const original={
  node_id:'IC_private_bot_comment_1',
  user:{login:'chatgpt-codex-connector[bot]',type:'Bot'},
  created_at:'2026-11-11T10:00:00Z',updated_at:'2026-11-11T10:01:00Z'};
const edited={id:original.node_id,author:{login:'chatgpt-codex-connector'},
  editor:{login:'chatgpt-codex-connector'},
  createdAt:original.created_at,updatedAt:original.updated_at};
const revisions=[{editedAt:original.updated_at,editor:{login:'chatgpt-codex-connector'}}];
test('complete authenticated Codex app edit history permits genuine updated reviews',()=>{
 assert.equal(verifyBotEditHistory(original,edited,revisions),true);
});
test('editing by sole owner cannot alter an authenticated bot review',()=>{
 assert.throws(()=>verifyBotEditHistory(original,edited,[
  {editedAt:original.updated_at,editor:{login:'BernydotJar'}}]));
 assert.throws(()=>verifyBotEditHistory(original,{...edited,editor:{login:'BernydotJar'}},revisions));
 assert.throws(()=>verifyBotEditHistory(original,{...edited,updatedAt:'2026-11-11T11:00:00Z'},revisions));
 assert.throws(()=>verifyBotEditHistory(original,edited,[]));
 assert.throws(()=>verifyBotEditHistory({...original,user:{login:'BernydotJar',type:'User'}},edited,revisions));
});
