import {useEffect,useRef} from 'react';
// Closes on Escape, or when both the press and the release happen on the backdrop.
// A text selection or touch that merely ends on the backdrop does not close it.
export default function Modal({onClose,children}){
 const down=useRef(false);
 useEffect(()=>{const k=e=>e.key==='Escape'&&onClose();window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[onClose]);
 // Size the overlay to the part of the screen that is actually visible (above the on-screen keyboard),
 // and stop the page behind from scrolling.
 useEffect(()=>{
  const v=window.visualViewport,root=document.documentElement,prev=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const set=()=>{root.style.setProperty('--vvh',v.height+'px');root.style.setProperty('--vvt',v.offsetTop+'px')};
  if(v){set();v.addEventListener('resize',set);v.addEventListener('scroll',set)}
  return()=>{document.body.style.overflow=prev;if(v){v.removeEventListener('resize',set);v.removeEventListener('scroll',set)}root.style.removeProperty('--vvh');root.style.removeProperty('--vvt')}
 },[]);
 return <div className="modal" role="dialog" aria-modal="true" onPointerDown={e=>{down.current=e.target===e.currentTarget}} onClick={e=>{if(down.current&&e.target===e.currentTarget)onClose();down.current=false}}>{children}</div>}
