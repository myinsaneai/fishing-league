import {describe,it,expect} from 'vitest';
import {sizeFor,fmtBytes,checkFile,MAX_BYTES} from '../src/imageTools';
const mp=s=>s.ow*s.oh/1e6;
describe('sizes for full photos (no crop)',()=>{
 it('shrinks a 12 MP phone photo to just under 4 MP, keeping its shape',()=>{
  const s=sizeFor(4032,3024);expect(mp(s)).toBeLessThanOrEqual(4);expect(mp(s)).toBeGreaterThan(3.9);
  expect(Math.abs(s.ow/s.oh-4032/3024)).toBeLessThan(.002);expect([s.sx,s.sy,s.sw,s.sh]).toEqual([0,0,4032,3024]);
 });
 it('handles portrait photos and very large 48 MP ones',()=>{
  const p=sizeFor(3024,4032);expect(p.oh).toBeGreaterThan(p.ow);expect(mp(p)).toBeLessThanOrEqual(4);
  const big=sizeFor(8000,6000);expect(mp(big)).toBeLessThanOrEqual(4);expect(Math.abs(big.ow/big.oh-8000/6000)).toBeLessThan(.002);
 });
 it('never enlarges a smaller picture',()=>{expect(sizeFor(1600,1200)).toMatchObject({ow:1600,oh:1200});expect(sizeFor(2000,2000)).toMatchObject({ow:2000,oh:2000})});
 it('a different megapixel limit works',()=>{expect(mp(sizeFor(4032,3024,{maxMP:2}))).toBeLessThanOrEqual(2)});
});
describe('sizes for covers and avatars (cropped)',()=>{
 it('crops a phone photo to 16:9 and caps the width',()=>{
  const s=sizeFor(4032,3024,{ratio:16/9,maxW:1280});expect([s.ow,s.oh]).toEqual([1280,720]);expect(s.sw).toBe(4032);expect(s.sh).toBe(2268);expect(s.sy).toBe(378);
 });
 it('crops to a square for avatars',()=>{const s=sizeFor(4032,3024,{ratio:1,maxW:512});expect([s.ow,s.oh,s.sw,s.sh,s.sx,s.sy]).toEqual([512,512,3024,3024,504,0])});
 it('stays under 4 MP whatever the width cap',()=>{expect(mp(sizeFor(8000,6000,{ratio:16/9,maxW:6000,maxMP:4}))).toBeLessThanOrEqual(4)});
});
describe('file checks',()=>{
 const f=(type,size)=>({type,size});
 it('accepts JPEG, PNG and WebP up to 15 MB',()=>{['image/jpeg','image/png','image/webp'].forEach(t=>expect(checkFile(f(t,MAX_BYTES))).toBe(''));expect(MAX_BYTES).toBe(15*1024*1024)});
 it('refuses other types and anything bigger than 15 MB',()=>{expect(checkFile(f('image/gif',10))).toMatch(/JPEG, PNG or WebP/);expect(checkFile(f('application/pdf',10))).not.toBe('');expect(checkFile(f('image/jpeg',MAX_BYTES+1))).toMatch(/over 15 MB/)});
 it('writes sizes in plain words',()=>{expect(fmtBytes(500)).toBe('1 KB');expect(fmtBytes(640*1024)).toBe('640 KB');expect(fmtBytes(12.4*1048576)).toBe('12.4 MB')});
});
