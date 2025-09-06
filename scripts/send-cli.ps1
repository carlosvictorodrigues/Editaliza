param(
  [Parameter(Mandatory=$true)][string]$CommandName,
  [Parameter(Mandatory=$true)][string]$PromptB64,
  [Parameter(Mandatory=$false)][string]$WorkingDir = ".",
  [Parameter(Mandatory=$false)][int]$TimeoutMs = 240000
)

$ErrorActionPreference = "Stop"
$prompt = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($PromptB64))

$Patterns = @(
  '{0} chat --input "{1}"',
  '{0} chat --prompt "{1}"',
  '{0} chat -p "{1}"',
  '{0} chat "{1}"',
  'powershell -NoProfile -Command "Write-Output @''{1}''@ | {0} chat"',
  '{0} ask "{1}"',
  'powershell -NoProfile -Command "Write-Output @''{1}''@ | {0}"'
)

Set-Location -Path $WorkingDir

function Invoke-With-Timeout {
  param([string]$Cmd, [int]$Timeout=240000)
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "powershell.exe"
  $psi.Arguments = "-NoProfile -Command $Cmd"
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $proc = New-Object System.Diagnostics.Process
  $proc.StartInfo = $psi
  [void]$proc.Start()
  if (-not $proc.WaitForExit($Timeout)) {
    try { $proc.Kill() } catch {}
    throw "timeout"
  }
  $stdout = $proc.StandardOutput.ReadToEnd()
  $stderr = $proc.StandardError.ReadToEnd()
  if ($proc.ExitCode -ne 0 -and $stderr) {
    throw $stderr
  }
  return $stdout
}

$escaped = $prompt.Replace('"','`"')

foreach ($p in $Patterns) {
  $cmd = [string]::Format($p, $CommandName, $escaped)
  try {
    $out = Invoke-With-Timeout -Cmd $cmd -Timeout $TimeoutMs
    if ($out -and $out.Trim().Length -gt 0) { Write-Output $out; exit 0 }
  } catch { continue }
}

throw "Nenhum padrão funcionou para $CommandName. Ajuste scripts/send-cli.ps1."
