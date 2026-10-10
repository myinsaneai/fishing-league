import {useEffect,useRef} from 'react';
// Closes on Escape, or when both the press and the release happen on the backdrop.
// A text selection or touch that merely ends on the backdrop does not close it.
export default function Modal({onClose,children}){
 const down=useRef(false);
 useEffect(()=>{const k=e=>e.key==='Escape'&&onClose();window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[onClose]);
 return <div className="modal" role="dialog" aria-modal="true" onPointerDown={e=>{down.current=e.target===e.currentTarget}} onClick={e=>{if(down.current&&e.target===e.currentTarget)onClose();down.current=false}}>{children}</div>}
