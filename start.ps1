$ErrorActionPreference='Stop'
$url='http://127.0.0.1:47831'
try {$health=Invoke-RestMethod "$url/health" -TimeoutSec 2} catch {$health=$null}
if($health -and $health.app -ne 'chamber-studio'){throw '端口 47831 已被其他应用占用。'}
if(!$health){
 $found=Get-Command node -ErrorAction SilentlyContinue
 if(!$found){throw 'Install Node.js 22 or later from https://nodejs.org, then run this launcher again.'}
 $nodePath=$found.Source
 $major=[int]((& $nodePath --version).TrimStart('v').Split('.')[0])
 if($major -lt 22){throw 'Node.js 22 or later is required.'}
 Start-Process -FilePath $nodePath -ArgumentList ('"'+(Join-Path $PSScriptRoot 'server.mjs')+'"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
 for($i=0;$i -lt 20;$i++){Start-Sleep -Milliseconds 250;try{$health=Invoke-RestMethod "$url/health" -TimeoutSec 1;break}catch{}}
 if($health.app -ne 'chamber-studio'){throw '网页未能启动，请检查本机端口 47831。'}
}
Start-Process $url
