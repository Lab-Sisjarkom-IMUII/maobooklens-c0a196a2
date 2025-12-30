/*
 View: Renders UI for BookLens
 - Login view, Main uploader view, Results view, Loading/toast
 - Stateless; reads from model and uses callbacks from controller
*/
(function(){
  const el = (sel)=>document.querySelector(sel);
  const viewRoot = ()=> el('#viewRoot');
  const loading = ()=> el('#loading');
  const toastEl = ()=> el('#toast');

  function showLoading(v){ loading().classList.toggle('hidden', !v); }
  function toast(msg){ const t = toastEl(); t.textContent = msg; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'), 2000); }

  /**
   * Render: Login View
   */
  function renderLogin({ onGoogle }){
    viewRoot().innerHTML = `
      <section class="panel stack">
        <div class="center" style="gap:8px;">
          <div class="logo" style="font-size:48px;"></div>
          <div>
            <div style="font-weight:700; font-size:18px;">Selamat datang di BookLens</div>
            <div class="helper">Cari review & rekomendasi buku dari foto sampul.</div>
          </div>
        </div>
        <button id="btnGoogle" class="primary">Masuk dengan Google</button>
      </section>
    `;
    el('#btnGoogle').onclick = onGoogle;
  }

  // --- Modal helpers ---
  function ensureModalHost(){
    let host = document.getElementById('modalHost');
    if(!host){
      host = document.createElement('div');
      host.id = 'modalHost';
      document.body.appendChild(host);
    }
    return host;
  }
  function hideModal(){ const host = document.getElementById('modalHost'); if(host){ host.innerHTML=''; host.className=''; } }
  function showModal(html){
    const host = ensureModalHost();
    host.className = 'modal-host';
    host.innerHTML = `
      <div class="modal-backdrop" id="modalBackdrop"></div>
      <div class="modal">
        ${html}
      </div>
    `;
  }

  function showListPicker({ lists, onPick, onCreate, onCancel }){
    const listItems = (lists||[]).map((l)=>`<button class="reco-btn pick-list" data-id="${l.id}">${(l.name||'-').replace(/"/g,'&quot;')}</button>`).join('') || '<div class="helper">Belum ada daftar</div>';
    showModal(`
      <div class="stack" style="gap:10px;">
        <div class="label">Pilih Daftar</div>
        <div class="stack" style="max-height:40vh; overflow:auto; gap:6px;">${listItems}</div>
        <div class="label">Atau buat baru</div>
        <div class="row" style="gap:8px;">
          <input id="modalNewList" placeholder="Nama daftar" />
          <button id="modalCreate" class="primary">Buat</button>
        </div>
        <div class="row" style="justify-content:flex-end; gap:8px;">
          <button id="modalCancel" class="secondary">Batal</button>
        </div>
      </div>
    `);
    const host = document.getElementById('modalHost');
    const cancel = ()=>{ hideModal(); if(typeof onCancel==='function') onCancel(); };
    const backdrop = document.getElementById('modalBackdrop'); if(backdrop) backdrop.onclick = cancel;
    const btnCancel = document.getElementById('modalCancel'); if(btnCancel) btnCancel.onclick = cancel;
    host.querySelectorAll('.pick-list').forEach(b=>{
      b.onclick = ()=>{ const id=b.getAttribute('data-id'); if(id && typeof onPick==='function'){ onPick(id); } };
    });
    const btnCreate = document.getElementById('modalCreate'); if(btnCreate){
      btnCreate.onclick = ()=>{ const name = (document.getElementById('modalNewList').value||'').trim(); if(name && typeof onCreate==='function'){ onCreate(name); } };
    }
  }

  function renderHistoryPage({ items, onBack, onOpen, onDelete }){
    viewRoot().innerHTML = `
      <section class="panel stack">
        <div class="row" style="gap:8px; align-items:center;">
          <button id="btnBack" class="link">Kembali</button>
          <div class="label" style="margin-left:8px;">Riwayat Scan</div>
        </div>
        <div id="historyRoot" class="stack" style="gap:8px;"></div>
      </section>
    `;
    const root = el('#historyRoot');
    if(!items || items.length===0){ root.innerHTML = '<div class="helper">Belum ada riwayat</div>'; }
    else{
      root.innerHTML = items.map((it)=>{
        const time = new Date(it.createdAt||Date.now());
        const t = isNaN(time.getTime()) ? '' : time.toLocaleString();
        return `
          <div class="row" style="gap:8px; align-items:flex-start;">
            <button class="reco-btn open-history" data-id="${it.id}" style="text-align:left; flex:1;">
              <div style="font-weight:600;">${it.judul || '-'}</div>
              <div class="helper">${it.penulis || '-'} • ${it.genre || '-'}${it.harga? ' • '+it.harga: ''} ${it.hargaLink? `• <a href="${it.hargaLink}" target="_blank" rel="noopener">Sumber</a>`: ''}</div>
              <div class="helper" style="font-size:12px;">${t}</div>
            </button>
            <button class="tiny-btn del-history" title="Hapus" data-id="${it.id}">Hapus</button>
          </div>
        `;
      }).join('');
    }
    const back = el('#btnBack'); if(back && typeof onBack==='function') back.onclick = onBack;
    if(typeof onOpen==='function'){
      viewRoot().querySelectorAll('.open-history').forEach(btn=>{
        btn.onclick = ()=>{ const id=btn.getAttribute('data-id'); const item = items.find(x=>String(x.id)===String(id)); if(item) onOpen(item); };
      });
    }
    if(typeof onDelete==='function'){
      viewRoot().querySelectorAll('.del-history').forEach(btn=>{
        btn.onclick = (e)=>{ e.stopPropagation(); const id=btn.getAttribute('data-id'); if(id) onDelete(id); };
      });
    }
  }

  function renderListsPage({ lists, active, items, onBack, onCreate, onPick, onRename, onDeleteList, onRemoveItem, onAddLastResult, onOpenItem }){
    viewRoot().innerHTML = `
      <section class="panel stack">
        <div class="row" style="gap:8px; align-items:center;">
          <button id="btnBack" class="link">Kembali</button>
          <div class="label" style="margin-left:8px;">Daftar Buku</div>
        </div>
        <div class="row" style="gap:8px;">
          <input id="newListName" placeholder="Nama daftar baru" />
          <button id="btnCreateList" class="primary">Buat</button>
        </div>
        <div class="label" style="margin-top:8px;">Semua Daftar</div>
        <div id="listRoot" class="stack" style="gap:8px;"></div>
        <div class="label" style="margin-top:8px;">Item pada: <strong>${active?.name || '-'}</strong></div>
        <div class="row" style="gap:8px;">
          <button id="btnAddLast" class="secondary">Tambahkan hasil scan terakhir</button>
        </div>
        <div id="listItemsRoot" class="stack" style="gap:8px;"></div>
      </section>
    `;
    const root = el('#listRoot');
    if(!lists || lists.length===0){ root.innerHTML = '<div class="helper">Belum ada daftar</div>'; }
    else{
      root.innerHTML = lists.map((it)=>{
        const safeName = (it.name||'').replace(/"/g,'&quot;');
        return `
          <div class="row" style="gap:8px; align-items:center;">
            <button type="button" class="reco-btn list-btn" data-id="${it.id}" data-name="${safeName}">${it.name || '-'}</button>
            <button type="button" title="Edit" class="tiny-btn list-edit" data-id="${it.id}" data-name="${safeName}">Edit</button>
            <button type="button" title="Hapus" class="tiny-btn list-del" data-id="${it.id}" data-name="${safeName}">Hapus</button>
          </div>
        `;
      }).join('');
    }
    const itemsRoot = el('#listItemsRoot');
    if(!items || items.length===0){ itemsRoot.innerHTML = '<div class="helper">Belum ada item pada daftar ini</div>'; }
    else{
      itemsRoot.innerHTML = items.map((it)=>{
        return `
          <div class="row" style="gap:8px; align-items:center;">
            <button class="reco-btn open-item" data-id="${it.id}" style="text-align:left; flex:1;">
              <div style="font-weight:600;">${it.judul || '-'}</div>
              <div class="helper">${it.penulis || '-'} • ${it.genre || '-'}${it.harga? ' • '+it.harga: ''}</div>
            </button>
            <button class="tiny-btn item-del" data-id="${it.id}">Hapus</button>
          </div>
        `;
      }).join('');
    }

    const back = el('#btnBack'); if(back && typeof onBack==='function') back.onclick = onBack;
    const btnCreate = el('#btnCreateList'); if(btnCreate && typeof onCreate==='function') btnCreate.onclick = ()=>{ const name = el('#newListName').value; onCreate(name); };
    const btnAddLast = el('#btnAddLast'); if(btnAddLast && typeof onAddLastResult==='function') btnAddLast.onclick = onAddLastResult;

    if(typeof onPick==='function'){
      viewRoot().querySelectorAll('.list-btn').forEach(b=>{
        b.onclick = ()=>{ const id = b.getAttribute('data-id'); const nm = b.getAttribute('data-name')||''; onPick({ id, name: nm }); };
      });
    }
    if(typeof onRename==='function'){
      viewRoot().querySelectorAll('.list-edit').forEach(b=>{
        b.onclick = (e)=>{ e.stopPropagation(); const id=b.getAttribute('data-id'); const nm=b.getAttribute('data-name')||''; onRename({ id, name:nm }); };
      });
    }
    if(typeof onDeleteList==='function'){
      viewRoot().querySelectorAll('.list-del').forEach(b=>{
        b.onclick = (e)=>{ e.stopPropagation(); const id=b.getAttribute('data-id'); const nm=b.getAttribute('data-name')||''; onDeleteList({ id, name:nm }); };
      });
    }
    if(typeof onRemoveItem==='function'){
      viewRoot().querySelectorAll('.item-del').forEach(b=>{
        b.onclick = ()=>{ const id=b.getAttribute('data-id'); if(id) onRemoveItem(id); };
      });
    }
    if(typeof onOpenItem==='function'){
      viewRoot().querySelectorAll('.open-item').forEach(b=>{
        b.onclick = ()=>{ const id=b.getAttribute('data-id'); const item = items.find(x=>String(x.id)===String(id)); if(item) onOpenItem(item); };
      });
    }
  }

  /**
   * Render: Main Uploader View
   */
  function renderMain({ username, onUpload, onGoHistory, onGoLists }){
    viewRoot().innerHTML = `
      <section class="panel stack">
        <div class="stack">
          <div class="helper">Masuk sebagai <strong>${username}</strong></div>
          <div class="upload-shell">
            <div>
              <div class="upload-header-title">Upload sampul buku</div>
              <div class="upload-header-sub">Ambil foto atau unggah gambar sampul untuk dianalisis AI.</div>
            </div>
            <div id="dropzone" class="dropzone" aria-label="Zona drag and drop untuk upload gambar">
              <div class="dropzone-icon" aria-hidden="true">⇪</div>
              <strong>Tarik & lepaskan gambar di sini</strong>
              <small>Atau gunakan tombol di bawah untuk memilih file.</small>
            </div>
            <p class="helper">Format yang didukung: JPG, PNG. Ukuran maksimal mengikuti batas browser.</p>
            <div class="upload-actions">
              <div class="pill-row">
                <button id="btnCamera" type="button" class="secondary">Ambil foto</button>
                <button id="btnGallery" type="button" class="secondary">Pilih dari galeri</button>
                <input id="cameraInput" type="file" accept="image/*" capture="environment" style="display:none" />
                <input id="fileInput" type="file" accept="image/*" style="display:none" />
              </div>
              <button id="btnAnalyze" class="primary" type="button">Kirim ke AI</button>
              <p class="helper">Pastikan teks judul pada sampul terlihat jelas agar hasil lebih akurat.</p>
            </div>
            <div id="preview" class="upload-preview hidden" aria-live="polite">
              <img id="previewImg" class="upload-preview-img" alt="Pratinjau gambar yang akan dianalisis" />
              <div class="upload-preview-meta">
                <div id="previewName" class="upload-preview-name"></div>
                <div id="previewSize" class="upload-preview-size"></div>
              </div>
            </div>
          </div>
          <div class="row" style="gap:8px; margin-top:12px; justify-content:space-between;">
            <button id="btnHistory" class="secondary" type="button">Riwayat Scan</button>
            <button id="btnLists" class="secondary" type="button">Daftar Buku</button>
          </div>
        </div>
      </section>
      <div class="footer-space"></div>
    `;

    let currentFile = null;

    function setPreview(file){
      if(!file){
        currentFile = null;
        const p = el('#preview');
        if(p) p.classList.add('hidden');
        return;
      }
      currentFile = file;
      const p = el('#preview');
      const img = el('#previewImg');
      const name = el('#previewName');
      const size = el('#previewSize');
      if(p) p.classList.remove('hidden');
      if(name) name.textContent = file.name || 'Gambar tanpa nama';
      if(size){
        const kb = file.size ? (file.size/1024).toFixed(1) : '0';
        size.textContent = `${kb} KB`;
      }
      if(img){
        const reader = new FileReader();
        reader.onload = e=>{ img.src = e.target?.result || ''; };
        reader.readAsDataURL(file);
      }
    }

    function handleFileFromInput(inputId){
      const f = el(inputId)?.files?.[0];
      if(!f) return;
      setPreview(f);
    }

    el('#btnCamera').onclick = ()=>{
      const input = el('#cameraInput');
      if(input){ input.click(); }
    };
    el('#btnGallery').onclick = ()=>{
      const input = el('#fileInput');
      if(input){ input.click(); }
    };

    const cameraEl = el('#cameraInput');
    if(cameraEl){ cameraEl.onchange = ()=> handleFileFromInput('#cameraInput'); }
    const fileEl = el('#fileInput');
    if(fileEl){ fileEl.onchange = ()=> handleFileFromInput('#fileInput'); }

    const dz = el('#dropzone');
    if(dz){
      ['dragenter','dragover'].forEach(evt=>{
        dz.addEventListener(evt, e=>{
          e.preventDefault();
          e.stopPropagation();
          dz.classList.add('drag-over');
        });
      });
      ['dragleave','drop'].forEach(evt=>{
        dz.addEventListener(evt, e=>{
          e.preventDefault();
          e.stopPropagation();
          dz.classList.remove('drag-over');
        });
      });
      dz.addEventListener('drop', e=>{
        const dt = e.dataTransfer;
        const file = dt && dt.files && dt.files[0];
        if(file){ setPreview(file); }
      });
    }

    el('#btnAnalyze').onclick = async ()=>{
      if(!currentFile){ toast('Pilih, ambil, atau tarik gambar terlebih dahulu'); return; }
      onUpload(currentFile);
    };
    const bh = el('#btnHistory'); if(bh && typeof onGoHistory==='function') bh.onclick = onGoHistory;
    const bl = el('#btnLists'); if(bl && typeof onGoLists==='function') bl.onclick = onGoLists;
  }

  function stars(r){
    const n = Math.max(1, Math.min(5, parseInt(r||'0',10)||0));
    return '★★★★★☆☆☆☆☆'.slice(5-n, 10-n);
  }

  /**
   * Render: Results View
   */
  function renderResult({ result, onTryAnother, onSelectReco, onAddToList }){
    const { judul, penulis, genre, rating, harga, hargaLink, summary } = result || {};
    let recos = [];
    try{
      const raw = (result && result.rekomendasi) || [];
      if(Array.isArray(raw)) recos = raw;
      else if(typeof raw === 'string'){
        recos = raw.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean);
      }
    }catch(_){ recos = []; }
    const starsStr = stars(rating);
    viewRoot().innerHTML = `
      <section class="panel stack result">
        <div class="book-title">${judul || 'Tidak diketahui'}</div>
        <div class="label">Penulis</div>
        <div>${penulis || '-'}</div>
        <div class="label">Genre</div>
        <div>${genre || '-'}</div>
        <div class="label">Rating</div>
        <div>${starsStr || '-'}</div>
        <div class="label">Harga</div>
        <div>${harga || '-'} ${hargaLink ? `• <a href="${hargaLink}" target="_blank" rel="noopener" class="helper">Sumber</a>`: ''}</div>
        <div class="label">Ringkasan</div>
        <div>${summary || '-'}</div>
        <div class="label">Rekomendasi</div>
        <div class="stack" style="gap:6px;">
          ${ recos.map((r)=>`<button class="reco-btn" data-title="${r.replace(/"/g,'&quot;')}">${r}</button>`).join('') || '<div>-</div>' }
        </div>
        <button id="btnAddToList" class="primary">Tambahkan ke daftar</button>
        <button id="btnAgain" class="link">Upload / Foto buku lain</button>
      </section>
      <div class="footer-space"></div>
    `;
    el('#btnAgain').onclick = onTryAnother;
    const btnAdd = document.querySelector('#btnAddToList');
    if(btnAdd && typeof onAddToList === 'function'){
      btnAdd.onclick = ()=> onAddToList(result);
    }
    if(typeof onSelectReco === 'function'){
      viewRoot().querySelectorAll('.reco-btn').forEach((b)=>{
        b.onclick = ()=>{
          const t = b.getAttribute('data-title');
          if(t) onSelectReco(t);
        };
      });
    }
  }

  window.BookLensView = { showLoading, toast, renderLogin, renderMain, renderResult, renderHistoryPage, renderListsPage, showListPicker, hideModal };
})();
