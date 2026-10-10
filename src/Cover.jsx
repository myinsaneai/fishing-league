// 16:9 photo for a club or event, or a plain tile with the first letter when there is no photo.
export default function Cover({c,alt=''}){
 return c.coverUrl?<img className="cover" src={c.coverUrl} alt={alt} loading="lazy"/>:<div className="cover ph" aria-hidden="true">{(c.name||'?').slice(0,1).toUpperCase()}</div>}
