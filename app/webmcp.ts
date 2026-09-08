import type {GameAPI} from './runner';
type Tool={name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown};
export function registerGameTools(api:GameAPI){
 const context=(document as Document&{modelContext?:{registerTool:(tool:Tool,options:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
 const life=new AbortController();
 if(context?.registerTool){
  const tools:Tool[]=[{name:'read_run_status',description:'Read the current closed-run game phase, distance, speed and wanted level.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>api.getState()},
  {name:'start_new_run',description:'Start or restart the visible 3D runner; resets current distance and wanted level.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:(input)=>{if(input===null||typeof input!=='object'||Object.keys(input).length)throw new Error('Expected an empty object');api.start();return api.getState();}},
  {name:'move_runner',description:'Move the running character one lane left or right.',inputSchema:{type:'object',properties:{direction:{type:'string',enum:['left','right']}},required:['direction'],additionalProperties:false},annotations:{readOnlyHint:false},execute:(input)=>{if(!input||typeof input!=='object'||!('direction'in input)||Object.keys(input).length!==1||!['left','right'].includes(String(input.direction)))throw new Error('direction must be left or right');if(api.getState().phase!=='running')throw new Error('Start or resume a run first');api.move(input.direction==='left'?-1:1);return api.getState();}}];
  tools.forEach(tool=>{try{void Promise.resolve(context.registerTool(tool,{signal:life.signal})).catch(()=>{});}catch{}});
 }
 return()=>life.abort();
}
