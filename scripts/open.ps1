# Открывает MedScribe (его зовёт ярлык на рабочем столе, Windows PowerShell 5.1):
# запускает Docker Desktop, если он выключен, поднимает остановленные контейнеры программы
# (ничего не скачивая и не собирая), ждёт ответа и открывает программу в браузере.
# Переменные (необязательные): APP_PORT, MEDSCRIBE_NO_BROWSER=1 (не открывать браузер).
param([string]$Dir = '')

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$waitSec = 180

if (-not $Dir) { $Dir = Split-Path -Parent $PSScriptRoot }
$notify = $null

try { Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing } catch { }

# окно с текстом: врачу терминал не нужен
function Show-Message([string]$text, [string]$kind) {
    try { [void][System.Windows.Forms.MessageBox]::Show($text, 'MedScribe', 'OK', $kind) } catch { Write-Host $text }
}

# короткое уведомление в трее
function Show-Notify([string]$text) {
    Write-Host $text
    try {
        if (-not $script:notify) {
            $script:notify = New-Object System.Windows.Forms.NotifyIcon
            $icon = Join-Path $Dir 'scripts\icons\medscribe.ico'
            try { $script:notify.Icon = New-Object System.Drawing.Icon($icon) } catch { $script:notify.Icon = [System.Drawing.SystemIcons]::Information }
            $script:notify.Visible = $true
        }
        $script:notify.ShowBalloonTip(5000, 'MedScribe', $text, [System.Windows.Forms.ToolTipIcon]::Info)
    } catch { }
}

function Stop-Open([string]$text) {
    Show-Message $text 'Error'
    if ($script:notify) { $script:notify.Dispose() }
    exit 1
}

# docker info с ограничением 10 секунд: зависший Docker Desktop не должен молча вешать ярлык
function Test-Docker {
    $exe = (Get-Command docker -ErrorAction SilentlyContinue).Source
    if (-not $exe) { return $false }
    try {
        $p = Start-Process -FilePath $exe -ArgumentList 'info' -WindowStyle Hidden -PassThru -ErrorAction Stop
        $null = $p.Handle   # без этого ExitCode после WaitForExit бывает пустым
        if (-not $p.WaitForExit(10000)) {
            try { $p.Kill() } catch { }
            return $false
        }
        return ($p.ExitCode -eq 0)
    } catch {
        return $false
    }
}

function Get-AppPort {
    if ($env:APP_PORT -match '^\d{1,5}$') { return [int]$env:APP_PORT }
    $envFile = Join-Path $Dir '.env'
    if (Test-Path -LiteralPath $envFile) {
        foreach ($l in [IO.File]::ReadAllLines($envFile)) {
            if ($l -match '^\s*APP_PORT\s*=\s*"?(\d{1,5})"?\s*$') { return [int]$Matches[1] }
        }
    }
    return 3000
}

# /api/health отвечает 200 и без базы: готовой считаем программу, когда db = true
function Test-App([int]$port) {
    try {
        $h = Invoke-RestMethod -UseBasicParsing -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 3 -ErrorAction Stop
        return ($h.db -eq $true)
    } catch {
        return $false
    }
}

# адрес для браузера: до создания первой учётной записи нужна ссылка с кодом из журнала
# (как Get-FirstRunUrl в install.ps1). У /api/setup/status лимит 60 запросов за 15 минут: запросов мало.
function Get-OpenUrl([int]$port, [string]$root) {
    $needs = $null
    for ($i = 0; $i -lt 3; $i++) {
        try {
            $st = Invoke-RestMethod -UseBasicParsing -Uri "http://127.0.0.1:$port/api/setup/status" -TimeoutSec 10 -ErrorAction Stop
            $needs = $st.needsSetup
            if ($null -ne $needs) { break }
        } catch { }
        Start-Sleep -Seconds 3
    }
    if ($needs -ne $true) { return $root }
    # код появляется в журнале не сразу: ждём до минуты
    $until = (Get-Date).AddSeconds(60)
    while ((Get-Date) -lt $until) {
        try {
            $logs = (& docker compose logs --no-log-prefix --no-color app 2>&1 | ForEach-Object { $_.ToString() }) -join "`n"
            $m = [regex]::Matches($logs, 'setup#token=([A-Z0-9-]+)')
            if ($m.Count -gt 0) { return ($root + 'setup#token=' + $m[$m.Count - 1].Groups[1].Value) }
        } catch { }
        Start-Sleep -Seconds 3
    }
    return ($root + 'setup')
}

function Open-App([string]$url) {
    if ($env:MEDSCRIBE_NO_BROWSER -eq '1') { return }
    try { Start-Process -FilePath $url | Out-Null } catch { Stop-Open "Не получилось открыть браузер. Откройте вручную: $url" }
}

try {
    if (-not (Test-Path -LiteralPath (Join-Path $Dir 'docker-compose.yml'))) {
        Stop-Open "Не найдена папка программы MedScribe ($Dir). Запустите установку заново."
    }
    Set-Location -LiteralPath $Dir

    $port = Get-AppPort
    $url = "http://localhost:$port/"

    # docker.exe может не быть в PATH сразу после установки Docker Desktop
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        foreach ($bin in @("$env:ProgramFiles\Docker\Docker\resources\bin", "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin")) {
            if (Test-Path -LiteralPath (Join-Path $bin 'docker.exe')) { $env:Path = $env:Path + ';' + $bin }
        }
    }

    # уже работает: сразу открываем
    if (Test-App $port) {
        Open-App (Get-OpenUrl $port $url)
        return
    }

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Stop-Open 'Не найден Docker. Установите Docker Desktop (https://www.docker.com/products/docker-desktop/), запустите его и откройте MedScribe снова.'
    }

    if (-not (Test-Docker)) {
        $exe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
        if (-not (Test-Path -LiteralPath $exe)) { $exe = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe' }
        if (-not (Test-Path -LiteralPath $exe)) {
            Stop-Open 'Docker не отвечает. Запустите Docker Desktop и откройте MedScribe снова.'
        }
        Show-Notify 'Запускаю Docker Desktop, это может занять до 3 минут'
        try { Start-Process -FilePath $exe | Out-Null } catch { Stop-Open 'Не удалось запустить Docker Desktop. Откройте его вручную и запустите MedScribe снова.' }
        $until = (Get-Date).AddSeconds($waitSec)
        $up = $false
        while ((Get-Date) -lt $until) {
            if (Test-Docker) { $up = $true; break }
            Start-Sleep -Seconds 3
        }
        if (-not $up) {
            Stop-Open 'Docker не запустился за 3 минуты. Дождитесь, пока Docker Desktop полностью загрузится, и откройте MedScribe снова.'
        }
    }

    Show-Notify 'Запускаю MedScribe, это около минуты'
    # без скачивания: нужны только уже установленные образы
    $out = (& docker compose up -d --pull never 2>&1 | ForEach-Object { $_.ToString() }) -join "`n"
    if ($LASTEXITCODE -ne 0) {
        if ($out -match 'port is already allocated|address already in use|Ports are not available|Bind for') {
            Stop-Open "Порт $port занят другой программой. Закройте её или поставьте другой порт (см. инструкцию) и откройте MedScribe снова."
        }
        if ($out -match 'No such image|pull access denied') {
            Stop-Open 'Не найдены файлы программы в Docker (возможно, их удалили). Запустите команду установки из инструкции ещё раз: это безопасно, ваши данные сохранятся.'
        }
        Stop-Open "Не удалось запустить MedScribe. Если Docker только что запустился, подождите минуту и повторите. Подробности: docker compose logs --tail 50 (в папке $Dir)."
    }

    $until = (Get-Date).AddSeconds($waitSec)
    $ready = $false
    while ((Get-Date) -lt $until) {
        if (Test-App $port) { $ready = $true; break }
        Start-Sleep -Seconds 3
    }
    if (-not $ready) {
        Stop-Open "MedScribe не ответил за 3 минуты. Подождите минуту и откройте его снова. Если не помогает: docker compose logs --tail 50 app (в папке $Dir)."
    }
    Open-App (Get-OpenUrl $port $url)
} catch {
    Stop-Open ('Не удалось открыть MedScribe: ' + $_.Exception.Message)
} finally {
    if ($script:notify) { $script:notify.Dispose() }
}
