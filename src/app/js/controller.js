/*
 Controller: Orchestrates events between View and Model
 - Implements required functions: loginWithGoogle, uploadImage, sendToOpenAI, displayResult, selectRecommendation, resetSession
*/
(function(){
  const Model = window.BookLensModel;
  const View = window.BookLensView;

  function init(){
    bindGlobal();
    const user = Model.getState().user;
    if(user){ showMain(); } else { showLogin(); }
  }

  // Add current result to a list (create or reuse)
  function handleAddToList(result){
    try{
      const lists = Model.getLists(200);
      View.showListPicker({
        lists,
        onPick: (listId)=>{
          const target = lists.find(l=> l.id===listId);
          if(!target) return;
          Model.addToList(target.id, result);
          activeList = target;
          View.hideModal();
          View.toast('Ditambahkan ke daftar');
          showListsPage();
        },
        onCreate: (name)=>{
          const n = (name||'').trim();
          if(!n){ View.toast('Nama daftar tidak boleh kosong'); return; }
          const l = Model.createList(n);
          if(!l){ View.toast('Gagal membuat daftar'); return; }
          Model.addToList(l.id, result);
          activeList = l;
          View.hideModal();
          View.toast('Ditambahkan ke daftar');
          showListsPage();
        },
        onCancel: ()=>{ /* no-op */ }
      });
    }catch(_){ View.toast('Gagal menambahkan ke daftar'); }
  }

  function bindGlobal(){
    const btnReset = document.getElementById('btnReset');
    btnReset.onclick = resetSession;
  }

  function decodeJwt(token){
    const parts = token.split('.');
    if(parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g,'+').replace(/_/g,'/');
    const json = decodeURIComponent(atob(b64).split('').map(c=>'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    try{ return JSON.parse(json); }catch(_){ return null; }
  }

  // -- Required: loginWithGoogle()
  // Attempts Google OAuth via Google Identity Services.
  window.loginWithGoogle = async function loginWithGoogle(){
    try{
      if(!window.google || !google.accounts || !google.accounts.id){
        View.toast('Memuat Google OAuth... coba lagi sebentar');
        return;
      }
      const CLIENT_ID = '817973962577-jgaa4hqmkkg7vens4ium1n2m75v855nf.apps.googleusercontent.com';
      google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (resp)=>{
          const payload = decodeJwt(resp.credential || '');
          const name = payload?.name || payload?.email || 'Pengguna';
          Model.setUser(name);
          showMain();
        }
      });
      const btn = document.getElementById('btnGoogle');
      if(btn){
        google.accounts.id.renderButton(btn, { theme: 'filled_black', size: 'large', type: 'standard', shape: 'pill' });
      }
      google.accounts.id.prompt();
    }catch(err){
      console.error(err);
      View.toast('Google OAuth gagal. Coba login manual.');
    }
  };

  // -- Required: uploadImage()
  // Reads File, converts to dataURL, saves to model, calls sendToOpenAI
  window.uploadImage = async function uploadImage(file){
    try{
      View.showLoading(true);
      let dataUrl;
      try{
        dataUrl = await Model.downscaleImage(file, 720, 0.8);
      } catch(_) {
        dataUrl = await Model.toDataURL(file);
      }
      Model.setImage(dataUrl);
      const result = await Model.sendToOpenAI({ imageDataUrl: dataUrl });
      displayResult(result);
    }catch(err){
      console.error(err);
      View.toast('Gagal menganalisis gambar');
    }finally{
      View.showLoading(false);
    }
  };

  // -- Required: sendToOpenAI(image)
  // Thin wrapper delegating to Model; maintained for API completeness
  window.sendToOpenAI = async function sendToOpenAI(image){
    return Model.sendToOpenAI({ imageDataUrl: image });
  };

  window.searchByTitle = async function searchByTitle(title){
    try{
      View.showLoading(true);
      const result = await Model.sendToOpenAI({ titleQuery: title });
      displayResult(result);
    }catch(err){
      console.error(err);
      View.toast('Gagal menganalisis judul');
    }finally{
      View.showLoading(false);
    }
  };

  // -- Required: displayResult(data)
  // Render results via View
  window.displayResult = function displayResult(data){
    View.renderResult({
      result: data,
      onSelectReco: searchByTitle,
      onTryAnother: showMain,
      onAddToList: handleAddToList
    });
    // Save to local history
    try{ Model.saveHistory(data); }catch(_){ }
  };

  // -- Required: selectRecommendation(title)
  // Re-query OpenAI based on selected recommendation title
  window.selectRecommendation = async function selectRecommendation(title){
    try{
      View.showLoading(true);
      const result = await Model.sendToOpenAI({ titleQuery: title });
      displayResult(result);
    }catch(err){
      console.error(err);
      View.toast('Gagal memuat detail rekomendasi');
    }finally{
      View.showLoading(false);
    }
  };

  // -- Required: resetSession()
  // Clears session and returns to login
  window.resetSession = function resetSession(){
    Model.clearSession();
    showLogin();
  };

  function showLogin(){
    View.renderLogin({
      onGoogle: loginWithGoogle
    });
  }

  function showMain(){
    const user = Model.getState().user;
    View.renderMain({ username: user.username, onUpload: uploadImage, onGoHistory: showHistoryPage, onGoLists: showListsPage });
  }

  // History page
  function showHistoryPage(){
    const items = Model.fetchHistory(200);
    View.renderHistoryPage({
      items,
      onBack: showMain,
      onOpen: openSavedResult,
      onDelete: (id)=>{ Model.deleteHistory(id); showHistoryPage(); }
    });
  }

  function openSavedResult(item){
    const data = {
      judul: item.judul,
      penulis: item.penulis,
      genre: item.genre,
      rating: item.rating,
      harga: item.harga,
      hargaLink: item.hargaLink,
      summary: item.summary,
      rekomendasi: item.rekomendasi
    };
    View.renderResult({ result: data, onSelectReco: searchByTitle, onTryAnother: showMain, onAddToList: handleAddToList });
  }

  // Lists page
  let activeList = null;
  function showListsPage(){
    const lists = Model.getLists(200);
    if(!activeList && lists.length){ activeList = lists[0]; }
    const items = activeList ? Model.getListItems(activeList.id, 300) : [];
    View.renderListsPage({
      lists,
      active: activeList,
      items,
      onBack: ()=>{ activeList=null; showMain(); },
      onCreate: (name)=>{ const l = Model.createList(name); if(l){ activeList = l; } showListsPage(); },
      onPick: (l)=>{ activeList = { id: l.id, name: l.name }; showListsPage(); },
      onRename: (l)=>{ const nm = window.prompt('Nama daftar baru:', l.name||''); if(nm!==null){ Model.renameList(l.id, nm); if(activeList && activeList.id===l.id){ activeList.name = nm; } showListsPage(); } },
      onDeleteList: (l)=>{ const ok = window.confirm(`Hapus daftar "${l.name||''}"?`); if(ok){ Model.deleteList(l.id); if(activeList && activeList.id===l.id){ activeList=null; } showListsPage(); } },
      onRemoveItem: (itemId)=>{ if(activeList){ Model.removeFromList(activeList.id, itemId); showListsPage(); } },
      onAddLastResult: ()=>{ if(!activeList){ View.toast('Buat atau pilih daftar dulu'); return; } const r = Model.getState().lastResult; if(!r){ View.toast('Belum ada hasil scan'); return; } Model.addToList(activeList.id, r); showListsPage(); },
      onOpenItem: openSavedResult
    });
  }

  // Auto-init after DOM loaded
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
