# launcher.ps1 — Windows: starts one program as the Bridge's own account (MOD-agent-enclosure, Parts; ARC-054).
#
# Module: MOD-agent-enclosure
#
# The Bridge runs this text with `powershell.exe -EncodedCommand`, followed by one call of Invoke-Launch. The first line of the standard input is the
# account's password, which the Bridge keeps in its data folder; it is read before anything else and passed to Windows only, never to the program.
# The program is started with the account's own profile and the environment of this launcher, which the Bridge chose (agentEnvironment); its standard
# streams are relayed, and it is put into a job object that ends it, and every process it starts, when this launcher ends.

function Invoke-Launch {
  param([string]$Account, [string]$Directory, [string]$Program, [string]$ArgumentLine, [switch]$Console)
  $ErrorActionPreference = 'Stop'
  [Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
  $password = [Console]::In.ReadLine()
  $secure = ConvertTo-SecureString -String $password -AsPlainText -Force
  $password = $null
  $line = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($ArgumentLine))
  if ($Console) {
    $credential = New-Object System.Management.Automation.PSCredential(".\$Account", $secure)
    Start-Process -FilePath $Program -ArgumentList $line -Credential $credential -LoadUserProfile -WorkingDirectory $Directory
    return
  }
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class AgentMJob {
  [StructLayout(LayoutKind.Sequential)] struct BASIC { public long PerProcessUserTimeLimit; public long PerJobUserTimeLimit; public uint LimitFlags;
    public UIntPtr MinimumWorkingSetSize; public UIntPtr MaximumWorkingSetSize; public uint ActiveProcessLimit; public UIntPtr Affinity; public uint PriorityClass;
    public uint SchedulingClass; }
  [StructLayout(LayoutKind.Sequential)] struct IO { public ulong A; public ulong B; public ulong C; public ulong D; public ulong E; public ulong F; }
  [StructLayout(LayoutKind.Sequential)] struct EXTENDED { public BASIC Basic; public IO Io; public UIntPtr ProcessMemoryLimit; public UIntPtr JobMemoryLimit;
    public UIntPtr PeakProcessMemoryUsed; public UIntPtr PeakJobMemoryUsed; }
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
  [DllImport("kernel32.dll")] static extern bool SetInformationJobObject(IntPtr job, int infoClass, IntPtr info, uint length);
  [DllImport("kernel32.dll")] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;
  public static IntPtr Bind(IntPtr process) {
    IntPtr job = CreateJobObject(IntPtr.Zero, null);
    EXTENDED info = new EXTENDED();
    info.Basic.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    int size = Marshal.SizeOf(typeof(EXTENDED));
    IntPtr buffer = Marshal.AllocHGlobal(size);
    Marshal.StructureToPtr(info, buffer, false);
    if (!SetInformationJobObject(job, 9, buffer, (uint)size) || !AssignProcessToJobObject(job, process)) throw new InvalidOperationException("the job object could not be set");
    return job;
  }
}
'@
  $start = New-Object System.Diagnostics.ProcessStartInfo
  $start.FileName = $Program
  $start.Arguments = $line
  $start.UserName = $Account
  $start.Domain = '.'
  $start.Password = $secure
  $start.LoadUserProfile = $true
  $start.UseShellExecute = $false
  $start.WorkingDirectory = $Directory
  $start.RedirectStandardInput = $true
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $process = [System.Diagnostics.Process]::Start($start)
  $job = [AgentMJob]::Bind($process.Handle)
  $out = $process.StandardOutput.BaseStream.CopyToAsync([Console]::OpenStandardOutput())
  $err = $process.StandardError.BaseStream.CopyToAsync([Console]::OpenStandardError())
  $process.StandardInput.Write([Console]::In.ReadToEnd())
  $process.StandardInput.Close()
  $process.WaitForExit()
  $out.Wait()
  $err.Wait()
  exit $process.ExitCode
}
