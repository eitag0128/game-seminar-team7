# Windows: 30分ごとに auto-push.ps1 を実行するタスクスケジューラ登録
#   登録: PowerShell で  .\tools\auto-push\install-windows.ps1
#   解除: .\tools\auto-push\install-windows.ps1 -Uninstall
param([switch]$Uninstall)

$TaskName = 'GameSeminarTeam7AutoPush'
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
if ($Uninstall) { Write-Host '解除しました'; exit 0 }

$Script = Join-Path $PSScriptRoot 'auto-push.ps1'
$Action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Script`""
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 30)
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings | Out-Null
Write-Host '登録しました: 30分ごとに自動プッシュします (ログ: .git\auto-push.log)'
