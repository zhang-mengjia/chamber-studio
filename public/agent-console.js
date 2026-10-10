const $ = id => document.getElementById(id);
let api, tools = [];
const defaults = {
  chamber_load_config:() => ({config:api.getState()}),
  chamber_load_example:() => ({name:'empty'}),
  chamber_apply_operations:() => ({operations:[{action:'settings',settings:{view:'perspective'}}]}),
  chamber_export:() => ({format:'png',scale:2,transparent:true,download:true})
};
function chooseTool() {
  const tool = tools.find(tool => tool.name === $('tool').value);
  $('toolDescription').textContent = tool.description;
  $('schema').textContent = JSON.stringify(tool.inputSchema,null,2);
  $('arguments').value = JSON.stringify(defaults[tool.name]?.() || {},null,2);
}
function connect() {
  if (api) return;
  api = $('editor').contentWindow.chamberStudio;
  if (!api) { $('status').textContent = '接口未能载入，请重新加载页面。/ API unavailable; reload the page.'; return; }
  tools = api.listTools();
  for (const tool of tools) { const option = document.createElement('option'); option.value = option.textContent = tool.name; $('tool').append(option); }
  $('tool').value = 'chamber_get_state';
  $('tool').disabled = $('execute').disabled = false;
  $('status').textContent = `API ${api.apiVersion} · 就绪 / Ready`;
  chooseTool();
}
$('editor').addEventListener('load',connect,{once:true});
// The module can execute after a cached iframe has already finished loading.
if ($('editor').contentDocument?.readyState === 'complete' && $('editor').contentWindow.chamberStudio) connect();
$('tool').onchange = chooseTool;
$('agentForm').onsubmit = async event => {
  event.preventDefault();
  if (!api) return;
  $('execute').disabled = true;
  $('status').textContent = '正在执行 / Running…';
  try {
    let args;
    try { args = JSON.parse($('arguments').value); }
    catch { throw new Error('参数不是有效 JSON / Arguments are not valid JSON.'); }
    const response = await api.callTool($('tool').value,args);
    $('result').value = JSON.stringify(response,null,2);
    $('status').textContent = response.ok ? '已完成 / Completed' : `失败 / Failed · ${response.error.code}`;
  } catch (error) {
    $('result').value = JSON.stringify({ok:false,error:{code:'INVALID_JSON',message:error.message}},null,2);
    $('status').textContent = '失败 / Failed';
  } finally { $('execute').disabled = false; }
};
