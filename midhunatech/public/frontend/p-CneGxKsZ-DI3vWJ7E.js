import{W as r,H as s,G as a,P as i,M as m}from"./ionic-Dq2oCyo5.js";import"./vendor-D6N8wQWK.js";/*!
 * (C) Ionic http://ionicframework.com - MIT License
 */const c=()=>{const e=window;e.addEventListener("statusTap",()=>{r(()=>{const n=document.elementFromPoint(e.innerWidth/2,e.innerHeight/2);if(!n)return;const t=s(n);t&&new Promise(o=>a(t,o)).then(()=>{i(async()=>{t.style.setProperty("--overflow","hidden"),await m(t,300),t.style.removeProperty("--overflow")})})})})};export{c as startStatusTap};
