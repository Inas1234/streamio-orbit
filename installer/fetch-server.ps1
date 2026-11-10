# Run by Setup when no Stremio 5 / Stremio Service is installed. Downloads Stremio's official
# Stremio Service package from Stremio's GitHub releases and copies its streaming server into the
# Streamio Orbit folder. The files come straight from Stremio; this repo doesn't redistribute them.
param([Parameter(Mandatory = $true)][string]$Dest)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # the progress bar slows Invoke-WebRequest a lot
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$url = 'https://github.com/Stremio/stremio-service/releases/latest/download/stremio-service-windows.zip'
$work = Join-Path $env:TEMP ('streamio-orbit-server-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null
try {
    $zip = Join-Path $work 'stremio-service.zip'
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $zip
    $unpacked = Join-Path $work 'files'
    Expand-Archive -Path $zip -DestinationPath $unpacked -Force

    $server = Get-ChildItem -Path $unpacked -Recurse -Filter 'server.js' | Select-Object -First 1
    if (-not $server) { throw 'server.js is missing from the Stremio Service package' }
    $src = $server.DirectoryName
    if (-not (Test-Path (Join-Path $src 'stremio-runtime.exe'))) { throw 'stremio-runtime.exe is missing from the Stremio Service package' }

    foreach ($name in 'server.js', 'stremio-runtime.exe', 'ffmpeg.exe', 'ffprobe.exe') {
        $file = Join-Path $src $name
        if (Test-Path $file) { Copy-Item -Path $file -Destination $Dest -Force }
    }
    $license = Join-Path $src 'LICENSE.md'
    if (Test-Path $license) { Copy-Item -Path $license -Destination (Join-Path $Dest 'STREMIO-SERVICE-LICENSE.md') -Force }
    exit 0
}
catch {
    Write-Output $_.Exception.Message
    exit 1
}
finally {
    Remove-Item -Path $work -Recurse -Force -ErrorAction SilentlyContinue
}
