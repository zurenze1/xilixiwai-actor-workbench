export const CREATOR_DESKS={
 library:[['','IP资料'],['assets','全部创作素材'],['library','原文与证据'],['transcripts','逐字稿'],['videos','完整作品'],['process','制作过程']],
 comments:[['comments','高赞评论'],['insights','选题解读']],
 topics:[['','IP选题池'],['insights','评论选题'],['board','制作项目']],
 replies:[['comment-inbox','评论回复箱']],
 content:[['','写稿与平台提醒'],['topics','项目稿件与版本']],
 execution:[['edit-plan','逐句分镜'],['board','制作项目']],
 radar:[['daily','全部'],['people','人物'],['culture','时尚界'],['apparel','服装'],['ai','AI'],['finance','财经'],['comments','竞品评论洞察'],['industry','行业早报'],['othernews','其他']],
 operations:[['','账号矩阵'],['review','真实作品复盘'],['calendar','发布排期']]
};
export function creatorRoute(hash,validRoutes,{radarPage=''}={}){const [raw,page='']=hash.replace(/^#/,'').split('~'),legacyComments=['topics','radar'].includes(raw)&&page==='comments',requested=legacyComments?(validRoutes.includes('comments')?'comments':'radar'):raw,route=validRoutes.includes(requested)?requested:'today',tabs=CREATOR_DESKS[route]||[],selected=route==='radar'&&!page?(radarPage||'finance'):page;return {route,page:tabs.some(t=>t[0]===selected)?selected:(tabs[0]?.[0]||'')};}
