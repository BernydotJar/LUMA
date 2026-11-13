/** Authenticates *every* revision of Codex's mutable GitHub review summary.
 * Trusted protected main code queries GitHub GraphQL; candidate PR bytes
 * cannot assert their own bot-edit provenance.
 */
import { execFileSync } from 'node:child_process';
const BOT_REST='chatgpt-codex-connector[bot]';
const BOT_ACTOR='chatgpt-codex-connector';
function requireTruth(x,msg){if(!x)throw Error('CODEX_EDIT_BLOCKED: '+msg);}

export function verifyBotEditHistory(comment,graphql,history){
  requireTruth(comment?.user?.login===BOT_REST&&
    comment.user.type==='Bot'&&typeof comment.node_id==='string'&&
    comment.node_id.length>6,'Unknown Codex GitHub app comment');
  requireTruth(typeof comment.created_at==='string'&&
    typeof comment.updated_at==='string','Missing authenticated comment timestamps');
  if(comment.created_at===comment.updated_at)return true;
  requireTruth(graphql?.id===comment.node_id &&
    graphql.author?.login===BOT_ACTOR &&
    graphql.editor?.login===BOT_ACTOR &&
    graphql.createdAt===comment.created_at &&
    graphql.updatedAt===comment.updated_at,
    'GitHub review summary has unverified current editor or timestamps');
  requireTruth(Array.isArray(history)&&history.length>0 &&
    history.some(edit=>edit.editedAt===comment.updated_at)&&
    history.every(edit=>edit.editor?.login===BOT_ACTOR),
    'At least one Codex summary revision was not made by the verified Codex app');
  return true;
}
export function authenticateCodexSummaryEdits(comments){
  requireTruth(Array.isArray(comments),'GitHub comments must be an authenticated collection');
  return comments.map(comment=>{
    if(comment?.user?.login!==BOT_REST ||
      !comment.body?.includes('<!-- codex-review-state:v1 '))return comment;
    requireTruth(comment.user.type==='Bot'&&comment.performed_via_github_app?.slug===BOT_ACTOR,
      'Codex summary not published by registered GitHub App');
    requireTruth(typeof comment.node_id==='string'&&typeof comment.created_at==='string'&&
      typeof comment.updated_at==='string',
      'Codex summary missing GitHub identity or timestamps');
    if(comment.created_at===comment.updated_at)
      return {...comment,_authenticatedBotEditHistory:true};
    const query='query($id:ID!,$after:String){node(id:$id){...on IssueComment{'+
      'id author{login} editor{login} createdAt updatedAt '+
      'userContentEdits(first:100,after:$after){pageInfo{hasNextPage endCursor}'+
      'nodes{editedAt editor{login}}}}}}';
    let after=null,root=null,edits=[];
    for(let i=0;i<20;i++){
      const args=['api','graphql','-f','query='+query,'-f','id='+comment.node_id];
      if(after)args.push('-f','after='+after);
      const text=execFileSync('gh',args,{encoding:'utf8',timeout:30000,
        maxBuffer:2*1024*1024});
      const result=JSON.parse(text);
      requireTruth(!result.errors&&result.data?.node?.id===comment.node_id,
        'GitHub edit history missing, truncated, or GraphQL rejected');
      const node=result.data.node,changes=node.userContentEdits;
      requireTruth(changes && Array.isArray(changes.nodes),
        'Codex comment edits unavailable');
      root=node;
      edits.push(...changes.nodes);
      if(!changes.pageInfo?.hasNextPage){
        verifyBotEditHistory(comment,root,edits);
        return {...comment,_authenticatedBotEditHistory:true};
      }
      after=changes.pageInfo.endCursor;
      requireTruth(typeof after==='string'&&after.length>0,
        'GitHub editor history pagination cannot continue');
    }
    throw Error('CODEX_EDIT_BLOCKED: GitHub edit history exceeds permitted pages');
  });
}
