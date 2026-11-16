# Установщик MedScribe для Windows (Windows PowerShell 5.1, без прав администратора).
# Запуск:
#   [Net.ServicePointManager]::SecurityProtocol='Tls12'; iex ((irm https://raw.githubusercontent.com/Allmostkill/medscribe/main/scripts/install.ps1).TrimStart([char]0xFEFF))
#
# Всё лежит внутри функции Install-MedScribe, вызов - в последней строке: если загрузка
# оборвётся на середине, не выполнится ничего.
#
# Переменные окружения (необязательно):
#   MEDSCRIBE_DIR                 папка установки (по умолчанию %USERPROFILE%\medscribe)
#   MEDSCRIBE_VERSION             версия вида 1.2.3 (по умолчанию последняя)
#   MEDSCRIBE_BUNDLE_FILE         локальный пакет medscribe-bundle.tar.gz (файл .sha256 рядом)
#   MEDSCRIBE_NO_PULL=1           не скачивать образы (они уже есть на компьютере)
#   MEDSCRIBE_NO_BROWSER=1        не открывать браузер, только показать ссылку
#   MEDSCRIBE_NO_SHORTCUT=1       не создавать ярлык MedScribe на рабочем столе
#   MEDSCRIBE_SKIP_MEMORY_CHECK=1 не проверять память Docker
#   MEDSCRIBE_SKIP_DISK_CHECK=1   не проверять свободное место
#   MEDSCRIBE_UPDATE=1            обновление: без браузера, в конце сводка
#   APP_PORT, COMPOSE_PROJECT_NAME  записываются в .env установки

function Install-MedScribe {
    $ErrorActionPreference = 'Continue'
    $ProgressPreference = 'SilentlyContinue'

    $repo = 'Allmostkill/medscribe'
    $bundleName = 'medscribe-bundle.tar.gz'
    $minMemoryBytes = [int64]8053063680
    # размер тома с моделью речи T-one на готовой установке (du -sk /models), КБ
    $toneExpectedKb = [int64]5476632
    $installCommand = "[Net.ServicePointManager]::SecurityProtocol='Tls12'; iex ((irm https://raw.githubusercontent.com/$repo/main/scripts/install.ps1).TrimStart([char]0xFEFF))"
    $S = @{
        Dir = ''; Tmp = ''; Bundle = ''; NewVer = ''; OldVer = ''
        IsUpdate = $false; NeedBackup = $false; Foreign = $false; Project = 'medscribe'; Pushed = $false; Shortcut = ''
    }

    $oldEncoding = $null
    try { $oldEncoding = [Console]::OutputEncoding; [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }

    # ── вспомогательные функции ──────────────────────────────────────────────

    function Say-Step([int]$n, [string]$title) {
        Write-Host ''
        Write-Host "Шаг $n из 6. $title" -ForegroundColor Cyan
    }
    function Say-Ok([string]$text) { Write-Host "  Готово: $text" -ForegroundColor Green }
    function Say-Info([string]$text) { Write-Host "  $text" }
    function Say-Warn([string]$text) { Write-Host "  $text" -ForegroundColor Yellow }
    function Say-Fail([string]$text) {
        Write-Host ''
        Write-Host "Не получилось: $text" -ForegroundColor Red
    }

    # docker с захватом вывода (stdout+stderr); код возврата проверяем отдельно
    function Invoke-Docker([string[]]$DockerArgs) {
        $lines = & docker @DockerArgs 2>&1 | ForEach-Object { $_.ToString() }
        $code = $LASTEXITCODE
        return @{ Code = $code; Out = (@($lines) -join "`n") }
    }

    function Test-Flag([string]$value) { return ($value -eq '1') }

    function Get-FullDir([string]$p) {
        if ([IO.Path]::IsPathRooted($p)) { return $p }
        return (Join-Path (Get-Location).Path $p)
    }

    # папка внутри профиля пользователя? (полный путь без хвостовых слэшей, регистр не важен)
    function Test-InProfile([string]$path) {
        $full = [IO.Path]::GetFullPath($path).TrimEnd('\')
        $prof = [IO.Path]::GetFullPath($env:USERPROFILE).TrimEnd('\')
        return (($full + '\').StartsWith($prof + '\', [StringComparison]::OrdinalIgnoreCase))
    }

    # владелец существующей папки: мы сами, администраторы или SYSTEM (иначе чужой владелец мог бы менять права)
    function Test-DirOwnerTrusted([string]$path) {
        try {
            $owner = (Get-Acl -LiteralPath $path).GetOwner([Security.Principal.SecurityIdentifier]).Value
            $me = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
            return ($owner -eq $me -or $owner -eq 'S-1-5-32-544' -or $owner -eq 'S-1-5-18')
        } catch {
            return $false
        }
    }

    function Read-EnvValue([string]$key) {
        $envFile = Join-Path $S.Dir '.env'
        if (-not (Test-Path -LiteralPath $envFile)) { return $null }
        foreach ($l in [IO.File]::ReadAllLines($envFile)) {
            if ($l -match ('^\s*' + $key + '\s*=\s*"?([^"\s]*)"?\s*$')) { return $Matches[1] }
        }
        return $null
    }

    function Set-EnvValue([string]$key, [string]$value) {
        $envFile = Join-Path $S.Dir '.env'
        $lines = @()
        if (Test-Path -LiteralPath $envFile) { $lines = @([IO.File]::ReadAllLines($envFile)) }
        $found = $false
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match ('^\s*' + $key + '\s*=')) { $lines[$i] = "$key=$value"; $found = $true }
        }
        if (-not $found) { $lines += "$key=$value" }
        [IO.File]::WriteAllText($envFile, ((@($lines) -join "`n") + "`n"), (New-Object Text.UTF8Encoding($false)))
    }

    function Get-AppPort {
        if ($env:APP_PORT) { return [int]$env:APP_PORT }
        $fromEnv = Read-EnvValue 'APP_PORT'
        if ($fromEnv -match '^\d{1,5}$') { return [int]$fromEnv }
        return 3000
    }

    function Get-Health([int]$port) {
        try {
            return (Invoke-RestMethod -UseBasicParsing -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 5 -ErrorAction Stop)
        } catch {
            return $null
        }
    }

    function Wait-Db([int]$port, [int]$seconds) {
        $until = (Get-Date).AddSeconds($seconds)
        $lastNote = Get-Date
        while ((Get-Date) -lt $until) {
            $h = Get-Health $port
            if ($h -and $h.db -eq $true) { return $h }
            Start-Sleep -Seconds 3
            if (((Get-Date) - $lastNote).TotalSeconds -ge 30) {
                Say-Info 'Ещё жду. Это нормально: при первом запуске база готовится не сразу.'
                $lastNote = Get-Date
            }
        }
        return $null
    }

    function Find-Docker {
        if (Get-Command docker -ErrorAction SilentlyContinue) { return $true }
        foreach ($bin in @("$env:ProgramFiles\Docker\Docker\resources\bin", "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin")) {
            if (Test-Path -LiteralPath (Join-Path $bin 'docker.exe')) {
                $env:Path = $env:Path + ';' + $bin
                return $true
            }
        }
        return $false
    }

    # ── шаг 1: проверки ──────────────────────────────────────────────────────

    function Step-Checks {
        Say-Step 1 'Проверяю компьютер и Docker'

        if ($env:OS -ne 'Windows_NT' -or [Environment]::OSVersion.Version.Major -lt 10) {
            Say-Fail 'этот установщик работает только в Windows 10 или 11.'
            return $false
        }
        if ($PSVersionTable.PSVersion.Major -lt 5) {
            Say-Fail 'нужен Windows PowerShell 5.1 или новее.'
            return $false
        }
        $arch = $env:PROCESSOR_ARCHITECTURE
        if ($env:PROCESSOR_ARCHITEW6432) { $arch = $env:PROCESSOR_ARCHITEW6432 }
        if ($arch -ne 'AMD64' -and $arch -ne 'ARM64') {
            Say-Fail "процессор $arch не поддерживается (нужен 64-разрядный)."
            return $false
        }
        if ($env:APP_PORT -and ($env:APP_PORT -notmatch '^\d{1,5}$' -or [int]$env:APP_PORT -lt 1 -or [int]$env:APP_PORT -gt 65535)) {
            Say-Fail 'APP_PORT должен быть числом от 1 до 65535.'
            return $false
        }
        if ($env:COMPOSE_PROJECT_NAME -and $env:COMPOSE_PROJECT_NAME -cnotmatch '^[a-z0-9][a-z0-9_-]*$') {
            Say-Fail 'COMPOSE_PROJECT_NAME может содержать только строчные латинские буквы, цифры, - и _.'
            return $false
        }
        if ($env:MEDSCRIBE_VERSION -and $env:MEDSCRIBE_VERSION -notmatch '^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$') {
            Say-Fail 'MEDSCRIBE_VERSION должен выглядеть как 1.2.3.'
            return $false
        }
        if (-not (Get-Command tar.exe -ErrorAction SilentlyContinue)) {
            Say-Fail 'в вашей Windows нет tar.exe (он есть в Windows 10 версии 1803 и новее). Обновите Windows.'
            return $false
        }
        Say-Ok "Windows, процессор $arch"

        # Docker установлен?
        if (-not (Find-Docker)) {
            Say-Fail 'Docker Desktop не найден.'
            Say-Info 'Установите его: https://www.docker.com/products/docker-desktop/'
            Say-Info 'Запустите, примите условия, дождитесь, пока в трее появится значок кита,'
            Say-Info 'и вставьте ту же строку установки ещё раз.'
            return $false
        }

        # Docker запущен?
        $info = Invoke-Docker @('info', '--format', '{{.MemTotal}} {{.OSType}}')
        if ($info.Code -ne 0) {
            $exe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
            if (-not (Test-Path -LiteralPath $exe)) { $exe = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe' }
            if (-not (Test-Path -LiteralPath $exe)) {
                Say-Fail 'Docker не отвечает. Запустите Docker Desktop и повторите установку.'
                return $false
            }
            Say-Info 'Docker Desktop не запущен, запускаю. Подождите до 3 минут.'
            try { Start-Process -FilePath $exe | Out-Null } catch { }
            $until = (Get-Date).AddSeconds(180)
            while ((Get-Date) -lt $until) {
                Start-Sleep -Seconds 3
                $info = Invoke-Docker @('info', '--format', '{{.MemTotal}} {{.OSType}}')
                if ($info.Code -eq 0) { break }
                Write-Host '.' -NoNewline
            }
            Write-Host ''
            if ($info.Code -ne 0) {
                Say-Fail 'Docker Desktop не запустился за 3 минуты.'
                Say-Info 'Откройте его вручную, примите условия (при первом запуске), дождитесь значка кита'
                Say-Info 'и повторите установку той же строкой.'
                return $false
            }
        }
        Say-Ok 'Docker запущен'

        $parts = ($info.Out.Trim() -split '\s+')
        $memBytes = [int64]0
        $osType = ''
        if ($parts.Count -ge 2) {
            [void][int64]::TryParse($parts[0], [ref]$memBytes)
            $osType = $parts[1]
        }
        if ($osType -and $osType -ne 'linux') {
            Say-Fail 'Docker Desktop работает в режиме Windows-контейнеров.'
            Say-Info 'Правый клик по значку кита в трее, затем "Switch to Linux containers", и повторите.'
            return $false
        }

        # Compose
        $cv = Invoke-Docker @('compose', 'version', '--short')
        if ($cv.Code -ne 0) {
            Say-Fail 'не найден Docker Compose. Обновите Docker Desktop до свежей версии.'
            return $false
        }
        $ver = $cv.Out.Trim().TrimStart('v')
        if ($ver -notmatch '^(\d+)\.(\d+)') {
            Say-Fail "не удалось понять версию Docker Compose: $ver"
            return $false
        }
        $major = [int]$Matches[1]
        $minor = [int]$Matches[2]
        if (-not ($major -gt 2 -or ($major -eq 2 -and $minor -ge 24))) {
            Say-Fail "Docker Compose $ver слишком старый (нужен 2.24 или новее). Обновите Docker Desktop."
            return $false
        }
        Say-Ok "Docker Compose $ver"

        # Память
        if (-not (Test-Flag $env:MEDSCRIBE_SKIP_MEMORY_CHECK)) {
            if ($memBytes -gt 0 -and $memBytes -lt $minMemoryBytes) {
                $gb = [math]::Round($memBytes / 1GB, 1)
                $wslconfig = Join-Path $env:USERPROFILE '.wslconfig'
                Say-Fail "Docker выделил программе только $gb ГБ памяти, а нужно не меньше 8 ГБ (для распознавания речи)."
                Say-Info "Как увеличить (Docker Desktop с WSL2): создайте файл $wslconfig"
                Say-Info 'с двумя строками:'
                Say-Info '    [wsl2]'
                Say-Info '    memory=8GB'
                Say-Info 'затем в PowerShell выполните  wsl --shutdown  и снова запустите Docker Desktop.'
                Say-Info 'Если у вас режим Hyper-V: Docker Desktop, Settings, Resources, Memory.'
                Say-Info 'Если уверены, что памяти хватает: $env:MEDSCRIBE_SKIP_MEMORY_CHECK=''1'' и повторите установку.'
                return $false
            }
            if ($memBytes -gt 0) { Say-Ok ("память Docker " + [math]::Round($memBytes / 1GB, 1) + ' ГБ') }
        }
        return $true
    }

    # ── шаг 2: папка и пакет ─────────────────────────────────────────────────

    function Step-Bundle {
        Say-Step 2 'Готовлю папку и скачиваю пакет программы'

        $dir = $env:MEDSCRIBE_DIR
        if (-not $dir) { $dir = Join-Path $env:USERPROFILE 'medscribe' }
        $dir = (Get-FullDir $dir).TrimEnd('\')
        $S.Dir = $dir

        if ((Test-Path -LiteralPath $dir -PathType Container) -and -not (Test-InProfile $dir)) {
            if (-not (Test-DirOwnerTrusted $dir)) {
                Say-Fail "владелец папки $dir - другой пользователь, ставить MedScribe туда небезопасно. Ничего не изменено."
                Say-Info "Укажите другую папку: `$env:MEDSCRIBE_DIR='C:\medscribe2'"
                return $false
            }
        }

        if (Test-Path -LiteralPath $dir) {
            if (-not (Test-Path -LiteralPath $dir -PathType Container)) {
                Say-Fail "$dir - это файл, а не папка. Укажите другую: `$env:MEDSCRIBE_DIR='C:\medscribe'"
                return $false
            }
            $marker = Join-Path $dir '.medscribe-install'
            $count = @(Get-ChildItem -LiteralPath $dir -Force).Count
            if (Test-Path -LiteralPath $marker) {
                $S.IsUpdate = $true
                foreach ($l in [IO.File]::ReadAllLines($marker)) {
                    if ($l -match '^version=(.+)$') { $S.OldVer = $Matches[1].Trim() }
                }
                Say-Info "Нашёл прежнюю установку в $dir, обновляю. Ваши данные не пострадают."
            } elseif (Test-Path -LiteralPath (Join-Path $dir '.git')) {
                Say-Fail 'здесь ручная установка (git).'
                Say-Info 'Обновляйте её скриптом scripts/update.sh или укажите другую папку:'
                Say-Info "`$env:MEDSCRIBE_DIR='C:\medscribe2'"
                Say-Info 'Данные общие (хранятся в Docker), ничего не удаляйте.'
                return $false
            } elseif ($count -gt 0) {
                Say-Fail "папка $dir не пустая, и это не установка MedScribe."
                Say-Info "Укажите другую папку: `$env:MEDSCRIBE_DIR='C:\medscribe'"
                return $false
            }
        }

        # Хранилище Docker Desktop - виртуальный диск в неизвестном месте (может быть на другом диске),
        # поэтому нехватка места на диске программы только предупреждает и установку не останавливает.
        if (Test-Flag $env:MEDSCRIBE_SKIP_DISK_CHECK) {
            Say-Info 'Проверка свободного места пропущена (MEDSCRIBE_SKIP_DISK_CHECK=1).'
        } else {
            try {
                $drive = New-Object IO.DriveInfo ([IO.Path]::GetPathRoot($dir))
                $free = $drive.AvailableFreeSpace
            } catch { $free = $null }
            if ($null -eq $free) {
                Say-Warn 'Не удалось проверить место. Для первой установки нужно около 15 ГБ: проверьте лимит диска в Docker Desktop (Settings → Resources).'
            } elseif (-not $S.IsUpdate -and $free -lt 15GB) {
                Say-Warn ('На диске программы свободно ' + [math]::Floor($free / 1GB) + ' ГБ, для первой установки нужно около 15 ГБ.')
                Say-Info 'Проверьте свободное место и лимит диска в Docker Desktop (Settings → Resources). Если места не хватит, установка остановится с ошибкой, ваши данные не пострадают.'
                Say-Info 'Отключить проверку: $env:MEDSCRIBE_SKIP_DISK_CHECK=''1'' и повторите установку.'
            } else {
                Say-Ok ('свободно на диске программы: ' + [math]::Floor($free / 1GB) + ' ГБ')
                if ($S.IsUpdate -and $free -lt 5GB) { Say-Warn 'Свободно меньше 5 ГБ. Для обновления и резервной копии может не хватить места.' }
            }
            Say-Info 'Если хранилище Docker перенесено на другой диск, проверьте свободное место и на нём.'
        }

        $S.Tmp = Join-Path ([IO.Path]::GetTempPath()) ('medscribe-install-' + [Guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $S.Tmp -Force | Out-Null
        $bundleFile = Join-Path $S.Tmp $bundleName
        $shaFile = $bundleFile + '.sha256'

        if ($env:MEDSCRIBE_BUNDLE_FILE) {
            $local = Get-FullDir $env:MEDSCRIBE_BUNDLE_FILE
            if (-not (Test-Path -LiteralPath $local -PathType Leaf) -or -not (Test-Path -LiteralPath ($local + '.sha256') -PathType Leaf)) {
                Say-Fail "не найден пакет $local или файл $local.sha256 рядом с ним."
                return $false
            }
            Copy-Item -LiteralPath $local -Destination $bundleFile
            Copy-Item -LiteralPath ($local + '.sha256') -Destination $shaFile
            Say-Info 'Беру пакет из локального файла.'
        } else {
            if ($env:MEDSCRIBE_VERSION) {
                $v = $env:MEDSCRIBE_VERSION.TrimStart('v')
                $base = "https://github.com/$repo/releases/download/v$v"
            } else {
                $base = "https://github.com/$repo/releases/latest/download"
            }
            Say-Info 'Скачиваю пакет программы с GitHub (небольшой файл)...'
            try {
                Invoke-WebRequest -UseBasicParsing -Uri "$base/$bundleName" -OutFile $bundleFile -ErrorAction Stop
                Invoke-WebRequest -UseBasicParsing -Uri "$base/$bundleName.sha256" -OutFile $shaFile -ErrorAction Stop
            } catch {
                Say-Fail 'не удалось скачать пакет с GitHub.'
                Say-Info 'Проверьте интернет (и доступность github.com) и повторите.'
                Say-Info ('Подробности: ' + $_.Exception.Message)
                return $false
            }
        }

        # контрольная сумма
        $expected = ''
        $shaText = (Get-Content -LiteralPath $shaFile -Raw)
        if ($shaText) { $expected = (($shaText.Trim() -split '\s+')[0]).ToLower() }
        $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $bundleFile).Hash.ToLower()
        if (-not $expected -or $expected -ne $actual) {
            Say-Fail 'контрольная сумма пакета не совпала, файл повреждён или подменён. Ничего не установлено.'
            return $false
        }
        Say-Ok 'пакет скачан, контрольная сумма совпала'

        # распаковка (относительными именами, чтобы путь пользователя не мешал tar)
        Push-Location -LiteralPath $S.Tmp
        try {
            & tar.exe -xzf $bundleName | Out-Null
            $code = $LASTEXITCODE
        } finally {
            Pop-Location
        }
        if ($code -ne 0) {
            Say-Fail 'не удалось распаковать пакет.'
            return $false
        }
        $S.Bundle = Join-Path $S.Tmp 'medscribe-bundle'
        $verFile = Join-Path $S.Bundle 'VERSION'
        if (-not (Test-Path -LiteralPath $verFile) -or -not (Test-Path -LiteralPath (Join-Path $S.Bundle 'docker-compose.yml'))) {
            Say-Fail 'в пакете нет нужных файлов (VERSION, docker-compose.yml).'
            return $false
        }
        $S.NewVer = ([IO.File]::ReadAllLines($verFile) | Select-Object -First 1).Trim()
        if ($S.NewVer -notmatch '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$') {
            Say-Fail 'в пакете некорректный номер версии.'
            return $false
        }
        Say-Ok ('версия ' + $S.NewVer)

        # имя проекта compose (для тома с базой)
        if ($env:COMPOSE_PROJECT_NAME) {
            $S.Project = $env:COMPOSE_PROJECT_NAME
        } else {
            $fromEnv = Read-EnvValue 'COMPOSE_PROJECT_NAME'
            if ($fromEnv) { $S.Project = $fromEnv }
        }
        if ($S.IsUpdate -and $S.OldVer -ne $S.NewVer) {
            $vol = Invoke-Docker @('volume', 'inspect', ($S.Project + '_pgdata'))
            if ($vol.Code -eq 0) { $S.NeedBackup = $true }
        } elseif (-not $S.IsUpdate) {
            # база от другой установки (git, ZIP или другая папка): копия нужна и здесь
            $vol = Invoke-Docker @('volume', 'inspect', ($S.Project + '_pgdata'))
            if ($vol.Code -eq 0) { $S.NeedBackup = $true; $S.Foreign = $true }
        }
        return $true
    }

    # ── шаг 3: копия перед обновлением ───────────────────────────────────────

    function Step-Backup {
        Say-Step 3 'Копия данных перед обновлением'
        if (-not $S.NeedBackup) {
            Say-Info 'Копия не нужна: это новая установка или версия не меняется.'
            return $true
        }
        if ($S.Foreign) {
            Say-Info 'В Docker уже есть данные MedScribe от другой установки (git, ZIP или другая папка).'
            Say-Info 'Сначала сохраняю копию базы и ключей.'
            # новых файлов в папке установки ещё нет: поднимаем только базу из файлов пакета
            $where = $S.Bundle
        } else {
            Say-Info ('Версия меняется (' + $S.OldVer + ' на ' + $S.NewVer + '). Сначала сохраняю копию базы и ключей.')
            $where = $S.Dir
        }

        Push-Location -LiteralPath $where
        try {
            return (Invoke-Backup $S.Foreign)
        } finally {
            Pop-Location
        }
    }

    function Invoke-Backup([bool]$Foreign = $false) {
        $port = Get-AppPort
        $startedPg = $false
        if ($Foreign) {
            $volSecrets = Invoke-Docker @('volume', 'inspect', ($S.Project + '_secrets'))
            if ($volSecrets.Code -ne 0) {
                Say-Fail ('есть база (' + $S.Project + '_pgdata), но нет хранилища ключей (' + $S.Project + '_secrets): без ключей протоколы не прочитать. Ничего не изменено.')
                Say-Info 'Проверьте COMPOSE_PROJECT_NAME и напишите автору.'
                return $false
            }
            $running = Invoke-Docker @('compose', 'ps', '-q', 'postgres')
            if ($running.Code -ne 0) {
                Say-Fail 'не удалось проверить состояние базы. Ничего не изменено.'
                Say-Info $running.Out
                return $false
            }
            if (-not $running.Out.Trim()) {
                $upArgs = @('compose', 'up', '-d')
                if (Test-Flag $env:MEDSCRIBE_NO_PULL) { $upArgs += @('--pull', 'never') }
                $upArgs += 'postgres'
                $up = Invoke-Docker $upArgs
                if ($up.Code -ne 0) {
                    Say-Fail 'не удалось запустить базу, чтобы снять копию. Ничего не изменено.'
                    Say-Info $up.Out
                    return $false
                }
                $startedPg = $true
            }
            $ready = $false
            $until = (Get-Date).AddSeconds(120)
            while ((Get-Date) -lt $until) {
                $pr = Invoke-Docker @('compose', 'exec', '-T', 'postgres', 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'medscribe')
                if ($pr.Code -eq 0) { $ready = $true; break }
                Start-Sleep -Seconds 3
            }
            if (-not $ready) {
                if ($startedPg) { [void](Invoke-Docker @('compose', 'stop', 'postgres')) }
                Say-Fail 'база не отвечает, копию снять нельзя. Ничего не изменено.'
                return $false
            }
            # ключи берём из тома, подключённого к базе (только чтение)
            $secService = 'postgres'
            $secDir = '/run/secrets/medscribe'
        } else {
            $up = Invoke-Docker @('compose', 'up', '-d')
            if ($up.Code -ne 0) {
                Say-Fail 'не удалось запустить прежнюю версию, чтобы снять копию. Ничего не изменено.'
                Say-Info $up.Out
                return $false
            }
            if (-not (Wait-Db $port 300)) {
                Say-Fail 'база не отвечает, копию снять нельзя. Ничего не изменено.'
                return $false
            }
            $secService = 'app'
            $secDir = '/app/secrets'
        }

        $backupDir = Join-Path $env:USERPROFILE 'medscribe-backup'
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        # папка копий доступна только текущему пользователю (если не получится, копия всё равно делается)
        try {
            $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
            & icacls.exe $backupDir /inheritance:r /grant:r ('*' + $sid + ':(OI)(CI)F') *> $null
            if ($LASTEXITCODE -ne 0) { Say-Warn ('Не удалось ограничить доступ к папке ' + $backupDir + ': проверьте её права вручную.') }
        } catch {
            Say-Warn ('Не удалось ограничить доступ к папке ' + $backupDir + ': проверьте её права вручную.')
        }
        $stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
        $dump = Join-Path $backupDir "medscribe-$stamp.dump"
        $secrets = Join-Path $backupDir "medscribe-secrets-$stamp.tar"
        $created = @()
        $ok = $false

        try {
            foreach ($f in @($dump, $secrets)) {
                if (Test-Path -LiteralPath $f) {
                    Say-Fail "файл уже существует: $f. Подождите секунду и повторите."
                    return $false
                }
            }
            $pg = Invoke-Docker @('compose', 'ps', '-q', 'postgres')
            $ap = Invoke-Docker @('compose', 'ps', '-q', $secService)
            $pgId = $pg.Out.Trim()
            $appId = $ap.Out.Trim()
            if ($pg.Code -ne 0 -or $ap.Code -ne 0 -or -not $pgId -or -not $appId) {
                Say-Fail 'не нашёл запущенные контейнеры для копии.'
                return $false
            }

            Say-Info 'Делаю копию базы...'
            $created += $dump
            $r = Invoke-Docker @('compose', 'exec', '-T', 'postgres', 'pg_dump', '-U', 'postgres', '-d', 'medscribe', '-Fc', '-f', '/tmp/ms-backup.dump')
            if ($r.Code -ne 0) { Say-Fail 'не удалось снять копию базы.'; Say-Info $r.Out; return $false }
            $r = Invoke-Docker @('compose', 'exec', '-T', 'postgres', 'pg_restore', '--list', '/tmp/ms-backup.dump')
            if ($r.Code -ne 0) { Say-Fail 'копия базы повреждена: она не читается.'; return $false }
            $r = Invoke-Docker @('cp', ($pgId + ':/tmp/ms-backup.dump'), $dump)
            [void](Invoke-Docker @('compose', 'exec', '-T', 'postgres', 'rm', '-f', '/tmp/ms-backup.dump'))
            if ($r.Code -ne 0 -or -not (Test-Path -LiteralPath $dump) -or (Get-Item -LiteralPath $dump).Length -le 0) {
                Say-Fail 'не удалось сохранить копию базы на компьютер.'
                return $false
            }

            Say-Info 'Делаю копию ключей (секретов)...'
            $created += $secrets
            $r = Invoke-Docker @('compose', 'exec', '-T', $secService, 'tar', '-C', $secDir, '-cf', '/tmp/ms-secrets.tar', '.')
            if ($r.Code -ne 0) { Say-Fail 'не удалось снять копию ключей.'; Say-Info $r.Out; return $false }
            $r = Invoke-Docker @('cp', ($appId + ':/tmp/ms-secrets.tar'), $secrets)
            [void](Invoke-Docker @('compose', 'exec', '-T', $secService, 'rm', '-f', '/tmp/ms-secrets.tar'))
            if ($r.Code -ne 0 -or -not (Test-Path -LiteralPath $secrets) -or (Get-Item -LiteralPath $secrets).Length -le 0) {
                Say-Fail 'не удалось сохранить копию ключей на компьютер.'
                return $false
            }
            & tar.exe -tf $secrets *> $null
            if ($LASTEXITCODE -ne 0) { Say-Fail 'копия ключей повреждена: архив не читается.'; return $false }
            $ok = $true
        } finally {
            # временные файлы внутри контейнеров удаляем при любом исходе
            if ($pgId) { [void](Invoke-Docker @('compose', 'exec', '-T', 'postgres', 'rm', '-f', '/tmp/ms-backup.dump')) }
            if ($appId) { [void](Invoke-Docker @('compose', 'exec', '-T', $secService, 'rm', '-f', '/tmp/ms-secrets.tar')) }
            if (-not $ok) {
                foreach ($f in $created) { Remove-Item -LiteralPath $f -Force -ErrorAction SilentlyContinue }
                Say-Warn 'Копия не сделана, неполные файлы удалены. Установка остановлена, ничего не изменено.'
            }
            if ($startedPg) { [void](Invoke-Docker @('compose', 'stop', 'postgres')) }
        }

        Say-Ok 'копия сохранена'
        Say-Info "  база:  $dump"
        Say-Info "  ключи: $secrets"
        Say-Warn 'Без файла ключей протоколы из базы прочитать нельзя. Храните его отдельно от копии базы'
        Say-Warn '(например, на другом носителе) и не отправляйте в облако без шифрования.'
        return $true
    }

    # ── шаг 4: файлы, скачивание образов, запуск ─────────────────────────────

    function Step-Run {
        Say-Step 4 'Устанавливаю файлы и запускаю программу'

        if (-not (Test-Path -LiteralPath $S.Dir)) { New-Item -ItemType Directory -Path $S.Dir -Force | Out-Null }
        # папка вне профиля (например C:\medscribe) наследует права корня диска: другие пользователи могли бы
        # подменить open.ps1 или docker-compose.yml. Сначала /reset /T убирает все прежние явные права (в том
        # числе чужие) в папке и внутри, затем отключаем наследование и оставляем полный доступ себе, SYSTEM
        # и администраторам. Так не нужно искать чужие записи по одной.
        if (-not (Test-InProfile $S.Dir)) {
            try {
                $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
                & icacls.exe $S.Dir /reset /T /C *> $null
                & icacls.exe $S.Dir /inheritance:r /grant:r ('*' + $sid + ':(OI)(CI)F') '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' *> $null
                if ($LASTEXITCODE -ne 0) { Say-Warn ('Не удалось ограничить доступ к папке ' + $S.Dir + ': проверьте её права вручную.') }
            } catch {
                Say-Warn ('Не удалось ограничить доступ к папке ' + $S.Dir + ': проверьте её права вручную.')
            }
        }
        $keep = @('.env', 'docker-compose.override.yml')
        try {
            foreach ($item in (Get-ChildItem -LiteralPath $S.Bundle -Force)) {
                if ($keep -contains $item.Name) { continue }
                Copy-Item -LiteralPath $item.FullName -Destination $S.Dir -Recurse -Force -ErrorAction Stop
            }
            $markerText = "version=$($S.NewVer)`nmode=desktop`n"
            [IO.File]::WriteAllText((Join-Path $S.Dir '.medscribe-install'), $markerText, (New-Object Text.UTF8Encoding($false)))
            if ($env:APP_PORT) { Set-EnvValue 'APP_PORT' $env:APP_PORT }
            if ($env:COMPOSE_PROJECT_NAME) { Set-EnvValue 'COMPOSE_PROJECT_NAME' $env:COMPOSE_PROJECT_NAME }
        } catch {
            Say-Fail 'не удалось записать файлы в папку установки.'
            Say-Info ('Подробности: ' + $_.Exception.Message)
            return $false
        }
        Say-Ok "файлы в $($S.Dir)"

        Push-Location -LiteralPath $S.Dir
        $S.Pushed = $true

        $noPull = Test-Flag $env:MEDSCRIBE_NO_PULL
        if (-not $noPull) {
            Say-Info 'Скачиваю программу (около 1,2 ГБ, можно пока выпить чаю)...'
            & docker compose pull | Out-Host
            if ($LASTEXITCODE -ne 0) {
                Say-Fail 'не удалось скачать программу.'
                Say-Info 'Проверьте интернет (нужен доступ к ghcr.io) и повторите ту же команду: скачанное не пропадёт.'
                return $false
            }
        }

        Say-Info 'Запускаю...'
        $upArgs = @('compose', 'up', '-d')
        if ($noPull) { $upArgs += @('--pull', 'never') }
        $up = Invoke-Docker $upArgs
        if ($up.Code -ne 0) {
            Say-Fail 'не удалось запустить программу.'
            if ($up.Out -match 'port is already allocated|address already in use|Ports are not available') {
                Say-Info 'Порт занят другой программой. Выберите другой и повторите:'
                Say-Info '    $env:APP_PORT=''3001''  и снова строку установки.'
            } else {
                Say-Info $up.Out
                Say-Info 'Подробности: docker compose logs (в папке установки).'
            }
            return $false
        }
        Say-Ok 'программа запущена'
        return $true
    }

    # ── шаг 5: ждём базу, открываем браузер ──────────────────────────────────

    function Get-FirstRunUrl([int]$port) {
        $root = "http://localhost:$port/"
        $needsSetup = $null
        # один запрос на попытку: у /api/setup/status лимит 60 запросов за 15 минут
        for ($i = 0; $i -lt 3; $i++) {
            try {
                $st = Invoke-RestMethod -UseBasicParsing -Uri "http://127.0.0.1:$port/api/setup/status" -TimeoutSec 10 -ErrorAction Stop
                $needsSetup = $st.needsSetup
                if ($null -ne $needsSetup) { break }
            } catch { }
            Start-Sleep -Seconds 3
        }
        if ($needsSetup -ne $true) { return @{ Url = $root; Setup = $false } }

        $until = (Get-Date).AddSeconds(60)
        while ((Get-Date) -lt $until) {
            $logs = Invoke-Docker @('compose', 'logs', '--no-log-prefix', 'app')
            $m = [regex]::Matches($logs.Out, '/setup#token=([A-Z0-9-]+)')
            if ($m.Count -gt 0) {
                return @{ Url = ("http://localhost:$port/setup#token=" + $m[$m.Count - 1].Groups[1].Value); Setup = $true }
            }
            Start-Sleep -Seconds 3
        }
        return @{ Url = ("http://localhost:$port/setup"); Setup = $true; NoToken = $true }
    }

    function Step-Open {
        Say-Step 5 'Жду готовности и открываю MedScribe'
        $port = Get-AppPort
        Say-Info 'Жду, пока запустится база данных (до 5 минут)...'
        $h = Wait-Db $port 300
        if (-not $h) {
            Say-Fail 'база данных не запустилась за 5 минут.'
            Say-Info 'Посмотрите причину: docker compose logs  (в папке установки), затем повторите установку.'
            return $false
        }
        Say-Ok 'программа отвечает'

        $link = Get-FirstRunUrl $port
        $update = Test-Flag $env:MEDSCRIBE_UPDATE
        $noBrowser = Test-Flag $env:MEDSCRIBE_NO_BROWSER
        Write-Host ''
        if ($update) {
            Say-Info "Адрес программы: http://localhost:$port/"
        } else {
            if ($link.Setup) {
                if ($link.NoToken) {
                    Say-Warn 'Не нашёл код первого запуска в журнале. Посмотрите его командой:'
                    Say-Warn '    docker compose logs app    (строка "Код первого запуска")'
                    Say-Info ('Откройте: ' + $link.Url)
                } else {
                    Say-Info 'Откройте эту ссылку и создайте учётную запись врача:'
                    Write-Host ('  ' + $link.Url) -ForegroundColor Green
                }
            } else {
                Say-Info 'Откройте программу:'
                Write-Host ('  ' + $link.Url) -ForegroundColor Green
            }
            if (-not $noBrowser) {
                try { Start-Process -FilePath $link.Url | Out-Null; Say-Info 'Открываю в браузере...' }
                catch { Say-Warn 'Браузер не открылся сам: скопируйте ссылку выше в адресную строку.' }
            }
        }
        return $true
    }

    # ярлык MedScribe на рабочем столе: зовёт scripts\open.ps1 (папку для проверок можно подменить: MEDSCRIBE_DESKTOP_DIR).
    # При обновлении ярлык только обновляется (удалённый врачом не возвращается); чужой файл с тем же именем не трогаем.
    function Step-Shortcut {
        $S.Shortcut = ''
        if (Test-Flag $env:MEDSCRIBE_NO_SHORTCUT) { return }
        $openPs = Join-Path $S.Dir 'scripts\open.ps1'
        if (-not (Test-Path -LiteralPath $openPs)) { return }
        try {
            $desk = $env:MEDSCRIBE_DESKTOP_DIR
            if (-not $desk) { $desk = [Environment]::GetFolderPath('Desktop') }
            $lnk = Join-Path $desk 'MedScribe.lnk'
            $sh = New-Object -ComObject WScript.Shell
            if (Test-Path -LiteralPath $lnk) {
                # наш ярлык запускает scripts\open.ps1
                $old = $sh.CreateShortcut($lnk)
                if ($old.Arguments -notmatch 'scripts\\open\.ps1') {
                    Say-Warn "На рабочем столе уже есть $lnk, созданный не установщиком: не трогаю."
                    return
                }
            } elseif (Test-Flag $env:MEDSCRIBE_UPDATE) {
                return
            }
            if (-not (Test-Path -LiteralPath $desk)) { New-Item -ItemType Directory -Path $desk -Force | Out-Null }
            $ps = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
            $sc = $sh.CreateShortcut($lnk)
            $sc.TargetPath = $ps
            $sc.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $openPs + '"'
            $sc.WorkingDirectory = $S.Dir
            $sc.Description = 'Открыть MedScribe'
            $ico = Join-Path $S.Dir 'scripts\icons\medscribe.ico'
            if (Test-Path -LiteralPath $ico) { $sc.IconLocation = $ico + ',0' }
            $sc.Save()
            $S.Shortcut = $lnk
            Say-Ok 'ярлык MedScribe на рабочем столе'
        } catch {
            Say-Warn 'Ярлык на рабочем столе создать не получилось, на работу программы это не влияет.'
            Say-Info ('Открывать программу можно по адресу http://localhost:' + (Get-AppPort) + '/')
        }
    }

    # ── шаг 6: модель речи ───────────────────────────────────────────────────

    function Format-Gb([double]$kb) {
        return (([double]$kb * 1024 / 1e9).ToString('0.0', [Globalization.CultureInfo]::InvariantCulture)).Replace('.', ',')
    }

    function Step-Tone {
        Say-Step 6 'Модель распознавания речи'
        $port = Get-AppPort
        $h = Get-Health $port
        if ($h -and $h.tone -eq $true) {
            Say-Ok 'модель речи уже готова'
            return $true
        }
        Say-Info 'Загрузка модели занимает время, но пользоваться программой можно уже сейчас:'
        Say-Info 'запись приёма заработает, когда модель загрузится. Окно можно закрыть, загрузка продолжится.'
        Say-Info '(Ctrl+C останавливает только показ прогресса, установка идёт в фоне.)'

        $tty = -not [Console]::IsOutputRedirected
        $started = Get-Date
        $firstKb = [int64]-1
        $lastKb = [int64]-1
        $lastGrowth = Get-Date
        $hinted = $false
        $done = $false
        try {
            while (((Get-Date) - $started).TotalHours -lt 3) {
                $h = Get-Health $port
                if ($h -and $h.tone -eq $true) { $done = $true; break }

                $du = Invoke-Docker @('compose', 'exec', '-T', 'tone', 'du', '-sk', '/models')
                if ($du.Code -eq 0 -and $du.Out -match '^\s*(\d+)') {
                    $kb = [int64]$Matches[1]
                    if ($firstKb -lt 0) { $firstKb = $kb; $lastKb = $kb }
                    if ($kb -gt $lastKb) { $lastGrowth = Get-Date; $lastKb = $kb }

                    $pct = [math]::Min(99, [int][math]::Floor($kb * 100 / $toneExpectedKb))
                    $text = 'Загружаю модель распознавания речи: ' + (Format-Gb $kb) + ' из ~' + (Format-Gb $toneExpectedKb) + " ГБ ($pct %)"
                    $secs = ((Get-Date) - $started).TotalSeconds
                    if ($kb -gt $firstKb -and $secs -gt 15) {
                        $rate = ($kb - $firstKb) / $secs
                        $left = [math]::Max(0, $toneExpectedKb - $kb)
                        $mins = [int][math]::Ceiling($left / $rate / 60)
                        if ($mins -gt 0) { $text += ", осталось ~$mins мин" }
                    }
                    if ($tty) { Write-Host ("`r" + $text.PadRight(80)) -NoNewline } else { Write-Host $text }
                }

                if (-not $hinted -and ((Get-Date) - $lastGrowth).TotalMinutes -ge 10) {
                    $hinted = $true
                    Write-Host ''
                    Say-Warn 'Модель не загружается уже 10 минут. Проверьте интернет.'
                    Say-Warn 'Если Hugging Face у вас недоступен, укажите зеркало: добавьте в файл .env в папке'
                    Say-Warn 'программы строку HF_ENDPOINT=https://адрес-зеркала и выполните: docker compose up -d'
                }
                Start-Sleep -Seconds 5
            }
        } finally {
            if (-not $done) {
                if ($tty) { Write-Host '' }
                Say-Info 'Установка продолжится в фоне. Чтобы снова увидеть прогресс и ссылку,'
                Say-Info 'запустите ту же команду установки ещё раз.'
            }
        }
        if ($done) {
            if ($tty) { Write-Host '' }
            Say-Ok 'модель распознавания речи готова'
        }
        return $true
    }

    function Show-Summary {
        $port = Get-AppPort
        $h = Get-Health $port
        Write-Host ''
        Write-Host 'MedScribe установлен.' -ForegroundColor Green
        Write-Host ''
        if ($h -and $h.llm -eq $true) {
            Say-Info 'Языковая модель подключена.'
        } else {
            Say-Info 'Осталось подключить языковую модель: Профиль, затем Настройки ИИ.'
        }
        if ($S.Shortcut) {
            Say-Info 'Ярлык "MedScribe" на рабочем столе открывает программу каждый день (сам запустит Docker, если нужно).'
            Say-Info "Адрес на случай, если ярлык не сработает: http://localhost:$port/"
        } else {
            Say-Info "Адрес: http://localhost:$port/"
        }
        Say-Info 'Первая пробная запись: https://github.com/Allmostkill/medscribe/blob/main/docs/FIRST_PROTOCOL.md'
        Say-Info 'Если нужна помощь с ошибкой: см. docs/HELP.md в инструкции на GitHub.'
        Say-Info 'Чтобы программа работала после перезагрузки компьютера, включите автозапуск:'
        Say-Info 'Docker Desktop, Settings, General, "Start Docker Desktop when you sign in".'
        Say-Info 'Обновление до новой версии: та же строка установки ещё раз. Данные сохранятся.'
        Say-Info "    $installCommand"
    }

    # ── основной порядок ─────────────────────────────────────────────────────

    try {
        Write-Host 'Установка MedScribe' -ForegroundColor Cyan
        if (-not (Step-Checks)) { return }
        if (-not (Step-Bundle)) { return }
        if (-not (Step-Backup)) { return }
        if (-not (Step-Run)) { return }
        if (-not (Step-Open)) { return }
        Step-Shortcut
        if (-not (Test-Flag $env:MEDSCRIBE_UPDATE)) { [void](Step-Tone) }
        Show-Summary
    } finally {
        if ($S.Pushed) { Pop-Location }
        if ($S.Tmp -and (Test-Path -LiteralPath $S.Tmp)) {
            Remove-Item -LiteralPath $S.Tmp -Recurse -Force -ErrorAction SilentlyContinue
        }
        if ($oldEncoding) { try { [Console]::OutputEncoding = $oldEncoding } catch { } }
    }
}

Install-MedScribe
