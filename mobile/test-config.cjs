const {chromium}=require('playwright-core');
const username=process.env.XPRA_HTTP_USERNAME;
const password=process.env.XPRA_HTTP_PASSWORD;
if(!username || !password) throw new Error('请设置 XPRA_HTTP_USERNAME 和 XPRA_HTTP_PASSWORD');
module.exports={credentials:{username,password},executablePath:process.env.XPRA_CHROMIUM_EXECUTABLE || chromium.executablePath()};
