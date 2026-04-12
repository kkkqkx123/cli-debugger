#!/bin/bash

# 多语言调试 CLI - 构建脚本

echo "正在构建多语言调试 CLI..."

# 清理旧的构建文件
rm -f debugger

# 运行 go mod tidy
go mod tidy
if [ $? -ne 0 ]; then
    echo "错误：go mod tidy 失败"
    exit 1
fi

# 构建主程序
go build -o debugger .
if [ $? -ne 0 ]; then
    echo "错误：构建失败"
    exit 1
fi

echo "构建成功！生成文件：debugger"

# 运行测试
echo ""
echo "正在运行测试..."
go test ./...
if [ $? -ne 0 ]; then
    echo "警告：部分测试失败"
else
    echo "所有测试通过！"
fi

echo ""
echo "完成！"