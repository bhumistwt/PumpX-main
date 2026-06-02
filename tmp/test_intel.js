const { prisma } = require('../frontend/src/server/db');
(async ()=>{
  try{
    const tokens = await prisma.market.findMany({ where: { tokenAddress: { not: null } }, distinct: ['tokenAddress'], select: { tokenAddress: true, stockTicker: true }, take: 10 });
    console.log('tokens', tokens.length);
    if(tokens.length>0){
      const t = tokens[0];
      const marketRows = await prisma.market.findMany({ where: { tokenAddress: t.tokenAddress }, select: { contractAddress: true } });
      console.log('marketRows', marketRows.length);
      const avg = await prisma.market.aggregate({ _avg: { blendedProbability: true, modelBaselineProbability: true }, where: { tokenAddress: t.tokenAddress } });
      console.log('avg', avg);
      const now = new Date();
      const day24 = new Date(now.getTime() - 24 * 3600 * 1000);
      const recentAvg = await prisma.modelPredictionLog.aggregate({ _avg: { probability: true }, where: { marketAddress: { in: marketRows.map(m=>m.contractAddress) }, createdAt: { gte: day24 } } });
      console.log('recentAvg', recentAvg);
    }
  }catch(e){
    console.error(e);
  }finally{ await prisma.$disconnect(); }
})();
