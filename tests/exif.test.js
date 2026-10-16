import {describe,it,expect} from 'vitest';
import {parseGps,readGps} from '../src/exif';
// Builds a real TIFF/EXIF block with a GPS section, so the reader is checked against the actual byte layout.
function tiff({le=false,lat=[41,17,11.76],latRef='S',lng=[174,46,34.5],lngRef='E',alt=12.5,altRef=0}={}){
 const entries=[];const n=(alt==null?4:6);
 const gpsAt=26,dataAt=gpsAt+2+12*n+4;
 const buf=new ArrayBuffer(dataAt+80),v=new DataView(buf);let data=dataAt;
 const w16=(o,x)=>v.setUint16(o,x,le),w32=(o,x)=>v.setUint32(o,x,le);
 v.setUint16(0,le?0x4949:0x4d4d);w16(2,42);w32(4,8);
 w16(8,1);w16(10,0x8825);w16(12,4);w32(14,1);w32(18,gpsAt);w32(22,0);
 w16(gpsAt,n);let e=gpsAt+2;
 const ascii=(tag,ch)=>{w16(e,tag);w16(e+2,2);w32(e+4,2);v.setUint8(e+8,ch.charCodeAt(0));e+=12};
 const rats=(tag,list)=>{w16(e,tag);w16(e+2,5);w32(e+4,list.length);w32(e+8,data);list.forEach(x=>{const d=100;w32(data,Math.round(x*d));w32(data+4,d);data+=8});e+=12};
 ascii(1,latRef);rats(2,lat);ascii(3,lngRef);rats(4,lng);
 if(alt!=null){w16(e,5);w16(e+2,1);w32(e+4,1);v.setUint8(e+8,altRef);e+=12;rats(6,[alt])}
 return new Uint8Array(buf,0,data);
}
const cat=(...a)=>{const o=new Uint8Array(a.reduce((s,x)=>s+x.length,0));let p=0;a.forEach(x=>{o.set(x,p);p+=x.length});return o};
const jpeg=(t,{junk=0}={})=>{const exif=cat(new Uint8Array([0x45,0x78,0x69,0x66,0,0]),t),seg=new Uint8Array(4);seg[0]=0xff;seg[1]=0xe1;new DataView(seg.buffer).setUint16(2,exif.length+2);
 const pre=junk?cat(new Uint8Array([0xff,0xe0,0,junk+2]),new Uint8Array(junk)):new Uint8Array();
 return cat(new Uint8Array([0xff,0xd8]),pre,seg,exif,new Uint8Array([0xff,0xda,0,2,0,0])).buffer};
const u32=(x,le)=>{const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,x,le);return b};
const ascii4=s=>new Uint8Array([...s].map(c=>c.charCodeAt(0)));
const webp=t=>{const pad=t.length%2?new Uint8Array(1):new Uint8Array();return cat(ascii4('RIFF'),u32(0,true),ascii4('WEBP'),ascii4('VP8 '),u32(4,true),new Uint8Array(4),ascii4('EXIF'),u32(t.length,true),t,pad).buffer};
const png=t=>cat(new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),u32(0,false),ascii4('IHDR'),u32(0,false),u32(t.length,false),ascii4('eXIf'),t,u32(0,false),u32(0,false),ascii4('IDAT'),u32(0,false)).buffer;

describe('reading the position from a photo',()=>{
 it('reads latitude, longitude and altitude from a JPEG (south and east become negative and positive)',()=>{
  const g=parseGps(jpeg(tiff()));
  expect(g.lat).toBeCloseTo(-41.2866,4);expect(g.lng).toBeCloseTo(174.776,3);expect(g.alt).toBe(12.5);
 });
 it('works for both byte orders',()=>{
  for(const le of [true,false]){const g=parseGps(jpeg(tiff({le})));expect(g.lat).toBeCloseTo(-41.2866,4);expect(g.lng).toBeCloseTo(174.776,3)}
 });
 it('uses N and W signs, and altitude below sea level is negative',()=>{
  const g=parseGps(jpeg(tiff({latRef:'N',lngRef:'W',alt:3,altRef:1})));
  expect(g.lat).toBeGreaterThan(0);expect(g.lng).toBeLessThan(0);expect(g.alt).toBe(-3);
 });
 it('gives a position without altitude when the photo has none',()=>{
  const g=parseGps(jpeg(tiff({alt:null})));expect(g.alt).toBeNull();expect(g.lat).toBeCloseTo(-41.2866,4);
 });
 it('finds the data after other JPEG segments',()=>{expect(parseGps(jpeg(tiff(),{junk:300})).lng).toBeCloseTo(174.776,3)});
 it('reads WebP and PNG photos too',()=>{
  expect(parseGps(webp(tiff())).lat).toBeCloseTo(-41.2866,4);expect(parseGps(png(tiff())).lng).toBeCloseTo(174.776,3);
 });
 it('gives null when there is no position, or it makes no sense',()=>{
  expect(parseGps(new Uint8Array(500).buffer)).toBeNull();
  expect(parseGps(jpeg(tiff({lat:[0,0,0],lng:[0,0,0],latRef:'N',lngRef:'E'})))).toBeNull();   // 0,0 means "no fix"
  expect(parseGps(jpeg(tiff({lat:[95,0,0]})))).toBeNull();                                      // outside -90..90
  expect(parseGps(jpeg(tiff({lng:[200,0,0]})))).toBeNull();
 });
 it('never throws on damaged or cut-off files',()=>{
  const ok=new Uint8Array(jpeg(tiff()));
  for(const n of [3,12,40,60,90])expect(()=>parseGps(ok.slice(0,n).buffer)).not.toThrow();
  const bad=ok.slice();bad.fill(0xff,30,70);expect(()=>parseGps(bad.buffer)).not.toThrow();
 });
 it('readGps takes a File, and a File with no position gives null',async()=>{
  const f=new File([jpeg(tiff())],'c.jpg',{type:'image/jpeg'});
  expect((await readGps(f)).lat).toBeCloseTo(-41.2866,4);
  expect(await readGps(new File([new Uint8Array(1000)],'x.jpg',{type:'image/jpeg'}))).toBeNull();
 });
 it('rounds to 6 decimals (about 10 cm), so nothing falsely precise is shown',()=>{
  const g=parseGps(jpeg(tiff()));expect(String(g.lat).split('.')[1].length).toBeLessThanOrEqual(6);
 });
});
