# Team7 自動コミット&プッシュ (Windows用)
# 変更があれば add -A -> commit -> pull --rebase -> push を行う。
# 競合・認証失敗などの場合は何も壊さず中断し、ログに残す。
$ErrorActionPreference = 'Continue'
$env:GIT_TERMINAL_PROMPT = '0'

$Repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $Repo

$GitDir = (git rev-parse --git-dir).Trim()
$Log    = Join-Path $GitDir 'auto-push.log'
$Lock   = Join-Path $GitDir 'auto-push.lock'
$MaxBytes = 95MB

function Write-Log($msg) {
    Add-Content -Path $Log -Value ("{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg) -Encoding UTF8
}

# 二重起動防止(60分以上古いロックは破棄)
if (Test-Path $Lock) {
    if (((Get-Date) - (Get-Item $Lock).LastWriteTime).TotalMinutes -gt 60) { Remove-Item $Lock -Recurse -Force }
}
try { New-Item -ItemType Directory -Path $Lock -ErrorAction Stop | Out-Null } catch { exit 0 }

try {
    # 手動のgit操作の最中は触らない
    foreach ($f in 'index.lock','MERGE_HEAD','CHERRY_PICK_HEAD','REVERT_HEAD','rebase-merge','rebase-apply') {
        if (Test-Path (Join-Path $GitDir $f)) { Write-Log "skip: $f exists"; exit 0 }
    }
    if ((git branch --show-current).Trim() -ne 'main') { Write-Log 'skip: not on main'; exit 0 }

    git add -A | Out-Null

    # 95MB超のファイルはコミットから外す
    foreach ($file in (git diff --cached --name-only)) {
        $item = Get-Item -LiteralPath $file -ErrorAction SilentlyContinue
        if ($item -and $item.Length -gt $MaxBytes) {
            git reset -q -- $file | Out-Null
            Write-Log "skip large file ($($item.Length)B): $file"
        }
    }

    git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
        git commit -q -m ("auto: {0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $env:COMPUTERNAME) | Out-Null
        if ($LASTEXITCODE -ne 0) { Write-Log 'commit failed'; exit 1 }
        Write-Log 'committed'
    }

    # リモートに main があれば取り込む(競合したら中断)
    git ls-remote --exit-code --heads origin main 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $out = git pull --rebase origin main 2>&1 | Out-String
        if ($LASTEXITCODE -ne 0) {
            git rebase --abort 2>&1 | Out-Null
            Write-Log "pull --rebase failed (要手動対応): $out"
            exit 1
        }
    }

    # プッシュすべきものがある時だけpush
    $local  = (git rev-parse HEAD).Trim()
    $remote = (git rev-parse -q --verify origin/main 2>$null)
    if ($local -ne $remote) {
        $out = git push -u origin main 2>&1 | Out-String
        if ($LASTEXITCODE -eq 0) { Write-Log "pushed $((git rev-parse --short HEAD).Trim())" }
        else { Write-Log "push failed: $out"; exit 1 }
    }
}
finally {
    Remove-Item $Lock -Recurse -Force -ErrorAction SilentlyContinue
}
