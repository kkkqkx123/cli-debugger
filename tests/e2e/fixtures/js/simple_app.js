/**
 * Simple JavaScript program for E2E debugging tests.
 *
 * Usage:
 *   node --inspect-brk=9229 simple_app.js
 */

function add(a, b) {
  const result = a + b;
  return result;
}

function multiply(a, b) {
  const result = a * b;
  return result;
}

function processData(data) {
  const total = data.reduce((sum, n) => sum + n, 0);
  const count = data.length;
  const avg = count > 0 ? total / count : 0;
  return { total, count, average: avg };
}

function main() {
  console.log("JS simple_app started");

  // Basic operations
  const x = 10;
  const y = 20;
  const s = add(x, y);
  console.log(`add(${x}, ${y}) = ${s}`);

  // More complex data
  const values = [1, 2, 3, 4, 5];
  const result = processData(values);
  console.log(`processData result:`, result);

  const p = multiply(x, y);
  console.log(`multiply(${x}, ${y}) = ${p}`);

  // Keep running
  console.log("Waiting...");
  setTimeout(() => {
    console.log("JS simple_app finished");
  }, 5000);
}

main();