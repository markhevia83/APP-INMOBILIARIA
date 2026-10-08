import React from 'react';
// Small, escaped text renderer. No HTML execution or model-generated links.
function inline(text){return text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g).map((part,i)=>part.startsWith('**')&&part.endsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:part.startsWith('*')&&part.endsWith('*')?<em key={i}>{part.slice(1,-1)}</em>:part)}
export function ChatText({text}){
 const clean=String(text||'').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,'el asunto seleccionado');
 return <div className="chatText">{clean.split(/\n\s*\n/).map((block,i)=>{
  const lines=block.split('\n');
  if(lines.every(x=>/^\s*[-*]\s+/.test(x)))return <ul key={i}>{lines.map((line,j)=><li key={j}>{inline(line.replace(/^\s*[-*]\s+/,''))}</li>)}</ul>;
  if(lines.every(x=>/^\s*\d+[.)]\s+/.test(x)))return <ol key={i}>{lines.map((line,j)=><li key={j}>{inline(line.replace(/^\s*\d+[.)]\s+/,''))}</li>)}</ol>;
  return <p key={i}>{lines.map((line,j)=><React.Fragment key={j}>{j>0&&<br/>}{inline(line)}</React.Fragment>)}</p>;
 })}</div>;
}
