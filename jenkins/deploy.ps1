# Uploads a local folder to the cPanel host over SFTP (or FTP) using WinSCP.
# Secrets come from environment variables set by the Jenkinsfile:
#   DEPLOY_HOST, DEPLOY_USER, DEPLOY_PASS, DEPLOY_PORT (optional)
#
# Examples:
#   ./jenkins/deploy.ps1 -LocalPath "evangadi2/dist" -RemotePath "/home/USER/public_html"
#   ./jenkins/deploy.ps1 -LocalPath "Backend" -RemotePath "/home/USER/app" -FileMask "|.env;.git/" -TouchRestart

param(
  [Parameter(Mandatory = $true)][string]$LocalPath,
  [Parameter(Mandatory = $true)][string]$RemotePath,
  [ValidateSet("sftp", "ftp", "ftps")][string]$Protocol = "sftp",
  [string]$FileMask = "",        # WinSCP exclude mask, e.g. "|.env;.git/;node_modules/"
  [switch]$TouchRestart          # upload tmp/restart.txt to restart a cPanel/Passenger Node app
)

$ErrorActionPreference = "Stop"

$deployHost = $env:DEPLOY_HOST
$user       = $env:DEPLOY_USER
$pass       = $env:DEPLOY_PASS
$port       = if ($env:DEPLOY_PORT) { $env:DEPLOY_PORT } elseif ($Protocol -eq "sftp") { "22" } else { "21" }

if (-not $deployHost -or -not $user -or -not $pass) {
  throw "Missing DEPLOY_HOST / DEPLOY_USER / DEPLOY_PASS environment variables."
}

# Resolve local path to absolute
$absLocal = (Resolve-Path $LocalPath).Path

# Locate WinSCP.com (console binary)
$cmd = Get-Command winscp.com -ErrorAction SilentlyContinue
$winscp = if ($cmd) { $cmd.Source } else { $null }
if (-not $winscp) {
  foreach ($p in @(
      "C:\Program Files (x86)\WinSCP\WinSCP.com",
      "C:\Program Files\WinSCP\WinSCP.com")) {
    if (Test-Path $p) { $winscp = $p; break }
  }
}
if (-not $winscp) { throw "WinSCP.com not found. Install WinSCP and add its folder to PATH." }

# URL-encode credentials for the open URL
Add-Type -AssemblyName System.Web
$encUser = [System.Web.HttpUtility]::UrlEncode($user)
$encPass = [System.Web.HttpUtility]::UrlEncode($pass)

switch ($Protocol) {
  "sftp" {
    # -hostkey=* accepts any SSH host key. Pin it for production.
    $open = "open sftp://$encUser`:$encPass@$deployHost`:$port/ -hostkey=`"*`""
  }
  "ftps" {
    # Explicit FTP over TLS (recommended for cPanel). -certificate=* accepts any TLS cert.
    $open = "open ftpes://$encUser`:$encPass@$deployHost`:$port/ -certificate=`"*`""
  }
  default {
    # Plain, UNENCRYPTED FTP — credentials sent in clear text. Use only if TLS is unavailable.
    $open = "open ftp://$encUser`:$encPass@$deployHost`:$port/"
  }
}

$sync = "synchronize remote `"$absLocal`" `"$RemotePath`""
if ($FileMask) { $sync += " -filemask=`"$FileMask`"" }

$lines = @(
  "option batch abort",
  "option confirm off",
  $open,
  $sync
)

$marker = $null
if ($TouchRestart) {
  $marker = New-TemporaryFile
  $lines += "put `"$($marker.FullName)`" `"$RemotePath/tmp/restart.txt`""
}
$lines += "exit"

$scriptFile = New-TemporaryFile
Set-Content -Path $scriptFile -Value $lines -Encoding ascii

try {
  & $winscp /ini=nul /script="$scriptFile"
  if ($LASTEXITCODE -ne 0) { throw "WinSCP deploy failed (exit code $LASTEXITCODE)." }
  Write-Host "Deployed '$absLocal' -> '$RemotePath'"
}
finally {
  Remove-Item $scriptFile -ErrorAction SilentlyContinue
  if ($marker) { Remove-Item $marker -ErrorAction SilentlyContinue }
}
