"""Isolated installer checks: no real Docker, network, patient data or user directories."""
import os
from pathlib import Path
import subprocess
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent


class InstallSupport(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="medscribe-support-")
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.bin = self.base / "bin"
        self.bin.mkdir()
        self.install = self.base / "folder with spaces"
        self.install.mkdir()
        self.env = dict(os.environ, PATH=str(self.bin) + os.pathsep + os.environ["PATH"], APP_PORT="3210")

    def command(self, name, body):
        path = self.bin / name
        path.write_text("#!/bin/sh\n" + body)
        path.chmod(0o755)

    def disk(self, prog, docker=None, installed=False, desktop=False, skip=False, unknown=False):
        """prog/docker: free KB for the program folder / Docker root dir (docker=None: root unknown)."""
        root = "/var/lib/docker-test"
        self.command("uname", "echo Darwin\n" if desktop else "echo Linux\n")
        self.command("docker", "exit 1\n" if docker is None else
                     f'case "$*" in *DockerRootDir*) echo {root} ;; *) echo "Docker Engine" ;; esac\n')
        df = "exit 1\n" if unknown else f"""for last; do :; done
case "$last" in
  {root}) {'exit 1' if docker is None else 'free=' + str(docker)} ;;
  *) free={prog} ;;
esac
printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\\n/dev/test 99999999 0 %s 1%% /\\n' "$free"
"""
        self.command("df", df)
        if installed:
            (self.install / ".medscribe-install").touch()
        env = dict(self.env)
        if skip:
            env["MEDSCRIBE_SKIP_DISK_CHECK"] = "1"
        # Load production functions without executing the installer's final main call.
        source = (ROOT / "scripts/install.sh").read_text().rsplit('\nmain "$@"', 1)[0]
        script = self.base / "functions.sh"
        script.write_text(source + '\ndir="$1"\ncheck_disk\n')
        return subprocess.run(["sh", str(script), str(self.install / "new folder" if not installed else self.install)],
                              env=env, text=True, capture_output=True, timeout=10)

    def test_engine_first_install_low_docker_disk_blocks(self):
        result = self.disk(prog=99999999, docker=1048576)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("15 ГБ", result.stderr)
        self.assertIn("MEDSCRIBE_SKIP_DISK_CHECK", result.stderr)
        self.assertFalse((self.install / "new folder").exists())

    def test_engine_low_program_disk_does_not_block_if_docker_has_space(self):
        result = self.disk(prog=524288, docker=20971520)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("меньше 1 ГБ", result.stderr)

    def test_engine_enough_disk(self):
        result = self.disk(prog=15728640, docker=15728640)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_engine_unknown_root_warns_not_blocks(self):
        result = self.disk(prog=1048576, docker=None)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Не удалось проверить", result.stderr)

    def test_desktop_low_disk_only_warns(self):
        result = self.disk(prog=1048576, desktop=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Docker Desktop", result.stderr)
        self.assertIn("15 ГБ", result.stderr)

    def test_skip_variable_skips_check(self):
        result = self.disk(prog=1024, docker=1024, skip=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("15 ГБ", result.stderr)

    def test_repeat_install_does_not_require_another_15gb(self):
        result = self.disk(prog=99999999, docker=2097152, installed=True)
        self.assertEqual(result.returncode, 0)
        self.assertIn("резервной копии", result.stderr)

    def test_unavailable_disk_measurement_is_not_false_success(self):
        result = self.disk(0, unknown=True)
        self.assertEqual(result.returncode, 0)
        self.assertIn("Не удалось проверить", result.stderr)

    def diagnostic(self, broken=False):
        sentinel = "SECRET_PATIENT_TOKEN_DO_NOT_EXPORT"
        (self.install / "VERSION").write_text("0.2.0-rc.8\n")
        (self.install / ".env").write_text(f'APP_PORT=3210\nAPI_KEY={sentinel}\n')
        self.command("docker", f'''echo {sentinel} >&2
case "$*" in
  "info --format "*) {'exit 1' if broken else "echo linux"} ;;
  "compose ps -a --format "*)
    case "$*" in *app) echo running ;; *) echo {sentinel} ;; esac ;;
  *) exit 99 ;;
esac
''')
        self.command("curl", "exit 1\n" if broken else f'''case "$*" in *http://127.0.0.1:3210/api/health) ;; *) exit 99 ;; esac
printf '%s' '{{"db": true,"tone": false,"llm":true,"error":"{sentinel}"}}'
''')
        result = subprocess.run(["sh", str(ROOT / "scripts/diagnose.sh"), str(self.install)],
                                env=self.env, text=True, capture_output=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr)
        reports = list(self.install.glob("medscribe-diagnostic.*"))
        self.assertEqual(len(reports), 1)
        report = reports[0].read_text()
        self.assertNotIn(sentinel, report + result.stdout + result.stderr)
        self.assertNotIn(str(self.install), report)
        self.assertNotIn(str(self.install), result.stdout)
        self.assertIn("в папке программы", result.stdout)
        self.assertEqual(reports[0].stat().st_mode & 0o777, 0o600)
        self.assertIn("service_tone=unknown", report)
        return report

    def test_report_exports_only_allowlisted_fields(self):
        report = self.diagnostic()
        self.assertIn("version=0.2.0-rc.8", report)
        self.assertIn("health_db=true", report)
        self.assertIn("health_tone=false", report)
        self.assertIn("service_app=running", report)

    def test_report_when_services_are_down(self):
        report = self.diagnostic(broken=True)
        self.assertIn("docker_engine=unreachable", report)
        self.assertIn("health_db=unknown", report)

    @unittest.skipUnless(os.environ.get('MEDSCRIBE_TEST_PWSH') or shutil.which('pwsh'), 'PowerShell is not installed')
    def test_powershell_report_exports_only_allowlisted_fields(self):
        sentinel = 'SECRET_PATIENT_TOKEN_DO_NOT_EXPORT'
        (self.install / 'VERSION').write_text('0.2.0-rc.8\n')
        (self.install / '.env').write_text(f'APP_PORT=3210\nAPI_KEY={sentinel}\n')
        self.command('docker.exe', f'''echo {sentinel} >&2
case "$*" in
  "info --format "*) echo linux ;;
  "compose ps -a --format "*)
    case "$*" in *app) echo running ;; *) echo {sentinel} ;; esac ;;
  *) exit 99 ;;
esac
''')
        wrapper = self.base / 'run.ps1'
        wrapper.write_text('''param($ScriptPath, $InstallDir)
function Invoke-RestMethod {
    param($UseBasicParsing, $Uri, $TimeoutSec)
    return @{db=$true; tone=$false; llm=$true; error='SECRET_PATIENT_TOKEN_DO_NOT_EXPORT'}
}
& $ScriptPath -InstallDir $InstallDir
'''.replace('param($UseBasicParsing,', 'param([switch]$UseBasicParsing,'))
        pwsh = os.environ.get('MEDSCRIBE_TEST_PWSH') or shutil.which('pwsh')
        result = subprocess.run([pwsh, '-NoProfile', '-File', str(wrapper),
                                 str(ROOT / 'scripts/diagnose.ps1'), str(self.install)],
                                env=self.env, text=True, capture_output=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr)
        files = list(self.install.glob('medscribe-diagnostic-*.txt'))
        self.assertEqual(len(files), 1)
        report = files[0].read_text(encoding='utf-8-sig')
        self.assertNotIn(sentinel, report + result.stdout + result.stderr)
        self.assertNotIn(str(self.install), report)
        self.assertIn('version=0.2.0-rc.8', report)
        self.assertIn('health_db=true', report)
        self.assertIn('health_tone=false', report)
        self.assertIn('service_app=running', report)
        self.assertIn('service_tone=unknown', report)


if __name__ == "__main__":
    unittest.main()
