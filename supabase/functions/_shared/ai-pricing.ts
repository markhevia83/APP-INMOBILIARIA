// Reviewed 2026-10-12: https://developers.openai.com/api/docs/pricing
// Deliberately uses the higher long-context/cache-write price, ignoring cache discounts.
// Review after 30 days; new models/tiers are blocked rather than silently underpriced.
const pricedModel=(value:unknown)=>value==='gpt-5.6'||value==='gpt-5.6-sol';
const safeCount=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>=0;
export function preparePricedRequest(payload:any,now=Date.now()) {
 if(now>=Date.parse('2026-11-11T00:00:00Z')||!pricedModel(payload.model))throw Error('pricing_review_required');
 if(!Number.isSafeInteger(payload.max_output_tokens)||payload.max_output_tokens<1||payload.max_output_tokens>128000)throw Error('unpriced_request');
 if(payload.tools&&!Array.isArray(payload.tools))throw Error('unpriced_tool');
 const search=Array.isArray(payload.tools)&&payload.tools.length>0;
 if(search&&payload.tools.some((tool:any)=>tool.type!=='web_search_preview'&&tool.type!=='web_search'))throw Error('unpriced_tool');
 payload.store=false;payload.service_tier='default';
 if(search)payload.max_tool_calls=1;
 const bytes=new TextEncoder().encode(JSON.stringify(payload)).length;
 // One byte per token plus 4096 overhead is a conservative estimate, not invoice certification.
 // Web retrieval is not size-bounded here, so reserve the entire model context for a search.
 const input=search?1050000:bytes+4096;
 return {payload,search,reserve:input*10+payload.max_output_tokens*30+(search?10000:0)};
}
export function pricedUsage(data:any,payload:any):number|null {
 if(!pricedModel(data?.model)||!['default',undefined].includes(data?.service_tier))return null;
 const input=data?.usage?.input_tokens,output=data?.usage?.output_tokens;
 if(!safeCount(input)||!safeCount(output)||!Array.isArray(data?.output))return null;
 const calls=data.output.filter((item:any)=>item.type==='web_search_call').length;
 if(calls>1||(!payload.tools&&calls))return null;
 return input*10+output*30+calls*10000;
}
