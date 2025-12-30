const DEFAULT_MODEL = 'gpt-4o';

function buildMessages({ imageDataUrl, titleQuery }) {
  const system = 'Kamu adalah AI yang mengenali buku dari foto atau judul. Jawab HANYA JSON valid tanpa penjelasan.';
  const basePrompt = `Keluarkan JSON DENGAN PERSIS kunci berikut dan tidak ada yang lain (jika bisa, gunakan link harga dari Gramedia terlebih dahulu). Dilarang menulis placeholder seperti 'Judul Buku 1/2/3'; rekomendasi harus judul buku nyata:\n{\n"judul": "Judul buku",\n"penulis": "Nama penulis",\n"genre": "Genre utama (string)",\n"rating": "Angka 1-5 (string)",\n"harga": "Harga buku (string, misal: Rp 120.000)",\n"hargaLink": "URL rujukan harga (string)",\n"summary": "Ringkasan maksimal 100 kata dalam Bahasa Indonesia",\n"rekomendasi": ["Judul 1", "Judul 2", "Judul 3"]\n}`;

  const messages = [{ role: 'system', content: system }];
  if (imageDataUrl) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: basePrompt },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ],
    });
  } else if (titleQuery) {
    const titlePrompt = `Dari judul buku: "${titleQuery}", ` + basePrompt;
    messages.push({ role: 'user', content: [{ type: 'text', text: titlePrompt }] });
  }
  return messages;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req) {
  try {
    const headers = corsHeaders();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Server misconfigured: OPENAI_API_KEY is missing' }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { imageDataUrl = null, titleQuery = null, model = DEFAULT_MODEL, temperature = 0.2 } = body || {};

    if (!imageDataUrl && !titleQuery) {
      return new Response(
        JSON.stringify({ error: 'imageDataUrl or titleQuery is required' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const messages = buildMessages({ imageDataUrl, titleQuery });

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        response_format: { type: 'json_object' },
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      return new Response(txt, { status: r.status, headers });
    }

    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content || '{}';

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (_) {
      parsed = {};
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[app/api/openai] error:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }
}
