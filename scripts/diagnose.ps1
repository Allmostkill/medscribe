param([string]$InstallDir = (Split-Path -Parent $PSScriptRoot))
# Только разрешённые поля. Не выгружает журналы, окружение или содержимое базы.
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $InstallDir -PathType Container)) { throw 'Папка программы не найдена.' }
$report = New-Object 'System.Collections.Generic.List[string]'
$report.Add('MedScribe diagnostic v1')
$report.Add('time_utc=' + [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'))
$report.Add('os=Windows')
$arch = $env:PROCESSOR_ARCHITECTURE
if ($env:PROCESSOR_ARCHITEW6432) { $arch = $env:PROCESSOR_ARCHITEW6432 }
if ($arch -notin @('AMD64', 'ARM64')) { $arch = 'unknown' }
$report.Add('arch=' + $arch)
$version = 'unknown'
$versionPath = Join-Path $InstallDir 'VERSION'
if (Test-Path -LiteralPath $versionPath) {
    $candidate = [IO.File]::ReadAllText($versionPath).Trim()
    if ($candidate -cmatch '\A[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?\z') { $version = $candidate }
}
$report.Add('version=' + $version)

function Invoke-DiagnosticDocker([string]$Arguments) {
    $p = New-Object Diagnostics.Process
    $p.StartInfo.FileName = $script:DockerExe
    $p.StartInfo.Arguments = $Arguments
    $p.StartInfo.WorkingDirectory = $InstallDir
    $p.StartInfo.UseShellExecute = $false
    $p.StartInfo.CreateNoWindow = $true
    $p.StartInfo.RedirectStandardOutput = $true
    $p.StartInfo.RedirectStandardError = $true
    try {
        [void]$p.Start()
        $stdout = $p.StandardOutput.ReadToEndAsync()
        $stderr = $p.StandardError.ReadToEndAsync()
        if (-not $p.WaitForExit(10000)) { $p.Kill(); return $null }
        if ($p.ExitCode -ne 0) { return $null }
        return $stdout.GetAwaiter().GetResult().Trim()
    } catch { return $null } finally { $p.Dispose() }
}

# Запускаем docker.exe по полному пути, а не по имени из текущей папки или PATH.
$script:DockerExe = $null
$found = Get-Command docker.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if ($found) { $script:DockerExe = $found.Source }
if (-not $script:DockerExe) {
    foreach ($bin in @("$env:ProgramFiles\Docker\Docker\resources\bin", "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin")) {
        $candidate = Join-Path $bin 'docker.exe'
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { $script:DockerExe = $candidate; break }
    }
}
if ($script:DockerExe) {
    $report.Add('docker_cli=present')
    $engine = Invoke-DiagnosticDocker 'info --format "{{.OSType}}"'
    if ($engine) { $report.Add('docker_engine=reachable') } else { $report.Add('docker_engine=unreachable') }
    foreach ($service in @('app', 'tone', 'postgres', 'migrate')) {
        $state = $null
        if ($engine) { $state = Invoke-DiagnosticDocker ('compose ps -a --format "{{.State}}" ' + $service) }
        if ($state -notin @('running', 'exited', 'created', 'restarting', 'paused', 'dead')) { $state = 'unknown' }
        $report.Add('service_' + $service + '=' + $state)
    }
} else {
    $report.Add('docker_cli=missing')
    $report.Add('docker_engine=unknown')
}
$portText = $env:APP_PORT
$envPath = Join-Path $InstallDir '.env'
if (-not $portText -and (Test-Path -LiteralPath $envPath)) {
    foreach ($line in [IO.File]::ReadLines($envPath)) {
        if ($line -match '^\s*APP_PORT=["'']?(\d+)["'']?\s*$') { $portText = $Matches[1] }
    }
}
$port = 3000
$parsed = 0
if ([int]::TryParse($portText, [ref]$parsed) -and $parsed -ge 1 -and $parsed -le 65535) { $port = $parsed }
$health = $null
try { $health = Invoke-RestMethod -UseBasicParsing -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 5 } catch { }
foreach ($field in @('db', 'tone', 'llm')) {
    $value = 'unknown'
    if ($null -ne $health -and $health.$field -is [bool]) { $value = $health.$field.ToString().ToLowerInvariant() }
    $report.Add('health_' + $field + '=' + $value)
}
$report.Add('health_llm means configured, not a successful provider test.')
$outputPath = Join-Path $InstallDir ('medscribe-diagnostic-' + [guid]::NewGuid().ToString('N') + '.txt')
[IO.File]::WriteAllLines($outputPath, $report, (New-Object Text.UTF8Encoding($true)))
Write-Host ("Диагностика сохранена: " + (Split-Path -Leaf $outputPath) + " (в папке программы)")
Write-Host 'Откройте файл и проверьте содержимое перед отправкой. Отчёт не отправлен автоматически.'
Write-Host 'Сообщить о проблеме: https://github.com/Allmostkill/medscribe/issues/new?template=bug_report.md'
