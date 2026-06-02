@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing TeacherDesk dependencies...
  call "C:\Program Files\nodejs\npm.cmd" install
)
echo Preparing TeacherDesk desktop bridge...
call "C:\Program Files\nodejs\npm.cmd" run build
set TEACHERDESK_LOAD_BUILT=
call "C:\Program Files\nodejs\npm.cmd" run electron:dev
