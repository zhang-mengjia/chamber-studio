$root=[IO.Path]::GetFullPath($PSScriptRoot)
$entry=Join-Path $root 'server.mjs'
Get-CimInstance Win32_Process -Filter "name = 'node.exe'" | Where-Object {$_.CommandLine -like ('*"'+$entry+'"*')} | ForEach-Object {Stop-Process -Id $_.ProcessId}
