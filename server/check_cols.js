import 'dotenv/config';

async function checkCols() {
    const url = process.env.SUPABASE_URL + '/rest/v1/ingredients?limit=1';
    const res = await fetch(url, {
        headers: {
            'apikey': process.env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        }
    });
    const data = await res.json();
    console.log(Object.keys(data[0]));
}
checkCols();
