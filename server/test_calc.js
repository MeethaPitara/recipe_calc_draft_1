const http = require('http');
const data = JSON.stringify({
    recipeRows: [
        { name: 'Sugar', sugars_pct: 100, quantity_g: 140 }
    ]
});
const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/calc/metrics',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
};
const req = http.request(options, res => {
    let str = '';
    res.on('data', chunk => str += chunk);
    res.on('end', () => console.log('RESPONSE:', str));
});
req.on('error', e => console.error(e));
req.write(data);
req.end();
