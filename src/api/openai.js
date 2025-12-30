// Vercel Serverless Function for OpenAI proxy
// Reads process.env.OPENAI_API_KEY and accepts POST { imageDataUrl?, titleQuery?, model?, temperature? }
// Returns the JSON object produced by the model (response_format: json_object)

const DEFAULT_MODEL = 'gpt-4o';

function buildMessages({ imageDataUrl, titleQuery }){
  const system = 'Kamu adalah AI yang mengenali buku dari foto atau judul. Jawab HANYA JSON valid tanpa penjelasan.';
  const basePrompt = `Keluarkan JSON DENGAN PERSIS kunci berikut dan tidak ada yang lain (jika bisa, gunakan link harga dari Gramedia terlebih dahulu). Dilarang menulis placeholder seperti 'Judul Buku 1/2/3'; rekomendasi harus judul buku nyata:\n{\n"judul": "Judul buku",\n"penulis": "Nama penulis",\n"genre": "Genre utama (string)",\n"rating": "Angka 1-5 (string)",\n"harga": "Harga buku (string, misal: Rp 120.000)",\n"hargaLink": "URL rujukan harga (string)",\n"summary": "Ringkasan maksimal 100 kata dalam Bahasa Indonesia",\n"rekomendasi": ["Judul 1", "Judul 2", "Judul 3"]\n}`;

  const messages = [ { role: 'system', content: system } ];
  if (imageDataUrl) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: basePrompt },
        { type: 'image_url', image_url: { url: imageDataUrl } }
      ]
    });
  } else if (titleQuery) {
    const titlePrompt = `Dari judul buku: "${titleQuery}", ` + basePrompt;
    messages.push({ role: 'user', content: [ { type: 'text', text: titlePrompt } ] });
  }
  return messages;
}

function sendCors(res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res){
  sendCors(res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try{
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server misconfigured: OPENAI_API_KEY is missing' });
    }

    const { imageDataUrl = null, titleQuery = null, model = DEFAULT_MODEL, temperature = 0.2 } = req.body || {};
    if (!imageDataUrl && !titleQuery) {
      return res.status(400).json({ error: 'imageDataUrl or titleQuery is required' });
    }

    const messages = buildMessages({ imageDataUrl, titleQuery });

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        response_format: { type: 'json_object' }
      })
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).send(txt);
    }
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content || '{}';

    // Return parsed JSON from assistant content
    let parsed;
    try { parsed = JSON.parse(content); }
    catch(_) { parsed = {}; }
    return res.status(200).json(parsed);
  }catch(err){
    console.error('[api/openai] error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
