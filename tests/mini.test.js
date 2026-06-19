require('dotenv').config();
const http = require('http');

let _cookies = '';
const request = async (method, path, { body, token, headers = {}, formData, timeout = 30000 } = {}) => {
  const url = new URL('http://localhost:5050/api' + path);
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(_cookies && !token ? { Cookie: _cookies } : {}),
      ...headers,
    },
  };
  if (formData) {
    delete opts.headers['Content-Type'];
    const boundary = '----TestBoundary' + Date.now();
    opts.headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
    const parts = [];
    for (const [k, v] of Object.entries(formData)) {
      parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`);
    }
    parts.push(`--${boundary}--\r\n`);
    opts.body = parts.join('');
  } else if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }
  if (opts.body) opts.headers['Content-Length'] = Buffer.byteLength(opts.body);
  console.log('>>', method, path, '| body:', typeof opts.body === 'string' ? opts.body.slice(0, 100) : 'none');
  return new Promise((resolve, reject) => {
    const req = http.request(url, opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        if (setCookie) _cookies = setCookie.map((c) => c.split(';')[0]).join('; ');
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => req.destroy(new Error(`timeout after ${timeout}ms`)));
    req.end();
  });
};

(async () => {
  console.log('1. Health');
  console.log(await (await request('GET', '/health')).status);
  console.log('2. Register');
  const r = await request('POST', '/auth/register', { body: { email: 'mini+' + Date.now() + '@x.com', password: 'MiniPass1234!', full_name: 'Mini' } });
  console.log(r.status, r.body.slice(0, 200));
  console.log('3. Login');
  const r2 = await request('POST', '/auth/login', { body: { email: 'mini@x.com', password: 'MiniPass1234!' } });
  console.log(r2.status);
})();
