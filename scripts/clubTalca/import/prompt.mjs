// Pide la contraseña por la terminal sin mostrarla; nunca por argumento ni en logs.

/** Lee una línea de la terminal sin mostrarla (o de stdin si viene por pipe). */
export function promptHidden(question) {
  return new Promise((resolvePrompt) => {
    process.stdout.write(question);
    if (!process.stdin.isTTY) {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => {
        data += chunk;
        if (data.includes('\n')) {
          process.stdin.pause();
          process.stdout.write('\n');
          resolvePrompt(data.split(/\r?\n/)[0]);
        }
      });
      return;
    }
    let value = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const onData = (char) => {
      for (const key of char) {
        if (key === '\u0003') {
          process.stdout.write('\n');
          process.exit(130);
        } else if (key === '\r' || key === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off('data', onData);
          process.stdout.write('\n');
          resolvePrompt(value);
          return;
        } else if (key === '\u007f' || key === '\b') {
          value = value.slice(0, -1);
        } else {
          value += key;
        }
      }
    };
    process.stdin.on('data', onData);
  });
}
