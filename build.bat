@echo off
REM 多语言调试 CLI - 构建脚本 (Windows)

echo 正在构建多语言调试 CLI...

REM 清理旧的构建文件
del /F debugger.exe 2>nul

REM 运行 go mod tidy
go mod tidy
if errorlevel 1 (
    echo 错误：go mod tidy 失败
    exit /b 1
)

REM 构建主程序
go build -o debugger.exe .
if errorlevel 1 (
    echo 错误：构建失败
    exit /b 1
)

echo 构建成功！生成文件：debugger.exe

REM 运行测试
echo.
echo 正在运行测试...
go test ./...
if errorlevel 1 (
    echo 警告：部分测试失败
) else (
    echo 所有测试通过！
)

echo.
echo 完成！