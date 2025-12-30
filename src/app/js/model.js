/*
 Model: State & API (OpenAI) for BookLens
 - Holds session/user state
 - Provides sendToOpenAI(imageOrTitle) using fetch() to OpenAI (model: gpt-4o)
 - Exposes simple pub-sub for updates
*/
(function(){
  const state = {
    user: null, // { username }
    lastImage: null, // dataURL
    lastResult: null, // parsed JSON
  };

  const listeners = new Set();
  function notify(){ listeners.forEach(fn=>{ try{ fn(state); }catch(_){} }); }

  function cacheKey(suffix){
    const uid = state.user?.username || 'anon';
    return `booklens:${uid}:${suffix}`;
  }

  // Pick a single best price link: Tokopedia only (ISBN preferred)
  function bestPriceLink({ title, author, isbn }){
    const qIsbn = encodeURIComponent(isbn || '');
    if(qIsbn){
      return `https://www.tokopedia.com/search?st=product&q=${qIsbn}`;
    }
    const qTitleAuthor = encodeURIComponent([String(title||'').trim(), author||''].filter(Boolean).join(' '));
    if(qTitleAuthor){
      return `https://www.tokopedia.com/search?st=product&q=${qTitleAuthor}`;
    }
    return '';
  }

  function saveCache(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){ } }
  function loadCache(key, def=[]) { try{ const r = localStorage.getItem(key); return r? JSON.parse(r): def; }catch(_){ return def; } }

  /**
   * Save user session to localStorage
   */
  function saveSession(){
    try{ localStorage.setItem('booklens:user', JSON.stringify(state.user)); }catch(_){ }
  }

  /**
   * Load user session from localStorage
   */
  function loadSession(){
    try{
      const raw = localStorage.getItem('booklens:user');
      if(raw){ state.user = JSON.parse(raw); }
    }catch(_){ }
  }
  loadSession();

  /**
   * Convert File/Blob to base64 data URL
   */
  function toDataURL(file){
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = ()=>resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function downscaleImage(file, maxSize=720, quality=0.8){
    return new Promise((resolve, reject)=>{
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = ()=>{
        const w0 = img.naturalWidth || img.width;
        const h0 = img.naturalHeight || img.height;
        const max0 = Math.max(w0, h0);
        const ratio = Math.min(1, maxSize / (max0 || 1));
        const w = Math.max(1, Math.round(w0 * ratio));
        const h = Math.max(1, Math.round(h0 * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (e)=>{ try{ URL.revokeObjectURL(url); }catch(_){}; reject(e); };
      img.src = url;
    });
  }

  // Try to enrich price using Google Books (supports CORS). Prefer IDR price.
  async function enrichWithGoogleBooks({ isbn, title, author }){
    try{
      const q = isbn ? `isbn:${encodeURIComponent(isbn)}` : encodeURIComponent([title, author].filter(Boolean).join(' '));
      const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=5`;
      const r = await fetch(url);
      if(!r.ok) return null;
      const data = await r.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      if(items.length === 0) return null;
      // pick the first with saleInfo price, prefer currency IDR
      let pick = null;
      for(const it of items){
        const s = it?.saleInfo || {};
        if((s?.listPrice || s?.retailPrice) && s?.country){
          if((s.listPrice?.currencyCode === 'IDR') || (s.retailPrice?.currencyCode === 'IDR')){ pick = it; break; }
          if(!pick) pick = it;
        }
      }
      if(!pick) return null;
      const s = pick.saleInfo || {};
      const price = s.listPrice || s.retailPrice || null;
      const amount = price?.amount;
      const ccy = price?.currencyCode || 'IDR';
      const buyLink = s.buyLink || s.saleability === 'FOR_SALE' ? (s.buyLink || '') : '';
      let hargaStr = '';
      try{
        if(typeof amount === 'number'){
          hargaStr = new Intl.NumberFormat('id-ID', { style:'currency', currency: ccy }).format(amount);
        }
      }catch(_){ hargaStr = amount ? `~${amount} ${ccy}` : ''; }
      return { harga: hargaStr, hargaLink: buyLink };
    }catch(_){ return null; }
  }

  // Verify and enrich results from public web source (Open Library)
  async function verifyWithOpenLibrary(result){
    try{
      const title = (result?.judul || '').trim();
      if(!title){ return result; }
      const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=5`;
      const r = await fetch(url);
      if(!r.ok){ return result; }
      const data = await r.json();
      const docs = Array.isArray(data?.docs) ? data.docs : [];
      if(docs.length === 0){ return result; }
      // Prefer exact/closest match by normalized title
      const norm = (s)=> (s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
      const want = norm(title);
      let best = docs[0];
      for(const d of docs){
        const cand = norm(d.title);
        if(cand === want){ best = d; break; }
      }
      const verifiedTitle = best.title || result.judul;
      const verifiedAuthor = Array.isArray(best.author_name) && best.author_name.length > 0 ? best.author_name[0] : (result.penulis || '');
      // Pick an ISBN if available (prefer 13-digit)
      const isbns = Array.isArray(best.isbn) ? best.isbn : [];
      let isbn = '';
      for(const i of isbns){ if(/^\d{13}$/.test(i)){ isbn = i; break; } }
      if(!isbn){ for(const i of isbns){ if(/^\d{10}$/.test(i)){ isbn = i; break; } } }
      return { ...result, judul: verifiedTitle, penulis: verifiedAuthor, isbn };
    }catch(_){ return result; }
  }

  /**
   * Call OpenAI gpt-4o with image input or a title query.
   * - imageDataUrl: if provided, sends vision request.
   * - titleQuery: if provided, asks details for that title.
   * Returns parsed JSON object per required schema.
   */
  async function sendToOpenAI({ imageDataUrl=null, titleQuery=null }){
    if(!imageDataUrl && !titleQuery){
      throw new Error('sendToOpenAI requires imageDataUrl or titleQuery');
    }

    const res = await fetch('/api/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl, titleQuery, model: 'gpt-4o', temperature: 0.2 })
    });

    if(!res.ok){
      const t = await res.text();
      throw new Error(`API error ${res.status}: ${t}`);
    }
    const parsed = await res.json();
    const verified = await verifyWithOpenLibrary(parsed);
    // Sanitize rekomendasi & hargaLink; prefer Gramedia
    try{
      const title = (verified?.judul || '').trim();
      const author = (verified?.penulis || '').trim();
      const isbn = (verified?.isbn || '').trim();
      // sanitize rekomendasi
      const rawRec = Array.isArray(verified?.rekomendasi) ? verified.rekomendasi : (typeof verified?.rekomendasi === 'string' ? verified.rekomendasi.split(/[\n,]+/) : []);
      const recs = Array.from(new Set((rawRec||[]).map(x=> String(x||'').trim()).filter(x=> x && !/^judul\s*buku\s*\d+$/i.test(x))))
        .slice(0,5);
      verified.rekomendasi = recs;
      // hargaLink prefer gramedia; ensure absolute URL, else fallback
      const hasGramedia = (verified?.hargaLink || '').toLowerCase().includes('gramedia.com');
      if(!hasGramedia){
        if(isbn){
          verified.hargaLink = `https://www.gramedia.com/search?keyword=${encodeURIComponent(isbn)}`;
        } else if(title){
          const q = encodeURIComponent([title, author].filter(Boolean).join(' '));
          verified.hargaLink = `https://www.google.com/search?q=site%3Agramedia.com+${q}`;
        }
      }
      // ensure absolute URL
      if(verified.hargaLink && !/^https?:\/\//i.test(verified.hargaLink)){
        const q = encodeURIComponent(isbn || [title, author].filter(Boolean).join(' '));
        verified.hargaLink = isbn ? `https://www.gramedia.com/search?keyword=${q}` : `https://www.google.com/search?q=site%3Agramedia.com+${q}`;
      }
      // If harga missing/unreliable, try Google Books enrichment
      const hasPrice = typeof verified.harga === 'string' && verified.harga.trim().length >= 3;
      if(!hasPrice){
        const gb = await enrichWithGoogleBooks({ isbn, title, author });
        if(gb){
          if(gb.harga){ verified.harga = gb.harga; }
          if(gb.hargaLink){ verified.hargaLink = verified.hargaLink || gb.hargaLink; verified.hargaLinks = verified.hargaLinks || []; }
          if(gb.hargaLink){ verified.hargaLinks = (verified.hargaLinks||[]); }
        }
      }
      // Choose a single best price link for simplicity
      verified.hargaLink = bestPriceLink({ title, author, isbn, googleBooksLink: verified.hargaLink });
      delete verified.hargaLinks;
    }catch(_){ }

    state.lastResult = verified;
    notify();
    return verified;
  }

  // History APIs (local)
  function saveHistory(item){
    try{
      const key = cacheKey('history');
      const prev = loadCache(key, []);
      const rec = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        judul: item?.judul || '',
        penulis: item?.penulis || '',
        genre: item?.genre || '',
        rating: item?.rating || '',
        harga: item?.harga || '',
        hargaLink: item?.hargaLink || '',
        summary: item?.summary || '',
        rekomendasi: Array.isArray(item?.rekomendasi) ? item.rekomendasi.slice(0,5) : [],
        createdAt: Date.now()
      };
      const next = [rec, ...prev].slice(0, 200);
      saveCache(key, next);
      return rec;
    }catch(_){ return null; }
  }
  function fetchHistory(limit=50){
    const items = loadCache(cacheKey('history'), []);
    return items.slice(0, limit);
  }
  function deleteHistory(id){
    try{
      const key = cacheKey('history');
      const prev = loadCache(key, []);
      saveCache(key, prev.filter(x=> String(x.id)!==String(id)));
    }catch(_){ }
  }

  // Lists APIs (local)
  function getLists(limit=50){
    return loadCache(cacheKey('lists'), []).slice(0, limit);
  }
  function createList(name){
    const nm = (name||'').trim(); if(!nm) return null;
    const key = cacheKey('lists');
    const prev = loadCache(key, []);
    const rec = { id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, name: nm, createdAt: Date.now() };
    saveCache(key, [rec, ...prev].slice(0,200));
    return rec;
  }
  function renameList(listId, name){
    const key = cacheKey('lists');
    const prev = loadCache(key, []);
    saveCache(key, prev.map(l=> l.id===listId? { ...l, name: (name||'').trim() }: l));
  }
  function deleteList(listId){
    saveCache(cacheKey('lists'), getLists(999).filter(l=> l.id!==listId));
    saveCache(cacheKey(`list:${listId}:items`), []);
  }
  function getListItems(listId, limit=100){
    return loadCache(cacheKey(`list:${listId}:items`), []).slice(0, limit);
  }
  function addToList(listId, item){
    const key = cacheKey(`list:${listId}:items`);
    const prev = loadCache(key, []);
    const rec = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      judul: item?.judul || '',
      penulis: item?.penulis || '',
      genre: item?.genre || '',
      rating: item?.rating || '',
      harga: item?.harga || '',
      hargaLink: item?.hargaLink || '',
      summary: item?.summary || '',
      rekomendasi: Array.isArray(item?.rekomendasi) ? item.rekomendasi.slice(0,5) : [],
      createdAt: Date.now()
    };
    saveCache(key, [rec, ...prev].slice(0,300));
    return rec;
  }
  function removeFromList(listId, itemId){
    const key = cacheKey(`list:${listId}:items`);
    const prev = loadCache(key, []);
    saveCache(key, prev.filter(x=> String(x.id)!==String(itemId)));
  }

  /**
   * Public API: model
   */
  window.BookLensModel = {
    getState: ()=>state,
    on: (fn)=>{ listeners.add(fn); return ()=>listeners.delete(fn); },
    setUser: (username)=>{ state.user = { username }; saveSession(); notify(); },
    clearSession: ()=>{ state.user = null; state.lastImage = null; state.lastResult = null; try{ localStorage.removeItem('booklens:user'); }catch(_){ } notify(); },
    setImage: (dataUrl)=>{ state.lastImage = dataUrl; notify(); },
    toDataURL,
    downscaleImage,
    sendToOpenAI,
    // history
    saveHistory,
    fetchHistory,
    deleteHistory,
    // lists
    getLists,
    createList,
    renameList,
    deleteList,
    getListItems,
    addToList,
    removeFromList,
  };
})();
