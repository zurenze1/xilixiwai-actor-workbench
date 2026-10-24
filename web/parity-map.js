(function(root){'use strict';
const rows=[
 ['today','今日与日历',-1,'today'],['project','项目与合作',0,'project'],['script','剧本研读',1,'script'],['performance','表演准备',2,'performance'],['previs','造型与分镜',3,'previs'],['studio','工作室协作',4,'studio'],['fans','粉丝沟通',5,'fans'],['social','内容与账号运营',-14,'social'],['rights','版权与数字人',6,'rights'],['review','作品与复盘',7,'review'],['dance','舞蹈训练',-16,'dance'],['brief','行业信息',-9,'brief'],['plan','发展规划',-8,'plan'],['travel','出行与健康',-2,'travel'],['crisis','公共沟通',-7,'crisis'],['charity','公益项目',-4,'charity'],['business','工作室经营与自有品牌',-13,'business'],['pet','肉肉生活',-10,'pet'],['guide','图解使用说明',-11,'guide'],['settings','账号与模型配置演练',-15,'settings']
];
const routes=rows.map(([route,title,page,scope])=>Object.freeze({route,title,page,scope}));
root.ActorParityMap=Object.freeze({routes:Object.freeze(routes),find:route=>routes.find(x=>x.route===route),version:1});
})(typeof window==='undefined'?globalThis:window);
