package jdwp

import (
	"bytes"
	"context"
	"fmt"
	"time"

	"cli-debugger/internal/api"
)

const (
	// jdwpHandshakeString JDWP 握手字符串
	jdwpHandshakeString = "JDWP-Handshake"
)

// performHandshake 执行 JDWP 握手协议
// JDWP 握手流程:
// 1. JVM 发送 "JDWP-Handshake\x00" 给调试器
// 2. 调试器验证并回写相同的字符串
func (c *Client) performHandshake(ctx context.Context) error {
	// 设置读取超时
	if err := c.conn.SetReadDeadline(getDeadline(c.timeout)); err != nil {
		return &api.APIError{
			Type:    api.ProtocolError,
			Message: "握手失败: 无法设置读取超时",
			Cause:   err,
		}
	}

	// 读取 JVM 发送的握手字符串
	buf := make([]byte, len(jdwpHandshakeString))
	n, err := c.conn.Read(buf)
	if err != nil {
		return &api.APIError{
			Type:    api.ProtocolError,
			Message: "握手失败: 无法读取 JVM 响应",
			Cause:   err,
		}
	}

	// 验证握手字符串 (可能包含或不包含 null 终止符)
	received := bytes.TrimRight(buf[:n], "\x00")
	if string(received) != jdwpHandshakeString {
		return &api.APIError{
			Type:    api.ProtocolError,
			Message: fmt.Sprintf("握手失败: 无效的 JVM 响应, 期望 '%s', 收到 '%s'", jdwpHandshakeString, string(received)),
		}
	}

	// 清除读取超时
	if err := c.conn.SetReadDeadline(getDeadline(c.timeout)); err != nil {
		return &api.APIError{
			Type:    api.ProtocolError,
			Message: "握手失败: 无法设置读取超时",
			Cause:   err,
		}
	}

	// 回写握手字符串 (包含 null 终止符)
	handshakeResponse := append([]byte(jdwpHandshakeString), 0x00)
	if _, err := c.conn.Write(handshakeResponse); err != nil {
		return &api.APIError{
			Type:    api.ProtocolError,
			Message: "握手失败: 无法发送响应",
			Cause:   err,
		}
	}

	return nil
}

// getDeadline 获取超时时间点
func getDeadline(timeout time.Duration) time.Time {
	return time.Now().Add(timeout)
}
