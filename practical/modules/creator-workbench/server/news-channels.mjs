// Shared by the server and the compiled client. Legacy records remain intact.
export const NEWS_CHANNELS=[
 ['all','全部'],['people','人物'],['culture','时尚界'],['apparel','服装'],['ai','AI'],['finance','财经'],['other','其他']
];
export function newsChannel(n={}){
 const category=String(n.category||''),title=String(n.title||'');
 if(n.channel==='finance'||/^财经(?:[｜|/·\s]|$)/.test(category))return 'finance';
 if(n.channel==='apparel')return 'apparel';
 if(n.channel==='culture'&&/^时尚界热点[｜|]/.test(title))return 'culture';
 if(n.channel==='other'&&/^服装类热点[｜|]/.test(title))return 'apparel';
 if(['people','ai'].includes(n.channel))return n.channel;
 if(/^时尚界/.test(category))return 'culture';
 if(/^服装/.test(category))return 'apparel';
 if(['culture','other'].includes(n.channel))return 'other';
 if(/^AI(?:[\s/·]|$)|人工智能|大模型/i.test(category))return 'ai';
 if(/人物/.test(category))return 'people';
 return 'other';
}
