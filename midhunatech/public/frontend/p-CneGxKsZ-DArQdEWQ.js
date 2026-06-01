import{W as r,B as s,A as a,P as i,F as m}from"./ionic-BbLLZTe4.js";import"./vendor-DbFKVUDu.js";/*!
 * (C) Ionic http://ionicframework.com - MIT License
 */const c=()=>{const e=window;e.addEventListener("statusTap",()=>{r(()=>{const n=document.elementFromPoint(e.innerWidth/2,e.innerHeight/2);if(!n)return;const t=s(n);t&&new Promise(o=>a(t,o)).then(()=>{i(async()=>{t.style.setProperty("--overflow","hidden"),await m(t,300),t.style.removeProperty("--overflow")})})})})};export{c as startStatusTap};
