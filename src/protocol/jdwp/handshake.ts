/**
 * JDWP Handshake Protocol
 */

import * as net from "node:net";
import { APIError, ErrorType, ErrorCodes } from "../errors.js";

const JDWP_HANDSHAKE = "JDWP-Handshake";

/**
 * Perform JDWP handshake
 * JDWP handshake process:
 * 1. Debugger (client) sends "JDWP-Handshake" to the JVM
 * 2. JVM responds with the same string
 *
 * @param socket - TCP socket connection
 * @param timeout - Timeout in milliseconds
 */
export async function performHandshake(
  socket: net.Socket,
  timeout: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Set timeout
    const timeoutId = setTimeout(() => {
      reject(
        new APIError(
          ErrorType.ConnectionError,
          ErrorCodes.ConnectionTimeout,
          "Handshake timeout",
        ),
      );
    }, timeout);

    // Send handshake string to JVM
    const handshake = Buffer.from(JDWP_HANDSHAKE, "utf8");
    socket.write(handshake, (err) => {
      if (err) {
        clearTimeout(timeoutId);
        reject(
          new APIError(
            ErrorType.ConnectionError,
            ErrorCodes.HandshakeFailed,
            "Failed to send handshake",
            err,
          ),
        );
        return;
      }

      // Read handshake response from JVM
      const handshakeBuffer = Buffer.alloc(JDWP_HANDSHAKE.length);
      let bytesRead = 0;

      const onData = (chunk: Buffer) => {
        // Copy data to buffer
        const remaining = handshakeBuffer.length - bytesRead;
        const toCopy = Math.min(chunk.length, remaining);
        chunk.copy(handshakeBuffer, bytesRead, 0, toCopy);
        bytesRead += toCopy;

        // Check if we have enough data
        if (bytesRead >= JDWP_HANDSHAKE.length) {
          clearTimeout(timeoutId);
          socket.removeListener("data", onData);
          socket.removeListener("error", onError);
          socket.removeListener("close", onClose);

          // Verify handshake string (may or may not contain null terminator)
          let received = handshakeBuffer.toString("utf8");
          while (received.endsWith("\0")) {
            received = received.slice(0, -1);
          }
          if (received !== JDWP_HANDSHAKE) {
            reject(
              new APIError(
                ErrorType.ProtocolError,
                ErrorCodes.HandshakeFailed,
                `Invalid handshake response. Expected '${JDWP_HANDSHAKE}', received '${received}'`,
              ),
            );
            return;
          }

          resolve();
        }
      };

      const onError = (err: Error) => {
        clearTimeout(timeoutId);
        socket.removeListener("data", onData);
        reject(
          new APIError(
            ErrorType.ConnectionError,
            ErrorCodes.HandshakeFailed,
            "Handshake failed",
            err,
          ),
        );
      };

      const onClose = () => {
        clearTimeout(timeoutId);
        socket.removeListener("data", onData);
        reject(
          new APIError(
            ErrorType.ConnectionError,
            ErrorCodes.ConnectionClosed,
            "Connection closed during handshake",
          ),
        );
      };

      socket.on("data", onData);
      socket.on("error", onError);
      socket.on("close", onClose);
    });
  });
}
