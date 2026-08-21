const file=document.getElementById('file'), choose=document.getElementById('choose'), drop=document.getElementById('drop');
const work=document.getElementById('work'), nameEl=document.getElementById('name'), pct=document.getElementById('pct'), fill=document.getElementById('fill'), status=document.getElementById('status'), dl=document.getElementById('download');
choose.onclick=()=>file.click();
drop.onclick=e=>{if(e.target.tagName!=='BUTTON')file.click()};
file.onchange=()=>process(file.files[0]);
drop.ondragover=e=>{e.preventDefault();drop.style.opacity='.75'};
drop.ondragleave=()=>drop.style.opacity='1';
drop.ondrop=e=>{e.preventDefault();drop.style.opacity='1';process(e.dataTransfer.files[0])};

async function process(f){
 if(!f)return;
 if(f.size>100*1024*1024)return alert('Maximum file size is 100 MB.');
 nameEl.textContent=f.name; work.classList.remove('hidden'); dl.classList.add('hidden');
 const fd=new FormData(); fd.append('video',f);
 const r=await fetch('/api/process',{method:'POST',body:fd});
 const data=await r.json();
 if(!r.ok)return status.textContent=data.error||'Upload failed.';
 poll(data.id);
}
async function poll(id){
 const r=await fetch('/api/status/'+id), j=await r.json();
 pct.textContent=j.progress+'%'; fill.style.width=j.progress+'%';
 if(j.status==='processing'){status.textContent='Cleaning metadata and optimizing video…';setTimeout(()=>poll(id),1200)}
 else if(j.status==='complete'){status.textContent='Complete. Your optimized file is ready.';dl.href=j.download;dl.classList.remove('hidden')}
 else status.textContent=j.error||'Processing failed.';
}