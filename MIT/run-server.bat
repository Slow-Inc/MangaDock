@echo off
setlocal
pushd "%~dp0"

if not defined MIT_HOST set "MIT_HOST=0.0.0.0"
if not defined MIT_PORT set "MIT_PORT=5003"
if not defined MIT_USE_GPU set "MIT_USE_GPU=1"
if not defined MIT_START_INSTANCE set "MIT_START_INSTANCE=1"

if defined MIT_PYTHON (
	set "PYTHON_CMD=%MIT_PYTHON%"
) else if exist ".venv\Scripts\python.exe" (
	set "PYTHON_CMD=.venv\Scripts\python.exe"
) else if exist "venv\Scripts\python.exe" (
	set "PYTHON_CMD=venv\Scripts\python.exe"
) else (
	set "PYTHON_CMD=python"
)

set "MIT_ARGS=server/main.py --host %MIT_HOST% --port %MIT_PORT%"

if "%MIT_USE_GPU%"=="1" set "MIT_ARGS=%MIT_ARGS% --use-gpu"
if /I "%MIT_USE_GPU_LIMITED%"=="1" set "MIT_ARGS=%MIT_ARGS% --use-gpu-limited"
if not "%MIT_START_INSTANCE%"=="0" set "MIT_ARGS=%MIT_ARGS% --start-instance"
if /I "%MIT_VERBOSE%"=="1" set "MIT_ARGS=%MIT_ARGS% --verbose"
if defined MIT_MODELS_TTL set "MIT_ARGS=%MIT_ARGS% --models-ttl %MIT_MODELS_TTL%"
if defined MIT_PRE_DICT set "MIT_ARGS=%MIT_ARGS% --pre-dict %MIT_PRE_DICT%"
if defined MIT_POST_DICT set "MIT_ARGS=%MIT_ARGS% --post-dict %MIT_POST_DICT%"

echo Starting MIT service with %PYTHON_CMD%
echo Host=%MIT_HOST% Port=%MIT_PORT% GPU=%MIT_USE_GPU% StartInstance=%MIT_START_INSTANCE%
"%PYTHON_CMD%" %MIT_ARGS%

popd
endlocal
