# setup.ps1 — Windows: the one-time step of the agents' enclosure, run elevated (MOD-agent-enclosure, Parts; ARC-054).
#
# Module: MOD-agent-enclosure
#
# The Bridge runs this text through Windows' elevation prompt, which an administrator confirms, followed by one call of Invoke-SetUp. It makes the
# Bridge's own local account — a member of Users only, its password the one the Bridge wrote into its data folder, never expiring and not to be
# changed by the account —, or sets that password on the account where it exists, and hides the account from the sign-in screen.

function Invoke-SetUp {
  param([string]$Account, [string]$PasswordFile)
  $ErrorActionPreference = 'Stop'
  $record = Get-Content -Raw -LiteralPath $PasswordFile | ConvertFrom-Json
  $secure = ConvertTo-SecureString -String $record.password -AsPlainText -Force
  if (Get-LocalUser -Name $Account -ErrorAction SilentlyContinue) {
    Set-LocalUser -Name $Account -Password $secure -PasswordNeverExpires $true
  } else {
    New-LocalUser -Name $Account -Password $secure -PasswordNeverExpires -UserMayNotChangePassword -Description "Agent M Bridge: its coding agents" | Out-Null
  }
  $users = (Get-LocalGroup -SID 'S-1-5-32-545').Name
  Add-LocalGroupMember -Group $users -Member $Account -ErrorAction SilentlyContinue
  $list = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon\SpecialAccounts\UserList'
  New-Item -Path $list -Force | Out-Null
  New-ItemProperty -Path $list -Name $Account -Value 0 -PropertyType DWord -Force | Out-Null
}
