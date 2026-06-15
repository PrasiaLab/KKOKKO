const sheetLinks=[
["토벌 스펙","https://docs.google.com/spreadsheets/d/10ZIjOh7VgaceXSbSuTR6fMGj28NCzrHujxF9SQyw_UU/preview#gid=1876922409"],
["마법 부여","https://docs.google.com/spreadsheets/d/10ZIjOh7VgaceXSbSuTR6fMGj28NCzrHujxF9SQyw_UU/preview#gid=2108346036"],
["심연 증폭","https://docs.google.com/spreadsheets/d/10ZIjOh7VgaceXSbSuTR6fMGj28NCzrHujxF9SQyw_UU/preview#gid=413772873"],
["클래스 주문석","https://docs.google.com/spreadsheets/d/10ZIjOh7VgaceXSbSuTR6fMGj28NCzrHujxF9SQyw_UU/preview#gid=1044209677"],
["아퀴 채화","https://docs.google.com/spreadsheets/d/10ZIjOh7VgaceXSbSuTR6fMGj28NCzrHujxF9SQyw_UU/preview#gid=454167790"],
["클래스 체인지","https://docs.google.com/spreadsheets/d/10ZIjOh7VgaceXSbSuTR6fMGj28NCzrHujxF9SQyw_UU/preview#gid=776991324"],
["클래스 전승","https://docs.google.com/spreadsheets/d/10ZIjOh7VgaceXSbSuTR6fMGj28NCzrHujxF9SQyw_UU/preview#gid=1917128113"],
["몬스터 도감","https://docs.google.com/spreadsheets/d/10ZIjOh7VgaceXSbSuTR6fMGj28NCzrHujxF9SQyw_UU/preview#gid=1463186653"]];
const fallbackVideos=[
{id:"L1mT1bWT5Qg",title:"전승노드 꿀팁",description:"클래스 전승과 노드 세팅에 도움이 되는 주요 팁입니다.",category:"주요 영상",type:"featured",url:"https://www.youtube.com/watch?v=L1mT1bWT5Qg"},
{id:"8TokefIDsrg",title:"업데이트 소식",description:"프라시아 전기의 최신 업데이트 내용을 빠르게 확인하세요.",category:"업데이트",type:"featured",url:"https://www.youtube.com/shorts/8TokefIDsrg"},
{id:"DZ6j7Ofsrbg",title:"토벌 기적의 세팅법",description:"토벌 진행에 도움이 되는 세팅 방법을 소개합니다.",category:"토벌 공략",type:"featured",url:"https://www.youtube.com/watch?v=DZ6j7Ofsrbg"}];
const pages=document.querySelectorAll('.page'),sideButtons=document.querySelectorAll('.side-menu-item'),sidebar=document.getElementById('sidebar'),dim=document.getElementById('mobileDim');
function moveToPage(id){const page=document.getElementById(id),button=document.querySelector(`[data-page="${id}"]`);if(!page)return;pages.forEach(x=>x.classList.remove('active'));sideButtons.forEach(x=>x.classList.remove('active'));page.classList.add('active');if(button)button.classList.add('active');window.scrollTo({top:0,behavior:'smooth'});closeMenu()}
sideButtons.forEach(b=>b.addEventListener('click',()=>moveToPage(b.dataset.page)));document.querySelectorAll('[data-move-page]').forEach(b=>b.addEventListener('click',()=>moveToPage(b.dataset.movePage)));
function closeMenu(){sidebar.classList.remove('open');dim.classList.remove('open')}document.getElementById('mobileMenuButton').addEventListener('click',()=>{sidebar.classList.add('open');dim.classList.add('open')});dim.addEventListener('click',closeMenu);
const modal=document.getElementById('sheetModal'),frame=document.getElementById('sheetFrame'),modalTitle=document.getElementById('sheetModalTitle'),openNew=document.getElementById('sheetOpenNew');
function openSheet(i){const s=sheetLinks[i];modalTitle.textContent=s[0];frame.src=s[1];openNew.href=s[1];modal.classList.add('open');document.body.style.overflow='hidden'}function closeSheet(){modal.classList.remove('open');frame.src='about:blank';document.body.style.overflow=''}document.querySelectorAll('.sheet-button').forEach(b=>b.addEventListener('click',()=>openSheet(+b.dataset.sheetIndex)));document.getElementById('sheetModalClose').addEventListener('click',closeSheet);modal.addEventListener('click',e=>{if(e.target===modal)closeSheet()});document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeSheet();closeMenu()}});
function card(v){const a=document.createElement('a');a.className='video-card';a.href=v.url;a.target='_blank';a.rel='noopener noreferrer';a.innerHTML=`<div class="video-thumb"><img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="${v.title} 썸네일" loading="lazy"><span class="play-mark">▶</span></div><div class="video-info"><span class="video-category">${v.category||'영상'}</span><strong>${v.title}</strong><p>${v.description||''}</p></div>`;return a}
function empty(text){return `<div class="empty-state compact-state" style="grid-column:1/-1"><strong>${text}</strong><p>추후 data/videos.json에 영상을 추가하면 자동으로 카드가 생성됩니다.</p></div>`}
function render(videos){for(const [id,type,label] of [['featuredVideoGrid','featured','주요 영상'],['reviewVideoGrid','review','리뷰 방송 영상 준비 중'],['raidVideoGrid','raid','토벌 공략 영상 준비 중']]){const grid=document.getElementById(id),list=videos.filter(v=>v.type===type);grid.innerHTML='';if(list.length)list.forEach(v=>grid.appendChild(card(v)));else grid.innerHTML=empty(label)}}
fetch('./data/videos.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(render).catch(()=>render(fallbackVideos));
